'use strict';

/* ═══════════════════════════════════════════════
   UNLOCK MANAGER
   Bottom-right arrow reveals email input bar.
   Calls /api/unlock to verify email against
   Supabase allowed_emails table.
   Stores HMAC token in localStorage on success.
   All bar events stop propagation to suppress tick.
═══════════════════════════════════════════════ */
const UnlockManager = (() => {
  const TOKEN_KEY = 'visionweb_token';

  function init() {
    const btn    = document.getElementById('unlock-btn');
    const input  = document.getElementById('unlock-input');
    const msg    = document.getElementById('unlock-msg');
    const bar    = document.getElementById('unlock-bar');
    const toggle = document.getElementById('unlock-toggle');

    // Suppress tick sound on toggle and bar interactions
    toggle.addEventListener('mousedown',  (e) => e.stopPropagation());
    toggle.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    toggle.addEventListener('click', () => bar.classList.toggle('open'));
    bar.addEventListener('mousedown',  (e) => e.stopPropagation());
    bar.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

    // If already unlocked, show verified state
    if (localStorage.getItem(TOKEN_KEY)) {
      msg.textContent   = '✓ Unlimited access active';
      msg.className     = 'success';
      input.placeholder = 'Unlimited access active';
      input.disabled    = true;
      input.classList.add('verified');
      btn.disabled      = true;
      btn.textContent   = 'Unlocked';
      toggle.classList.add('verified');
      toggle.innerHTML  = '✓';
    }

    btn.addEventListener('click', () => attemptUnlock(input, msg, toggle, bar));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attemptUnlock(input, msg, toggle, bar);
    });
  }

  async function attemptUnlock(input, msg, toggle, bar) {
    const email = input.value.trim();
    if (!email) return;
    msg.textContent = 'Verifying…'; msg.className = '';

    try {
      const resp = await fetch('/api/unlock', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email })
      });
      const data = await resp.json();

      if (!resp.ok || !data.token) {
        msg.textContent = data.error || 'Email not recognised';
        msg.className   = 'error';
        input.classList.remove('verified');
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      msg.textContent   = '✓ Unlimited access unlocked!';
      msg.className     = 'success';
      input.value       = '';
      input.placeholder = 'Unlimited access active';
      input.disabled    = true;
      input.classList.add('verified');
      const btn         = document.getElementById('unlock-btn');
      btn.disabled      = true;
      btn.textContent   = 'Unlocked';
      toggle.classList.add('verified');
      toggle.innerHTML  = '✓';
      setTimeout(() => bar.classList.remove('open'), 1500);

    } catch {
      msg.textContent = 'Connection error. Please try again.';
      msg.className   = 'error';
    }
  }

  return { init };
})();
