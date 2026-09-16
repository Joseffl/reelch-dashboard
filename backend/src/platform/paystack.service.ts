import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type PaystackResponse<T> = { status: boolean; message: string; data: T };
export type PaystackVerification = { status: string; reference: string; amount: number; currency: string; paid_at?: string | null; metadata?: Record<string, unknown> | string; channel?: string; gateway_response?: string };

@Injectable()
export class PaystackService {
  private get secretKey() {
    const key = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!key) throw new ServiceUnavailableException('Paystack is not configured yet');
    return key;
  }

  async initialize(input: { email: string; amount: number; currency: string; reference: string; campaignId: string; businessId: string }) {
    const callback = new URL(process.env.PAYSTACK_CALLBACK_URL?.trim() || `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/business/wallet`);
    callback.searchParams.set('campaignId', input.campaignId);
    const response = await this.request<PaystackResponse<{ authorization_url: string; access_code: string; reference: string }>>('/transaction/initialize', { method: 'POST', body: JSON.stringify({
      email: input.email, amount: String(input.amount), currency: input.currency, reference: input.reference, callback_url: callback.toString(),
      metadata: JSON.stringify({ campaignId: input.campaignId, businessId: input.businessId, purpose: 'campaign_funding' }),
    }) });
    if (!response.status || !response.data?.authorization_url) throw new BadGatewayException(response.message || 'Paystack could not initialize payment');
    return response.data;
  }

  async verify(reference: string) {
    const response = await this.request<PaystackResponse<PaystackVerification>>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
    if (!response.status || !response.data) throw new BadGatewayException(response.message || 'Paystack could not verify payment');
    return response.data;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try { response = await fetch(`https://api.paystack.co${path}`, { ...init, headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' } }); }
    catch { throw new BadGatewayException('Could not reach Paystack'); }
    const payload = await response.json().catch(() => ({ status: false, message: 'Invalid response from Paystack' })) as T & { message?: string };
    if (!response.ok) throw new BadGatewayException(payload.message || 'Paystack request failed');
    return payload;
  }
}
