'use strict';

/* ═══════════════════════════════════════════════
   SCREEN MANAGER
   Shows one screen at a time by toggling .hidden.
═══════════════════════════════════════════════ */
const ScreenManager = (() => {
  const ids = ['loading','prompt','camera','result','error','limit','consent','report','admin'];
  const map = {};
  ids.forEach(id => map[id] = document.getElementById('screen-' + id));

  function show(name) {
    ids.forEach(id => map[id].classList.toggle('hidden', id !== name));
  }

  return { show };
})();
