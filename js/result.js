'use strict';

/* ═══════════════════════════════════════════════
   RESULT BUILDER
   Wraps Claude's noun phrase into natural bilingual
   sentences for audio delivery.
═══════════════════════════════════════════════ */
const ResultBuilder = (() => {
  function build(result) {
    if (!result.description) {
      return {
        en: 'I could not clearly identify what is in view. Please try again with better lighting.',
        my: 'Saya tidak dapat mengenal pasti dengan jelas. Sila cuba semula dengan pencahayaan yang lebih baik.'
      };
    }
    if (result.mode === 'uncertain') {
      return {
        en: "I can see an object but I'm not certain what it is. Please try again from a different angle.",
        my: 'Saya nampak objek tetapi tidak pasti apa ia. Sila cuba semula dari sudut yang berbeza.'
      };
    }
    const en = result.description;
    const my = result.descriptionMY || result.description;
    if (result.mode === 'portrait') {
      return { en: `I can see ${en}.`, my: `Saya nampak ${my}.` };
    }
    return { en: `This appears to be ${en}.`, my: `Ini kelihatan seperti ${my}.` };
  }
  return { build };
})();


/* ═══════════════════════════════════════════════
   RESULT DISPLAY
   Updates the result screen DOM elements.
═══════════════════════════════════════════════ */
const ResultDisplay = (() => {
  function show(mode, sentenceEN, sentenceMY, score) {
    const modeLabel  = mode === 'portrait'  ? 'Object detected'
                     : mode === 'scene'     ? 'Scene detected'
                     : mode === 'uncertain' ? 'Unable to identify'
                     :                       'Detection complete';
    const confidence = score > 0 ? `${Math.round(score * 100)}% confidence` : '';
    document.getElementById('result-mode').textContent       = modeLabel;
    document.getElementById('result-confidence').textContent = confidence;
    document.getElementById('result-text-en').textContent    = sentenceEN;
    document.getElementById('result-text-my').textContent    = sentenceMY;
  }
  return { show };
})();
