CREATE TABLE "virtual_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"provider" text DEFAULT 'paystack' NOT NULL,
	"provider_customer_code" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"bank_name" text NOT NULL,
	"bank_slug" text NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "virtual_accounts" ADD CONSTRAINT "virtual_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "virtual_account_business_provider_unique" ON "virtual_accounts" USING btree ("business_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "virtual_account_provider_customer_unique" ON "virtual_accounts" USING btree ("provider","provider_customer_code");--> statement-breakpoint
CREATE UNIQUE INDEX "virtual_account_provider_number_unique" ON "virtual_accounts" USING btree ("provider","account_number");