# Nawras Memory

A NawrasEdu memory game built with Vite, plain HTML, CSS, and JavaScript.

## Run locally

Use Node.js 22.12+ and npm (npm.cmd on Windows if PowerShell blocks npm.ps1).

```sh
npm install
npm run dev
npm run build
npm run preview
npm run test
```

Production output goes to `dist/`. Vite is the only development dependency;
there are no runtime dependencies.

## Play

Enter a name and press Start. Names are trimmed and limited to 40 characters.
The face-down cards arrive in a short,
660ms stagger; selection and the 60-second countdown begin afterward. Reduced
motion starts immediately. Find all six pairs before time runs out.
A move is two valid selections. Matching cards stay in place;
mismatches turn back after 900ms. Mouse, touch, and keyboard (Tab, Enter, Space)
use the same selection rules. The last match freezes the time and moves
immediately, then celebrates on the stationary board for 1.8 seconds before
showing results. Reduced motion uses a brief static highlight. Time expiry
opens results immediately without a victory celebration.
Reset Game opens a keyboard-accessible confirmation dialog and pauses the
countdown and any pending mismatch. Cancel or Escape resumes the same round.
Reset reshuffles and replays the entrance. Play Again starts a fresh round
with the same player; New Player returns to an empty name entry.
Results emphasize completion seconds for wins or pairs found for time-up
rounds, with moves below. The browser-local Top 5 keeps each player's best
completed round, ranked by full-precision completion time and then moves.
Unfinished rounds are excluded. Names and records stay in this browser;
there is no account or backend service.

## Implementation

- `src/game.js`: Fisher–Yates shuffle, selection guards, matching, deadline-based
  timing, entrance gating, pause/resume, and cancellation of all round callbacks.
- `src/main.js`: landing, accessible card buttons, screen transitions, live
  announcements, focus management, and results. Returning to a visible tab
  checks the deadline; leaving the page cancels the round.
- `src/config.js`: unchanged 60-second duration, 900ms mismatch delay, original
  assets, six configured pairs, and relative `assetUrl()` helper. Also owns the
  660ms entrance, 1800ms winning celebration, player-name length limit,
  `nawras-memory.leaderboard.v1` storage key, and `sound.enabled` /
  `sound.volume` (0–1) settings.
- `src/celebration.js`: final-flip timing, cyan-and-gold glow, short confetti,
  delayed victory sound, and cancelable result transition. Reset confirmation
  pauses and resumes the sequence; starting or leaving cancels old callbacks.
- `src/leaderboard.js`: validated localStorage records, safe name normalization,
  one personal best per player, precision sorting, and once-per-round saving.
  Unavailable storage falls back to records for the current session.
- `src/audio.js`: soft synthesized flip, match, mismatch, win, and expiry tones.
  One audio context unlocks after interaction; completed nodes disconnect.
  Invalid selections emit no sound, flip cues are throttled, and new cues fade
  out older tones. Audio failures leave gameplay available.
- `src/styles.css`: shared logo-sampled navy, cyan, mint, and purple; existing
  system typography, pale blue background, and gold primary buttons. Desktop
  uses four columns and three rows; portrait mobile uses three columns and four
  rows. Cards keep a 4:5 portrait ratio, sized from both the available height
  and width below the compact timer, moves, and reset bar. The centered board
  reserves room for hover, shadows, and keyboard focus. Absolutely positioned
  visual layers keep images and transforms outside grid sizing; a clipped
  board viewport prevents perspective overflow from creating scrollbars.
  Backs use a navy-to-blue gradient, a thin cyan inset line, and cropped cyan
  and lavender contours. A diffuse light center preserves readability of the
  original logo. Hover and focus use stationary cyan outlines and glows;
  successful matches briefly show a gold border and small sparkle before
  settling to a restrained cyan glow, without changing the footprint.
  Reduced motion removes entrance, flips, and decorative motion, and uses
  a static gold match highlight.
- `src/particles.js`: sparse landing particles and their lifecycle. They pause
  while gameplay or results are displayed and resume on returning to Start.
- `vite.config.js`: preserved `base: './'` for GitHub Pages repository subpaths.

## Supplied assets

Original logo files are preserved, including transparency and proportions.
Images use contain sizing without stretching or cropping. The name logo has
no surrounding frame. Every card back uses `nawras-name.png`.

| Asset in public/assets | Purpose |
| --- | --- |
| branding/nawras-name.png | Landing, result header, and all card backs |
| branding/nawras-small.png | NawrasEdu pair |
| cards/python.png | Python pair; existing conversion of supplied WebP |
| cards/robot.png | Robot pair; existing conversion of supplied WebP |
| cards/laptop.png | Laptop pair; existing supplied copy |
| cards/controller.png | Controller pair; existing supplied copy |
| cards/lightbulb.png | Lightbulb pair; existing supplied copy |

Source images also remain in the cards directory. Theme values are centralized
in CSS variables. The sampled palette is navy #082558, cyan #28b9e3, mint
#7edebf, and purple #724cc9. Warm gold continues the landing's primary action.
Missing images display a readable text fallback rather than a broken icon.

## Verification

`npm run test` runs deterministic round tests with Node's built-in test runner,
covering matching, repeated and rapid selections, the exact mismatch delay,
winning, deadline expiry during a mismatch, late timer delivery, entrance
timing, pause/cancel, repeated resets, stale callbacks, sound events, and elapsed
time excluding pauses. The 21 tests also cover frozen winning time,
celebration timing/cancellation/reduced motion, leaderboard precision,
personal-best updates, persistence, safe names, and storage failure.
No test dependencies are needed.

Local browser verification used the production build in Chrome: desktop,
1280x720 laptop, 390px and 320px mobile, and landscape layouts; keyboard and
touch controls; repeated resets during pending mismatches; entrance timing;
dialog focus trapping and Escape; reduced motion; image loading; no gameplay
scrolling or clipping; and no console errors. Gameplay and result screens were
rendered and visually inspected. Browser expiry tests advance a controlled
clock. Audio checks verify real signal output, distinct note sequences, context
reuse, completed-node cleanup, and unavailable-audio fallback. GitHub Pages
subpath serving is checked locally. Physical devices, Safari, and Firefox
have not been checked; deployment remains for later.

Winning-result checks cover the final flip before celebration, exact stopping
time, automatic transition, reset confirmation during celebration, page exit,
time-up without celebration, repeated rounds, duplicate-save prevention,
refresh persistence, and personal-best/tie ordering. Desktop and mobile
results were visually inspected with five rows and an empty leaderboard;
narrow screens scroll vertically without horizontal overflow.

Card polish verification samples outer card, board, and control rectangles
through delayed image loading, entry animation, every card flip, 12 deliberate
mismatches, and matching pairs at desktop, mobile, small mobile, and landscape
sizes. All samples keep their positions and dimensions, with no page overflow
or scrolling. Both faces have identical dimensions and hidden backfaces;
all tested cards maintain 4:5 proportions. Timer and move values have reserved
widths so changing digits cannot nudge neighboring controls.

The navy-card update was checked at desktop, 1280x720 laptop, portrait mobile,
small mobile, and landscape sizes. Hover keeps the visual layer stationary;
keyboard focus stays clearly outlined. Gold match effects, reduced motion,
reset confirmation, and the existing completion sequence were checked.
