import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Subject, SubjectSchema } from './subject.entity';
import { Activity, ActivitySchema } from 'src/activities/activity.entity';
import {
  CurriculumItem,
  CurriculumItemSchema,
} from 'src/curriculum/entities/curriculum.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [SubjectsController],
  providers: [SubjectsService],
  imports: [
    MongooseModule.forFeature([
      { name: Subject.name, schema: SubjectSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: CurriculumItem.name, schema: CurriculumItemSchema },
    ]),
    UsersModule,
  ],
})
export class SubjectsModule {}
