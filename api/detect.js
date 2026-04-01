/*
 * VisionWeb — Vercel Serverless Function
 * File: api/detect.js
 *
 * Acts as a secure proxy between the browser and Google Cloud Vision API.
 * The API key is stored in Vercel environment variables and never exposed
 * to the browser or GitHub.
 *
 * Endpoint: POST /api/detect
 * Body:     { image: "<base64 string>" }
 * Returns:  { mode, description, score, isLandmark }
 */

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export default async function handler(req, res) {

  // ── Only allow POST requests ──
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Read API key from Vercel environment variable ──
  const apiKey = process.env.VISION_API_KEY;
  if (!apiKey) {
    console.error('VISION_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  // ── Validate request body ──
  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid image data' });
  }

  // ── Validate base64 string length (prevent abuse) ──
  // A 1280x720 JPEG at 85% quality is typically under 300KB
  // Base64 adds ~37% overhead → ~410KB → ~420,000 chars
  if (image.length > 600000) {
    return res.status(400).json({ error: 'Image too large' });
  }

  try {
    // ── Call Google Cloud Vision API ──
    const body = {
      requests: [{
        image: { content: image },
        features: [
          { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
          { type: 'LABEL_DETECTION',     maxResults: 10 },
          { type: 'LANDMARK_DETECTION',  maxResults: 3  },
        ]
      }]
    };

    const visionResp = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });

    if (!visionResp.ok) {
      const errData = await visionResp.json().catch(() => ({}));
      const errMsg  = errData.error?.message || `Vision API HTTP ${visionResp.status}`;
      console.error('Vision API error:', errMsg);
      return res.status(502).json({ error: errMsg });
    }

    const data   = await visionResp.json();
    const result = data.responses?.[0];

    if (!result) {
      return res.status(502).json({ error: 'Empty response from Vision API' });
    }

    // ── Parse and return result ──
    const parsed = parseResult(result);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Serverless function error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/*
 * parseResult
 * Interprets the raw Google Vision API response into a
 * structured result object for the frontend.
 */
function parseResult(result) {
  const objects   = result.localizedObjectAnnotations || [];
  const labels    = result.labelAnnotations           || [];
  const landmarks = result.landmarkAnnotations        || [];

  // ── Portrait mode: dominant central object ──
  if (objects.length > 0) {
    const top   = objects[0];
    const score = top.score;
    const name  = top.name;

    const verts = top.boundingPoly?.normalizedVertices || [];
    if (verts.length >= 2) {
      const xs = verts.map(v => v.x || 0);
      const ys = verts.map(v => v.y || 0);
      const w  = Math.max(...xs) - Math.min(...xs);
      const h  = Math.max(...ys) - Math.min(...ys);
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const cy = (Math.max(...ys) + Math.min(...ys)) / 2;

      // Object is central and large enough for portrait mode
      const isCentral = (w * h) > 0.08
        && cx > 0.2 && cx < 0.8
        && cy > 0.2 && cy < 0.8;

      if (isCentral && score > 0.6) {
        return { mode: 'portrait', description: name, score };
      }
    }
  }

  // ── Landmark: a known place ──
  if (landmarks.length > 0) {
    return {
      mode:       'scene',
      description: landmarks[0].description,
      score:       landmarks[0].score,
      isLandmark:  true
    };
  }

  // ── Scene mode: top labels ──
  if (labels.length > 0) {
    const topLabels = labels
      .filter(l => l.score > 0.70)
      .slice(0, 3)
      .map(l => l.description.toLowerCase());

    const description = topLabels.length > 0
      ? topLabels.join(', ')
      : labels[0].description;

    return { mode: 'scene', description, score: labels[0].score };
  }

  // ── Nothing detected ──
  return { mode: 'unknown', description: null, score: 0 };
}
