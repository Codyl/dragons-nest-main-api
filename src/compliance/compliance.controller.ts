import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ComplianceService } from './compliance.service';
import { StateComplianceLaws } from './entities/state-compliance-laws.entity';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('compliance')
@UseGuards(AuthGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

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
