import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller.js';
import { PlatformService } from './platform.service.js';
import { R2StorageService } from '../storage/r2-storage.service.js';
import { PaystackService } from './paystack.service.js';
import { SocialVerificationService } from './social-verification.service.js';
import { PaypalService } from './paypal.service.js';
import { AiService } from '../ai/ai.service.js';
import { TiktokService } from './tiktok.service.js';

@Module({ controllers: [PlatformController], providers: [PlatformService, R2StorageService, PaystackService, PaypalService, AiService, TiktokService, SocialVerificationService], exports: [PlatformService] })
export class PlatformModule {}
