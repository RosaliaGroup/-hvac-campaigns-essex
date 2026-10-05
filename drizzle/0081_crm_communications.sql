-- Unified CRM communications: Gmail + SMS/contact timeline.
-- Additive only. External adapters (ChatGPT/Gmail/Telnyx) can upsert contacts
-- and append messages without replacing the existing SMS inbox.
CREATE TABLE IF NOT EXISTS `crmExternalContacts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `customerId` int,
  `leadId` int,
  `leadCaptureId` int,
  `name` varchar(255) NOT NULL,
  `company` varchar(255),
  `title` varchar(255),
  `email` varchar(320),
  `phone` varchar(50),
  `propertyName` varchar(255),
  `source` varchar(100),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `crmExternalContacts_id` PRIMARY KEY(`id`),
  KEY `crmExternalContacts_email_idx` (`email`),
  KEY `crmExternalContacts_phone_idx` (`phone`),
  KEY `crmExternalContacts_customer_idx` (`customerId`),
  KEY `crmExternalContacts_lead_idx` (`leadId`)
);

CREATE TABLE IF NOT EXISTS `crmCommunications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `externalContactId` int,
  `customerId` int,
  `leadId` int,
  `channel` enum('email','sms','call') NOT NULL,
  `direction` enum('inbound','outbound') NOT NULL,
  `provider` varchar(30) NOT NULL,
  `providerMessageId` varchar(255),
  `providerThreadId` varchar(255),
  `fromAddress` varchar(320),
  `toAddress` varchar(320),
  `subject` varchar(500),
  `body` text,
  `status` varchar(50),
  `occurredAt` timestamp NOT NULL DEFAULT (now()),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `crmCommunications_id` PRIMARY KEY(`id`),
  UNIQUE KEY `crmCommunications_provider_message_uq` (`provider`,`providerMessageId`),
  KEY `crmCommunications_contact_idx` (`externalContactId`,`occurredAt`),
  KEY `crmCommunications_customer_idx` (`customerId`,`occurredAt`),
  KEY `crmCommunications_lead_idx` (`leadId`,`occurredAt`),
  KEY `crmCommunications_thread_idx` (`providerThreadId`)
);
