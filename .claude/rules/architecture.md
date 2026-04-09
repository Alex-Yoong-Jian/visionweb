# Architecture

## Three-layer structure

```
Browser (index.html)
    ↓ HTTPS POST
Vercel Serverless Functions (/api/*.js)
    ↓
Supabase (PostgreSQL) + Anthropic Claude Haiku API
```

The browser never calls Supabase or Anthropic directly. All external calls are
proxied through Vercel functions which hold the API keys.

---

## Layer 1 — Browser (index.html)

One self-contained HTML file. No build step, no framework, no bundler.
All JS is vanilla ES6+ written as immediately-invoked module objects.

### 14 browser modules

| Module | Responsibility |
|---|---|
| `ScreenManager` | Shows/hides the 8 screens by toggling `.hidden` class |
| `ConsentManager` | PDPA consent screen — shown once per week via localStorage key |
| `SessionID` | Generates and persists a UUID in localStorage; sent with every scan |
| `DeviceInfo` | Parses UA string for browser/OS/type; requests brand+model via High Entropy API |
| `TickSound` | Web Audio API oscillator beep — fires only on `camera` and `result` screens |
| `Audio` | Web Speech API wrapper — bilingual sequential delivery (EN then MY) |
| `Camera` | `getUserMedia()` stream; captures single frame at trigger point |
| `HoldDetection` | 3.5s hold timer with SVG progress ring; 3s cooldown between scans |
| `Detector` | Sends frame to `/api/detect`; arms 20s `AbortController` timeout |
| `ResultBuilder` | Wraps Claude's noun phrase into natural EN and MY sentences |
| `ResultDisplay` | Renders mode badge, confidence, EN+MY text, scans remaining |
| `UnlockManager` | Sliding email unlock bar; calls `/api/unlock`; stores HMAC token |
| `ReportManager` | Report an Issue form; calls `/api/report`; returns via `App.showPrompt()` |
| `App` | Top-level state machine; coordinates all modules; exposes `showPrompt()` |

### 8 screens

`loading` → `consent` → `prompt` → `camera` → `result`
                                              → `limit` (HTTP 429)
                                              → `error`
                         ← `report` (back via `App.showPrompt()`)

---

## Layer 2 — Vercel Serverless Functions (/api/)

| File | Route | Responsibility |
|---|---|---|
| `api/detect.js` | `POST /api/detect` | SHA-256 hashes session UUID → Supabase scan check/increment → HMAC token verify → Claude Haiku call → returns `{mode, description, descriptionMY, score, scan_count}` |
| `api/unlock.js` | `POST /api/unlock` | Validates email format → `ilike` lookup in `allowed_emails` → returns HMAC-signed token |
| `api/report.js` | `POST /api/report` | Validates all fields server-side → inserts into `issue_reports` (pending migration) |

---

## Layer 3 — External Services

| Service | Purpose |
|---|---|
| **Supabase** | PostgreSQL database — scan sessions, authorised emails, issue reports |
| **Anthropic** | Claude Haiku (`claude-haiku-4-5-20251001`) — vision inference |

---

## Repo file map

```
vision-web/
├── index.html          ← entire frontend (v3.13.0)
├── vercel.json         ← security headers (CSP, X-Frame-Options, etc.)
├── api/
│   ├── detect.js       ← main scan endpoint
│   ├── unlock.js       ← email unlock endpoint
│   └── report.js       ← issue report endpoint
└── .claude/
    └── rules/          ← these memory files
```
