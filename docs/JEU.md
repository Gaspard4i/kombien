# Kombien — Description complète du jeu

> Jeu web d'estimation de durée en duo, **pass-and-play** (deux joueurs sur le même
> appareil qu'on se passe de main en main). La question fondatrice : **« Kombien de
> temps ça prend ? »** Deux joueurs estiment la durée de tâches ; le plus juste marque.
>
> En ligne : **https://kombien.gazai.fr**

---

## 1. Le pitch en une phrase

On vous montre une tâche du quotidien (« faire cuire des pâtes », « repeindre une pièce »,
« déployer un site »), et vous devez deviner **combien de temps ça prend**. Votre adversaire
aussi. Le tableau d'affichage déroule alors la vraie durée, palette après palette, et le plus
proche de la vérité marque les points.

Ce n'est **pas** un jeu contre-la-montre : rien ne vous presse. Le sel du jeu, c'est le
**suspense de la révélation** et le fait de se **passer le téléphone** entre les deux joueurs.

---

## 2. Concept et intention

- **En duo, sur un seul téléphone.** Pas de multijoueur en réseau : on joue à deux, côte à
  côte, en se passant l'appareil. Chaque changement de joueur passe par un **écran de
  transition** qui masque le contenu suivant — impossible de voir la réponse de l'autre ou
  la question à venir avant que ce soit son tour.
- **Estimer, pas mesurer.** La durée est déjà connue (c'est une donnée du jeu) ; le joueur
  doit la **deviner**, puis le jeu la **révèle**. D'où la métaphore visuelle du **tableau
  split-flap** (le panneau Solari des gares/aéroports) : le dispositif culturel dont la
  fonction native est justement de *révéler une information temporelle dans un claquement
  théâtral*.
- **Toutes les durées sont en secondes** en interne. L'affichage les traduit en unités
  lisibles (« 2 h 30 », « 3 j », « 45 s »).
- **Bilingue** fr (défaut) / en, choix persistant.

---

## 3. Les unités de temps

Sept unités, chacune avec un facteur de conversion fixe vers la seconde. Le mois vaut
**30 jours** et l'année **365 jours** par convention (pas de calendrier réel).

| Unité   | Slug     | Rang | Facteur (secondes) |
|---------|----------|------|--------------------|
| Seconde | `second` | 0    | 1                  |
| Minute  | `minute` | 1    | 60                 |
| Heure   | `hour`   | 2    | 3 600              |
| Jour    | `day`    | 3    | 86 400             |
| Semaine | `week`   | 4    | 604 800            |
| Mois    | `month`  | 5    | 2 592 000          |
| Année   | `year`   | 6    | 31 536 000         |

Deux unités sont **adjacentes** si leurs rangs se suivent (ex. heure et jour). Cette notion
d'adjacence sert au scoring du mode « ordre de grandeur ».

**Magnitude naturelle** d'une durée = la plus grande unité dont le facteur est ≤ à la durée.
Exemples : 45 s → `seconde`, 60 s → `minute`, 3 600 s → `heure`, 259 200 s (3 jours) → `jour`.
Les bornes sont inclusives en bas (exactement 60 s appartient à `minute`).

---

## 4. Les trois modes de jeu

Une partie se joue dans **un seul mode**, choisi au départ.

### 4.1 Mode Binaire — « ça prend longtemps ? »

On demande si la tâche prend **longtemps** ou **pas longtemps**, relativement à un **seuil
propre à la catégorie** (`threshold_seconds`).

- La durée est « longtemps » si `durée ≥ seuil de la catégorie`.
- Répondre **Oui** est correct si la durée ≥ seuil ; **Non** est correct si durée < seuil.
- Cas limite : durée exactement égale au seuil = « longtemps » (donc **Oui** correct).
- **Bonne réponse = 1 point** (avant multiplicateur de série). Mauvaise = 0.

Chaque joueur répond à son tour à la même question, scoré indépendamment.

### 4.2 Mode Ordre de grandeur — « quelle unité ? »

On demande de choisir, parmi les 7 unités, celle qui correspond le mieux à la durée réelle.
La bonne unité est la **magnitude naturelle** (§3).

| Réponse                              | Points |
|--------------------------------------|--------|
| Unité **exacte**                     | **3**  |
| Unité **adjacente** (rang ±1)        | **1**  |
| Sinon                                | 0      |

Exemple : durée réelle = 3 jours (`day`, rang 3). Choisir `day` → 3 pts ; `hour` ou `week`
→ 1 pt ; `minute` → 0.

### 4.3 Mode Duel — « combien exactement ? »

Chaque joueur saisit une **valeur + une unité** (converties en secondes). On compare les
écarts absolus à la vraie durée.

- Le plus proche marque **2 points**, l'autre 0.
- Égalité stricte d'écart → **1 point chacun**.

C'est le mode le plus précis et le plus compétitif : on ne se contente pas d'un ordre de
grandeur, on avance un chiffre.

---

## 5. Séries (streaks) et multiplicateurs

Chaque joueur a un compteur de **bonnes réponses consécutives**, qui **persiste sur toute la
partie** (à travers les manches) et se réinitialise à 0 dès une réponse non-bonne.

**Ce qui compte comme « bonne réponse » selon le mode :**

| Mode              | Bonne réponse (maintient la série) |
|-------------------|-------------------------------------|
| Binaire           | Réponse correcte (1 pt).            |
| Ordre de grandeur | Exacte **ou** adjacente (≥ 1 pt). L'échec à 0 casse la série. |
| Duel              | Avoir gagné **ou** égalisé le duel (≥ 1 pt marqué). Perdre (0 pt) casse la série. |

**Multiplicateur**, appliqué aux points de base et calculé sur la série *après* la question :

| Série en cours | Multiplicateur |
|----------------|----------------|
| 0, 1, 2        | ×1             |
| 3, 4           | ×2             |
| ≥ 5            | ×3             |

Exemple : en ordre de grandeur, un joueur à 4 bonnes réponses répond exact (3 pts base) →
sa série passe à 5 → ×3 → **9 points** sur cette question.

---

## 6. Progression long terme — XP, niveaux, badges

Au-delà du score d'une partie, chaque **pseudo** a un profil léger qui cumule de l'XP à
travers toutes ses parties. L'XP est **calculée côté serveur** (anti-triche), jamais fournie
par le client, et **jamais multipliée** par les séries.

**Gains d'XP :**

| Action                                             | XP        |
|----------------------------------------------------|-----------|
| Bonne réponse                                      | +10       |
| Réponse exacte en Ordre de grandeur                | +5 bonus  |
| Gagner un duel                                     | +5 bonus  |
| Débloquer un badge                                 | +50       |
| Terminer une partie                                | +25       |
| Gagner une partie                                  | +50 bonus |

**Niveau** (indicatif, pour l'UI) : `niveau = floor(√(xp / 100)) + 1`.

**Badges** (débloqués une seule fois par pseudo) :

| Badge            | Nom               | Condition                                                  |
|------------------|-------------------|------------------------------------------------------------|
| `first_game`     | Première fois     | Terminer sa première partie.                               |
| `speedrunner`    | Speedrunner       | Bonne réponse en moins de 3 secondes.                      |
| `bullseye`       | Dans le mille     | Trouver l'unité exacte en Ordre de grandeur.               |
| `perfect_round`  | Manche parfaite   | Répondre juste à toutes les questions d'une manche.        |
| `on_fire`        | En feu            | Atteindre une série de 5 bonnes réponses.                  |
| `sharpshooter`   | Tireur d'élite    | Gagner un duel avec un écart < 10 % de la durée réelle.    |
| `duel_master`    | Maître du duel    | Remporter 10 duels au total (cumul profil).                |
| `centurion`      | Centurion         | Cumuler 100 points en une seule partie.                    |
| `polyglot`       | Polyglotte        | Jouer une partie en français **et** une en anglais.        |
| `time_lord`      | Seigneur du temps | Atteindre le niveau 10.                                    |

---

## 7. Déroulement d'une partie

### 7.1 Mise en place (setup)

1. **Deux pseudos** (joueur A, joueur B) — un pseudo = un profil, créé s'il n'existe pas.
2. **Mode** : Binaire, Ordre de grandeur ou Duel (un seul pour toute la partie).
3. **Condition de fin** :
   - **Limite de points** : la partie s'arrête à la fin de la manche où un joueur atteint la
     cible (options 30 / 50 / 100, défaut 50).
   - **Arrêt manuel** : on continue manche après manche jusqu'à ce qu'un joueur choisisse
     « Terminer la partie ».
4. **Langue** de la partie (héritée du sélecteur global, mémorisée pour le badge Polyglotte).

### 7.2 Choix de catégorie — le croisement

Avant chaque manche, **un joueur choisit la catégorie que l'autre devra estimer**, en
alternant : manche 1 → A choisit pour B, manche 2 → B choisit pour A, etc. Ce croisement (on
impose sa catégorie à l'adversaire) fait partie du sel du jeu.

### 7.3 La manche

- Une manche = **5 questions** (défaut) tirées au hasard de la catégorie choisie, sans
  répétition dans la partie tant que le stock le permet.
- Pour chaque question, **les deux joueurs répondent** (tour à tour sur l'appareil passé, ou
  chacun sa saisie en Duel), puis **révélation** de la vraie durée via le split-flap, points
  attribués, séries / XP / badges mis à jour.

### 7.4 Fin de partie

Évaluée **en fin de manche** (jamais au milieu). L'écran de fin affiche :

- **Vainqueur** (score le plus élevé) ou **match nul explicite** en cas d'égalité.
- **Scores** finaux des deux joueurs.
- **Précision** de chacun (`bonnes réponses / total`).
- **Meilleure série** atteinte par chacun.
- **Badges** nouvellement débloqués.
- **XP** gagnée.

Ces valeurs viennent **du serveur** : le client envoie les réponses brutes, le backend
recalcule tout (score, séries, XP, badges) pour empêcher la triche.

---

## 8. Contribution et modération

- **Contribuer une question** : n'importe qui peut proposer une nouvelle question (texte fr,
  texte en optionnel, durée + unité, catégorie existante ou nouvelle). Elle part en attente
  (`pending`).
- **Signaler une question** : au moment de la révélation, un bouton permet de signaler une
  question douteuse.
- **Modération (admin)** : un écran d'administration (protégé par un secret) liste les
  questions en attente et permet de les **approuver** ou **rejeter**. Seules les questions
  approuvées apparaissent en jeu.

---

## 9. Identité visuelle — le tableau split-flap

Le jeu adopte la métaphore du **tableau d'affichage à palettes mécaniques** (Solari) :

- **Palettes crème sur caisson charbon**, ligne de charnière visible, ombres dures — pas de
  cards blanches arrondies, pas de dégradés « SaaS ».
- **Accent ambre** = la couleur du temps actif (sélection, révélation, séries). Rouge signal
  réservé aux erreurs / casse de série.
- **Révélation** : le composant signature déroule la durée palette par palette, en cascade de
  gauche à droite, avec un flash ambre final — le moment fort du jeu.
- Typo **Space Grotesk** (titres) + **Space Mono** (tous les chiffres et durées),
  auto-hébergées. Icônes SVG au trait (jamais d'emoji).
- **Thème sombre unique**, **mobile-first** (pensé pour 375 px tenu à une main, cibles
  tactiles ≥ 44 px), accessible (contrastes AA, navigation clavier, `prefers-reduced-motion`
  qui remplace l'animation 3D par un simple fondu).

---

## 10. Écrans de l'application

| Écran            | Rôle |
|------------------|------|
| **Accueil**      | Logo, accès au jeu, au classement, à la contribution ; sélecteur de langue. |
| **Setup**        | Deux pseudos, mode, catégorie de départ, condition de fin. |
| **Jeu**          | Transition pass-and-play, choix de catégorie croisé, question, réponse selon le mode, révélation split-flap, barre de score/série. |
| **Fin de partie**| Vainqueur/nul, scores, précision, meilleure série, badges, XP (depuis le serveur). |
| **Classement**   | Top par XP (global) ou par catégorie ; clic sur un pseudo → profil. |
| **Profil**       | Stats du joueur + badges (débloqués datés, verrouillés en silhouette). |
| **Contribution** | Formulaire de proposition de question. |
| **Admin**        | Modération des questions en attente (protégé par secret). |

---

## 11. Comment jouer, concrètement

1. Ouvrir **https://kombien.gazai.fr** sur un téléphone (idéalement).
2. Entrer deux pseudos, choisir un mode et une condition de fin.
3. Le joueur A choisit une catégorie **pour B**.
4. Pour chaque question, chacun répond à son tour (l'écran de transition masque tout entre
   deux joueurs), puis on regarde ensemble le tableau dérouler la vraie durée.
5. Enchaîner les manches (le choix de catégorie alterne) jusqu'à la limite de points ou
   l'arrêt manuel.
6. Consulter l'écran de fin, les badges gagnés, et grimper au classement au fil des parties.

---

## 12. Comment le projet a été construit — organisation multi-agents (Claude Code)

Kombien a été développé avec **Claude Code** selon une organisation en **agents
spécialisés** orchestrés par une session principale. Cette section documente la *méthode de
travail*, pas le jeu lui-même.

### 12.1 Le principe : une session cheffe + des agents spécialisés

Une **session principale** (le « chef d'orchestre ») lit l'état du projet, découpe le
travail, lance des **sous-agents spécialisés** en parallèle, suit leur avancement, valide et
consolide. Chaque agent a un périmètre précis, ses propres outils et ses propres
instructions — il travaille de façon autonome et rend un rapport à la fin.

Les agents ne discutent pas librement entre eux : ils **rapportent à la session principale**,
qui reste la seule à décider, committer et déployer. Un agent ne peut jamais s'auto-accorder
une permission (pas d'escalade via un pair).

### 12.2 Les agents du projet

Agents définis spécifiquement pour Kombien (dans `.claude/agents/`) :

| Agent             | Rôle |
|-------------------|------|
| **game-designer** | Formalise les règles (scoring, séries, badges, XP) dans `GAME_DESIGN.md`, produit le seed de questions. |
| **backend**       | Schéma PostgreSQL, migrations SQL versionnées, API REST Fastify, logique de scoring/conversion + tests. |
| **frontend**      | UI Vite + Svelte, i18n fr/en, les 3 modes, flow pass-and-play, responsive, intégration API. |
| **design-reviewer** | Définit et audite l'identité visuelle (métaphore du temps, non-générique, mobile-first, accessibilité) via captures Playwright. |
| **devops**        | Dockerfiles multi-stage, compose dev/prod, config Traefik gazai, `deploy.sh`, CI GitHub Actions. |
| **qa**            | Tests e2e Playwright (3 modes, i18n, responsive, contribution, admin), rapport, correction des anomalies. |

### 12.3 Le déroulé effectif

Le projet a suivi ce pipeline, phase après phase :

1. **Découverte** — cadrage (nom, infra serveur inspectée, décisions verrouillées).
2. **Game design + seed** — règles figées, catégories/questions/badges (`game-designer`).
3. **Backend** — schéma, migrations, domaine de scoring, API Fastify, 61 tests unitaires
   (100 % de couverture du domaine).
4. **Frontend + Infra en parallèle** — pendant que l'agent `frontend` bâtissait les écrans,
   l'agent `devops` préparait toute l'infra de déploiement. Les deux périmètres étant
   indépendants, ils ont tourné **en même temps**.
5. **QA** — l'agent `qa` a monté la stack Docker complète, joué les 3 modes de bout en bout,
   testé i18n / responsive / contribution / admin, et **corrigé 6 bugs bloquants** avant
   toute présentation.
6. **Publication** — commits atomiques, push sur `main`, puis **déploiement en production**
   sur gazai après feu vert de l'utilisateur.

### 12.4 Résilience : reprise après panne

Pendant la construction, une **coupure réseau** a interrompu simultanément les agents
`frontend` et `devops` en plein travail. La session principale l'a géré ainsi :

- Elle **n'a pas fait confiance aux statuts de tâches** figés, mais a **inspecté le disque**
  pour établir ce qui avait réellement été écrit.
- Elle a **relancé chaque agent en mode reprise**, avec l'inventaire exact de l'existant,
  pour compléter sans tout refaire.
- Plusieurs agents ayant touché les mêmes fichiers d'infra en parallèle, chacun a **relu
  l'existant avant d'agir** — résultat convergent, sans conflit.

### 12.5 Règles de gouvernance appliquées

Le travail des agents était encadré par des règles strictes, respectées de bout en bout :

- **Sécurité** : aucun secret en clair dans le code/config/docs ; secrets de production
  **générés sur le serveur** (chmod 600), jamais commités ; base de données non exposée ;
  backup de la config Traefik avant toute modification.
- **Anti-triche applicative** : le client envoie les réponses **brutes**, le serveur
  recalcule tout le scoring — un principe imposé dès la conception et vérifié en QA.
- **Validation avant livraison** : build + tests + lint verts avant chaque commit ; QA locale
  complète avant tout déploiement.
- **Aucune action irréversible sans accord** : aucun `git push` ni déploiement en production
  n'a été effectué avant le **feu vert explicite de l'utilisateur**.
- **Commits propres** : atomiques, jamais de `git add -A`, et jamais de mention IA/Claude
  dans le code, les commits ou la documentation.

### 12.6 État actuel

Frontend + backend + infra **déployés en production** sur `kombien.gazai.fr`, HTTPS valide,
conteneurs sains, base seedée. QA e2e 32/32, 61 tests API. Le déploiement est **idempotent** :
relancer `bash infra/deploy.sh` republie les ajustements.
