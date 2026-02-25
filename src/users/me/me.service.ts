import { Injectable } from '@nestjs/common';
import { UpdateMeDto } from './dto/update-me.dto';
import { Types } from 'mongoose';
import { User } from '../entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class MeService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getMe(_id: Types.ObjectId) {
    return this.userModel.findById(_id);
  }

  async updateMe(_id: Types.ObjectId, updateMeDto: UpdateMeDto) {
    return this.userModel.findByIdAndUpdate(_id, updateMeDto, { new: true });
  }

  async deleteMe(_id: Types.ObjectId) {
    return this.userModel.findByIdAndDelete(_id);
  }
}
