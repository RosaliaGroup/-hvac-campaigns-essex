CREATE TABLE `personalizedVideos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`heygenVideoId` varchar(128) NOT NULL,
	`topic` enum('rebates','financing','solar','assessment') NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`videoUrl` text,
	`thumbnailUrl` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `personalizedVideos_id` PRIMARY KEY(`id`)
);
