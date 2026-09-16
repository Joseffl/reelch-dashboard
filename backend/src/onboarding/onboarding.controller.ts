import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OnboardingService } from './onboarding.service.js';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('status')
  status(@Req() req: AuthenticatedRequest) { return this.onboarding.status(req.user); }

  @Patch('business/profile')
  business(@Req() req: AuthenticatedRequest, @Body() body: Parameters<OnboardingService['saveBusiness']>[1]) {
    return this.onboarding.saveBusiness(req.user, body);
  }

  @Patch('promoter/profile')
  promoter(@Req() req: AuthenticatedRequest, @Body() body: Parameters<OnboardingService['savePromoter']>[1]) {
    return this.onboarding.savePromoter(req.user, body);
  }

  @Post('promoter/social-accounts')
  social(@Req() req: AuthenticatedRequest, @Body() body: Parameters<OnboardingService['addSocialAccount']>[1]) {
    return this.onboarding.addSocialAccount(req.user, body);
  }

  @Post('uploads/presign')
  presign(@Req() req: AuthenticatedRequest, @Body() body: Parameters<OnboardingService['presignUpload']>[1]) {
    return this.onboarding.presignUpload(req.user, body);
  }

  @Post('uploads/complete')
  complete(@Req() req: AuthenticatedRequest, @Body() body: Parameters<OnboardingService['completeUpload']>[1]) {
    return this.onboarding.completeUpload(req.user, body);
  }

  @Post('submit')
  submit(@Req() req: AuthenticatedRequest) { return this.onboarding.submit(req.user); }
}
