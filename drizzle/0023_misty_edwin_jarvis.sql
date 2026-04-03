CREATE TABLE `takeoff_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileSize` int,
	`pages` int,
	`analyzedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `takeoff_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `takeoff_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`type` varchar(20) DEFAULT 'info',
	`title` varchar(500),
	`body` text,
	`source` varchar(255),
	CONSTRAINT `takeoff_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `takeoff_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`category` varchar(50) NOT NULL,
	`description` text,
	`tag` varchar(100),
	`qty` decimal(12,2) DEFAULT '1',
	`unit` varchar(20) DEFAULT 'EA',
	`vendor` varchar(255),
	`model` varchar(255),
	`specs` text,
	`source` varchar(255),
	`confidence` int DEFAULT 0,
	`unitPrice` decimal(12,2) DEFAULT '0',
	`notes` text,
	CONSTRAINT `takeoff_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `takeoff_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`location` varchar(255),
	`discipline` varchar(100) DEFAULT 'HVAC',
	`status` enum('draft','complete') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdBy` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `takeoff_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `takeoff_ve_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`itemDescription` text,
	`currentSpec` text,
	`alternativeSpec` text,
	`vendor` varchar(255),
	`model` varchar(255),
	`estimatedSavings` decimal(12,2) DEFAULT '0',
	`tradeOffs` text,
	`status` enum('pending','applied','rejected') NOT NULL DEFAULT 'pending',
	CONSTRAINT `takeoff_ve_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leadCaptures` MODIFY COLUMN `captureType` enum('exit_popup','inline_form','newsletter','download_gate','quick_quote','qualify_form','scroll_popup_residential','scroll_popup_commercial','exit_popup_residential','exit_popup_commercial','lp_heat_pump','lp_commercial_vrv','lp_emergency','lp_fb_residential','lp_fb_commercial','lp_rebate_guide','lp_maintenance','lp_referral_partner','lp_maintenance_subscription','career_application','partnership_inquiry') NOT NULL;