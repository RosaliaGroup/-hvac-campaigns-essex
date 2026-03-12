CREATE TABLE `smsInboxMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int,
	`phone` varchar(50) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`message` text NOT NULL,
	`isOptOut` boolean NOT NULL DEFAULT false,
	`isRead` boolean NOT NULL DEFAULT false,
	`sentByName` varchar(255),
	`textBeltId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smsInboxMessages_id` PRIMARY KEY(`id`)
);
