<script lang="ts">
  // Orchestrateur de la manche (GAME_DESIGN.md §9.2-§9.4, GAME_DESIGN_V2.md §1.3 pour N
  // joueurs). v2.1 : une manche = UNE question (GAME_DESIGN_V2.md §9, révisé). Machine
  // d'état locale : category-pick (chooser choisit) -> loading (tirage de LA question) ->
  // pour chaque joueur, en boucle : transition/answer (timer optionnel) -> reveal (score et
  // classement mis à jour immédiatement) -> manche suivante (rotation du chooser à chaque
  // question). Le score affiché est provisoire (lib/domain/scoring.ts) ; la vérité vient de
  // POST /games à la fin de la partie (End.svelte).
  import { onMount } from 'svelte';
  import { t, getLang } from '../../lib/i18n';
  import { navigate } from '../../lib/router/router.svelte';
  import {
    getCategories,
    getCategoryQuestions,
    getQuestionsForCategories,
    getDistinctQuestionsForPlayers,
    ApiError,
  } from '../../lib/api/client';
  import type { Category, Question, RawAnswer } from '../../lib/api/types';
  import { toSeconds, type Unit } from '../../lib/domain/units';
  import { scoreBinaire, scoreOrdreDeGrandeur, scoreDuelRanked, type RoundOutcome } from '../../lib/domain/scoring';
  import {
    getGameState,
    setRoundQuestion,
    isDifferentiated,
    currentQuestion,
    recordAnswer,
    advanceRound,
    markRoundComplete,
    isEndConditionMet,
    isFirstRoundIncomplete,
    activeCategorySlugs,
    effectiveThreshold,
    resetGame,
  } from '../../lib/stores/gameStore.svelte';
  import AppShell from '../../lib/components/AppShell.svelte';
  import Card from '../../lib/components/Card.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import ErrorMessage from '../../lib/components/ErrorMessage.svelte';
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import AnswerTimer from '../../lib/components/AnswerTimer.svelte';
  import TransitionScreen from './TransitionScreen.svelte';
  import ScoreBar from './ScoreBar.svelte';
  import CategoryPick from './CategoryPick.svelte';
  import CalibrationScreen from './CalibrationScreen.svelte';
  import BinaireAnswer from './BinaireAnswer.svelte';
  import OrdreDeGrandeurAnswer from './OrdreDeGrandeurAnswer.svelte';
  import DuelAnswer from './DuelAnswer.svelte';
  import RevealPanel from './RevealPanel.svelte';
  import LeaderboardOverlay from '../../lib/components/LeaderboardOverlay.svelte';

  type Step =
    | { name: 'calibration-intro' }
    | { name: 'calibration' }
    | { name: 'category-transition' }
    | { name: 'category-pick' }
    | { name: 'loading-question' }
    | { name: 'load-error'; message: string }
    | { name: 'answer-transition'; playerIndex: number }
    | { name: 'answer'; playerIndex: number }
    | { name: 'reveal' };

  const game = getGameState();

  // Slugs actifs déterminés par le mode de sélection de thème (GAME_DESIGN_V2.md §2.6) :
  // non-null pour global/vote/multi/per_player (pool fixe, pas de CategoryPick manche
  // après manche) ; null pour rotation (croisement v1, catégorie choisie à chaque manche).
  const fixedActiveSlugs = activeCategorySlugs(game.config!.themeSelection);

  // Calibration (Lot 4 v2, GAME_DESIGN_V2.md §3) : uniquement en mode Binaire, avant la
  // toute première manche (jamais réévaluée ensuite, cf gameStore.setCalibratedThreshold).
  const needsCalibration = game.config!.mode === 'binaire';

  let step = $state<Step>(needsCalibration ? { name: 'calibration-intro' } : { name: 'loading-question' });
  let allCategories = $state<Category[]>([]);
  let currentCategory = $state<Category>(game.config!.category);

  // Réponses brutes + résultats provisoires de la question en cours, un par joueur, en
  // attente de révélation. Index aligné sur game.players. `null` persistant après le passage
  // d'un joueur (timer expiré, pas de réponse donnée) reste `null` dans pendingAnswers mais
  // pendingOutcomes est renseigné (0 pt / mauvaise réponse) — cf handleAnswerTimeout.
  let pendingAnswers = $state<(RawAnswer | null)[]>([]);
  let pendingOutcomes = $state<(RoundOutcome | null)[]>([]);
  // Estimations Duel en secondes, y compris pour les joueurs dont le timer a expiré (marquées
  // Infinity : jamais dans le groupe de tête tant qu'au moins un autre joueur a répondu).
  let pendingDuelEstimateSeconds = $state<(number | null)[]>([]);

  // Classement de session en cours de partie (Lot 7 v2, GAME_DESIGN_V2.md §0.1/§6.5) :
  // overlay consultable à tout moment via ScoreBar, se ferme pour revenir au jeu.
  let leaderboardOpen = $state(false);

  // Horodatage de début de réponse (temps de réaction, cf RawAnswer.responseTimeMs) ;
  // pas de $state, ce n'est pas affiché, seulement lu au moment de construire la réponse.
  let answerStartedAt = 0;

  onMount(async () => {
    if (needsCalibration) return; // attend handleCalibrationDone() (voir plus bas)
    await loadInitialQuestion();
  });

  async function loadInitialQuestion(): Promise<void> {
    // Pool de catégories connu à l'avance pour tout mode hors rotation (résolution du
    // tag/seuil par question via category_id, cf categoryForQuestion ci-dessous).
    if (fixedActiveSlugs) {
      allCategories = await getCategories();
    }
    // Manche 1 : la catégorie (ou le pool) est déjà choisie via Setup, pas de category-pick.
    await loadRoundQuestion();
  }

  function handleCalibrationStart(): void {
    step = { name: 'calibration' };
  }

  async function handleCalibrationDone(): Promise<void> {
    await loadInitialQuestion();
  }

  // Résout la catégorie réelle d'une question par son category_id (nécessaire en mode
  // multi/per_player où plusieurs catégories sont actives simultanément dans une même
  // manche) ; retombe sur currentCategory si non trouvée (mode rotation/global/vote,
  // une seule catégorie active, toujours currentCategory).
  function categoryForQuestion(question: Question): Category {
    return allCategories.find((c) => c.id === question.category_id) ?? currentCategory;
  }

  // Tirage de la manche (v2.1 : UNE question, GAME_DESIGN_V2.md §2.6 et §5.2, Lot 3) :
  // catégorie unique (rotation/global/vote, ancien endpoint) ou union de catégories
  // (multi/per_player, endpoint multi-catégories) ; en mode "questions différenciées", le
  // même pool (slugs résolus ci-dessus) est distribué en une question distincte par joueur
  // plutôt qu'une seule question partagée.
  async function loadRoundQuestion(): Promise<void> {
    step = { name: 'loading-question' };
    const slugs = fixedActiveSlugs ?? [currentCategory.slug];
    try {
      if (game.config!.differentiatedQuestions) {
        const perPlayerQuestions = await getDistinctQuestionsForPlayers(slugs, 1, playerCount());
        setRoundQuestion(perPlayerQuestions.map((set) => set[0]!));
      } else {
        const questions = fixedActiveSlugs
          ? await getQuestionsForCategories(fixedActiveSlugs, 1)
          : await getCategoryQuestions(currentCategory.slug, 1);
        const question = questions[0]!;
        setRoundQuestion(game.players!.map(() => question));
      }
      beginQuestion();
    } catch (err) {
      const message = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
      step = { name: 'load-error', message };
    }
  }

  function playerCount(): number {
    return game.players?.length ?? 0;
  }

  // Rotation circulaire (GAME_DESIGN_V2.md §1.3) : le chooser choisit pour le joueur suivant.
  function chooserPseudo(): string {
    return game.players![game.chooserIndex].pseudo;
  }

  function answererPseudo(): string {
    const answererIndex = (game.chooserIndex + 1) % playerCount();
    return game.players![answererIndex].pseudo;
  }

  function beginQuestion(): void {
    pendingAnswers = game.players!.map(() => null);
    pendingOutcomes = game.players!.map(() => null);
    pendingDuelEstimateSeconds = game.players!.map(() => null);
    step = { name: 'answer-transition', playerIndex: 0 };
  }

  function handleTransitionReady(playerIndex: number): void {
    answerStartedAt = Date.now();
    step = { name: 'answer', playerIndex };
  }

  // playerIndex : en mode différencié, chaque joueur répond à SA propre question
  // (currentQuestion(playerIndex)), donc son propre questionId/durationSeconds — c'est ce
  // qui permet au serveur de rejouer le scoring en écart relatif (GAME_DESIGN_V2.md §5.3).
  function buildRawAnswer(playerIndex: number, extra: Partial<RawAnswer>): RawAnswer {
    const q = currentQuestion(playerIndex)!;
    return {
      mode: game.config!.mode,
      questionId: q.id,
      roundIndex: game.roundNumber,
      responseTimeMs: Date.now() - answerStartedAt,
      durationSeconds: q.duration_seconds,
      ...extra,
    };
  }

  function goToNextPlayerOrReveal(playerIndex: number): void {
    const nextIndex = playerIndex + 1;
    if (nextIndex < playerCount()) {
      step = { name: 'answer-transition', playerIndex: nextIndex };
    } else {
      step = { name: 'reveal' };
    }
  }

  function handleBinaireAnswer(playerIndex: number, answer: 'yes' | 'no'): void {
    const q = currentQuestion(playerIndex)!;
    // categoryForQuestion : en mode multi/per_player, chaque question de la manche peut
    // venir d'une catégorie différente, donc d'un seuil différent (GAME_DESIGN_V2.md §2.3-2.4).
    // effectiveThreshold : seuil calibré du JOUEUR (Lot 4 v2, §3.5) s'il a calibré, sinon
    // repli sur le seuil de catégorie (v1, calibration non effectuée).
    const categoryThreshold = categoryForQuestion(q).threshold_seconds;
    const threshold = effectiveThreshold(playerIndex, categoryThreshold);
    const raw = buildRawAnswer(playerIndex, { binaryAnswer: answer, thresholdSeconds: threshold });
    const outcome = scoreBinaire(answer, q.duration_seconds, threshold);
    commitAnswer(playerIndex, raw, outcome);
  }

  function handleOrdreAnswer(playerIndex: number, unit: Unit): void {
    const q = currentQuestion(playerIndex)!;
    const raw = buildRawAnswer(playerIndex, { chosenUnit: unit });
    const outcome = scoreOrdreDeGrandeur(unit, q.duration_seconds);
    commitAnswer(playerIndex, raw, outcome);
  }

  // Duel : chaque joueur saisit son estimation ; on ne connaît le classement qu'une fois
  // que TOUS ont répondu (GAME_DESIGN_V2.md §1.3 : classement par rang d'écart à N joueurs).
  // En mode différencié (§5.3), chaque joueur estime sur SA PROPRE question : le classement
  // se calcule alors en écart RELATIF (une durée par joueur), au lieu de l'écart absolu à
  // durée commune — scoreDuelRanked se réduit exactement au cas v1 si toutes les questions
  // sont identiques (mêmes durationsSeconds pour tous).
  function handleDuelAnswer(playerIndex: number, value: number, unit: Unit): void {
    const raw = buildRawAnswer(playerIndex, { estValue: value, estUnit: unit });
    pendingAnswers[playerIndex] = raw;
    pendingDuelEstimateSeconds[playerIndex] = toSeconds(value, unit);
    advanceDuelOrResolve(playerIndex);
  }

  // Timer expiré (v2.1) : pas de réponse. Binaire/Ordre = mauvaise réponse (0 pt, streak
  // cassé, cf GAME_DESIGN_V2.md §6.2 — même traitement que la spec multi-écrans, reprise ici
  // pour le pass-and-play). Duel = écart infini, ne peut jamais entrer dans le groupe de tête.
  function handleAnswerTimeout(playerIndex: number): void {
    if (game.config!.mode === 'duel') {
      // estValue/estUnit factices : jamais lus comme vérité par le serveur dès que noAnswer
      // est présent (cf domain/scoring.ts::scoreDuelRanked), mais requis par le type RawAnswer.
      const raw = buildRawAnswer(playerIndex, { estValue: 0, estUnit: 'second', noAnswer: true });
      pendingAnswers[playerIndex] = raw;
      pendingDuelEstimateSeconds[playerIndex] = Infinity;
      advanceDuelOrResolve(playerIndex);
      return;
    }

    const q = currentQuestion(playerIndex)!;
    const raw = buildRawAnswer(
      playerIndex,
      game.config!.mode === 'binaire'
        ? { binaryAnswer: 'no', thresholdSeconds: effectiveThreshold(playerIndex, categoryForQuestion(q).threshold_seconds) }
        : { chosenUnit: 'second' },
    );
    commitAnswer(playerIndex, raw, { points: 0, isGoodAnswer: false });
  }

  function advanceDuelOrResolve(playerIndex: number): void {
    const nextIndex = playerIndex + 1;
    if (nextIndex < playerCount()) {
      step = { name: 'answer-transition', playerIndex: nextIndex };
      return;
    }

    // Dernier joueur : toutes les estimations sont connues (ou Infinity si timer expiré),
    // on calcule le classement.
    const estimateSeconds = pendingDuelEstimateSeconds.map((v) => v ?? Infinity);
    const durationsSeconds = pendingAnswers.map((a) => a!.durationSeconds);
    const outcomes = scoreDuelRanked(estimateSeconds, isDifferentiated() ? durationsSeconds : durationsSeconds[0]!);

    // opponentEstValue/opponentEstUnit (contrat v1, un seul adversaire) n'a de sens qu'à
    // 2 joueurs ; au-delà, le serveur recalcule le classement à N joueurs par questionId.
    if (playerCount() === 2) {
      pendingAnswers = pendingAnswers.map((a, i) => {
        const opponent = pendingAnswers[1 - i]!;
        return { ...a!, opponentEstValue: opponent.estValue, opponentEstUnit: opponent.estUnit };
      });
    }
    pendingOutcomes = outcomes;
    pendingAnswers.forEach((a, i) => recordAnswer(i, a!, outcomes[i]!.points, outcomes[i]!.isGoodAnswer));
    step = { name: 'reveal' };
  }

  function commitAnswer(playerIndex: number, raw: RawAnswer, outcome: RoundOutcome): void {
    recordAnswer(playerIndex, raw, outcome.points, outcome.isGoodAnswer);
    pendingAnswers[playerIndex] = raw;
    pendingOutcomes[playerIndex] = outcome;
    goToNextPlayerOrReveal(playerIndex);
  }

  function handleDuelAnswerFor(playerIndex: number): (value: number, unit: Unit) => void {
    return (value, unit) => handleDuelAnswer(playerIndex, value, unit);
  }

  // v2.1 : une manche = une question -> chaque clic "Manche suivante" marque IMMÉDIATEMENT
  // la manche courante comme complète (score/classement déjà visibles depuis le reveal, cf
  // ScoreBar/LeaderboardOverlay qui lisent game.players en direct) puis vérifie la fin de
  // partie et fait tourner le chooser AVANT la question suivante (rotation à chaque question,
  // GAME_DESIGN_V2.md §1.3).
  async function handleNext(): Promise<void> {
    markRoundComplete();

    // Fin de manche (GAME_DESIGN.md §9.4) : en mode "points", on vérifie la cible ici, après
    // CHAQUE question désormais (v2.1). En mode "manual", pas d'arrêt automatique : le joueur
    // clique "Terminer la partie".
    if (game.config!.endCondition === 'points' && isEndConditionMet()) {
      navigate({ name: 'end' });
      return;
    }

    advanceRound();

    // Mode rotation uniquement : la catégorie est choisie à chaque manche via CategoryPick
    // (GAME_DESIGN_V2.md §2.5). Les autres modes ont un pool fixe résolu au setup
    // (fixedActiveSlugs) -> pas de category-pick, on tire directement.
    if (!fixedActiveSlugs) {
      if (allCategories.length === 0) {
        // On a la catégorie initiale (Setup) mais il faut la liste complète pour le choix
        // croisé de la manche 2+ -> chargée une seule fois, en différé.
        allCategories = await getCategories();
      }
      step = { name: 'category-transition' };
      return;
    }

    await loadRoundQuestion();
  }

  function handleCategoryTransitionReady(): void {
    step = { name: 'category-pick' };
  }

  async function handleCategoryConfirm(category: Category): Promise<void> {
    currentCategory = category;
    await loadRoundQuestion();
  }

  function handleQuitGame(): void {
    if (window.confirm(t('common.quit_game_confirm'))) {
      navigate({ name: 'home' });
    }
  }

  // Fin de partie assouplie (Lot 5 v2, GAME_DESIGN_V2.md §4) : "Terminer la partie" est
  // disponible à tout moment, quelle que soit la condition de fin (limite de points ET
  // arrêt manuel unifiés). v2.1 : une manche = une question, donc "manche incomplète" au
  // sens §4.2 = question où tous les joueurs n'ont pas encore répondu — au reveal, tous ont
  // déjà répondu (sinon on ne serait pas au reveal), donc la manche courante est TOUJOURS
  // complète à cet instant précis (contrairement à v1 où un reveal pouvait survenir au milieu
  // d'un bloc de N questions).
  function handleStopGame(): void {
    if (!window.confirm(t('common.end_game_confirm'))) return;
    if (step.name === 'reveal') {
      markRoundComplete();
    }
    if (isFirstRoundIncomplete()) {
      resetGame();
      navigate({ name: 'home', cancelledGame: true });
      return;
    }
    navigate({ name: 'end' });
  }

  // En mode différencié, la question affichée à l'écran de réponse est celle du joueur DONT
  // c'est le tour (step.playerIndex) ; en mode commun currentQuestion(0) == currentQuestion(N)
  // pour tout N (une seule question partagée), donc l'index n'a pas d'importance.
  const activeAnswerPlayerIndex = $derived(step.name === 'answer' || step.name === 'answer-transition' ? step.playerIndex : 0);
  const question = $derived(currentQuestion(activeAnswerPlayerIndex));
  const revealPlayers = $derived(
    game.players && pendingOutcomes.every((o) => o !== null)
      ? game.players.map((p, i) => ({
          pseudo: p.pseudo,
          isGoodAnswer: pendingOutcomes[i]!.isGoodAnswer,
          points: pendingOutcomes[i]!.points,
          // Questions différenciées (§5) : la durée réelle de CE joueur, pour que
          // RevealPanel affiche un split-flap par joueur plutôt qu'un seul partagé.
          ownDurationSeconds: isDifferentiated() ? pendingAnswers[i]!.durationSeconds : undefined,
        }))
      : null,
  );

  // Classement de session (Lot 7 v2) : scores/streaks provisoires du gameStore, mis à jour
  // immédiatement après CHAQUE question (v2.1) — pas de précision (accuracy) connue avant la
  // réponse serveur de fin de partie -> colonne masquée par Leaderboard tant que `accuracy`
  // est absent (variant 'compact').
  const leaderboardEntries = $derived(
    (game.players ?? []).map((p) => ({ pseudo: p.pseudo, score: p.score, bestStreak: p.bestStreak })),
  );
</script>

<AppShell>
  {#if step.name === 'calibration-intro'}
    <div class="game__calibration-intro">
      <Icon name="clock" size="lg" />
      <h1 class="game__calibration-title">{t('calibration.intro_title')}</h1>
      <p class="game__calibration-body">{t('calibration.intro_body')}</p>
      <Button variant="primary" fullWidth onclick={handleCalibrationStart}>
        {t('calibration.intro_start')}
      </Button>
    </div>
  {:else if step.name === 'calibration'}
    <CalibrationScreen
      pseudos={game.players!.map((p) => p.pseudo)}
      categoryThresholdSeconds={game.config!.category.threshold_seconds}
      oncomplete={handleCalibrationDone}
    />
  {:else if step.name === 'category-transition'}
    <TransitionScreen
      pseudo={chooserPseudo()}
      role="choose_category"
      onready={handleCategoryTransitionReady}
    />
  {:else if step.name === 'category-pick'}
    <CategoryPick
      chooserPseudo={chooserPseudo()}
      answererPseudo={answererPseudo()}
      categories={allCategories}
      onconfirm={handleCategoryConfirm}
    />
  {:else}
    <header class="game__header">
      <span class="game__round">{t('round.label', { number: game.roundNumber })}</span>
      <div class="game__header-actions">
        <!-- Fin de partie assouplie (Lot 5 v2, §4) : disponible à tout moment, quelle que
             soit la condition de fin (limite de points ET manuel, avant ce lot seul le
             manuel l'exposait, et seulement au reveal). -->
        <Button variant="secondary" onclick={handleStopGame}>{t('common.end_game')}</Button>
        <Button variant="ghost" onclick={handleQuitGame}>{t('nav.back')}</Button>
      </div>
    </header>

    {#if game.players}
      <ScoreBar
        players={game.players}
        activeIndex={step.name === 'answer' || step.name === 'answer-transition' ? step.playerIndex : null}
        onopenleaderboard={() => (leaderboardOpen = true)}
      />
    {/if}

    {#if step.name === 'loading-question'}
      <Skeleton rows={4} />
    {:else if step.name === 'load-error'}
      <ErrorMessage message={step.message} />
    {:else if step.name === 'answer-transition'}
      {@const transitionPlayerIndex = step.playerIndex}
      <TransitionScreen
        pseudo={game.players![transitionPlayerIndex].pseudo}
        role={game.config!.mode === 'duel' ? 'estimate' : 'answer'}
        onready={() => handleTransitionReady(transitionPlayerIndex)}
      />
    {:else if step.name === 'answer' && question}
      {@const answerPlayerIndex = step.playerIndex}
      {@const questionCategory = categoryForQuestion(question)}
      <Card>
        <div class="game__question-head">
          <span class="game__tag">{t(`modes.${game.config!.mode}`)}</span>
          <span class="game__tag">{getLang() === 'en' ? questionCategory.name_en : questionCategory.name_fr}</span>
        </div>
        <p class="game__question-text">
          {getLang() === 'en' ? question.text_en : question.text_fr}
        </p>
        <p class="game__prompt">
          {t(game.config!.mode === 'binaire' ? 'question.binaire_prompt' : game.config!.mode === 'ordre_de_grandeur' ? 'question.ordre_prompt' : 'question.duel_prompt')}
        </p>
      </Card>

      {#if game.config!.answerTimerSeconds !== null}
        {#key answerPlayerIndex}
          <AnswerTimer
            totalSeconds={game.config!.answerTimerSeconds}
            onexpire={() => handleAnswerTimeout(answerPlayerIndex)}
          />
        {/key}
      {/if}

      {#if game.config!.mode === 'binaire'}
        <BinaireAnswer onanswer={(answer) => handleBinaireAnswer(answerPlayerIndex, answer)} />
      {:else if game.config!.mode === 'ordre_de_grandeur'}
        <OrdreDeGrandeurAnswer onanswer={(unit) => handleOrdreAnswer(answerPlayerIndex, unit)} />
      {:else}
        <DuelAnswer onanswer={handleDuelAnswerFor(answerPlayerIndex)} />
      {/if}
    {:else if step.name === 'reveal' && question && revealPlayers}
      <RevealPanel
        questionId={question.id}
        lang={getLang()}
        durationSeconds={question.duration_seconds}
        players={revealPlayers}
        onnext={handleNext}
      />
    {/if}
  {/if}

  {#if leaderboardOpen}
    <LeaderboardOverlay entries={leaderboardEntries} onclose={() => (leaderboardOpen = false)} />
  {/if}
</AppShell>

<style>
  .game__calibration-intro {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--gap);
    text-align: center;
    color: var(--amber);
  }

  .game__calibration-title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .game__calibration-body {
    color: var(--ink-mid);
    font-size: var(--fs-body);
    max-width: 24rem;
  }

  .game__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .game__round {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .game__header-actions {
    display: flex;
    gap: var(--gap-tight);
  }

  .game__question-head {
    display: flex;
    gap: var(--gap-tight);
    margin-bottom: var(--gap);
  }

  /* Tag de mode/catégorie : mini-palette ambre-dim (§5.5). Texte en crème --ink-hi (pas
     --amber-ink foncé, illisible sur amber-dim — §2.2) : contraste AA préservé. */
  .game__tag {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-micro);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-hi);
    background: var(--amber-dim);
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-pill);
  }

  .game__question-text {
    font-family: var(--font-display);
    font-size: var(--fs-lead);
    font-weight: 500;
    color: var(--ink-hi);
    margin-bottom: var(--gap);
  }

  .game__prompt {
    font-family: var(--font-display);
    font-size: var(--fs-body);
    color: var(--ink-mid);
  }
</style>
