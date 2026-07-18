CREATE TABLE `jobAttachmentBlobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attachmentId` int NOT NULL,
	`data` mediumtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobAttachmentBlobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobAttachmentBlobs_attachmentId_unique` UNIQUE(`attachmentId`)
);
--> statement-breakpoint
ALTER TABLE `jobAttachments` MODIFY COLUMN `url` varchar(1024);--> statement-breakpoint
ALTER TABLE `jobAttachments` ADD `category` enum('before','during','after','general') DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobAttachments` ADD `noteId` int;--> statement-breakpoint
ALTER TABLE `jobNotes` ADD `attachmentId` int;--> statement-breakpoint
ALTER TABLE `jobNotes` ADD `edited` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `jobNotes` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
CREATE INDEX `jobAttachmentBlobs_attachmentId_idx` ON `jobAttachmentBlobs` (`attachmentId`);