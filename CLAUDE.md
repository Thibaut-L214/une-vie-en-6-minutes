# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

"Une vie en 6 minutes": an L214 3D scrollytelling prototype. The reader follows Rosa, a fictional farmed pig, from birth to departure for the slaughterhouse at 6 months, then sees the life she could have had in a sanctuary. Scroll advances time: each chapter freezes its scene while the card is read, then camera, light and sets transition to the next chapter. Everything is drawn in code (low-poly three.js): no external image or audio assets. Player-facing text and code comments are in French.

## Commands

No build step, package manager, linter or test runner. three.js loads from jsDelivr through the import map in `index.html` (version pinned there and again in `tests/pig-design.html`; keep both in sync). ES modules are blocked on `file://`, so serve over HTTP from the repo root:

```bash
python3 -m http.server 5214
```

In Claude Code, use `preview_start` with name `une-vie-en-6-minutes` (`.claude/launch.json`).

Verifying a change:
- Scroll through every chapter in both the `mobile` preset and desktop: framing differs between the two. Read the console for errors.
- `requestAnimationFrame` pauses while the Browser pane is hidden, so a black screenshot right after navigation is usually that, not a bug. The console keeps errors from earlier loads: check line numbers against the current file.
- Pig geometry changes: open `http://localhost:5214/tests/pig-design.html`. The page runs and reports the geometry checks itself.
- Story loading, accessibility or scroll changes: open `http://localhost:5214/tests/story.html`. It loads `index.html` in iframes and checks the text fallback when three.js fails, the accessible epilogue comparison, and transitions on mobile, desktop and with enlarged text. Keep the browser visible so animation frames run.
- Both test pages need network access to jsDelivr.

## Content rules

- **No unsourced figures.** A statistic or factual claim enters the game only after the L214 team validates and sources it. Never invent or "correct" a figure. The timeline values in `src/chapters.js` (`LIFE_DAYS`, `LIFE_LABEL`, `POSSIBLE_YEARS`, chapter days) and the links in the "Agir" chapter are still unvalidated; the prototype is not ready for release.
- **No graphic imagery.** Suggest instead of showing: cut to black, silence, contrast.
- **RGAA accessibility.** Essential content lives in semantic HTML (one heading per chapter); the canvas, blackout and HUD are `aria-hidden`. An `sr-only` line in the epilogue repeats the HUD comparison. Respect `prefers-reduced-motion` (it stops breathing, fan and camera sway). The page must stay readable without WebGL (`body.no-webgl`).
- **Mobile first.** Check portrait and desktop.

## Architecture

The scroll position drives a scene state:

1. `src/chapters.js` holds all content: each chapter's text plus a complete scene state (camera, sky, lights, set presences, Rosa, crowd, blackout, HUD day). Rewriting the story or reframing a shot only touches this file. Adding a chapter = adding an entry to `chapters`; HTML, scroll and HUD follow.
2. `src/main.js` renders the chapter sections and the restart button, then dynamically imports `src/animation.js`. If the 3D module fails to load or initialize, it adds `no-webgl` and the story stays readable as text. On each frame, `animation.js` holds the chapter state while its card is visible and `blend()`s toward the next one only between the current card leaving the viewport and the next one entering.
3. `src/world.js` applies the blended state to the three.js scene. Each named set (`SET_NAMES`) is a `THREE.Group` that rises from the floor according to its presence (0 to 1). Composer chain: RenderPass → bloom → OutputPass → per-chapter grade (`src/grade.js`). The grade runs after OutputPass, so it works on sRGB values.
4. `src/pig.js` builds pigs from merged, vertex-colored primitives. Variants: tail full or cut, Rosa's spots on or off.
   - `applyPigMorphs()` is the interface for age and eyelid animation. It hides five relative morph targets: age, half-closed lids, closed lids, two piglet corrections. Age changes proportions (piglet: big head, big eyes, short legs), not just size.
   - Every proportion and lid configuration must emit the same primitives in the same order.
   - The crowd is an `InstancedMesh`, which ignores mesh-level `morphTargetInfluences`: `applyPigMorphs()` fills per-instance values before every `setMorphAt` call.
   - `rosaGeometries()` splits Rosa into a body and a head built around the neck pivot; `world.js` turns the neck toward the camera according to `rosa.look`.
   - `BufferGeometry.applyMatrix4` doesn't transform morph targets: rotate them by hand, as the sow does.

## Cross-file invariants

- **Complete scene states.** `blend()` has no defaults beyond `scene()`, so every chapter must provide every field, including `rosa.scale`, which `ROSA_ENCLOS` deliberately omits. A missing field produces `NaN` and blanks the scene.
- **Set names in two places.** `SET_NAMES` (`world.js`) and `NO_SETS` (`chapters.js`) must match. A new set also needs a `build…(group)` function called in `createWorld`.
- **Rosa's slot.** `ROSA_SLOT` (`world.js`) must be exactly one cell of the 4×5 crowd grid and equal `ROSA_ENCLOS.pos` (`chapters.js`). That cell is excluded from the crowd; otherwise Rosa overlaps another pig.
- **Space between cards.** `style.css` reserves at least one viewport below each card except the last, so `animation.js` can transition while no card is visible, even with enlarged text. Preserve this gap when changing layout.
- **Discrete fields** (`rosa.tail`, `possible`) flip at the midpoint of a transition, not at its start.
- **Screen-size framing.** `resize()` widens the FOV in portrait and applies `setViewOffset`: render shifted up on mobile, right on desktop (cards sit on the left). Chapter camera positions assume this, so don't pull the camera back to fit portrait; walls sit just behind several shots.
