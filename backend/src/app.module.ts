import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';
import { ContactModule } from './contact/contact.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './common/rate-limit.guard.js';

@Module({
  imports: [DatabaseModule, JobsModule, AuthModule, OnboardingModule, PlatformModule, WaitlistModule, ContactModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
