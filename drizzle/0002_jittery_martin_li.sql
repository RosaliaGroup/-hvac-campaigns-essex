CREATE TABLE `leadCaptures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`name` varchar(255),
	`captureType` enum('exit_popup','inline_form','newsletter','download_gate','quick_quote') NOT NULL,
	`pageUrl` varchar(500),
	`message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadCaptures_id` PRIMARY KEY(`id`)
);
