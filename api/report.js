/*
 * VisionWeb — Vercel Serverless Function
 * File: api/report.js
 *
 * Handles user-submitted issue reports.
 * Enforces max 5 reports per browser per week via sessionId hashing.
 *
 * Endpoint: POST /api/report
 * Body:     { email, title, description, sessionId?, browser?, os?, device_type?, brand?, model? }
 * Returns:  { success: true } or { error: "..." }
 */

import crypto from 'crypto';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_KEY         = process.env.SUPABASE_SERVICE_KEY;
const WEEKLY_REPORT_LIMIT  = 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email, title, description, browser, os, device_type, brand, model, sessionId } = req.body;

  // ── Server-side validation ──
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 50) {
    return res.status(400).json({ error: 'Title is required (max 50 characters)' });
  }
  if (!description || typeof description !== 'string' || description.trim().length === 0 || description.trim().length > 500) {
    return res.status(400).json({ error: 'Description is required (max 500 characters)' });
  }

  const supabaseHeaders = {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
  };

  // ── Rate limit: max 5 reports per browser per week ──
  let sessionKey = null;
  const weekKey  = getWeekKey();

  if (sessionId && typeof sessionId === 'string' && /^[a-f0-9-]{36}$/.test(sessionId)) {
    sessionKey = crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 32);

    const countResp = await fetch(
      `${SUPABASE_URL}/rest/v1/issue_reports?session_key=eq.${sessionKey}&week_key=eq.${weekKey}&select=id`,
      { headers: { ...supabaseHeaders, 'Prefer': 'count=exact' } }
    );

    if (countResp.ok) {
      const range = countResp.headers.get('content-range');
      const count = range ? parseInt(range.split('/')[1], 10) : 0;
      if (count >= WEEKLY_REPORT_LIMIT) {
        return res.status(429).json({
          error: 'You have reached the weekly limit of 5 reports. Please try again next Monday. / Had laporan mingguan dicapai. Sila cuba semula Isnin hadapan.'
        });
      }
    }
  }

  // ── Insert report ──
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/issue_reports`, {
      method:  'POST',
      headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        email:       email.trim().toLowerCase(),
        title:       title.trim(),
        description: description.trim(),
        browser:     browser     || null,
        os:          os          || null,
        device_type: device_type || null,
        brand:       brand       || null,
        model:       model       || null,
        session_key: sessionKey,
        week_key:    weekKey,
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      console.error('Supabase insert error:', errData);
      return res.status(500).json({ error: 'Failed to submit report' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Report submission error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Get current ISO week key e.g. "2026-W15" ──
function getWeekKey() {
  const now  = new Date();
  const year = now.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
