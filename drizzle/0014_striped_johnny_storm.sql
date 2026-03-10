CREATE TABLE `smsCampaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`message1` text NOT NULL,
	`message2` text NOT NULL,
	`message3` text NOT NULL,
	`status` enum('draft','active','paused','completed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smsCampaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smsContacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(255) NOT NULL,
	`lastName` varchar(255),
	`phone` varchar(50) NOT NULL,
	`email` varchar(320),
	`zip` varchar(20),
	`segment` enum('A','B','C') NOT NULL DEFAULT 'A',
	`leadStatus` varchar(100),
	`smsTag` varchar(255),
	`optedOut` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smsContacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smsSends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`campaignId` int,
	`messageNum` int NOT NULL,
	`messageText` text NOT NULL,
	`phone` varchar(50) NOT NULL,
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
	`textBeltId` varchar(255),
	`errorMessage` text,
	`quotaRemaining` int,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smsSends_id` PRIMARY KEY(`id`)
);
