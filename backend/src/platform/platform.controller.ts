import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Redirect, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Public, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PlatformService } from './platform.service.js';

@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Roles('business')
  @Post('business/campaigns')
  createCampaign(@Req() req: AuthenticatedRequest, @Body() body: Parameters<PlatformService['createCampaign']>[1]) {
    return this.platform.createCampaign(req.user, body);
  }

  @Roles('business')
  @Get('business/campaigns')
  businessCampaigns(@Req() req: AuthenticatedRequest) { return this.platform.businessCampaigns(req.user); }

  @Roles('business')
  @Get('business/campaigns/:id')
  businessCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.platform.businessCampaignDetail(req.user, id); }

  @Roles('business')
  @Patch('business/campaigns/:id')
  updateCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Parameters<PlatformService['updateCampaign']>[2]) { return this.platform.updateCampaign(req.user, id, body); }

  @Roles('business')
  @Post('business/campaigns/:id/creatives/presign')
  presignCreative(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Parameters<PlatformService['presignCampaignCreative']>[2]) { return this.platform.presignCampaignCreative(req.user, id, body); }

  @Roles('business')
  @Post('business/campaigns/:id/creatives/complete')
  completeCreative(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Parameters<PlatformService['completeCampaignCreative']>[2]) { return this.platform.completeCampaignCreative(req.user, id, body); }

  @Roles('business')
  @Post('business/campaigns/:id/submit')
  submit(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.platform.submitCampaign(req.user, id); }

  @Roles('admin')
  @Get('admin/campaigns')
  campaigns(@Query() query: { status?: string; query?: string; page?: number; pageSize?: number }) { return this.platform.adminCampaigns(query); }

  @Roles('admin')
  @Get('admin/campaigns/:id')
  campaign(@Param('id') id: string) { return this.platform.adminCampaignDetail(id); }

  @Roles('admin')
  @Get('admin/campaigns/:id/creatives/:creativeId/url')
  campaignCreative(@Param('id') id: string, @Param('creativeId') creativeId: string) { return this.platform.campaignCreativeUrl(id, creativeId); }

  @Roles('business')
  @Post('business/campaigns/:id/funding/initialize')
  initializeFunding(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.platform.initializeCampaignFunding(req.user, id); }

  @Roles('business')
  @Post('business/campaigns/:id/funding/verify')
  verifyFunding(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { reference: string }) { return this.platform.verifyCampaignFunding(req.user, id, body.reference); }

  @Roles('business')
  @Get('business/wallet')
  businessWallet(@Req() req: AuthenticatedRequest) { return this.platform.businessWallet(req.user); }

  @Roles('business')
  @Post('business/wallet/virtual-account')
  createVirtualAccount(@Req() req: AuthenticatedRequest) { return this.platform.createBusinessVirtualAccount(req.user); }

  @Roles('business')
  @Post('business/campaigns/:id/funding/wallet')
  fundFromWallet(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.platform.fundCampaignFromWallet(req.user, id); }

  @Roles('business')
  @Post('business/campaigns/:campaignId/applications/:applicationId/accept')
  accept(@Req() req: AuthenticatedRequest, @Param('campaignId') campaignId: string, @Param('applicationId') applicationId: string, @Body() body: { targetQuantity: number }) {
    return this.platform.acceptPromoter(req.user, campaignId, applicationId, body.targetQuantity);
  }

  @Roles('business')
  @Get('business/campaigns/:campaignId/applications')
  applications(@Req() req: AuthenticatedRequest, @Param('campaignId') campaignId: string) { return this.platform.businessCampaignApplications(req.user, campaignId); }

  @Roles('business')
  @Post('business/campaigns/:campaignId/applications/:applicationId/decision')
  decideApplication(@Req() req: AuthenticatedRequest, @Param('campaignId') campaignId: string, @Param('applicationId') applicationId: string, @Body() body: { decision: 'accept' | 'reject'; targetQuantity?: number }) {
    return this.platform.decideApplication(req.user, campaignId, applicationId, body.decision, body.targetQuantity);
  }

  @Roles('promoter')
  @Get('promoter/campaigns/discover')
  discover(@Req() req: AuthenticatedRequest) { return this.platform.discoverCampaigns(req.user); }

  @Roles('promoter')
  @Get('promoter/campaigns/:id')
  promoterCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.platform.promoterCampaignDetail(req.user, id); }

  @Roles('promoter')
  @Post('promoter/campaigns/:id/join')
  joinCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.platform.joinCampaign(req.user, id); }

  @Roles('promoter')
  @Post('promoter/campaigns/:id/apply')
  apply(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { message?: string }) { return this.platform.apply(req.user, id, body.message); }

  @Roles('promoter')
  @Get('promoter/workspace')
  workspace(@Req() req: AuthenticatedRequest) { return this.platform.promoterWorkspace(req.user); }

  @Roles('admin')
  @Get('admin/verifications')
  verifications(@Query() query: { status?: string; query?: string; page?: number; pageSize?: number }) {
    return this.platform.adminVerifications(query);
  }

  @Roles('admin')
  @Get('admin/verifications/:id')
  verification(@Param('id') id: string) { return this.platform.adminVerificationDetail(id); }

  @Roles('admin')
  @Get('admin/verifications/:id/documents/:documentId/url')
  verificationDocument(@Param('id') id: string, @Param('documentId') documentId: string) {
    return this.platform.adminDocumentUrl(id, documentId);
  }

  @Roles('admin')
  @Post('admin/verifications/:id/review')
  reviewVerification(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { decision: 'approved' | 'rejected' | 'more_information_required'; reason?: string }) {
    return this.platform.reviewVerification(req.user, id, body.decision, body.reason);
  }

  @Roles('admin')
  @Patch('admin/users/:id/status')
  userStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { isActive: boolean; reason?: string }) {
    return this.platform.setUserActive(req.user, id, body.isActive, body.reason);
  }

  @Roles('admin')
  @Post('admin/campaigns/:id/moderate')
  moderate(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { decision: 'approve' | 'reject' | 'request_changes'; reason?: string }) {
    return this.platform.moderateCampaign(req.user, id, body.decision, body.reason);
  }

  @Roles('admin')
  @Post('admin/campaigns/:id/pause')
  pause(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { reason: string }) { return this.platform.pauseCampaign(req.user, id, body.reason); }

  @Roles('admin')
  @Post('admin/conversions/:id/flag')
  flag(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { rule: string; riskScore: number }) {
    return this.platform.flagConversion(req.user, id, body.rule, body.riskScore);
  }

  @Roles('promoter')
  @Post('promoter/payout-accounts')
  addPayoutAccount(@Req() req: AuthenticatedRequest, @Body() body: Parameters<PlatformService['addPayoutAccount']>[1]) {
    return this.platform.addPayoutAccount(req.user, body);
  }

  @Roles('promoter')
  @Post('promoter/withdrawals')
  withdraw(@Req() req: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() body: Parameters<PlatformService['requestWithdrawal']>[1]) {
    return this.platform.requestWithdrawal(req.user, body, key);
  }

  @Roles('admin')
  @Post('admin/withdrawals/:id/process')
  processWithdrawal(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Parameters<PlatformService['processWithdrawal']>[2]) {
    return this.platform.processWithdrawal(req.user, id, body);
  }

  @Post('disputes')
  createDispute(@Req() req: AuthenticatedRequest, @Body() body: Parameters<PlatformService['createDispute']>[1]) {
    return this.platform.createDispute(req.user, body);
  }

  @Post('disputes/:id/evidence')
  addEvidence(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Parameters<PlatformService['addDisputeEvidence']>[2]) {
    return this.platform.addDisputeEvidence(req.user, id, body);
  }

  @Roles('admin')
  @Post('admin/disputes/:id/resolve')
  resolveDispute(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Parameters<PlatformService['resolveDispute']>[2]) {
    return this.platform.resolveDispute(req.user, id, body);
  }

  @Roles('promoter')
  @Get('promoter/proofs')
  promoterProofs(@Req() req: AuthenticatedRequest) { return this.platform.promoterProofs(req.user); }

  @Roles('promoter')
  @Post('promoter/assignments/:id/proofs/presign')
  presignProof(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Parameters<PlatformService['presignProof']>[2]) { return this.platform.presignProof(req.user, id, body); }

  @Roles('promoter')
  @Post('promoter/assignments/:id/proofs')
  submitProof(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Parameters<PlatformService['submitProof']>[2]) {
    return this.platform.submitProof(req.user, id, body);
  }

  @Get('proofs/:id/evidence')
  proofEvidence(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.platform.proofEvidenceUrl(req.user, id); }

  @Roles('admin')
  @Get('admin/proofs')
  adminProofs(@Query('status') status?: string) { return this.platform.adminProofs(status); }

  @Roles('admin')
  @Post('admin/proofs/:id/review')
  reviewProof(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Parameters<PlatformService['reviewProof']>[2]) {
    return this.platform.reviewProof(req.user, id, body);
  }

  @Get('notifications')
  notifications(@Req() req: AuthenticatedRequest) { return this.platform.getNotifications(req.user); }

  @Post('notifications/:id/read')
  readNotification(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.platform.markNotificationRead(req.user, id); }

  @Roles('admin')
  @Get('admin/analytics/overview')
  adminOverview() { return this.platform.adminOverview(); }

  @Public()
  @Get('r/:code')
  @Redirect()
  async referral(@Param('code') code: string, @Req() req: Request) {
    return { url: await this.platform.followReferral(code, req.ip, req.headers['user-agent']), statusCode: 302 };
  }

  @Public()
  @Post('webhooks/conversions')
  conversion(@Req() req: RawBodyRequest<Request>, @Headers('x-reelch-signature') signature: string, @Body() body: { referralCode: string; externalReference: string; conversionType: string }) {
    const raw = req.rawBody;
    if (!raw || !signature) throw new UnauthorizedException('Valid webhook signature required');
    const expected = createHmac('sha256', process.env.CONVERSION_WEBHOOK_SECRET ?? 'local-webhook-secret-change-me').update(raw).digest('hex');
    const received = Buffer.from(signature);
    const valid = received.length === expected.length && timingSafeEqual(received, Buffer.from(expected));
    if (!valid) throw new UnauthorizedException('Valid webhook signature required');
    return this.platform.recordConversion(body);
  }

  @Public()
  @Post('webhooks/paystack')
  async paystackWebhook(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') signature: string, @Body() body: { event?: string; data?: { reference?: string } }) {
    const raw = req.rawBody; const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!raw || !signature || !secret) throw new UnauthorizedException('Valid Paystack signature required');
    const expected = createHmac('sha512', secret).update(raw).digest('hex');
    const received = Buffer.from(signature);
    if (received.length !== expected.length || !timingSafeEqual(received, Buffer.from(expected))) throw new UnauthorizedException('Valid Paystack signature required');
    if (body.event === 'charge.success' && body.data?.reference) {
      return this.platform.processPaystackCharge(body.data.reference);
    }
    return { received: true };
  }
}
