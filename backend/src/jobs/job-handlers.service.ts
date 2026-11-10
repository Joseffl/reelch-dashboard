import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { PlatformService } from '../platform/platform.service.js';

@Injectable()
export class JobHandlersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(PlatformService) private readonly platform: PlatformService) {}

  async welcome(userId: string) {
    // A recipient-derived ID also remains stable across dead-letter redrives.
    await this.database.executeSql(`INSERT INTO notifications (id, user_id, type, title, body, data)
      VALUES ($1, $2, 'welcome', 'Welcome to Reelch', 'Complete your profile to get started.', '{}')
      ON CONFLICT (id) DO NOTHING`, [userId, userId]);
  }

  async proofReview(proofId: string) {
    await this.platform.runProofAiReview(proofId);
  }

  async payoutSync(withdrawalId: string) {
    const withdrawal = await this.platform.syncPaypalPayout(withdrawalId);
    if (withdrawal.status === 'processing') throw new Error('PayPal payout is still pending');
  }

  async paystack(reference: string, receiptId: string) {
    await this.database.executeSql('UPDATE inbound_webhook_events SET attempts=attempts+1 WHERE id=$1', [receiptId]);
    try {
      await this.platform.processPaystackCharge(reference);
      await this.database.executeSql("UPDATE inbound_webhook_events SET status='processed', processed_at=now(), last_error=NULL WHERE id=$1", [receiptId]);
    } catch (error) {
      await this.database.executeSql("UPDATE inbound_webhook_events SET status='failed', last_error='Payment processing failed; inspect worker logs' WHERE id=$1", [receiptId]);
      throw error;
    }
  }
}
