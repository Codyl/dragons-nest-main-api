import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ResourcesService, PaginatedResources } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UsersService } from 'src/users/users.service';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('resources')
@UseGuards(AuthGuard)
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async findAll(
    @Query('subjectId') subjectId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: Record<string, unknown> & { sub?: string },
  ): Promise<{
    message: string;
    data: PaginatedResources['data'];
    pagination: PaginatedResources['pagination'];
  }> {
    if (!subjectId || !Types.ObjectId.isValid(subjectId)) {
      throw new BadRequestException(
        'subjectId must be a valid MongoDB ObjectId',
      );
    }

    const userRes = await this.usersService.findOneByCognitoSub(
      user?.sub || '',
    );

    const result = await this.resourcesService.findPaginated(
      new Types.ObjectId(subjectId),
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search || undefined,
      userRes?._id.toString(),
    );

    return {
      message: 'Resources retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('/me')
  async get(
    @Query('subjectId', MongoIdPipe) subjectId: Types.ObjectId,
    @CurrentUser() user?: Record<string, unknown> & { sub?: string },
  ) {
    const userRes = await this.usersService.findOneByCognitoSub(
      user?.sub || '',
    );
    if (!userRes) {
      throw new InternalServerErrorException('');
    }

    const results = await this.resourcesService.get({
      subjectId,
      createdBy: userRes?._id,
    });

    return { data: results, message: 'Retrieved resources added by me.' };
  }

  @Post()
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateResourceDto,
  ) {
    const matchingUser = await this.usersService.findOneByCognitoSub(user.sub);
    const data = await this.resourcesService.create(dto, matchingUser!._id);
    return { message: 'Resource created', data };
  }
}
