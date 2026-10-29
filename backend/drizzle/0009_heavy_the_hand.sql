CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_key_unique" ON "email_deliveries" USING btree ("delivery_key");