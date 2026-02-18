CREATE TABLE `aiVaAnalytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` timestamp NOT NULL,
	`callsInbound` int DEFAULT 0,
	`callsOutbound` int DEFAULT 0,
	`smsInbound` int DEFAULT 0,
	`smsOutbound` int DEFAULT 0,
	`socialPosts` int DEFAULT 0,
	`socialInteractions` int DEFAULT 0,
	`leadsGenerated` int DEFAULT 0,
	`leadsQualified` int DEFAULT 0,
	`hotLeads` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiVaAnalytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiVaCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service` varchar(50) NOT NULL,
	`credentialKey` varchar(100) NOT NULL,
	`credentialValue` text NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiVaCredentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `callLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`callId` varchar(255),
	`direction` enum('inbound','outbound') NOT NULL,
	`phoneNumber` varchar(20) NOT NULL,
	`duration` int,
	`status` varchar(50),
	`transcript` text,
	`recordingUrl` text,
	`leadId` int,
	`leadQuality` enum('hot','warm','cold'),
	`serviceType` varchar(255),
	`budget` varchar(100),
	`timeline` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `callLogs_id` PRIMARY KEY(`id`),
	CONSTRAINT `callLogs_callId_unique` UNIQUE(`callId`)
);
--> statement-breakpoint
CREATE TABLE `smsConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` varchar(255),
	`phoneNumber` varchar(20) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`message` text NOT NULL,
	`leadId` int,
	`status` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smsConversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `socialInteractions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` varchar(50) NOT NULL,
	`interactionType` enum('comment','message','review') NOT NULL,
	`postId` int,
	`externalId` varchar(255),
	`authorName` varchar(255),
	`content` text NOT NULL,
	`aiResponse` text,
	`respondedAt` timestamp,
	`leadId` int,
	`sentiment` enum('positive','neutral','negative'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `socialInteractions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `socialPosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` varchar(50) NOT NULL,
	`content` text NOT NULL,
	`mediaUrls` text,
	`contentType` varchar(50),
	`scheduledAt` timestamp,
	`postedAt` timestamp,
	`postId` varchar(255),
	`engagement` text,
	`status` enum('draft','scheduled','posted','failed') NOT NULL DEFAULT 'draft',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `socialPosts_id` PRIMARY KEY(`id`)
);
