import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Resource, ResourceSchema } from './resource.entity';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { FavoritesModule } from 'src/favorites/favorites.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Resource.name, schema: ResourceSchema }]),
    FavoritesModule,
    UsersModule,
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [MongooseModule],
})
export class ResourcesModule {}
