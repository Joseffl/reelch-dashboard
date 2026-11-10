CREATE TABLE "proof_ai_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proof_submission_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"decision" text NOT NULL,
	"assurance" text NOT NULL,
	"content_match" integer,
	"fraud_risk" text NOT NULL,
	"assessment" jsonb,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proof_submissions" ADD COLUMN "evidence_hash" text;--> statement-breakpoint
ALTER TABLE "proof_ai_reviews" ADD CONSTRAINT "proof_ai_reviews_proof_submission_id_proof_submissions_id_fk" FOREIGN KEY ("proof_submission_id") REFERENCES "public"."proof_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proof_ai_reviews_proof_created_idx" ON "proof_ai_reviews" USING btree ("proof_submission_id","created_at");--> statement-breakpoint
CREATE INDEX "proof_evidence_hash_idx" ON "proof_submissions" USING btree ("evidence_hash");