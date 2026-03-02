import { Controller, Get, Patch, Param, Delete, Body } from '@nestjs/common';
import type { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import type { UserResponseDto } from './dto/out/user-response.dto';
import { Types } from 'mongoose';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Patch(':id')
  async update(
    @Param('id', MongoIdPipe) id: Types.ObjectId,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ApiResponseDto<UserResponseDto | null>> {
    const user = await this.usersService.updateById(id, updateUserDto);
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
      message: data ? 'User updated successfully' : 'User not found',
      data,
    };
  }

  @Delete(':id')
  async remove(
    @Param('id', MongoIdPipe) id: Types.ObjectId,
  ): Promise<ApiResponseDto<UserResponseDto | null>> {
    const user = await this.usersService.removeById(id);
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
      message: data ? 'User deleted successfully' : 'User not found',
      data,
    };
  }
}
