# Une vie en 6 minutes

Prototype de scrollytelling 3D pour L214. Le lecteur suit Rosa, un cochon d'élevage fictif, de sa naissance jusqu'au départ pour l'abattoir à 6 mois. Le récit se termine par la vie qu'elle aurait pu avoir en refuge. Le scroll fait avancer le temps : chaque chapitre fige sa scène le temps de la lecture, puis la caméra, la lumière et les décors passent au chapitre suivant. Aucune image graphique n'est montrée ; la fin est une coupure au noir. Tout est dessiné en code (three.js en low-poly), sans image ni son externe et sans étape de build.

**Statut : prototype, pas encore diffusable.** Les durées qui structurent le récit restent à valider par l'équipe avant publication : l'âge de départ (`LIFE_DAYS`, `LIFE_LABEL`), l'espérance de vie dans la comparaison au refuge (`POSSIBLE_YEARS`) et les jours des chapitres, tous dans [`src/chapters.js`](src/chapters.js). Les liens du chapitre « Agir » sont aussi à valider.

## Lancer le jeu

Le jeu utilise des modules ES : il doit être servi en HTTP, car une ouverture directe en `file://` est bloquée par le navigateur.

```bash
python3 -m http.server 5214 --directory une-vie-en-6-minutes
```

Commande à lancer depuis le dossier `games/`, puis ouvrir http://localhost:5214. La même configuration existe dans [`../.claude/launch.json`](../.claude/launch.json) pour le navigateur intégré de Claude Code. three.js est chargé depuis jsDelivr, dans la version épinglée par l'import map de [`index.html`](index.html) : la 3D demande une connexion. Si ce chargement échoue, le récit reste lisible en mode texte.

## Comment le scroll pilote la scène

1. [`src/chapters.js`](src/chapters.js) contient tout le contenu : texte de chaque chapitre et état de sa scène (caméra, ciel, lumière, décors présents, position et taille de Rosa, taille de la foule, fondu au noir, jour affiché). C'est le seul fichier à modifier pour réécrire le récit ou recadrer un plan.
2. [`src/main.js`](src/main.js) génère les sections HTML et active le bouton de retour avant de charger la 3D. [`src/animation.js`](src/animation.js) pilote ensuite la scène : elle garde l'état du chapitre pendant la lecture et calcule la transition après la sortie de la carte, jusqu'à l'entrée de la suivante. Un échec du chargement ou de l'initialisation de la 3D active le mode texte.
3. [`src/world.js`](src/world.js) applique cet état à la scène three.js. Chaque décor (`maternite`, `sol`, `enclos`, `hangar`, `camion`, `sanctuaire`) est un groupe qui s'élève du sol selon sa présence, de 0 à 1. Un dernier passage ([`src/grade.js`](src/grade.js)) étalonne l'image par chapitre : saturation, teinte et vignettage vont de la chaleur de la maternité au gris de l'engraissement, puis au refuge.
4. [`src/pig.js`](src/pig.js) construit le cochon à partir de primitives fusionnées : queue entière ou coupée, avec ou sans les taches qui distinguent Rosa. `applyPigMorphs()` anime la silhouette et le regard. L'âge fait passer des proportions de porcelet (grosse tête, grands yeux, pattes courtes) à celles d'adulte : Rosa change de silhouette en grandissant, elle ne fait pas que s'agrandir. Les paupières utilisent des poses intermédiaires et des corrections adaptées au porcelet pour suivre la surface de l'œil pendant les clignements. La tête de Rosa est une pièce à part : elle tourne vers le lecteur quand le chapitre le demande (`look`), à la naissance, au départ entre les planches du camion, et au refuge.

## Pièges

- **Tout chapitre doit définir tous les champs de scène.** Le mélange ne connaît aucune valeur par défaut au-delà de celles de `scene()`. Il faut notamment `rosa.scale`, que les objets `ROSA_ENCLOS` ne portent pas volontairement. Un champ manquant produit `NaN` et fait disparaître la scène.
- **Conserver l'espace entre les cartes.** [`style.css`](style.css) réserve au moins un écran sous chaque carte, sauf la dernière. Cela permet à [`src/animation.js`](src/animation.js) de terminer la transition avant l'entrée du texte suivant, même lorsque le lecteur agrandit le texte.
- **`ROSA_SLOT` ([`src/world.js`](src/world.js)) doit tomber exactement sur une case de la grille de la foule (4 × 5).** Cette case est retirée de la foule, et `ROSA_ENCLOS.pos` ([`src/chapters.js`](src/chapters.js)) doit avoir les mêmes coordonnées. Sinon, Rosa se superpose à un autre cochon.
- **Les valeurs discrètes (queue, jauge « possible ») basculent au milieu d'une transition**, pas au début : c'est pendant le mouvement de caméra qu'on voit la queue de Rosa changer.
- **Le cadrage dépend de la taille d'écran.** En portrait, le champ de vision s'élargit et le rendu remonte vers le haut ; sur desktop, il se décale à droite pour laisser la place aux cartes (`resize()` dans [`src/world.js`](src/world.js)). Un plan doit donc être vérifié dans les deux formats.

## Ajouter un chapitre ou un décor

- **Chapitre :** ajouter une entrée au tableau `chapters` de [`src/chapters.js`](src/chapters.js), à l'endroit voulu du récit. Le HTML, le scroll et la jauge suivent automatiquement.
- **Décor :** ajouter son nom à `SET_NAMES` ([`src/world.js`](src/world.js)) et à `NO_SETS` ([`src/chapters.js`](src/chapters.js)), écrire une fonction `build…(group)` appelée dans `createWorld`, puis régler sa présence dans les chapitres concernés.

## Accessibilité

Tout le récit est en HTML, avec un titre par chapitre. Le canvas et la jauge sont masqués aux technologies d'assistance (`aria-hidden`). Un texte dans l'épilogue reprend la comparaison de la jauge pour les lecteurs d'écran. Le réglage « réduire les animations » du système coupe la respiration des cochons, le ventilateur et le balancement de la caméra. Sans WebGL ou si three.js ne charge pas, la page affiche le texte seul. Aucun test n'a encore été fait avec un lecteur d'écran ni sur un vrai téléphone.

## Vérifier

Avec le serveur lancé, ouvrir [`tests/pig-design.html`](tests/pig-design.html) pour les tests de géométrie et [`tests/story.html`](tests/story.html) pour les tests du récit. Cette seconde page teste la panne de three.js, la comparaison accessible et les transitions sur mobile, desktop et avec du texte agrandi. Garder le navigateur visible pendant les tests de transition pour que les animations s'exécutent. Les tests de géométrie et de transition nécessitent une connexion à jsDelivr.
