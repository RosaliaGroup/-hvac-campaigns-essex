#!/bin/bash
# Dumps the production database, checks the dump, uploads it to the bucket, prunes old copies.
# Exits non-zero on any failure so Railway marks the cron run as failed.
#
# Required variables (set on the Railway service):
#   DATABASE_URL       mysql://user:pass@host:port/db  (production MySQL's MYSQL_PUBLIC_URL; pasted by the owner)
#   S3_ENDPOINT        ${{Bucket.ENDPOINT}}
#   S3_BUCKET          ${{Bucket.BUCKET}}
#   S3_REGION          ${{Bucket.REGION}}
#   S3_ACCESS_KEY_ID   ${{Bucket.ACCESS_KEY_ID}}
#   S3_SECRET_ACCESS_KEY ${{Bucket.SECRET_ACCESS_KEY}}
# Optional:
#   KEEP_DAYS          days of backups to keep (default 30)
set -euo pipefail

log() { echo "[db-backup] $*"; }
fail() { echo "[db-backup] FAILED: $*" >&2; exit 1; }

for v in DATABASE_URL S3_ENDPOINT S3_BUCKET S3_REGION S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do
  [ -n "${!v:-}" ] || fail "$v is not set"
done
KEEP_DAYS="${KEEP_DAYS:-30}"

# Parse mysql://user:pass@host:port/db (password may contain anything but '@' handling is last-@ based).
url="${DATABASE_URL#mysql://}"
creds="${url%@*}"
hostpart="${url##*@}"
DB_USER="${creds%%:*}"
DB_PASS="${creds#*:}"
hostport="${hostpart%%/*}"
DB_NAME="${hostpart#*/}"; DB_NAME="${DB_NAME%%\?*}"
DB_HOST="${hostport%%:*}"
DB_PORT="${hostport##*:}"; [ "$DB_PORT" = "$DB_HOST" ] && DB_PORT=3306
[ -n "$DB_NAME" ] || fail "DATABASE_URL has no database name"

ts="$(date -u +%Y-%m-%dT%H%MZ)"
key="mysql/${DB_NAME}-${ts}.sql.gz"
file="/tmp/${DB_NAME}-${ts}.sql.gz"

# Password via env for the client, never on the command line.
export MYSQL_PWD="$DB_PASS"
log "dumping ${DB_NAME} from ${DB_HOST}:${DB_PORT}"
mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --single-transaction --quick --routines --triggers --events \
  --set-gtid-purged=OFF --no-tablespaces --databases "$DB_NAME" \
  | gzip -6 > "$file"
unset MYSQL_PWD

# Verify: valid gzip, ends with mysqldump's completion line, has tables, not tiny.
gzip -t "$file" || fail "gzip check failed"
zcat "$file" | tail -n 1 | grep -q "Dump completed" || fail "dump did not complete"
tables="$(zcat "$file" | grep -c '^CREATE TABLE' || true)"
bytes="$(stat -c %s "$file")"
[ "$tables" -ge 20 ] || fail "only ${tables} tables in dump"
[ "$bytes" -ge 100000 ] || fail "dump is only ${bytes} bytes"
log "dump ok: ${tables} tables, ${bytes} bytes compressed"

endpoint="${S3_ENDPOINT%/}"
sig=(--aws-sigv4 "aws:amz:${S3_REGION}:s3" --user "${S3_ACCESS_KEY_ID}:${S3_SECRET_ACCESS_KEY}")

curl -sS --fail-with-body "${sig[@]}" -H "Content-Type: application/gzip" \
  -T "$file" "${endpoint}/${S3_BUCKET}/${key}" >/dev/null || fail "upload failed"
log "uploaded ${key}"

# Confirm the uploaded object's size matches.
remote="$(curl -sS --fail -I "${sig[@]}" "${endpoint}/${S3_BUCKET}/${key}" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-length"{print $2}')"
[ "$remote" = "$bytes" ] || fail "uploaded size ${remote} != local ${bytes}"
rm -f "$file"

# Prune backups older than KEEP_DAYS (keys carry the date, so compare names).
cutoff="$(date -u -d "-${KEEP_DAYS} days" +%Y-%m-%d)"
listing="$(curl -sS --fail "${sig[@]}" "${endpoint}/${S3_BUCKET}?list-type=2&prefix=mysql/")"
deleted=0
for k in $(echo "$listing" | grep -o '<Key>[^<]*</Key>' | sed 's/<[^>]*>//g'); do
  d="$(echo "$k" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || true)"
  if [ -n "$d" ] && [[ "$d" < "$cutoff" ]]; then
    curl -sS --fail -X DELETE "${sig[@]}" "${endpoint}/${S3_BUCKET}/${k}" >/dev/null && deleted=$((deleted+1))
  fi
done
total="$(echo "$listing" | grep -o '<Key>' | wc -l)"
log "done: ${total} backup(s) in bucket before pruning, ${deleted} older than ${KEEP_DAYS} days removed"
