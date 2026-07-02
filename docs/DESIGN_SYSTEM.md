# DESIGN_SYSTEM — Kombien

Direction artistique **normative**. Le frontend implémente ce document à la lettre. Toute
dérive vers un rendu générique (voir §9 Do / Don't) est un bug de design.

Contraintes projet rappelées : mobile-first (le téléphone se passe de main en main),
cibles tactiles ≥ 44px, unités en `rem`/`em` (pas de pixels durs sauf exceptions
documentées), i18n fr/en (aucune chaîne en dur), contrastes AA, `prefers-reduced-motion`,
**aucun emoji en UI** (icônes SVG uniquement), aucune mention IA.

---

## 1. Métaphore retenue — le tableau split-flap (Solari)

**Kombien est un tableau d'affichage à palettes mécaniques** — le *split-flap board*
(dit « tableau Solari ») des gares et aéroports d'avant l'écran LCD. Celui qui claque,
palette après palette, pour dérouler une heure, un quai, une destination.

### Pourquoi cette métaphore et pas une autre

On a écarté les options concurrentes pour des raisons précises :

- **Chronomètre mécanique / sablier** : jolis mais ils *mesurent le temps qui s'écoule
  maintenant*. Or Kombien ne chronomètre rien — il fait **estimer une durée déjà connue**
  puis la **révèle**. Un chrono qui tourne suggérerait au joueur qu'il est pressé, ce qui
  est faux (le jeu n'est pas contre-la-montre). Contresens.
- **Carte de pointage / usine** : registre trop administratif, froid, sans suspense.
- **Split-flap** : c'est le seul dispositif culturel dont la **fonction native est de
  révéler une information temporelle dans un claquement théâtral**. Il coche les trois
  besoins du jeu :

| Besoin du jeu | Ce que le split-flap apporte |
|---|---|
| **Estimer une durée** | Le tableau affiche des durées en gros caractères mécaniques, langage naturel du dispositif (« 2 H 30 »). |
| **Le suspense de la révélation** (§9.3 GAME_DESIGN) | Le déroulé des palettes *est* le suspense : ça claque, ça ralentit, ça s'arrête pile sur la vraie valeur. LE moment fort du jeu a un mécanisme visuel évident. |
| **Le pass-and-play** | Un panneau d'affichage est un objet **partagé, public, tourné vers la salle** — pas un écran perso. Passer le téléphone = « regarde le tableau ». La transition entre joueurs devient un changement d'affichage (palette « QUAI A » → « QUAI B »). |

Le **K** de Kombien (D-001) est traité comme une **palette-logo** : un caractère blanc
sur palette noire, avec la ligne de charnière horizontale au milieu. L'identité de marque
découle directement du composant central.

### Le monde visuel

Objet de référence : un panneau départ/arrivée années 70-80, tôle laquée, palettes
crème sur fond charbon, une teinte de signalisation (jaune ambre) pour l'information
active. Rien de nostalgique-sépia : on veut du **contraste franc, industriel, net** —
graphisme de signalétique de transport, pas de scrapbook vintage.

---

## 2. Palette

**Deux couleurs fortes + un rouge d'alerte réservé, sur un socle de neutres charbon/crème.**
Le split-flap impose sa propre palette : palettes crème sur caisson charbon, information
active en ambre. On ne s'en écarte pas.

### Tokens (source de vérité, à déclarer en CSS custom properties)

Thème **unique et sombre** (voir justification §2.3). Un mode « papier » clair est fourni
en variante optionnelle mais **pas** l'écran par défaut.

```css
:root {
  /* Caisson / structure (le meuble du tableau) */
  --board:        #14161a;   /* charbon profond — fond d'écran principal        */
  --board-raised: #1e2127;   /* surface surélevée (rangée de palettes, cartes)  */
  --hinge:        #0a0b0d;   /* ligne de charnière, séparateurs, ombres portées */

  /* Palettes (les volets qui claquent) */
  --flap:         #ece6d8;   /* crème des palettes au repos — "papier" du split-flap */
  --flap-ink:     #17130c;   /* encre sur palette crème (chiffres, lettres)      */

  /* Accent — ambre de signalisation (information active, sélection, révélation) */
  --amber:        #f0a500;   /* jaune ambre signalétique — accent principal      */
  --amber-ink:    #1a1204;   /* texte sur ambre (toujours foncé)                 */
  --amber-dim:    #7a5600;   /* ambre atténué (états inactifs, jauges de fond)   */

  /* Alerte — rouge signal, RÉSERVÉ (erreur, casse de streak, destructif) */
  --signal:       #d7263d;   /* rouge signalétique — jamais décoratif            */
  --signal-ink:   #fff4f0;

  /* Neutres texte sur caisson sombre */
  --ink-hi:       #f4f1e9;   /* texte principal sur --board (quasi-crème)        */
  --ink-mid:      #a7a294;   /* texte secondaire, labels                         */
  --ink-lo:       #6f6b60;   /* texte désactivé, hints                           */

  /* Succès (parcimonie — le "bon quai") */
  --go:           #2f9e6f;   /* vert quai, validation positive discrète          */
  --go-ink:       #04140d;
}
```

### 2.1 Rôles

- `--amber` = **la couleur du temps actif**. Sélection en cours, palette qui déroule
  pendant la révélation, unité choisie, jauge de streak. C'est la seule couleur « chaude »
  qu'on voit souvent. À ne PAS diluer sur des éléments décoratifs.
- `--flap` / `--flap-ink` = **toute donnée chiffrée/textuelle affichée par le tableau**.
  Les durées, les scores, les pseudos sur les cartes vivent sur des palettes crème.
- `--signal` = **strictement réservé** aux erreurs, à la casse de streak, aux actions
  destructives (quitter la partie). Jamais un bouton primaire, jamais décoratif.
- `--go` = validations positives discrètes (bonne réponse confirmée, badge). Parcimonie :
  ce n'est pas la couleur d'accent, c'est une ponctuation.

### 2.2 Contrastes (WCAG 2.1)

Vérifiés en ratio de contraste. Cible : **AA texte normal ≥ 4.5:1**, AA large/UI ≥ 3:1.

| Avant-plan | Fond | Ratio | Verdict |
|---|---|---|---|
| `--ink-hi` #f4f1e9 | `--board` #14161a | **15.6:1** | AAA |
| `--ink-mid` #a7a294 | `--board` #14161a | **7.4:1** | AAA |
| `--ink-lo` #6f6b60 | `--board` #14161a | **3.6:1** | AA (UI/large uniquement — jamais texte courant) |
| `--flap-ink` #17130c | `--flap` #ece6d8 | **14.9:1** | AAA (le cœur : chiffres sur palette) |
| `--amber-ink` #1a1204 | `--amber` #f0a500 | **9.8:1** | AAA (texte sur bouton ambre) |
| `--amber` #f0a500 | `--board` #14161a | **9.0:1** | AAA (label ambre sur caisson) |
| `--signal-ink` #fff4f0 | `--signal` #d7263d | **5.1:1** | AA |
| `--signal` #d7263d | `--board` #14161a | **4.6:1** | AA (texte d'erreur sur caisson) |
| `--go-ink` #04140d | `--go` #2f9e6f | **6.2:1** | AA |
| `--ink-hi` #f4f1e9 | `--board-raised` #1e2127 | **13.4:1** | AAA |

Règle : `--ink-lo` et `--amber-dim` ne portent **jamais** de texte lisible ≤ 1rem. Ils
servent bordures, jauges de fond, séparateurs, états désactivés.

### 2.3 Un seul thème (justification)

**Thème sombre unique, assumé.** Un tableau split-flap *est* un objet sombre éclairé de
l'intérieur : le charbon du caisson et la crème des palettes constituent déjà un
contraste clair/foncé intégré. Ajouter un mode clair diluerait l'identité (un split-flap
« blanc » n'existe pas visuellement) et doublerait la charge de test sans bénéfice pour un
jeu de soirée souvent joué en intérieur. Le token `--flap` crème fournit déjà les grandes
zones lumineuses nécessaires au confort. Décision : **pas de dark/light toggle**, on livre
un seul thème fort et cohérent.

---

## 3. Typographie

Deux familles, toutes deux **open source et auto-hébergées** (aucun CDN, aucune Inter/Roboto).

### 3.1 Display — **Space Grotesk**

Grotesque à personnalité, dessin technique légèrement rétro-futuriste, terminaisons
tranchées. Elle donne au **K** de Kombien et aux titres un caractère de signalétique
industrielle sans tomber dans le pastiche. Open source (SIL OFL 1.1).

- Usage : logo, titres d'écran (H1/H2), gros libellés de palette-logo, boutons.
- Graisses embarquées : **500 (Medium)**, **700 (Bold)**. (On n'embarque pas tout le
  fichier variable pour rester léger.)
- Traitement : `letter-spacing: 0.02em` sur les titres ; le logo « Kombien » en 700,
  `letter-spacing: -0.01em`, le K pouvant être détaché en palette (cf. §5.7).

### 3.2 Mono / chiffres — **Space Mono**

Monospace de la même famille visuelle (mêmes proportions, même ADN Grotesk). **C'est la
police du tableau** : toutes les durées, tous les chiffres, scores, streaks, unités, minuteurs
s'affichent en Space Mono. Chasse fixe = les chiffres s'alignent en colonnes comme sur un
vrai panneau, et le déroulé split-flap (§5.3) ne « saute » pas en largeur pendant l'animation.
Open source (SIL OFL 1.1).

- Usage : **toute donnée numérique et toute durée**, labels de palette, timestamps,
  compteur de révélation, tags d'unité (`s / min / h / j / sem / mois / an`).
- Graisses embarquées : **400 (Regular)**, **700 (Bold)**.
- `font-variant-numeric: tabular-nums` (déjà garanti par le monospace, mais explicite).

### 3.3 Échelle typographique (base `1rem = 16px`, ratio ~1.25 major third)

| Token | rem | Emploi | Famille |
|---|---|---|---|
| `--fs-mega` | `4.5rem` | Le grand affichage de révélation de durée (split-flap plein écran) | Space Mono 700 |
| `--fs-display` | `3rem` | H1 d'écran (« Kombien », titre de fin de partie) | Space Grotesk 700 |
| `--fs-title` | `2rem` | H2, titre de manche, score géant | Space Grotesk 700 |
| `--fs-heading` | `1.5rem` | H3, en-têtes de carte | Space Grotesk 500 |
| `--fs-lead` | `1.25rem` | Question posée, texte d'intro | Space Grotesk 500 |
| `--fs-body` | `1rem` | Corps, descriptions, règles | Space Grotesk 500 |
| `--fs-mono` | `1rem` | Durées et chiffres inline | Space Mono 400 |
| `--fs-label` | `0.8125rem` | Labels de palette, tags d'unité (MAJUSCULES, `letter-spacing: 0.08em`) | Space Mono 700 |
| `--fs-micro` | `0.6875rem` | Mentions, hints (`text-[11px]` toléré) | Space Mono 400 |

`line-height` : titres `1.05`, lead `1.3`, corps `1.5`, mono `1` (les palettes ne
respirent pas verticalement).

### 3.4 Self-hosting (obligatoire)

Aucune dépendance à `fonts.googleapis.com`. On télécharge les `.woff2` et on les sert
depuis l'app.

1. Récupérer les fichiers depuis les dépôts officiels (SIL OFL 1.1, redistribuables) :
   - Space Grotesk : `github.com/floriankarsten/space-grotesk` (ou fontsource).
   - Space Mono : `github.com/googlefonts/spacemono` (ou fontsource).
   Le plus simple et versionnable : `npm i @fontsource/space-grotesk @fontsource/space-mono`
   puis importer uniquement les graisses voulues, **ou** copier les `.woff2` à la main.
2. Emplacement : `apps/web/src/assets/fonts/` (4 fichiers `.woff2` : SpaceGrotesk-Medium,
   SpaceGrotesk-Bold, SpaceMono-Regular, SpaceMono-Bold). Vite les hashera au build.
3. Déclarer dans `apps/web/src/styles/fonts.css` :

```css
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('../assets/fonts/SpaceGrotesk-Medium.woff2') format('woff2');
}
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('../assets/fonts/SpaceGrotesk-Bold.woff2') format('woff2');
}
@font-face {
  font-family: 'Space Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('../assets/fonts/SpaceMono-Regular.woff2') format('woff2');
}
@font-face {
  font-family: 'Space Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('../assets/fonts/SpaceMono-Bold.woff2') format('woff2');
}

:root {
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-mono: 'Space Mono', ui-monospace, 'SFMono-Regular', monospace;
}
```

4. `font-display: swap` + fallback `system-ui`/`ui-monospace` : aucun texte invisible au
   chargement (respecte « l'utilisateur comprend toujours ce qui se passe »). Précharger la
   Space Mono 700 (la plus visible) via `<link rel="preload" as="font" crossorigin>`.

---

## 4. Iconographie

**Style : trait uniquement (stroke), pas de remplissage, `stroke-width: 2`, bouts et angles
nets (`stroke-linecap: butt` ou `square`, `stroke-linejoin: miter`).** On veut la rigueur
d'une signalétique gravée, pas des icônes rondes « friendly ».

- **Librairie : Phosphor Icons**, poids **`bold`** exclusivement (open source MIT,
  `@phosphor-icons/core` en SVG, tree-shakeable). Phosphor a un trait carré/technique qui
  matche le split-flap ; on refuse le poids `regular` (trop fin) et surtout tout arrondi mou.
  À défaut, Lucide (`stroke-linecap="square"` forcé) est acceptable, mais Phosphor bold est
  le choix par défaut.
- Réglages imposés partout : `currentColor`, `stroke-width: 2` (ou usage des SVG fill de
  Phosphor bold rendus en `--ink-hi`/`--amber`), taille par défaut `1.25rem` (20px),
  `1.5rem` dans les boutons tactiles.
- Icônes récurrentes → mapping sémantique (jamais d'emoji à la place) :

| Sens | Icône Phosphor |
|---|---|
| Durée / temps | `clock` (cadran net) |
| Manche / tour | `arrows-clockwise` |
| Score / points | `stack` ou `coins` |
| Streak / série | `lightning` (l'éclair = « en feu ») |
| Badge | `seal` ou `medal-military` |
| Joueur | `user-square` (carré, cohérent palette) |
| Passer l'appareil | `hand-tap` |
| Valider | `check` (trait net, pas de rond de fond) |
| Erreur / alerte | `warning` en `--signal` |
| Choix de catégorie | `squares-four` |
| Langue | `translate` |

- **Icônes custom autorisées** pour la métaphore là où Phosphor ne suffit pas : le **glyphe
  palette-split** (rectangle à charnière horizontale médiane) sert de puce de liste, de
  bullet de score, et de favicon. Le décrire une fois en composant SVG réutilisable
  (`<Flap>`), jamais dupliqué.
- **Jamais** : icônes multicolores, icônes à ombre portée, glyphes emoji Unicode, icônes
  remplies rondes de style « material ».

---

## 5. Composants clés

Tout composant hérite de la métaphore : surfaces = **palettes** (crème) posées sur le
**caisson** (charbon), avec **ligne de charnière** visible et micro-ombre de relief.

### 5.0 Anatomie d'une « palette » (primitive partagée)

La brique de base. Un rectangle crème avec :
- fond `--flap`, texte `--flap-ink` en Space Mono ;
- une **ligne de charnière** : `border-top`/mid `1px solid --hinge` OU un
  `linear-gradient` horizontal à 50% qui simule la fente centrale
  (`background: linear-gradient(var(--flap) 0 calc(50% - 1px), var(--hinge) 50%, var(--flap) calc(50% + 1px) 100%)`) ;
- coins **peu arrondis** : `border-radius: 0.25rem` max (une palette est presque droite —
  proscrire les `rounded-2xl` mous) ;
- relief : `box-shadow: 0 0.125rem 0 var(--hinge)` (ombre dure sous le volet, pas de blur mou).

### 5.1 Boutons

Trois variantes, toutes en Space Grotesk 700, MAJUSCULES optionnelles pour les libellés
courts, `letter-spacing: 0.04em`.

- **Primaire (palette-action)** : fond `--amber`, texte `--amber-ink`, coins `0.25rem`,
  ombre dure `0 0.1875rem 0 --amber-dim`. Au `:active`, l'ombre se réduit et le bouton
  descend de `0.1875rem` (il « claque » comme une palette qui tombe). C'est le bouton du
  temps/de l'action forte (Valider, Révéler, Commencer).
- **Secondaire (palette-repos)** : fond `--flap`, texte `--flap-ink`, même relief avec
  `--hinge`. Pour les choix neutres (retour, catégorie non sélectionnée).
- **Fantôme** : pas de fond, `1px solid --ink-lo`, texte `--ink-hi`. Actions tertiaires.
- **Destructif** : bordure et texte `--signal`, fond transparent → fond `--signal` au
  survol/appui. Réservé « Quitter / Terminer la partie ».

**Cibles tactiles** : `min-height: 2.75rem` (44px) impératif, `min-width: 2.75rem` pour les
boutons-icônes. Padding confortable `0.75rem 1.25rem`. Sur les écrans de réponse
(Binaire/Ordre de grandeur), les boutons de choix sont **pleine largeur, `min-height: 3.5rem`**
(56px) pour le pouce, empilés avec `gap: 0.75rem`.

### 5.2 (voir 5.3 — le composant central)

### 5.3 Le compteur de révélation de durée — **le Split-Flap** (LE moment fort)

C'est le composant signature. Quand la vraie durée est révélée (§9.3 GAME_DESIGN), le
tableau **déroule** jusqu'à la valeur.

**Structure** : une rangée de « rouleaux » (chaque rouleau = un caractère : chiffre, espace,
ou fragment d'unité). Chaque rouleau est une palette (§5.0) qui affiche un caractère et peut
« tourner » vers le suivant. La durée est formatée en langage naturel via la magnitude
(GAME_DESIGN §2) : `9000s` → `2 H 30`, `259200s` → `3 J`, `45s` → `45 S`.

**Animation du déroulé** :
- À la révélation, chaque rouleau **défile** de sa position de départ jusqu'au bon caractère,
  en claquant palette par palette. Rendu CSS : chaque « claque » = une rotation `rotateX`
  de la moitié haute de la palette qui tombe sur la moitié basse (transform 3D,
  `transform-origin: bottom` / `top`, `perspective: 20rem` sur le conteneur).
- **Cascade de gauche à droite** : les rouleaux ne s'arrêtent pas ensemble. Décalage de
  `70ms` par rouleau — les chiffres de gauche se figent d'abord, celui de droite continue
  de claquer une fraction de seconde de plus. C'est le suspense : on lit « 2 H 3… » et le
  dernier volet hésite avant de tomber sur le bon chiffre.
- **Timing d'un claquement** : `120ms` par palette, easing `cubic-bezier(0.3, 0, 0.2, 1)`
  (départ franc, arrivée nette, comme une charnière mécanique). Un rouleau parcourt 6 à 14
  palettes avant de s'arrêter (assez pour être théâtral, jamais > ~1.4s au total).
- **Son de charnière** (optionnel, désactivable, off par défaut si `prefers-reduced-motion`) :
  un « tac » court synchronisé à chaque claque. Jamais imposé, jamais bloquant.
- **Impact final** : quand le dernier volet se fige, la valeur entière **flash ambre** une
  fois (`--amber` en `box-shadow` glow bref 180ms) puis retombe en crème. C'est le « ding »
  visuel de la vérité révélée.

**Ce même composant** sert, en version réduite (une seule ligne, pas de cascade), à animer
le **score** qui monte et le **compteur de streak**.

`prefers-reduced-motion` : pas de rotation 3D ni de cascade. La valeur apparaît par un
**cross-fade de 160ms** de « ??? » vers la valeur finale, avec le seul flash ambre conservé
(atténué). L'information et le « moment » restent, la mécanique s'efface. (voir §6)

### 5.4 Écran de transition pass-and-play

Moment charnière : le téléphone change de mains. Il doit être **impossible de tricher**
(l'écran suivant ne doit pas être visible) et **clair sur QUI joue**.

- Plein écran `--board`. Au centre, une **grande palette** qui claque pour afficher
  « À TOI — [PSEUDO] » (label `--fs-title`, pseudo sur palette crème). Le claquement de la
  palette annonce le changement, cohérent avec la métaphore « le tableau change d'affichage ».
- Sous-titre `--ink-mid` : rôle du moment (« Tu réponds » / « Tu choisis la catégorie »).
- Un seul gros bouton primaire `min-height: 3.5rem` : « JE SUIS PRÊT · [PSEUDO] ». Tant qu'il
  n'est pas pressé, l'écran de jeu reste masqué (rien du contenu suivant ne fuit).
- Bandeau de charnière ambre fin en haut = repère visuel constant qu'on est « entre deux
  affichages ».
- Micro-indication du sens de passage (icône `hand-tap`), sans jamais nommer physiquement
  « donne à ton voisin » (i18n neutre).

### 5.5 Cartes de question

La question est un **panneau d'annonce**, pas une card blanche.

- Surface `--board-raised`, bord supérieur souligné d'une **ligne de charnière** `--hinge`,
  léger relief `box-shadow: 0 0.25rem 0 var(--hinge)`, coins `0.375rem`.
- En-tête : tag de mode + tag de catégorie en **labels** Space Mono MAJUSCULES sur mini-palettes
  ambre-dim.
- Corps : la question (`--fs-lead`, Space Grotesk 500, `--ink-hi`).
- Zone de réponse selon le mode :
  - **Binaire** : deux grands boutons pleine largeur « OUI, LONGTEMPS » / « NON, PAS
    LONGTEMPS », empilés, `min-height: 3.5rem`.
  - **Ordre de grandeur** : les 7 unités en **grille de mini-palettes** sélectionnables
    (2 colonnes en mobile, 7 en ligne dès `md`). L'unité choisie passe en `--amber`.
  - **Duel** : un champ numérique (gros, Space Mono, `--fs-title`) + un sélecteur d'unité
    en mini-palettes. Le champ ressemble à une palette vide en attente d'être remplie.
- La vraie durée n'apparaît **jamais** avant la phase de révélation (§5.3).

### 5.6 Barre de score / streak

Un **bandeau de tableau** persistant, en haut de l'écran de jeu.

- Deux blocs joueurs (A gauche, B droite), chacun : pseudo (label), **score en Space Mono
  sur palette crème** (le chiffre qui monte via le mini split-flap §5.3), et la **jauge de
  streak**.
- **Jauge de streak** : une rangée de petites diodes/segments. 0-2 = segments `--amber-dim`
  éteints ; à 3 (×2) trois segments s'allument `--amber` + label « ×2 » ; à 5 (×3) cinq
  segments + label « ×3 » et un léger pulse ambre. La casse de streak = les segments
  **retombent** (petit flap inverse) et un flash `--signal` bref. L'éclair `lightning` en
  icône devant.
- Le joueur **actif** est signalé par le bandeau de charnière ambre sous son bloc (repère
  constant de « qui joue »).

### 5.7 Badges

Un badge = une **palette de récompense** estampillée.

- Forme : palette crème carrée à coins `0.375rem`, glyphe Phosphor bold `--flap-ink` centré,
  nom du badge en label Space Mono dessous.
- **Débloqué** : palette crème pleine + liseré `--amber`, glyphe net, micro-animation de
  « claque + flash ambre » à l'obtention (réutilise §5.3).
- **Verrouillé** : palette `--board-raised` (éteinte), glyphe `--ink-lo`, label `--ink-lo`.
  Jamais caché — on montre la silhouette pour donner envie.
- Le K-logo palette peut coiffer l'écran de fin où les badges gagnés défilent.

### 5.8 Logo / marque

« **Kombien** » en Space Grotesk 700. Le **K** est rendu en **palette autonome** : caractère
crème `--flap` sur carré `--board-raised`, charnière médiane visible, posé avant le reste du
mot en `--ink-hi`. Favicon = ce K-palette seul. C'est la signature réutilisable partout
(splash, header, écran de fin).

---

## 6. Motion

Principe : **mécanique, pas organique.** Tout mouvement évoque une charnière/palette qui
tombe — départ décidé, course brève, arrêt net. Jamais de bounce élastique mou, jamais de
fondu lent « éthéré ».

### Durées & easings (tokens)

```css
:root {
  --dur-flap:   120ms;                       /* une claque de palette                */
  --dur-quick:  160ms;                       /* micro-feedback (bouton, toggle)      */
  --dur-move:   240ms;                        /* transition d'écran, apparition carte */
  --ease-flap:  cubic-bezier(0.3, 0, 0.2, 1); /* charnière : franc → net             */
  --ease-out:   cubic-bezier(0.2, 0, 0, 1);   /* sorties/arrivées d'éléments          */
  --flap-stagger: 70ms;                       /* décalage entre rouleaux (cascade)    */
}
```

- **Boutons** : `:active` → descente `0.1875rem` + ombre réduite en `--dur-quick`. C'est
  le « clic mécanique ».
- **Apparition d'écran / carte** : glisse courte de `0.5rem` + fade en `--dur-move`,
  `--ease-out`. Pas de scale, pas de rotation gratuite.
- **Révélation de durée** : voir §5.3 (cascade split-flap, ~0.8–1.4s total, plafonnée).
- **Score/streak** : mini split-flap `--dur-flap` par cran.
- **Interdits** : parallax, drift infini, gradients animés, spinners ronds « loading ».
  Pour l'attente : un **rouleau de palettes qui tourne** (le tableau « cherche ») comme
  loader — cohérent, jamais un spinner générique.

### `prefers-reduced-motion: reduce`

Obligatoire. Comportement :
- **Coupé** : toutes les rotations 3D, cascades, staggers, pulses, le loader-rouleau
  (devient une barre de progression statique déterminée si possible, sinon un label
  « … » interdit → un skeleton de palettes grisées).
- **Conservé, atténué** : les **changements d'état instantanés** (l'info doit rester) et
  **un seul** flash ambre bref (≤ 120ms) sur la révélation, pour garder le « moment » sans
  mouvement. Les transitions d'écran deviennent un cross-fade `120ms` sans déplacement.
- Aucune information ne doit dépendre uniquement du mouvement (la durée révélée s'affiche
  telle quelle, le streak se lit au nombre de segments + label).

---

## 7. Responsive

**Mobile-first strict.** Le design est pensé pour **375px de large tenu à une main**, puis
s'aère. On teste 375 / 768 / 1280 (rappel CLAUDE.md).

### Breakpoints (Tailwind par défaut, conservés)

| Alias | min-width | Rôle |
|---|---|---|
| (base) | 0 | **Téléphone portrait** — la cible primaire. Tout doit marcher ici. |
| `sm` | 640px | Grand téléphone / petit paysage. |
| `md` | 768px | Tablette portrait. |
| `lg` | 1024px | Tablette paysage / desktop. |
| `xl` | 1280px | Desktop large (borne haute de test). |

### Comportements clés

- **Conteneur de jeu** : `width: 100%`, `max-width: 30rem` (480px) centré. Kombien est un
  jeu de téléphone ; même sur desktop on garde une **colonne étroite façon combiné**,
  encadrée par le caisson `--board` qui remplit le reste de l'écran (le meuble du tableau
  déborde, le contenu reste au format téléphone). Pas d'étalement pleine largeur en desktop.
- **Layout par défaut** : `flex-col`. On ne passe en `sm:flex-row` que pour les paires
  logiques (deux blocs joueurs de la barre de score, deux boutons Binaire côte à côte dès
  `sm`).
- **Split-flap de révélation** : les rouleaux réduisent leur `font-size` via `clamp()` pour
  ne jamais déborder :
  `font-size: clamp(2.5rem, 12vw, 4.5rem);` — reste lisible et centré de 375px à 1280px.
- **Grille d'unités (Ordre de grandeur)** : `grid-cols-2` en base → `grid-cols-4` en `sm`
  → `grid-cols-7` en `md`. Chaque mini-palette garde `min-height: 2.75rem`.
- **Cibles tactiles** : jamais < 44px (`2.75rem`) sur mobile, quel que soit le breakpoint.
  Espacement inter-cibles ≥ `0.5rem` pour éviter les appuis voisins.
- **Pas de largeur fixe en px** hors touch-targets/micro-tailles (rappel CLAUDE.md) : tout
  en `rem`, `%`, `clamp()`, `min()`/`max()`.
- **Overflow** : les rangées de palettes qui pourraient dépasser (durées longues,
  timestamps) vont dans un conteneur `overflow-x: auto` ; le body ne défile jamais
  horizontalement.
- Zone de sécurité : `padding` respectant `env(safe-area-inset-*)` (encoches téléphone),
  boutons d'action jamais collés au bord bas.

---

## 8. Densité, espacement, rayons

Pour verrouiller la cohérence et éviter la dérive « card molle » :

```css
:root {
  --radius-flap: 0.25rem;   /* palettes, boutons — presque droit           */
  --radius-card: 0.375rem;  /* panneaux/cartes — max autorisé              */
  --radius-pill: 0.5rem;    /* tags/labels arrondis — le plus arrondi permis */
  /* AUCUN radius > 0.5rem nulle part. Pas de rounded-2xl / rounded-full sur les surfaces. */

  --gap-tight: 0.5rem;
  --gap:       0.75rem;
  --gap-wide:  1.25rem;
  --pad-card:  1.25rem;
}
```

Ombres : **dures uniquement** (`0 Xrem 0 var(--hinge)`), jamais de blur diffus type
`0 10px 40px rgba(...)`. Le relief vient de la charnière et de l'ombre nette, pas d'un halo.

---

## 9. Do / Don't (anti-dérive générique)

### 9.1 À FAIRE

- Traiter chaque surface comme une **palette sur un caisson** : crème sur charbon, charnière
  visible, ombre dure.
- Afficher **toute durée/chiffre** en Space Mono, chasse fixe, alignée en colonnes.
- Réserver `--amber` au **temps actif** et à la **révélation** ; `--signal` aux erreurs/casse.
- Faire **claquer** les transitions (mécanique franche), avec fallback reduced-motion complet.
- Garder le contenu **en colonne étroite façon téléphone**, même sur desktop.
- Icônes **trait net Phosphor bold** en `currentColor`, plus le glyphe palette custom.

### 9.2 À NE JAMAIS FAIRE

- **Aucun dégradé violet→bleu**, aucun dégradé décoratif « SaaS ». Les seuls gradients
  autorisés simulent la **fente de charnière** d'une palette (§5.0).
- **Aucune card blanche arrondie sur fond gris clair.** Fond = charbon, surfaces = palettes
  crème anguleuses. Pas de `rounded-2xl`, pas de `rounded-full` sur les surfaces.
- **Inter / Roboto interdites.** Space Grotesk + Space Mono, self-hosted.
- **Aucun emoji** en guise d'icône, de puce, ou de feedback. Jamais.
- **Aucun spinner rond générique**, aucune ombre floue diffuse, aucun glassmorphism/blur.
- **Pas de chronomètre qui tourne** suggérant une pression temporelle (contresens de jeu, §1).
- **Pas de mode clair** ajouté (thème sombre unique assumé, §2.3).
- **Pas de couleur d'accent multipliée** : deux couleurs fortes max (ambre + signal),
  le reste est neutre charbon/crème.
- **Pas de texte en dur** (i18n fr/en), pas de pixels durs hors touch-targets/micro-tailles.

---

## 10. Récapitulatif pour le frontend (checklist d'implémentation)

1. Copier les 4 `.woff2` dans `apps/web/src/assets/fonts/`, créer `styles/fonts.css` (§3.4),
   précharger Space Mono 700.
2. Déclarer tous les tokens `:root` (couleurs §2, typo §3.3, motion §6, densité §8) dans
   `styles/tokens.css`. Aucune valeur hex/rem/ms en dur dans les composants.
3. Construire la primitive `<Flap>` (palette §5.0) et le `<SplitFlap>` déroulant (§5.3) en
   premier — tout en dépend.
4. Câbler `prefers-reduced-motion` dès le `<SplitFlap>` (fallback cross-fade + flash).
5. Vérifier tous les contrastes (§2.2) et toutes les cibles ≥ 44px (§5.1, §7) avant merge.
6. Tester 375 / 768 / 1280, une main, en conditions de passage d'appareil (§5.4).
