-- Repair databases whose migration journal predates the payment tables.
-- This is intentionally idempotent so it is safe on databases where the
-- original table already exists.
CREATE TABLE IF NOT EXISTS "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"provider" text DEFAULT 'paystack' NOT NULL,
	"reference" text NOT NULL,
	"access_code" text,
	"amount_kobo" bigint NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"status" text DEFAULT 'initialized' NOT NULL,
	"provider_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_campaign_id_campaigns_id_fk"
		FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade,
	CONSTRAINT "payment_attempts_business_id_businesses_id_fk"
		FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempt_reference_unique"
	ON "payment_attempts" USING btree ("reference");

CREATE INDEX IF NOT EXISTS "payment_attempt_campaign_idx"
	ON "payment_attempts" USING btree ("campaign_id", "created_at");
