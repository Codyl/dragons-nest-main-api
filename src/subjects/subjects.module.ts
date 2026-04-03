import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Subject, SubjectSchema } from './subject.entity';

@Module({
  controllers: [SubjectsController],
  providers: [SubjectsService],
  imports: [
    MongooseModule.forFeature([{ name: Subject.name, schema: SubjectSchema }]),
  ],
})
export class SubjectsModule {}
