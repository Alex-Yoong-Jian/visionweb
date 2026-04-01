/*
 * VisionWeb — Vercel Serverless Function
 * File: api/detect.js
 *
 * Secure proxy between the browser and Anthropic Claude API.
 * The API key is stored in Vercel environment variables — never
 * exposed to the browser or GitHub.
 *
 * Endpoint: POST /api/detect
 * Body:     { image: "<base64 JPEG string>" }
 * Returns:  { mode, description, descriptionMY, score }
 */

const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL           = 'claude-haiku-4-5-20251001';
const MAX_TOKENS      = 300;

export default async function handler(req, res) {

  // ── Only allow POST ──
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Read API key from Vercel environment variable ──
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  // ── Validate request body ──
  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid image data' });
  }

  // ── Validate image size (1280x720 JPEG at 85% ≈ 420KB → ~570K base64 chars) ──
  if (image.length > 600000) {
    return res.status(400).json({ error: 'Image too large' });
  }

  try {
    // ── Call Claude Haiku with the image ──
    const response = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: {
                type:       'base64',
                media_type: 'image/jpeg',
                data:       image,
              }
            },
            {
              type: 'text',
              text: `You are an accessibility assistant for visually impaired users.
Analyse this image and describe the most prominent subject you see.

Respond ONLY with a valid JSON object — no markdown, no explanation, no extra text:
{
  "mode": "portrait" or "scene",
  "description": "<short English noun phrase>",
  "descriptionMY": "<same phrase translated to Malay>",
  "score": <confidence float 0.0–1.0>
}

Rules:
- mode "portrait": a specific identifiable object or person is the clear focus
- mode "scene": general environment, setting, or multiple objects without one clear subject
- description: a concise noun phrase (e.g. "a wooden chair", "a person using a laptop", "an outdoor street market")
- descriptionMY: accurate Malay translation of the description
- score: your confidence level
- Never start description with "I see" or "The image shows"`
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
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Serverless function error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/*
 * parseClaudeResponse
 * Parses Claude's JSON response, with a safe fallback
 * if the model returns prose instead of JSON.
 */
function parseClaudeResponse(text) {
  // Strip any accidental markdown code fences
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.mode || !parsed.description) throw new Error('Missing fields');
    return {
      mode:          parsed.mode          || 'scene',
      description:   parsed.description   || cleaned,
      descriptionMY: parsed.descriptionMY || parsed.description || cleaned,
      score:         typeof parsed.score === 'number' ? parsed.score : 0.9,
    };
  } catch (e) {
    // Fallback: treat the entire response as a scene description
    return {
      mode:          'scene',
      description:   cleaned.slice(0, 120),
      descriptionMY: cleaned.slice(0, 120),
      score:         0.7,
    };
  }
}
