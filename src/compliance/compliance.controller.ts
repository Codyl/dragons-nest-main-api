import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ComplianceService } from './compliance.service';
import { GetCompletionQueryDto } from './dto/get-completion-query.dto';
import { ToggleCompletionDto } from './dto/toggle-completion.dto';
import { StateComplianceLaws } from './entities/state-compliance-laws.entity';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('compliance')
@UseGuards(AuthGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @ApiOperation({ summary: 'Get completion states for a managed user in a state' })
  @ApiOkResponse({ description: 'Completion items returned.' })
  @ApiUnauthorizedResponse({ description: 'Access token is missing, invalid, or expired.' })
  @Get('completion')
  async getCompletion(
    @Query() query: GetCompletionQueryDto,
    @CurrentUser() user: { sub: string },
  ): Promise<{ items: Record<string, boolean> }> {
    const items = await this.complianceService.getCompletion(
      user.sub,
      query.state,
      query.managedUserId,
    );
    return { items };
  }

  @ApiOperation({ summary: 'Toggle a compliance completion item' })
  @ApiOkResponse({ description: 'Updated completion items returned.' })
  @ApiUnauthorizedResponse({ description: 'Access token is missing, invalid, or expired.' })
  @Patch('completion')
  async toggleCompletion(
    @Body() body: ToggleCompletionDto,
    @CurrentUser() user: { sub: string },
  ): Promise<{ items: Record<string, boolean> }> {
    const items = await this.complianceService.toggleCompletion(
      user.sub,
      body.state,
      body.managedUserId,
      body.itemKey,
      body.completed,
    );
    return { items };
  }

  @ApiOperation({
    summary: 'Gets homeschool compliance laws for a given state abbreviation',
  })
  @ApiOkResponse({
    description: 'Compliance laws found for the requested state.',
    type: StateComplianceLaws,
  })
  @ApiNotFoundResponse({
    description: 'No compliance laws exist for the requested state.',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @Get(':state')
  async getComplianceLaws(
    @Param('state') state: string,
  ): Promise<StateComplianceLaws> {
    return this.complianceService.findByState(state);
  }
}
