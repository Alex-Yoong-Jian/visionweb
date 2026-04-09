# Pending Work

## Done — deployed to dev (v3.13.3)

- Consent button enabled immediately, no audio gate
- Consent audio fires on first gesture (mobile autoplay fix)
- Claude Haiku prompt rewritten — specific identification, `uncertain` mode at confidence < 0.6
- `uncertain` mode handled in ResultBuilder and ResultDisplay
- Device tracking columns added to `scan_sessions`, wired into detect.js INSERT
- `api/report.js` created — issue reports submit to Supabase `issue_reports` table
- `03_add_device_tracking.sql` migration run on test DB
- CSP meta tag removed — vercel.json header is authoritative
- Scan-again listener attached before audio (no hostage behaviour)
- Edge mobile consent button fix — startAudio guards against button tap target

---

## In progress — admin panel (in-app, protected screen)

**Goal:** Admin can view all submitted issue reports pulled from Supabase.
**Architecture:** Protected screen inside existing app (not a separate repo).
**Auth:** Secret PIN validated server-side against `ADMIN_PIN` env var.
**Access:** Tap version badge 3 times → PIN entry → admin screen shown.

**Features (phase 1):**
- List all issues: ID, email, title, created date, elapsed time, device info
- View full issue detail
- Rate limit: max 5 reports per browser per week (enforced in api/report.js)

**New files needed:**
- `api/admin.js` — fetches paginated issue list from Supabase (requires valid session token)
- `api/admin-auth.js` — validates PIN, returns signed session token
- `js/admin.js` — admin screen module
- New screen: `screen-admin` in index.html
- CSS for admin screen in styles.css

**New env vars needed:**
- `ADMIN_PIN` — secret PIN for admin access (set in Vercel for both Production and Preview)

---

## Immediate — needs production deploy

### Merge dev → main
All fixes in dev (v3.13.3) need to be merged to main and deployed to production
once testing is complete.

### Supabase migration — production DB
`03_add_device_tracking.sql` has only been run on the test DB.
Must be run on the production Supabase project before deploying to production.

---

## Deferred — requires custom domain ownership

### Custom domain
Both items below require owning a domain (e.g. visionweb.app, ~$10–15/year).
Decision: defer until app features are polished.

### Resend email notifications
When a user submits an issue report, send an admin notification email via Resend.
Requires verified sending domain in Resend.
- From: `noreply@yourdomain.com`
- To: admin's personal email
- New env var: `RESEND_API_KEY`, `ADMIN_EMAIL`

### Cloudflare DDoS + WAF protection
Put custom domain behind Cloudflare free tier for DDoS protection, WAF, bot filtering.
Steps documented — ready to execute once domain is purchased.

---

## Planned — not started

### Report rate limiting
Max 5 issue reports per browser per week.
Enforce in `api/report.js` by hashing sessionId and counting against `issue_reports`.
Requires `sessionId` to be sent from `js/report.js` with each submission.

### Real-time navigation / continuous scanning mode
Not started. Requires a hybrid on-device + Claude architecture.
WebXR and AR approaches are ruled out — not viable on iOS web.
