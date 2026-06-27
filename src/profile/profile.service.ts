import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoService } from 'src/cognito/cognito.service';
import {
  UsersService,
  type UserDoc,
  type AccountStatus,
  resolveAccountStatusForUser,
} from 'src/users/users.service';
import { GoogleService } from 'src/google/google.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import { MaxmindService } from 'src/maxmind/maxmind.service';
import { resolveCognitoWebAuthnCredentialDisplay } from 'src/profile/webauthn-credential-display';
import type { WebAuthnCredentialListItemDto } from 'src/profile/dto/out/webauthn-credential-list-item.dto';
import { MAXMIND_KEY } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';
import { DeleteMeDto } from './dto/delete-me.dto';
import { AccountSetupDto } from './dto/account-setup.dto';
import { AddTeachableCourseDto } from './dto/add-teachable-course.dto';
import { AccountType } from 'src/users/enums/account-type.enum';
import { AgeBandAtRegistration } from 'src/users/enums/age-band-at-registration.enum';
import { OnboardingExpectedBand } from 'src/users/enums/onboarding-expected-band.enum';
import { Types } from 'mongoose';
import { AddHouseholdStudentDto } from './dto/add-household-student.dto';

export type TeachableCourseResponseItem = {
  className: string;
  subjectId: string;
  matchesAllGrades: boolean;
  grades: string[];
  curriculum: string;
  maxStudents: number;
  activeEnrollmentCount: number;
};

export type HouseholdStudentMe = {
  studentId: Types.ObjectId;
  displayName: string;
  currentGrade: number;
  lastPromotionYear: number;
  /** ISO timestamp when archived; null when active. */
  archivedAt?: string | null;
};

export interface GetMeData {
  _id: string;
  loginMethods: string[];
  hasPassword: boolean;
  hasPasskey: boolean;
  passkeyCount: number;
  softwareTokenMfaEnabled?: boolean;
  preferredMfa?: string;
  firstLoggedInAt?: string | null;
  onboardingCompletedAt?: string | null;
  accountType?: string | null;
  canManageOthers?: boolean;
  parentId?: string | null;
  linkedStudentIds?: string[];
  accountStatus?: AccountStatus | null;
  ageBandAtRegistration?: string | null;
  householdStudents?: HouseholdStudentMe[];
  /** Full list including archived drafts (adults only). */
  managedAccountsViewAll?: HouseholdStudentMe[];
  teachableCourses?: TeachableCourseResponseItem[];
  address?: { state?: string | null };
}

function firstLoggedInAtToIso(value: Date | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value as string | number).toISOString();
}

/** Normalize optional Mongoose date paths for ESLint-safe handling. */
function mongoDateOrNull(value: unknown): Date | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  return null;
}

/** Serialize archive timestamp for API; null when absent or not archived. */
function householdDraftArchivedIso(d: { archivedAt?: unknown }): string | null {
  const at = mongoDateOrNull(d.archivedAt);
  return at ? at.toISOString() : null;
}

function mapStoredDraftToHouseholdStudentMe(managedAccount: {
  studentId: Types.ObjectId;
  displayName: string;
  currentGrade: number;
  lastPromotionYear: number;
  archivedAt?: unknown;
}): HouseholdStudentMe {
  return {
    studentId: managedAccount.studentId,
    displayName: managedAccount.displayName,
    currentGrade: managedAccount.currentGrade,
    lastPromotionYear: managedAccount.lastPromotionYear,
    archivedAt: householdDraftArchivedIso(managedAccount),
  };
}

function parseAvailabilitySlotMinutes(s: string): number | null {
  if (typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) {
    return null;
  }

  const [h, m] = s.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return null;
  }

  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }

  return h * 60 + m;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly cognitoService: CognitoService,
    private readonly usersService: UsersService,
    private readonly googleService: GoogleService,
    private readonly maxmindService: MaxmindService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async getMe(
    accessToken: string,
    currentUser: Record<string, unknown> & { sub?: string },
  ): Promise<GetMeData> {
    const sub = currentUser?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new UnauthorizedException('Not authenticated');
    }

    const response = await this.cognitoService.getUser(accessToken);
    if (!response?.UserAttributes) {
      throw new UnauthorizedException('Not authenticated');
    }

    const attributes = (response.UserAttributes ?? []).reduce(
      (acc, a) => {
        if (a.Name != null && a.Value != null) acc[a.Name] = a.Value;

        return acc;
      },
      {} as Record<string, string>,
    );
    const attrsSub = attributes.sub as string | undefined;
    if (!attrsSub || typeof attrsSub !== 'string') {
      throw new UnauthorizedException('Not authenticated');
    }

    const row = await this.usersService.findOneByCognitoSub(attrsSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    const user: UserDoc = row;

    const loginMethods = user.linkedProviders ?? [];
    const hasPassword = user.hasPassword ?? true;
    let passkeyCount = 0;
    try {
      const listRes =
        await this.cognitoService.listWebAuthnCredentials(accessToken);
      passkeyCount = listRes?.Credentials?.length ?? 0;
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        passkeyCount = 0;
      } else {
        throw e;
      }
    }
    const softwareTokenMfaEnabled =
      response.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA') ?? false;
    const preferredMfa = response.PreferredMfaSetting ?? undefined;

    const accountStatus = resolveAccountStatusForUser({
      ageBandAtRegistration: user.ageBandAtRegistration ?? null,
      accountType: user.accountType ?? null,
      birthDate: user.birthDate ?? null,
    });

    const draftsRaw = user.managedAccountsView ?? [];

    const managedAccountsViewAll: HouseholdStudentMe[] | undefined =
      user.accountType === AccountType.Adult
        ? draftsRaw.map((d) => mapStoredDraftToHouseholdStudentMe(d))
        : undefined;

    const householdStudents: HouseholdStudentMe[] | undefined =
      user.accountType === AccountType.Adult
        ? draftsRaw
            .filter((d) => householdDraftArchivedIso(d) === null)
            .map((d) => ({
              studentId: d.studentId,
              displayName: d.displayName,
              currentGrade: d.currentGrade,
              lastPromotionYear: d.lastPromotionYear,
              archivedAt: null,
            }))
        : undefined;

    let teachableCourses: TeachableCourseResponseItem[] | undefined;
    if (user.accountType === AccountType.Adult) {
      const rawCourses = (user.teachableCourses ?? []) as Array<{
        _id?: Types.ObjectId;
        className?: string;
        subjectId?: Types.ObjectId;
        matchesAllGrades?: boolean;
        grades?: string[];
        curriculum?: string;
        maxStudents?: number;
        activeEnrollmentCount?: number;
      }>;

      teachableCourses = rawCourses.map((course) => ({
        className: course.className ?? '',
        subjectId: course.subjectId ? course.subjectId.toString() : '',
        matchesAllGrades: course.matchesAllGrades ?? false,
        grades: course.grades ?? [],
        curriculum: course.curriculum ?? '',
        maxStudents: course.maxStudents ?? 0,
        activeEnrollmentCount: course.activeEnrollmentCount ?? 0,
      }));
    }

    return {
      ...attributes,
      loginMethods,
      hasPassword,
      hasPasskey: passkeyCount > 0,
      passkeyCount,
      softwareTokenMfaEnabled,
      preferredMfa,
      _id: user._id.toString(),
      firstLoggedInAt: firstLoggedInAtToIso(
        mongoDateOrNull(Reflect.get(user, 'firstLoggedInAt')),
      ),
      onboardingCompletedAt: firstLoggedInAtToIso(
        mongoDateOrNull(Reflect.get(user, 'onboardingCompletedAt')),
      ),
      accountType: user.accountType ?? null,
      canManageOthers: user.canManageOthers ?? false,
      parentId: user.parentId ? user.parentId.toString() : null,
      linkedStudentIds: (user.linkedStudents ?? []).map((id) => id.toString()),
      accountStatus,
      ageBandAtRegistration: user.ageBandAtRegistration ?? null,
      ...(householdStudents !== undefined ? { householdStudents } : {}),
      ...(managedAccountsViewAll !== undefined
        ? { managedAccountsViewAll }
        : {}),
      ...(teachableCourses !== undefined ? { teachableCourses } : {}),
      address: { state: user.state },
    };
  }

  async startWebAuthnRegistration(accessToken: string) {
    const res =
      await this.cognitoService.startWebAuthnRegistration(accessToken);
    if (!res?.CredentialCreationOptions) {
      throw new InternalServerErrorException(
        'Could not start passkey registration',
      );
    }

    return res.CredentialCreationOptions as Record<string, unknown>;
  }

  async completeWebAuthnRegistration(
    accessToken: string,
    credential: Record<string, unknown>,
  ) {
    await this.cognitoService.completeWebAuthnRegistration(
      accessToken,
      credential,
    );
  }

  async listWebAuthnCredentialsForSettings(
    accessToken: string,
  ): Promise<WebAuthnCredentialListItemDto[]> {
    try {
      return await this.listWebAuthnCredentialsForSettingsInner(accessToken);
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        return [];
      }

      throw e;
    }
  }

  private async listWebAuthnCredentialsForSettingsInner(
    accessToken: string,
  ): Promise<WebAuthnCredentialListItemDto[]> {
    const res = await this.cognitoService.listWebAuthnCredentials(accessToken);
    const rows = res?.Credentials ?? [];
    return rows.map((c) => {
      const { displayName, provider } = resolveCognitoWebAuthnCredentialDisplay(
        {
          FriendlyCredentialName: c.FriendlyCredentialName,
          AuthenticatorAttachment: c.AuthenticatorAttachment,
          AuthenticatorTransports: c.AuthenticatorTransports,
        },
      );
      return {
        credentialId: c.CredentialId ?? '',
        displayName,
        provider,
        createdAt: c.CreatedAt
          ? new Date(c.CreatedAt).toISOString()
          : new Date(0).toISOString(),
        lastUsedAt: null,
      };
    });
  }

  async deleteWebAuthnCredential(
    accessToken: string,
    credentialId: string,
  ): Promise<void> {
    await this.cognitoService.deleteWebAuthnCredential(
      accessToken,
      credentialId,
    );
  }

  /**
   * Persists onboarding wizard data and sets Cognito given_name. Does not set
   * firstLoggedInAt (that remains POST /profile/first-login after welcome).
   */
  async saveAccountSetup(
    accessToken: string,
    cognitoSub: string,
    dto: AccountSetupDto,
  ): Promise<{ onboardingCompletedAt: string }> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    const accountType = dto.accountType;
    if (
      accountType === AccountType.Student &&
      (!dto.interests || dto.interests.length < 1)
    ) {
      throw new BadRequestException('Select at least one interest');
    }

    if (accountType === AccountType.Adult) {
      if (!dto.pendingStudents?.length) {
        throw new BadRequestException('Add at least one student');
      }
    }

    const ageBand = this.resolveAgeBandFromAccountSetup(dto);

    const name = dto.name.trim();
    const cognitoResponse = await this.cognitoService.updateUserAttributes(
      accessToken,
      [
        { Name: 'given_name', Value: name },
        { Name: 'phone_number', Value: dto.phoneNumber.trim() },
      ],
    );
    if (!cognitoResponse) {
      throw new InternalServerErrorException(
        'Failed to update profile in Cognito',
      );
    }

    const totalAvailSlots = dto.weeklyAvailability.reduce(
      (n, d) => n + (d.slots?.length ?? 0),
      0,
    );
    if (totalAvailSlots < 1) {
      throw new BadRequestException('Add at least one availability time range');
    }

    for (const d of dto.weeklyAvailability) {
      for (const s of d.slots ?? []) {
        const sm = parseAvailabilitySlotMinutes(s.start);
        const em = parseAvailabilitySlotMinutes(s.end);
        if (sm === null || em === null || sm >= em) {
          throw new BadRequestException(
            'Each availability range must have an end time after the start time',
          );
        }
      }
    }

    const teachableCourses =
      dto.teachableCourses?.map((c) => ({
        className: c.className.trim(),
        subjectId: new Types.ObjectId(c.subjectId),
        curriculum: c.curriculum,
        matchesAllGrades: c.matchesAllGrades,
        grades: c.matchesAllGrades ? [] : [...c.grades],
        maxStudents: c.maxStudents,
      })) ?? [];

    const availabilityForStore = dto.weeklyAvailability.map((d) => ({
      day: d.day,
      slots: (d.slots ?? []).map((s) => ({
        start: s.start,
        end: s.end,
      })),
    }));

    const promotionYear = new Date().getFullYear();
    const managedAccountsView =
      dto.pendingStudents?.map((s) => ({
        studentId: new Types.ObjectId(),
        displayName: s.displayName.trim(),
        currentGrade: s.currentGrade,
        lastPromotionYear: promotionYear,
      })) ?? [];

    const baseUpdate: Record<string, unknown> = {
      accountType,
      ageBandAtRegistration: ageBand,
      ageAttestationConfirmedAt: new Date(),
      avatar: dto.avatar,
      interests: dto.interests,
      shortTermGoal: dto.shortTermGoal,
      longTermGoal: dto.longTermGoal,
      learningStyles: dto.learningStyles,
      state: dto.state,
      zipCode: dto.zipCode,
      availablity: availabilityForStore,
      onboardingCompletedAt: new Date(),
    };

    if (accountType === AccountType.Adult) {
      baseUpdate.teachableCourses = teachableCourses;
      baseUpdate.managedAccountsView = managedAccountsView;
    }

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      $set: baseUpdate,
      $unset: { age: '', birthDate: '' },
    });

    if (!updated) {
      throw new InternalServerErrorException('Failed to save account setup');
    }

    // Promote each household student into a real managed-child User document
    if (accountType === AccountType.Adult && managedAccountsView.length > 0) {
      await Promise.all(
        managedAccountsView.map((managedAccount) =>
          this.usersService.createManagedChild(updated._id, {
            givenName: managedAccount.displayName,
            currentGrade: managedAccount.currentGrade,
            studentId: managedAccount.studentId,
            lastPromotionYear: managedAccount.lastPromotionYear,
            state: dto.state ?? null,
          }),
        ),
      );
    }

    const ts = mongoDateOrNull(Reflect.get(updated, 'onboardingCompletedAt'));
    if (!ts) {
      throw new InternalServerErrorException('Failed to save account setup');
    }

    return { onboardingCompletedAt: firstLoggedInAtToIso(ts)! };
  }

  /**
   * August (UTC): increment household student grade and set lastPromotionYear.
   */
  async promoteHouseholdStudentDraft(
    cognitoSub: string,
    studentId: Types.ObjectId,
  ): Promise<HouseholdStudentMe> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    if (row.accountType !== AccountType.Adult) {
      throw new BadRequestException(
        'Only household adults can update student grades',
      );
    }

    const now = new Date();
    if (now.getUTCMonth() !== 7) {
      throw new BadRequestException(
        'Grade promotion is only available in August (UTC)',
      );
    }

    const year = now.getUTCFullYear();
    const drafts = row.managedAccountsView ?? [];
    const idx = drafts.findIndex((managedAccount) =>
      managedAccount.studentId.equals(studentId),
    );
    if (idx < 0) {
      throw new NotFoundException('Student draft not found');
    }

    const current = drafts[idx];
    if (current.lastPromotionYear >= year) {
      throw new BadRequestException(
        'This school year has already been recorded for this student',
      );
    }

    if (current.currentGrade >= 13) {
      throw new BadRequestException('Student is already at the highest grade');
    }

    const nextDrafts = drafts.map((d, i) =>
      i === idx
        ? {
            ...d,
            currentGrade: d.currentGrade + 1,
            lastPromotionYear: year,
          }
        : d,
    );

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      $set: { managedAccountsView: nextDrafts },
    });

    if (!updated) {
      throw new InternalServerErrorException('Failed to promote student');
    }

    const promotedAccount = (updated.managedAccountsView ?? [])[idx];
    return mapStoredDraftToHouseholdStudentMe(promotedAccount);
  }

  async addHouseholdStudent(
    cognitoSub: string,
    dto: AddHouseholdStudentDto,
  ): Promise<HouseholdStudentMe[]> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    if (
      row.accountType !== AccountType.Adult ||
      row.ageBandAtRegistration !== AgeBandAtRegistration.Adult18Plus
    ) {
      throw new ForbiddenException(
        'Only adult users may manage household students',
      );
    }

    const newDraft = {
      studentId: new Types.ObjectId(),
      displayName: dto.displayName.trim(),
      currentGrade: dto.currentGrade,
      lastPromotionYear: new Date().getFullYear(),
      archivedAt: null as Date | null,
    };

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      $push: { managedAccountsView: newDraft },
    });

    if (!updated) {
      throw new InternalServerErrorException('Failed to add household student');
    }

    // Create a real managed-child User document for course enrollment
    const parentId =
      updated._id instanceof Types.ObjectId
        ? updated._id
        : new Types.ObjectId(updated._id as unknown as string);

    await this.usersService.createManagedChild(parentId, {
      givenName: dto.displayName.trim(),
      currentGrade: dto.currentGrade,
      studentId: newDraft.studentId,
      lastPromotionYear: newDraft.lastPromotionYear,
      state: updated.state ?? null,
    });

    return (updated.managedAccountsView ?? []).map((d) =>
      mapStoredDraftToHouseholdStudentMe(d),
    );
  }

  async archiveHouseholdStudent(
    cognitoSub: string,
    studentId: Types.ObjectId,
  ): Promise<HouseholdStudentMe[]> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    if (
      row.accountType !== AccountType.Adult ||
      row.ageBandAtRegistration !== AgeBandAtRegistration.Adult18Plus
    ) {
      throw new ForbiddenException(
        'Only adult users may manage household students',
      );
    }

    const managedAccounts = [...(row.managedAccountsView ?? [])];
    const idx = managedAccounts.findIndex((managedAccount) =>
      new Types.ObjectId(managedAccount.studentId).equals(studentId),
    );
    if (idx < 0) {
      throw new NotFoundException('Student draft not found');
    }

    const archivedAt = new Date();
    const nextDrafts = managedAccounts.map((d, i) =>
      i === idx ? { ...d, archivedAt } : d,
    );

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      $set: { managedAccountsView: nextDrafts },
    });

    if (!updated) {
      throw new InternalServerErrorException(
        'Failed to archive household student',
      );
    }

    return (updated.managedAccountsView ?? []).map((d) =>
      mapStoredDraftToHouseholdStudentMe(d),
    );
  }

  async restoreHouseholdStudent(
    cognitoSub: string,
    studentId: Types.ObjectId,
  ): Promise<HouseholdStudentMe[]> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    if (
      row.accountType !== AccountType.Adult ||
      row.ageBandAtRegistration !== AgeBandAtRegistration.Adult18Plus
    ) {
      throw new ForbiddenException(
        'Only adult users may manage household students',
      );
    }

    const drafts = [...(row.managedAccountsView ?? [])];
    const idx = drafts.findIndex((managedAccount) =>
      managedAccount.studentId.equals(studentId),
    );
    if (idx < 0) {
      throw new NotFoundException('Student draft not found');
    }

    const nextDrafts = drafts.map((d, i) =>
      i === idx ? { ...d, archivedAt: null } : d,
    );

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      $set: { managedAccountsView: nextDrafts },
    });

    if (!updated) {
      throw new InternalServerErrorException(
        'Failed to restore household student',
      );
    }

    return (updated.managedAccountsView ?? []).map((managedAccount) =>
      mapStoredDraftToHouseholdStudentMe(managedAccount),
    );
  }

  /**
   * Appends a new teachable course to the authenticated adult user's
   * `teachableCourses` array using an atomic `$push` operation.
   *
   * Throws `NotFoundException` if the user is not found.
   * Throws `ForbiddenException` if the user is not an adult (accountType !== 'adult'
   * or ageBandAtRegistration !== 'ADULT_18_PLUS').
   */
  async addTeachableCourse(
    cognitoSub: string,
    dto: AddTeachableCourseDto,
  ): Promise<TeachableCourseResponseItem[]> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    if (
      row.accountType !== AccountType.Adult ||
      row.ageBandAtRegistration !== AgeBandAtRegistration.Adult18Plus
    ) {
      throw new ForbiddenException(
        'Only adult users may manage teachable courses',
      );
    }

    const newCourse = {
      className: dto.className.trim(),
      subjectId: new Types.ObjectId(dto.subjectId),
      matchesAllGrades: dto.matchesAllGrades,
      grades: dto.matchesAllGrades ? [] : [...dto.grades],
      curriculum: dto.curriculum,
      maxStudents: dto.maxStudents,
    };

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      $push: { teachableCourses: newCourse },
    });

    if (!updated) {
      throw new InternalServerErrorException('Failed to add teachable course');
    }

    const courses = (updated.teachableCourses ?? []) as Array<{
      className?: string;
      subjectId?: Types.ObjectId;
      matchesAllGrades?: boolean;
      grades?: string[];
      curriculum?: string;
      maxStudents?: number;
      activeEnrollmentCount?: number;
    }>;

    return courses.map((c) => ({
      className: c.className ?? '',
      subjectId: c.subjectId ? c.subjectId.toString() : '',
      matchesAllGrades: c.matchesAllGrades ?? false,
      grades: c.grades ?? [],
      curriculum: c.curriculum ?? '',
      maxStudents: c.maxStudents ?? 0,
      activeEnrollmentCount: c.activeEnrollmentCount ?? 0,
    }));
  }

  /**
   * Removes the teachable course at the given zero-based index from the
   * authenticated adult user's `teachableCourses` array.
   *
   * - Throws `NotFoundException` if the user is not found or deleted.
   * - Throws `ForbiddenException` if the user is not an adult.
   * - Throws `BadRequestException` if `index` is negative, non-integer, or ≥
   *   `teachableCourses.length`.
   * - When active enrollments exist for the course, records one
   *   `NotificationEvent` per affected parent before removing.
   * - Returns the updated `teachableCourses` array with `activeEnrollmentCount`
   *   set to 0 for all remaining courses (full computation deferred to Task 5).
   */
  async removeTeachableCourse(
    cognitoSub: string,
    index: number,
  ): Promise<TeachableCourseResponseItem[]> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    if (
      row.accountType !== AccountType.Adult ||
      row.ageBandAtRegistration !== AgeBandAtRegistration.Adult18Plus
    ) {
      throw new ForbiddenException(
        'Only adult users may manage teachable courses',
      );
    }

    // Validate index
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('Index must be a non-negative integer');
    }

    const courses = (row.teachableCourses ?? []) as Array<{
      _id?: Types.ObjectId;
      className?: string;
      subjectId?: Types.ObjectId;
      matchesAllGrades?: boolean;
      grades?: string[];
      curriculum?: string;
      maxStudents?: number;
    }>;

    if (index >= courses.length) {
      throw new BadRequestException('Index out of range');
    }

    const courseToRemove = courses[index];
    const courseId = courseToRemove._id;

    // Detect active enrollments: check each linked student's addedClasses
    const linkedStudentIds = row.linkedStudents ?? [];
    const newNotificationEvents: {
      type: 'COURSE_REMOVED';
      recipientUserId: string;
      payload: unknown;
      createdAt: Date;
    }[] = [];

    if (courseId) {
      for (const studentId of linkedStudentIds) {
        const student = await this.usersService.findOneById(studentId);
        if (!student || student.deleted) {
          continue;
        }

        const addedClasses = (student.addedClasses ?? []) as Array<{
          adult?: Types.ObjectId;
          course?: Types.ObjectId | { _id?: Types.ObjectId };
        }>;

        const hasEnrollment = addedClasses.some((cls) => {
          // Check adult matches
          const adultMatches =
            cls.adult && row._id && cls.adult.equals(row._id);
          if (!adultMatches) {
            return false;
          }

          // Check course matches — course may be an ObjectId or a populated object
          const courseRef = cls.course;
          if (!courseRef) {
            return false;
          }

          if (courseRef instanceof Types.ObjectId) {
            return courseRef.equals(courseId);
          }

          // Populated object with _id
          const refId = (courseRef as { _id?: Types.ObjectId })._id;
          return refId ? refId.equals(courseId) : false;
        });

        if (hasEnrollment) {
          // Find the parent of this student to notify
          const parentId = student.parentId;
          if (parentId) {
            newNotificationEvents.push({
              type: 'COURSE_REMOVED',
              recipientUserId: parentId.toString(),
              payload: {
                adultUserId: row._id.toString(),
                courseClassName: courseToRemove.className ?? '',
                courseSubjectId: courseToRemove.subjectId
                  ? courseToRemove.subjectId.toString()
                  : '',
              },
              createdAt: new Date(),
            });
          }
        }
      }
    }

    // Build the new courses array without the element at index
    const newCourses = courses.filter((_, i) => i !== index);

    // Build the $set update
    const setPayload: Record<string, unknown> = {
      teachableCourses: newCourses,
    };

    if (newNotificationEvents.length > 0) {
      const existingEvents = row.notificationEvents ?? [];
      setPayload['notificationEvents'] = [
        ...existingEvents,
        ...newNotificationEvents,
      ];
    }

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      $set: setPayload,
    });

    if (!updated) {
      throw new InternalServerErrorException(
        'Failed to remove teachable course',
      );
    }

    const updatedCourses = (updated.teachableCourses ?? []) as Array<{
      className?: string;
      subjectId?: Types.ObjectId;
      matchesAllGrades?: boolean;
      grades?: string[];
      curriculum?: string;
      maxStudents?: number;
      activeEnrollmentCount?: number;
    }>;

    return updatedCourses.map((c) => ({
      className: c.className ?? '',
      subjectId: c.subjectId ? c.subjectId.toString() : '',
      matchesAllGrades: c.matchesAllGrades ?? false,
      grades: c.grades ?? [],
      curriculum: c.curriculum ?? '',
      maxStudents: c.maxStudents ?? 0,
      activeEnrollmentCount: c.activeEnrollmentCount ?? 0,
    }));
  }

  private resolveAgeBandFromAccountSetup(
    dto: AccountSetupDto,
  ): AgeBandAtRegistration {
    const path = dto.onboardingExpectedBand;

    if (dto.accountType === AccountType.Adult) {
      if (path !== OnboardingExpectedBand.Adult) {
        throw new BadRequestException(
          'Adult accounts must use the adult onboarding confirmation path',
        );
      }

      if (!dto.adultAgeConfirmed || !dto.adultGuardianDutyConfirmed) {
        throw new BadRequestException(
          'Confirm your age and guardian responsibilities to continue',
        );
      }

      return AgeBandAtRegistration.Adult18Plus;
    }

    if (path === OnboardingExpectedBand.Teen13to17) {
      if (!dto.teenAgeConfirmed || !dto.teenPermissionConfirmed) {
        throw new BadRequestException(
          'Confirm your age and guardian permission to continue',
        );
      }

      return AgeBandAtRegistration.Teen13To17;
    }

    if (path === OnboardingExpectedBand.Under13) {
      if (
        !dto.under13ChildConfirmed ||
        !dto.under13GuardianPermissionConfirmed
      ) {
        throw new BadRequestException(
          'Confirm guardian permission for this account',
        );
      }

      return AgeBandAtRegistration.ChildUnder13Managed;
    }

    throw new BadRequestException('Invalid onboarding path');
  }

  /**
   * Records first in-app login (welcome completion). Idempotent if already set.
   */
  async recordFirstLoginAt(
    cognitoSub: string,
  ): Promise<{ firstLoggedInAt: string }> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    const user: UserDoc = row;

    const existing = mongoDateOrNull(Reflect.get(user, 'firstLoggedInAt'));
    if (existing) {
      return {
        firstLoggedInAt: firstLoggedInAtToIso(existing)!,
      };
    }

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      firstLoggedInAt: new Date(),
    });

    if (!updated) {
      throw new InternalServerErrorException('Failed to record first login');
    }

    const ts = mongoDateOrNull(Reflect.get(updated, 'firstLoggedInAt'));
    if (!ts) {
      throw new InternalServerErrorException('Failed to record first login');
    }

    return { firstLoggedInAt: firstLoggedInAtToIso(ts)! };
  }

  async updateAccount(accessToken: string, dto: UpdateAccountDto) {
    const attributes: { Name: string; Value: string }[] = [];
    if (dto.email !== undefined)
      attributes.push({ Name: 'email', Value: dto.email });

    if (dto.given_name !== undefined)
      attributes.push({ Name: 'given_name', Value: dto.given_name });

    if (dto.family_name !== undefined)
      attributes.push({ Name: 'family_name', Value: dto.family_name });

    if (dto.middle_name !== undefined)
      attributes.push({ Name: 'middle_name', Value: dto.middle_name });

    if (dto.phone_number !== undefined)
      attributes.push({ Name: 'phone_number', Value: dto.phone_number });

    if (attributes.length === 0) return;

    const response = await this.cognitoService.updateUserAttributes(
      accessToken,
      attributes,
    );
    if (!response) {
      throw new InternalServerErrorException(
        'Failed to update user attributes',
      );
    }

    return response;
  }

  async setMfaPreference(accessToken: string, dto: MfaPreferenceDto) {
    const response = await this.cognitoService.setUserMFAPreferenceWithSettings(
      accessToken,
      {
        softwareTokenMfaEnabled: dto.softwareTokenMfaEnabled,
        softwareTokenPreferred: dto.preferredMfa === 'softwareToken',
      },
    );

    if (!response) {
      throw new InternalServerErrorException('Failed to set MFA preference');
    }

    return response;
  }

  async changePassword(
    accessToken: string,
    cognitoSub: string,
    dto: ChangePasswordDto,
  ) {
    const cognitoResponse = await this.cognitoService.changePassword(
      accessToken,
      dto.currentPassword,
      dto.newPassword,
    );

    const userResponse = await this.usersService.updateByCognitoSub(
      cognitoSub,
      {
        hasPassword: true,
      },
    );

    return {
      cognitoResponse,
      userResponse,
    };
  }

  /**
   * Sets an initial password for users who authenticated via OAuth and have no password.
   */
  async createPassword(
    accessToken: string,
    cognitoSub: string,
    dto: CreatePasswordDto,
  ) {
    const user = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!user || user.deleted) {
      throw new NotFoundException('User not found');
    }

    if (user.hasPassword) {
      throw new BadRequestException(
        'Account already has a password. Use change password instead.',
      );
    }

    const cognitoUser = await this.cognitoService.getUser(accessToken);
    const username = cognitoUser?.UserAttributes?.find(
      (a) => a.Name === 'email' || a.Name === 'preferred_username',
    )?.Value;
    if (!username) {
      throw new BadRequestException('Could not resolve account username.');
    }

    await this.cognitoService.adminSetUserPassword(username, dto.newPassword);

    const userResponse = await this.usersService.updateByCognitoSub(
      cognitoSub,
      { hasPassword: true },
    );

    return { userResponse };
  }

  async linkGoogle(
    accessToken: string,
    cognitoSub: string,
    credential: string,
  ) {
    const { email: googleEmail, sub: googleSub } =
      await this.googleService.verifyCredential(credential);
    const cognitoUser = await this.cognitoService.getUser(accessToken);
    const cognitoEmail = cognitoUser?.UserAttributes?.find(
      (a) => a.Name === 'email' || a.Name === 'preferred_username',
    )?.Value;
    if (cognitoEmail && cognitoEmail !== googleEmail) {
      throw new BadRequestException(
        'Google account email must match your account email.',
      );
    }

    const cognitoResponse = await this.cognitoService.adminLinkProviderForUser(
      cognitoSub,
      googleSub,
      'Google',
    );
    const userResponse = await this.usersService.addLinkGoogle(
      cognitoSub,
      googleSub,
    );

    return {
      cognitoResponse,
      userResponse,
    };
  }

  async unlinkGoogle(accessToken: string, cognitoSub: string) {
    const user = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.linkedProviders?.includes('GOOGLE')) {
      throw new BadRequestException('Google account is not linked');
    }

    if (!user.hasPassword) {
      throw new BadRequestException(
        'You must create a password before you can disconnect your Google account.',
      );
    }

    const googleSub = user.linkedProviderSubjects?.GOOGLE;
    if (!googleSub) {
      throw new BadRequestException(
        'Unable to unlink Google (missing provider subject).',
      );
    }

    const cognitoResponse =
      await this.cognitoService.adminDisableProviderForUser(
        'Google',
        googleSub,
      );
    const userResponse = await this.usersService.removeLinkGoogle(cognitoSub);
    if (!cognitoResponse || !userResponse) {
      throw new InternalServerErrorException('Failed to unlink Google account');
    }

    return {
      cognitoResponse,
      userResponse,
    };
  }

  async deleteMe(accessToken: string, dto: DeleteMeDto) {
    const payload = await this.cognitoService.getUser(accessToken);
    const username = payload?.UserAttributes?.find(
      (a) => a.Name === 'email' || a.Name === 'preferred_username',
    )?.Value;
    const cognitoSub = payload?.UserAttributes?.find(
      (a) => a.Name === 'sub',
    )?.Value;

    if (!username || !cognitoSub) {
      throw new UnauthorizedException('Invalid session');
    }

    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    const hasPassword = row.hasPassword ?? true;

    if (!hasPassword) {
      const cred = dto.googleCredential?.trim();
      if (!cred) {
        throw new BadRequestException(
          'Sign in with Google to confirm deleting your account.',
        );
      }

      if (!row.linkedProviders?.includes('GOOGLE')) {
        throw new BadRequestException(
          'Your account cannot be verified for deletion. Contact support.',
        );
      }

      const { email: googleEmail, sub: googleSub } =
        await this.googleService.verifyCredential(cred);
      const linkedGoogleSub = row.linkedProviderSubjects?.GOOGLE;
      if (linkedGoogleSub && linkedGoogleSub !== googleSub) {
        throw new BadRequestException(
          'That Google account is not linked to this profile.',
        );
      }

      if (username !== googleEmail) {
        throw new BadRequestException(
          'Google account email must match your account email.',
        );
      }
    } else {
      const password = dto.password?.trim();
      if (!password || password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters');
      }

      const authResponse = await this.cognitoService.authenticateWithSrp(
        username,
        password,
      );
      const srpAuthenticated = Boolean(authResponse?.AuthenticationResult);
      if (
        !srpAuthenticated &&
        authResponse?.ChallengeName === 'SOFTWARE_TOKEN_MFA'
      ) {
        const session = authResponse.Session;
        if (!session) {
          throw new InternalServerErrorException(
            'Could not complete account verification.',
          );
        }

        const code = dto.mfaCode?.trim();
        if (!code) {
          throw new BadRequestException(
            'Enter the code from your authenticator app to delete your account.',
          );
        }

        const mfaResponse =
          await this.cognitoService.respondToSoftwareTokenMFAChallenge(
            username,
            code,
            session,
          );
        if (!mfaResponse?.AuthenticationResult) {
          throw new UnauthorizedException(
            'Invalid authenticator code or password.',
          );
        }
      } else if (
        !srpAuthenticated &&
        authResponse?.ChallengeName === 'SMS_MFA'
      ) {
        throw new BadRequestException(
          'Account deletion is not supported with SMS two-factor authentication. Use an authenticator app or contact support.',
        );
      } else if (!srpAuthenticated) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    const cognitoResponse = await this.cognitoService.deleteUser(accessToken);
    if (!cognitoResponse) {
      throw new InternalServerErrorException('Failed to delete user');
    }

    const userResponse: { deleted: boolean; result: number } | null = null;

    const sub = payload?.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
    if (sub) {
      const deleteResult = await this.usersService.updateByCognitoSub(sub, {
        deleted: true,
      });
      if (!deleteResult) {
        throw new InternalServerErrorException('Failed to delete user');
      }
    }

    return {
      cognitoResponse,
      userResponse,
    };
  }

  async getKnownDevices(accessToken: string): Promise<
    {
      DeviceKey?: string;
      DeviceName?: string;
      DeviceLastIPUsed?: string;
      DeviceCreateDate?: Date;
      DeviceLastAuthenticatedDate?: Date;
      DeviceLastModifiedDate?: Date;
      City?: string;
      Region?: string;
      Country?: string;
    }[]
  > {
    const response = await this.cognitoService.listDevices(accessToken);
    const devices = response.Devices ?? [];
    const maxmindKey = this.configService.getOrThrow(MAXMIND_KEY, {
      infer: true,
    });
    const deviceData = await Promise.all(
      devices.map(async (device) => {
        const lastIPUsed = device.DeviceAttributes?.find(
          (a) => a.Name === 'last_ip_used',
        )?.Value;

        let city: string | undefined;
        let region: string | undefined;
        let country: string | undefined;
        if (lastIPUsed && maxmindKey) {
          try {
            const location = await this.maxmindService.getLocation(lastIPUsed);
            city = location.city?.names?.en;
            region = location.subdivisions?.[0]?.names?.en;
            country = location.country?.names?.en;
          } catch (error) {
            console.error('Error getting location from Maxmind', error);
          }
        }

        const DeviceName = device.DeviceAttributes?.find(
          (a) => a.Name === 'device_name',
        )?.Value;
        return {
          DeviceKey: device.DeviceKey,
          DeviceName,
          DeviceLastIPUsed: lastIPUsed,
          DeviceCreateDate: device.DeviceCreateDate,
          DeviceLastAuthenticatedDate: device.DeviceLastAuthenticatedDate,
          DeviceLastModifiedDate: device.DeviceLastModifiedDate,
          City: city,
          Region: region,
          Country: country,
        };
      }),
    );

    return deviceData;
  }

  /**
   * Returns the student's `addedClasses` array for the given `studentId`.
   * Each entry includes `subjectId` as a string (or null).
   * Validates that the authenticated user owns the student draft.
   */
  async getStudentClasses(
    cognitoSub: string,
    studentId: Types.ObjectId,
  ): Promise<
    {
      subjectId: string | null;
      curriculumId: string | null;
      hoursCompleted: number;
      createdAt: string | null;
    }[]
  > {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    if (row.accountType !== AccountType.Adult) {
      throw new ForbiddenException(
        'Only household adults can view student classes',
      );
    }

    // Validate that the studentId belongs to this user's household
    const managedAccounts = row.managedAccountsView ?? [];
    const match = managedAccounts.find((managedAccount) =>
      managedAccount.studentId.equals(studentId),
    );
    if (!match) {
      throw new NotFoundException('Student draft not found');
    }

    // Find the student User document
    const studentUser = await this.usersService.findOneById(studentId);
    if (!studentUser) {
      return [];
    }

    const classes = (studentUser.addedClasses ?? []) as Array<{
      subjectId?: Types.ObjectId | null;
      curriculumId?: Types.ObjectId | null;
      hoursCompleted?: number;
      createdAt?: Date | null;
    }>;

    return classes.map((c) => ({
      subjectId: c.subjectId ? c.subjectId.toString() : null,
      curriculumId: c.curriculumId ? c.curriculumId.toString() : null,
      hoursCompleted: c.hoursCompleted ?? 0,
      createdAt: c.createdAt ? c.createdAt.toISOString() : null,
    }));
  }
}
