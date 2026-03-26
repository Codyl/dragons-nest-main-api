import { Controller, Delete, HttpCode } from '@nestjs/common';
import {
  ApiExcludeController,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { TestUsersService } from './test-users.service';

/**
 * Test-only routes (module registered only when NODE_ENV=test).
 */
@ApiExcludeController()
@Controller('test-users')
export class TestUsersController {
  constructor(private readonly testUsersService: TestUsersService) {}

  @Delete()
  @HttpCode(204)
  @ApiUnauthorizedResponse({
    description: 'Caller is not authenticated to execute test reset.',
  })
  @ApiForbiddenResponse({
    description:
      'Route is unavailable outside allowed test environment policy.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected failure while resetting test users.',
  })
  async reset(): Promise<void> {
    await this.testUsersService.resetTestUsers();
  }
}
