import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Cochon low-poly en primitives fusionnées, couleurs par sommet.
// À l'échelle 1 : adulte d'environ 1,1 unité de long, museau vers +x, pattes posées sur y = 0.
// Les cinq cibles relatives combinent l'âge avec deux poses de paupières. L'interface
// `applyPigMorphs` masque leurs indices et ajoute les corrections propres au porcelet.
const MORPH = { youth: 0, lidsHalf: 1, lidsClosed: 2, youthLidsHalf: 3, youthLidsClosed: 4 };

export function applyPigMorphs(target, youth = 0, lids = 0) {
  youth = THREE.MathUtils.clamp(youth, 0, 1);
  lids = THREE.MathUtils.clamp(lids, 0, 1);
  const half = lids <= 0.5 ? lids * 2 : (1 - lids) * 2;
  const closed = lids <= 0.5 ? 0 : lids * 2 - 1;
  target.morphTargetInfluences[MORPH.youth] = youth;
  target.morphTargetInfluences[MORPH.lidsHalf] = half;
  target.morphTargetInfluences[MORPH.lidsClosed] = closed;
  target.morphTargetInfluences[MORPH.youthLidsHalf] = youth * half;
  target.morphTargetInfluences[MORPH.youthLidsClosed] = youth * closed;
  return target;
}

const COLORS = {
  skin: '#f2b1ac',
  lid: '#d9918d',
  snout: '#e48c8c',
  mouth: '#7d4545',
  ear: '#e99d98',
  innerEar: '#c97976',
  leg: '#eba5a0',
  hoof: '#5e4646',
  dark: '#231a1a',
  eye: '#3a211d',
  iris: '#180d0c',
  shine: '#ffffff',
  spot: '#9c5f5a',
};

const ADULT = { legLength: 0.34, bodyY: 0.62, body: [1.15, 0.66, 0.62], headX: 0.56, headY: 0.7, head: 1, snout: 0.14, ear: 1, eye: 0.82 };
const PIGLET = { legLength: 0.22, bodyY: 0.5, body: [1.0, 0.64, 0.62], headX: 0.52, headY: 0.68, head: 1.22, snout: 0.08, ear: 1.25, eye: 1.12 };

// Les yeux suivent les côtés du crâne. Rosa regarde le lecteur en tournant la tête.
const EYE_DIRECTION = new THREE.Vector3(0.5, 0.38, 0.78).normalize();
const UP = new THREE.Vector3(0, 1, 0);

const cache = new Map();

// Cochon d'un seul tenant (foule, fratrie, truie, compagne du refuge).
// `spots` : les taches qui distinguent Rosa.
export function pigGeometry({ tail = 'full', spots = false } = {}) {
  return cached(`whole-${tail}-${spots}`, () => morphed((p, lids) => pigParts(p, { tail, spots, lids })));
}

// Rosa en deux pièces : le corps, et la tête exprimée autour de son pivot (le cou),
// pour qu'elle puisse tourner la tête. Le pivot change avec l'âge : `neck.adult` / `neck.piglet`.
export function rosaGeometries() {
  return cached('rosa', () => ({
    bodyFull: morphed((p, lids) => pigParts(p, { tail: 'full', spots: true, lids, only: 'body' })),
    bodyCut: morphed((p, lids) => pigParts(p, { tail: 'cut', spots: true, lids, only: 'body' })),
    head: morphed((p, lids) => pigParts(p, { lids, only: 'head' })),
    neck: { adult: neckPivot(ADULT), piglet: neckPivot(PIGLET) },
  }));
}

// Âge visuel d'un cochon selon sa taille à l'écran : 1 = porcelet, 0 = adulte.
export function youthForScale(scale) {
  return THREE.MathUtils.clamp(1 - (scale - 0.28) / 0.6, 0, 1);
}

function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

function morphed(parts) {
  const base = mergeGeometries(parts(ADULT, 0));
  const piglet = mergeGeometries(parts(PIGLET, 0));
  const half = mergeGeometries(parts(ADULT, 0.5));
  const closed = mergeGeometries(parts(ADULT, 1));
  const pigletHalf = mergeGeometries(parts(PIGLET, 0.5));
  const pigletClosed = mergeGeometries(parts(PIGLET, 1));
  const youth = delta(piglet, base);
  const lidsHalf = delta(half, base);
  const lidsClosed = delta(closed, base);
  base.morphAttributes.position = [
    youth,
    lidsHalf,
    lidsClosed,
    remainder(pigletHalf, base, youth, lidsHalf),
    remainder(pigletClosed, base, youth, lidsClosed),
  ];
  base.morphTargetsRelative = true;
  base.computeVertexNormals();
  return base;
}

function delta(target, base) {
  const values = target.attributes.position.array.slice();
  const origin = base.attributes.position.array;
  for (let i = 0; i < values.length; i++) values[i] -= origin[i];
  return new THREE.BufferAttribute(values, 3);
}

function remainder(target, base, ...parts) {
  const values = target.attributes.position.array.slice();
  const origin = base.attributes.position.array;
  for (let i = 0; i < values.length; i++) {
    values[i] -= origin[i];
    for (const part of parts) values[i] -= part.array[i];
  }
  return new THREE.BufferAttribute(values, 3);
}

function neckPivot(p) {
  return new THREE.Vector3(p.headX - 0.3 * p.head * 0.55, p.headY - 0.02, 0);
}

// Tous les jeux de paramètres doivent produire les mêmes primitives dans le même ordre :
// seule leur position change, sinon les morph targets ne correspondent plus sommet à sommet.
function pigParts(p, { tail = 'full', spots = false, lids = 0, only = 'all' }) {
  const [bx, by, bz] = p.body;
  const headRadius = 0.3 * p.head;
  const snoutX = p.headX + headRadius * 0.8 + p.snout / 2;
  const snoutY = p.headY - 0.04 * p.head;
  const snoutScale = Math.sqrt(p.head);

  const head = [
    part(new THREE.IcosahedronGeometry(0.3, 1), COLORS.skin, { position: [p.headX, p.headY, 0], scale: [p.head, 0.92 * p.head, 0.95 * p.head] }),
    part(new THREE.IcosahedronGeometry(0.18, 0), COLORS.skin, {
      position: [p.headX + 0.02 * p.head, p.headY - 0.15 * p.head, 0],
      scale: [0.95 * p.head, 0.58 * p.head, 0.92 * p.head],
    }),
    part(new THREE.CylinderGeometry(0.12, 0.14, 1, 7), COLORS.snout, {
      position: [snoutX, snoutY, 0],
      rotation: [0, 0, Math.PI / 2],
      scale: [0.82 * snoutScale, p.snout, 1.05 * snoutScale],
    }),
  ];

  for (const side of [-1, 1]) {
    const direction = EYE_DIRECTION.clone().setZ(EYE_DIRECTION.z * side);
    const eyeRadius = 0.07 * p.eye;
    const irisRadius = eyeRadius * 0.42;
    const eyeCenter = new THREE.Vector3(p.headX, p.headY, 0).addScaledVector(direction, headRadius * 0.9);
    const irisCenter = eyeCenter.clone().addScaledVector(direction, eyeRadius * 0.64).addScaledVector(UP, -eyeRadius * 0.04);
    const shineCenter = irisCenter.clone().addScaledVector(direction, irisRadius * 0.68).addScaledVector(UP, irisRadius * 0.42);

    head.push(
      part(new THREE.IcosahedronGeometry(1, 1), COLORS.eye, { position: eyeCenter.toArray(), scale: [eyeRadius, eyeRadius * 0.8, eyeRadius] }),
      part(new THREE.IcosahedronGeometry(1, 1), COLORS.iris, { position: irisCenter.toArray(), scale: [irisRadius, irisRadius, irisRadius] }),
      part(new THREE.IcosahedronGeometry(1, 0), COLORS.shine, { position: shineCenter.toArray(), scale: [irisRadius * 0.34, irisRadius * 0.34, irisRadius * 0.34] }),
      part(eyelidPatch(eyeRadius * 1.1, direction, true, lids), COLORS.lid, { position: eyeCenter.toArray() }),
      part(eyelidPatch(eyeRadius * 1.1, direction, false, lids), COLORS.lid, { position: eyeCenter.toArray() }),
      part(new THREE.CylinderGeometry(0.012, 0.015, 0.008, 5), COLORS.dark, {
        position: [snoutX + p.snout / 2 + 0.006, snoutY - 0.012, side * 0.05 * snoutScale],
        rotation: [0, 0, Math.PI / 2],
      }),
      part(new THREE.ConeGeometry(0.11, 0.21, 3), COLORS.ear, {
        position: [p.headX - headRadius * 0.22, p.headY + headRadius * 0.92, side * headRadius * 0.58],
        rotation: [side * 0.48, 0, -0.55],
        scale: [p.ear, p.ear, 0.72 * p.ear],
      }),
      part(new THREE.ConeGeometry(0.065, 0.13, 3), COLORS.innerEar, {
        position: [p.headX - headRadius * 0.205, p.headY + headRadius * 0.925, side * headRadius * 0.86],
        rotation: [side * 0.48, 0, -0.55],
        scale: [p.ear, p.ear, 0.16 * p.ear],
      }),
    );
  }

  head.push(
    part(new THREE.BoxGeometry(0.008, 0.012, 0.08), COLORS.mouth, {
      position: [snoutX + p.snout / 2 + 0.003, snoutY - 0.075 * snoutScale, 0],
    }),
  );

  const body = [part(new THREE.IcosahedronGeometry(0.5, 1), COLORS.skin, { position: [0, p.bodyY, 0], scale: p.body })];

  for (const x of [-0.26 * bx, 0.26 * bx]) {
    for (const z of [-0.17, 0.17]) {
      body.push(
        part(new THREE.CylinderGeometry(0.075, 0.06, 1, 6), COLORS.leg, { position: [x, 0.06 + p.legLength / 2, z], scale: [1, p.legLength, 1] }),
        part(new THREE.CylinderGeometry(0.036, 0.04, 0.06, 4), COLORS.hoof, { position: [x + 0.012, 0.03, z - 0.025] }),
        part(new THREE.CylinderGeometry(0.036, 0.04, 0.06, 4), COLORS.hoof, { position: [x + 0.012, 0.03, z + 0.025] }),
      );
    }
  }

  const rumpX = -bx * 0.5;
  body.push(
    tail === 'full'
      ? part(new THREE.TorusGeometry(0.07, 0.022, 4, 10, Math.PI * 1.6), COLORS.skin, { position: [rumpX - 0.07, p.bodyY + 0.1, 0] })
      : part(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 5), COLORS.skin, { position: [rumpX - 0.02, p.bodyY + 0.1, 0], rotation: [0, 0, Math.PI / 2] }),
  );

  if (spots) {
    body.push(
      part(new THREE.IcosahedronGeometry(0.5, 1), COLORS.spot, { position: [-0.12 * bx, p.bodyY + by * 0.44, 0.04], scale: [0.34 * bx, 0.1, 0.4 * bz] }),
      part(new THREE.IcosahedronGeometry(0.5, 1), COLORS.spot, { position: [-0.28 * bx, p.bodyY + 0.02, bz * 0.4], scale: [0.26 * bx, 0.22 * by, 0.1] }),
    );
  }

  if (only === 'body') return body;
  if (only === 'head') {
    const pivot = neckPivot(p).negate();
    for (const geometry of head) geometry.translate(pivot.x, pivot.y, pivot.z);
    return head;
  }
  return [...body, ...head];
}

// Deux coques minces suivent la surface de l'œil. La paupière supérieure descend
// devant l'œil quand `closed` augmente ; l'inférieure reste presque immobile.
function eyelidPatch(radius, direction, upper, closed) {
  const horizontal = new THREE.Vector3().crossVectors(UP, direction).normalize();
  const vertical = new THREE.Vector3().crossVectors(direction, horizontal).normalize();
  const sign = upper ? 1 : -1;
  const positions = [];
  const segments = 6;
  const rows = 4;

  const point = (x, y) => {
    const depth = Math.sqrt(Math.max(0, radius * radius - x * x - y * y)) + radius * 0.035;
    return new THREE.Vector3()
      .addScaledVector(horizontal, x)
      .addScaledVector(vertical, y)
      .addScaledVector(direction, depth);
  };

  for (let i = 0; i <= segments; i++) {
    const x = THREE.MathUtils.lerp(-radius * 0.82, radius * 0.82, i / segments);
    const outerY = sign * Math.sqrt(Math.max(0, radius * radius - x * x)) * 0.94;
    const openInnerY = sign * Math.max(0, Math.abs(outerY) - radius * 0.2);
    const closedInnerY = upper ? -Math.abs(outerY) * 0.88 : openInnerY;
    const innerY = THREE.MathUtils.lerp(openInnerY, closedInnerY, closed);
    for (let row = 0; row <= rows; row++) {
      positions.push(...point(x, THREE.MathUtils.lerp(outerY, innerY, row / rows)).toArray());
    }
  }

  const indices = [];
  for (let i = 0; i < segments; i++) {
    for (let row = 0; row < rows; row++) {
      const a = i * (rows + 1) + row;
      const b = a + 1;
      const c = (i + 1) * (rows + 1) + row;
      const d = c + 1;
      if (upper) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function part(source, color, { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const geometry = source.index ? source.toNonIndexed() : source;
  geometry.deleteAttribute('uv');
  geometry.deleteAttribute('normal');
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    ),
  );

  const rgb = new THREE.Color(color);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) rgb.toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
