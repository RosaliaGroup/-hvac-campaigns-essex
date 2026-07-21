-- Rollback for 0063_appointment_assignment_events (additive migration; renumbered
-- from 0057 after rebase onto main — 0057-0059 are permanent journal gaps, 0062 is
-- reserved for the Opportunity board). drizzle-kit does not run down migrations;
-- this is the reviewed, tested reverse used for isolated-database apply→rollback
-- validation and emergency rollback. Purely reverses the additive change; only the
-- new audit table is removed. No existing table or column (including
-- appointments.assignedToId) is touched.
DROP TABLE IF EXISTS `appointmentAssignmentEvents`;
