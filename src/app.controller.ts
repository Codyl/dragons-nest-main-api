import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    const data = this.appService.getHealth();

    return {
      message: 'OK',
      data,
    };
  }
}
