import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { emailConfiguration, type EmailPayload } from './email.js';

@Injectable()
export class EmailService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async deliver(id: string) {
    const config = emailConfiguration();
    if (!config) throw new Error('Email delivery is disabled; retain this job until configured');
    // Serialize deliveries of one message, including concurrent replays.
    await this.database.transaction(async (_tx, client) => {
      const result = await client.query('SELECT * FROM email_deliveries WHERE id=$1 FOR UPDATE', [id]);
      const row = result.rows[0] as { accepted_at: Date | null; first_attempt_at: Date | null; payload: EmailPayload } | undefined;
      if (!row || row.accepted_at) return;
      if (row.first_attempt_at && Date.now() - new Date(row.first_attempt_at).getTime() > 23 * 3600_000) {
        throw new Error('Email retry window expired; review provider logs before resending');
      }
      // Attempt time is persisted separately before this transaction (see worker).
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `reelch/${id}` },
        body: JSON.stringify(row.payload), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Resend email request failed (HTTP ${response.status})`);
      const body = await response.json() as { id?: string };
      if (!body.id) throw new Error('Resend did not return a message ID');
      await client.query('UPDATE email_deliveries SET accepted_at=now(), provider_message_id=$2 WHERE id=$1', [id, body.id]);
    });
  }

  async process(id: string) {
    await this.database.executeSql('UPDATE email_deliveries SET first_attempt_at=coalesce(first_attempt_at,now()) WHERE id=$1', [id]);
    await this.deliver(id);
  }
}
