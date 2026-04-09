'use strict';

/* ═══════════════════════════════════════════════
   REPORT MANAGER
   Handles the Report an Issue screen.
   close() calls App.showPrompt() — not
   ScreenManager.show('prompt') directly — so the
   App state machine resets and the hold listener
   is correctly re-attached.
═══════════════════════════════════════════════ */
const ReportManager = (() => {
  function open() {
    ['report-email','report-title','report-desc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; el.classList.remove('error'); }
    });
    ['err-email','err-title','err-desc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
    document.getElementById('count-title').textContent   = '0 / 50';
    document.getElementById('count-desc').textContent    = '0 / 500';
    document.getElementById('report-success').classList.remove('show');
    document.getElementById('report-limit-msg').classList.remove('show');
    document.getElementById('report-submit-btn').disabled    = false;
    document.getElementById('report-submit-btn').textContent = 'Submit Report';
    ScreenManager.show('report');

    const titleEl = document.getElementById('report-title');
    const descEl  = document.getElementById('report-desc');
    titleEl.oninput = () => {
      document.getElementById('count-title').textContent = `${titleEl.value.length} / 50`;
    };
    descEl.oninput = () => {
      document.getElementById('count-desc').textContent = `${descEl.value.length} / 500`;
    };
  }

  function close() {
    // Must go through App.showPrompt() — not ScreenManager directly.
    App.showPrompt();
  }

  async function submit() {
    const email = document.getElementById('report-email').value.trim();
    const title = document.getElementById('report-title').value.trim();
    const desc  = document.getElementById('report-desc').value.trim();

    ['err-email','err-title','err-desc'].forEach(id =>
      document.getElementById(id).classList.remove('show')
    );
    ['report-email','report-title','report-desc'].forEach(id =>
      document.getElementById(id).classList.remove('error')
    );
    document.getElementById('report-limit-msg').classList.remove('show');

    let valid = true;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('err-email').classList.add('show');
      document.getElementById('report-email').classList.add('error');
      valid = false;
    }
    if (!title) {
      document.getElementById('err-title').classList.add('show');
      document.getElementById('report-title').classList.add('error');
      valid = false;
    }
    if (!desc) {
      document.getElementById('err-desc').classList.add('show');
      document.getElementById('report-desc').classList.add('error');
      valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('report-submit-btn');
    btn.disabled    = true;
    btn.textContent = 'Submitting…';

    const device = DeviceInfo.get();

    try {
      const resp = await fetch('/api/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, title, description: desc,
          sessionId:   SessionID.get(),
          browser:     device.browser    || null,
          os:          device.os         || null,
          device_type: device.deviceType || null,
          brand:       device.brand      || null,
          model:       device.model      || null,
        })
      });
      const data = await resp.json();

      // Weekly rate limit reached
      if (resp.status === 429) {
        document.getElementById('report-limit-msg').classList.add('show');
        btn.disabled    = false;
        btn.textContent = 'Submit Report';
        return;
      }

      if (!resp.ok || !data.success) {
        btn.disabled    = false;
        btn.textContent = 'Submit Report';
        alert(data.error || 'Submission failed. Please try again.');
        return;
      }

      document.getElementById('report-success').classList.add('show');
      btn.textContent = 'Submitted ✓';
      setTimeout(() => close(), 2500);

    } catch {
      btn.disabled    = false;
      btn.textContent = 'Submit Report';
      alert('Network error. Please check your connection and try again.');
    }
  }

  return { open, close, submit };
})();
