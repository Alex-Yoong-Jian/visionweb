/*
 * VisionWeb — Vercel Serverless Function
 * File: api/unlock.js
 *
 * Verifies an email against allowed_emails in Supabase.
 * If matched, returns a signed token the browser stores in
 * localStorage and sends with every /api/detect call.
 *
 * The email list never leaves the server.
 * The token is HMAC-signed so it cannot be forged.
 *
 * Endpoint: POST /api/unlock
 * Body:     { email: "user@example.com" }
 * Returns:  { token: "<signed token>" }  or  { error: "..." }
 */

import crypto from 'crypto';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET  = process.env.TOKEN_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY || !TOKEN_SECRET) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email } = req.body;

  // ── Validate email format ──
  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    // ── Check Supabase allowed_emails table ──
    const url  = `${SUPABASE_URL}/rest/v1/allowed_emails`;
    const resp = await fetch(
      // Case-insensitive match using ilike
      `${url}?email=ilike.${encodeURIComponent(email.trim())}&select=email`,
      {
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      }
    );

    if (!resp.ok) {
      console.error('Supabase lookup error:', resp.status);
      return res.status(500).json({ error: 'Could not verify email' });
    }

    const rows = await resp.json();

    if (!rows || rows.length === 0) {
      // Intentionally vague — don't reveal whether email exists or not
      return res.status(403).json({ error: 'Email not recognised' });
    }

    // ── Generate signed token ──
    const normalised = email.trim().toLowerCase();
    const token      = createToken(normalised, TOKEN_SECRET);

    return res.status(200).json({ token });

  } catch (err) {
    console.error('Unlock error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function createToken(email, secret) {
  const encodedEmail = Buffer.from(email).toString('base64');
  const hmac         = crypto
    .createHmac('sha256', secret)
    .update(`${email}:unlimited`)
    .digest('hex');
  return `${encodedEmail}.${hmac}`;
}

function isValidEmail(email) {
  return email.length > 0
    && email.length < 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
