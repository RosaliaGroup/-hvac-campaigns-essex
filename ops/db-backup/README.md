# Nightly database backups

Runs in its own Railway project, **ME Database Backups**, so backups are not limited by
the production MySQL service's 10-volume-backup plan limit and live apart from production.

- Every night at 3:17 AM ET it dumps the production CRM database (`mysqldump`, same MySQL
  major version), checks the dump (valid gzip, completed, table count, size), uploads it to the
  project's storage bucket as `mysql/<db>-<UTC time>.sql.gz`, confirms the upload size, and
  deletes copies older than `KEEP_DAYS` (default 30).
- A failed run shows as a failed cron run in Railway.

## Restore
1. Download the file you want from the bucket (Railway → ME Database Backups → bucket).
2. Restore into a **scratch** database first and check it:
   `zcat railway-<time>.sql.gz | mysql -h <scratch host> -P <port> -u <user> -p`
   The dump includes `CREATE DATABASE`/`USE` for the original name, so restore into a scratch
   server, not the production one. Follow drizzle/README.md before touching production.

## Variables
`DATABASE_URL` is production MySQL's `MYSQL_PUBLIC_URL` (pasted by the owner — it holds the
password). The `S3_*` variables reference the bucket in the same project. `KEEP_DAYS` is optional.
