import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';
import {
  CurriculumItem,
  CurriculumItemSchema,
} from './entities/curriculum.entity';
import { Subject, SubjectSchema } from 'src/subjects/subject.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CurriculumItem.name, schema: CurriculumItemSchema },
      { name: Subject.name, schema: SubjectSchema },
    ]),
    UsersModule,
  ],
  controllers: [CurriculumController],
  providers: [CurriculumService],
})
export class CurriculumModule {}
