-- Additive; apply manually following drizzle/README.md after verified backup.
CREATE TABLE IF NOT EXISTS prospectWorkflowSettings (
 id INT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT FALSE, ownerId INT NULL,
 sendHour VARCHAR(32) NULL, sentThisHour INT NOT NULL DEFAULT 0,
 lastHour VARCHAR(32) NULL, lastRunAt TIMESTAMP NULL, lastError TEXT NULL
);
INSERT IGNORE INTO prospectWorkflowSettings (id, enabled) VALUES (1, FALSE);
CREATE TABLE IF NOT EXISTS prospectWorkflowQueue (
 id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(320) NOT NULL,
 name VARCHAR(255) NOT NULL, company VARCHAR(255) NOT NULL, title VARCHAR(255) NOT NULL,
 verificationUrl TEXT NOT NULL, evidence TEXT NOT NULL, phone VARCHAR(50) NULL,
 smsConsent BOOLEAN NOT NULL DEFAULT FALSE, consentEvidence TEXT NULL,
 externalContactId INT NULL, leadId INT NULL, ownerId INT NOT NULL,
 state VARCHAR(32) NOT NULL DEFAULT 'queued', emailBody TEXT NOT NULL,
 emailMessageId VARCHAR(255) NULL, threadId VARCHAR(255) NULL,
 smsState VARCHAR(32) NOT NULL DEFAULT 'consent_required', nextTouchAt TIMESTAMP NULL,
 touchCount INT NOT NULL DEFAULT 0, followUpAt TIMESTAMP NULL, followUpDoneAt TIMESTAMP NULL,
 notifiedAt TIMESTAMP NULL, lastError TEXT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY prospectWorkflowQueue_email_uq (email), KEY prospectWorkflowQueue_due_idx (state,nextTouchAt)
);
