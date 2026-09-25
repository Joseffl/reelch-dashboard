CREATE TABLE "proof_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proof_submission_id" uuid NOT NULL,
	"views" integer,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"raw_response_hash" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promoter_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"username" text NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proof_submissions" ALTER COLUMN "storage_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "proof_submissions" ADD COLUMN "submitted_url" text;--> statement-breakpoint
ALTER TABLE "proof_submissions" ADD COLUMN "external_post_id" text;--> statement-breakpoint
ALTER TABLE "proof_submissions" ADD COLUMN "external_author_id" text;--> statement-breakpoint
ALTER TABLE "proof_submissions" ADD COLUMN "verification_method" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "proof_submissions" ADD COLUMN "automated_checks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "proof_metric_snapshots" ADD CONSTRAINT "proof_metric_snapshots_proof_submission_id_proof_submissions_id_fk" FOREIGN KEY ("proof_submission_id") REFERENCES "public"."proof_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_promoter_id_promoters_id_fk" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proof_metrics_submission_idx" ON "proof_metric_snapshots" USING btree ("proof_submission_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_connection_promoter_provider_unique" ON "social_connections" USING btree ("promoter_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "social_connection_provider_user_unique" ON "social_connections" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proof_platform_post_unique" ON "proof_submissions" USING btree ("platform","external_post_id");