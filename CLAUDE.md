# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

L214 awareness web games about farmed animals. Each game is a self-contained folder, written only in code: geometry, textures and sound are generated procedurally, with no external image or audio assets. Player-facing text is in French.

When adding a game:
- Create a new top-level folder with its own `README.md`.
- Add a line to the root `README.md` game list.
- Add a configuration to `.claude/launch.json`.

## Commands

There is no build step, package manager or linter. Games are static files that load three.js from jsDelivr through an import map in `index.html`, with the version pinned there. They must be served over HTTP, because ES modules are blocked on `file://`.

```bash
python3 -m http.server 5214 --directory une-vie-en-6-minutes
```

To verify a change, start the server through `.claude/launch.json` (`preview_start` with name `une-vie-en-6-minutes`), then scroll to each chapter. Check the view both in the `mobile` preset and on desktop, because framing differs between the two. Also read the console for errors. `requestAnimationFrame` is paused while the Browser pane is hidden, so a black screenshot right after navigation is usually that, not a bug. The console also keeps errors from earlier loads: check the line numbers against the current file.

For pig geometry changes, open `http://localhost:5214/tests/pig-design.html` while the same server is running. The page reports the geometry checks without a separate test runner.

For story loading, accessibility or scroll changes, open `http://localhost:5214/tests/story.html`. It checks the text fallback when three.js fails, the accessible epilogue comparison, and transitions on mobile, desktop and with enlarged text. Keep the browser visible for the scroll tests so animation frames run.

## Content rules (from README)

- **No unsourced figures.** A statistic or factual claim enters a game only after the L214 team validates and sources it. Never invent or "correct" a figure yourself. In `une-vie-en-6-minutes`, the timeline values in `src/chapters.js` (`LIFE_DAYS`, `LIFE_LABEL`, `POSSIBLE_YEARS`, chapter days) are still unvalidated.
- **No graphic imagery.** Suggest instead of showing, using a cut to black, silence or contrast.
- **RGAA accessibility.**
  - Essential content lives in semantic HTML; the canvas is `aria-hidden`.
  - Respect `prefers-reduced-motion`.
  - The page must stay readable without WebGL (`body.no-webgl`).
- **Mobile first.** Check portrait and desktop.

## Architecture: `une-vie-en-6-minutes`

The scroll position drives a scene state:

1. `src/chapters.js` holds all content: the text of each chapter and a complete scene state for it (camera, sky, lights, set presences, Rosa, crowd, blackout, HUD day).
2. `src/main.js` renders the chapter sections and installs the restart button before loading `src/animation.js`. If the 3D module fails to load or initialize, the story remains available in text mode. On each frame, `animation.js` blends between chapter states only after the current card leaves the viewport and before the next card enters it.
3. `src/world.js` applies the blended state to the three.js scene. Each named set is a `THREE.Group` that rises from the floor according to its presence, from 0 to 1. The composer chain is RenderPass, then bloom, then OutputPass, then the per-chapter grade (`src/grade.js`). The grade runs after OutputPass, so it works on sRGB values.
4. `src/pig.js` builds the pig as merged, vertex-colored primitives. Variants: tail full or cut, and Rosa's spots on or off.
   - `applyPigMorphs()` is the interface for age and eyelid animation. It hides five relative targets: age, half-closed lids, closed lids, and two piglet corrections.
   - Every proportion and lid configuration must emit the same primitives in the same order.
   - On the crowd, `InstancedMesh` ignores mesh-level `morphTargetInfluences`, so `applyPigMorphs()` fills the per-instance values before every `setMorphAt` call.
   - Rosa is split by `rosaGeometries()` into a body and a head built around the neck pivot. `world.js` turns the neck toward the camera according to `rosa.look`.
   - `BufferGeometry.applyMatrix4` doesn't transform morph targets: rotate them by hand, as the sow does.

Invariants that span files:

- **Complete scene states.** `blend()` has no defaults beyond `scene()`, so every chapter must provide every field, including `rosa.scale`, which `ROSA_ENCLOS` deliberately omits. A missing field produces `NaN` and blanks the scene.
- **Set names in two places.** Set names must match between `SET_NAMES` (`world.js`) and `NO_SETS` (`chapters.js`). A new set also needs a `build…(group)` call in `createWorld`.
- **Rosa's slot.** `ROSA_SLOT` (`world.js`) must be exactly one cell of the 4×5 crowd grid, and must equal `ROSA_ENCLOS.pos`. That cell is excluded from the crowd.
- **Space between cards.** `style.css` reserves at least one viewport below each card except the last. This gives `animation.js` room to transition while neither card is visible, even when text grows. Preserve this gap when changing the layout.
- **Discrete fields.** Fields such as `rosa.tail` and `possible` flip at the midpoint of a transition, not at its start.
- **Screen-size framing.** `resize()` widens the FOV in portrait and applies `setViewOffset`: it shifts the render up on mobile and right on desktop, where the cards sit on the left. Camera positions in chapters assume this, so do not pull the camera back to fit portrait. Walls sit just behind several shots.
