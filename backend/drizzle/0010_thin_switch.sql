ALTER TABLE "promoter_waitlist" ADD COLUMN "platforms" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "promoter_waitlist" SET "platforms" = jsonb_build_array("primary_platform") WHERE "platforms" = '[]'::jsonb;
