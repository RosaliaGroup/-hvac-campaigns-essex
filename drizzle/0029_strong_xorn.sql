ALTER TABLE `smsSends` ADD `deliveryStatus` enum('accepted','sent','delivered','delivery_failed','rejected','carrier_filtered');--> statement-breakpoint
ALTER TABLE `smsSends` ADD `deliveryErrorCode` varchar(16);--> statement-breakpoint
ALTER TABLE `smsSends` ADD `deliveryErrorMessage` varchar(500);--> statement-breakpoint
ALTER TABLE `smsSends` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `smsSends` ADD `deliveryUpdatedAt` timestamp;