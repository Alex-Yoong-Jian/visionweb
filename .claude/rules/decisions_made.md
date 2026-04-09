# Decisions Made

These are non-obvious implementation choices. Do not "fix" or change these without
understanding the reason first.

---

## Image capture capped at 800×600, JPEG 80%

**Why:** iPhones capture at native resolution (up to 4K). At native size, the base64
payload exceeds the 600,000 character server-side limit, causing silent failures or
timeouts. The cap keeps payloads at 80–150KB — reliable on all iOS devices.
**Do not increase this limit.**

---

## `Audio.speak()` called without `await` before `fetch()` in Detector

**Why:** iOS deprioritises network requests initiated after an `async` audio context.
Awaiting speech synthesis before firing the fetch caused the API call to be throttled
or silently dropped on iPhone. The fix is to call `Audio.speak('Analysing now.')` without
`await` so both the audio and the fetch start in the same gesture microtask context.
**Do not add `await` before the fetch call.**

---

## Consent screen audio fires on first tap, not on screen show

**Why:** Browsers (especially mobile Safari) block `speechSynthesis.speak()` unless
called from within a direct user gesture (touch or click). The consent screen appears
automatically on page load — no gesture has occurred yet — so calling `Audio.speak()`
on screen show is silently ignored. The fix attaches `touchstart`/`click` listeners to
the consent screen itself; the first tap anywhere triggers audio, and a second tap on
the Accept button advances the flow.
**Do not move the `Audio.speak()` call back to screen initialisation.**

---

## Consent button enabled immediately (no `audioComplete` gate)

**Why:** The original implementation disabled the Accept button until audio finished
playing, forcing users to wait through the full bilingual notice before proceeding.
User feedback identified this as punishing. The button is now enabled immediately;
audio plays in the background. Users who tap Accept early have the audio cancelled
via `Audio.cancel()`.
**Do not re-add the `audioComplete` boolean gate.**

---

## Session key is SHA-256 hash of localStorage UUID — raw UUID never stored

**Why:** Storing raw browser UUIDs in the database creates an unnecessary identifier.
The SHA-256 hash (first 32 hex chars) provides the same collision resistance for
deduplication without storing the original value. The hash is one-way so sessions
cannot be reverse-engineered.
**Do not store raw UUIDs in Supabase.**

---

## Session tracking uses localStorage UUID, not IP address

**Why:** IP-based session tracking caused cross-device collisions — multiple users on
the same home/office network shared one IP, depleting the scan limit for all of them
from a single user's activity. localStorage UUID is per-browser, which is the correct
granularity for this use case.

---

## `touchend` used on consent button, not `touchstart`

**Why:** iOS fires `touchstart` before the `disabled` attribute is evaluated in some
WebKit versions. Using `touchend` ensures the event only registers after the finger
lifts, giving the browser time to correctly honour button state.

---

## `App.showPrompt()` exposed publicly and called by `ReportManager`

**Why:** When the user navigates back from the Report screen, the app must return to
the prompt state with the camera restarting correctly. Calling
`ScreenManager.show('prompt')` directly bypasses the App state machine and leaves
the camera in a broken state. `App.showPrompt()` is the correct entry point.
**Do not call `ScreenManager.show('prompt')` directly from `ReportManager`.**

---

## Tick sound fires only on `camera` and `result` screens

**Why:** The tick sound was originally playing on all screens including consent, report,
and error. This was disruptive and confusing for visually impaired users who rely on
audio cues. The `shouldBeep()` check restricts it to the two screens where it provides
useful feedback (hold progress on camera, confirmation on result).

---

## AbortController timeout set to 20 seconds

**Why:** iOS drops fetch responses after approximately 10s when the browser goes to
background. Without a timeout, the app shows an infinite spinner. 20 seconds is long
enough for Claude Haiku to respond under normal conditions but short enough to give
the user a clear error message if the connection is degraded.

---

## Claude Haiku model identifier

The exact model string used in `api/detect.js` is `claude-haiku-4-5-20251001`.
Do not substitute a different model string without testing — the structured JSON
response format is tuned to this model's behaviour.
