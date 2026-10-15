import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';
import { ContactModule } from './contact/contact.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, OnboardingModule, PlatformModule, WaitlistModule, ContactModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
