import { SetMetadata } from '@nestjs/common';
import type { ReelchRole } from './auth.types.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: ReelchRole[]) => SetMetadata(ROLES_KEY, roles);
