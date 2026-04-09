'use strict';

/* ═══════════════════════════════════════════════
   AUDIO — Bilingual speech synthesis (EN + Malay)
   speak(en, my): speaks EN then MY sequentially.
   prompt(): speaks the hold-to-scan instruction.
   cancel(): stops any currently playing speech.
═══════════════════════════════════════════════ */
const Audio = (() => {
  const synth = window.speechSynthesis;
  let voices  = [];

  function loadVoices() { voices = synth.getVoices(); }
  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  function findVoice(lang) { return voices.find(v => v.lang.startsWith(lang)) || null; }

  function speakLine(text, lang, rate = 0.95) {
    return new Promise(resolve => {
      const utt   = new SpeechSynthesisUtterance(text);
      utt.lang    = lang; utt.rate = rate; utt.pitch = 1;
      const voice = findVoice(lang);
      if (voice) utt.voice = voice;
      utt.onend = resolve; utt.onerror = resolve;
      synth.speak(utt);
    });
  }

  async function speak(en, my) {
    synth.cancel();
    await speakLine(en, 'en');
    if (my) await speakLine(my, 'ms');
  }

  async function prompt() {
    await speak('Hold the screen to scan.', 'Tahan skrin untuk mengimbas.');
  }

  function cancel() { synth.cancel(); }

  return { speak, prompt, cancel };
})();
