CREATE TABLE `scheduledSends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`campaignId` int,
	`messageNum` int NOT NULL,
	`messageText` text NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`smsSendId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduledSends_id` PRIMARY KEY(`id`)
);
