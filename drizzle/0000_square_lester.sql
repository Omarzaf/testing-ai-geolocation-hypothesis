CREATE TABLE `benchmark_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` text NOT NULL,
	`clarity_rating` integer NOT NULL,
	`confusing_prompt_id` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`response_text` text NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `responses_submission_idx` ON `responses` (`submission_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`city` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`access_type` text NOT NULL,
	`plan_label` text NOT NULL,
	`benchmark_version` text NOT NULL,
	`answer_hash` text NOT NULL,
	`quality_status` text DEFAULT 'eligible' NOT NULL,
	`overall_score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`submitted_day` text DEFAULT (DATE('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submissions_city_idx` ON `submissions` (`city`);--> statement-breakpoint
CREATE INDEX `submissions_model_idx` ON `submissions` (`provider`,`model`);--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_answer_hash_idx` ON `submissions` (`answer_hash`);