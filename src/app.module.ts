import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CognitoModule } from './cognito.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.development.local',
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI!),
    AuthModule,
    UsersModule,
    CognitoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
