# Zone Grise

Top-down mobile extraction shooter (Vite + TypeScript), played on a phone at https://nicophil.github.io/zone-grise/.
Pushing `main` deploys: the GitHub Action runs lint, tests and build, and publishes only if all pass.

## Before every push

`npm run lint && npm test && npm run build`

- Never silence Biome with `biome-ignore`: split the function or file instead. Size and complexity rules only warn while
  `draw()`, `update()` and `updateEnemy()` are too big; any new code must stay under the limits in `biome.json`.
- `npm run format` formats; the formatting commit is listed in `.git-blame-ignore-revs`.

## Layout

- Rules: `src/raid.ts` (raid loop), `src/items.ts`, `src/zones.ts`, `src/progression.ts`, `src/state.ts` (save), `src/aware.ts`,
  `src/world/` (map, geometry, pathfinding, vault).
- Display: `src/render/` (canvas), `src/ui/` (DOM screens). Rules must not grow new imports from these two.
- The save lives in `localStorage` under `zone-grise-save`; any change to `Save` needs a migration in `parseSave`, with a test.

## Tests

- `tests/raid.test.ts` runs the real `update()` loop with canvas, UI and input mocked: copy its setup to test raid behaviour.
- Maps are random: a test must hold on any map (place things relative to the player or an exit, not at fixed coordinates).
- A new rule gets a test that fails without it.

## Product decisions (keep them)

- One action = one icon, the same everywhere (equip, sell, buy, drop, take, use, close).
- Item details open as a tooltip card pinned to the tapped item, not at the bottom of the screen.
- No prices during a raid. The stash lists upgrades over worn gear first.
- No sound for now.
- UI text is French; code, comments and commit messages are English.

## Checking in a browser

- Restart the Vite dev server before each check: after hot edits it can serve a stale module (`R` stays null).
- Headless browsers throttle `requestAnimationFrame` (~0.05 s of game per real second): advance the game by calling
  `update(1/60)` in a loop instead of waiting.
- Check at phone size (390×844).

## Assets

Kenney Topdown Shooter sprites (CC0). `kenney.nl` may be blocked: the GitHub mirror `series-ai/jam-ready-assets` has them.
`public/assets/characters.png` has no atlas: sprite rectangles are hand-picked in `src/render/assets.ts`.
