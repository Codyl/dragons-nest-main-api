import { Controller, Get, Param } from '@nestjs/common';
import type { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { UsersService } from './users.service';
import type { UserResponseDto } from './dto/out/user-response.dto';
import { Types } from 'mongoose';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
} from '@nestjs/swagger';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Gets all users in the database',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database or server failure while listing users.',
  })
  @Get()
  async findAll(): Promise<ApiResponseDto<UserResponseDto[]>> {
    const users = await this.usersService.findAll();
    const data = users.map((doc) => ({
      _id: doc._id,
      cognitoSub: doc.cognitoSub,
      linkedProviders: doc.linkedProviders,
      linkedProviderSubjects: doc.linkedProviderSubjects,
      hasPassword: doc.hasPassword,
      email: doc.email ?? null,
    })) as UserResponseDto[];
    return {
      message: 'Users retrieved successfully',
      data,
    };
  }

  @ApiOperation({
    summary: 'Gets a user by their ID',
  })
  @ApiBadRequestResponse({
    description: 'Provided id is not a valid Mongo ObjectId.',
  })
  @ApiNotFoundResponse({
    description: 'No user exists for the provided id.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database or server failure while loading user.',
  })
  @Get(':id')
  async findOne(
    @Param('id', MongoIdPipe) id: Types.ObjectId,
  ): Promise<ApiResponseDto<UserResponseDto | null>> {
    const user = await this.usersService.findOneById(id);
    const data: UserResponseDto | null = user
      ? {
          _id: user._id,
          cognitoSub: user.cognitoSub,
          linkedProviders: user.linkedProviders,
          linkedProviderSubjects: user.linkedProviderSubjects,
          hasPassword: user.hasPassword,
          email: user.email ?? null,
        }
      : null;
    return {
      message: data ? 'User retrieved successfully' : 'User not found',
      data,
    };
  }
}
