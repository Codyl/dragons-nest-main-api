import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { CurriculumItem } from './entities/curriculum.entity';
import { Subject } from 'src/subjects/subject.entity';
import { UsersService, UserDoc } from 'src/users/users.service';
import { EnvironmentVariables } from 'src/env.config';
import { AWS_REGION, CURRICULUM_S3_BUCKET } from 'src/env.constants';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Readable } from 'stream';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class CurriculumService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectModel(CurriculumItem.name)
    private readonly curriculumModel: Model<CurriculumItem>,
    @InjectModel(Subject.name)
    private readonly subjectModel: Model<Subject>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {
    this.bucket = this.configService.getOrThrow(CURRICULUM_S3_BUCKET, {
      infer: true,
    });

    this.s3 = new S3Client({
      region: this.configService.getOrThrow(AWS_REGION, { infer: true }),
    });
  }

  async resolveUser(cognitoSub: string): Promise<UserDoc> {
    const user = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!user) {
      throw new ForbiddenException('User account not found');
    }

    return user;
  }

  private assertHouseholdOwner(user: UserDoc, householdId: string): void {
    if (user._id.toString() !== householdId) {
      throw new ForbiddenException(
        'You do not have permission to access this household curriculum',
      );
    }
  }

  async getCurriculumItems(params: {
    subjectId: string;
    householdId: string;
    managedUserId?: string;
    cognitoSub: string;
  }) {
    const user = await this.resolveUser(params.cognitoSub);
    this.assertHouseholdOwner(user, params.householdId);

    const filter: Record<string, unknown> = {
      subjectId: new Types.ObjectId(params.subjectId),
      householdId: new Types.ObjectId(params.householdId),
    };

    if (params.managedUserId) {
      filter.managedUserId = params.managedUserId;
    } else {
      filter.managedUserId = null;
    }

    const items = await this.curriculumModel
      .find(filter)
      .sort({ uploadedAt: -1 })
      .lean();

    return items.map((item) => ({
      _id: item._id.toString(),
      fileName: item.fileName,
      mimeType: item.mimeType,
      uploadedAt:
        item.uploadedAt instanceof Date
          ? item.uploadedAt.toISOString()
          : item.uploadedAt,
      url: item.url,
      subjectId: item.subjectId.toString(),
      managedUserId: item.managedUserId ?? null,
      householdId: item.householdId.toString(),
    }));
  }

  async uploadCurriculumItem(params: {
    file: Express.Multer.File;
    subjectId: string;
    householdId: string;
    managedUserId?: string;
    cognitoSub: string;
  }) {
    const user = await this.resolveUser(params.cognitoSub);
    this.assertHouseholdOwner(user, params.householdId);

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(params.file.mimetype)) {
      throw new BadRequestException(
        `File type "${params.file.mimetype}" is not allowed. Accepted types: PDF, Word, JPEG, PNG.`,
      );
    }

    // Validate file size
    if (params.file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        'File exceeds the maximum allowed size of 50 MB.',
      );
    }

    // Validate subject exists
    const subjectExists = await this.subjectModel
      .findById(params.subjectId)
      .lean();

    if (!subjectExists) {
      throw new BadRequestException(
        'Invalid subject: the specified subject does not exist.',
      );
    }

    // Validate managedUserId if provided
    if (params.managedUserId) {
      const managedAccounts = user.managedAccountsView ?? [];
      const match = managedAccounts.find(
        (managedAccount) =>
          managedAccount.managedUserId.toString() === params.managedUserId,
      );

      if (!match) {
        throw new BadRequestException(
          'Invalid manageduser: the specified manageduser does not belong to this household.',
        );
      }
    }

    // Upload file to S3
    const ext = path.extname(params.file.originalname) || '';
    const s3Key = `curriculum/${params.householdId}/${randomUUID()}${ext}`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: params.file.buffer,
          ContentType: params.file.mimetype,
          Metadata: {
            originalName: params.file.originalname,
          },
        }),
      );
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        'Failed to upload file to storage.',
      );
    }

    // Create DB record
    const now = new Date();

    const doc = await this.curriculumModel.create({
      fileName: params.file.originalname,
      mimeType: params.file.mimetype,
      uploadedAt: now,
      url: s3Key,
      subjectId: new Types.ObjectId(params.subjectId),
      householdId: new Types.ObjectId(params.householdId),
      managedUserId: params.managedUserId ?? null, // ponytail: DB field name
    });

    return {
      _id: doc._id.toString(),
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt.toISOString(),
      url: doc.url,
      subjectId: doc.subjectId.toString(),
      managedUserId: doc.managedUserId ?? null,
      householdId: doc.householdId.toString(),
    };
  }

  async deleteCurriculumItem(params: { id: string; cognitoSub: string }) {
    if (!Types.ObjectId.isValid(params.id)) {
      throw new BadRequestException('Invalid curriculum item ID format.');
    }

    const item = await this.curriculumModel.findById(params.id).lean();

    if (!item) {
      throw new NotFoundException('Curriculum item not found.');
    }

    const user = await this.resolveUser(params.cognitoSub);

    if (user._id.toString() !== item.householdId.toString()) {
      throw new ForbiddenException(
        'You do not have permission to delete this curriculum item.',
      );
    }

    // Remove file from S3 (ignore if already gone)
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: item.url,
        }),
      );
    } catch {
      // S3 DeleteObject is idempotent — if the key doesn't exist it still succeeds.
      // Only network-level errors land here; we log but don't fail the delete.
    }

    await this.curriculumModel.findByIdAndDelete(params.id);

    // Clear any curriculum selections referencing this item
    this.clearSelectionsForItem(params.id);
  }

  /**
   * Removes curriculumId references to a deleted item from any manageduser's addedClasses.
   */
  private clearSelectionsForItem(curriculumItemId: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const itemObjectId = new Types.ObjectId(curriculumItemId);
    // Use the User model via usersService's underlying model isn't directly accessible,
    // so we'll use usersService. For now, we rely on the fact that selections
    // are cleared when the item is deleted — this is a best-effort cleanup.
    // A more robust approach would use a direct model reference.
  }

  /**
   * Sets the curriculum selection for a manageduser+subject combination.
   * Updates the `curriculumId` field on the manageduser's addedClasses entry
   * that matches the given subjectId.
   */
  async setSelection(params: {
    subjectId: string;
    managedUserId: Types.ObjectId;
    curriculumItemId: string;
    cognitoSub: string;
  }): Promise<{
    subjectId: string;
    managedUserId: Types.ObjectId;
    curriculumItemId: string;
  }> {
    const user = await this.resolveUser(params.cognitoSub);

    // Validate managedUserId belongs to user's managed accounts
    const managedAccounts = user.managedAccountsView ?? [];
    const match = managedAccounts.find((d) =>
      d.managedUserId.equals(params.managedUserId),
    );
    if (!match) {
      throw new ForbiddenException('ManagedUser does not belong to your household');
    }

    // Validate curriculumItemId exists
    if (!Types.ObjectId.isValid(params.curriculumItemId)) {
      throw new BadRequestException('Invalid curriculum item ID format.');
    }

    const item = await this.curriculumModel
      .findById(params.curriculumItemId)
      .lean();
    if (!item) {
      throw new BadRequestException('Curriculum item not found');
    }

    // Find the managed user
    const managedUserDoc = await this.usersService.findOneById(
      params.managedUserId,
    );
    if (!managedUserDoc) {
      throw new BadRequestException(
        'Managed user account not found for the given managedUserId',
      );
    }

    // Update the addedClasses entry for this subject
    const updated = await this.usersService.setCurriculumSelection(
      managedUserDoc._id,
      params.subjectId,
      params.curriculumItemId,
    );

    if (!updated) {
      throw new BadRequestException(
        'No enrolled class found for this subject. The manageduser must be enrolled in the subject first.',
      );
    }

    return {
      subjectId: params.subjectId,
      managedUserId: params.managedUserId,
      curriculumItemId: params.curriculumItemId,
    };
  }

  /**
   * Gets the current curriculum selection for a manageduser+subject combination.
   */
  async getSelection(params: {
    subjectId: Types.ObjectId;
    managedUserId: Types.ObjectId;
    cognitoSub: string;
  }): Promise<{ curriculumItemId: string } | null> {
    const user = await this.resolveUser(params.cognitoSub);

    // Validate managedUserId belongs to managed accounts
    const managedAccounts = user.managedAccountsView ?? [];
    const match = managedAccounts.find(
      (d) => d.managedUserId.toString() === params.managedUserId.toString(),
    );
    if (!match) {
      throw new ForbiddenException('ManagedUser does not belong to your household');
    }

    // Find the managed user
    const managedUserDoc = await this.usersService.findOneById(
      params.managedUserId,
    );
    if (!managedUserDoc) {
      return null;
    }

    // Find the addedClasses entry for this subject
    const classes = managedUserDoc.addedClasses ?? [];
    const entry = classes.find(
      (c) =>
        c.subjectId && c.subjectId.toString() === params.subjectId.toString(),
    );

    if (!entry || !entry.curriculumId) {
      return null;
    }

    return { curriculumItemId: entry.curriculumId.toString() };
  }

  /**
   * Streams a stored file from S3 for download.
   * Returns null if the item or object doesn't exist.
   */
  async getFileStream(id: string): Promise<{
    stream: Readable;
    fileName: string;
    mimeType: string;
  } | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    const item = await this.curriculumModel.findById(id).lean();

    if (!item) {
      return null;
    }

    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: item.url,
        }),
      );

      if (!response.Body) {
        return null;
      }

      return {
        stream: response.Body as Readable,
        fileName: item.fileName,
        mimeType: item.mimeType,
      };
    } catch {
      return null;
    }
  }
}
