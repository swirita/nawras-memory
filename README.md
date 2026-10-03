# Nawras Memory

A NawrasEdu expo memory game built with Vite, HTML, CSS, and JavaScript.
Vite is the only development dependency; there are no runtime dependencies,
downloaded fonts, sound files, accounts, or backend services.

## Build and preview

Use Node.js 24 (the CI version), or Node.js 22.12+ with npm.
On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`.

```sh
npm ci
npm test
npm run build
npm run check:build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open **http://127.0.0.1:4173/nawras-memory/** for the production preview.
The deployable output is `dist/`; do not commit it or `node_modules/`.
For development run `npm run dev` and use the URL Vite prints, normally
http://localhost:5173/. Development uses `/`; production and preview use
`/nawras-memory/`.

## GitHub Pages setup

The existing remote is **https://github.com/swirita/nawras-memory**.
The intended Pages URL is **https://swirita.github.io/nawras-memory/**.
This static application needs a Vite build. Serve `dist/`, not the source files.

1. Commit the release changes, including `.github/workflows/`, and push to `main`.
2. Open **Settings → Pages → Build and deployment** in the repository.
   Select **GitHub Actions** as Source. Ensure Actions are enabled.
3. Open **Actions → Deploy GitHub Pages → Run workflow**, choose `main`, and run it.
4. Wait for deployment to pass, then open **https://swirita.github.io/nawras-memory/**.

`ci.yml` tests and builds on pushes to `main` and pull requests.
`pages.yml` installs from the lockfile, runs tests/build/asset checks, uploads only
`dist/`, and deploys with official Pages actions pinned to commit hashes.
Deployment is **manual**: a push runs CI but does not publish. Run the deployment
workflow again for later releases. No publishing was performed during preparation.

`vite.config.js` sets the production base to `/nawras-memory/`.
Dynamic images use `assetUrl()` and Vite's base, so images, scripts, and styles
load under the repository subpath. There is no URL router: screens change on
one page; refresh returns to setup. No SPA fallback or `404.html` is needed.
If renaming the repository or adding a custom domain, update the production
base and the expected subpath in `scripts/check-build.mjs`, then rebuild.

References: [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages)
and [GitHub publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Gameplay and leaderboards

Choose Solo or 2 Players and enter the required names. Names are trimmed,
Unicode-normalized, and limited to 40 characters. Twelve cards contain six pairs.
The 660ms entrance gates input; reduced motion starts immediately.
A move is two valid selections. Matching cards remain in place; mismatches
reveal for 900ms. Rapid and duplicate selections are guarded.

Solo has 60 seconds after entrance. Completion time freezes on the final match.
Best completed rounds sort by displayed centiseconds (0.01 seconds), then moves.
Exact ties share competition ranks (1, 1, 3), with stable stored order. Legacy
records without moves remain supported; unknown moves are never treated as zero.
Unfinished and expired rounds do not qualify.

2 Players has no round time limit and a random first starter. A match awards
one point and another turn. Misses change turns after the reveal delay and the
220ms reverse flip; reduced motion omits the flip wait. Names, score panels,
and cyan/lavender backgrounds identify the active player. Rematch keeps names
and alternates the previous starter. Results show both scores and a winner or
a 3–3 draw. Only winners with 4, 5, or 6 pairs qualify. Each player's best score
is retained; equal scores share ranks without time or moves breaking ties.

Results show **at most five entries**. Home's Leaderboard button shows all
eligible participants in separate Solo/2 Players tabs. Competition ranks stay
the same in both views. The full list highlights ranks 1–5, including ties, and
scrolls while keeping navigation accessible. Clear leaderboard requires
confirmation and removes only the selected mode's scores.

Scores are **local to each browser and origin**, not shared between expo stations.
Storage keys and record formats remain compatible:

- Solo: `nawras-memory.leaderboard.v1`
- Multiplayer: `nawras-memory.multiplayer.leaderboard.v1`

Refresh and future releases at the same origin retain scores. Moving from
localhost to Pages, another browser, or another domain uses different storage;
scores do not migrate automatically. Unavailable storage falls back to the
current session. No server or shared-score service has been added.

## Reset, celebration, and inactivity

The last match celebrates on a stationary board for 1.8 seconds before results;
reduced motion uses a 400ms static highlight. Saving happens once per completed
round when results open. Reset confirmation pauses the round, pending resolution,
or celebration. Cancel/Escape resumes it; Reset starts a clean board with the
same players. Home/New Player clears names and cancels the old round. Abandoned
rounds and reset celebrations do not save scores.

Inactivity is independent of Solo time. At 60 seconds without real pointer,
touch, keyboard, input, or wheel activity, the overlay counts down “Next player
in 10…” through 1. Activity dismisses it and restarts the deadline; the gesture
is consumed so it cannot select a card underneath. At 70 seconds, setup returns,
names and round state clear, dialogs close, and pending callbacks cancel.
Setup suppresses the overlay but clears stale names at the same deadline.
Automatic navigation, animations, sounds, and synthetic events are not activity.
Solo time continues during the overlay. Previously saved scores remain intact.

Sounds use one reusable AudioContext; finished oscillators and gain nodes
disconnect. Audio failure does not prevent gameplay. Returning to a visible
tab checks the exact deadline. Page exit cancels the round; restoration from
the back-forward cache reloads setup.

## Verification and implementation

`npm test` uses Node's built-in test runner with no test dependencies. It checks
rules, deadlines, stale callbacks, reset/pause, eligibility, ties, persistence,
celebration, and inactivity, including 200 alternating rounds with cancellation.
`npm run check:build` checks built entry points, the repository subpath, and all
eight dynamically referenced images against their unchanged original bytes.

See [the release audit](docs/release-report.md) for measurements, browser checks,
cleanup, and remaining checks. Chrome production checks use existing local
tooling in ignored `.checks/`, which is not a runtime or CI dependency.
Before the expo, check the published URL on the actual kiosk with its audio,
touch input, and display scaling. Safari and Firefox need separate checks.

Optional browser checks reuse Playwright Core from `.checks/node_modules/`.
On a fresh checkout, install the isolated tooling and run against the preview:

```sh
npm install --prefix .checks --no-save --no-package-lock playwright-core
npm run check:browser
npm run check:soak
npm run measure:browser -- after
```

These commands use an installed Chrome browser, defaulting to its Windows
installation path. Set `CHROME_PATH` for other installations, and `RELEASE_URL`
for a different preview host/port (include `/nawras-memory/`). They write
screenshots and measurements only to ignored `.checks/`.

- `src/game.js`: shuffle, exact deadlines, selection, turns, and timer cancellation.
- `src/main.js`: screens, delegated card input, guarded display updates, dialogs,
  accessibility, results, and leaderboard views.
- `src/leaderboard.js`: validated best records, storage compatibility, and ranks.
- `src/idle.js`, `src/celebration.js`, `src/mode-switch.js`: separately owned,
  cancelable inactivity, completion, and setup transitions.
- `src/particles.js`: landing-only SVG motion, scoped observers, layout reuse,
  hidden-page pausing, and unmount cleanup.
- `src/audio.js`: synthesized cues and completed-node cleanup.
- `src/config.js`: current rules, storage keys, and asset paths.
- `src/styles.css`: current 9:10 cards, fixed layout, contours, glows, transforms,
  turn tints, and reduced-motion behavior.

Displayed assets preserve their bytes, transparency, and sizing: the three
`public/assets/branding/` logos and `cards/{python,robot,laptop,controller,lightbulb}.png`.
Missing images retain a readable text fallback.
