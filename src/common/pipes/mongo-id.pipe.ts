import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class MongoIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    if (!value || !Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid resource ID');
    }

    return new Types.ObjectId(value);
  }
}
