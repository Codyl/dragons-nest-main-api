import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { Types } from 'mongoose';
import { User } from './entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

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

  findOneByCognitoSub(sub: string) {
    return this.userModel.findOne({ cognitoSub: sub });
  }

  updateById(_id: Types.ObjectId, updateUserDto: UpdateUserDto) {
    return this.userModel.findByIdAndUpdate(_id, updateUserDto, { new: true });
  }

  removeById(_id: Types.ObjectId) {
    return this.userModel.findByIdAndDelete(_id);
  }
}
