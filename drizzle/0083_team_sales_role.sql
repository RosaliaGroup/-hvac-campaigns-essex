-- Additive: adds the "sales" value to teamMembers.role (appended at the end, so
-- existing rows and values are untouched). Apply manually following
-- drizzle/README.md after a verified backup.
--
-- Sales role = client-facing CRM access only: leads, contacts, appointments,
-- notes and lead status. No financials, marketing, ads, analytics, AI settings
-- or administration (enforced server-side: shared/salesAccess.ts + server/_core/trpc.ts).
--
-- Rollback: first move any sales rows to the most restrictive existing role and
-- suspend them (never to 'member' — that would WIDEN their access), then narrow:
--   UPDATE teamMembers SET role = 'viewer', status = 'suspended' WHERE role = 'sales';
--   ALTER TABLE `teamMembers` MODIFY COLUMN `role` enum('admin','member','viewer') NOT NULL DEFAULT 'member';
ALTER TABLE `teamMembers` MODIFY COLUMN `role` enum('admin','member','viewer','sales') NOT NULL DEFAULT 'member';

-- Click-to-call (recorded calls placed from the CRM): which lead and which rep.
-- Both nullable; existing call logs are untouched.
ALTER TABLE `callLogs` ADD COLUMN `leadCaptureId` int NULL;
ALTER TABLE `callLogs` ADD COLUMN `agentTeamMemberId` int NULL;
-- Rollback: ALTER TABLE `callLogs` DROP COLUMN `agentTeamMemberId`, DROP COLUMN `leadCaptureId`;
