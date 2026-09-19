import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { WaitlistService, type JoinWaitlistInput } from './waitlist.service.js';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post('promoters')
  @Public()
  joinPromoterWaitlist(@Body() body: JoinWaitlistInput) {
    return this.waitlist.joinPromoterWaitlist(body);
  }
}
