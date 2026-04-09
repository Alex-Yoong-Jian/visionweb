'use strict';

/* ═══════════════════════════════════════════════
   TICK SOUND — Japanese crossing-style beep
   Fires on touch only on camera and result screens.
   start()/stop() for rhythmic repeat during hold.
═══════════════════════════════════════════════ */
const TickSound = (() => {
  let ctx = null, tickTimer = null, running = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playBeep() {
    try {
      const ac = getCtx(), osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ac.currentTime);
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ac.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0.18, ac.currentTime + 0.08);
      gain.gain.linearRampToValueAtTime(0,    ac.currentTime + 0.18);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.18);
    } catch(e) {}
  }

  function start() {
    if (running) return;
    running = true; playBeep();
    tickTimer = setInterval(playBeep, 500);
  }

  function stop() {
    running = false; clearInterval(tickTimer); tickTimer = null;
  }

  const TICK_SCREENS = ['camera', 'result'];

  function initGlobal() {
    function shouldBeep() {
      return TICK_SCREENS.some(id =>
        !document.getElementById('screen-' + id).classList.contains('hidden')
      );
    }
    document.addEventListener('mousedown',  () => { if (shouldBeep()) playBeep(); });
    document.addEventListener('touchstart', () => { if (shouldBeep()) playBeep(); }, { passive: true });
  }

  return { start, stop, initGlobal };
})();
