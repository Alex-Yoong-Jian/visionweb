# Security Architecture

## Core principle

**The browser holds no secrets.** Every API key, database credential, and signing secret
lives exclusively in Vercel environment variables and is only accessible within
serverless functions. Nothing sensitive is ever in `index.html` or any client-side code.

---

## Security controls

### API key isolation
`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_KEY`, and `TOKEN_SECRET` are Vercel env vars.
Never hardcode these. Never log them. Never expose them in responses.

### Serverless proxy pattern
The browser calls only three endpoints — `/api/detect`, `/api/unlock`, `/api/report`.
These functions authenticate outbound requests to Anthropic and Supabase.
The browser has no direct access to either external service.

### SHA-256 session hashing
Before any localStorage UUID is stored in Supabase, it is hashed:
```js
crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 32)
```
Raw UUIDs are never written to the database.

### HMAC token signing
Unlock tokens have the format: `base64(email) + '.' + HMAC-SHA256(email:unlimited, TOKEN_SECRET)`
Verified server-side in `api/detect.js` on every scan request.
If `TOKEN_SECRET` is rotated, all existing tokens become invalid — users re-verify email.

### UUID format validation
`api/detect.js` validates the `sessionId` field matches `/^[a-f0-9-]{36}$/` before
processing. Malformed inputs return HTTP 400.

### Supabase Row Level Security
RLS is enabled on all tables. No RLS policies are defined, meaning the anon key
(which would be in the browser) has zero table access. Only the service role key
(in Vercel functions) can read or write.

### Image size limit
`api/detect.js` rejects base64 image payloads exceeding 600,000 characters server-side.
The browser also caps capture at 800×600 JPEG 80% before sending (~80–150KB).

### Content Security Policy (`vercel.json`)
CSP restricts script sources, style sources, and `connect-src` to the Anthropic API
and Supabase URL only. Inline scripts and styles are permitted (required for single-file
architecture). No external CDN scripts are loaded.

### Security headers (`vercel.json`)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(self), microphone=()`
