# GAME_DESIGN v2 — Kombien

Spécification **normative** des évolutions v2, à lire en complément de [`GAME_DESIGN.md`](./GAME_DESIGN.md) (v1). Ce document ne réécrit pas v1 : il en référence les sections inchangées et formalise les **deltas**. Sauf mention contraire ici, toutes les règles v1 (unités §1, magnitude §2, barèmes de base des 3 modes §3-§5, multiplicateur de streak §6.2-6.3, déroulement de manche §9.3) restent en vigueur.

Source de la demande : cahier d'évolutions `kombien-v2-evolutions.md`. Numérotation des sections ci-dessous alignée sur ce cahier pour faciliter la traçabilité (§2, §3, §6, §7, §8, §9). Les sections absentes ici (§1 identité visuelle, §4 import de questions, §5 classement/XP côté suppression) sont hors périmètre game-design pur ou déjà tranchées par l'utilisateur — voir renvois.

**Décision-cadre de l'utilisateur, structurante pour tout ce document** : suppression totale de la persistance (profils, XP, niveaux, badges cumulés, classement global). Chaque partie est autonome et éphémère. Le seul classement qui subsiste est celui de la session de jeu en cours. Cette décision invalide GAME_DESIGN.md §7 (XP) et §8 (badges cumulés côté profil) dans leur forme actuelle — voir §0 ci-dessous pour le traitement précis.

---

## 0. Conséquences de la suppression de la persistance

### 0.1 Ce qui disparaît

- Le **profil léger par pseudo** (D-009) : un pseudo n'est plus qu'un **libellé d'affichage** saisi en setup, sans identité persistée. Deux parties avec le même pseudo « Alice » ne sont pas liées.
- **L'XP** (GAME_DESIGN.md §7) et le calcul de **niveau**.
- Les **badges cumulés côté profil** (`duel_master`, `polyglot`, `time_lord` — nécessitent un historique multi-parties) : supprimés, ils n'ont plus de sens sans persistance.
- Le **classement global** (endpoint `GET /leaderboard`, écran « Classement », D-011).

### 0.2 Ce qui est reformulé plutôt que supprimé

Certains badges v1 sont **calculables sur une seule partie** (`first_game` excepté, qui suppose un historique). Ceux-là survivent comme **« exploits de session »** — un feedback de fin de partie, jamais persisté, jamais revu après la partie.

| Badge v1 | Sort en v2 |
|---|---|
| `first_game` | **Supprimé** (suppose un historique de parties). |
| `speedrunner` | Conservé comme exploit de session (par réponse). |
| `bullseye` | Conservé comme exploit de session. |
| `perfect_round` | Conservé comme exploit de session. |
| `on_fire` | Conservé comme exploit de session. |
| `sharpshooter` | Conservé comme exploit de session (mode Duel). |
| `duel_master` | **Supprimé** (cumul multi-parties). |
| `centurion` | Conservé comme exploit de session (seuil de score adapté, voir §0.3). |
| `polyglot` | **Supprimé** (suppose un historique multi-langues). |
| `time_lord` | **Supprimé** (dépend du niveau, donc de l'XP). |

Restent donc **5 exploits de session** sur les 10 badges v1. Le cahier demande au moins 8 badges à l'origine (contrainte du prompt fondateur de game-designer v1) — cette contrainte portait sur un système persistant qui n'existe plus en v2 ; elle ne s'applique pas à un système d'exploits éphémères. Voir proposition d'extension en §0.4.

### 0.3 Exploits de session — spécification

Renommage : « badge » → **« exploit »** (`achievement`), pour marquer la rupture avec le système persistant v1.

- Un exploit est évalué **exactement comme en v1** (mêmes conditions, cf. GAME_DESIGN.md §8), mais l'attribution est **scopée à la partie en cours**, jamais écrite en base au-delà de la durée de vie de la partie.
- Un exploit ne rapporte **aucune XP** (l'XP n'existe plus).
- Un exploit est débloqué **au plus une fois par joueur et par partie** (pas d'idempotence inter-parties à vérifier, puisqu'il n'y a pas d'historique).
- `centurion` : le seuil « 100 points en une partie » reste pertinent en Duo/Solo mais doit être reconsidéré à N joueurs (les points sont plus dilués si les questions/points sont partagés). Seuil conservé à **100 pts cumulés par joueur sur la partie**, indépendamment du nombre de joueurs — c'est un score individuel, pas un score d'équipe, donc le seuil absolu reste cohérent.
- Affichage : à l'écran de fin de partie, section « Exploits de la partie » (au lieu de « Badges débloqués »), par joueur, sans icône de collection persistante (cf. §0.2, rien n'est gardé après la partie).

### 0.4 Proposition (non imposée) — récompenses de session supplémentaires

L'utilisateur autorise à proposer, sans l'imposer, des récompenses de session non persistantes en complément des 5 exploits repris. Proposition concrète pour enrichir le feedback de fin de partie sans réintroduire de persistance :

- **Titres de fin de partie**, calculés une fois en fin de partie et attribués **à un seul joueur maximum chacun**, purement cosmétiques (aucun point, aucune trace après l'écran de fin) :
  - `le_plus_regulier` — plus faible variance d'écart en Duel, ou plus haut taux de bonnes réponses en Binaire/Ordre de grandeur.
  - `la_remontee` — plus grand écart de score comblé entre le début et la fin de partie (nécessite d'avoir été mené puis d'avoir gagné ou égalisé).
  - `le_prudent` — a le plus souvent choisi l'unité adjacente plutôt que de risquer 0 pt (Ordre de grandeur uniquement).
- Ces titres sont une proposition ouverte : à valider ou écarter par l'utilisateur (cf. §Tensions). Ils ne changent rien au scoring, seulement à l'écran de fin.

---

## 1. Modes de participation (§2 du cahier)

Trois tailles de partie : **Solo** (1), **Duo** (2, comportement v1 inchangé sauf mentions explicites), **Multi** (3+, pass-and-play sur un même appareil **ou** multi-écrans §9).

### 1.1 Solo

**Motivation** : entraînement / défi personnel, sans médiane communautaire (incompatible avec l'éphémère de session, §0).

- **Déroulement** : identique à Duo pour le tirage de manches/questions, sans second joueur. Pas de croisement de catégorie (§2 ci-dessous) — en Solo, **le joueur choisit lui-même sa catégorie** à chaque manche (pas d'adversaire pour l'imposer).
- **Duel en Solo** : incompatible par nature (il faut au moins 2 estimations à comparer). Si le mode Duel est sélectionné en Solo, le jeu bascule automatiquement sur un **Duel contre une estimation fantôme** (voir ci-dessous) — **présenté explicitement comme tel** avant la partie, pas silencieusement.
  - **Estimation fantôme** = la magnitude naturelle de la durée réelle convertie en valeur médiane de son unité (concrètement : `facteur(magnitudeNaturelle(duration_seconds)) * 1.0`, c'est-à-dire une estimation « au pif mais dans le bon ordre de grandeur »). Le joueur marque 2 pts s'il fait mieux que ce fantôme, 0 sinon, 1 pt en égalité stricte (recalcul improbable mais géré comme en Duel standard).
  - Justification du choix : un fantôme réellement compétitif (basé sur la vraie durée) rendrait le Solo-Duel quasi impossible à gagner ; un fantôme trop faible le viderait de challenge. La magnitude naturelle donne un adversaire « raisonnable mais battable avec une estimation précise ».
- **Condition de fin** : les deux conditions v1 s'appliquent (limite de points contre soi-même — atteindre le score cible — ou arrêt manuel). **Ajout Solo** : une troisième condition, **Nombre de manches fixe** (l'utilisateur choisit à l'avance combien de manches jouer : 3/5/10), utile en Solo où il n'y a pas de second joueur pour décider d'arrêter d'un commun accord.
- **Score / intérêt** : le score est affiché en fin de partie comme un score personnel avec **précision** (`bonnes_réponses / total`, cf. v1 §9.5) et **meilleure série**. Pas de comparaison à une médiane (incompatible avec l'éphémère). Le seul point de comparaison possible est la **propre partie précédente si le joueur relance immédiatement** (affichage `+X` ou `-X` par rapport au score de la partie précédente **de la session navigateur en cours**, gardé en mémoire côté client uniquement, jamais persisté serveur — voir tension correspondante).

### 1.2 Duo

Inchangé (GAME_DESIGN.md §3-§9), sous réserve des deltas explicitement listés dans ce document (calibration §3, fin de partie assouplie §5, questions différenciées §6).

### 1.3 Multi (3+ joueurs, pass-and-play ou multi-écrans)

**Choix de catégorie** : le croisement strict A→B (v1) ne généralise pas naturellement à N joueurs sans ambiguïté (qui choisit pour qui ?). Le croisement devient **une option parmi les 4 modes de sélection de thème** décrits en §2 — en Multi, le mode par défaut recommandé est la **rotation** : le joueur `i` choisit la catégorie du joueur `i+1 mod N` (généralisation directe du croisement Duo, qui est le cas `N=2`).

**Mode Duel à N joueurs** — reformulation du barème par rang d'écart, compatible avec le barème Duo (N=2) :

Soit `N` joueurs, chacun avec un écart absolu `e_i = |estimation_i - duration_seconds|`. On trie les joueurs par écart croissant (rang 1 = plus proche). Barème par rang :

| Rang (après tri croissant des écarts) | Points |
|---|---|
| 1er (meilleur) | 2 |
| 2e | 1 |
| 3e et au-delà | 0 |

**Gestion des égalités d'écart** (`e_i == e_j`) : les joueurs à égalité **partagent le même rang** et reçoivent chacun les points de ce rang ; le rang suivant saute d'autant de places qu'il y a d'ex-æquo (convention de classement dense-competition standard). Exemples :
- 4 joueurs, écarts distincts → rangs 1,2,3,4 → points 2,1,0,0.
- 4 joueurs, 2 premiers à égalité stricte → rangs 1,1,3,4 → points 2,2,0,0 (les deux premiers touchent chacun 2 pts, personne ne touche 1 pt puisque le rang 2 est « sauté »).
- Cas Duo (N=2) : rangs 1,2 → points 2,0, ou en cas d'égalité rangs 1,1 → points 1,1. **Ceci reproduit exactement le barème v1** (`2/0` ou `1/1`) : pas de régression pour les parties Duo existantes.

**Justification du choix** (plutôt qu'un barème proportionnel au nombre de joueurs, ou dégressif du type `N, N-1, ..., 1`) : le barème « top 2 seulement » garde le Duel lisible et l'écart de score contenu même à N élevé (une manche ne peut jamais donner plus de 2 pts d'avance décisive à un joueur), et il généralise le Duo sans le casser. Un barème dégressif sur tous les rangs aurait fait exploser les écarts de score en Multi et changé la nature du jeu (compétitif serré → cumulatif).

**Streak Duel à N joueurs** — cohérent avec §6.1 v1 (« a marqué des points ») : compte comme bonne réponse pour le streak tout joueur qui **marque strictement plus de 0 point** sur la question (donc rang 1 ou rang 2 en cas d'égalité incluse). Un joueur classé 3e ou pire (0 pt) casse son streak.

**Condition de fin en Multi** : identique à Duo, évaluée en fin de manche. « Limite de points » s'arrête dès qu'**au moins un** joueur atteint/dépasse la cible (comme en Duo, généralisation directe).

**Vainqueur / égalité en Multi** : le joueur au score le plus élevé gagne. En cas d'égalité **entre plusieurs joueurs au sommet du classement** (pas nécessairement tous), ils sont déclarés **co-vainqueurs** (match nul limité à ceux à égalité de tête, pas un match nul général si un joueur tiers a un score inférieur).

---

## 2. Sélection des thèmes (§3 du cahier)

Choisi au setup, **un seul mode de sélection actif pour toute la partie** :

### 2.1 Thème global unique (choisi par le maître de jeu)

Le premier joueur (créateur de la partie / maître de jeu, cf. §9.1 en multi-écrans, ou simplement joueur A en pass-and-play) choisit **une catégorie fixe pour toute la partie**. Toutes les manches tirent dans cette catégorie. Pas de croisement : tout le monde voit et estime le même thème.

### 2.2 Vote

Avant la partie, chaque joueur exprime un vote parmi les catégories disponibles (affichées en pass-and-play à tour de rôle pour ne pas influencer, ou simultanément en multi-écrans). Le thème recueillant le plus de voix s'applique à toute la partie (comme 2.1 une fois déterminé).

- **Égalité de vote** : tirage aléatoire uniforme parmi les catégories à égalité (annoncé à l'écran, pas silencieux).
- Le vote a lieu **une fois, avant la première manche** — il ne se répète pas manche après manche (sinon on retombe sur un croisement déguisé). Si l'utilisateur souhaite un revote périodique, c'est un choix produit distinct, non couvert ici (voir tensions).

### 2.3 Multi-thèmes (union)

Chaque joueur (ou le maître de jeu pour tous) sélectionne **plusieurs** catégories au setup. Le pool de tirage de chaque manche est **l'union** des questions des catégories sélectionnées, indépendamment de qui a choisi quoi. Une manche donnée peut donc mélanger des questions de catégories différentes dans son lot de N questions — le tirage aléatoire (v1 §9.3) s'applique sur le pool fusionné.

### 2.4 Thème(s) par joueur

Chaque joueur choisit indépendamment son ou ses thèmes ; **chaque joueur pioche dans son propre pool**, exclusivement. Ce mode implique nécessairement des **questions différenciées par joueur** (§6) — il ne peut pas fonctionner en « même question pour tous », par construction (les pools diffèrent). En Duel, voir §6.3 pour l'interaction de scoring.

### 2.5 Croisement (v1, conservé comme option)

Le comportement v1 (A choisit pour B, alternance stricte) reste disponible tel quel en Duo. Généralisation Multi : rotation circulaire (§1.3).

### 2.6 Tirage des questions — commun aux 4 modes

Dans tous les cas, la règle de tirage v1 s'applique au **pool déterminé par le mode de sélection actif** : N questions aléatoires, `status='approved'`, sans répétition dans la partie tant que le stock du pool le permet. Si le pool est épuisé avant la fin de la partie (peut arriver en 2.4 avec un thème restreint), la répétition redevient autorisée avec priorité aux questions les moins récemment tirées dans la partie (évite un blocage dur).

---

## 3. Calibration du mode Binaire (§6 du cahier)

### 3.1 Principe

Avant la première manche d'une partie en mode Binaire, une **phase de calibration** de **5 questions** (au lieu des 10 maximum du cahier — justification ci-dessous) où chaque joueur répond, pour chacune, à la question : *« Cette durée : longtemps ou pas longtemps ? »* **sans connaître la vraie durée à l'avance**, exactement comme une question de jeu normale, mais sur des questions **hors catégorie** (voir 3.2) et **sans scoring** (aucun point, aucun streak, aucun exploit — phase d'étalonnage pure).

**Pourquoi 5 et non 10** : le cahier autorise explicitement le game-designer à proposer moins. 10 questions de calibration avant même la première manche de jeu allongeraient le temps d'attente perçu (le jeu vend du suspense de révélation, pas un onboarding). 5 questions couvrant un éventail large de durées (voir 3.2) suffisent à dériver un seuil grossier — la calibration n'a pas besoin d'une précision statistique, seulement d'un signal de tendance (joueur plutôt "tolérant" ou plutôt "sévère").

### 3.2 Contenu de la calibration

Les 5 questions de calibration sont tirées d'un **pool dédié, indépendant des catégories de jeu**, couvrant délibérément un spectre large de magnitudes (par exemple une question autour de la minute, une autour de l'heure, une autour du jour, une autour de la semaine, une autour du mois/année) — pas des questions de la catégorie jouée, pour ne pas biaiser le pool de jeu ni consommer son stock. Ce pool de calibration est un ajout de contenu (5 à 10 questions dédiées suffisent), pas une réutilisation des questions de jeu.

Pour chaque question de calibration, le joueur répond **Oui (longtemps)** ou **Non (pas longtemps)**, comme en jeu normal, sans connaître ni le seuil ni la vraie durée avant d'avoir répondu.

### 3.3 Méthode de dérivation du seuil — tranchée : seuil **par joueur**

**Décision** : seuil individuel par joueur, pas de seuil consensuel de session.

**Justification** : le problème énoncé par le cahier est que le seuil de catégorie ne reflète l'expérience d'aucun joueur en particulier (« longtemps » vaut 1 an pour l'un, 30 minutes pour l'autre). Un seuil consensuel (moyenne ou médiane des deux calibrations) ne résout qu'à moitié le problème : il reste arbitraire pour chaque joueur individuellement, juste avec une arbitraire différente. Un seuil **par joueur** est la seule option qui fait que chaque joueur est jugé selon son propre référentiel — c'est l'intention explicite du cahier (« refléter l'expérience des joueurs »).

**Conséquence directe** : en pass-and-play, deux joueurs répondant à la **même question de jeu** en mode Binaire peuvent avoir des seuils différents, donc potentiellement des verdicts différents pour la même durée réelle (l'un dit correctement "longtemps", l'autre correctement "pas longtemps", si la durée tombe entre leurs deux seuils). C'est cohérent avec l'intention : le jeu binaire mesure le jugement personnel, pas un absolu.

**Méthode de calcul du seuil individuel** (à partir des 5 réponses de calibration) :

1. Pour chaque question de calibration `i`, on connaît sa `duration_seconds_i` et la réponse du joueur (`longtemps` ou `pas_longtemps`).
2. On définit deux bornes à partir des réponses du joueur :
   - `borne_basse` = la plus grande `duration_seconds_i` parmi les questions où le joueur a répondu **"pas longtemps"** (0 si aucune réponse "pas longtemps").
   - `borne_haute` = la plus petite `duration_seconds_i` parmi les questions où le joueur a répondu **"longtemps"** (`+infini`, en pratique la durée max du pool de calibration + 1, si aucune réponse "longtemps").
3. **Seuil calibré** `= moyenne géométrique(borne_basse, borne_haute)` si `borne_basse > 0` et `borne_haute` finie, sinon repli (voir 3.4).

**Pourquoi la moyenne géométrique et non arithmétique** : les durées suivent une échelle multiplicative (secondes à années, 7 ordres de grandeur, cf. §1 v1). Une moyenne arithmétique entre par exemple 300s et 3 000 000s donnerait ~1 500 150s (~17 jours), totalement dominée par la borne haute. La moyenne géométrique (`sqrt(borne_basse * borne_haute)`) place le seuil au centre **logarithmique**, cohérent avec la notion de magnitude naturelle déjà utilisée en §2 v1 (échelle de rangs, pas de valeurs brutes).

**Cas d'incohérence (le joueur répond "longtemps" à une durée plus courte que "pas longtemps" à une durée plus longue)** : possible si le joueur se trompe ou change d'avis en cours de calibration. On ignore les inversions : `borne_basse` et `borne_haute` sont calculées comme ci-dessus (max des "pas longtemps", min des "longtemps") indépendamment de leur cohérence relative. **Si `borne_basse >= borne_haute`** (incohérence complète), voir repli 3.4.

### 3.4 Repli (edge cases)

| Cas | Seuil retenu |
|---|---|
| Joueur répond "pas longtemps" à tout | `borne_basse` (la plus grande durée jugée "pas longtemps") **multipliée par 2** — on extrapole un seuil juste au-dessus de la plus longue durée encore jugée courte. |
| Joueur répond "longtemps" à tout | `borne_haute` (la plus petite durée jugée "longtemps") **divisée par 2** — symétrique du cas précédent. |
| Incohérence (`borne_basse >= borne_haute`) | Repli sur le **`threshold_seconds` de la catégorie jouée** (comportement v1), le signal de calibration du joueur n'étant pas exploitable. |

### 3.5 Application au scoring

Le seuil calibré du joueur **remplace** `threshold_seconds` de la catégorie (GAME_DESIGN.md §3) **pour ce joueur, pour toute la durée de la partie** — recalculé une fois en début de partie, jamais réévalué manche après manche. Le reste du scoring Binaire (borne inclusive, 1 pt, streak) est inchangé, en substituant simplement `threshold_seconds_joueur_calibré` à `threshold_seconds_catégorie` dans la formule de GAME_DESIGN.md §3.

En **Solo**, une seule calibration (le joueur seul). En **Multi**, chaque joueur calibre son propre seuil indépendamment (5 questions par joueur, pas mutualisées).

---

## 4. Fin de partie assouplie (§7 du cahier)

### 4.1 Règle

En mode **Limite de points**, on peut désormais s'arrêter à tout moment (bouton « Terminer la partie », identique à celui du mode Arrêt manuel v1), **même si la cible n'est pas atteinte**.

### 4.2 Équité en cas d'arrêt en cours de manche

**Définition d'une « manche complète »** : une manche est complète quand **tous les joueurs de la partie** ont répondu à **toutes les N questions** de cette manche (comportement v1 §9.3, généralisé à N joueurs).

**Règle d'arrêt** :

1. Si l'arrêt est demandé alors que la manche en cours est **complète** (tous les joueurs ont fini leurs N questions) : le score final est le score cumulé jusqu'à cette manche incluse. Comportement identique à v1.
2. Si l'arrêt est demandé **en cours de manche** (au moins un joueur n'a pas fini ses N questions de la manche courante) : **les points de la manche en cours ne comptent pour aucun joueur**, y compris ceux qui avaient déjà fini leurs questions de cette manche et marqué des points. Le score final retenu est celui **à l'issue de la dernière manche complète** (la précédente).
3. **Streak** : le compteur de streak de chaque joueur est également **restauré à sa valeur de fin de dernière manche complète** — les bonnes réponses de la manche annulée ne comptent ni pour le score ni pour la progression du streak. (Cohérent avec la règle 2 : une manche annulée est traitée comme n'ayant jamais eu lieu.)
4. Si l'arrêt survient **pendant la toute première manche** (aucune manche complète encore) : score final = 0 partout, la partie est **annulée** plutôt que terminée avec un score nul valorisé (l'écran de fin l'indique explicitement : « Partie interrompue avant la fin de la première manche — aucun résultat » plutôt qu'un écran de victoire/nul standard).

**Justification** : cette règle protège l'intégrité du classement de session — un joueur en tête ne peut pas « figer » son avantage en interrompant la partie au milieu d'une manche où l'adversaire n'a pas encore eu sa chance de répondre aux mêmes questions.

### 4.3 Interaction avec le mode Arrêt manuel (v1)

Le mode Arrêt manuel v1 n'a jamais eu de cible de points ; la règle 4.2 s'applique **identiquement** à ce mode (elle ne dépendait pas de la présence d'une cible, seulement de la notion de manche complète). Ce document unifie donc : **quelle que soit la condition de fin choisie (limite de points ou arrêt manuel), un arrêt annule toujours la manche en cours si elle est incomplète.** C'est un changement de comportement mineur par rapport à la formulation v1 (qui ne traitait pas explicitement ce cas pour l'arrêt manuel), mais cohérent avec l'esprit v1 (fin évaluée « en fin de manche, jamais au milieu »).

---

## 5. Questions différenciées par joueur (§8 du cahier)

### 5.1 Principe

Nouvelle option de setup, orthogonale au mode de sélection de thème (§2) : **« Questions communes »** (défaut, comportement v1 — tous les joueurs répondent à la même question dans une manche) vs **« Questions différenciées »** (chaque joueur reçoit, à chaque tour de la manche, une question distincte tirée du même pool).

- En mode Thème(s) par joueur (§2.4), les questions différenciées sont **obligatoires** (les pools eux-mêmes diffèrent, donc les questions ne peuvent pas être communes).
- Avec les 3 autres modes de sélection de thème (§2.1-2.3), les questions différenciées sont une **option indépendante** cochable au setup.

### 5.2 Tirage équitable

Pour une manche de N questions et P joueurs en mode différencié :

- Chaque joueur reçoit **N questions qui lui sont propres**, tirées aléatoirement du pool actif (§2.6), **sans répétition intra-partie pour ce joueur** (même règle de stock que v1, appliquée par joueur plutôt que globalement).
- **Pas de partage de question entre joueurs dans la même manche** : si le pool le permet, on garantit qu'aucune question tirée pour le joueur `i` n'est retirée dans la même manche pour un autre joueur `j` (évite qu'un joueur entende par avance la difficulté ressentie par un autre sur "sa" question — même si en pass-and-play l'écran de transition masque déjà cela, en multi-écrans les joueurs répondent en simultané).
- **Équité de difficulté de tirage** : le tirage reste **aléatoire uniforme dans le pool commun** pour tous les joueurs (même catégorie/pool, donc même distribution de difficulté en espérance) ; il n'y a pas de contrôle fin de la difficulté individuelle des questions (le pool n'a pas de métadonnée de difficulté en v1/v2 — hors périmètre).
- Si le pool est trop petit pour garantir l'absence de recoupement entre joueurs (peu de questions disponibles, beaucoup de joueurs), la contrainte « pas de partage inter-joueurs dans la manche » est **relâchée en premier** (avant la règle de non-répétition intra-partie, plus importante pour l'expérience individuelle) : mieux vaut qu'un joueur retombe sur une question déjà vue par un autre plutôt que de rejouer une question qu'il a déjà eue lui-même.

### 5.3 Interaction avec le scoring — cas par mode

- **Binaire, Ordre de grandeur** : aucun problème — chaque joueur est déjà scoré **indépendamment** de sa propre réponse contre sa propre question (v1 §3-§4 ne compare jamais les joueurs entre eux dans ces deux modes). Les questions différenciées n'affectent pas la formule.
- **Duel** : c'est le mode qui compare directement les joueurs entre eux (écarts à la **même** `duration_seconds`). Avec des questions différenciées, il n'y a plus de vérité terrain commune à comparer — **le barème Duel v1/§1.3 (comparaison directe des écarts) ne s'applique pas tel quel.**

**Règle retenue pour Duel + questions différenciées** : le scoring bascule sur une comparaison en **écart relatif** plutôt qu'absolu, pour rester comparable entre questions de durées différentes.

```
écart_relatif_i = |estimation_i - duration_seconds_i| / duration_seconds_i
```

Le classement par rang (§1.3, généralisation N joueurs) s'applique alors sur `écart_relatif` au lieu de `écart_absolu` : rang 1 (plus petit écart relatif) = 2 pts, rang 2 = 1 pt, reste = 0, avec la même règle d'égalités (rangs partagés denses).

**Justification** : un écart absolu de 60 secondes est négligeable sur une durée d'un an mais énorme sur une durée de 2 minutes ; comparer des écarts absolus entre questions différentes favoriserait mécaniquement les joueurs tombés sur de grandes durées. L'écart relatif neutralise cet effet et reste un signe de précision d'estimation équitable indépendamment de la magnitude de la question reçue.

**Cas Duo, questions communes (v1 standard)** : rien ne change, l'écart relatif et l'écart absolu donnent le même classement puisque `duration_seconds` est identique pour les deux joueurs (diviser deux écarts par la même constante ne change pas leur ordre) — **la v1 est un cas particulier de cette formule généralisée**, aucune régression.

---

## 6. Mode multi-écrans — règles de jeu (§9 du cahier)

**Périmètre de cette section** : uniquement les règles de jeu (comment les 3 modes se comportent dans ce dispositif). L'architecture technique (rooms Redis + WebSocket, reconnexion, hébergement) est hors périmètre de ce document — décidée côté technique (cf. message de cadrage).

**Statut d'implémentation** : ce lot est **traité en dernier (v2.2)**, après toutes les autres évolutions de ce document. Les règles ci-dessous doivent néanmoins être connues dès la conception du scoring (§1-§5), car les 3 modes doivent y être nativement compatibles sans re-design ultérieur.

### 6.1 Rôles

| Interface | Rôle | Voit les bonnes réponses ? |
|---|---|---|
| Écran principal | Affichage partagé (question, timer, révélation split-flap, classement de session) | Seulement à la révélation (après que tous ont répondu) |
| Manette de gestion (maître de jeu) | Contrôle la partie (avance, skip). Peut aussi jouer. | **Jamais avant la révélation**, y compris ses propres réponses ne lui donnent pas d'avantage d'information sur celles des autres |
| Appareil joueur | Répond individuellement | Non, jusqu'à la révélation |

**Maître de jeu = premier joueur connecté** à la room (créateur de la partie). Il peut cumuler le rôle de joueur.

### 6.2 Timer de réponse

- **10 secondes par défaut**, configurable au setup (valeur libre en secondes, ou pas de limite — voir 6.4).
- Le timer démarre à l'affichage de la question sur les appareils joueurs, identique pour tous (même question, même instant de départ — même en mode « questions différenciées » §5, chaque joueur a son propre timer démarrant à l'affichage de **sa** question).
- **Non-réponse dans le délai** : traitée comme une réponse absente. Comportement par mode :
  - Binaire / Ordre de grandeur : aucun point, streak cassé (équivalent à une mauvaise réponse), comme en pass-and-play si le joueur passait sans répondre.
  - Duel : le joueur non-répondant reçoit un écart considéré comme **maximal** (classé dernier de facto, 0 pt), sans participer au calcul du rang des autres (il n'entre pas dans le classement des écarts, il est juste placé après le dernier rang).

### 6.3 Progression

- La question suivante s'affiche quand : **tous les joueurs ont répondu**, **OU** le timer expire, **OU** le maître de jeu appuie sur « passer à la suite » (disponible à tout moment, y compris avant expiration, pour débloquer un joueur AFK).
- Après ces trois déclencheurs : écran de **résultats de la question** — qui a marqué des points, révélation split-flap de la vraie durée, mise à jour du classement de session affiché sur l'écran principal — puis question suivante.

### 6.4 Compatibilité des 3 modes existants

- **Binaire** : chaque appareil joueur affiche Oui/Non ; résultats agrégés (qui a eu juste) affichés sur l'écran principal après révélation. Compatible avec la calibration (§3) : la phase de calibration se déroule alors **sur les appareils joueurs individuellement, avant que la room ne démarre la partie**, le maître de jeu voit un écran d'attente « calibration en cours » sans le détail des réponses (cohérent avec 6.1 : jamais d'avantage d'information).
- **Ordre de grandeur** : chaque appareil joueur affiche les 7 unités en choix ; résultats agrégés (barème par joueur) après révélation.
- **Duel** : chaque appareil joueur saisit valeur + unité ; le classement par rang d'écart (§1.3) s'affiche sur l'écran principal après révélation — c'est le mode le plus naturellement adapté à un affichage Kahoot-like (classement immédiat visible par tous).
- Les 3 modes utilisent le **même minuteur, la même mécanique de progression** (6.2-6.3) ; seule l'interface de saisie sur l'appareil joueur change selon le mode.

### 6.5 Classement de session en multi-écrans

Affiché sur l'écran principal après chaque question (mise à jour temps réel) et en écran final — c'est la même notion de « classement de session » que celle définie pour le pass-and-play (§0.1 : seul classement qui subsiste, jamais persisté au-delà de la room).

---

## POINTS TRANCHÉS

Résumé des choix normatifs de ce document, pour référence rapide :

1. **Persistance** : suppression totale (profils, XP, niveaux, badges cumulés, classement global). Les pseudos redeviennent de simples libellés d'affichage.
2. **Badges → exploits de session** : 5 des 10 badges v1 survivent en version non-persistante, scope partie uniquement, sans XP (§0.2-0.3).
3. **Solo** : catégorie choisie par le joueur lui-même (pas de croisement) ; Duel en Solo = duel contre une « estimation fantôme » basée sur la magnitude naturelle, explicitement annoncé ; condition de fin additionnelle « nombre de manches fixe » (§1.1).
4. **Duel à N joueurs** : barème par rang d'écart, top 2 seulement (2 pts / 1 pt / 0…), égalités en rangs denses partagés. Se réduit exactement au barème Duo v1 pour N=2 (§1.3).
5. **Streak Duel à N joueurs** : bonne réponse = avoir marqué strictement plus de 0 point (rang 1 ou 2 ex-æquo inclus) (§1.3).
6. **Sélection de thème** : 4 modes au choix (global unique / vote / multi-thèmes union / par joueur), le croisement v1 devient un 5e mode optionnel (rotation en Multi) (§2).
7. **Calibration Binaire** : 5 questions (pas 10), pool dédié hors catégorie de jeu, **seuil individuel par joueur** (pas consensuel), dérivé par moyenne géométrique des bornes basse/haute observées, repli défini pour les cas extrêmes/incohérents (§3).
8. **Fin de partie assouplie** : arrêt à tout moment quelle que soit la condition de fin choisie ; manche incomplète à l'arrêt = annulée entièrement (score ET streak reviennent à l'état de la dernière manche complète) ; arrêt en 1ère manche incomplète = partie annulée sans résultat (§4).
9. **Questions différenciées** : tirage par joueur dans le pool actif, priorité à la non-répétition intra-joueur sur la non-répétition inter-joueurs si le pool est petit ; Duel bascule en écart **relatif** (et non absolu) dès que les questions diffèrent entre joueurs — formule qui généralise v1 sans le casser en questions communes (§5).
10. **Multi-écrans** : rôles et visibilité de l'information stricts (maître de jeu jamais avantagé), timer 10s par défaut configurable, non-réponse traitée comme mauvaise réponse / dernier rang, 3 modes tous compatibles avec le même mécanisme de timer/progression. **Lot v2.2, implémenté en dernier** (§6).

---

## TENSIONS / À VALIDER PAR L'UTILISATEUR

Choix produit non couverts par les décisions déjà tranchées ; nécessitent un arbitrage explicite avant implémentation.

1. **Titres de fin de partie non persistants** (§0.4) : proposition ouverte (`le_plus_regulier`, `la_remontee`, `le_prudent`) en complément des 5 exploits repris. À valider, modifier ou écarter.
2. **Comparaison Solo inter-parties côté client** (§1.1, fin) : proposer un delta de score par rapport à la partie précédente **gardé uniquement en mémoire navigateur (localStorage)**, sans aucune trace serveur. Question ouverte : est-ce souhaité, ou le Solo doit-il rester strictement sans aucune trace, même côté client ?
3. **Revote de thème périodique** (§2.2) : le vote a été spécifié comme un tirage unique en début de partie. Faut-il repositionner un vote toutes les X manches pour varier les thèmes en cours de partie longue (arrêt manuel) ? Non traité ici par défaut.
4. **Estimation fantôme du Solo-Duel** (§1.1) : le choix (magnitude naturelle convertie en valeur pleine de son unité) est un curseur de difficulté arbitraire. Un fantôme plus dur (ex : magnitude naturelle + bruit aléatoire borné) ou plus facile est un simple paramètre à ajuster selon le ressenti en playtest — à valider après un premier essai plutôt qu'en pur papier.
5. **Pool de calibration Binaire** (§3.2) : nécessite un ajout de contenu (5-10 questions dédiées, hors catégories de jeu). Qui les rédige et où sont-elles seedées (nouvelle table ou catégorie spéciale `_calibration` exclue du tirage normal) ? Décision de modélisation à trancher avec `backend`, pas couverte ici (règles de jeu seulement).
6. **Limite de joueurs en Multi pass-and-play** : le cahier ne fixe pas de plafond. Ce document ne fixe pas non plus de N maximum — à trancher (UX d'un pass-and-play à 8 joueurs vs limite raisonnable type 6).
7. **Affichage du classement de session en cours de partie pour le maître de jeu en multi-écrans** (§6.5) : le maître de jeu voit-il le classement de session complet en cours de partie (scores, pas les réponses) sur sa propre manette, ou uniquement sur l'écran principal partagé ? Les règles ci-dessus autorisent implicitement le premier cas (seules les *réponses/bonnes réponses* avant révélation sont proscrites, pas les scores déjà acquis), mais ce n'est pas explicitement demandé par le cahier — à confirmer.
</content>
