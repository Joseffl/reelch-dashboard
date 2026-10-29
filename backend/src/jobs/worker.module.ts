import { Module } from '@nestjs/common';
import { JobsModule } from './jobs.module.js';
import { PlatformModule } from '../platform/platform.module.js';
import { JobHandlersService } from './job-handlers.service.js';
import { EmailService } from '../email/email.service.js';

@Module({ imports: [JobsModule, PlatformModule], providers: [JobHandlersService, EmailService] })
export class WorkerModule {}
