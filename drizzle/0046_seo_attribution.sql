ALTER TABLE `leadCaptures` ADD `firstTouchLandingPath` varchar(512);--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `utmSource` varchar(255);--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `utmMedium` varchar(255);--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `utmCampaign` varchar(255);--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `utmTerm` varchar(255);--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `utmContent` varchar(255);--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `gclid` varchar(255);--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `referrerHost` varchar(255);--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `channel` enum('organic','paid','direct','referral','social','email','unknown') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `sourceLeadCaptureId` int;