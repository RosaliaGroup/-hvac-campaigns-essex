ALTER TABLE `customers` ADD `quickbooksRawDisplayName` varchar(512);--> statement-breakpoint
ALTER TABLE `customers` ADD `projectReference` varchar(120);--> statement-breakpoint
ALTER TABLE `customers` ADD `displayNameManuallyApproved` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `locationNotes` varchar(255);--> statement-breakpoint
ALTER TABLE `properties` ADD `projectReference` varchar(120);