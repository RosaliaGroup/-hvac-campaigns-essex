ALTER TABLE `takeoff_ve_suggestions` ADD `veType` varchar(30) DEFAULT 'substitution';--> statement-breakpoint
ALTER TABLE `takeoff_ve_suggestions` ADD `savingsPercent` decimal(5,1) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `takeoff_ve_suggestions` ADD `codeCompliant` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `takeoff_ve_suggestions` ADD `affectedItems` text;--> statement-breakpoint
ALTER TABLE `takeoff_ve_suggestions` ADD `implementationNotes` text;