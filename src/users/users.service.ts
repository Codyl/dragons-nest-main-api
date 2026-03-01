import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { Types } from 'mongoose';
import { User } from './entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/** Plain user document shape for return types; avoids Mongoose Document in callers/tests. */
export interface UserDoc {
  _id: Types.ObjectId;
  cognitoSub: string;
  linkedProviders?: string[];
  linkedProviderSubjects?: { GOOGLE?: string };
  hasPassword?: boolean;
  email?: string;
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

  findOneByCognitoSub(sub: string): Promise<UserDoc | null> {
    return this.userModel.findOne({ cognitoSub: sub }).lean();
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
}
