import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyPigMorphs, pigGeometry, rosaGeometries, youthForScale } from './pig.js';
import { GradeShader } from './grade.js';

// Décors en diorama autour de l'origine. Chaque décor (« set ») monte du sol ou s'y enfonce
// selon sa présence 0..1 dans l'état courant.

export const SET_NAMES = ['maternite', 'sol', 'enclos', 'hangar', 'camion', 'sanctuaire'];

const ROSA_SLOT = { x: 0.65, z: 1.56 };
const UP = new THREE.Vector3(0, 1, 0);

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });
const metal = flat('#b7bcc0', { metalness: 0.5, roughness: 0.6 });

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  // Neutral garde les teintes (le rose reste rose) tout en compressant les hautes lumières.
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0x000000, 10, 30);
  // Lumière d'environnement douce : plus aucune face ne tombe dans le noir à contre-jour.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x2b2522, 0.5);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(4, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 12;
  scene.add(hemi, sun);

  const pigMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });

  const sets = Object.fromEntries(
    SET_NAMES.map((name) => {
      const group = new THREE.Group();
      scene.add(group);
      return [name, group];
    }),
  );
  const heatLamp = buildMaternite(sets.maternite, pigMaterial);
  buildSol(sets.sol);
  buildEnclos(sets.enclos);
  const fan = buildHangar(sets.hangar);
  buildCamion(sets.camion);
  buildSanctuaire(sets.sanctuaire, pigMaterial);

  for (const group of Object.values(sets)) {
    group.traverse((object) => {
      if (object.isMesh && !object.userData.noShadow) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  // Rosa : corps tacheté (queue entière / coupée), tête articulée au cou, halo au sol pour la repérer dans la foule.
  const rosa = new THREE.Group();
  const rosaParts = rosaGeometries();
  const rosaFull = new THREE.Mesh(rosaParts.bodyFull, pigMaterial);
  const rosaCut = new THREE.Mesh(rosaParts.bodyCut, pigMaterial);
  const rosaHead = new THREE.Mesh(rosaParts.head, pigMaterial);
  const neck = new THREE.Group();
  neck.add(rosaHead);
  const headTurn = { yaw: 0, pitch: 0 };
  const toCamera = new THREE.Vector3();
  const haloMaterial = new THREE.MeshBasicMaterial({ color: '#ffcf6e', transparent: true, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.68, 0.78, 32), haloMaterial);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.02;
  for (const mesh of [rosaFull, rosaCut, rosaHead]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  rosa.add(rosaFull, rosaCut, neck, halo);
  scene.add(rosa);

  const slots = crowdSlots();
  const crowd = new THREE.InstancedMesh(pigGeometry({ tail: 'cut' }), pigMaterial, slots.length);
  crowd.castShadow = true;
  crowd.receiveShadow = true;
  crowd.frustumCulled = false;
  scene.add(crowd);
  // InstancedMesh ignore morphTargetInfluences : âge et paupières passent par setMorphAt, instance par instance.
  const crowdMorph = { morphTargetInfluences: [0, 0, 0, 0, 0] };

  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const wantedPos = new THREE.Vector3();
  const wantedTarget = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let firstFrame = true;

  // Bloom réservé aux sources lumineuses : seuil au-dessus du blanc des surfaces éclairées.
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 1.2));
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(width, height);
    camera.aspect = width / height;
    // En portrait, on élargit le champ vertical pour garder la largeur du diorama.
    const halfFov = Math.atan((Math.tan(THREE.MathUtils.degToRad(20)) * 1.2) / camera.aspect);
    camera.fov = camera.aspect < 1.2 ? Math.min(72, THREE.MathUtils.radToDeg(2 * halfFov)) : 40;
    // Décale le rendu pour laisser la place au texte : vers le haut sur mobile, vers la droite sur desktop.
    if (camera.aspect < 1) camera.setViewOffset(width, height, 0, height * 0.18, width, height);
    else if (width > 640) camera.setViewOffset(width, height, -width * 0.12, 0, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function render(state, time, dt, reducedMotion) {
    scene.background.copy(state.sky);
    scene.fog.color.copy(state.sky);
    scene.fog.near = state.fog[0];
    scene.fog.far = state.fog[1];
    hemi.intensity = state.hemi * 0.6;
    scene.environmentIntensity = state.hemi * 0.5;
    sun.color.copy(state.sunColor);
    sun.intensity = state.sunIntensity;

    for (const name of SET_NAMES) {
      const group = sets[name];
      const presence = easeOutCubic(state.sets[name]);
      group.visible = presence > 0.001;
      if (name === 'sanctuaire') group.scale.setScalar(Math.max(presence, 0.001));
      else group.scale.set(1, Math.max(presence, 0.001), 1);
    }
    heatLamp.intensity = 6 * state.sets.maternite;
    grade.uniforms.saturation.value = state.grade.saturation;
    grade.uniforms.tint.value.copy(state.grade.tint).convertLinearToSRGB();
    grade.uniforms.tintStrength.value = state.grade.tintStrength;
    grade.uniforms.vignette.value = state.grade.vignette;
    if (!reducedMotion) fan.rotation.z += dt * 3;

    const breathe = (phase) => (reducedMotion ? 1 : 1 + 0.025 * Math.sin(time * 2.2 + phase));

    const r = state.rosa;
    const rosaYouth = youthForScale(r.scale);
    rosa.position.fromArray(r.pos);
    rosa.rotation.y = r.rotY;
    rosa.scale.set(r.scale, r.scale * breathe(0), r.scale);
    applyPigMorphs(rosaFull, rosaYouth);
    applyPigMorphs(rosaCut, rosaYouth);
    applyPigMorphs(rosaHead, rosaYouth, eyelids(r.lids, time, 0.7, 4.3, reducedMotion));
    neck.position.lerpVectors(rosaParts.neck.adult, rosaParts.neck.piglet, rosaYouth);
    rosaFull.visible = r.tail === 'full';
    rosaCut.visible = r.tail !== 'full';
    halo.visible = r.halo > 0.01;
    haloMaterial.opacity = 0.85 * r.halo * (reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(time * 2));

    const spread = (1 - state.crowd.scale) * 0.6;
    const crowdYouth = youthForScale(state.crowd.scale);
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const size = state.crowd.scale * THREE.MathUtils.clamp(state.crowd.count - i, 0, 1);
      position.set(slot.x + slot.jx * spread, 0, slot.z + slot.jz * spread * 0.5);
      quaternion.setFromAxisAngle(UP, slot.rotY);
      scale.set(size, size * breathe(slot.phase), size);
      crowd.setMatrixAt(i, matrix.compose(position, quaternion, scale));
      applyPigMorphs(crowdMorph, crowdYouth, eyelids(state.crowd.lids, time, slot.phase, slot.blinkPeriod, reducedMotion));
      crowd.setMorphAt(i, crowdMorph);
    }
    crowd.instanceMatrix.needsUpdate = true;
    crowd.morphTexture.needsUpdate = true;
    crowd.visible = state.crowd.count > 0.01;

    wantedTarget.fromArray(state.camTarget);
    wantedPos.fromArray(state.camPos);
    if (!reducedMotion) {
      wantedPos.x += Math.sin(time * 0.2) * 0.12;
      wantedPos.y += Math.sin(time * 0.13) * 0.06;
    }
    const follow = firstFrame || reducedMotion ? 1 : 1 - Math.exp(-dt * 5);
    camPos.lerp(wantedPos, follow);
    camTarget.lerp(wantedTarget, follow);
    firstFrame = false;
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    // Tête de Rosa : légère errance au repos, tournée vers le lecteur selon `look`.
    rosa.updateMatrixWorld();
    rosa.worldToLocal(toCamera.copy(camera.position)).sub(neck.position);
    const lookYaw = THREE.MathUtils.clamp(Math.atan2(-toCamera.z, toCamera.x), -1.2, 1.2);
    const lookPitch = THREE.MathUtils.clamp(Math.atan2(toCamera.y, Math.hypot(toCamera.x, toCamera.z)), -0.35, 0.5);
    const idleYaw = reducedMotion ? 0 : Math.sin(time * 0.5) * 0.25;
    const idlePitch = reducedMotion ? -0.05 : Math.sin(time * 0.37) * 0.08 - 0.05;
    const turn = reducedMotion ? 1 : 1 - Math.exp(-dt * 3);
    headTurn.yaw += (THREE.MathUtils.lerp(idleYaw, lookYaw, r.look) - headTurn.yaw) * turn;
    headTurn.pitch += (THREE.MathUtils.lerp(idlePitch, lookPitch, r.look) - headTurn.pitch) * turn;
    neck.rotation.set(0, headTurn.yaw, headTurn.pitch);

    composer.render();
  }

  resize();
  return { render, resize };
}

// 4 × 5 places dans la case ; Rosa occupe l'une d'elles, les autres sont triées par proximité.
function crowdSlots() {
  const random = mulberry32(214);
  const slots = [];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 5; row++) {
      const x = (col - 1.5) * 1.3;
      const z = (row - 2) * 0.78;
      if (x === ROSA_SLOT.x && z === ROSA_SLOT.z) continue;
      slots.push({
        x: x + (random() - 0.5) * 0.16,
        z: z + (random() - 0.5) * 0.12,
        jx: random() * 2 - 1,
        jz: random() * 2 - 1,
        rotY: (random() < 0.5 ? 0 : Math.PI) + (random() - 0.5) * 0.5,
        phase: random() * Math.PI * 2,
        blinkPeriod: 3.5 + random() * 3,
      });
    }
  }
  const distance = (s) => Math.hypot(s.x - ROSA_SLOT.x, s.z - ROSA_SLOT.z);
  return slots.sort((a, b) => distance(a) - distance(b));
}

function buildMaternite(group, pigMaterial) {
  // La truie couchée sur le flanc, ventre vers -z, où tètent les porcelets.
  const sowGeometry = pigGeometry({ tail: 'full' }).clone();
  sowGeometry.translate(0, -0.62, 0);
  // applyMatrix4 ne touche pas aux morph targets : on tourne aussi les deltas (relatifs, donc sans translation).
  const lying = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  sowGeometry.applyMatrix4(lying);
  for (const target of sowGeometry.morphAttributes.position) target.applyMatrix4(lying);
  const sow = new THREE.Mesh(sowGeometry, pigMaterial);
  applyPigMorphs(sow, 0, 0.4);
  sow.scale.setScalar(1.55);
  sow.position.set(0, 0.48, 0.15);
  group.add(sow);

  const x0 = -1.25;
  const x1 = 1.6;
  const z0 = -0.8;
  const z1 = 0.85;
  const bar = (length, [x, y, z], axis) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, length, 6), metal);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  for (const y of [0.35, 0.65, 1.0]) {
    bar(x1 - x0, [(x0 + x1) / 2, y, z0], 'x');
    bar(x1 - x0, [(x0 + x1) / 2, y, z1], 'x');
    bar(z1 - z0, [x0, y, (z0 + z1) / 2], 'z');
    bar(z1 - z0, [x1, y, (z0 + z1) / 2], 'z');
  }
  for (let i = 0; i <= 5; i++) {
    for (const z of [z0, z1]) bar(1.05, [x0 + ((x1 - x0) * i) / 5, 0.525, z], 'y');
  }

  const siblings = [[-0.95, -1.18], [-0.6, -1.25], [-0.25, -1.17], [0.5, -1.22], [0.85, -1.16], [1.2, -1.24]];
  siblings.forEach(([x, z], i) => {
    const piglet = new THREE.Mesh(pigGeometry({ tail: 'full' }), pigMaterial);
    applyPigMorphs(piglet, 1);
    piglet.position.set(x, 0, z);
    piglet.rotation.y = -Math.PI / 2 + Math.sin(i * 2.3) * 0.25;
    piglet.scale.setScalar(0.26 + (i % 3) * 0.015);
    group.add(piglet);
  });

  // Lampe chauffante au-dessus des porcelets.
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 8, 1, true), flat('#5b5f63', { side: THREE.DoubleSide }));
  shade.position.set(-0.6, 1.55, -1.3);
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a55').multiplyScalar(6) }));
  bulb.position.set(-0.6, 1.47, -1.3);
  bulb.userData.noShadow = true;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.6, 4), flat('#222'));
  cable.position.set(-0.6, 2.45, -1.3);
  const light = new THREE.PointLight('#ff8a4a', 6, 0, 2);
  light.position.set(-0.6, 1.35, -1.3);
  group.add(shade, bulb, cable, light);
  return light;
}

function buildSol(group) {
  // Caillebotis : lattes de béton ajourées au-dessus d'une fosse sombre.
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(6.4, 0.08, 0.11), flat('#8d8880'), 34);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 34; i++) slats.setMatrixAt(i, matrix.makeTranslation(0, -0.04, -2.64 + i * 0.16));
  const pit = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 5.6), flat('#221f1c'));
  pit.position.y = -0.25;
  group.add(slats, pit);
}

function buildEnclos(group) {
  const concrete = flat('#a39d94');
  const wall = (w, d, x, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), concrete);
    mesh.position.set(x, 0.45, z);
    group.add(mesh);
  };
  wall(5.72, 0.12, 0, -2.15);
  wall(0.12, 4.3, -2.8, 0);
  wall(0.12, 4.3, 2.8, 0);

  for (const y of [0.4, 0.8]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.6, 6), metal);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, y, 2.15);
    group.add(rail);
  }
  for (let x = -2.8; x <= 2.81; x += 0.7) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), metal);
    post.position.set(x, 0.45, 2.15);
    group.add(post);
  }
}

function buildHangar(group) {
  const panel = flat('#6f6c67');
  const back = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.4, 0.2), panel);
  back.position.set(-0.2, 1.7, -3.0);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 6.4), panel);
  side.position.set(-3.6, 1.7, 0.1);
  group.add(back, side);

  const neon = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e6f7ff', emissiveIntensity: 3 });
  for (const z of [-1.6, 0]) {
    const rafter = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 0.16), flat('#4d4a46'));
    rafter.position.set(-0.2, 3.3, z);
    group.add(rafter);
    for (const x of [-1.6, 1.4]) {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.08), neon);
      tube.position.set(x, 2.95, z);
      tube.userData.noShadow = true;
      group.add(tube);
    }
  }

  // Ventilateur : seule « fenêtre » du bâtiment.
  const fan = new THREE.Group();
  fan.position.set(1.8, 2.1, -2.88);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 4, 16), flat('#3b3936'));
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.02), flat('#8b8f93'));
    blade.position.x = 0.2;
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(blade);
    blades.add(arm);
  }
  fan.add(frame, blades);
  group.add(fan);
  return blades;
}

function buildCamion(group) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 7), flat('#3a3a3e'));
  road.position.y = -0.75;
  group.add(road);
  for (let x = -14; x < 15; x += 2.5) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.12), flat('#e8e4d8'));
    dash.position.set(x, -0.69, 3.0);
    group.add(dash);
  }

  const trailer = flat('#c8c0b0');
  const add = (geometry, material, [x, y, z]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  add(new THREE.BoxGeometry(5.9, 0.12, 4.4), flat('#6b6358'), [0, -0.06, 0]);
  add(new THREE.BoxGeometry(7.6, 0.25, 2.2), flat('#2c2c30'), [0.8, -0.3, 0]);
  // Planches ajourées : on devine les cochons entre les lattes.
  // Hauteurs choisies pour qu'une fente tombe à hauteur des yeux d'un cochon adulte (~0,8).
  for (const y of [0.3, 0.62, 1.1, 1.5, 1.9, 2.3]) {
    for (const z of [-2.2, 2.2]) add(new THREE.BoxGeometry(5.9, 0.22, 0.07), trailer, [0, y, z]);
    add(new THREE.BoxGeometry(0.07, 0.22, 4.4), trailer, [-2.95, y, 0]);
  }
  add(new THREE.BoxGeometry(0.07, 2.5, 4.4), trailer, [2.95, 1.2, 0]);
  add(new THREE.BoxGeometry(6.0, 0.07, 4.5), trailer, [0, 2.48, 0]);
  for (const x of [-2.95, 2.95]) {
    for (const z of [-2.2, 2.2]) add(new THREE.BoxGeometry(0.12, 2.5, 0.12), flat('#9b9384'), [x, 1.2, z]);
  }

  const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  wheel.rotateX(Math.PI / 2);
  for (const x of [-2.2, -1.3, 3.9]) {
    for (const z of [-2.0, 2.0]) add(wheel, flat('#1d1d20'), [x, -0.28, z]);
  }

  add(new THREE.BoxGeometry(1.5, 1.9, 3.2), flat('#3d4f63'), [3.85, 0.75, 0]);
  add(new THREE.BoxGeometry(0.05, 0.7, 2.8), flat('#1c2530', { roughness: 0.3 }), [4.61, 1.2, 0]);
  const headlight = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff3c4').multiplyScalar(3) });
  for (const z of [-1.2, 1.2]) add(new THREE.BoxGeometry(0.05, 0.16, 0.3), headlight, [4.61, 0.1, z]).userData.noShadow = true;
}

function buildSanctuaire(group, pigMaterial) {
  const random = mulberry32(7);

  const groundGeometry = new THREE.CircleGeometry(13, 16, 0, Math.PI * 2);
  groundGeometry.rotateX(-Math.PI / 2);
  const positions = groundGeometry.attributes.position;
  for (let i = 1; i < positions.count; i++) positions.setY(i, (random() - 0.5) * 0.25);
  positions.setY(positions.count - 1, positions.getY(1)); // referme le cercle sans fissure
  const ground = new THREE.Mesh(groundGeometry.toNonIndexed(), flat('#8fc46a'));
  ground.geometry.computeVertexNormals();
  ground.position.y = -0.05;
  group.add(ground);

  const mud = new THREE.Mesh(new THREE.CircleGeometry(1.3, 8), flat('#7b5a3c'));
  mud.rotation.x = -Math.PI / 2;
  mud.scale.x = 1.3;
  mud.position.y = 0.02;
  group.add(mud);

  const trunk = flat('#7a5436');
  const leaves = flat('#5f9e4a');
  for (const [x, z] of [[-4, -3], [-2.5, -5.5], [3.5, -4], [5.2, -1.5], [-5.5, 0.5], [1, -6.8], [-6.5, -4.5]]) {
    const height = 0.9 + random() * 0.6;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, height, 6), trunk);
    t.position.set(x, height / 2, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 + random() * 0.35, 0), leaves);
    crown.position.set(x, height + 0.5, z);
    crown.rotation.set(random(), random(), random());
    group.add(t, crown);
  }

  const hill = flat('#7fb85c');
  for (const [x, z, r] of [[-7, -10, 4], [6, -11, 5], [0, -14, 6]]) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), hill);
    mesh.scale.y = 0.45;
    mesh.position.set(x, -0.6, z);
    group.add(mesh);
  }

  const flowers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.06, 0), flat('#ffffff'), 60);
  const palette = ['#ffe07a', '#ffffff', '#f7a8c8', '#c9a7ff'].map((c) => new THREE.Color(c));
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 2 + random() * 7;
    flowers.setMatrixAt(i, matrix.makeTranslation(Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius));
    flowers.setColorAt(i, palette[i % palette.length]);
  }
  group.add(flowers);

  const sky = (object) => {
    object.userData.noShadow = true;
    group.add(object);
  };
  const sunDisc = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd66b').multiplyScalar(3), fog: false }));
  sunDisc.position.set(-8, 9, -16);
  sky(sunDisc);
  const cloud = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
  for (const [x, y, z] of [[-3, 6.5, -12], [5, 7.5, -14], [9, 6, -9]]) {
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + random() * 0.4, 0), cloud);
      puff.position.set(x + i * 0.8, y + random() * 0.3, z);
      sky(puff);
    }
  }

  // Une compagne, née libre : queue entière.
  const friend = new THREE.Mesh(pigGeometry({ tail: 'full' }), pigMaterial);
  friend.position.set(-2.2, 0, -1.4);
  friend.rotation.y = 2.4;
  friend.scale.setScalar(0.95);
  group.add(friend);
}

// Paupières : niveau d'humeur du chapitre, plus un clignement bref à intervalle propre à chaque cochon.
function eyelids(mood, time, phase, period, reducedMotion) {
  if (reducedMotion) return mood;
  const t = (time + phase) % period;
  return Math.max(mood, t < 0.18 ? Math.sin((t / 0.18) * Math.PI) : 0);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
