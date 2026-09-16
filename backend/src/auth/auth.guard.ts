import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser, ReelchRole } from './auth.types.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthenticatedUser }>();
    const authorization = request.headers.authorization;
    const cookieToken = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('reelch_session='))
      ?.slice('reelch_session='.length);
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : cookieToken;
    if (!token) throw new UnauthorizedException('Authentication required');

    try {
      request.user = await this.jwt.verifyAsync<AuthenticatedUser>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const required = this.reflector.getAllAndOverride<ReelchRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (required?.length && !required.some((role) => request.user?.roles.includes(role))) {
      throw new ForbiddenException('Your role cannot perform this action');
    }
    return true;
  }
}
