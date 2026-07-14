CREATE TABLE `benchmark_scoring_rules` (
	`benchmark_version` text NOT NULL,
	`session_variant` text NOT NULL,
	`prompt_id` text NOT NULL,
	`config` text NOT NULL,
	`max_score` integer NOT NULL,
	PRIMARY KEY(`benchmark_version`, `session_variant`, `prompt_id`)
);
--> statement-breakpoint
CREATE TABLE `submission_rate_limits` (
	`bucket_day` text NOT NULL,
	`ip_digest` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`bucket_day`, `ip_digest`)
);
--> statement-breakpoint
CREATE INDEX `submission_rate_limits_bucket_day_idx` ON `submission_rate_limits` (`bucket_day`);--> statement-breakpoint
ALTER TABLE `responses` ADD `regenerated` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `responses` ADD `response_seconds_bucket` text;--> statement-breakpoint
ALTER TABLE `responses` ADD `self_reported_reasoning_tokens` text;--> statement-breakpoint
ALTER TABLE `responses` ADD `reasoning_token_status` text DEFAULT 'missing' NOT NULL;--> statement-breakpoint
ALTER TABLE `responses` ADD `visible_token_estimate` integer;--> statement-breakpoint
ALTER TABLE `responses` ADD `visible_word_count` integer;--> statement-breakpoint
ALTER TABLE `responses` ADD `structure_flags` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `country` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `ui_language` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `platform` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `reasoning_toggle` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `vpn_used` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `memory_personalization` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `custom_instructions` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `prompts_translated` integer;--> statement-breakpoint
ALTER TABLE `submissions` ADD `completed_in_one_sitting` integer;--> statement-breakpoint
ALTER TABLE `submissions` ADD `session_variant` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `prompt_order` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `client_timezone` text;--> statement-breakpoint
CREATE INDEX `submissions_country_idx` ON `submissions` (`country`);