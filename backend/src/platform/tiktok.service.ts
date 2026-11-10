import { Injectable } from '@nestjs/common';

// TikTok Login Kit + Display API (v2). A promoter connects their own account, and Reelch reads
// their public videos to confirm a submitted post and its view count. Read-only: Reelch never posts.

export const TIKTOK_SCOPES = ['user.info.basic', 'video.list'];
const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const API = 'https://open.tiktokapis.com/v2';
const DEFAULT_REDIRECT = 'https://backend-red-iota-60.vercel.app/api/v1/promoter/social/tiktok/callback';

export type TiktokTokens = { accessToken: string; refreshToken: string; expiresAt: Date; openId: string; scopes: string[] };
export type TiktokVideo = { id: string; title?: string; description?: string; views?: number; likes?: number; comments?: number; shares?: number; createdAt?: Date; shareUrl?: string };
export class TiktokApiError extends Error { constructor(message: string, readonly code?: string) { super(message); } }

export function tiktokVideoId(url: URL) {
  return url.pathname.match(/\/video\/(\d+)/)?.[1];
}

@Injectable()
export class TiktokService {
  private get config() {
    return { clientKey: process.env.TIKTOK_CLIENT_KEY?.trim() ?? '', clientSecret: process.env.TIKTOK_CLIENT_SECRET?.trim() ?? '', redirectUri: process.env.TIKTOK_REDIRECT_URI?.trim() || DEFAULT_REDIRECT };
  }
  get configured() { const { clientKey, clientSecret } = this.config; return Boolean(clientKey && clientSecret); }

  authorizeUrl(state: string) {
    const { clientKey, redirectUri } = this.config;
    const params = new URLSearchParams({ client_key: clientKey, response_type: 'code', scope: TIKTOK_SCOPES.join(','), redirect_uri: redirectUri, state });
    return `${AUTHORIZE_URL}?${params}`;
  }

  async exchangeCode(code: string) { return this.token({ grant_type: 'authorization_code', code, redirect_uri: this.config.redirectUri }); }
  async refresh(refreshToken: string) { return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken }); }

  async revoke(accessToken: string) {
    const { clientKey, clientSecret } = this.config;
    await fetch(`${API}/oauth/revoke/`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, token: accessToken }), signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
  }

  async userInfo(accessToken: string) {
    const body = await this.api<{ user?: { open_id?: string; display_name?: string; avatar_url?: string } }>(`/user/info/?fields=open_id,display_name,avatar_url`, accessToken);
    return { openId: body.user?.open_id ?? '', displayName: body.user?.display_name ?? 'TikTok user', avatarUrl: body.user?.avatar_url };
  }

  // Only returns videos owned by the account the token belongs to, which is what proves ownership.
  async findOwnVideo(accessToken: string, videoId: string): Promise<TiktokVideo | null> {
    const fields = 'id,title,video_description,view_count,like_count,comment_count,share_count,create_time,share_url';
    const body = await this.api<{ videos?: Array<Record<string, unknown>> }>(`/video/query/?fields=${fields}`, accessToken, { filters: { video_ids: [videoId] } });
    const video = body.videos?.find(item => String(item.id) === videoId);
    if (!video) return null;
    const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    return {
      id: String(video.id), title: typeof video.title === 'string' ? video.title : undefined, description: typeof video.video_description === 'string' ? video.video_description : undefined,
      views: num(video.view_count), likes: num(video.like_count), comments: num(video.comment_count), shares: num(video.share_count),
      createdAt: num(video.create_time) ? new Date(num(video.create_time)! * 1000) : undefined, shareUrl: typeof video.share_url === 'string' ? video.share_url : undefined,
    };
  }

  // Short links (vm.tiktok.com/..., tiktok.com/t/...) redirect to the full video URL.
  async resolveVideoUrl(url: URL) {
    if (tiktokVideoId(url)) return url;
    try { const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8_000) }); return new URL(response.url); }
    catch { return url; }
  }

  private async token(grant: Record<string, string>): Promise<TiktokTokens> {
    const { clientKey, clientSecret } = this.config;
    const response = await fetch(`${API}/oauth/token/`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'cache-control': 'no-cache' }, body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, ...grant }), signal: AbortSignal.timeout(10_000) });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof body.access_token !== 'string') throw new TiktokApiError(String(body.error_description ?? body.error ?? 'TikTok did not return an access token'), String(body.error ?? ''));
    return {
      accessToken: body.access_token, refreshToken: String(body.refresh_token ?? ''), openId: String(body.open_id ?? ''),
      expiresAt: new Date(Date.now() + Number(body.expires_in ?? 86_400) * 1000), scopes: String(body.scope ?? '').split(',').map(scope => scope.trim()).filter(Boolean),
    };
  }

  private async api<T>(path: string, accessToken: string, json?: unknown): Promise<T> {
    const response = await fetch(`${API}${path}`, { method: json ? 'POST' : 'GET', headers: { authorization: `Bearer ${accessToken}`, ...(json ? { 'content-type': 'application/json' } : {}) }, body: json ? JSON.stringify(json) : undefined, signal: AbortSignal.timeout(10_000) });
    const body = await response.json().catch(() => ({})) as { data?: T; error?: { code?: string; message?: string } };
    if (!response.ok || (body.error?.code && body.error.code !== 'ok')) throw new TiktokApiError(body.error?.message || `TikTok request failed (${response.status})`, body.error?.code);
    return body.data ?? ({} as T);
  }
}
