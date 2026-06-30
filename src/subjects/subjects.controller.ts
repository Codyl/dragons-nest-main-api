import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { Types } from 'mongoose';
import { UsersService } from 'src/users/users.service';

@Controller('subjects')
export class SubjectsController {
  constructor(
    private readonly subjectsService: SubjectsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async searchSubjects() {
    return this.subjectsService.getSubjects();
  }

  @Get(':id/summary')
  @UseGuards(AuthGuard)
  async getSummary(
    @Param('id', MongoIdPipe) id: Types.ObjectId,
    @Query('studentId', MongoIdPipe) studentId: Types.ObjectId,
  ) {
    if (!studentId) {
      throw new BadRequestException('studentId query parameter is required');
    }

    const data = await this.subjectsService.getSummary(id, studentId);
    return { message: 'Subject summary retrieved successfully', data };
  }

  @Get(':id/concepts')
  @UseGuards(AuthGuard)
  async getConcepts(
    @Param('id', MongoIdPipe) id: Types.ObjectId,
    @Query('studentId', MongoIdPipe) studentId: Types.ObjectId,
    @Query('limit') limitParam?: string,
  ) {
    if (!studentId) {
      throw new BadRequestException('studentId query parameter is required');
    }

    const limit = limitParam ? parseInt(limitParam, 10) || 50 : 50;
    const data = await this.subjectsService.getConcepts(id, studentId, limit);
    return { message: 'Subject concepts retrieved successfully', data };
  }

  @Get(':id/stats')
  @UseGuards(AuthGuard)
  async getStats(
    @Param('id', MongoIdPipe) id: Types.ObjectId,
    @Query('studentId') studentId: string,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ) {
    if (!studentId) {
      throw new BadRequestException('studentId query parameter is required');
    }

    const cognitoSub = user?.sub;
    if (!cognitoSub) {
      throw new BadRequestException('Not authenticated');
    }

    const userDoc = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!userDoc) {
      throw new ForbiddenException('User account not found');
    }

    const data = await this.subjectsService.getStats(
      id,
      studentId,
      userDoc._id.toString(),
    );
    return { message: 'Subject stats retrieved successfully', data };
  }
}
