import { Controller, Delete, HttpCode } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

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
  async reset(): Promise<void> {
    await this.testUsersService.resetTestUsers();
  }
}
