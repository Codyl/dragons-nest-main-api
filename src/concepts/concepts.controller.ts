import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { ConceptsService } from './concepts.service';
import { CreateConceptDto } from './dto/create-concept.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UsersService } from 'src/users/users.service';

@Controller('concepts')
export class ConceptsController {
  constructor(
    private readonly conceptsService: ConceptsService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(OptionalAuthGuard)
  @Get()
  async findBySubject(
    @Query('subjectId') subjectId: string,
    @Query('grade') grade?: string,
    @CurrentUser() user?: Record<string, unknown> & { sub?: string },
  ) {
    if (!subjectId || !Types.ObjectId.isValid(subjectId)) {
      throw new BadRequestException(
        'subjectId must be a valid MongoDB ObjectId',
      );
    }

    let userId: string | undefined;
    if (user?.sub) {
      const userRes = await this.usersService.findOneByCognitoSub(user.sub);
      userId = userRes?._id?.toString();
    }

    const data = await this.conceptsService.findBySubject(
      subjectId,
      grade,
      userId,
    );
    return { message: 'Concepts retrieved', data };
  }

  @ApiCookieAuth('ACCESS_TOKEN')
  @UseGuards(AuthGuard)
  @Post()
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateConceptDto,
  ) {
    const matchingUser = await this.usersService.findOneByCognitoSub(user.sub);
    if (!matchingUser) {
      throw new BadRequestException('User not found');
    }
    const data = await this.conceptsService.create(dto, matchingUser._id);
    return { message: 'Concept created', data };
  }
}
