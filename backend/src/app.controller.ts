import { Inject, Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/auth.decorators.js';
import { DatabaseService } from './database/database.service.js';
import { JobsService, WELCOME_QUEUE, PAYSTACK_QUEUE, EMAIL_QUEUE } from './jobs/jobs.service.js';

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService, @Inject(DatabaseService) private readonly database: DatabaseService, @Inject(JobsService) private readonly jobs: JobsService) {}

  @Get('health')
  @Public()
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('ready')
  @Public()
  async getReadiness() {
    if (!(await this.database.ping())) throw new ServiceUnavailableException('Database is unavailable');
    if (this.jobs.enabled) {
      try {
        await this.jobs.ready();
        const queues = await Promise.all([WELCOME_QUEUE, PAYSTACK_QUEUE, ...(process.env.EMAIL_ENABLED === 'true' ? [EMAIL_QUEUE] : [])].map(name => this.jobs.boss.getQueue(name)));
        if (queues.some(queue => !queue)) throw new Error('Queue missing');
      } catch { throw new ServiceUnavailableException('Background jobs are unavailable'); }
    }
    return { status: 'ready', database: 'connected', timestamp: new Date().toISOString() };
  }
}
