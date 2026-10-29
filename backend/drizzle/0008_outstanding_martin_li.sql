CREATE TABLE "request_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "request_rate_limits_expiry_idx" ON "request_rate_limits" USING btree ("expires_at");