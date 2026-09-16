import { Module } from '@nestjs/common';
import { R2StorageService } from '../storage/r2-storage.service.js';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';

@Module({ controllers: [OnboardingController], providers: [OnboardingService, R2StorageService] })
export class OnboardingModule {}
