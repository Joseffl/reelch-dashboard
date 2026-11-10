import { BadRequestException, Injectable } from '@nestjs/common';

export type SocialVerification = {
  method: 'platform_api' | 'public_metadata' | 'manual';
  externalPostId?: string; externalAuthorId?: string;
  checks: Record<string, unknown>;
  metrics?: { views?: number; likes?: number; comments?: number; shares?: number };
};

@Injectable()
export class SocialVerificationService {
  async verify(platform: string, submittedUrl?: string, options: { hasEvidence?: boolean } = {}): Promise<SocialVerification> {
    const normalized = platform.trim().toLowerCase();
    if (normalized === 'whatsapp') return { method: 'manual', checks: { reason: 'WhatsApp statuses and broadcasts have no public verification API' } };
    if (!submittedUrl) throw new BadRequestException('A public post link is required for this platform');
    let url: URL; try { url = new URL(submittedUrl); } catch { throw new BadRequestException('Enter a valid public post link'); }
    if (normalized === 'x') return this.verifyX(url);
    if (normalized === 'tiktok') {
      try { return await this.verifyTikTok(url); }
      catch (error) {
        // TikTok's public lookup fails for private, new or region-locked posts. With a screenshot attached,
        // the proof can still be checked from its evidence instead of being turned away.
        if (!options.hasEvidence || !['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'].includes(url.hostname)) throw error;
        return { method: 'manual', externalPostId: url.pathname.match(/\/video\/(\d+)/)?.[1], checks: { validUrl: true, reason: 'TikTok could not confirm this post automatically, so it was checked from the evidence' } };
      }
    }
    if (normalized === 'instagram') return this.verifyInstagram(url);
    throw new BadRequestException('Unsupported proof platform');
  }

  private async verifyX(url: URL): Promise<SocialVerification> {
    if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)) throw new BadRequestException('Enter a valid X post link');
    const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/); if (!match) throw new BadRequestException('Enter a direct X post link');
    const [, username, id] = match; const token = process.env.X_BEARER_TOKEN?.trim();
    if (!token) return { method: 'manual', externalPostId: id, checks: { validUrl: true, submittedUsername: username, reason: 'X API is not configured' } };
    const response = await this.fetchJson<{ data?: { id: string; text: string; author_id: string; created_at?: string; public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number; quote_count?: number } }; includes?: { users?: Array<{ id: string; username: string }> } }>(`https://api.x.com/2/tweets/${id}?tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.data) throw new BadRequestException('The X post could not be found'); const metrics = response.data.public_metrics; const author = response.includes?.users?.[0];
    return { method: 'platform_api', externalPostId: id, externalAuthorId: response.data.author_id, checks: { exists: true, username: author?.username, text: response.data.text, createdAt: response.data.created_at }, metrics: { likes: metrics?.like_count, comments: metrics?.reply_count, shares: (metrics?.retweet_count ?? 0) + (metrics?.quote_count ?? 0) } };
  }

  private async verifyTikTok(url: URL): Promise<SocialVerification> {
    if (!['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'].includes(url.hostname)) throw new BadRequestException('Enter a valid TikTok post link');
    const response = await this.fetchJson<{ author_name?: string; author_url?: string; title?: string; html?: string }>(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`);
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1] ?? response.html?.match(/data-video-id="(\d+)"/)?.[1];
    if (!response.author_name || !id) throw new BadRequestException('The TikTok post could not be verified');
    const authorHandle = response.author_url ? new URL(response.author_url).pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '') : undefined;
    return { method: 'public_metadata', externalPostId: id, externalAuthorId: authorHandle ?? response.author_name, checks: { exists: true, authorName: response.author_name, authorHandle, authorUrl: response.author_url, description: response.title } };
  }

  private verifyInstagram(url: URL): SocialVerification {
    if (!['instagram.com', 'www.instagram.com'].includes(url.hostname)) throw new BadRequestException('Enter a valid Instagram post link');
    const match = url.pathname.match(/^\/(?:p|reel|tv)\/([^/]+)/); if (!match) throw new BadRequestException('Enter a direct Instagram post or reel link');
    return { method: 'manual', externalPostId: match[1], checks: { validUrl: true, reason: 'Instagram API connection or manual review is required' } };
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10_000);
    try { const response = await fetch(url, { ...init, signal: controller.signal }); if (!response.ok) throw new BadRequestException('The submitted post could not be verified'); return await response.json() as T; }
    catch (error) { if (error instanceof BadRequestException) throw error; throw new BadRequestException('The submitted post could not be reached'); }
    finally { clearTimeout(timer); }
  }
}
