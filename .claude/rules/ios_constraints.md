# iOS Constraints

These are confirmed platform limitations affecting VisionWeb on iPhone/iPad.
All browsers on iOS use WebKit, so Chrome, Edge, and Firefox on iPhone behave
identically to Safari for these issues.

---

## Volume control — unfixable, by design

`HTMLMediaElement.volume` is deliberately blocked by Apple on iOS. The property
always returns `1.0` regardless of what is set. This is documented in Apple's
Safari HTML5 Audio and Video Guide and affects all browsers on iOS.
**There is no workaround.** Users must use hardware volume buttons.
Do not add a volume slider for iOS — it will not work.

---

## Audio before user gesture — silent failure

`speechSynthesis.speak()` is silently blocked on iOS unless called from within a
direct user gesture handler (touchstart, touchend, click). Calls made on page load
or from setTimeout produce no audio and no error.

**Pattern used in VisionWeb:**
- Consent screen: audio fires inside a `touchstart` listener on the screen element
- All subsequent screens: audio fires after the hold detection gesture (already in gesture context)
- `Audio.speak('Analysing now.')` before fetch: called without `await` to stay in the same gesture microtask

---

## Fetch drops after audio context on iOS

Awaiting `speechSynthesis.speak()` before calling `fetch()` causes iOS to deprioritise
or drop the network request. The audio context and the fetch must be initiated in the
same synchronous call stack.

**Correct pattern:**
```js
Audio.speak('Analysing now.', 'Sedang menganalisis.'); // no await
const response = await fetch('/api/detect', ...);
```

---

## Image resolution — payload overflow

iPhone cameras can produce images at 4K+ resolution. At native resolution, the base64
payload exceeds the 600,000 character server-side limit. `Camera.capture()` enforces
a maximum of 800×600 pixels at 80% JPEG quality, producing payloads of 80–150KB.

```js
// In Camera.capture() — do not remove or increase these constraints
const MAX_W = 800, MAX_H = 600;
canvas.width  = Math.min(video.videoWidth,  MAX_W);
canvas.height = Math.min(video.videoHeight, MAX_H);
```

---

## Fetch timeout — 20 second AbortController

iOS drops fetch connections when the browser goes to background or after extended
inactivity. Without a timeout, the user sees an infinite spinner.

```js
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20000);
```

On abort, the error message is: `'Scan timed out. Please try again.'`

---

## WebXR / AR — completely unsupported on iOS web

The WebXR Device API is not supported on Safari or any iOS browser (all use WebKit).
ARCore and similar AR SDKs require native app installation — they cannot be integrated
into a web app targeting iOS users. Do not attempt AR features in VisionWeb.

---

## touchend vs touchstart on interactive elements

iOS WebKit sometimes fires `touchstart` before evaluating `disabled` attribute state.
For buttons that may be conditionally disabled, use `touchend` instead of `touchstart`
to ensure correct behaviour.
