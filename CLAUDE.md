# VisionWeb — Claude Code Memory

VisionWeb is an **accessibility-first web application** for visually impaired users.
It uses the device camera to identify objects and scenes, then delivers spoken bilingual
audio feedback in **English and Malay (Bahasa Malaysia)**. No app installation required —
runs entirely in the browser.

**Current app version:** v3.13.0
**Document version:** v1.1
**Stack:** Single HTML file → Vercel serverless functions → Supabase + Anthropic Claude Haiku

## Critical rules — never break these

1. **Every user-facing string must be bilingual** — English first, Malay second. No exceptions.
2. **API keys never touch the browser** — all Anthropic and Supabase calls go through Vercel serverless functions only.
3. **Audio cannot precede a user gesture on iOS** — never call `Audio.speak()` before a touch/click event on mobile-first screens.
4. **Image capture is capped at 800×600, JPEG 80%** — do not increase this. It exists to prevent iOS payload failures.

## Rule files (load for detail)

@.claude/rules/architecture.md
@.claude/rules/decisions_made.md
@.claude/rules/database_schema.md
@.claude/rules/security.md
@.claude/rules/ios_constraints.md
@.claude/rules/pending_work.md

## Key commands

```bash
# Deploy (Vercel auto-deploys on push)
git add -A && git commit -m "message" && git push

# No local build step — index.html is served as-is by Vercel
# Serverless functions live in /api/*.js — auto-detected by Vercel
```
