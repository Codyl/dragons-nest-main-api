import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { Types } from 'mongoose';
import { User } from './entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, Model } from 'mongoose';

/** Plain user document shape for return types; avoids Mongoose Document in callers/tests. */
export interface UserDoc {
  _id: Types.ObjectId;
  cognitoSub: string;
  linkedProviders?: string[];
  linkedProviderSubjects?: { GOOGLE?: string };
  hasPassword?: boolean;
  email?: string;
  deleted?: boolean;
  first_logged_in_at?: Date | null;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  createUser(sub: string, hasPassword: boolean) {
    return this.userModel.create({ cognitoSub: sub, hasPassword });
  }

  findAll() {
    return this.userModel.find();
  }

  findOneById(_id: Types.ObjectId) {
    return this.userModel.findById(_id);
  }

  async findOneByCognitoSub(sub: string): Promise<UserDoc | null> {
    const doc = await this.userModel.findOne({ cognitoSub: sub }).lean();
    return doc as UserDoc | null;
  }

  updateByCognitoSub(cognitoSub: string, update: Partial<User>) {
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
      { upsert: true, new: true },
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
      first_logged_in_at: new Date(),
    });
  }
}
