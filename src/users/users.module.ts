import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MeModule } from './me/me.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [MeModule],
})
export class UsersModule {}
