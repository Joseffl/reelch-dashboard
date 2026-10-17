import { Body, Controller, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
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

  @Public()
  @Get('administrator-invitations/:token')
  administratorInvitation(@Param('token') token: string) {
    return this.auth.administratorInvitation(token);
  }

  @Public()
  @Post('administrator-invitations/accept')
  async acceptAdministratorInvitation(@Body() body: { token: string; displayName: string; password: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.acceptAdministratorInvitation(body);
    this.setSessionCookie(response, result.accessToken);
    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('reelch_session', this.cookieOptions());
    return { success: true };
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Get('profile')
  profile(@Req() request: AuthenticatedRequest) {
    return this.auth.profile(request.user);
  }

  @Patch('profile')
  updateProfile(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.auth.updateProfile(request.user, body);
  }

  private setSessionCookie(response: Response, token: string) {
    response.cookie('reelch_session', token, {
      ...this.cookieOptions(),
      maxAge: 12 * 60 * 60 * 1000,
    });
  }

  private cookieOptions() {
    const production = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: production,
      sameSite: production ? 'none' as const : 'lax' as const,
      path: '/',
    };
  }
}
