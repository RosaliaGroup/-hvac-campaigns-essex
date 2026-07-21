CREATE TABLE `appointmentAssignmentEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`fromAssigneeId` int,
	`toAssigneeId` int,
	`action` enum('assign','reassign','unassign') NOT NULL,
	`changedById` int,
	`changedByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointmentAssignmentEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `appointmentAssignmentEvents_appointmentId_idx` ON `appointmentAssignmentEvents` (`appointmentId`);