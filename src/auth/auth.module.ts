import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleModule } from './google/google.module';

@Module({
  providers: [AuthService],
  controllers: [AuthController],
  imports: [GoogleModule],
})
export class AuthModule {}
