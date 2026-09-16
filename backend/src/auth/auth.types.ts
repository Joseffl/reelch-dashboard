export type ReelchRole = 'business' | 'promoter' | 'admin';

export type AuthenticatedUser = {
  id: string;
  email: string;
  roles: ReelchRole[];
};

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
