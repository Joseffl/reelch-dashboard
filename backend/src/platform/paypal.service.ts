import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

export type PaypalOrder = {
  id: string; status: string;
  links?: Array<{ href: string; rel: string }>;
  purchase_units?: Array<{ reference_id?: string; custom_id?: string; payments?: { captures?: Array<{ id: string; status: string; amount: { currency_code: string; value: string }; create_time?: string }> } }>;
};
export type PaypalPayoutBatch = {
  batch_header: { payout_batch_id: string; batch_status: string; sender_batch_header?: { sender_batch_id?: string } };
  items?: Array<{ payout_item_id: string; transaction_id?: string; transaction_status?: string; errors?: { name?: string; message?: string } }>;
};
export type FundingVerification = { reference: string; succeeded: boolean; status: string; amountMinor: number; currency: string; paidAt?: string; channel: string; raw: Record<string, unknown> };

// Amounts are stored in minor units; PayPal expects decimal strings.
export const toPaypalValue = (minor: number) => (minor / 100).toFixed(2);
export const fromPaypalValue = (value: string) => Math.round(Number(value) * 100);

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private token?: { value: string; expiresAt: number };

  get baseUrl() {
    return process.env.PAYPAL_ENV?.trim() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  get configured() { return Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim()); }

  async createOrder(input: { reference: string; campaignId: string; title: string; amountMinor: number; currency: string; returnUrl: string; cancelUrl: string }) {
    const order = await this.request<PaypalOrder>('/v2/checkout/orders', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': input.reference },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: input.campaignId, custom_id: input.reference,
          description: `Reelch campaign: ${input.title}`.slice(0, 127),
          amount: { currency_code: input.currency, value: toPaypalValue(input.amountMinor) },
        }],
        payment_source: { paypal: { experience_context: { brand_name: 'Reelch', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: input.returnUrl, cancel_url: input.cancelUrl } } },
      }),
    });
    const approveUrl = order.links?.find(link => link.rel === 'payer-action' || link.rel === 'approve')?.href;
    if (!approveUrl) throw new BadGatewayException('PayPal did not return an approval link');
    return { orderId: order.id, approveUrl, order };
  }

  // Captures an approved order; safe to call repeatedly for the same order.
  async captureOrder(orderId: string): Promise<FundingVerification> {
    let order: PaypalOrder;
    try {
      order = await this.request<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', headers: { 'PayPal-Request-Id': `capture-${orderId}` } });
    } catch (error) {
      // Already captured, or not yet approved: read the order to report its real state.
      order = await this.request<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
      if (order.status !== 'COMPLETED') throw error;
    }
    return this.verification(orderId, order);
  }

  async getOrder(orderId: string) {
    return this.verification(orderId, await this.request<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' }));
  }

  async createPayout(input: { senderBatchId: string; receiver: string; amountMinor: number; currency: string; note: string }) {
    const batch = await this.request<PaypalPayoutBatch>('/v1/payments/payouts', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': input.senderBatchId },
      body: JSON.stringify({
        sender_batch_header: { sender_batch_id: input.senderBatchId, email_subject: 'You have a payout from Reelch', email_message: input.note },
        items: [{ recipient_type: 'EMAIL', receiver: input.receiver, note: input.note, sender_item_id: input.senderBatchId, amount: { value: toPaypalValue(input.amountMinor), currency: input.currency } }],
      }),
    });
    return batch.batch_header.payout_batch_id;
  }

  // The request id makes retries safe: PayPal returns the same refund rather than issuing another.
  async refundCapture(input: { captureId: string; amountMinor: number; currency: string; requestId: string; note: string }) {
    return this.request<{ id: string; status: string }>(`/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`, {
      method: 'POST',
      headers: { 'PayPal-Request-Id': input.requestId, Prefer: 'return=representation' },
      body: JSON.stringify({ amount: { value: toPaypalValue(input.amountMinor), currency_code: input.currency }, note_to_payer: input.note }),
    });
  }

  async getPayout(batchId: string) {
    return this.request<PaypalPayoutBatch>(`/v1/payments/payouts/${encodeURIComponent(batchId)}`, { method: 'GET' });
  }

  async verifyWebhook(headers: Record<string, string | undefined>, event: unknown) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
    if (!webhookId) return false;
    const result = await this.request<{ verification_status?: string }>('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'], cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'], transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'], webhook_id: webhookId, webhook_event: event,
      }),
    });
    return result.verification_status === 'SUCCESS';
  }

  private verification(orderId: string, order: PaypalOrder): FundingVerification {
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    return {
      reference: orderId,
      succeeded: order.status === 'COMPLETED' && capture?.status === 'COMPLETED',
      status: capture?.status ?? order.status,
      amountMinor: capture ? fromPaypalValue(capture.amount.value) : 0,
      currency: capture?.amount.currency_code ?? '',
      paidAt: capture?.create_time,
      channel: 'paypal',
      raw: order as unknown as Record<string, unknown>,
    };
  }

  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const id = process.env.PAYPAL_CLIENT_ID?.trim(); const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    if (!id || !secret) throw new ServiceUnavailableException('PayPal is not configured yet');
    const response = await this.fetch('/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const payload = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!response.ok || !payload.access_token) {
      this.logger.warn(`PayPal token request failed with status ${response.status}: ${payload.error_description ?? 'No message'}`);
      throw new ServiceUnavailableException('PayPal credentials were rejected');
    }
    this.token = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 300) * 1000 };
    return this.token.value;
  }

  private async request<T>(path: string, init: RequestInit & { headers?: Record<string, string> }): Promise<T> {
    const response = await this.fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' } });
    const payload = await response.json().catch(() => ({})) as T & { message?: string; name?: string; details?: Array<{ issue?: string; description?: string }> };
    if (!response.ok) {
      const issue = payload.details?.[0]?.issue ?? payload.name;
      this.logger.warn(`PayPal rejected ${path} with status ${response.status}: ${issue ?? 'No issue'} ${payload.message ?? ''}`);
      throw new BadGatewayException(payload.details?.[0]?.description || payload.message || 'PayPal could not complete the request. Please try again.');
    }
    return payload;
  }

  private async fetch(path: string, init: RequestInit) {
    try {
      return await fetch(`${this.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (cause) {
      this.logger.error(`PayPal request failed for ${path}`, cause instanceof Error ? cause.stack : undefined);
      throw new BadGatewayException('PayPal is temporarily unavailable. Please try again.');
    }
  }
}
