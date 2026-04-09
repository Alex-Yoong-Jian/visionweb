'use strict';

/* ═══════════════════════════════════════════════
   APP CONTROLLER — state machine
   loading → consent? → prompt → camera → result
                                        → limit (429)
                                        → error
   showPrompt() is exposed publicly for
   ReportManager.close() to re-enter safely.
═══════════════════════════════════════════════ */
const App = (() => {
  let state = 'loading';

  async function init() {
    ScreenManager.show('loading');
    TickSound.initGlobal();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('Your browser does not support camera access. Please use Chrome or Safari.');
      return;
    }

    // Collect device info in background (may show browser permission prompt on Android)
    DeviceInfo.collect();

    await new Promise(r => setTimeout(r, 600));

    if (!ConsentManager.hasConsented()) {
      await ConsentManager.show(() => showPrompt());
    } else {
      showPrompt();
    }
  }

  function showPrompt() {
    ScreenManager.show('prompt');
    state = 'prompt';
    Audio.prompt();

    const el = document.getElementById('screen-prompt');
    function onHold() {
      el.removeEventListener('mousedown',  onHold);
      el.removeEventListener('touchstart', onHold);
      openCameraAndListen();
    }
    el.addEventListener('mousedown',  onHold);
    el.addEventListener('touchstart', onHold, { passive: true });
  }

  async function openCameraAndListen() {
    try {
      await Camera.start();
    } catch (err) {
      console.error('Camera error:', err.name);
      showError(
        'Camera access was denied. Please allow camera access and reload. / ' +
        'Akses kamera ditolak. Sila benarkan akses kamera dan muat semula.'
      );
      return;
    }
    ScreenManager.show('camera');
    state = 'camera';
    HoldDetection.init(onHoldComplete);
    HoldDetection.enable();
    await Audio.speak('Camera is ready. Hold to scan.', 'Kamera sedia. Tahan untuk mengimbas.');
  }

  async function onHoldComplete() {
    if (state !== 'camera') return;
    state = 'scanning';
    HoldDetection.disable();

    const base64Image = Camera.capture();
    document.getElementById('scan-spinner').classList.add('visible');
    Camera.stop();

    // Speak WITHOUT await — must fire fetch in same gesture context (iOS requirement).
    // Do NOT add await here.
    Audio.speak('Analysing now.', 'Sedang menganalisis.');

    try {
      const result    = await Detector.analyse(base64Image);
      const sentences = ResultBuilder.build(result);

      document.getElementById('scan-spinner').classList.remove('visible');
      ResultDisplay.show(result.mode, sentences.en, sentences.my, result.score);

      const scanInfoEl = document.getElementById('result-scan-info');
      if (result.isUnlimited) {
        scanInfoEl.textContent = 'Unlimited access';
      } else if (result.scansRemaining !== undefined) {
        const rem = result.scansRemaining;
        scanInfoEl.textContent = rem === 0
          ? 'No scans remaining this week'
          : `${rem} scan${rem === 1 ? '' : 's'} remaining this week`;
      } else {
        scanInfoEl.textContent = '';
      }

      ScreenManager.show('result');
      state = 'result';

      // Attach listeners first — user can tap to scan again at any time,
      // even while audio is still playing. Audio.cancel() cleans up in scanAgain().
      const resultEl = document.getElementById('screen-result');
      function onResultHold() {
        resultEl.removeEventListener('mousedown',  onResultHold);
        resultEl.removeEventListener('touchstart', onResultHold);
        scanAgain();
      }
      resultEl.addEventListener('mousedown',  onResultHold);
      resultEl.addEventListener('touchstart', onResultHold, { passive: true });

      await Audio.speak(sentences.en, sentences.my);
      await Audio.speak('Hold anywhere to scan again.', 'Tahan di mana-mana untuk mengimbas semula.');

    } catch (err) {
      console.error('Detection error:', err.name, err.message);
      document.getElementById('scan-spinner').classList.remove('visible');

      if (err.isLimitReached) {
        ScreenManager.show('limit');
        state = 'limit';
        await Audio.speak(
          'You have reached your weekly scan limit of 10 scans. Your limit resets every Monday.',
          'Anda telah mencapai had imbasan mingguan 10 imbasan. Had anda ditetapkan semula setiap Isnin.'
        );
        return;
      }

      showError('Detection failed: ' + (err.message || err.name) + '. Please reload.');
    }
  }

  async function scanAgain() {
    Audio.cancel();
    try {
      await Camera.start();
    } catch (err) {
      console.error('Camera error:', err.name);
      showError('Camera could not be reopened. Please reload.');
      return;
    }
    ScreenManager.show('camera');
    state = 'camera';
    HoldDetection.enable();
    await Audio.speak('Ready. Hold to scan again.', 'Sedia. Tahan untuk mengimbas semula.');
  }

  function showError(msg) {
    document.getElementById('error-msg').textContent = msg;
    ScreenManager.show('error');
    state = 'error';
  }

  return { init, showPrompt };
})();

window.addEventListener('DOMContentLoaded', () => {
  UnlockManager.init();
  AdminPanel.init();
  App.init();
});
