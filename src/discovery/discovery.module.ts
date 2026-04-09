import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/users/entities/user.schema';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, AuthGuard],
})
export class DiscoveryModule {}
