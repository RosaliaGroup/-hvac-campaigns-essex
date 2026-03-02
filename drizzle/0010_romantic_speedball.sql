ALTER TABLE `leadCaptures` MODIFY COLUMN `captureType` enum('exit_popup','inline_form','newsletter','download_gate','quick_quote','scroll_popup_residential','scroll_popup_commercial','exit_popup_residential','exit_popup_commercial','lp_heat_pump','lp_commercial_vrv','lp_emergency','lp_fb_residential','lp_fb_commercial','lp_rebate_guide','lp_maintenance') NOT NULL;--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `status` enum('new','contacted','qualified','booked','lost') DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `assignedTo` varchar(255);--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `followUpAt` timestamp;--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;