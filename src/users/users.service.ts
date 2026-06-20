import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PipelineStage, Types } from 'mongoose';
import { AccountType } from './enums/account-type.enum';
import { AgeBandAtRegistration } from './enums/age-band-at-registration.enum';
import { State } from './enums/state.enum';
import { ageFromBirthDate, User } from './entities/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, Model, UpdateQuery } from 'mongoose';
import { StateComplianceLaws } from 'src/compliance/entities/state-compliance-laws.entity';

export type AccountStatus = 'MANAGED' | 'INDEPENDENT' | 'ADULT';

/** COPPA-style bands: under 13 managed, 13–17 independent login, 18+ adult. */
export function accountStatusFromBirthDate(
  birthDate: Date | null | undefined,
  refDate?: Date,
): AccountStatus | null {
  if (birthDate == null) {
    return null;
  }

  const age = ageFromBirthDate(birthDate, refDate);
  if (age < 13) {
    return 'MANAGED';
  }

  if (age < 18) {
    return 'INDEPENDENT';
  }

  return 'ADULT';
}

export function isMinorAgeBand(
  ageBand: AgeBandAtRegistration | null | undefined,
): boolean {
  return (
    ageBand === AgeBandAtRegistration.Teen13To17 ||
    ageBand === AgeBandAtRegistration.ChildUnder13Managed
  );
}

export function accountStatusFromAgeBandAndAccountType(
  ageBand: AgeBandAtRegistration | null | undefined,
  accountType: AccountType | null | undefined,
): AccountStatus | null {
  if (ageBand == null || accountType == null) {
    return null;
  }

  if (
    ageBand === AgeBandAtRegistration.Adult18Plus &&
    accountType === AccountType.Adult
  ) {
    return 'ADULT';
  }

  if (accountType === AccountType.Student) {
    if (ageBand === AgeBandAtRegistration.Teen13To17) {
      return 'INDEPENDENT';
    }

    if (ageBand === AgeBandAtRegistration.ChildUnder13Managed) {
      return 'MANAGED';
    }
  }

  return null;
}

/** Prefer attested age band; fall back to legacy birthDate. */
export function resolveAccountStatusForUser(user: {
  ageBandAtRegistration?: AgeBandAtRegistration | null;
  accountType?: AccountType | null;
  birthDate?: Date | null;
}): AccountStatus | null {
  const fromBand = accountStatusFromAgeBandAndAccountType(
    user.ageBandAtRegistration ?? null,
    user.accountType ?? null,
  );
  if (fromBand != null) {
    return fromBand;
  }

  return accountStatusFromBirthDate(
    user.birthDate == null ? null : new Date(user.birthDate),
  );
}

/** Start of the local calendar day when the user turns 18 (exclusive upper bound for minor-era data). */
export function eighteenthBirthdayStart(birthDate: Date): Date {
  const bd = new Date(birthDate);
  return new Date(bd.getFullYear() + 18, bd.getMonth(), bd.getDate());
}

export type EnrolledClassLean = {
  adult?: Types.ObjectId;
  course?: unknown;
  subjectId?: Types.ObjectId | null;
  curriculumId?: Types.ObjectId | null;
  hoursCompleted?: number;
  createdAt?: Date;
};

function filterAddedClassesForParentView(
  classes: EnrolledClassLean[] | undefined,
  birthDate: Date | null | undefined,
  ageBandAtRegistration: AgeBandAtRegistration | null | undefined,
): EnrolledClassLean[] {
  if (!classes?.length) {
    return classes ?? [];
  }

  if (isMinorAgeBand(ageBandAtRegistration)) {
    return classes;
  }

  if (birthDate) {
    const cutoff = eighteenthBirthdayStart(new Date(birthDate));
    return classes.filter((c) => {
      const t = c.createdAt;
      if (t == null) {
        return false;
      }

      return new Date(t) < cutoff;
    });
  }

  return [];
}

function toObjectId(id: Types.ObjectId | string): Types.ObjectId {
  return typeof id === 'string' ? new Types.ObjectId(id) : id;
}

function isDuplicateKeyError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: number }).code === 11000
  );
}

/** Plain user document shape for return types; avoids Mongoose Document in callers/tests. */
export interface UserDoc {
  _id: Types.ObjectId;
  cognitoSub?: string | null;
  linkedProviders?: string[];
  linkedProviderSubjects?: { GOOGLE?: string };
  hasPassword?: boolean;
  email?: string | null;
  deleted?: boolean;
  accountType?: AccountType | null;
  givenName?: string | null;
  familyName?: string | null;
  coppaConsentAt?: Date | null;
  firstLoggedInAt?: Date | null;
  birthDate?: Date | null;
  avatar?: string | null;
  interests?: string[];
  shortTermGoal?: string | null;
  longTermGoal?: string | null;
  learningStyles?: string[];
  onboardingCompletedAt?: Date | null;
  state?: State | null;
  zipCode?: string | null;
  parentId?: Types.ObjectId | null;
  studentId?: string | null;
  canManageOthers?: boolean;
  linkedStudents?: Types.ObjectId[];
  addedClasses?: EnrolledClassLean[];
  ageBandAtRegistration?: AgeBandAtRegistration | null;
  managedAccountsView?: {
    studentId: Types.ObjectId;
    displayName: string;
    currentGrade: number;
    lastPromotionYear: number;
    archivedAt?: Date | null;
  }[];
  teachableCourses?: {
    _id?: Types.ObjectId;
    className?: string;
    subjectId?: Types.ObjectId;
    matchesAllGrades?: boolean;
    grades?: string[];
    curriculum?: string;
    maxStudents?: number;
  }[];
  notificationEvents?: {
    type: 'COURSE_REMOVED';
    recipientUserId: string;
    payload: unknown;
    createdAt: Date;
  }[];
}

export type CreateUserInput = {
  cognitoSub?: string | null;
  email?: string | null;
  hasPassword: boolean;
  accountType: AccountType;
  givenName?: string | null;
  familyName?: string | null;
  coppaConsentAt?: Date | null;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(StateComplianceLaws.name)
    private complianceLawsModel: Model<StateComplianceLaws>,
  ) {}

  createUser(input: CreateUserInput) {
    return this.userModel.create(input);
  }

  aggregate(pipelines: PipelineStage[]) {
    return this.userModel.aggregate<UserDoc>([
      ...pipelines,
      {
        $match: {
          deleted: { $ne: true },
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
          familyName: 1,
          givenName: 1,
          state: 1,
          zipCode: 1,
          availability: 1,
          teachableCourses: 1,
        },
      },
    ]);
  }

  findOneById(_id: Types.ObjectId) {
    return this.userModel.findById(_id);
  }

  /**
   * Loads a user for API responses. When the viewer is the child's guardian,
   * {@link User.addedClasses} is limited to enrollments with `createdAt` strictly
   * before the child's 18th birthday (undated rows are omitted).
   */
  async findOneByIdForViewer(
    viewerCognitoSub: string | undefined,
    targetId: Types.ObjectId,
  ): Promise<UserDoc | null> {
    const doc = await this.userModel.findById(targetId).lean();
    if (!doc) {
      return null;
    }

    let plain = { ...doc } as UserDoc;
    let discloseEnrollments: 'none' | 'self' | 'parent' = 'none';

    if (viewerCognitoSub) {
      const viewer = await this.findOneByCognitoSub(viewerCognitoSub);
      if (viewer && !viewer.deleted) {
        const vId = viewer._id;
        const tId = plain._id;
        if (vId.equals(tId)) {
          discloseEnrollments = 'self';
        } else if (await this.isParentOf(vId, tId)) {
          discloseEnrollments = 'parent';
          plain = {
            ...plain,
            addedClasses: filterAddedClassesForParentView(
              plain.addedClasses,
              plain.birthDate ? new Date(plain.birthDate) : null,
              plain.ageBandAtRegistration ?? null,
            ),
          };
        }
      }
    }

    if (discloseEnrollments === 'none') {
      const rest = { ...plain };
      delete rest.addedClasses;
      return rest as UserDoc;
    }

    return plain;
  }

  async findOneByCognitoSub(sub: string): Promise<UserDoc | null> {
    const doc = await this.userModel.findOne({ cognitoSub: sub }).lean();
    return doc as UserDoc | null;
  }

  /**
   * Sets the `curriculumId` on the `addedClasses` entry matching the given
   * `subjectId` for the specified student user.
   */
  async setCurriculumSelection(
    studentUserId: Types.ObjectId,
    subjectId: string,
    curriculumId: string,
  ) {
    return this.userModel.findOneAndUpdate(
      {
        _id: studentUserId,
        'addedClasses.subjectId': new Types.ObjectId(subjectId),
      },
      {
        $set: {
          'addedClasses.$.curriculumId': new Types.ObjectId(curriculumId),
        },
      },
      { new: true },
    );
  }

  updateByCognitoSub(cognitoSub: string, update: UpdateQuery<User>) {
    return this.userModel.findOneAndUpdate({ cognitoSub }, update, {
      new: true,
    });
  }

  addLinkGoogle(cognitoSub: string, googleSub: string) {
    return this.userModel.findOneAndUpdate(
      { cognitoSub },
      {
        $addToSet: { linkedProviders: 'GOOGLE' },
        $set: { 'linkedProviderSubjects.GOOGLE': googleSub },
      },
      { new: true },
    );
  }

  removeLinkGoogle(cognitoSub: string) {
    return this.userModel.findOneAndUpdate(
      { cognitoSub },
      {
        $pull: { linkedProviders: 'GOOGLE' },
        $unset: { 'linkedProviderSubjects.GOOGLE': '' },
      },
      { new: true },
    );
  }

  updateById(_id: Types.ObjectId, updateUserDto: UpdateUserDto) {
    return this.userModel.findByIdAndUpdate(_id, updateUserDto, { new: true });
  }

  removeById(_id: Types.ObjectId) {
    return this.userModel.findByIdAndDelete(_id);
  }

  /** Clears all user documents (E2E test reset only). */
  deleteAllUsers(): Promise<DeleteResult> {
    return this.userModel.deleteMany({});
  }

  /** Seeds the pre-existing E2E user document after Cognito admin create. */
  createSeedUser(cognitoSub: string, email: string): Promise<User> {
    return this.userModel.create({
      cognitoSub,
      email,
      hasPassword: true,
      firstLoggedInAt: new Date(),
      accountType: AccountType.Student,
      state: null,
      zipCode: null,
    });
  }

  /**
   * Creates a managed child User document (no Cognito login) and links it
   * to the parent by pushing into `linkedStudents`. Populates `addedClasses`
   * with state-required subjects when a state is provided.
   */
  async createManagedChild(
    parentId: Types.ObjectId,
    data: {
      givenName: string;
      currentGrade?: number;
      studentId?: Types.ObjectId;
      lastPromotionYear: number;
      state?: string | null;
    },
  ): Promise<User> {
    // Query state-required subjects if a state is provided
    let addedClasses: {
      subjectId: Types.ObjectId;
      hoursCompleted: number;
      createdAt: Date;
    }[] = [];
    if (data.state) {
      const complianceLaw = await this.complianceLawsModel
        .findOne({ abbreviation: data.state.toUpperCase() })
        .lean();

      if (complianceLaw?.subjectsRequiredTopicIds?.length) {
        const now = new Date();
        addedClasses = complianceLaw.subjectsRequiredTopicIds.map(
          (subjectId) => ({
            subjectId: new Types.ObjectId(subjectId.toString()),
            hoursCompleted: 0,
            createdAt: now,
          }),
        );
      }
    }

    const child = await this.userModel.create({
      accountType: AccountType.Student,
      ageBandAtRegistration: AgeBandAtRegistration.ChildUnder13Managed,
      givenName: data.givenName,
      parentId,
      hasPassword: false,
      addedClasses,
    });

    // ponytail: callers already push managedAccountsView entry with a placeholder
    // studentId. Patch that entry to reference the real child._id instead of
    // adding a duplicate. Falls back to $addToSet only if no placeholder exists
    // (defensive; shouldn't happen in normal flow).
    if (data.studentId) {
      await this.userModel.findOneAndUpdate(
        { _id: parentId, 'managedAccountsView.studentId': data.studentId },
        { $set: { 'managedAccountsView.$.studentId': child._id } },
      );
    } else {
      await this.userModel.findByIdAndUpdate(parentId, {
        $addToSet: {
          managedAccountsView: {
            studentId: child._id,
            displayName: child.givenName,
            archivedAt: null,
          },
        },
      });
    }

    return child;
  }

  /**
   * Grants a managed child profile (no Cognito login) its own credentials
   * while preserving `_id` and existing fields.
   */
  async upgradeToIndependent(
    userId: Types.ObjectId | string,
    email: string,
    cognitoId: string,
  ): Promise<User> {
    const _id = toObjectId(userId);
    const existing = await this.userModel.findById(_id).lean();
    if (!existing || existing.deleted) {
      throw new NotFoundException('User not found');
    }

    if (existing.cognitoSub) {
      throw new BadRequestException('Account already has its own login');
    }

    try {
      const updated = await this.userModel.findOneAndUpdate(
        {
          _id,
          $or: [
            { cognitoSub: null },
            { cognitoSub: { $exists: false } },
            { cognitoSub: '' },
          ],
          deleted: { $ne: true },
        },
        {
          $set: {
            email,
            cognitoSub: cognitoId,
            hasPassword: true,
          },
        },
        { new: true },
      );
      if (!updated) {
        throw new BadRequestException(
          'Could not upgrade account; state may have changed',
        );
      }

      return updated;
    } catch (e) {
      if (isDuplicateKeyError(e)) {
        throw new BadRequestException('Email or login id is already in use');
      }

      throw e;
    }
  }

  /**
   * True when `childId` lists `parentId` as guardian and the child is under 18.
   */
  async isParentOf(
    parentId: Types.ObjectId | string,
    childId: Types.ObjectId | string,
  ): Promise<boolean> {
    const parentObjectId = toObjectId(parentId);
    const childObjectId = toObjectId(childId);
    const child = await this.userModel
      .findById(childObjectId)
      .select('parentId birthDate deleted ageBandAtRegistration')
      .lean();
    if (!child || child.deleted || child.parentId == null) {
      return false;
    }

    const pid = child.parentId;
    if (!pid.equals(parentObjectId)) {
      return false;
    }

    if (isMinorAgeBand(child.ageBandAtRegistration ?? null)) {
      return true;
    }

    if (!child.birthDate) {
      return false;
    }

    const age = ageFromBirthDate(new Date(child.birthDate));
    return age < 18;
  }
}
