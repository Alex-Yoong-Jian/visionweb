'use strict';

/* ═══════════════════════════════════════════════
   CONSENT MANAGER
   Shows PDPA consent screen once per week.
   Week key stored in localStorage.

   Audio behaviour:
   - Cannot play before a user gesture on mobile.
   - Fires on first touchstart/click on the screen.
   - Button is enabled immediately — no audio gate.
   - Accept cancels any in-progress audio.

   Do NOT move Audio.speak() back to screen init —
   it will be silently blocked by mobile browsers.
═══════════════════════════════════════════════ */
const ConsentManager = (() => {
  function getWeekKey() {
    const now  = new Date();
    const year = now.getUTCFullYear();
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(((now - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
    return `consent-${year}-W${String(week).padStart(2, '0')}`;
  }

  function hasConsented() { return localStorage.getItem(getWeekKey()) === 'accepted'; }
  function recordConsent() { localStorage.setItem(getWeekKey(), 'accepted'); }

  async function show(onAccepted) {
    ScreenManager.show('consent');

    const btn    = document.getElementById('consent-tap-btn');
    const screen = document.getElementById('screen-consent');

    // Button enabled immediately — no audioComplete gate.
    btn.disabled = false;
    btn.classList.add('ready');

    // Audio fires on first gesture — required by mobile browser autoplay policy.
    let audioStarted = false;
    function startAudio() {
      if (audioStarted) return;
      audioStarted = true;
      Audio.speak(
        'Welcome to VisionWeb. Before you begin, please be aware that this app collects your device information and usage data to operate the weekly scan limit. If you submit an issue report, your email will also be stored. Please tap the Accept and Continue button at the bottom of the screen to proceed.',
        'Selamat datang ke VisionWeb. Sebelum bermula, sila ambil perhatian bahawa aplikasi ini mengumpul maklumat peranti dan data penggunaan anda. Sila ketuk butang Terima di bawah skrin untuk meneruskan.'
      );
      screen.removeEventListener('touchstart', startAudio);
      screen.removeEventListener('click',      startAudio);
    }
    screen.addEventListener('touchstart', startAudio, { passive: true });
    screen.addEventListener('click',      startAudio);

    function onAccept(e) {
      e.stopPropagation();
      Audio.cancel();
      screen.removeEventListener('touchstart', startAudio);
      screen.removeEventListener('click',      startAudio);
      btn.removeEventListener('click',         onAccept);
      btn.removeEventListener('touchend',      onAccept);
      recordConsent();
      onAccepted();
    }
    btn.addEventListener('click',    onAccept);
    btn.addEventListener('touchend', onAccept, { passive: true });
  }

  return { hasConsented, show };
})();
