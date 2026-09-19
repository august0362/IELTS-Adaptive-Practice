CREATE TABLE `cambridge_test_results` (
	`id` text PRIMARY KEY NOT NULL,
	`test_date` integer NOT NULL,
	`test_name` text NOT NULL,
	`reading_band` real NOT NULL,
	`listening_band` real NOT NULL,
	`writing_band` real NOT NULL,
	`speaking_band` real NOT NULL,
	`overall_band` real NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `config` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `config_key_unique` ON `config` (`key`);--> statement-breakpoint
CREATE TABLE `daily_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`note_date` integer NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roll_results` (
	`id` text PRIMARY KEY NOT NULL,
	`roll_session_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`skill_part_id` text NOT NULL,
	FOREIGN KEY (`roll_session_id`) REFERENCES `roll_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`skill_part_id`) REFERENCES `skill_parts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `roll_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`rolled_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`base_ratio` real DEFAULT 0.5 NOT NULL,
	`occurrence_count` integer DEFAULT 0 NOT NULL,
	`last_appeared_at` integer,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_parts_code_unique` ON `skill_parts` (`code`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`occurrence_count` integer DEFAULT 0 NOT NULL,
	`last_appeared_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_code_unique` ON `skills` (`code`);