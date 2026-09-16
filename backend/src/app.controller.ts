import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/auth.decorators.js';
import { DatabaseService } from './database/database.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly database: DatabaseService) {}

  @Get('health')
  @Public()
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('ready')
  @Public()
  async getReadiness() {
    if (!(await this.database.ping())) throw new ServiceUnavailableException('Database is unavailable');
    return { status: 'ready', database: 'connected', timestamp: new Date().toISOString() };
  }
}
