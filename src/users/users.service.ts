import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { Types } from 'mongoose';
import { AccountType } from './enums/account-type.enum';
import { State } from './enums/state.enum';
import { ageFromBirthDate, User } from './entities/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, Model, UpdateQuery } from 'mongoose';

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

/** Start of the local calendar day when the user turns 18 (exclusive upper bound for minor-era data). */
export function eighteenthBirthdayStart(birthDate: Date): Date {
  const bd = new Date(birthDate);
  return new Date(bd.getFullYear() + 18, bd.getMonth(), bd.getDate());
}

export type EnrolledClassLean = {
  adult?: Types.ObjectId;
  course?: unknown;
  hoursCompleted?: number;
  createdAt?: Date;
};

function filterAddedClassesForParentView(
  classes: EnrolledClassLean[] | undefined,
  birthDate: Date,
): EnrolledClassLean[] {
  if (!classes?.length) {
    return classes ?? [];
  }

  const cutoff = eighteenthBirthdayStart(birthDate);
  return classes.filter((c) => {
    const t = c.createdAt;
    if (t == null) {
      return false;
    }

    return new Date(t) < cutoff;
  });
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
  canManageOthers?: boolean;
  linkedStudents?: Types.ObjectId[];
  addedClasses?: EnrolledClassLean[];
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
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  createUser(input: CreateUserInput) {
    return this.userModel.create(input);
  }

  findAll() {
    return this.userModel.find();
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
        } else if (plain.birthDate && (await this.isParentOf(vId, tId))) {
          discloseEnrollments = 'parent';
          plain = {
            ...plain,
            addedClasses: filterAddedClassesForParentView(
              plain.addedClasses,
              new Date(plain.birthDate),
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
      .select('parentId birthDate deleted')
      .lean();
    if (!child || child.deleted || child.parentId == null) {
      return false;
    }

    if (!child.birthDate) {
      return false;
    }

    const pid = child.parentId;
    if (!pid.equals(parentObjectId)) {
      return false;
    }

    const age = ageFromBirthDate(new Date(child.birthDate));
    return age < 18;
  }
}
