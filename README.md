# Nawras Memory

A NawrasEdu browser memory game built with Vite, plain HTML, CSS, and JavaScript.
This stage contains project setup and a styled landing screen only. The Start
button is disabled and labeled “Start”, with a “Gameplay is coming next” tooltip. Matching, the timer,
card flips, and the result screen will be implemented later.

## Run locally

Use Node.js 22.12+ (Node.js 24 recommended) and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. On Windows PowerShell, use `npm.cmd` if
the execution policy blocks `npm.ps1`.

```sh
npm run build
npm run preview
```

The production build is written to `dist/`. Preview serves that build locally.
Vite is the only direct development dependency; there are no runtime dependencies.
The lockfile is included for reproducible installation with `npm ci`.

## Assets

Place original artwork at these exact paths. Do not replace either logo with
a recreation, recolor, crop, or stretched version.

| File | Purpose | Setup status |
| --- | --- | --- |
| `public/assets/branding/nawras-name.png` | Centered landing logo and every future card back | Supplied original, unchanged |
| `public/assets/branding/nawras-small.png` | One of the six matching pairs | Supplied original, unchanged |
| `public/assets/cards/python.png` | Python pair | Converted from supplied `Python-logo.svg.webp` |
| `public/assets/cards/robot.png` | Robot pair | Converted from supplied `robot.webp` |
| `public/assets/cards/laptop.png` | Laptop pair | Copied from supplied `ericlemerdy_laptop.png` |
| `public/assets/cards/controller.png` | Controller pair | Copied from supplied `game-controller.png` |
| `public/assets/cards/lightbulb.png` | Lightbulb pair | Copied from supplied `light-bulb.png` |
| `public/assets/sounds/` | Optional future sound effects | Empty; no sounds supplied or required at setup |

All seven required image assets are present. The supplied source card files
are also preserved in `public/assets/cards/`. WebP conversions preserve image
dimensions and transparency, and PNG copies preserve the original bytes.
No fake logo files were created. A missing or failed landing logo displays a text
label without a broken-image icon.

## Project structure and responsibilities

```text
nawras-memory/
├── public/assets/
│   ├── branding/
│   │   ├── nawras-name.png
│   │   └── nawras-small.png
│   ├── cards/
│   │   ├── python.png
│   │   ├── robot.png
│   │   ├── laptop.png
│   │   ├── controller.png
│   │   ├── lightbulb.png
│   │   └── [preserved supplied source pictures]
│   └── sounds/.gitkeep
├── src/
│   ├── main.js
│   ├── game.js
│   ├── config.js
│   ├── particles.js
│   └── styles.css
├── index.html
├── vite.config.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

- `index.html`: accessible landing screen with the centered name logo, stacked title, labeled player name input, and disabled Start button.
- `src/main.js`: landing initialization, safe loading of the original name logo, and `getPlayerName()` for reading the trimmed name before a future round starts.
- `src/particles.js`: reusable SVG contour paths and circular particles, with CSS motion and cleanup for screen transitions, hidden tabs, and reduced motion.
- `src/game.js`: reserved module for future board, matching, timer, and result behavior; no gameplay yet.
- `src/config.js`: central rules (60 seconds, 900 ms mismatch reveal), six pair IDs and image paths, original card-back path, and the shared `assetUrl()` helper.
- `src/styles.css`: responsive layout and shared theme variables for later screens.
- `vite.config.js`: relative production URLs through `base: './'`.
- `.gitignore`: excludes dependencies, build output, local environment files, and temporary checks.

## NawrasEdu visual identity

Both logos were inspected before styling. With approval to use the logos as
the design reference, the theme uses sampled navy `#082558`, cyan `#28b9e3`,
purple `#724cc9`, mint `#7EDEBF`, and pale surface `#F8F9FB` colors. The remaining
neutral border is a supporting tone. Main colors and the system sans-serif
font stack are centralized in CSS variables for easy adjustment when a full
brand reference is available.

The landing screen centers the original name logo at up to 310px wide,
the stacked navy/cyan title “Nawras Memory” with a soft circular cyan glow behind it,
and an “Enter your name” field with a cyan focus outline. The compact 126×46px
gold Start button remains disabled until gameplay is implemented. The screen uses
a pale blue gradient with soft brand-colored glows and a barely visible 48px grid.
The background uses two flowing contour ribbons on desktop and two
repositioned, simpler ribbons on mobile, plus 48 desktop or 24 mobile circular
particles. The denser organic formation and lighter ribbons with converging
waists follow the two supplied contour references. Each ribbon reuses a small
cubic SVG path; subtle skew and breathing follow
24–28 second CSS transform cycles with different timings and phases for each group.
The 2–5px cyan and lavender particles follow wider floating paths on staggered 16–22 second cycles
using only transforms and low opacity. JavaScript responds to layout and lifecycle
events without an animation-frame loop. Motion pauses when the landing is hidden,
offscreen, or the document is inactive; unmounting removes artwork and observers.
The SVG stays crisp without a raster rendering buffer,
and a vector quiet-area clip keeps the content unobstructed. Only the decorative
layer clips overflow; very short viewports can scroll without clipping
content or keyboard focus indicators. The logo
has no border, frame, or background box, and uses `object-fit: contain` to
preserve proportions and transparency. The original small logo remains in
the six-pair configuration for gameplay. The logo, text, and button fade in once.
The requested warm gold gradient is centralized in `--gold-light`, `--gold`,
and `--gold-deep`; navy button text supplies clear contrast. The button has a
subtle shadow, soft gold hover glow, lift, and a pressed style while retaining
its disabled behavior. Reduced motion shows a static background and disables
entrance animations. Future
card fronts should use `--card-front-background`, large centered pictures,
and this same theme through the board and result screen. The reserved
`--flip-duration` variable is 220 ms with a reduced-motion override; actual
flip animations belong to the gameplay stage.

## Git and eventual GitHub Pages deployment

The project has its own Git repository on the `main` branch. No remote or
deployment workflow is configured.

GitHub Pages deployment will be the final stage. Vite's relative base and the
`assetUrl()` helper prepare both compiled files and public image URLs to work
under a repository path such as `/nawras-memory/`. Always resolve public
assets with `assetUrl('assets/...')`; avoid hard-coded `/assets/...` URLs.
This setup is a single-page landing screen with no client-side routes.
