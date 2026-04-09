'use strict';

/* ═══════════════════════════════════════════════
   CAMERA
   start(): opens rear camera stream.
   stop(): kills all tracks immediately.
   capture(): returns base64 JPEG string.
   Max capture size: 800×600 at 80% quality.
   iOS: do not increase these limits — larger
   payloads exceed the server's 600KB cap.
═══════════════════════════════════════════════ */
const Camera = (() => {
  const video = document.getElementById('camera-video');
  let stream  = null;

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await new Promise(resolve => { video.onloadedmetadata = resolve; });
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null; video.srcObject = null;
    }
  }

  function capture() {
    const MAX_WIDTH = 800, MAX_HEIGHT = 600;
    let w = video.videoWidth, h = video.videoHeight;

    if (w > MAX_WIDTH)  { h = Math.round(h * MAX_WIDTH  / w); w = MAX_WIDTH;  }
    if (h > MAX_HEIGHT) { w = Math.round(w * MAX_HEIGHT / h); h = MAX_HEIGHT; }

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.80).split(',')[1];
  }

  return { start, stop, capture };
})();
