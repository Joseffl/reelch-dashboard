import { Inject, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public, Roles } from '../auth/auth.decorators.js';
import { WaitlistService, type JoinWaitlistInput } from './waitlist.service.js';

@Controller('waitlist')
export class WaitlistController {
  constructor(@Inject(WaitlistService) private readonly waitlist: WaitlistService) {}

  @Post('promoters')
  @Public()
  joinPromoterWaitlist(@Body() body: JoinWaitlistInput) {
    return this.waitlist.joinPromoterWaitlist(body);
  }

  @Get('admin/promoters')
  @Roles('admin')
  listPromoterWaitlist(@Query() query: { status?: string; query?: string; page?: number; pageSize?: number }) {
    return this.waitlist.listPromoterWaitlist(query);
  }

  @Patch('admin/promoters/:id/status')
  @Roles('admin')
  updatePromoterWaitlistStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.waitlist.updatePromoterWaitlistStatus(id, body.status);
  }
}
