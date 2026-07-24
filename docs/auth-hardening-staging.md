# Auth Hardening — staging env overrides & validation

The staff/OAuth session hardening (8h session, 30m idle, 30d remember-device,
login rate limiting) ships with **production defaults baked in**. Every duration
is also overridable via an environment variable so **staging** can exercise
expiry behavior in minutes. Production leaves these vars **unset** and gets the
defaults — setting them is a staging-only convenience.

## Overridable variables

| Env var | Default (prod) | Safe maximum | What it controls | Suggested staging value |
|---|---|---|---|---|
| `SESSION_TTL_MS` | `28800000` (8h) | `86400000` (24h) | Absolute cap for a standard (unchecked) login | `300000` (5 min) |
| `REMEMBER_ME_TTL_MS` | `2592000000` (30d) | `2592000000` (30d) | Absolute cap when "Remember this device" is checked | `600000` (10 min) |
| `IDLE_TIMEOUT_MS` | `1800000` (30m) | `SESSION_TTL_MS` | Inactivity window (sliding; reset by each authenticated request) | `120000` (2 min) |
| `JWT_CLOCK_SKEW_SECONDS` | `30` | `120` | Allowed signer/verifier clock skew | `30` |
| `LOGIN_RATELIMIT_MAX` | `5` | `1000` | Failed logins allowed per (account, trusted-IP) | `3` |
| `LOGIN_RATELIMIT_WINDOW_MS` | `900000` (15m) | `86400000` (24h) | Lockout window for the above | `120000` (2 min) |
| `TRUSTED_PROXY_HOPS` | `1` | `4` | Trusted proxy hops from the right of `X-Forwarded-For` | `1` (Railway) |

Rules (fail-safe, never blocks startup):
- unset / empty / non-numeric / zero / negative → the built-in **default**;
- a value **above the safe maximum** → **clamped down** to the maximum, with a
  `[Auth][config]` warning (naming only the variable and the bound — no values);
- `IDLE_TIMEOUT_MS` is additionally capped at the standard absolute session
  lifetime, so an idle window can never outlast the session it belongs to.

Values are read **once at process start** — set them before the service boots
(redeploy/restart to apply). Set them **only** on staging, never on production.

## Example: shorten everything on staging

```
SESSION_TTL_MS=300000            # 5 min standard session
REMEMBER_ME_TTL_MS=1200000       # 20 min remember-me
IDLE_TIMEOUT_MS=120000           # 2 min idle
JWT_CLOCK_SKEW_SECONDS=30
LOGIN_RATELIMIT_MAX=3
LOGIN_RATELIMIT_WINDOW_MS=120000 # 2 min lockout window
TRUSTED_PROXY_HOPS=1
```

## Proxy / client-IP model (why spoofing is defeated)

`X-Forwarded-For` is built left→right as a request crosses proxies: a client can
**prepend** arbitrary fake entries, so the **leftmost** values are attacker
controlled. Each trusted proxy **appends** the real peer it saw, so the
**rightmost** entries are trustworthy. Railway's edge is one trusted hop, so the
real client IP is the **last** XFF entry. Login rate limiting keys on
`getTrustedClientIp`, which reads the entry `TRUSTED_PROXY_HOPS` from the right
(default 1) and ignores everything to its left — mirroring Express
`trust proxy = 1`.

- Increase `TRUSTED_PROXY_HOPS` only if you place another trusted proxy in front
  of Railway (e.g. Cloudflare); otherwise a client could spoof the extra hop.
- Never key a security decision on the generic `getClientIp` (leftmost hop).

### Confirming Railway's hop count on staging (one time)

After the branch is on staging, verify the real client IP lands where expected:

```bash
# From a machine with a known public IP, send a spoofed leftmost XFF and a
# garbage session cookie to a PROTECTED endpoint (safe: returns 401, no data):
curl -s -H 'X-Forwarded-For: 1.2.3.4' \
     -H 'Cookie: app_session_id=garbage' \
     'https://<staging-host>/api/trpc/customers.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D'
# Then read staging logs and find the [Auth] invalid_token line; its "ip" must be
# YOUR real public IP, NOT 1.2.3.4. If it shows 1.2.3.4, the spoof won — raise
# TRUSTED_PROXY_HOPS or fix the derivation before production.
```
