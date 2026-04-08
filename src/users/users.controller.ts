import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

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
      cognitoSub: doc.cognitoSub ?? null,
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
  @UseGuards(OptionalAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id', MongoIdPipe) id: Types.ObjectId,
    @CurrentUser() viewer: Record<string, unknown> & { sub?: string },
  ): Promise<ApiResponseDto<UserResponseDto | null>> {
    const user = await this.usersService.findOneByIdForViewer(
      typeof viewer?.sub === 'string' ? viewer.sub : undefined,
      id,
    );
    const data: UserResponseDto | null = user
      ? {
          _id: user._id,
          cognitoSub: user.cognitoSub ?? null,
          linkedProviders: user.linkedProviders,
          linkedProviderSubjects: user.linkedProviderSubjects,
          hasPassword: user.hasPassword,
          email: user.email ?? null,
          accountType: user.accountType ?? null,
          givenName: user.givenName ?? null,
          familyName: user.familyName ?? null,
          coppaConsentAt: user.coppaConsentAt ?? null,
          addedClasses: user.addedClasses,
        }
      : null;
    return {
      message: data ? 'User retrieved successfully' : 'User not found',
      data,
    };
  }
}
