CREATE TABLE "verification_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "verification_status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "promoters" ALTER COLUMN "verification_status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "verification_requests" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "company_size" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "registration_number" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "campaign_goals" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "date_of_birth" text;--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "avatar_storage_key" text;--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "niches" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "languages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "preferred_campaign_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_request_id_verification_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."verification_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_document_storage_key_unique" ON "verification_documents" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "verification_document_request_idx" ON "verification_documents" USING btree ("request_id");
