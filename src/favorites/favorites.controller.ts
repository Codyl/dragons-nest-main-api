import {
  Body,
  Controller,
  Delete,
  InternalServerErrorException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';
import { FavoriteResourceDto } from './dto/favorite-resource.dto';
import { UsersService } from 'src/users/users.service';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('favorites')
@UseGuards(AuthGuard)
export class FavoritesController {
  constructor(
    private readonly favoritesService: FavoritesService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async favorite(
    @CurrentUser() user: { sub: string },
    @Body() dto: FavoriteResourceDto,
  ) {
    const userRes = await this.usersService.findOneByCognitoSub(
      user?.sub || '',
    );
    if (!userRes) {
      throw new InternalServerErrorException('missing user');
    }

    await this.favoritesService.favorite(
      userRes._id.toString(),
      dto.resourceId,
    );
    return { message: 'Resource favorited', data: {} };
  }

  @Delete(':resourceId')
  async unfavorite(
    @CurrentUser() user: { sub: string },
    @Param('resourceId', MongoIdPipe) resourceId: Types.ObjectId,
  ) {
    const userRes = await this.usersService.findOneByCognitoSub(user.sub);
    if (!userRes) {
      throw new InternalServerErrorException('');
    }

    await this.favoritesService.unfavorite(userRes._id, resourceId);
    return { message: 'Resource unfavorited', data: {} };
  }
}
