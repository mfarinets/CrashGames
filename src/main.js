import { Game } from './game/Game.js';
import { LEVELS } from './data/levels.js';

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

const BET_STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
const BUTTON_STATES = {
  READY: 'ready',
  RUNNING: 'running',
  WIN: 'win',
  IDLE: 'idle',
};

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

function setPrimaryButton(state, opts = {}) {
  buttonState = state;
  primaryButton.classList.remove('ready', 'cashout', 'win');
  switch (state) {
    case BUTTON_STATES.READY:
      primaryButton.classList.add('ready');
      ctaLabel.textContent = 'Bet';
      ctaSubtext.textContent = formatCurrency(BET_STEPS[betIndex]);
      winOverlay.classList.add('hidden');
      metaLeftLabel.textContent = 'Total bet:';
      metaLeftValue.textContent = formatCurrency(BET_STEPS[betIndex]);
      disableBetSpinner(false);
      break;
    case BUTTON_STATES.RUNNING:
      primaryButton.classList.add('cashout');
      ctaLabel.textContent = 'Cash Out';
      ctaSubtext.textContent = formatCurrency(activeBet);
      disableBetSpinner(true);
      break;
    case BUTTON_STATES.WIN:
      primaryButton.classList.add('win');
      ctaLabel.textContent = opts.label ?? 'You Cashed Out';
      ctaSubtext.textContent = formatCurrency(opts.amount ?? 0);
      winAmount.textContent = formatCurrency(opts.amount ?? 0);
      winOverlay.classList.remove('hidden');
      metaLeftLabel.textContent = 'Last win:';
      metaLeftValue.textContent = formatCurrency(opts.amount ?? 0);
      disableBetSpinner(false);
      break;
    default:
      primaryButton.classList.add('ready');
      ctaLabel.textContent = 'Bet';
      ctaSubtext.textContent = formatCurrency(BET_STEPS[betIndex]);
      disableBetSpinner(false);
      break;
  }
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
  updateBetDisplay();
  roundActive = false;
  trainerToggle.disabled = false;
  crashSelect.disabled = false;
}

function handleStatusUpdate(status) {
  statusLabel.textContent = status;
}

function handleMultiplierUpdate(multiplier) {
  const shown = multiplier < 1 ? 1 : multiplier;
  multiplierLabel.textContent = `×${shown.toFixed(2)}`;
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
  updateUIForLevel(level);
}

function handleRoundEnd(result) {
  roundActive = false;
  disableBetSpinner(false);
  trainerToggle.disabled = false;
  crashSelect.disabled = false;

  if (trainerToggle.checked) {
    resetPostRoundUI();
    scheduleReset();
    return;
  }

  if (result && (result.status === 'cashed_out' || result.status === 'cleared')) {
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
    metaLeftLabel.textContent = 'Total bet:';
    metaLeftValue.textContent = formatCurrency(BET_STEPS[betIndex]);
    setPrimaryButton(BUTTON_STATES.READY);
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
