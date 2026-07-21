-- Rollback for 0057_appointment_assignment_events (additive migration).
-- drizzle-kit does not run down migrations; this is the reviewed, tested reverse
-- used for isolated-database apply→rollback validation and emergency rollback.
-- Purely reverses the additive change; only the new audit table is removed. No
-- existing table or column (including appointments.assignedToId) is touched.
DROP TABLE IF EXISTS `appointmentAssignmentEvents`;
