-- Additive contact enrichment cache. The profile service also creates this
-- table idempotently on first use, so deploys do not require a manual step.
CREATE TABLE IF NOT EXISTS crmContactProfiles (
  contactId int NOT NULL PRIMARY KEY,
  identity varchar(1000) NOT NULL,
  profile json NOT NULL,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
