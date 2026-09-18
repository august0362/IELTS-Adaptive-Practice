CREATE TABLE `question_types` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`base_ratio` real DEFAULT 1 NOT NULL,
	`occurrence_count` integer DEFAULT 0 NOT NULL,
	`last_appeared_at` integer,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_types_code_unique` ON `question_types` (`code`);--> statement-breakpoint
CREATE TABLE `roll_result_question_types` (
	`id` text PRIMARY KEY NOT NULL,
	`roll_result_id` text NOT NULL,
	`question_type_id` text NOT NULL,
	FOREIGN KEY (`roll_result_id`) REFERENCES `roll_results`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_type_id`) REFERENCES `question_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `roll_sessions` ADD `source` text DEFAULT 'roll' NOT NULL;--> statement-breakpoint
ALTER TABLE `skill_parts` ADD `question_type_roll_count` integer DEFAULT 0 NOT NULL;