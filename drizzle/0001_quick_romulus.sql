CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`contact` varchar(255) NOT NULL,
	`contactType` enum('phone','email') NOT NULL,
	`source` varchar(255) NOT NULL,
	`service` varchar(255) NOT NULL,
	`status` enum('new','contacted','quoted','won','lost') NOT NULL DEFAULT 'new',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
