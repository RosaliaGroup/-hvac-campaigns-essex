# Nightly logical backup of the production CRM database to a Railway storage bucket.
# Runs as a Railway cron service in the separate "ME Database Backups" project (see README.md).
# Same MySQL major version as production (mysql:9) so mysqldump matches the server.
FROM mysql:9
RUN microdnf install -y gzip curl findutils && microdnf clean all
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
# The mysql image's entrypoint starts a server; we only want the client tools.
ENTRYPOINT []
CMD ["/usr/local/bin/backup.sh"]
