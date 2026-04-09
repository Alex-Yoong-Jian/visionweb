/*
 * VisionWeb — Vercel Serverless Function
 * File: api/admin-auth.js
 *
 * Validates admin PIN and returns a signed session token.
 * PIN is stored in ADMIN_PIN env var — never in code.
 * Token is HMAC-signed with TOKEN_SECRET — stateless validation.
 *
 * Endpoint: POST /api/admin-auth
 * Body:     { pin: string }
 * Returns:  { token: string } or { error: string }
 */

import crypto from 'crypto';

const TOKEN_SECRET = process.env.TOKEN_SECRET;
const ADMIN_PIN    = process.env.ADMIN_PIN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!TOKEN_SECRET || !ADMIN_PIN) {
    console.error('Missing ADMIN_PIN or TOKEN_SECRET');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { pin } = req.body;
  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ error: 'PIN required' });
  }

  // Constant-time comparison — prevents timing attacks
  let match = false;
  try {
    const a = Buffer.from(pin.trim());
    const b = Buffer.from(ADMIN_PIN);
    match = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { match = false; }

  if (!match) return res.status(401).json({ error: 'Invalid PIN' });

  // Generate session token — HMAC of fixed payload with TOKEN_SECRET
  const token = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update('admin:authorized')
    .digest('hex');

  return res.status(200).json({ token });
}
