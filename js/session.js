'use strict';

/* ═══════════════════════════════════════════════
   SESSION ID
   Generates a UUID on first visit and persists it
   in localStorage. Used as the scan limit key —
   one count per browser instance, not per network.
═══════════════════════════════════════════════ */
const SessionID = (() => {
  const STORAGE_KEY = 'visionweb_session_id';

  function generate() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function get() {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) { id = generate(); localStorage.setItem(STORAGE_KEY, id); }
    return id;
  }

  return { get };
})();


/* ═══════════════════════════════════════════════
   DEVICE INFO
   Captures browser, OS, device type from UA string.
   Requests brand/model via High Entropy API (Chrome).
═══════════════════════════════════════════════ */
const DeviceInfo = (() => {
  let cached = null;

  function parseUA(ua) {
    let browser = 'Unknown', os = 'Unknown', deviceType = 'desktop';
    if      (/Edg\/(\d+)/.test(ua))     browser = `Edge ${RegExp.$1}`;
    else if (/OPR\/(\d+)/.test(ua))     browser = `Opera ${RegExp.$1}`;
    else if (/Chrome\/(\d+)/.test(ua))  browser = `Chrome ${RegExp.$1}`;
    else if (/Firefox\/(\d+)/.test(ua)) browser = `Firefox ${RegExp.$1}`;
    else if (/Version\/(\d+).*Safari/.test(ua)) browser = `Safari ${RegExp.$1}`;
    else if (/MSIE|Trident/.test(ua))   browser = 'Internet Explorer';

    if      (/iPhone|iPad/.test(ua))       os = 'iOS';
    else if (/Android/.test(ua))           os = 'Android';
    else if (/Windows NT 10/.test(ua))     os = 'Windows 10/11';
    else if (/Windows NT 6\.3/.test(ua))   os = 'Windows 8.1';
    else if (/Windows NT 6/.test(ua))      os = 'Windows 8';
    else if (/Mac OS X/.test(ua))          os = 'macOS';
    else if (/Linux/.test(ua))             os = 'Linux';

    if (/Mobi|Android|iPhone|iPad/.test(ua)) deviceType = 'mobile';
    return { browser, os, deviceType };
  }

  async function collect() {
    if (cached) return cached;
    const base = parseUA(navigator.userAgent);
    cached = { ...base, brand: null, model: null };
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      try {
        const high = await navigator.userAgentData.getHighEntropyValues(
          ['brand', 'model', 'platform', 'platformVersion']
        );
        if (high.brand)    cached.brand = high.brand;
        if (high.model)    cached.model = high.model;
        if (high.platform) cached.os    = high.platform + (high.platformVersion ? ` ${high.platformVersion}` : '');
      } catch (e) { /* permission denied or unsupported */ }
    }
    return cached;
  }

  function get() { return cached || {}; }

  return { collect, get };
})();
