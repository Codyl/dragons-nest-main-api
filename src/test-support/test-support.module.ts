import { Module } from '@nestjs/common';

import { CognitoModule } from 'src/cognito/cognito.module';
import { UsersModule } from 'src/users/users.module';

import { TestUsersController } from './test-users.controller';
import { TestUsersService } from './test-users.service';

@Module({
  imports: [CognitoModule, UsersModule],
  controllers: [TestUsersController],
  providers: [TestUsersService],
})
export class TestSupportModule {}
