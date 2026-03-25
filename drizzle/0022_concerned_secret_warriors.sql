CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollment_id` int NOT NULL,
	`user_id` int NOT NULL,
	`course_id` int NOT NULL,
	`certificate_number` varchar(100) NOT NULL,
	`student_name` varchar(255) NOT NULL,
	`course_title` varchar(255) NOT NULL,
	`certification_type` varchar(255) NOT NULL,
	`issue_date` timestamp NOT NULL DEFAULT (now()),
	`expiration_date` timestamp,
	`pdf_url` text,
	`verification_token` varchar(128) NOT NULL,
	`is_verified` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_certificate_number_unique` UNIQUE(`certificate_number`),
	CONSTRAINT `certificates_verification_token_unique` UNIQUE(`verification_token`)
);
--> statement-breakpoint
CREATE TABLE `courseEnrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`course_id` int NOT NULL,
	`enrollment_type` enum('one_time','subscription') NOT NULL,
	`stripe_payment_intent_id` varchar(255),
	`stripe_subscription_id` varchar(255),
	`status` enum('active','completed','cancelled','refunded') NOT NULL DEFAULT 'active',
	`progress_percentage` int NOT NULL DEFAULT 0,
	`lessons_completed` int NOT NULL DEFAULT 0,
	`exam_score` int,
	`exam_passed` boolean NOT NULL DEFAULT false,
	`certificate_issued` boolean NOT NULL DEFAULT false,
	`certificate_url` text,
	`certificate_issued_at` timestamp,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courseEnrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courseLessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`lesson_number` int NOT NULL,
	`duration_minutes` int NOT NULL,
	`video_url` text,
	`video_duration` int,
	`content_html` text,
	`learning_objectives` text,
	`materials_url` text,
	`is_locked` boolean NOT NULL DEFAULT false,
	`order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courseLessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`slug` varchar(255) NOT NULL,
	`category` varchar(100) NOT NULL,
	`difficulty` enum('beginner','intermediate','advanced') NOT NULL,
	`duration_hours` int NOT NULL,
	`price_per_course` int NOT NULL,
	`certification_type` varchar(255) NOT NULL,
	`instructor_name` varchar(255) NOT NULL,
	`instructor_bio` text,
	`instructor_image_url` text,
	`rating` decimal(3,1) DEFAULT '4.5',
	`students_enrolled` int DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`),
	CONSTRAINT `courses_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `quizAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollment_id` int NOT NULL,
	`course_id` int NOT NULL,
	`is_final_exam` boolean NOT NULL DEFAULT false,
	`score` int NOT NULL,
	`total_questions` int NOT NULL,
	`correct_answers` int NOT NULL,
	`passed` boolean NOT NULL DEFAULT false,
	`time_spent_seconds` int,
	`started_at` timestamp NOT NULL,
	`completed_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`question_text` text NOT NULL,
	`question_type` enum('multiple_choice','true_false','fill_in_blank') NOT NULL,
	`options` text,
	`correct_answer` text NOT NULL,
	`explanation` text,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`is_exam_question` boolean NOT NULL DEFAULT false,
	`order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attempt_id` int NOT NULL,
	`question_id` int NOT NULL,
	`student_answer` text NOT NULL,
	`is_correct` boolean NOT NULL,
	`time_spent_seconds` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studentProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollment_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`video_watched_seconds` int NOT NULL DEFAULT 0,
	`video_duration_seconds` int NOT NULL,
	`is_completed` boolean NOT NULL DEFAULT false,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studentProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptionPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`price_per_month` int NOT NULL,
	`max_courses` int NOT NULL,
	`stripe_price_id` varchar(255) NOT NULL,
	`features` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptionPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`plan_id` int NOT NULL,
	`stripe_subscription_id` varchar(255) NOT NULL,
	`status` enum('active','past_due','cancelled','paused') NOT NULL DEFAULT 'active',
	`current_period_start` timestamp NOT NULL,
	`current_period_end` timestamp NOT NULL,
	`cancelled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `userSubscriptions_stripe_subscription_id_unique` UNIQUE(`stripe_subscription_id`)
);
