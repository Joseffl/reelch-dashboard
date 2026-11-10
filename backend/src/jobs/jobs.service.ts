import { Inject, BadRequestException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { confirmationEmail, type EmailPayload } from '../email/email.js';

export const WELCOME_QUEUE = 'welcome-notification';
export const CLEANUP_QUEUE = 'rate-limit-cleanup';
export const PAYSTACK_QUEUE = 'paystack-charge';
export const EMAIL_QUEUE = 'transactional-email';
export const PROOF_REVIEW_QUEUE = 'proof-ai-review';
export const PAYOUT_SYNC_QUEUE = 'paypal-payout-sync';

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  readonly enabled = process.env.JOBS_ENABLED === 'true';
  readonly boss: PgBoss;
  private started?: Promise<PgBoss>;

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {
    this.boss = new PgBoss({
      db: { executeSql: database.executeSql },
      migrate: false,
      createSchema: false,
      supervise: false,
      schedule: false,
    });
    this.boss.on('error', error => this.logger.error('Queue error', error.stack));
  }

  ready() {
    this.started ??= this.boss.start().catch(error => {
      this.started = undefined;
      throw error;
    });
    return this.started;
  }

  async enqueueWelcome(userId: string, client: PoolClient) {
    if (!this.enabled) return;
    // Initialize before opening the account transaction (see AuthService).
    // Supplying the transaction connection makes account + job commit atomically.
    await this.boss.send(WELCOME_QUEUE, { userId }, {
      db: { executeSql: (text, values) => client.query(text, values) },
      retryLimit: 5, retryDelay: 5, retryBackoff: true,
      expireInSeconds: 60,
    });
    const user = await client.query('SELECT email, display_name FROM users WHERE id=$1', [userId]);
    if (user.rows[0]) await this.enqueueEmail(`account-welcome/${userId}`, confirmationEmail('account', user.rows[0].display_name, user.rows[0].email), client);
  }

  async enqueueEmail(key: string, payload: EmailPayload | undefined, client: PoolClient) {
    if (!payload) return;
    const result = await client.query(`INSERT INTO email_deliveries (delivery_key,payload) VALUES ($1,$2::jsonb)
      ON CONFLICT (delivery_key) DO NOTHING RETURNING id`, [key, JSON.stringify(payload)]);
    if (!result.rows[0]) return;
    await this.boss.send(EMAIL_QUEUE, { deliveryId: result.rows[0].id }, {
      db: { executeSql: (text, values) => client.query(text, values) },
      retryLimit: 8, retryDelay: 30, retryBackoff: true, expireInSeconds: 60,
    });
  }

  async enqueuePaystack(reference: string, payloadHash: string) {
    if (typeof reference !== 'string' || !reference || reference.length > 200) throw new BadRequestException('Invalid payment reference');
    await this.ready();
    return this.database.transaction(async (_tx, client) => {
      const receipt = await client.query(`INSERT INTO inbound_webhook_events (provider, external_id, event_type, payload_hash)
        VALUES ('paystack', $1, 'charge.success', $2) ON CONFLICT (provider, external_id) DO NOTHING RETURNING id`, [reference, payloadHash]);
      if (receipt.rows[0]) {
        await this.boss.send(PAYSTACK_QUEUE, { reference, receiptId: receipt.rows[0].id }, {
          db: { executeSql: (text, values) => client.query(text, values) },
          retryLimit: 8, retryDelay: 10, retryBackoff: true, expireInSeconds: 120,
        });
      }
      return { received: true };
    });
  }

  async enqueueProofReview(proofId: string) {
    await this.ready();
    await this.boss.send(PROOF_REVIEW_QUEUE, { proofId }, { singletonKey: proofId, retryLimit: 3, retryDelay: 20, retryBackoff: true, expireInSeconds: 120 });
  }

  async enqueuePayoutSync(withdrawalId: string) {
    await this.ready();
    // The handler throws while PayPal still reports the payout as pending, so retries act as polling.
    await this.boss.send(PAYOUT_SYNC_QUEUE, { withdrawalId }, { singletonKey: withdrawalId, startAfter: 15, retryLimit: 12, retryDelay: 30, retryBackoff: true, expireInSeconds: 60 });
  }

  async onModuleDestroy() {
    if (this.started) await this.boss.stop({ graceful: true });
  }
}
