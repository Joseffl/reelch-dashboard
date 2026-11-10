import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { TiktokApiError, TiktokService, tiktokVideoId } from './tiktok.service.js';

// What Reelch could confirm about a submitted post link:
// - confirmed:   the platform says the post exists (and, where possible, who posted it)
// - failed:      the platform says the link is not a real post of this promoter
// - unavailable: no check is possible (no API configured, WhatsApp) or the platform could not be reached
export type LinkCheck = 'confirmed' | 'failed' | 'unavailable';

export type SocialVerification = {
  method: 'platform_api' | 'public_metadata' | 'manual';
  externalPostId?: string; externalAuthorId?: string;
  checks: Record<string, unknown> & { linkCheck?: LinkCheck };
  metrics?: { views?: number; likes?: number; comments?: number; shares?: number };
};

export type VerifyOptions = { hasEvidence?: boolean; tiktokAccessToken?: string };
const TIKTOK_HOSTS = ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'm.tiktok.com'];

class LinkNotFoundError extends BadRequestException {}

@Injectable()
export class SocialVerificationService {
  constructor(@Optional() @Inject(TiktokService) private readonly tiktok: TiktokService = new TiktokService()) {}

  async verify(platform: string, submittedUrl?: string, options: VerifyOptions = {}): Promise<SocialVerification> {
    const normalized = platform.trim().toLowerCase();
    if (normalized === 'whatsapp') return { method: 'manual', checks: { linkCheck: 'unavailable', reason: 'WhatsApp statuses and broadcasts have no public verification API' } };
    if (!submittedUrl) throw new BadRequestException('A public post link is required for this platform');
    let url: URL; try { url = new URL(submittedUrl); } catch { throw new BadRequestException('Enter a valid public post link'); }
    if (normalized === 'x') return this.verifyX(url);
    if (normalized === 'tiktok') return this.verifyTikTok(url, options);
    if (normalized === 'instagram') return this.verifyInstagram(url);
    throw new BadRequestException('Unsupported proof platform');
  }

  private async verifyX(url: URL): Promise<SocialVerification> {
    if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(url.hostname)) throw new BadRequestException('Enter a valid X post link');
    const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/); if (!match) throw new BadRequestException('Enter a direct X post link');
    const [, username, id] = match; const token = process.env.X_BEARER_TOKEN?.trim();
    if (!token) return { method: 'manual', externalPostId: id, checks: { linkCheck: 'unavailable', validUrl: true, submittedUsername: username, reason: 'X link checks are not switched on, so views come from the screenshot' } };
    type XPost = { data?: { id: string; text: string; author_id: string; created_at?: string; public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number; quote_count?: number; impression_count?: number } }; includes?: { users?: Array<{ id: string; username: string }> } };
    let response: XPost;
    try { response = await this.fetchJson<XPost>(`https://api.x.com/2/tweets/${id}?tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username`, { headers: { Authorization: `Bearer ${token}` } }); }
    catch (error) {
      if (error instanceof LinkNotFoundError) return { method: 'manual', externalPostId: id, checks: { linkCheck: 'failed', reason: 'X could not find this post' } };
      return { method: 'manual', externalPostId: id, checks: { linkCheck: 'unavailable', reason: 'X could not be reached, so views come from the screenshot' } };
    }
    if (!response.data) return { method: 'manual', externalPostId: id, checks: { linkCheck: 'failed', reason: 'X could not find this post' } };
    const metrics = response.data.public_metrics; const author = response.includes?.users?.[0];
    return {
      method: 'platform_api', externalPostId: id, externalAuthorId: response.data.author_id,
      checks: { linkCheck: 'confirmed', exists: true, username: author?.username, text: response.data.text, createdAt: response.data.created_at },
      metrics: { views: metrics?.impression_count, likes: metrics?.like_count, comments: metrics?.reply_count, shares: (metrics?.retweet_count ?? 0) + (metrics?.quote_count ?? 0) },
    };
  }

  private async verifyTikTok(raw: URL, options: VerifyOptions): Promise<SocialVerification> {
    if (!TIKTOK_HOSTS.includes(raw.hostname)) throw new BadRequestException('Enter a valid TikTok post link');
    const url = await this.tiktok.resolveVideoUrl(raw); const id = tiktokVideoId(url);
    // Connected account: read the video straight from the promoter's own TikTok, with its real view count.
    if (options.tiktokAccessToken && id) {
      try {
        const video = await this.tiktok.findOwnVideo(options.tiktokAccessToken, id);
        if (video) return {
          method: 'platform_api', externalPostId: id,
          checks: { linkCheck: 'confirmed', exists: true, ownedByConnectedAccount: true, source: 'tiktok_connected_account', text: video.description ?? video.title, createdAt: video.createdAt?.toISOString() },
          metrics: { views: video.views, likes: video.likes, comments: video.comments, shares: video.shares },
        };
        return { method: 'manual', externalPostId: id, checks: { linkCheck: 'failed', ownedByConnectedAccount: false, reason: 'This video is not on your connected TikTok account' } };
      } catch (error) {
        if (!(error instanceof TiktokApiError)) throw error;
        // TikTok rejected the token or was unavailable: fall back to the public check below.
      }
    }
    try {
      const result = await this.verifyTikTokPublic(url, id);
      return { ...result, checks: { ...result.checks, linkCheck: 'confirmed' } };
    } catch (error) {
      // TikTok's public lookup fails for private, new or region-locked posts. With a screenshot attached,
      // the proof can still be checked from its evidence instead of being turned away.
      if (!options.hasEvidence) throw error;
      return { method: 'manual', externalPostId: id, checks: { linkCheck: 'failed', validUrl: true, reason: 'TikTok could not confirm this post automatically, so it was checked from the evidence' } };
    }
  }

  private async verifyTikTokPublic(url: URL, knownId?: string): Promise<SocialVerification> {
    const response = await this.fetchJson<{ author_name?: string; author_url?: string; title?: string; html?: string }>(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`);
    const id = knownId ?? response.html?.match(/data-video-id="(\d+)"/)?.[1];
    if (!response.author_name || !id) throw new BadRequestException('The TikTok post could not be verified');
    const authorHandle = response.author_url ? new URL(response.author_url).pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '') : undefined;
    return { method: 'public_metadata', externalPostId: id, externalAuthorId: authorHandle ?? response.author_name, checks: { exists: true, authorName: response.author_name, authorHandle, authorUrl: response.author_url, description: response.title } };
  }

  private async verifyInstagram(url: URL): Promise<SocialVerification> {
    if (!['instagram.com', 'www.instagram.com'].includes(url.hostname)) throw new BadRequestException('Enter a valid Instagram post link');
    const match = url.pathname.match(/^\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([^/?#]+)/); if (!match) throw new BadRequestException('Enter a direct Instagram post or reel link');
    // Meta's oEmbed endpoint is tokenless for public posts. It confirms the post exists and who posted it,
    // but has no view counts, so views still come from the screenshot.
    try {
      const response = await this.fetchJson<{ author_name?: string; title?: string }>(`https://graph.facebook.com/instagram_oembed?url=${encodeURIComponent(`https://www.instagram.com/p/${match[1]}/`)}`);
      return { method: 'manual', externalPostId: match[1], externalAuthorId: response.author_name, checks: { linkCheck: 'confirmed', exists: true, authorHandle: response.author_name, description: response.title, reason: 'Instagram confirmed the post; views come from the screenshot' } };
    } catch (error) {
      if (error instanceof LinkNotFoundError) return { method: 'manual', externalPostId: match[1], checks: { linkCheck: 'failed', validUrl: true, reason: 'Instagram could not find a public post at this link' } };
      return { method: 'manual', externalPostId: match[1], checks: { linkCheck: 'unavailable', validUrl: true, reason: 'Instagram could not be reached, so the post was checked from the screenshot' } };
    }
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if ([400, 404, 410].includes(response.status)) throw new LinkNotFoundError('The submitted post could not be verified');
      if (!response.ok) throw new BadRequestException('The submitted post could not be verified');
      return await response.json() as T;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('The submitted post could not be reached');
    } finally { clearTimeout(timer); }
  }
}
