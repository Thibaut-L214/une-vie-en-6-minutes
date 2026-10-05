import * as THREE from 'three';
import { chapters, LIFE_DAYS, LIFE_LABEL, POSSIBLE_YEARS } from './chapters.js';
import { createWorld, SET_NAMES } from './world.js';

const hud = document.getElementById('hud');
const hudLabel = document.getElementById('hud-label');
const hudFill = document.getElementById('hud-fill');
const blackout = document.getElementById('blackout');
let cards;

const scenes = chapters.map(({ scene }) => ({
  ...scene,
  sky: new THREE.Color(scene.sky),
  sunColor: new THREE.Color(scene.sunColor),
  grade: { ...scene.grade, tint: new THREE.Color(scene.grade.tint) },
}));

export function startAnimation(storySections, reducedMotion) {
  cards = storySections.map((section) => section.querySelector('.card'));
  const world = createWorld(document.getElementById('scene'));
  window.addEventListener('resize', world.resize);
  let previous = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    const state = currentState();
    world.render(state, now / 1000, dt, reducedMotion.matches);
    updateOverlays(state);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function currentState() {
  const height = window.innerHeight;
  const rects = cards.map((card) => card.getBoundingClientRect());
  let index = 0;
  while (index + 1 < cards.length && rects[index + 1].top <= height) {
    index++;
  }
  const next = Math.min(index + 1, scenes.length - 1);
  // Transition entre la sortie de la carte et l'entrée de la suivante.
  const distance = rects[next].top - height - rects[index].bottom;
  const k = next === index ? 0 : smoothstep(-rects[index].bottom / Math.max(distance, 1));
  return blend(scenes[index], scenes[next], k);
}

function blend(a, b, k) {
  const mix = (x, y) => x + (y - x) * k;
  const mixArray = (x, y) => x.map((value, i) => mix(value, y[i]));
  const pick = (x, y) => (k < 0.5 ? x : y);
  return {
    camPos: mixArray(a.camera.pos, b.camera.pos),
    camTarget: mixArray(a.camera.target, b.camera.target),
    sky: new THREE.Color().lerpColors(a.sky, b.sky, k),
    sunColor: new THREE.Color().lerpColors(a.sunColor, b.sunColor, k),
    fog: mixArray(a.fog, b.fog),
    hemi: mix(a.hemi, b.hemi),
    sunIntensity: mix(a.sunIntensity, b.sunIntensity),
    sets: Object.fromEntries(SET_NAMES.map((name) => [name, mix(a.sets[name], b.sets[name])])),
    rosa: {
      pos: mixArray(a.rosa.pos, b.rosa.pos),
      rotY: mix(a.rosa.rotY, b.rosa.rotY),
      scale: mix(a.rosa.scale, b.rosa.scale),
      halo: mix(a.rosa.halo, b.rosa.halo),
      lids: mix(a.rosa.lids, b.rosa.lids),
      look: mix(a.rosa.look, b.rosa.look),
      tail: pick(a.rosa.tail, b.rosa.tail),
    },
    crowd: {
      count: mix(a.crowd.count, b.crowd.count),
      scale: mix(a.crowd.scale, b.crowd.scale),
      lids: mix(a.crowd.lids, b.crowd.lids),
    },
    grade: {
      saturation: mix(a.grade.saturation, b.grade.saturation),
      tint: new THREE.Color().lerpColors(a.grade.tint, b.grade.tint, k),
      tintStrength: mix(a.grade.tintStrength, b.grade.tintStrength),
      vignette: mix(a.grade.vignette, b.grade.vignette),
    },
    black: mix(a.black, b.black),
    hudOpacity: mix(a.hudOpacity, b.hudOpacity),
    day: mix(a.day, b.day),
    possible: pick(a.possible, b.possible),
  };
}

let lastLabel = '';
function updateOverlays(state) {
  blackout.style.opacity = state.black;
  hud.style.opacity = state.hudOpacity;
  const label = state.possible
    ? `${LIFE_LABEL} sur ${POSSIBLE_YEARS} ans possibles`
    : `Rosa · jour ${Math.max(1, Math.round(state.day))} / ${LIFE_DAYS}`;
  if (label !== lastLabel) {
    hudLabel.textContent = label;
    lastLabel = label;
  }
  const fill = state.possible ? 0.5 / POSSIBLE_YEARS : state.day / LIFE_DAYS;
  hudFill.style.transform = `scaleX(${fill})`;
}

function smoothstep(x) {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}
