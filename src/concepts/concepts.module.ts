import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Concept, ConceptSchema } from './entities/concept.entity';
import { ConceptsController } from './concepts.controller';
import { ConceptsService } from './concepts.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Concept.name, schema: ConceptSchema }]),
    UsersModule,
  ],
  controllers: [ConceptsController],
  providers: [ConceptsService],
  exports: [MongooseModule],
})
export class ConceptsModule {}
