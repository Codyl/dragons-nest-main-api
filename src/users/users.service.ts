import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { Types } from 'mongoose';
import { User } from './entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  findAll() {
    return `This action returns all users`;
  }

  findOne(_id: Types.ObjectId) {
    return this.userModel.findById(_id);
  }

  update(_id: Types.ObjectId, updateUserDto: UpdateUserDto) {
    return this.userModel.findByIdAndUpdate(_id, updateUserDto, { new: true });
  }

  remove(_id: Types.ObjectId) {
    return this.userModel.findByIdAndDelete(_id);
  }
}
