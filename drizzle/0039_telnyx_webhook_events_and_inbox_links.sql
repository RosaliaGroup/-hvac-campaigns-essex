CREATE TABLE `smsWebhookEvents` (
	`eventId` varchar(255) NOT NULL,
	`eventType` varchar(100),
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smsWebhookEvents_eventId` PRIMARY KEY(`eventId`)
);
--> statement-breakpoint
ALTER TABLE `smsInboxMessages` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `smsInboxMessages` ADD `leadId` int;--> statement-breakpoint
ALTER TABLE `smsInboxMessages` ADD `providerMessageId` varchar(255);