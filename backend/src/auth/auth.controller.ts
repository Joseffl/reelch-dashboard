import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { Public } from './auth.decorators.js';
import type { AuthenticatedRequest, ReelchRole } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() body: { email: string; password: string; displayName: string; role: Exclude<ReelchRole, 'admin'>; organizationName?: string; username?: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.register(body);
    this.setSessionCookie(response, result.accessToken);
    return result;
  }

  @Public()
  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(body);
    this.setSessionCookie(response, result.accessToken);
    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('reelch_session', { httpOnly: true, sameSite: 'lax', path: '/' });
    return { success: true };
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  private setSessionCookie(response: Response, token: string) {
    response.cookie('reelch_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
  }
}
