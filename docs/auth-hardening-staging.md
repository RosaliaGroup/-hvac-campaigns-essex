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

(There is **no** `TRUSTED_PROXY_HOPS` variable — the client IP is derived from Railway's `X-Real-IP`, see below.)

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
```

## Proxy / client-IP model (VERIFIED on Railway, 2026-07-24)

Railway's edge is a **rewriting** proxy, not an appending one. Verified live via
an echo service on an isolated temp environment (real client `24.185.130.70`):

| Injected by client | What the app received |
|---|---|
| _(nothing)_ | `X-Forwarded-For: 24.185.130.70, 152.233.30.104` · `X-Real-IP: 24.185.130.70` |
| `X-Forwarded-For: 1.2.3.4` | `X-Forwarded-For: 24.185.130.70, 152.233.40.2` (spoof **dropped**) |
| `X-Forwarded-For: 1.1.1.1, 2.2.2.2, 3.3.3.3` | `X-Forwarded-For: 24.185.130.70, …` (all spoofs **dropped**) |
| `X-Real-IP: 9.9.9.9` | `X-Real-IP: 24.185.130.70` (spoof **overwritten**) |
| `Forwarded: for=6.6.6.6` | passed through **unsanitized** |

Conclusions baked into `getTrustedClientIp`:
- The real client is **`X-Real-IP`** (Railway sets it and overwrites spoofs) — used first.
- In XFF, the real client is the **LEFTMOST** entry; the **rightmost** is Railway's
  own edge hop (`152.233.x.x`, shared across users). Keying on the rightmost would
  bucket everyone together — a global-lockout DoS. Used as the fallback: leftmost XFF.
- `Forwarded` is client-controllable and is **never** trusted.

Because Railway overwrites both `X-Real-IP` and `X-Forwarded-For`, a client cannot
forge the value the limiter keys on in production. (Locally / off-Railway there is
no trusted edge, so these headers are not trustworthy — the limiter is a
production control.)

### Re-confirming on staging (one time)

```bash
# Send a garbage cookie + spoofed headers to a PROTECTED endpoint (safe: 401, no data):
curl -s -H 'X-Real-IP: 9.9.9.9' -H 'X-Forwarded-For: 1.2.3.4' \
     -H 'Cookie: app_session_id=garbage' \
     'https://<staging-host>/api/trpc/customers.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D'
# Read staging logs, find the [Auth] invalid_token line; its "ip" must be YOUR real
# public IP, NOT 9.9.9.9 / 1.2.3.4. If it shows a spoof, do not ship.
```
