# Pending Work

## Immediate — fixes done in index.html, needs deployment

### Consent button unlock
**Status:** Done in `index.html`, pushed to GitHub.
The consent Accept button is now enabled immediately on screen show. Audio plays
on first tap anywhere on the consent screen (browser gesture requirement). Users
no longer need to wait for audio to finish before tapping Accept.

### Consent audio fix
**Status:** Done in `index.html`, pushed to GitHub.
Audio on the consent screen now fires inside a `touchstart`/`click` listener
on the screen element rather than on screen initialisation. This resolves the
silent failure caused by mobile browser autoplay restrictions.

---

## Immediate — pending deployment to production

### Git push v3.13.0
Run:
```bash
git add index.html api/detect.js api/report.js
git commit -m "v3.13.0 — consent screen, device tracking, report an issue, iOS fixes"
git push
```

### Supabase migration — `03_add_device_tracking.sql`
This migration must be run in the Supabase SQL Editor **before** deploying v3.13.0.
It adds the `browser`, `os`, `device_type`, `brand`, `model` columns to `scan_sessions`
and creates the `issue_reports` table. Without this, `api/detect.js` and `api/report.js`
will fail on device tracking column writes.

---

## Immediate — code fix still needed

### Claude Haiku hallucination — prompt rewrite in `api/detect.js`
**Status:** Identified, not yet implemented.
Claude Haiku sometimes misidentifies niche objects (e.g. gym gripper identified as
skipping rope). Root causes: vague prompt language, no uncertainty path, image
compression degrading fine detail.

**Fix required in `api/detect.js` system prompt:**
- Replace "describe" with "identify as specifically as possible"
- Add `"uncertain"` as a third valid mode (when confidence < 0.6)
- Instruct Claude to prefer specific names over vague categories
- Remove the "noun phrase" instruction — ask for specific identification instead

**Fix required in `index.html` (`App.onHoldComplete`):**
- Handle `mode === 'uncertain'` response
- Speak: `'I can see an object but I'm not certain what it is. Please try again from a different angle.'`

---

## Planned — not started

### Admin panel (`visionweb-admin.vercel.app`)
A separate Vercel project for managing VisionWeb data.

**Architecture decided:**
- Separate repo: `visionweb-admin`
- Auth: Supabase Auth (email invite flow) — not custom auth
- Features: view issue reports, update status, delete, export CSV; manage allowed_emails
- Email delivery for invites: Resend (resend.com, free tier 3,000/month)

**New env vars needed for admin project:**
- `JWT_SECRET`
- `RESEND_API_KEY`
- `ADMIN_FROM_EMAIL`

**Zero impact on existing VisionWeb public app** — reads same Supabase database,
no shared code.

---

## Under evaluation

### Real-time navigation / continuous scanning mode
Not started. Requires a hybrid on-device + Claude architecture.
WebXR and AR approaches are ruled out — not viable on iOS web.
