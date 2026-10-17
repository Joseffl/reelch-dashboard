CREATE TABLE "administrator_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrators" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"invited_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "administrators" ("user_id", "is_super_admin")
SELECT "user_id", true FROM "user_roles" WHERE "role" = 'admin'
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "administrator_invitations" ADD CONSTRAINT "administrator_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "administrators" ADD CONSTRAINT "administrators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "administrators" ADD CONSTRAINT "administrators_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "administrator_invitations_token_unique" ON "administrator_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "administrator_invitations_email_created_idx" ON "administrator_invitations" USING btree ("email","created_at");
