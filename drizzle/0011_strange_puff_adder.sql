CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`phone` varchar(50) NOT NULL,
	`email` varchar(320),
	`propertyAddress` text,
	`propertyType` enum('residential','commercial') DEFAULT 'residential',
	`appointmentType` enum('free_consultation','technician_dispatch','maintenance_plan','commercial_assessment') NOT NULL,
	`preferredDate` varchar(100) NOT NULL,
	`preferredTime` varchar(100) NOT NULL,
	`issueDescription` text,
	`status` enum('pending','confirmed','completed','cancelled','rescheduled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`vapiCallId` varchar(255),
	`bookedBy` varchar(100) DEFAULT 'jessica',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
