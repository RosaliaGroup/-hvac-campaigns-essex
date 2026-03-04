CREATE TABLE `teamMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255) NOT NULL,
	`passwordHash` text,
	`role` enum('admin','member','viewer') NOT NULL DEFAULT 'member',
	`status` enum('invited','active','suspended') NOT NULL DEFAULT 'invited',
	`inviteToken` varchar(128),
	`inviteExpiresAt` timestamp,
	`resetToken` varchar(128),
	`resetExpiresAt` timestamp,
	`invitedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp,
	CONSTRAINT `teamMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `teamMembers_email_unique` UNIQUE(`email`)
);
