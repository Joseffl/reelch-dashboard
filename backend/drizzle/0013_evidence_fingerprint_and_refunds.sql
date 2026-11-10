ALTER TABLE "campaign_reservations" ADD COLUMN "refund_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_reservations" ADD COLUMN "refund_destination" text;--> statement-breakpoint
ALTER TABLE "campaign_reservations" ADD COLUMN "refund_reference" text;--> statement-breakpoint
ALTER TABLE "campaign_reservations" ADD COLUMN "refund_error" text;--> statement-breakpoint
ALTER TABLE "proof_submissions" ADD COLUMN "evidence_fingerprint" text;