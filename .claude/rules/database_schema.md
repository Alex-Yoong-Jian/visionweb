# Database Schema (Supabase)

**Provider:** Supabase (PostgreSQL)
**Timezone:** `Asia/Kuala_Lumpur` (set at database level via `ALTER DATABASE`)
**Access:** Service role key only (held in Vercel env vars). Anon key has zero access.
**RLS:** Enabled on all tables. No browser-side Supabase calls permitted.

---

## Live tables (currently in production)

### `scan_sessions`

Tracks scan usage per browser per week for rate limiting.
The `session_key` is a SHA-256 hash of the browser's localStorage UUID — the raw UUID
is never stored.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `session_key` | text | SHA-256 hash (first 32 chars) of browser UUID — unique per browser |
| `week_key` | text | ISO week identifier e.g. `2026-W14` — resets scan count each Monday |
| `scan_count` | integer | Number of scans this week; limit enforced at 10 |
| `browser` | text | Browser name + version e.g. `Chrome 120` |
| `os` | text | Operating system e.g. `Android`, `iOS`, `Windows` |
| `device_type` | text | `mobile` or `desktop` |
| `brand` | text | Device brand e.g. `Samsung` — from High Entropy API; null if unavailable |
| `model` | text | Device model e.g. `SM-S901B` — from High Entropy API; null if unavailable |
| `created_at` | timestamptz | First scan timestamp this week |
| `updated_at` | timestamptz | Most recent scan timestamp — auto-updated via trigger |

**Unique constraint:** `(session_key, week_key)` — one row per browser per week.

### `allowed_emails`

Stores email addresses authorised for unlimited scan access.
When a matching email is found by `/api/unlock`, an HMAC-signed token is returned
to the browser and stored in localStorage. The token is sent with every `/api/detect`
call to bypass the scan limit.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `email` | text | Authorised email — unique, looked up case-insensitively via `ilike` |
| `created_at` | timestamptz | Date email was added |

---

## Pending migration (not yet in production)

### `issue_reports` — defined in `03_add_device_tracking.sql`, not yet run

This table stores user-submitted issue reports from the Report an Issue screen.
The SQL migration must be run in the Supabase SQL Editor before `api/report.js`
will function in production.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `email` | text | Reporter's email — mandatory |
| `title` | text | Issue title — mandatory, max 50 chars (CHECK constraint) |
| `description` | text | Issue description — mandatory, max 500 chars (CHECK constraint) |
| `browser` | text | Auto-attached from DeviceInfo |
| `os` | text | Auto-attached |
| `device_type` | text | Auto-attached |
| `brand` | text | Auto-attached; null if unavailable |
| `model` | text | Auto-attached; null if unavailable |
| `created_at` | timestamptz | Submission timestamp |

---

## Environment variables (Vercel)

| Variable | Used by | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | `api/detect.js` | Claude Haiku API key |
| `SUPABASE_URL` | All 3 functions | Supabase project URL (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | All 3 functions | Service role key — bypasses RLS |
| `TOKEN_SECRET` | `api/detect.js`, `api/unlock.js` | Random 32+ char string for HMAC token signing |

---

## Week key format

Week keys follow ISO 8601 week numbering: `YYYY-WNN`
Example: `2026-W14` for the week of 30 March 2026.
Calculated in `api/detect.js` using UTC date arithmetic.
Scan counts reset automatically each new week — no manual intervention needed.
