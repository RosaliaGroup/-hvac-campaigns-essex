ALTER TABLE `quickbooksSalesDocuments` MODIFY COLUMN `status` enum('pending','accepted','closed','rejected','expired','paid','partial','unpaid','void') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `quickbooksConnections` ADD `invoiceCursor` timestamp;--> statement-breakpoint
ALTER TABLE `quickbooksConnections` ADD `invoiceLastSyncAt` timestamp;--> statement-breakpoint
ALTER TABLE `quickbooksSalesDocuments` ADD `dueDate` timestamp;--> statement-breakpoint
ALTER TABLE `quickbooksSalesDocuments` ADD `balance` decimal(12,2);--> statement-breakpoint
ALTER TABLE `quickbooksSalesDocuments` ADD `currency` varchar(8);--> statement-breakpoint
ALTER TABLE `quickbooksSalesDocuments` ADD `quickbooksParentRef` varchar(64);--> statement-breakpoint
ALTER TABLE `quickbooksSalesDocuments` ADD `voided` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `qbSalesDocs_docType_idx` ON `quickbooksSalesDocuments` (`docType`);--> statement-breakpoint
CREATE INDEX `qbSalesDocs_parentRef_idx` ON `quickbooksSalesDocuments` (`quickbooksParentRef`);