# Release audit — 2026-10-03

## Scope and baseline

Inspected tracked files, hidden directories, README, configuration, dependency
lockfile, asset references, tests, the Git remote, and existing ignored browser
checks before editing. No repository or ancestor AGENTS.md was found. Preserved
the existing uncommitted change limiting results to five entries and showing the
full leaderboard from Home. No gameplay rules, storage keys, or record formats
changed. No publishing, pushing, or repository settings changes were performed.

The app uses Vite 8.3.2, with no runtime dependencies. The remote is
`swirita/nawras-memory`, branch `main`. The release builds static files for
`https://swirita.github.io/nawras-memory/`; screen navigation does not change URLs.

## Actual bottlenecks and changes

The landing particle MutationObserver watched the entire body. Card and timer
changes triggered unnecessary visibility/layout checks, and unrelated landing
changes repeatedly recreated all 48 circles. It now watches the landing subtree
and top-level removal only. A geometry key avoids rebuilding unchanged artwork.
Resize, logo loading, mode-form layout, visibility, reduced motion, and unmount
cleanup still work.

The Solo clock polled every 100ms despite displaying whole seconds. It now
schedules the next displayed-second boundary, preserving exact deadline checks
on selection, refresh, pause/resume, and expiry. Display updates cache permanent
controls and avoid rewriting unchanged text, attributes, disabled flags, and
turn status. Cards use one board click listener instead of twelve new listeners
per round. The previous listeners were collectible; this reduces listener
creation without claiming a pre-existing listener leak.

Audited card transforms, background contours, particles, shadows, turn tints,
confetti, and transitions. Card flips use transforms; tints and screen transitions
use opacity. The background contours are static SVG images, not a JavaScript
wave loop. Match shadows animate briefly on individual cards; completion glows
are static. Confetti has 24 bounded pieces removed on completion/cancellation.
Particles pause outside setup and on hidden pages. There are no app rAF loops
or intervals. Kept these visual effects and card geometry intact.

Existing generation guards cancel stale game, celebration, and mode callbacks.
The idle controller owns its timer and navigation cleanup. Audio already reuses
one context and disconnects completed nodes. These mechanisms were tested and
retained rather than rewritten. Added precise timer-boundary and 200-round
cancellation tests, plus optional reproducible browser/soak/measurement scripts.

## Measurements

Fresh before/after production runs used the existing Playwright Core installation
and headless Chrome on the same Windows host, 1440×900, reduced motion, with DOM,
timer, SVG creation, AudioContext, and CDP instrumentation. Baseline used the
original relative base at `/`; after used `/nawras-memory/`. Both served local
production output. Forced GC preceded resource snapshots. These are single-run
measurements, not a device FPS benchmark. Raw snapshots are in
[release-measurements.json](release-measurements.json).

| Measurement | Before | After |
| --- | ---: | ---: |
| Timer callbacks in 5.1s of untouched Solo play | 48 | 5 |
| DOM mutations in that same window | 140 | 5 |
| New circles across 20 mode switches | 960 | 0 |
| Layouts across those mode switches | 79 | 39 |
| New circles across 30 additional start/Home cycles | 7,200 | 0 |
| Layouts across those cycles | 1,020 | 209 |
| Event listeners while playing | 101 | 90 |
| Home listeners before/after those cycles | 65 / 65 | 66 / 66 |
| Home active timers after those cycles | 1 | 1 |
| AudioContexts after those cycles | 1 | 1 |
| Live oscillators after those cycles | 0 | 0 |
| Entire uncompressed dist | 6,518,931 bytes | 4,657,560 bytes |

The built output shrank 28.6%, mostly from 1,861,674 bytes of unused public images.
Those unused files were copied into dist but were not requested by the browser;
their removal reduces deployment size, not measured initial image transfer.
Guarded updates modestly increase the JS bundle (35.94 → 36.35 kB; gzip
11.37 → 11.62 kB). Fewer wakeups and layouts are measured; improved kiosk battery
use and smoothness under load are expected, not measured. No FPS increase is
claimed.

An additional 100-completed-round browser soak alternated Solo and multiplayer,
returned Home each time, and exercised real audio with a controlled game clock.
At rounds 10, 50, and 100: 78 listeners, 181 live DOM elements, one AudioContext,
zero live oscillators, zero cards/confetti, and zero animations remained on Home.
GC heap snapshots were 2,863,280 / 3,022,304 / 3,116,176 bytes. The small heap rise
includes browser/automation allocations and does not establish a zero-memory-leak
claim; listener and DOM counts were stable. This bounded soak does not replace
an all-day run on the physical expo station.

## Cleanup

Removed after checking config, dynamic image paths, HTML, CSS, and build behavior:

- `public/assets/cards/Python-logo.svg.webp`: unused source for the displayed PNG.
- `public/assets/cards/robot.webp`: unused source for the displayed PNG.
- `public/assets/cards/ericlemerdy_laptop.png`: identical bytes to `laptop.png`.
- `public/assets/cards/game-controller.png`: identical bytes to `controller.png`.
- `public/assets/cards/light-bulb.png`: identical bytes to `lightbulb.png`.
- `public/assets/sounds/.gitkeep`: obsolete placeholder; sounds are synthesized.
- Unused main-module exports, the round-global players array, repeated input
  clearing, three unused CSS variables, and overridden result-heading declarations.

All eight displayed images are byte-identical to their pre-release versions.
No dependencies removed or added to package.json; Vite remains the sole dev
dependency. Browser tooling reuses the existing isolated installation and is
optional on a fresh checkout. Pre-existing ignored `.checks/` artifacts were
left intact; generated dist, tooling, screenshots, and temporary files are excluded
from the repository and Pages upload. No debug output was found in app code.

## Validation

- 44 Node tests pass, including 200 alternating rounds with cancellation.
- Production build and built-entry/image checks pass. All eight images load
  under `/nawras-memory/`, and their built bytes match public originals.
- A live Vite process held a native module open on Windows, preventing an
  in-place `npm ci` cleanup. Restored the local install, then verified a fresh
  isolated `npm ci --offline` using the same lockfile. This is a local file-lock
  limitation; CI installs into a fresh checkout.
- Solo: frozen centisecond score, moves, shared ranks, stable tie order,
  legacy missing-move eligibility, expired-round exclusion, best-score storage,
  refresh persistence, top-five results, and full Home list.
- Multiplayer: rapid-input guards, 900ms misses, reverse-flip locking, bonus turns,
  score/name/tint synchronization, winner-only saving, 3–3 draws, shared ranks,
  alternate rematch starters, and separation from Solo storage.
- Reset: pending-mismatch pause/Cancel, confirmed resets, resetting during
  completion, Home cancellation, and no score submission from abandoned rounds.
- Normal motion: final flip before 24-piece confetti, 1.8s result transition,
  fixed card geometry, visible effects, and cleanup. Reduced motion verified.
- Audio: nonzero analyser signal, distinct cues, one reusable context, completed
  oscillators disconnected, and playable fallback without AudioContext.
- Inactivity: 60s warning boundary, 10/9 countdown and full unit-tested sequence,
  button/touch/key/movement dismissal with consumed gestures, setup suppression,
  70s return with cleared names/dialogs, expiry during mismatch/reset, preserved
  saved results, and the independent Solo expiry.
- Desktop 1440×900, laptop 1280×720, mobile 390×844, small mobile 320×568,
  and landscape 667×375: centered player panels, turn tints, no gameplay overflow.
  Four sizes also sampled thousands of frames through delayed images, every
  flip, 12 misses, and completion, with no card/control displacement. An older
  local check's 4:5 expectation was corrected to the existing 9:10 card ratio.
- Full menu leaderboard tested with 40 participants per mode, tied top-five
  highlights, keyboard scrolling, visible navigation, and five-entry results.
  Clear confirmation, Cancel/Escape, mode isolation, and refresh persistence pass.
- Page exit cancels the round. Refresh under the production subpath returns to
  setup with scores preserved. No browser runtime or failed HTTP responses in
  the main-flow/subpath checks. Screenshots visually inspected.

The in-app browser execution tool was unavailable, so existing local Chrome
automation was used. Physical kiosk devices, Safari/Firefox, a real multi-hour
expo run, and GitHub-hosted Actions execution remain unverified. Pages publishing
was intentionally not performed. Follow README's exact setup and manual workflow
steps to deploy; leaderboards stay local to each browser/origin.
