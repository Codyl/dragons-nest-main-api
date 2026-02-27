import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleModule } from './google/google.module';
import { CognitoModule } from 'src/cognito/cognito.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  providers: [AuthService],
  controllers: [AuthController],
  imports: [GoogleModule, CognitoModule, UsersModule],
})
export class AuthModule {}
