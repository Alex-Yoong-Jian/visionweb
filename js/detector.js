'use strict';

/* ═══════════════════════════════════════════════
   DETECTOR
   Sends captured frame to /api/detect (secure proxy).
   20s AbortController timeout prevents iOS spinner.
   Audio.speak() is called WITHOUT await before
   fetch — keeps both in the same gesture context
   so iOS doesn't deprioritise the network request.
═══════════════════════════════════════════════ */
const Detector = (() => {
  async function analyse(base64Image) {
    const token      = localStorage.getItem('visionweb_token') || undefined;
    const sessionId  = SessionID.get();
    const deviceInfo = DeviceInfo.get();

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 20000);

    let resp;
    try {
      resp = await fetch('/api/detect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64Image, sessionId, token, deviceInfo }),
        signal:  controller.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Scan timed out. Please try again.');
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (resp.status === 429) {
      const err = await resp.json().catch(() => ({}));
      const limitErr = new Error(err.error || 'Weekly limit reached');
      limitErr.isLimitReached = true;
      throw limitErr;
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${resp.status}`);
    }

    return await resp.json();
  }

  return { analyse };
})();
