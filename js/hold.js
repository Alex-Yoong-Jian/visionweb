'use strict';

/* ═══════════════════════════════════════════════
   HOLD DETECTION
   3.5s hold with SVG progress ring and tick sound.
   3s cooldown enforced between scans.
   init(fn): wires touch/mouse listeners once.
   enable(): arms detection after camera opens.
   disable(): disarms during scanning / results.
═══════════════════════════════════════════════ */
const HoldDetection = (() => {
  const HOLD_MS = 3500, COOLDOWN_MS = 3000, CIRC = 2 * Math.PI * 100;
  const ring     = document.getElementById('progress-ring');
  const statusEl = document.getElementById('cam-status');
  const instrEN  = document.getElementById('cam-instruction-en');
  const instrMY  = document.getElementById('cam-instruction-my');

  let holdTimer = null, startTime = null, rafId = null;
  let isHolding = false, lastScanAt = 0, onComplete = null, enabled = false;

  function setStatus(msg) { statusEl.textContent = msg; }
  function setProgress(pct) { ring.style.strokeDashoffset = CIRC * (1 - pct); }

  function tick() {
    const pct = Math.min((Date.now() - startTime) / HOLD_MS, 1);
    setProgress(pct);
    if (pct < 1) rafId = requestAnimationFrame(tick);
  }

  function startHold() {
    if (!enabled || isHolding) return;
    const since = Date.now() - lastScanAt;
    if (since < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - since) / 1000);
      setStatus(`Please wait ${wait}s… / Sila tunggu ${wait}s…`);
      return;
    }
    isHolding = true; startTime = Date.now();
    setStatus('Hold steady… / Tahan…');
    instrEN.textContent = 'Keep holding…';
    instrMY.textContent = 'Teruskan tahan…';
    setProgress(0); TickSound.start(); rafId = requestAnimationFrame(tick);
    holdTimer = setTimeout(() => {
      cancelAnimationFrame(rafId); TickSound.stop(); setProgress(1);
      lastScanAt = Date.now(); if (onComplete) onComplete();
    }, HOLD_MS);
  }

  function endHold() {
    if (!isHolding) return;
    isHolding = false; clearTimeout(holdTimer); cancelAnimationFrame(rafId);
    TickSound.stop(); setProgress(0); setStatus('Hold to scan');
    instrEN.textContent = 'Hold anywhere to scan';
    instrMY.textContent = 'Tahan di mana-mana untuk mengimbas';
  }

  function init(completeFn) {
    onComplete = completeFn;
    const el = document.getElementById('screen-camera');
    el.addEventListener('mousedown',   () => startHold());
    el.addEventListener('mouseup',     () => endHold());
    el.addEventListener('mouseleave',  () => endHold());
    el.addEventListener('touchstart',  (e) => { e.preventDefault(); startHold(); }, { passive: false });
    el.addEventListener('touchend',    (e) => { e.preventDefault(); endHold(); },   { passive: false });
    el.addEventListener('touchcancel', (e) => { e.preventDefault(); endHold(); },   { passive: false });
  }

  function enable() {
    enabled = true; setStatus('Hold to scan'); setProgress(0);
    instrEN.textContent = 'Hold anywhere to scan';
    instrMY.textContent = 'Tahan di mana-mana untuk mengimbas';
  }

  function disable() { enabled = false; TickSound.stop(); endHold(); }

  return { init, enable, disable };
})();
