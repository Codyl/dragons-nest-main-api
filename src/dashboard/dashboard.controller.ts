import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UsersService } from 'src/users/users.service';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { Types } from 'mongoose';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';
import { validateTestScoreInput } from './dashboard.helpers';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('managed-users')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':managedUserId/dashboard')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getDashboard(
    @CurrentUser() user: { sub: string },
    @Param('managedUserId', MongoIdPipe) managedUserId: Types.ObjectId,
    @Query() query: DashboardQueryDto,
  ) {
    // Resolve the authenticated manager
    const manager = await this.usersService.findOneByCognitoSub(user.sub);
    if (!manager) {
      throw new ForbiddenException('Manager not found');
    }

    // Verify managed user belongs to this manager's household
    const isManager = await this.usersService.isAccountManagerOf(
      manager._id,
      managedUserId,
    );
    if (!isManager) {
      throw new ForbiddenException(
        'Managed user does not belong to your household',
      );
    }

    return this.dashboardService.getDashboard(
      managedUserId.toHexString(),
      manager._id.toHexString(),
      query.startDate,
      query.endDate,
    );
  }

  @Post(':managedUserId/test-scores')
  @UseGuards(AuthGuard)
  async submitTestScore(
    @CurrentUser() user: { sub: string },
    @Param('managedUserId', MongoIdPipe) managedUserId: Types.ObjectId,
    @Body() body: { subjectName: unknown; score: unknown; date: unknown },
  ) {
    const validation = validateTestScoreInput(body);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid test score input',
        errors: validation.errors,
      });
    }

    const manager = await this.usersService.findOneByCognitoSub(user.sub);
    if (!manager) {
      throw new ForbiddenException('Manager not found');
    }

    const isManager = await this.usersService.isAccountManagerOf(
      manager._id,
      managedUserId,
    );
    if (!isManager) {
      throw new ForbiddenException(
        'Managed user does not belong to your household',
      );
    }

    await this.dashboardService.addTestScore(manager._id.toHexString(), {
      managedUserId,
      subjectName: body.subjectName as string,
      score: body.score as number,
      date: body.date as string,
    });

    return { message: 'Test score saved' };
  }
}
