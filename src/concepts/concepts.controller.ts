import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ConceptsService } from './concepts.service';

@Controller('concepts')
export class ConceptsController {
  constructor(private readonly conceptsService: ConceptsService) {}

  @Get()
  async findBySubject(
    @Query('subjectId') subjectId: string,
    @Query('grade') grade?: string,
  ) {
    if (!subjectId || !Types.ObjectId.isValid(subjectId)) {
      throw new BadRequestException(
        'subjectId must be a valid MongoDB ObjectId',
      );
    }

    const data = await this.conceptsService.findBySubject(subjectId, grade);
    return { message: 'Concepts retrieved', data };
  }
}
