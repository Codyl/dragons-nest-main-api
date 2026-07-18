import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UsersService } from 'src/users/users.service';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly userService: UsersService,
  ) {}

  @Get()
  async findAll(
    @Query('subjectId') subjectId: string | undefined,
    @Query('managedUserId') managedUserId: string,
  ) {
    // ponytail: subjectId optional — when omitted, return all activities for managed user
    const data = subjectId
      ? await this.activitiesService.findBySubjectAndManagedUser(
          subjectId,
          managedUserId,
        )
      : await this.activitiesService.findByManagedUser(managedUserId);
    return { message: 'Activities retrieved', data };
  }

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateActivityDto,
  ) {
    const matchingUser = await this.userService.findOneByCognitoSub(user.sub);
    const data = await this.activitiesService.create(
      dto,
      matchingUser?._id.toString() || '',
    );
    return { message: 'Activity created', data };
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(
    @CurrentUser() user: { sub: string },
    @Param('id', MongoIdPipe) id: Types.ObjectId,
  ) {
    const matchingUser = await this.userService.findOneByCognitoSub(user.sub);
    if (!matchingUser) {
      throw new InternalServerErrorException('');
    }

    await this.activitiesService.delete(
      id.toHexString(),
      matchingUser._id.toString(),
    );
    return { message: 'Activity deleted', data: {} };
  }
}
