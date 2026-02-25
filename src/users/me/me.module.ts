import { Module } from '@nestjs/common';
import { MeService } from './me.service';
import { MeController } from './me.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../entities/user.entity';

@Module({
  controllers: [MeController],
  providers: [MeService],
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
})
export class MeModule {}
