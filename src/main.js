import {
  DEFAULT_GAME_ID,
  GAME_LIST,
  createGameInstance,
  getGameDefinition,
} from './common/gameCatalog.js';
import { UI_THEME } from './common/uiTheme.js';

const appContainer = document.getElementById('app');
const canvas = document.getElementById('game-canvas');
const balanceDisplay = document.getElementById('balance-display');
const balanceMeta = balanceDisplay ? balanceDisplay.closest('.meta') : null;
const crashSelect = document.getElementById('crash-select');
const trainerToggle = document.getElementById('trainer-toggle');
const statusLabel = document.getElementById('status-label');
const multiplierLabel = document.getElementById('multiplier-label');
const copyScriptButton = document.getElementById('copy-script-button');
const modeSwitch = document.getElementById('mode-switch');
let modeButtons = [];
const moreButton = document.getElementById('more-button');
const gamesModal = document.getElementById('games-modal');
const gamesOverlay = document.getElementById('games-overlay');
const gamesCloseButton = document.getElementById('games-close-button');
const gamesList = document.getElementById('games-list');
const debugMenu = document.getElementById('debug-menu');
const closeDebug = document.getElementById('close-debug');
const primaryButton = document.getElementById('primary-button');
const ctaLabel = primaryButton.querySelector('.cta-label');
const ctaSubtext = document.getElementById('cta-subtext');
const betSpinner = document.getElementById('bet-spinner');
const betMinus = document.getElementById('bet-minus');
const betPlus = document.getElementById('bet-plus');
const metaLeftLabel = document.getElementById('meta-left-label');
const metaLeftValue = document.getElementById('meta-left-value');
const winOverlay = document.getElementById('win-overlay');
const winAmount = document.getElementById('win-amount');
const multiplierContainer = document.getElementById('multiplier-container');
const currentMultiplierEl = document.getElementById('current-multiplier');
const root = document.documentElement;
const pinchGestureHandlers = [];

const BET_STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
const BUTTON_STATES = {
  READY: 'ready',
  RUNNING: 'running',
  WIN: 'win',
  IDLE: 'idle',
};

function getModeTheme(levelId) {
  return UI_THEME.modes[levelId] ?? UI_THEME.modes.classic;
}

function applyTheme(levelId) {
  activeModeTheme = getModeTheme(levelId);
  const multiplierTheme = UI_THEME.multiplier;
  root.style.setProperty(
    '--multiplier-font-size',
    `${multiplierTheme.centerFontSize}px`
  );
  root.style.setProperty('--multiplier-color', multiplierTheme.centerColor);
  root.style.setProperty(
    '--multiplier-pulse-color',
    multiplierTheme.pipeLabelPassedColor
  );
  currentMultiplierEl.style.fontSize = `${multiplierTheme.centerFontSize}px`;
  currentMultiplierEl.style.color = multiplierTheme.centerColor;
  const readyTheme =
    activeModeTheme.buttons?.ready ?? UI_THEME.modes.classic.buttons.ready;
  if (readyTheme) {
    root.style.setProperty('--cta-bg', readyTheme.background ?? '');
    root.style.setProperty('--cta-color', readyTheme.textColor ?? '');
    root.style.setProperty(
      '--cta-subtext-color',
      readyTheme.subtextColor ?? readyTheme.textColor ?? ''
    );
    root.style.setProperty('--cta-shadow', readyTheme.boxShadow ?? 'none');
    root.style.setProperty(
      '--cta-border',
      readyTheme.borderColor ? `1px solid ${readyTheme.borderColor}` : 'none'
    );
    root.style.setProperty(
      '--cta-radius',
      readyTheme.borderRadius != null
        ? `${readyTheme.borderRadius}px`
        : '24px'
    );
  }
  applyButtonThemeForState(buttonState);
}

let balance = 1000;
let betIndex = Math.max(0, BET_STEPS.indexOf(10));
let selectedCrashOption = 'random';
let currentGameId = DEFAULT_GAME_ID;
let gameDefinition = getGameDefinition(currentGameId);
if (!gameDefinition && GAME_LIST.length > 0) {
  currentGameId = GAME_LIST[0].id;
  gameDefinition = getGameDefinition(currentGameId);
}
let currentLevels = gameDefinition?.levels ?? {};
let currentLevel = resolveDefaultLevel(gameDefinition);
let roundActive = false;
let trainerScript = null;
let buttonState = BUTTON_STATES.READY;
let activeBet = BET_STEPS[betIndex];
let lastWinAmount = 0;
let winResetTimer = null;
let previousMultiplier = 1;
let multiplierPulseTimer = null;
let activeModeTheme = UI_THEME.modes.classic;
let awaitingCrashAfterCashout = false;
let crashHighlightTimer = null;
let suppressCrashRoundEnd = false;
let game = null;
let screenShakeTimer = null;

init();

function init() {
  currentLevels = gameDefinition?.levels ?? {};
  currentLevel = currentLevel ?? resolveDefaultLevel(gameDefinition);
  buildModeButtons(gameDefinition, currentLevel?.id);
  buildGamesList();
  game = createGameInstance(currentGameId, canvas, buildGameCallbacks());
  if (game && currentLevel?.id) {
    game.setLevel?.(currentLevel.id);
  }
  renderCrashOptions(currentLevel, selectedCrashOption);
  selectedCrashOption = crashSelect.value;
  updateBalanceDisplay();
  updateBetDisplay();
  if (currentLevel?.id) {
    applyTheme(currentLevel.id);
    updateUIForLevel(currentLevel);
  } else {
    applyTheme('classic');
  }
  updateMultiplierDisplay(1, false);
  setPrimaryButton(BUTTON_STATES.READY);
  ensureAutopilotPreview(selectedCrashOption, currentLevel);
  attachEventListeners();
  disablePinchZoom();
  window.addEventListener('beforeunload', enablePinchZoom, { once: true });
}

function attachEventListeners() {
  if (crashSelect) {
    crashSelect.addEventListener('change', () => {
      selectedCrashOption = crashSelect.value;
      ensureAutopilotPreview(selectedCrashOption, currentLevel);
    });
  }

  if (trainerToggle) {
    trainerToggle.addEventListener('change', () => {
      const enabled = trainerToggle.checked;
      game?.setTrainerMode?.(enabled);
      toggleTrainerUI(enabled);
    });
  }

  if (balanceMeta) {
    balanceMeta.classList.add('meta-interactive');
    balanceMeta.addEventListener('click', () => {
      debugMenu.classList.toggle('hidden');
    });
  }

  if (moreButton) {
    moreButton.addEventListener('click', () => {
      openGamesModal();
    });
  }

  if (gamesOverlay) {
    gamesOverlay.addEventListener('click', () => {
      closeGamesModal();
    });
  }

  if (gamesCloseButton) {
    gamesCloseButton.addEventListener('click', () => {
      closeGamesModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !isGamesModalHidden()) {
      closeGamesModal();
    }
  });

  if (closeDebug) {
    closeDebug.addEventListener('click', () => {
      debugMenu.classList.add('hidden');
    });
  }

  if (betMinus) {
    betMinus.addEventListener('click', () => {
      if (roundActive) return;
      betIndex = Math.max(0, betIndex - 1);
      updateBetDisplay();
    });
  }

  if (betPlus) {
    betPlus.addEventListener('click', () => {
      if (roundActive) return;
      betIndex = Math.min(BET_STEPS.length - 1, betIndex + 1);
      updateBetDisplay();
    });
  }

  if (primaryButton) {
    primaryButton.addEventListener('click', () => {
      if (buttonState === BUTTON_STATES.READY) {
        startRound();
        return;
      }
      if (buttonState === BUTTON_STATES.RUNNING) {
        handleCashOut();
        return;
      }
      if (buttonState === BUTTON_STATES.WIN) {
        resetPostRoundUI();
        return;
      }
      if (!roundActive) {
        resetPostRoundUI();
      }
    });
  }

  if (copyScriptButton) {
    copyScriptButton.addEventListener('click', async () => {
      if (!trainerScript) return;
      const payload = JSON.stringify(trainerScript, null, 2);
      try {
        await navigator.clipboard.writeText(payload);
        copyScriptButton.textContent = 'Script Copied';
        setTimeout(() => {
          copyScriptButton.textContent = 'Copy Trainer Script';
        }, 1500);
      } catch (error) {
        copyScriptButton.textContent = 'Clipboard failed';
        setTimeout(() => {
          copyScriptButton.textContent = 'Copy Trainer Script';
        }, 1500);
      }
    });
  }
}

function disablePinchZoom() {
  if (pinchGestureHandlers.length) return;
  const preventGesture = (event) => {
    event.preventDefault();
  };
  const preventScroll = (event) => {
    event.preventDefault();
  };
  let lastTouchTime = 0;
  const preventDoubleTap = (event) => {
    const now = event.timeStamp || Date.now();
    if (now - lastTouchTime < 300) {
      event.preventDefault();
    }
    lastTouchTime = now;
  };
  const gestures = ['gesturestart', 'gesturechange', 'gestureend'];
  gestures.forEach((type) => {
    document.addEventListener(type, preventGesture, { passive: false });
    pinchGestureHandlers.push({ type, listener: preventGesture, options: { passive: false } });
  });
  document.addEventListener('touchmove', preventScroll, { passive: false });
  pinchGestureHandlers.push({
    type: 'touchmove',
    listener: preventScroll,
    options: { passive: false },
  });
  document.addEventListener('touchend', preventDoubleTap, { passive: false });
  pinchGestureHandlers.push({
    type: 'touchend',
    listener: preventDoubleTap,
    options: { passive: false },
  });
}

function enablePinchZoom() {
  while (pinchGestureHandlers.length) {
    const { type, listener, options } = pinchGestureHandlers.pop();
    document.removeEventListener(type, listener, options);
  }
}

function buildGameCallbacks() {
  return {
    onStatus: handleStatusUpdate,
    onMultiplier: handleMultiplierUpdate,
    onTrainerScript: handleTrainerScript,
    onRoundEnd: handleRoundEnd,
    onTrainerMode: handleTrainerToggle,
    onLevelChange: handleLevelChange,
    onCrash: handleCrashFinalize,
  };
}

function buildModeButtons(definition, activeLevelId) {
  if (!modeSwitch) return;
  modeSwitch.innerHTML = '';
  const levels = definition?.levels ?? {};
  const order =
    Array.isArray(definition?.modeOrder) && definition.modeOrder.length > 0
      ? definition.modeOrder
      : Object.keys(levels);

  order.forEach((levelKey) => {
    const level = levels[levelKey];
    if (!level) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mode-option';
    button.dataset.level = level.id;
    button.textContent = level.name ?? level.id;
    if (level.id === activeLevelId) {
      button.classList.add('active');
    }
    modeSwitch.appendChild(button);
  });

  modeButtons = Array.from(modeSwitch.querySelectorAll('.mode-option'));
  bindModeButtonEvents();
}

function bindModeButtonEvents() {
  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      handleModeSelection(button.dataset.level);
    });
  });
}

function handleModeSelection(levelId) {
  if (!levelId) return;
  const level = currentLevels?.[levelId];
  if (!level || currentLevel?.id === level.id) return;
  currentLevel = level;
  modeButtons.forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.level === level.id)
  );
  game?.setLevel?.(levelId);
  selectedCrashOption = 'random';
  renderCrashOptions(level, selectedCrashOption);
  selectedCrashOption = crashSelect.value;
  ensureAutopilotPreview(selectedCrashOption, level);
  updateUIForLevel(level);
  resetPostRoundUI();
}

function buildGamesList() {
  if (!gamesList) return;
  gamesList.innerHTML = '';
  GAME_LIST.forEach((definition) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'game-option';
    if (definition.id === currentGameId) {
      item.classList.add('active');
    }
    item.dataset.gameId = definition.id;
    const thumb = document.createElement('div');
    thumb.className = 'game-option__thumb';
    if (definition.thumbnail) {
      thumb.classList.add('with-image');
      thumb.style.setProperty('background-image', `url("${definition.thumbnail}")`);
    } else {
      const initial =
        (definition.name && definition.name[0]) ||
        (definition.id && definition.id[0]) ||
        '?';
      thumb.textContent = initial.toUpperCase();
    }
    const label = document.createElement('span');
    label.className = 'game-option__label';
    label.textContent = definition.name ?? definition.id;
    item.appendChild(thumb);
    item.appendChild(label);
    item.addEventListener('click', () => {
      closeGamesModal();
      if (definition.id !== currentGameId) {
        switchGame(definition.id);
      }
    });
    gamesList.appendChild(item);
  });
}

function openGamesModal() {
  if (!gamesModal) return;
  buildGamesList();
  gamesModal.classList.remove('hidden');
  gamesModal.setAttribute('aria-hidden', 'false');
}

function closeGamesModal() {
  if (!gamesModal) return;
  gamesModal.classList.add('hidden');
  gamesModal.setAttribute('aria-hidden', 'true');
}

function isGamesModalHidden() {
  return !gamesModal || gamesModal.classList.contains('hidden');
}

function resolveDefaultLevel(definition) {
  if (!definition) return null;
  const { defaultLevelId, levels } = definition;
  if (!levels) return null;
  if (defaultLevelId && levels[defaultLevelId]) {
    return levels[defaultLevelId];
  }
  const [firstKey] = Object.keys(levels);
  return firstKey ? levels[firstKey] : null;
}

function switchGame(gameId) {
  if (!gameId || gameId === currentGameId) return;
  const nextDefinition = getGameDefinition(gameId);
  if (!nextDefinition) return;
  game?.destroy?.();
  currentGameId = gameId;
  gameDefinition = nextDefinition;
  currentLevels = nextDefinition.levels ?? {};
  currentLevel = resolveDefaultLevel(nextDefinition);
  if (trainerToggle) {
    trainerToggle.checked = false;
    trainerToggle.disabled = false;
  }
  game = createGameInstance(gameId, canvas, buildGameCallbacks());
  if (game && currentLevel?.id) {
    game.setLevel?.(currentLevel.id);
  }
  selectedCrashOption = 'random';
  buildModeButtons(gameDefinition, currentLevel?.id);
  renderCrashOptions(currentLevel, selectedCrashOption);
  selectedCrashOption = crashSelect.value;
  ensureAutopilotPreview(selectedCrashOption, currentLevel);
  if (currentLevel?.id) {
    applyTheme(currentLevel.id);
    updateUIForLevel(currentLevel);
  } else {
    applyTheme('classic');
  }
  resetPostRoundUI();
  awaitingCrashAfterCashout = false;
  suppressCrashRoundEnd = false;
  previousMultiplier = 1;
  updateMultiplierDisplay(1, false);
  buildGamesList();
  game?.setTrainerMode?.(false);
  trainerScript = null;
  copyScriptButton?.classList?.add('hidden');
  statusLabel.textContent = 'Idle';
}
function startRound() {
  if (roundActive || !game) return;
  const crashIndex = resolveCrashIndex(currentLevel, selectedCrashOption);
  if (crashIndex >= 0 && !game.isCrashIndexValid?.(crashIndex)) {
    statusLabel.textContent = 'Invalid crash order.';
    return;
  }

  activeBet = BET_STEPS[betIndex];
  awaitingCrashAfterCashout = false;
  const trainerEnabled = Boolean(trainerToggle && trainerToggle.checked);
  if (!trainerEnabled) {
    if (activeBet > balance) {
      statusLabel.textContent = 'Insufficient balance.';
      return;
    }
    balance -= activeBet;
    updateBalanceDisplay();
  }

  trainerScript = null;
  copyScriptButton?.classList?.add('hidden');
  debugMenu?.classList?.add('hidden');
  setPrimaryButton(BUTTON_STATES.RUNNING);
  roundActive = true;
  disableBetSpinner(true);
  if (trainerToggle) {
    trainerToggle.disabled = true;
  }
  if (crashSelect) {
    crashSelect.disabled = true;
  }
  game.startRound({ crashIndex });
}

function handleCashOut() {
  if (!roundActive || (trainerToggle && trainerToggle.checked) || !game) return;
  const result = game.cashOut?.();
  if (!result) return;
}

function renderCrashOptions(level, preferredOption = 'random') {
  if (!crashSelect) return;
  crashSelect.innerHTML = '';
  const points = Array.isArray(level?.crashPoints) ? level.crashPoints : [];

  const randomOption = document.createElement('option');
  randomOption.value = 'random';
  randomOption.textContent = 'Random';
  crashSelect.appendChild(randomOption);

  const instantOption = document.createElement('option');
  instantOption.value = 'instant';
  instantOption.textContent = 'Instant Bust ×0.00';
  crashSelect.appendChild(instantOption);

  points.forEach((value, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `#${index + 1} ×${Number(value).toFixed(2)}`;
    crashSelect.appendChild(option);
  });

  const validValues = new Set(Array.from(crashSelect.options).map((opt) => opt.value));
  if (!validValues.has(preferredOption)) {
    preferredOption = 'random';
  }
  crashSelect.value = preferredOption;
}

function ensureAutopilotPreview(option, level = currentLevel) {
  if (!level) return;
  const index = option === 'random' || option === 'instant' ? 0 : Number(option);
  if (Number.isInteger(index) && index >= 0) {
    game?.loadAutopilotScript?.(index);
  }
}

function resolveCrashIndex(level, option) {
  if (option === 'random') {
    return pickRandomCrashIndex(level);
  }
  if (option === 'instant') {
    return -1;
  }
  const index = Number(option);
  return Number.isInteger(index) ? index : 0;
}

function pickRandomCrashIndex(level) {
  const points = Array.isArray(level?.crashPoints) ? level.crashPoints : [];
  const weights = Array.isArray(level?.randomCrashWeights)
    ? level.randomCrashWeights
    : [];
  const expectedLength = points.length + 1;
  if (weights.length >= expectedLength) {
    const total = weights.reduce((sum, weight) => sum + (weight || 0), 0);
    if (total > 0) {
      let roll = Math.random() * total;
      for (let i = 0; i < weights.length; i += 1) {
        roll -= weights[i] || 0;
        if (roll <= 0) {
          return i - 1;
        }
      }
      return Math.min(weights.length - 2, points.length - 1);
    }
  }
  const fallbackCount = points.length + 1;
  const randomIndex = Math.floor(Math.random() * fallbackCount);
  return randomIndex - 1;
}

function triggerCrashHighlight(multiplier) {
  if (crashHighlightTimer) {
    clearTimeout(crashHighlightTimer);
  }
  if (multiplierPulseTimer) {
    clearTimeout(multiplierPulseTimer);
    multiplierPulseTimer = null;
  }
  const highlightDuration = 1000;
  currentMultiplierEl.textContent = `×${multiplier.toFixed(2)}`;
  currentMultiplierEl.style.color = UI_THEME.multiplier.pipeLabelPassedColor;
  multiplierContainer.classList.remove('pulse');
  void multiplierContainer.offsetWidth;
  multiplierContainer.classList.add('pulse');
  crashHighlightTimer = setTimeout(() => {
    multiplierContainer.classList.remove('pulse');
    currentMultiplierEl.style.color = UI_THEME.multiplier.centerColor;
    crashHighlightTimer = null;
  }, highlightDuration);
  triggerScreenShake();
}

function updateBetDisplay() {
  const betValue = BET_STEPS[betIndex];
  if (buttonState === BUTTON_STATES.WIN) {
    metaLeftLabel.textContent = 'Last win:';
    metaLeftValue.textContent = formatCurrency(lastWinAmount);
  } else {
    metaLeftLabel.textContent = 'Total bet:';
    metaLeftValue.textContent = formatCurrency(betValue);
  }
  if (buttonState === BUTTON_STATES.READY) {
    ctaSubtext.textContent = formatCurrency(betValue);
  }
}

function triggerScreenShake(duration = 500) {
  if (!appContainer) return;
  appContainer.classList.remove('screen-shake');
  void appContainer.offsetWidth;
  appContainer.classList.add('screen-shake');
  if (screenShakeTimer) {
    clearTimeout(screenShakeTimer);
  }
  screenShakeTimer = setTimeout(() => {
    appContainer.classList.remove('screen-shake');
    screenShakeTimer = null;
  }, duration);
}

function updateBalanceDisplay() {
  balanceDisplay.textContent = formatCurrency(balance);
}

function updatePayoutPreview(multiplier) {
  if (buttonState !== BUTTON_STATES.RUNNING) return;
  const payout = trainerToggle.checked ? activeBet : activeBet * multiplier;
  ctaSubtext.textContent = formatCurrency(payout);
}

function updateMultiplierDisplay(value, animate = true) {
  currentMultiplierEl.textContent = `×${value.toFixed(2)}`;
  currentMultiplierEl.style.color = UI_THEME.multiplier.centerColor;
  currentMultiplierEl.style.fontSize = `${UI_THEME.multiplier.centerFontSize}px`;
  if (!animate) {
    multiplierContainer.classList.remove('pulse');
    return;
  }
  multiplierContainer.classList.remove('pulse');
  void multiplierContainer.offsetWidth;
  multiplierContainer.classList.add('pulse');
  currentMultiplierEl.style.color = UI_THEME.multiplier.pipeLabelPassedColor;
  if (multiplierPulseTimer) {
    clearTimeout(multiplierPulseTimer);
  }
  multiplierPulseTimer = setTimeout(() => {
    multiplierContainer.classList.remove('pulse');
    currentMultiplierEl.style.color = UI_THEME.multiplier.centerColor;
  }, 400);
}

function setPrimaryButton(state, opts = {}) {
  buttonState = state;
  switch (state) {
    case BUTTON_STATES.READY:
      ctaLabel.textContent = 'Bet';
      ctaSubtext.textContent = formatCurrency(BET_STEPS[betIndex]);
      winOverlay.classList.add('hidden');
      disableBetSpinner(false);
      break;
    case BUTTON_STATES.RUNNING:
      ctaLabel.textContent = 'Cash Out';
      ctaSubtext.textContent = formatCurrency(activeBet);
      disableBetSpinner(true);
      break;
    case BUTTON_STATES.WIN:
      ctaLabel.textContent = opts.label ?? 'You Cashed Out';
      ctaSubtext.textContent = formatCurrency(opts.amount ?? 0);
      winAmount.textContent = formatCurrency(opts.amount ?? 0);
      winOverlay.classList.remove('hidden');
      metaLeftLabel.textContent = 'Last win:';
      metaLeftValue.textContent = formatCurrency(opts.amount ?? 0);
      disableBetSpinner(false);
      break;
    default:
      ctaLabel.textContent = 'Bet';
      ctaSubtext.textContent = formatCurrency(BET_STEPS[betIndex]);
      disableBetSpinner(false);
      break;
  }
  applyButtonThemeForState(state);
  if (state !== BUTTON_STATES.WIN) {
    updateBetDisplay();
  }
}

function applyButtonThemeForState(state) {
  const key =
    state === BUTTON_STATES.RUNNING
      ? 'running'
      : state === BUTTON_STATES.WIN
      ? 'win'
      : 'ready';
  const defaultButtons = UI_THEME.modes.classic.buttons;
  const fallback = defaultButtons[key] ?? defaultButtons.ready;
  const theme = activeModeTheme.buttons?.[key] ?? fallback;
  if (!theme) return;
  const {
    background,
    textColor,
    subtextColor,
    borderColor,
    borderRadius,
    boxShadow,
    labelFontSize,
    subtextFontSize,
  } = theme;
  primaryButton.style.background = background ?? '';
  primaryButton.style.color = textColor ?? '';
  primaryButton.style.boxShadow = boxShadow ?? 'none';
  primaryButton.style.border = borderColor ? `1px solid ${borderColor}` : 'none';
  primaryButton.style.borderRadius =
    borderRadius != null ? `${borderRadius}px` : '';
  ctaLabel.style.color = textColor ?? '';
  ctaSubtext.style.color = subtextColor ?? textColor ?? '';
  ctaLabel.style.fontSize = labelFontSize
    ? `${labelFontSize}px`
    : '';
  ctaSubtext.style.fontSize = subtextFontSize
    ? `${subtextFontSize}px`
    : '';
}

function disableBetSpinner(disabled) {
  betSpinner?.classList?.toggle('disabled', disabled);
  betMinus.disabled = disabled;
  betPlus.disabled = disabled;
  modeButtons.forEach((btn) => {
    btn.disabled = disabled;
    btn.classList.toggle('disabled', disabled);
  });
  if (moreButton) {
    moreButton.disabled = disabled;
    moreButton.classList.toggle('disabled', disabled);
  }
}

function resetPostRoundUI() {
  if (winResetTimer) {
    clearTimeout(winResetTimer);
    winResetTimer = null;
  }
  winOverlay.classList.add('hidden');
  debugMenu.classList.add('hidden');
  if (crashHighlightTimer) {
    clearTimeout(crashHighlightTimer);
    crashHighlightTimer = null;
  }
  multiplierContainer.classList.remove('pulse');
  currentMultiplierEl.style.color = UI_THEME.multiplier.centerColor;
  setPrimaryButton(BUTTON_STATES.READY);
  roundActive = false;
  trainerToggle.disabled = false;
  crashSelect.disabled = false;
  updateMultiplierDisplay(1, false);
  previousMultiplier = 1;
  primaryButton.disabled = false;
  awaitingCrashAfterCashout = false;
  suppressCrashRoundEnd = false;
  disableBetSpinner(false);
}

function handleStatusUpdate(status) {
  statusLabel.textContent = status;
}

function handleMultiplierUpdate(multiplier) {
  const shown = multiplier < 1 ? 1 : multiplier;
  multiplierLabel.textContent = `×${shown.toFixed(2)}`;
  const animate = shown > previousMultiplier + 0.001;
  updateMultiplierDisplay(shown, animate);
  previousMultiplier = shown;
  updatePayoutPreview(shown);
}

function handleTrainerScript(script) {
  trainerScript = script;
  copyScriptButton?.classList?.remove('hidden');
}

function handleTrainerToggle(enabled) {
  toggleTrainerUI(enabled);
}


function handleCrashFinalize(result) {
  if (!awaitingCrashAfterCashout) return;
  const multiplier = result?.multiplier || 1;
  triggerCrashHighlight(multiplier);
  awaitingCrashAfterCashout = false;
  suppressCrashRoundEnd = true;
  roundActive = false;
  disableBetSpinner(false);
  if (trainerToggle) {
    trainerToggle.disabled = false;
  }
  if (crashSelect) {
    crashSelect.disabled = false;
  }
  primaryButton.disabled = false;
  previousMultiplier = 1;
  scheduleReset(1200, resetPostRoundUI);
}

function handleLevelChange(level) {
  if (!level) return;
  currentLevel = level;
  applyTheme(level.id);
  updateUIForLevel(level);
}

function handleRoundEnd(result) {
  if (!result) return;

  if (suppressCrashRoundEnd && result.status === 'crashed') {
    suppressCrashRoundEnd = false;
    return;
  }

  const trainerEnabled = Boolean(trainerToggle && trainerToggle.checked);
  if (trainerEnabled) {
    resetPostRoundUI();
    scheduleReset();
    return;
  }

  if (result.status === 'cashed_out') {
    awaitingCrashAfterCashout = true;
    roundActive = true;
    disableBetSpinner(true);
    trainerToggle.disabled = true;
    crashSelect.disabled = true;
    primaryButton.disabled = true;
    const multiplier = result.multiplier || 1;
    previousMultiplier = multiplier;
    const payout = Number((activeBet * multiplier).toFixed(2));
    balance += payout;
    lastWinAmount = payout;
    updateBalanceDisplay();
    setPrimaryButton(BUTTON_STATES.WIN, { amount: payout });
    disableBetSpinner(true);
    return;
  }

  awaitingCrashAfterCashout = false;
  roundActive = false;
  disableBetSpinner(false);
  if (trainerToggle) {
    trainerToggle.disabled = false;
  }
  if (crashSelect) {
    crashSelect.disabled = false;
  }
  previousMultiplier = 1;
  primaryButton.disabled = false;

  if (result.status === 'cleared') {
    const multiplier = result.multiplier || 1;
    const payout = Number((activeBet * multiplier).toFixed(2));
    balance += payout;
    lastWinAmount = payout;
    updateBalanceDisplay();
    setPrimaryButton(BUTTON_STATES.WIN, { amount: payout });
    winResetTimer = setTimeout(() => {
      resetPostRoundUI();
    }, 3000);
    scheduleReset();
    return;
  }

  const crashMultiplier = result.multiplier || 0;
  triggerCrashHighlight(crashMultiplier);
  const crashDelay = 700;
  scheduleReset(crashDelay, resetPostRoundUI);
}

function scheduleReset(delay = 600, afterReset) {
  setTimeout(() => {
    if (game?.resetRound) {
      game.resetRound();
    }
    if (typeof afterReset === 'function') {
      afterReset();
    }
  }, delay);
}

function toggleTrainerUI(enabled) {
  if (enabled) {
    statusLabel.textContent = 'Trainer Ready';
    primaryButton.disabled = false;
  } else if (!roundActive) {
    statusLabel.textContent = 'Idle';
  }
}

function updateUIForLevel(level) {
  if (!level) {
    document.body.dataset.levelTheme = '';
    return;
  }
  document.body.dataset.levelTheme = level.id;
  modeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.level === level.id);
  });
}

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}
