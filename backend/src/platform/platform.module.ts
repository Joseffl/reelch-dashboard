import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller.js';
import { PlatformService } from './platform.service.js';
import { R2StorageService } from '../storage/r2-storage.service.js';
import { PaystackService } from './paystack.service.js';

@Module({ controllers: [PlatformController], providers: [PlatformService, R2StorageService, PaystackService] })
export class PlatformModule {}
