ALTER TABLE `teamMembers` ADD `firstName` varchar(120);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `lastName` varchar(120);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `mobilePhone` varchar(32);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `streetAddress` varchar(255);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `city` varchar(120);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `state` varchar(2);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `zipCode` varchar(10);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `emergencyContactName` varchar(255);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `emergencyContactRelationship` varchar(120);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `emergencyContactPhone` varchar(32);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `preferredContactMethod` enum('phone','text','email');--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `preferredLanguage` varchar(64);--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `profilePhoto` mediumtext;