# GAME_DESIGN — Kombien

Spécification complète du scoring et du déroulement de jeu. Cette spec est **normative** : un développeur backend doit pouvoir implémenter la totalité de la logique sans poser de question. Toute durée est stockée et calculée **en secondes**.

Convention de vocabulaire :
- `duration_seconds` : durée réelle de la question (vérité terrain), en secondes.
- `threshold_seconds` : seuil de la catégorie (mode Binaire), en secondes.
- « rang » : position d'une unité dans l'échelle d'adjacence (voir §1).

---

## 1. Unités de temps

Sept unités, chacune avec un facteur de conversion vers la seconde.

| Unité    | Slug     | Rang | Facteur (secondes) |
|----------|----------|------|--------------------|
| Seconde  | `second` | 0    | 1                  |
| Minute   | `minute` | 1    | 60                 |
| Heure    | `hour`   | 2    | 3 600              |
| Jour     | `day`    | 3    | 86 400             |
| Semaine  | `week`   | 4    | 604 800            |
| Mois     | `month`  | 5    | 2 592 000 (30 j)   |
| Année    | `year`   | 6    | 31 536 000 (365 j) |

**Ordre d'adjacence** (croissant) : `second (0) < minute (1) < hour (2) < day (3) < week (4) < month (5) < year (6)`.

Le mois vaut **30 jours** et l'année **365 jours** par convention fixe (pas de calendrier réel, pas d'années bissextiles). Ces facteurs sont des constantes du jeu, jamais recalculés.

### 1.1 Conversion valeur+unité → secondes

```
secondes = valeur * facteur(unité)
```

`valeur` est un nombre réel positif (`> 0`). Exemple : `2.5` `hour` → `2.5 * 3600 = 9000` secondes.

### 1.2 Rang d'une unité

`rang(unité)` renvoie l'entier de la colonne « Rang ». Deux unités sont **adjacentes** si `|rang(a) - rang(b)| == 1`.

---

## 2. Magnitude naturelle d'une durée

Plusieurs modes ont besoin de connaître « l'unité correcte » d'une durée réelle. On l'appelle la **magnitude naturelle**.

**Définition** : la magnitude naturelle d'une durée `d` (en secondes) est la **plus grande unité** dont le facteur est `<= d`. Autrement dit, l'unité la plus grande telle que `d / facteur >= 1`.

```
fonction magnitudeNaturelle(d):  # d en secondes, d > 0
    pour chaque unité de la PLUS GRANDE (year) à la PLUS PETITE (second):
        si d >= facteur(unité):
            renvoyer unité
    renvoyer second   # cas d < 60 : aucune unité >= minute ne convient, la magnitude est "second"
```

Cas limites (bornes inférieures inclusives) :

| Durée (s)  | Calcul                    | Magnitude naturelle |
|------------|---------------------------|---------------------|
| 45         | 45 < 60                   | `second`            |
| 59         | 59 < 60                   | `second`            |
| 60         | 60 >= 60                  | `minute`            |
| 120        | 120 >= 60, < 3600         | `minute`            |
| 3599       | < 3600                    | `minute`            |
| 3600       | >= 3600                   | `hour`              |
| 86400      | >= 86400                  | `day`               |
| 259200     | 3 j, >= 86400, < 604800   | `day`               |
| 604800     | >= 604800                 | `week`              |
| 2592000    | >= 2592000                | `month`             |
| 31536000   | >= 31536000               | `year`              |

Règle de borne : **inclusive** en bas. Exactement `= facteur(unité)` appartient à cette unité (ex : `60s → minute`, pas `second`). Une durée `< 60s` a pour magnitude `second` (borne basse ouverte à 0, il n'existe pas d'unité plus petite).

---

## 3. Mode Binaire

**Question posée** : « Est-ce que ça prend longtemps ? » Le joueur répond **Oui** (« longtemps ») ou **Non** (« pas longtemps ») relativement au `threshold_seconds` de la catégorie.

**Bonne réponse** :
- La durée est considérée « longtemps » si `duration_seconds >= threshold_seconds`.
- Le joueur qui répond **Oui** a raison ssi `duration_seconds >= threshold_seconds`.
- Le joueur qui répond **Non** a raison ssi `duration_seconds < threshold_seconds`.

**Cas limite (`==` seuil)** : `duration_seconds == threshold_seconds` compte comme **« longtemps »** (borne inclusive, cohérente avec §2). Donc réponse **Oui** = correcte, **Non** = incorrecte.

**Points** : bonne réponse = **1 pt** (avant multiplicateur de streak). Mauvaise réponse = 0.

En pass-and-play, les deux joueurs répondent tour à tour à la même question ; chacun est scoré indépendamment selon la règle ci-dessus.

---

## 4. Mode Ordre de grandeur

**Question posée** : « Quelle unité correspond le mieux à cette durée ? » Le joueur choisit une unité parmi les sept (§1).

**Unité correcte** = `magnitudeNaturelle(duration_seconds)` (§2).

**Barème** (soit `u` l'unité choisie, `c` l'unité correcte) :

| Condition                       | Points |
|---------------------------------|--------|
| `u == c` (exacte)               | 3      |
| `|rang(u) - rang(c)| == 1` (adjacente) | 1 |
| sinon                           | 0      |

Points de base avant multiplicateur de streak. Chaque joueur est scoré indépendamment.

Exemple : durée réelle `259200s` (3 jours) → correcte = `day` (rang 3).
- Choix `day` → 3 pts.
- Choix `hour` (rang 2) ou `week` (rang 4) → 1 pt.
- Choix `minute` (rang 1) → 0.

---

## 5. Mode Duel

**Question posée** : « Combien de temps ça prend ? » Chaque joueur saisit une **valeur** (`> 0`) **+ une unité**, converties en secondes (§1.1).

Soit `e_A = |estimation_A - duration_seconds|` et `e_B = |estimation_B - duration_seconds|` les écarts absolus.

**Points** :
- Si `e_A < e_B` : A marque **2 pts**, B marque 0.
- Si `e_B < e_A` : B marque **2 pts**, A marque 0.
- Si `e_A == e_B` (égalité stricte d'écart) : **1 pt chacun**.

Points de base avant multiplicateur de streak.

Note d'implémentation : comparer des flottants issus de multiplications entières reste exact tant que les valeurs saisies sont entières ou à décimales simples. Le backend compare `e_A` et `e_B` directement (pas d'epsilon) : l'égalité n'arrive que si les deux estimations convergent exactement vers la même valeur en secondes.

---

## 6. Streaks (séries)

Chaque joueur possède un compteur de **bonnes réponses consécutives**, réinitialisé à 0 en cas de mauvaise réponse.

### 6.1 Définition de « bonne réponse » par mode

| Mode              | Bonne réponse (compte pour le streak) |
|-------------------|----------------------------------------|
| Binaire           | Réponse correcte (1 pt marqué).        |
| Ordre de grandeur | Exacte **OU** adjacente (>= 1 pt marqué). **[tranché]** |
| Duel              | A **marqué le plus de points** sur la question, càd `points_marqués >= points_adverse` **ET** `points_marqués > 0`. En cas d'égalité (1-1), les deux joueurs marquent 1 pt et incrémentent leur streak. Un joueur qui marque 0 (a perdu le duel) casse son streak. **[tranché]** |

Justification « ordre de grandeur » : l'adjacence rapporte des points, il serait frustrant qu'une estimation « presque juste » casse une série. On inclut donc l'adjacente comme bonne réponse pour le streak (mais pas l'échec à 0).

Justification « duel » : le streak récompense la performance relative. Gagner ou égaliser le duel (marquer >= 1 pt) maintient la série ; perdre (0 pt) la casse.

### 6.2 Multiplicateur

Le multiplicateur dépend du compteur de streak **après** incrémentation de la question courante (donc il s'applique dès la question qui atteint le palier) :

| Streak courant (bonnes consécutives) | Multiplicateur |
|--------------------------------------|----------------|
| 0, 1, 2                              | ×1             |
| 3, 4                                 | ×2             |
| >= 5                                 | ×3             |

**Application** : le multiplicateur s'applique aux **points de base de la question** (Binaire/Ordre de grandeur/Duel). 

```
points_finaux = points_base * multiplicateur(streak_après_cette_question)
```

Exemple (ordre de grandeur) : le joueur est à 4 bonnes réponses, répond exact à la 5e (3 pts base). Nouveau streak = 5 → ×3 → `3 * 3 = 9 pts`.

### 6.3 Reset

- Toute réponse qui n'est **pas** une « bonne réponse » (§6.1) remet le compteur à **0** immédiatement, et cette question rapporte ses points de base × ×1 (soit 0 pt puisque non-bonne, sauf duel à 0).
- Le streak est **par joueur** et **persiste sur toute la partie** (à travers les manches). Il n'est pas remis à zéro entre les manches.
- Une nouvelle partie repart à 0.

---

## 7. XP

L'XP est persistée **par pseudo** (profil léger, cf. D-009), cumulée à travers toutes les parties. Elle sert la progression long terme (niveaux, classements), distincte du score d'une partie.

**Barème par action** :

| Action                                             | XP    |
|----------------------------------------------------|-------|
| Bonne réponse (au sens streak §6.1)                | +10   |
| Réponse exacte en Ordre de grandeur (3 pts)        | +5 bonus (cumulable avec la ligne ci-dessus) |
| Gagner un duel (2 pts sur la question)             | +5 bonus |
| Débloquer un badge                                 | +50   |
| Terminer une partie (aller au bout, quel qu'en soit le résultat) | +25 |
| Gagner une partie (être le vainqueur)              | +50 bonus (cumulable avec « terminer ») |

Règles :
- L'XP ne subit **jamais** le multiplicateur de streak (c'est une progression, pas un score de partie).
- L'XP est calculée côté backend à partir des événements de partie, jamais fournie par le client.
- L'XP est monotone croissante (jamais décrémentée).

Niveaux (indicatif, pour l'UI) : `niveau = floor(sqrt(xp / 100)) + 1`. Non normatif pour le scoring, fourni pour cohérence d'affichage.

---

## 8. Badges

Au moins 8 badges. Chaque condition est **calculable côté backend** à partir des données d'une partie (réponses horodatées, points, streaks, unités choisies) ou du profil cumulé.

Données disponibles par réponse (pour l'évaluation des conditions) : `mode`, `duration_seconds`, réponse du joueur, points de base marqués, `response_time_ms` (temps entre affichage de la question et validation), streak courant, résultat correct/adjacent/exact.

| Slug              | Nom FR              | Nom EN            | Description FR | Condition (vérifiable backend) |
|-------------------|---------------------|-------------------|----------------|--------------------------------|
| `first_game`      | Première fois       | First Timer       | Terminer sa première partie. | Le profil a `games_played >= 1` après la fin d'une partie. |
| `speedrunner`     | Speedrunner         | Speedrunner       | Répondre correctement en moins de 3 secondes. | Sur une réponse : `est_bonne_réponse == true` **ET** `response_time_ms < 3000`. |
| `bullseye`        | Dans le mille       | Bullseye          | Trouver l'unité exacte en Ordre de grandeur. | Mode `ordre_de_grandeur` : réponse exacte (3 pts base) au moins une fois. |
| `perfect_round`   | Manche parfaite     | Perfect Round     | Répondre juste à toutes les questions d'une manche. | Sur une manche de N questions : le joueur a une « bonne réponse » (§6.1) aux N questions. |
| `on_fire`         | En feu              | On Fire           | Atteindre une série de 5 bonnes réponses. | Le compteur de streak d'un joueur atteint `>= 5` à un moment de la partie. |
| `sharpshooter`    | Tireur d'élite      | Sharpshooter      | Gagner un duel avec un écart inférieur à 10 % de la durée réelle. | Mode `duel` : le joueur gagne (2 pts) **ET** `écart_absolu <= 0.10 * duration_seconds`. |
| `duel_master`     | Maître du duel      | Duel Master       | Remporter 10 duels au total (cumul profil). | Compteur profil `duels_won >= 10`. |
| `centurion`       | Centurion           | Centurion         | Cumuler 100 points en une seule partie. | Score final d'un joueur dans une partie `>= 100`. |
| `polyglot`        | Polyglotte          | Polyglot          | Jouer une partie dans chaque langue (fr et en). | Le profil a joué au moins une partie avec `locale='fr'` **ET** une avec `locale='en'`. |
| `time_lord`       | Seigneur du temps   | Time Lord         | Atteindre le niveau 10. | `niveau(xp) >= 10` (cf. §7). |

Règles d'attribution :
- Un badge n'est attribué qu'**une seule fois** par pseudo (idempotent : réévaluer une condition déjà remplie ne redonne ni badge ni XP).
- L'évaluation se fait à la fin de chaque question (badges par-réponse : `speedrunner`, `bullseye`, `sharpshooter`, `on_fire`) et à la fin de partie (badges cumulés : `first_game`, `perfect_round`, `duel_master`, `centurion`, `polyglot`, `time_lord`).
- Débloquer un badge accorde +50 XP (§7).

---

## 9. Déroulement d'une partie

### 9.1 Setup

1. **Deux pseudos** saisis (joueur A, joueur B). Un pseudo = un profil léger (D-009). S'il n'existe pas, il est créé.
2. **Mode** choisi parmi : Binaire, Ordre de grandeur, Duel (un seul mode par partie).
3. **Condition de fin** choisie :
   - **Limite de points** : la partie s'arrête à la fin de la manche où un joueur atteint/dépasse un score cible (défaut : `50` points). L'UI propose 30 / 50 / 100.
   - **Arrêt manuel** : la partie continue manche après manche jusqu'à ce qu'un joueur choisisse d'arrêter (bouton « Terminer la partie »). Dans ce mode il n'y a pas de cible de points.
4. **Langue** de la partie (`fr` / `en`), héritée du sélecteur global, mémorisée pour le badge `polyglot`.

### 9.2 Choix de catégorie

Avant chaque manche, le joueur **A choisit la catégorie** que **B** devra estimer, puis on alterne : à la manche suivante c'est B qui choisit pour A, etc. Ce croisement (le choix de l'un impose à l'autre) fait partie du sel du jeu.

Convention d'alternance du chooser : manche 1 → A choisit, manche 2 → B choisit, manche 3 → A, … (`chooser = A si numéro_manche impair, sinon B`).

### 9.3 Manche

- Une manche = **N questions** (défaut `N = 5`), tirées **de la catégorie choisie**, `status='approved'`, sans répétition dans la même partie tant que le stock le permet.
- Ordre des questions : aléatoire.
- Pour chaque question : les **deux joueurs répondent** (Binaire/Ordre de grandeur : chacun sa réponse, tour à tour sur l'appareil passé ; Duel : les deux saisissent leur estimation). Puis révélation de la vraie durée + points attribués + mise à jour des streaks/XP/badges.

### 9.4 Alternance et fin

- Après chaque manche : vérifier la condition de fin (§9.1). Si atteinte → écran de fin. Sinon → nouvelle manche, chooser alterné (§9.2).

### 9.5 Écran de fin

Affiche :
- **Vainqueur** : joueur au score le plus élevé. Égalité de score → **match nul** (annoncé explicitement).
- **Scores** finaux des deux joueurs.
- **Précision** par joueur : `précision = bonnes_réponses / total_réponses` (au sens §6.1), en pourcentage.
- **Meilleure série** (plus long streak atteint) par joueur.
- **Badges** débloqués pendant la partie (nouveaux uniquement), par joueur.
- XP gagnée par joueur (récapitulatif).

---

## 10. Récapitulatif des points de game design tranchés

Ces points n'étaient pas entièrement spécifiés en amont ; ils sont figés ici :

1. **Cas limite `== seuil` (Binaire)** : compte comme « longtemps » (borne inclusive). Réponse « Oui » correcte.
2. **Bornes de magnitude naturelle** : inclusives en bas (`60s → minute`, `3600s → hour`, etc.).
3. **Streak Ordre de grandeur** : exacte **OU** adjacente compte comme bonne réponse (l'échec à 0 pt casse la série).
4. **Streak Duel** : gagner **ou** égaliser (>= 1 pt marqué) maintient la série ; perdre (0 pt) la casse.
5. **Multiplicateur** : s'applique aux points de base, calculé sur le streak **après** la question courante (le palier prend effet dès la question qui l'atteint). ×1 (0-2), ×2 (3-4), ×3 (>=5).
6. **Streak persistant** sur toute la partie (à travers les manches), reset à la mauvaise réponse et à chaque nouvelle partie.
7. **XP jamais multipliée** par le streak ; calculée backend uniquement ; monotone.
8. **Défauts** : N = 5 questions/manche, limite de points par défaut 50 (options 30/50/100).
9. **Chooser croisé** : A choisit la catégorie de B, alternance stricte par parité de manche.
10. **Fin de partie** évaluée en fin de manche (jamais au milieu d'une manche), même en mode limite de points.
11. **Égalité de score finale** → match nul explicite.
12. **Badges idempotents** : un badge par pseudo, réévaluation sans effet.
</content>
</invoke>
