import { Game } from './game/Game.js';
import { LEVELS } from './data/levels.js';
import { UI_THEME } from './game/constants.js';

const canvas = document.getElementById('game-canvas');
const balanceDisplay = document.getElementById('balance-display');
const crashSelect = document.getElementById('crash-select');
const trainerToggle = document.getElementById('trainer-toggle');
const statusLabel = document.getElementById('status-label');
const multiplierLabel = document.getElementById('multiplier-label');
const copyScriptButton = document.getElementById('copy-script-button');
const modeSwitch = document.getElementById('mode-switch');
const modeButtons = modeSwitch.querySelectorAll('.mode-option');
const moreButton = document.getElementById('more-button');
const debugMenu = document.getElementById('debug-menu');
const closeDebug = document.getElementById('close-debug');
const primaryButton = document.getElementById('primary-button');
const ctaLabel = primaryButton.querySelector('.cta-label');
const ctaSubtext = document.getElementById('cta-subtext');
const betSpinner = document.getElementById('bet-spinner');
const betMinus = document.getElementById('bet-minus');
const betPlus = document.getElementById('bet-plus');
const betAmountEl = document.getElementById('bet-amount');
const metaLeftLabel = document.getElementById('meta-left-label');
const metaLeftValue = document.getElementById('meta-left-value');
const winOverlay = document.getElementById('win-overlay');
const winAmount = document.getElementById('win-amount');
const multiplierContainer = document.getElementById('multiplier-container');
const currentMultiplierEl = document.getElementById('current-multiplier');
const root = document.documentElement;

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
let selectedCrashIndex = 0;
let currentLevel = LEVELS.medium;
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


const game = new Game(canvas, {
  onStatus: handleStatusUpdate,
  onMultiplier: handleMultiplierUpdate,
  onTrainerScript: handleTrainerScript,
  onRoundEnd: handleRoundEnd,
  onTrainerMode: handleTrainerToggle,
  onLevelChange: handleLevelChange,
});

init();

function init() {
  renderCrashOptions(currentLevel);
  selectedCrashIndex = Number(crashSelect.value);
  updateBalanceDisplay();
  updateBetDisplay();
  applyTheme(currentLevel.id);
  updateMultiplierDisplay(1, false);
  updateUIForLevel(currentLevel);
  setPrimaryButton(BUTTON_STATES.READY);
  attachEventListeners();
  game.loadAutopilotScript(selectedCrashIndex);
}

function attachEventListeners() {
  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const levelId = button.dataset.level;
      const level = LEVELS[levelId];
      if (!level || currentLevel.id === level.id) return;
      currentLevel = level;
      modeButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
      game.setLevel(levelId);
      renderCrashOptions(level);
      selectedCrashIndex = Number(crashSelect.value);
      game.loadAutopilotScript(selectedCrashIndex);
      updateUIForLevel(level);
      resetPostRoundUI();
    });
  });

  crashSelect.addEventListener('change', () => {
    selectedCrashIndex = Number(crashSelect.value);
    game.loadAutopilotScript(selectedCrashIndex);
  });

  trainerToggle.addEventListener('change', () => {
    const enabled = trainerToggle.checked;
    game.setTrainerMode(enabled);
    toggleTrainerUI(enabled);
  });

  moreButton.addEventListener('click', () => {
    debugMenu.classList.toggle('hidden');
  });

  closeDebug.addEventListener('click', () => {
    debugMenu.classList.add('hidden');
  });

  betMinus.addEventListener('click', () => {
    if (roundActive) return;
    betIndex = Math.max(0, betIndex - 1);
    updateBetDisplay();
  });

  betPlus.addEventListener('click', () => {
    if (roundActive) return;
    betIndex = Math.min(BET_STEPS.length - 1, betIndex + 1);
    updateBetDisplay();
  });

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

function startRound() {
  if (roundActive) return;
  if (!game.isCrashIndexValid(selectedCrashIndex)) {
    statusLabel.textContent = 'Invalid crash order.';
    return;
  }

  activeBet = BET_STEPS[betIndex];
  awaitingCrashAfterCashout = false;
  if (!trainerToggle.checked) {
    if (activeBet > balance) {
      statusLabel.textContent = 'Insufficient balance.';
      return;
    }
    balance -= activeBet;
    updateBalanceDisplay();
  }

  trainerScript = null;
  copyScriptButton.classList.add('hidden');
  debugMenu.classList.add('hidden');
  setPrimaryButton(BUTTON_STATES.RUNNING);
  roundActive = true;
  disableBetSpinner(true);
  trainerToggle.disabled = true;
  crashSelect.disabled = true;
  game.startRound({ crashIndex: selectedCrashIndex });
}

function handleCashOut() {
  if (!roundActive || trainerToggle.checked) return;
  const result = game.cashOut();
  if (!result) return;
}

function renderCrashOptions(level, preferredIndex = 0) {
  crashSelect.innerHTML = '';
  const points = Array.isArray(level?.crashPoints) ? level.crashPoints : [];
  points.forEach((value, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `#${index + 1} ×${Number(value).toFixed(2)}`;
    crashSelect.appendChild(option);
  });
  if (!points.length) {
    crashSelect.value = '';
    return;
  }
  const clampIndex = Math.max(
    0,
    Math.min(Number.isInteger(preferredIndex) ? preferredIndex : 0, points.length - 1)
  );
  crashSelect.value = String(clampIndex);
}

function triggerCrashHighlight(multiplier) {
  if (crashHighlightTimer) {
    clearTimeout(crashHighlightTimer);
  }
  const highlightDuration = 400;
  currentMultiplierEl.textContent = `×${multiplier.toFixed(2)}`;
  currentMultiplierEl.style.color = UI_THEME.multiplier.pipeLabelPassedColor;
  multiplierContainer.classList.remove('pulse');
  void multiplierContainer.offsetWidth;
  multiplierContainer.classList.add('pulse');
  currentMultiplierEl.style.color = UI_THEME.multiplier.pipeLabelPassedColor;
  crashHighlightTimer = setTimeout(() => {
    multiplierContainer.classList.remove('pulse');
    currentMultiplierEl.style.color = UI_THEME.multiplier.centerColor;
    crashHighlightTimer = null;
  }, highlightDuration);
}

function updateBetDisplay() {
  const betValue = BET_STEPS[betIndex];
  betAmountEl.textContent = formatCurrency(betValue);
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
  betSpinner.classList.toggle('disabled', disabled);
  betMinus.disabled = disabled;
  betPlus.disabled = disabled;
}

function resetPostRoundUI() {
  if (winResetTimer) {
    clearTimeout(winResetTimer);
    winResetTimer = null;
  }
  winOverlay.classList.add('hidden');
  debugMenu.classList.add('hidden');
  setPrimaryButton(BUTTON_STATES.READY);
  roundActive = false;
  trainerToggle.disabled = false;
  crashSelect.disabled = false;
  updateMultiplierDisplay(1, false);
  previousMultiplier = 1;
  primaryButton.disabled = false;
  awaitingCrashAfterCashout = false;
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
  copyScriptButton.classList.remove('hidden');
}

function handleTrainerToggle(enabled) {
  toggleTrainerUI(enabled);
}

function handleLevelChange(level) {
  currentLevel = level;
  applyTheme(level.id);
  updateUIForLevel(level);
}

function handleRoundEnd(result) {
  if (!result) return;

  if (trainerToggle.checked) {
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
    if (!trainerToggle.checked) {
      const payout = Number((activeBet * multiplier).toFixed(2));
      balance += payout;
      lastWinAmount = payout;
      updateBalanceDisplay();
      setPrimaryButton(BUTTON_STATES.WIN, { amount: payout });
    }
    return;
  }

  awaitingCrashAfterCashout = false;
  roundActive = false;
  disableBetSpinner(false);
  trainerToggle.disabled = false;
  crashSelect.disabled = false;
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
  } else {
    resetPostRoundUI();
  }

  scheduleReset();
}

function scheduleReset() {
  setTimeout(() => {
    game.resetRound();
  }, 600);
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
  document.body.dataset.levelTheme = level.id;
  modeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.level === level.id);
  });
}

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

