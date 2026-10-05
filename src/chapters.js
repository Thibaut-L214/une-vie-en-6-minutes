// Récit et mise en scène, chapitre par chapitre.

export const LIFE_DAYS = 180;
export const LIFE_LABEL = '6 mois';
export const POSSIBLE_YEARS = 15;

const NO_SETS = { maternite: 0, sol: 0, enclos: 0, hangar: 0, camion: 0, sanctuaire: 0 };

// `lids` : paupières (0 = yeux grands ouverts, 0,6 = épuisée). `look` : 1 = Rosa tourne la tête vers le lecteur.
const ROSA_PORCELET = { pos: [0.4, 0, -1.8], rotY: -0.6, scale: 0.28, tail: 'full', halo: 0, lids: 0, look: 0 };
const ROSA_ENCLOS = { pos: [0.65, 0, 1.56], rotY: 0.3, tail: 'cut', halo: 1, lids: 0.3, look: 0 };
const ROSA_LIBRE = { pos: [0, 0, 0], rotY: 0.7, scale: 1, tail: 'cut', halo: 0, lids: 0, look: 1 };

const LUMIERE_MATERNITE = { sky: '#1b1a1f', fog: [9, 24], hemi: 0.45, sunColor: '#ffe2c4', sunIntensity: 1.1 };
const LUMIERE_NEON = { sky: '#15181b', fog: [10, 26], hemi: 0.45, sunColor: '#dff1ff', sunIntensity: 1.1 };
const LUMIERE_PLEIN_AIR = { sky: '#a9dcef', fog: [14, 40], hemi: 1.0, sunColor: '#fff1d6', sunIntensity: 1.8 };

// Étalonnage : la couleur raconte le passage de la chaleur maternelle au gris de l'engraissement, puis au refuge.
const GRADE_NEUTRE = { saturation: 1, tint: '#ffffff', tintStrength: 0, vignette: 0.3 };
const GRADE_MATERNITE = { saturation: 1.05, tint: '#ffb070', tintStrength: 0.12, vignette: 0.45 };
const GRADE_NEON = { saturation: 0.85, tint: '#a8c8ff', tintStrength: 0.12, vignette: 0.45 };
const GRADE_GRIS = { saturation: 0.55, tint: '#b8c4c8', tintStrength: 0.15, vignette: 0.65 };
const GRADE_AUBE = { saturation: 0.8, tint: '#ff9e7a', tintStrength: 0.15, vignette: 0.55 };
const GRADE_REFUGE = { saturation: 1.2, tint: '#fff0c8', tintStrength: 0.06, vignette: 0.15 };

function scene(overrides) {
  return {
    black: 0,
    hudOpacity: 1,
    possible: false,
    crowd: { count: 0, scale: 0.4, lids: 0.2 },
    grade: GRADE_NEUTRE,
    ...overrides,
    sets: { ...NO_SETS, ...overrides.sets },
  };
}

export const chapters = [
  {
    id: 'intro',
    title: 'Une vie en 6 minutes',
    body: `
      <p>Voici Rosa. Elle vient de naître dans un élevage de cochons, en France.</p>
      <p>Elle va grandir dans un bâtiment fermé. Suivez sa vie, jour après jour.</p>
      <p class="hint" aria-hidden="true">↓ Faites défiler</p>`,
    scene: scene({
      ...LUMIERE_MATERNITE,
      day: 1,
      camera: { pos: [5, 5.5, 7], target: [0, 0.4, -0.2] },
      sets: { maternite: 1, sol: 1, hangar: 1 },
      rosa: ROSA_PORCELET,
      grade: GRADE_MATERNITE,
    }),
  },
  {
    id: 'maternite',
    kicker: 'Jour 3',
    title: 'Une mère en cage',
    body: `
      <p>Sa mère est enfermée dans une cage de mise bas, à peine plus grande qu'elle. Elle ne peut pas se retourner.</p>
      <p>Avant la naissance, elle aurait voulu construire un nid.</p>`,
    scene: scene({
      ...LUMIERE_MATERNITE,
      day: 3,
      camera: { pos: [2.3, 2.5, -2.7], target: [-0.1, 0.3, -0.5] },
      sets: { maternite: 1, sol: 1, hangar: 1 },
      rosa: { ...ROSA_PORCELET, look: 1 },
      grade: GRADE_MATERNITE,
    }),
  },
  {
    id: 'premiers-jours',
    kicker: 'Jour 5',
    title: 'Les premières interventions',
    body: `
      <p>Dans ses premiers jours, on coupe la queue de Rosa et on meule ses dents.</p>
      <p>Le but : limiter les morsures que provoqueront plus tard le stress et l'ennui, dans un environnement trop pauvre.</p>`,
    scene: scene({
      ...LUMIERE_MATERNITE,
      day: 5,
      camera: { pos: [-0.9, 0.75, -2.75], target: [0.4, 0.18, -1.8] },
      sets: { maternite: 1, sol: 1, hangar: 1 },
      rosa: { ...ROSA_PORCELET, tail: 'cut', lids: 0.35 },
      grade: { ...GRADE_MATERNITE, vignette: 0.6 },
    }),
  },
  {
    id: 'sevrage',
    kicker: 'Jour 28',
    title: 'Séparée de sa mère',
    body: `
      <p>Rosa est retirée à sa mère. Dans la nature, le sevrage se fait progressivement.</p>
      <p>Elle rejoint une case avec des porcelets qu'elle ne connaît pas.</p>`,
    scene: scene({
      ...LUMIERE_NEON,
      day: 28,
      camera: { pos: [3.5, 4.6, 5.2], target: [0.5, 0.2, 0] },
      sets: { sol: 1, enclos: 1, hangar: 1 },
      rosa: { ...ROSA_ENCLOS, scale: 0.4 },
      crowd: { count: 19, scale: 0.4, lids: 0.3 },
      grade: GRADE_NEON,
    }),
  },
  {
    id: 'croissance',
    kicker: 'Jour 70',
    title: 'Un sol de béton',
    body: `
      <p>Pas de paille, pas de terre à fouiller. Le sol est un caillebotis : du béton ajouré qui laisse passer les excréments.</p>
      <p>Rosa est curieuse, intelligente. Ici, elle n'a rien à explorer.</p>`,
    scene: scene({
      ...LUMIERE_NEON,
      day: 70,
      camera: { pos: [-3.2, 4.8, 5.4], target: [0.3, 0.3, 0] },
      sets: { sol: 1, enclos: 1, hangar: 1 },
      rosa: { ...ROSA_ENCLOS, scale: 0.62, lids: 0.4, look: 0.3 },
      crowd: { count: 19, scale: 0.62, lids: 0.4 },
      grade: GRADE_NEON,
    }),
  },
  {
    id: 'engraissement',
    kicker: 'Jour 150',
    title: 'De moins en moins de place',
    body: `
      <p>Rosa a grandi. La case, elle, est restée la même.</p>
      <p>Elle n'a jamais vu la lumière du jour.</p>`,
    scene: scene({
      ...LUMIERE_NEON,
      sky: '#0f1113',
      hemi: 0.35,
      day: 150,
      camera: { pos: [0.5, 7.5, 6.5], target: [0.2, 0.3, 0] },
      sets: { sol: 1, enclos: 1, hangar: 1 },
      rosa: { ...ROSA_ENCLOS, scale: 1, lids: 0.6 },
      crowd: { count: 19, scale: 1, lids: 0.6 },
      grade: GRADE_GRIS,
    }),
  },
  {
    id: 'depart',
    kicker: 'Jour 180',
    title: 'Le départ',
    body: `
      <p>Un matin, Rosa et les autres cochons de sa case sont chargés dans un camion.</p>
      <p>Direction l'abattoir.</p>`,
    scene: scene({
      sky: '#2d2a45',
      fog: [12, 34],
      hemi: 0.6,
      sunColor: '#ffb88a',
      sunIntensity: 1.1,
      day: 180,
      camera: { pos: [2.2, 1.1, 6.5], target: [1.1, 0.85, 1.8] },
      sets: { camion: 1 },
      rosa: { ...ROSA_ENCLOS, scale: 1, rotY: 0.2, halo: 0, lids: 0, look: 1 },
      crowd: { count: 19, scale: 1, lids: 0.1 },
      grade: GRADE_AUBE,
    }),
  },
  {
    id: 'fin',
    title: `Rosa avait ${LIFE_LABEL}.`,
    body: '',
    scene: scene({
      sky: '#000000',
      fog: [12, 34],
      hemi: 0.6,
      sunColor: '#ffb88a',
      sunIntensity: 1.1,
      black: 1,
      hudOpacity: 0,
      day: 180,
      camera: { pos: [3, 3.2, 15], target: [0.8, 0.9, 0] },
      sets: { camion: 1 },
      rosa: { ...ROSA_ENCLOS, scale: 1, rotY: 0.2, halo: 0, lids: 0, look: 1 },
      crowd: { count: 19, scale: 1, lids: 0.1 },
      grade: GRADE_AUBE,
    }),
  },
  {
    id: 'epilogue',
    kicker: 'Et si…',
    title: "La vie qu'elle aurait pu avoir",
    body: `
      <p class="sr-only">${LIFE_LABEL} sur ${POSSIBLE_YEARS} ans possibles.</p>
      <p>Un cochon fouille la terre, se roule dans la boue pour se rafraîchir, reconnaît ses proches, joue.</p>`,
    scene: scene({
      ...LUMIERE_PLEIN_AIR,
      possible: true,
      day: 180,
      camera: { pos: [3.2, 2, 4.6], target: [0, 0.5, 0] },
      sets: { sanctuaire: 1 },
      rosa: ROSA_LIBRE,
      grade: GRADE_REFUGE,
    }),
  },
  {
    id: 'agir',
    title: 'Agir',
    body: `
      <p>Réduire ou arrêter de consommer de la viande de porc, c'est la façon la plus directe d'épargner à d'autres la vie de Rosa.</p>
      <div class="cta">
        <a href="https://www.vegan-pratique.fr/">Découvrir des recettes végétales</a>
        <a href="https://www.l214.com/">Soutenir L214</a>
      </div>
      <button type="button" class="restart" data-action="restart">Revoir depuis le début</button>
      <p class="note">Rosa est un personnage fictif.</p>`,
    scene: scene({
      ...LUMIERE_PLEIN_AIR,
      sunColor: '#ffe1b0',
      possible: true,
      day: 180,
      camera: { pos: [6.5, 4.2, 9.5], target: [0, 0.8, 0] },
      sets: { sanctuaire: 1 },
      rosa: { ...ROSA_LIBRE, look: 0.4 },
      grade: GRADE_REFUGE,
    }),
  },
];
