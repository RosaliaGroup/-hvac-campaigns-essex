-- Rollback for 0071. Devices simply re-subscribe next time they open Settings.
DROP TABLE `pushSubscriptions`;
