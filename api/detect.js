/*
 * VisionWeb — Vercel Serverless Function
 * File: api/detect.js
 *
 * Handles:
 *  1. Session-based scan limit (10/week via Supabase)
 *  2. Unlimited access for token holders (email unlock)
 *  3. Claude Haiku vision inference
 *
 * Endpoint: POST /api/detect
 * Body:     { image: "<base64 JPEG>", sessionId: "<uuid>", token?: "<unlock token>" }
 * Returns:  { mode, description, descriptionMY, score, scansUsed, scansRemaining }
 */

import crypto from 'crypto';

const CLAUDE_ENDPOINT  = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL     = 'claude-haiku-4-5-20251001';
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY; // service role — never anon
const ANTHROPIC_KEY    = process.env.ANTHROPIC_API_KEY;
const TOKEN_SECRET     = process.env.TOKEN_SECRET;
const WEEKLY_LIMIT     = 10;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Validate env vars ──
  if (!ANTHROPIC_KEY || !SUPABASE_URL || !SUPABASE_KEY || !TOKEN_SECRET) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // ── Validate image ──
  const { image, token, sessionId } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid image data' });
  }
  if (image.length > 600000) {
    return res.status(400).json({ error: 'Image too large' });
  }

  // ── Session key: UUID generated in browser, stored in localStorage ──
  // More accurate than IP+UA — tracks per browser instance, not per network
  if (!sessionId || typeof sessionId !== 'string' || !/^[a-f0-9-]{36}$/.test(sessionId)) {
    return res.status(400).json({ error: 'Missing or invalid session ID' });
  }
  // Hash the UUID before storing — no raw client IDs in the database
  const sessionKey = crypto
    .createHash('sha256')
    .update(sessionId)
    .digest('hex')
    .slice(0, 32);

  const weekKey = getWeekKey();

  // ── Check if token grants unlimited access ──
  const isUnlimited = token ? verifyToken(token, TOKEN_SECRET) !== null : false;

  // ── Check / update scan count in Supabase ──
  let scansUsed      = 0;
  let scansRemaining = WEEKLY_LIMIT;

  const { deviceInfo } = req.body;

  if (!isUnlimited) {
    const limitCheck = await checkAndIncrementScan(sessionKey, weekKey, deviceInfo);
    if (limitCheck.error) {
      return res.status(500).json({ error: 'Could not verify scan limit' });
    }
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error:          'Weekly scan limit reached',
        scansUsed:      WEEKLY_LIMIT,
        scansRemaining: 0,
        weekKey,
      });
    }
    scansUsed      = limitCheck.scansUsed;
    scansRemaining = Math.max(0, WEEKLY_LIMIT - scansUsed);
  }

  // ── Call Claude Haiku ──
  try {
    const response = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: `You are an accessibility assistant for visually impaired users.
Identify as specifically as possible the most prominent subject in this image.

Respond ONLY with a valid JSON object — no markdown, no explanation, no extra text:
{"mode":"portrait","description":"a red hex dumbbell","descriptionMY":"dumbbell heksagon merah","score":0.93}

Rules:
- mode "portrait": a specific identifiable object or person is the clear focus
- mode "scene": a general environment or multiple objects with no single clear subject
- mode "uncertain": you cannot identify the subject with confidence — score must be below 0.6
- description: specific English identification — prefer "a hex dumbbell" over "gym equipment", "a tabby cat" over "an animal"
- descriptionMY: accurate Malay translation of description
- score: your honest confidence 0.0–1.0 — do not inflate; if unsure, reflect that in the score
- Never start with "I see" or "The image shows"
- If score is below 0.6, set mode to "uncertain" — do not guess a specific identity`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg  = errData.error?.message || `Claude API HTTP ${response.status}`;
      console.error('Claude API error:', errMsg);
      return res.status(502).json({ error: errMsg });
    }

    const data    = await response.json();
    const rawText = data.content?.[0]?.text || '';

    if (!rawText) {
      return res.status(502).json({ error: 'Empty response from Claude' });
    }

    const parsed = parseClaudeResponse(rawText);

    return res.status(200).json({
      ...parsed,
      scansUsed,
      scansRemaining: isUnlimited ? null : scansRemaining,
      isUnlimited,
    });

  } catch (err) {
    console.error('Serverless function error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Check scan count and increment if within limit ──
async function checkAndIncrementScan(sessionKey, weekKey, deviceInfo = {}) {
  const url     = `${SUPABASE_URL}/rest/v1/scan_sessions`;
  const headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  // Try to get existing session
  const getResp = await fetch(
    `${url}?session_key=eq.${sessionKey}&week_key=eq.${weekKey}&select=id,scan_count`,
    { headers }
  );

  if (!getResp.ok) return { error: true };

  const rows = await getResp.json();

  if (rows.length === 0) {
    // First scan this week — insert row with count = 1 and device info
    const insertResp = await fetch(url, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        session_key: sessionKey,
        week_key:    weekKey,
        scan_count:  1,
        browser:     deviceInfo.browser     || null,
        os:          deviceInfo.os          || null,
        device_type: deviceInfo.deviceType  || null,
        brand:       deviceInfo.brand       || null,
        model:       deviceInfo.model       || null,
      })
    });
    if (!insertResp.ok) return { error: true };
    return { allowed: true, scansUsed: 1 };
  }

  const { id, scan_count } = rows[0];

  if (scan_count >= WEEKLY_LIMIT) {
    return { allowed: false };
  }

  // Increment count
  const patchResp = await fetch(`${url}?id=eq.${id}`, {
    method:  'PATCH',
    headers,
    body: JSON.stringify({ scan_count: scan_count + 1 })
  });

  if (!patchResp.ok) return { error: true };
  return { allowed: true, scansUsed: scan_count + 1 };
}

// ── Verify unlock token ──
function verifyToken(token, secret) {
  try {
    const [encodedEmail, hmac] = token.split('.');
    if (!encodedEmail || !hmac) return null;
    const email    = Buffer.from(encodedEmail, 'base64').toString('utf8');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${email}:unlimited`)
      .digest('hex');
    return hmac === expected ? email : null;
  } catch { return null; }
}

// ── Parse Claude response ──
function parseClaudeResponse(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.mode || !parsed.description) throw new Error('Missing fields');
    return {
      mode:          parsed.mode,
      description:   parsed.description,
      descriptionMY: parsed.descriptionMY || parsed.description,
      score:         typeof parsed.score === 'number' ? parsed.score : 0.9,
    };
  } catch {
    return { mode: 'scene', description: cleaned.slice(0, 120), descriptionMY: cleaned.slice(0, 120), score: 0.7 };
  }
}

// ── Get current ISO week key e.g. "2026-W14" ──
function getWeekKey() {
  const now  = new Date();
  const year = now.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
