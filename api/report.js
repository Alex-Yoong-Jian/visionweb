/*
 * VisionWeb — Vercel Serverless Function
 * File: api/report.js
 *
 * Handles user-submitted issue reports.
 *
 * Endpoint: POST /api/report
 * Body:     { email, title, description, browser?, os?, device_type?, brand?, model? }
 * Returns:  { success: true } or { error: "..." }
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email, title, description, browser, os, device_type, brand, model } = req.body;

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

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/issue_reports`, {
      method:  'POST',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        email:       email.trim().toLowerCase(),
        title:       title.trim(),
        description: description.trim(),
        browser:     browser     || null,
        os:          os          || null,
        device_type: device_type || null,
        brand:       brand       || null,
        model:       model       || null,
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
