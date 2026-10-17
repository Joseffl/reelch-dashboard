CREATE INDEX "audit_logs_resource_created_idx" ON "audit_logs" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "campaign_status_history_campaign_created_idx" ON "campaign_status_history" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "campaigns_status_updated_idx" ON "campaigns" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "conversions_campaign_status_created_idx" ON "conversions" USING btree ("campaign_id","status","created_at");--> statement-breakpoint
CREATE INDEX "conversions_promoter_created_idx" ON "conversions" USING btree ("promoter_id","created_at");--> statement-breakpoint
CREATE INDEX "fraud_flags_resolved_created_idx" ON "fraud_flags" USING btree ("resolved_at","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "promoter_waitlist_status_created_idx" ON "promoter_waitlist" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "social_accounts_promoter_idx" ON "social_accounts" USING btree ("promoter_id");--> statement-breakpoint
CREATE INDEX "verification_requests_status_updated_idx" ON "verification_requests" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "verification_requests_user_idx" ON "verification_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawal_status_created_idx" ON "withdrawals" USING btree ("status","created_at");