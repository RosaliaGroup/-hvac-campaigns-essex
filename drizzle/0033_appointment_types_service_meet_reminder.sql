ALTER TABLE `appointments` MODIFY COLUMN `appointmentType` enum('assessment','estimate','service_call','installation','maintenance','warranty','follow_up','inspection','sales_visit','other','free_consultation','technician_dispatch','maintenance_plan','commercial_assessment') NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `serviceType` varchar(100);--> statement-breakpoint
ALTER TABLE `appointments` ADD `reminderMinutes` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `googleMeetRequested` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `googleMeetUrl` varchar(512);