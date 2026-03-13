ALTER TABLE `rebateCalculations` ADD `solarInterest` enum('yes','no','maybe');--> statement-breakpoint
ALTER TABLE `rebateCalculations` ADD `preferredContact` enum('call','text','email');