import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

type PaystackResponse<T> = { status: boolean; message: string; data: T };
export type PaystackVerification = { status: string; reference: string; amount: number; currency: string; paid_at?: string | null; metadata?: Record<string, unknown> | string; channel?: string; gateway_response?: string; customer?: { customer_code?: string } };
export type PaystackCustomer = { id: number; customer_code: string; email: string };
export type PaystackDedicatedAccount = { id: number; account_name: string; account_number: string; currency: string; bank: { name: string; slug: string }; customer: PaystackCustomer };

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  private get secretKey() {
    const key = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!key) throw new ServiceUnavailableException('Paystack is not configured yet');
    return key;
  }
  async initialize(input: { email: string; amount: number; currency: string; reference: string; campaignId: string; businessId: string }) {
    const callback = new URL(process.env.PAYSTACK_CALLBACK_URL?.trim() || `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/business/wallet`);
    callback.searchParams.set('campaignId', input.campaignId);
    const response = await this.request<PaystackResponse<{ authorization_url: string; access_code: string; reference: string }>>('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email: input.email, amount: String(input.amount), currency: input.currency, reference: input.reference, callback_url: callback.toString(), metadata: JSON.stringify({ campaignId: input.campaignId, businessId: input.businessId, purpose: 'campaign_funding' }) }) });
    if (!response.status || !response.data?.authorization_url) throw new BadGatewayException(response.message || 'Paystack could not initialize payment');
    return response.data;
  }
  async verify(reference: string) {
    const response = await this.request<PaystackResponse<PaystackVerification>>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
    if (!response.status || !response.data) throw new BadGatewayException(response.message || 'Paystack could not verify payment');
    return response.data;
  }
  async createCustomer(input: { email: string; firstName: string; lastName: string; phone?: string; businessId: string }) {
    const body = { email: input.email, first_name: input.firstName, last_name: input.lastName, phone: input.phone, metadata: { businessId: input.businessId, purpose: 'wallet_funding' } };
    try {
      const response = await this.request<PaystackResponse<PaystackCustomer>>('/customer', { method: 'POST', body: JSON.stringify(body) });
      return response.data;
    } catch {
      // Paystack returns an error when the email already exists; reuse that customer safely.
      const response = await this.request<PaystackResponse<PaystackCustomer>>(`/customer/${encodeURIComponent(input.email)}`, { method: 'GET' });
      return response.data;
    }
  }
  async createDedicatedAccount(customerCode: string) {
    const preferredBank = this.secretKey.startsWith('sk_test_') ? 'test-bank' : process.env.PAYSTACK_DVA_BANK?.trim() || undefined;
    const response = await this.request<PaystackResponse<PaystackDedicatedAccount>>('/dedicated_account', { method: 'POST', body: JSON.stringify({ customer: customerCode, preferred_bank: preferredBank }) });
    if (!response.status || !response.data?.account_number) throw new BadGatewayException(response.message || 'Paystack could not create the account number');
    return response.data;
  }
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`https://api.paystack.co${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });
    } catch (cause) {
      this.logger.error(`Paystack request failed for ${path}`, cause instanceof Error ? cause.stack : undefined);
      throw new BadGatewayException('Payment service is temporarily unavailable. Please try again.');
    }
    const payload = await response.json().catch(() => ({ status: false, message: 'Invalid response from Paystack' })) as T & { message?: string };
    if (!response.ok) {
      this.logger.warn(`Paystack rejected ${path} with status ${response.status}: ${payload.message ?? 'No message'}`);
      throw new BadGatewayException(payload.message || 'Payment could not be started. Please try again.');
    }
    return payload;
  }
}
