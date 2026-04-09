/*
 * VisionWeb — Vercel Serverless Function
 * File: api/admin.js
 *
 * Returns paginated issue reports from Supabase.
 * Requires a valid admin session token on every request.
 *
 * Endpoint: POST /api/admin
 * Body:     { token: string, page: number }
 * Returns:  { issues, total, page, pageSize, totalPages }
 */

import crypto from 'crypto';

const TOKEN_SECRET = process.env.TOKEN_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PAGE_SIZE    = 20;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!TOKEN_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { token, page = 1 } = req.body;

  // Validate admin session token
  const expected = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update('admin:authorized')
    .digest('hex');

  if (!token || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const offset = (Math.max(1, Number(page)) - 1) * PAGE_SIZE;

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/issue_reports` +
      `?order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}` +
      `&select=id,email,title,description,browser,os,device_type,brand,model,created_at`,
      {
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer':        'count=exact',
        }
      }
    );

    if (!resp.ok) return res.status(500).json({ error: 'Failed to fetch reports' });

    const issues       = await resp.json();
    const contentRange = resp.headers.get('content-range'); // e.g. "0-19/45"
    const total        = contentRange ? parseInt(contentRange.split('/')[1], 10) : issues.length;

    return res.status(200).json({
      issues,
      total,
      page:       Number(page),
      pageSize:   PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE) || 1,
    });

  } catch (err) {
    console.error('Admin fetch error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
