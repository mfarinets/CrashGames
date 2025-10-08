import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  WORLD,
  BIRD,
  PIPE,
  COLORS,
  UI_THEME,
  BIRD_SPRITES,
} from './constants.js';
import { LEVELS } from '../data/levels.js';
import { AUTOPILOT_PRESETS } from '../data/autopilotPresets.js';
import { PipeSpriteManager } from './pipeSprites.js';

const RADIANS_PER_DEGREE = Math.PI / 180;
const MULTIPLIER_HIGHLIGHT_DURATION = 0.35;
const IMMEDIATE_CRASH_SCRIPT = [70, 140];
const IMMEDIATE_CRASH_DISTANCE = 240;

export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.virtualScale = 1;

    this.level = LEVELS.medium;
    this.roundState = 'idle';
    this.currentMultiplier = 1.0;
    this.forcedCrashPipeId = null;
    this.crashIndex = 0;
    this.crashPoint = this.level.crashPoints[this.crashIndex] ?? null;
    this.autopilotScript = [];
    this.autopilot = new AutopilotController();
    this.trainerMode = false;
    this.trainerLog = [];
    this.lastFlapDistance = -Infinity;

    this.scrollOffset = 0;
    this.distanceTravelled = 0;
    this.elapsed = 0;
    this.deltaAccumulator = 0;
    this.lastFrameTime = performance.now();

    this.bird = createBird();
    this.pipes = [];
    this.parallaxClouds = buildClouds();
    this.crashSequence = null;
    this.birdSpriteCache = {};
    this.loadBirdSprite(this.level.id);
    this.forceImmediateCrash = false;
    this.immediateCrashDistance = IMMEDIATE_CRASH_DISTANCE;
    this.pipeSpriteManager = new PipeSpriteManager();
    const defaultSet = this.pipeSpriteManager.getSet('metal');
    defaultSet?.top?.requestLoad();
    defaultSet?.bottom?.requestLoad();
   // preloadPipeSprites();
    this.loadAutopilotScript(this.crashIndex);

    this.pointerActive = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.pointerActive = true;
      if (this.trainerMode) this.handleFlap('manual');
    });
    canvas.addEventListener('pointerup', () => {
      this.pointerActive = false;
    });

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.code === 'Space') {
        if (this.trainerMode) this.handleFlap('manual');
      }
    });

    requestAnimationFrame((ts) => this.frame(ts));
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  setLevel(levelId) {
    const level = LEVELS[levelId];
    if (!level) return;
    this.level = level;
    this.loadBirdSprite(levelId);
    this.crashIndex = 0;
    this.crashPoint = level.crashPoints[0] ?? null;
    this.loadAutopilotScript(this.crashIndex);
    this.callbacks?.onLevelChange?.(level);
    this.resetRound();
  }

  setTrainerMode(enabled) {
    this.trainerMode = enabled;
    this.callbacks?.onTrainerMode?.(enabled);
  }

  getCrashCount() {
    return this.level.crashPoints.length;
  }

  getMultiplierForCrashIndex(index) {
    if (index < 0) return 0;
    return this.level.crashPoints[index] ?? null;
  }

  isCrashIndexValid(index) {
    return (
      Number.isInteger(index) && index >= 0 && index < this.level.crashPoints.length
    );
  }

  loadAutopilotScript(crashIndex = this.crashIndex ?? 0) {
    if (crashIndex < 0) {
      this.autopilotScript = [];
      return;
    }
    const script = resolveAutopilotScript(this.level, crashIndex);
    this.autopilotScript = script;
    if (this.roundState !== 'running') {
      this.autopilot.setScript(this.autopilotScript || []);
    }
  }

  loadBirdSprite(levelId) {
    if (this.birdSpriteCache[levelId]) return;
    const config = BIRD_SPRITES[levelId];
    if (!config || !config.src) {
      this.birdSpriteCache[levelId] = { status: 'none' };
      return;
    }
    const image = new Image();
    this.birdSpriteCache[levelId] = { status: 'loading', image };
    image.onload = () => {
      this.birdSpriteCache[levelId] = {
        status: 'ready',
        image,
        width: config.width || BIRD.width,
        height: config.height || BIRD.height,
      };
    };
    image.onerror = () => {
      this.birdSpriteCache[levelId] = { status: 'error' };
    };
    image.src = config.src;
  }

  startRound({ crashIndex }) {
    if (this.roundState === 'running') return;
    const instantCrash = crashIndex === -1;
    if (!instantCrash && !this.isCrashIndexValid(crashIndex)) {
      this.callbacks?.onStatus?.('Invalid crash order');
      return;
    }
    this.roundState = 'running';
    this.currentMultiplier = 1.0;
    this.scrollOffset = 0;
    this.distanceTravelled = 0;
    this.elapsed = 0;
    this.trainerLog = [];
    this.lastFlapDistance = -Infinity;
    this.crashSequence = null;
    this.bird = createBird();
    this.pipes = buildRoundPipes(this.level);
    this.autopilot.reset();
    if (instantCrash) {
      this.crashIndex = -1;
      this.crashPoint = 0;
      this.autopilotScript = [];
      this.autopilot.setScript(IMMEDIATE_CRASH_SCRIPT);
      this.autopilot.setFallbackEnabled(false);
      this.forceImmediateCrash = true;
      this.immediateCrashDistance = IMMEDIATE_CRASH_DISTANCE;
      this.forcedCrashPipeId = null;
    } else {
      this.crashIndex = crashIndex;
      this.crashPoint = this.getMultiplierForCrashIndex(crashIndex);
      this.loadAutopilotScript(this.crashIndex);
      this.autopilot.setScript(this.autopilotScript || []);
      this.autopilot.setFallbackEnabled(true);
      this.forceImmediateCrash = false;
      this.immediateCrashDistance = IMMEDIATE_CRASH_DISTANCE;
      this.forcedCrashPipeId = this.trainerMode
        ? null
        : determineCrashPipeId(this.level, this.crashIndex);
    }
    this.callbacks?.onStatus?.('Running');
    this.callbacks?.onMultiplier?.(this.currentMultiplier);
  }

  cashOut() {
    if (this.roundState !== 'running') return null;
    const result = {
      type: 'cashout',
      multiplier: this.currentMultiplier,
    };
    this.callbacks?.onStatus?.('Settled');
    this.callbacks?.onRoundEnd?.({
      status: 'cashed_out',
      multiplier: this.currentMultiplier,
    });
    return result;
  }

  forceCrash(reason = 'crash') {
    if (this.roundState !== 'running') return null;
    this.autopilot.lock();
    this.crashSequence = null;
    this.forceImmediateCrash = false;
    const result = {
      type: reason,
      multiplier: this.currentMultiplier,
    };
    this.finishRound('crashed');
    return result;
  }

  finishRound(status) {
    this.roundState = status;
    this.crashSequence = null;
    this.autopilot.lock();
    this.forceImmediateCrash = false;
    this.autopilot.setFallbackEnabled(true);
    if (status === 'crashed') {
      this.callbacks?.onCrash?.({
        status,
        multiplier: this.currentMultiplier,
      });
    }
    this.callbacks?.onStatus?.(status === 'crashed' ? 'Crashed' : 'Settled');
    if (this.trainerMode && this.trainerLog.length) {
      this.callbacks?.onTrainerScript?.([...this.trainerLog]);
    }
    this.callbacks?.onRoundEnd?.({
      status,
      multiplier: this.currentMultiplier,
    });
  }

  resetRound() {
    this.roundState = 'idle';
    this.currentMultiplier = 1.0;
    this.scrollOffset = 0;
    this.distanceTravelled = 0;
    this.elapsed = 0;
    this.trainerLog = [];
    this.autopilot.reset();
    this.autopilot.setScript(this.autopilotScript || []);
    this.bird = createBird();
    this.pipes = buildRoundPipes(this.level);
    this.crashSequence = null;
    this.forceImmediateCrash = false;
    this.immediateCrashDistance = IMMEDIATE_CRASH_DISTANCE;
    this.autopilot.setFallbackEnabled(true);
    this.crashPoint = this.getMultiplierForCrashIndex(this.crashIndex);
    this.callbacks?.onStatus?.('Idle');
    this.callbacks?.onMultiplier?.(this.currentMultiplier);
  }

  getStateSnapshot() {
    return {
      roundState: this.roundState,
      multiplier: this.currentMultiplier,
      trainerMode: this.trainerMode,
      crashIndex: this.crashIndex,
      crashPoint: this.crashPoint,
    };
  }

  frame(timestamp) {
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;
    this.update(dt);
    this.draw();
    requestAnimationFrame((ts) => this.frame(ts));
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const maxDt = 0.032;
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(remaining, maxDt);
      this.step(step);
      remaining -= step;
    }
  }

  step(dt) {
    if (this.roundState !== 'running') return;

    this.elapsed += dt;
    this.scrollOffset += WORLD.scrollSpeed * dt;
    this.distanceTravelled = this.scrollOffset;

    if (!this.trainerMode) {
      const nextPipe = this.findNextPipe();
      const shouldFlap = this.autopilot.update({
        dt,
        distance: this.distanceTravelled,
        bird: this.bird,
        nextPipe,
        level: this.level,
      });
      if (shouldFlap) this.handleFlap('autopilot');
    }

    if (
      this.forceImmediateCrash &&
      this.distanceTravelled >= this.immediateCrashDistance
    ) {
      this.forceImmediateCrash = false;
      this.currentMultiplier = 0;
      this.callbacks?.onMultiplier?.(this.currentMultiplier);
      this.forceCrash('scripted');
      return;
    }

    if (this.crashSequence) {
      this.crashSequence.timer += dt;
      this.bird.velocity = Math.max(this.bird.velocity, 0);
      this.bird.velocity += 520 * dt;
    }

    this.bird.velocity += WORLD.gravity * dt;
    if (this.bird.velocity > WORLD.maxFallSpeed) {
      this.bird.velocity = WORLD.maxFallSpeed;
    }
    this.bird.y += this.bird.velocity * dt;

    const groundY = VIRTUAL_HEIGHT - WORLD.groundHeight - BIRD.height / 2;
    if (this.bird.y > groundY) {
      this.bird.y = groundY;
      this.forceCrash('ground');
    }

    this.updatePipes(dt);
    this.updateBirdRotation();
    this.updateClouds(dt);
  }

  handleFlap(source = 'manual') {
    if (this.roundState !== 'running') return;
    this.bird.velocity = WORLD.flapVelocity;
    if (this.trainerMode && source === 'manual') {
      const trimmed = Number(this.distanceTravelled.toFixed(2));
      if (trimmed - this.lastFlapDistance > 6) {
        this.trainerLog.push(trimmed);
        this.lastFlapDistance = trimmed;
      }
    }
  }

  armScriptedCrash(pipe) {
    if (this.crashSequence && this.crashSequence.pipeId === pipe.id) return;
    this.autopilot.lock();
    this.crashSequence = {
      pipeId: pipe.id,
      timer: 0,
    };
    this.forcedCrashPipeId = null;
    const crashMultiplier = this.getMultiplierForCrashIndex(this.crashIndex);
    if (!this.trainerMode && Number.isFinite(crashMultiplier)) {
      this.currentMultiplier = crashMultiplier;
      this.callbacks?.onMultiplier?.(this.currentMultiplier);
    }
    this.bird.velocity = Math.max(this.bird.velocity, 120);
  }

  updatePipes(dt) {
    for (const pipe of this.pipes) {
      pipe.highlightTimer = Math.max(
        0,
        (pipe.highlightTimer || 0) - (dt ?? 0)
      );
      pipe.x = pipe.spawnX - this.scrollOffset;
      const birdLeft = WORLD.birdX - BIRD.width / 2;
      const birdRight = WORLD.birdX + BIRD.width / 2;
      const collisionInset = this.pipeSpriteManager?.getCollisionInset(
        pipe.spriteKey
      );
      const inset = collisionInset ?? 0;
      const pipeLeft = pipe.x + inset;
      const pipeRight = pipe.x + PIPE.width - inset;

      if (!pipe.passed && pipeRight < birdLeft) {
        pipe.passed = true;
        pipe.highlightTimer = MULTIPLIER_HIGHLIGHT_DURATION;
        if (this.trainerMode || pipe.id < this.crashIndex) {
          this.currentMultiplier = pipe.multiplier;
          this.callbacks?.onMultiplier?.(this.currentMultiplier);
        }
      }

      if (pipe.passed || pipeRight < birdLeft || pipeLeft > birdRight) {
        continue;
      }

      const gapTop = pipe.gapCenter - pipe.gapHeight / 2;
      const gapBottom = pipe.gapCenter + pipe.gapHeight / 2;
      const birdTop = this.bird.y - BIRD.height / 2;
      const birdBottom = this.bird.y + BIRD.height / 2;

      if (
        rectanglesOverlap(
          birdLeft + PIPE.edgePadding,
          birdTop + PIPE.edgePadding,
          birdRight - PIPE.edgePadding,
          birdBottom - PIPE.edgePadding,
          pipeLeft,
          0,
          pipeRight,
          gapTop
        ) ||
        rectanglesOverlap(
          birdLeft + PIPE.edgePadding,
          birdTop + PIPE.edgePadding,
          birdRight - PIPE.edgePadding,
          birdBottom - PIPE.edgePadding,
          pipeLeft,
          gapBottom,
          pipeRight,
          VIRTUAL_HEIGHT
        )
      ) {
        this.forceCrash('pipe');
        return;
      }

      if (
        !this.trainerMode &&
        pipe.id === this.forcedCrashPipeId &&
        pipeLeft <= birdRight
      ) {
        this.armScriptedCrash(pipe);
        continue;
      }
    }

    const lastPipe = this.pipes[this.pipes.length - 1];
    if (lastPipe && lastPipe.passed) {
      this.finishRound('cleared');
    }
  }

  updateBirdRotation() {
    const velocity = this.bird.velocity;
    const targetAngle = Math.max(
      Math.min((velocity / WORLD.maxFallSpeed) * 70, 40),
      -30
    );
    this.bird.rotation += (targetAngle - this.bird.rotation) * 0.15;
  }

  updateClouds(dt) {
    for (const cloud of this.parallaxClouds) {
      cloud.x -= cloud.speed * dt;
      if (cloud.x + cloud.width < 0) {
        cloud.x = VIRTUAL_WIDTH + Math.random() * 120;
        cloud.y = 60 + Math.random() * 180;
        cloud.width = 90 + Math.random() * 120;
      }
    }
  }

  findNextPipe() {
    const birdRight = WORLD.birdX + BIRD.width / 2;
    return this.pipes.find(
      (pipe) => !pipe.passed && pipe.x + PIPE.width >= birdRight
    );
  }

  resize() {
    const { clientWidth, clientHeight } = this.canvas;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scaleX = width / VIRTUAL_WIDTH;
    const scaleY = height / VIRTUAL_HEIGHT;
    this.virtualScale = Math.min(scaleX, scaleY);

    const pixelWidth = Math.floor(width * this.pixelRatio);
    const pixelHeight = Math.floor(height * this.pixelRatio);
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(
      this.pixelRatio * this.virtualScale,
      0,
      0,
      this.pixelRatio * this.virtualScale,
      0,
      0
    );
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    drawBackground(ctx, this.level);
    drawClouds(ctx, this.parallaxClouds);
    drawPipes(ctx, this.pipes, this.level, this.pipeSpriteManager);
    drawBird(ctx, this.bird, this.birdSpriteCache[this.level.id]);
    drawGround(ctx, this.level);
    if (this.roundState === 'crashed') {
      drawCrashOverlay(ctx);
    }
    ctx.restore();
  }
}

function createBird() {
  return {
    y: VIRTUAL_HEIGHT / 2,
    velocity: 0,
    rotation: 0,
  };
}

function buildRoundPipes(level) {
  return level.pipes.map((pipe) => ({
    ...pipe,
    x: pipe.spawnX,
    passed: false,
    highlightTimer: 0,
  }));
}

function determineCrashPipeId(level, crashIndex) {
  if (!Number.isInteger(crashIndex)) return null;
  return level.pipes[crashIndex] ? crashIndex : null;
}

function rectanglesOverlap(
  ax1,
  ay1,
  ax2,
  ay2,
  bx1,
  by1,
  bx2,
  by2
) {
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

function drawBackground(ctx, level) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
  gradient.addColorStop(0, COLORS.skyTop);
  gradient.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
}

function drawClouds(ctx, clouds) {
  ctx.fillStyle = COLORS.cloud;
  for (const cloud of clouds) {
    drawRoundedRectPath(
      ctx,
      cloud.x,
      cloud.y,
      cloud.width,
      cloud.height,
      cloud.height / 2
    );
    ctx.fill();
  }
}

function drawPipes(ctx, pipes, level, spriteManager) {
  ctx.strokeStyle = 'rgba(15,23,42,0.35)';
  ctx.lineWidth = 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '600 18px "Inter", sans-serif';

  const pipeTopColorBase =
    level.groundTheme === 'lava' ? '#f97316' : COLORS.pipeTop;
  const pipeBottomColorBase =
    level.groundTheme === 'lava' ? '#ea580c' : COLORS.pipeBottom;
  const pipeTopPassed = level.groundTheme === 'lava' ? '#fb923c' : '#4ade80';
  const pipeBottomPassed = level.groundTheme === 'lava' ? '#f97316' : '#22c55e';
  const pipeLabelBaseColor = UI_THEME.multiplier.pipeLabelBaseColor;
  const pipeLabelPassedColor = UI_THEME.multiplier.pipeLabelPassedColor;

  for (const pipe of pipes) {
    const gapTop = pipe.gapCenter - pipe.gapHeight / 2;
    const gapBottom = pipe.gapCenter + pipe.gapHeight / 2;
    const highlightProgress = Math.max(
      0,
      Math.min(1, (pipe.highlightTimer || 0) / MULTIPLIER_HIGHLIGHT_DURATION)
    );

    let topDrawn = false;
    if (spriteManager) {
      topDrawn = spriteManager.drawTop(ctx, pipe.spriteKey, pipe.x, gapTop);
    }
    if (!topDrawn) {
      const usedTopColor = pipe.passed ? pipeTopPassed : pipeTopColorBase;
      ctx.fillStyle = usedTopColor;
      drawRoundedRectPath(ctx, pipe.x, 0, PIPE.width, gapTop, 14);
      ctx.fill();
    }

    const bottomHeight = Math.max(
      0,
      VIRTUAL_HEIGHT - gapBottom - WORLD.groundHeight
    );
    let bottomDrawn = false;
    if (spriteManager && bottomHeight > 0) {
      bottomDrawn = spriteManager.drawBottom(
        ctx,
        pipe.spriteKey,
        pipe.x,
        gapBottom,
        bottomHeight
      );
    }
    if (!bottomDrawn && bottomHeight > 2) {
      const usedBottomColor = pipe.passed
        ? pipeBottomPassed
        : pipeBottomColorBase;
      ctx.fillStyle = usedBottomColor;
      drawRoundedRectPath(
        ctx,
        pipe.x,
        gapBottom,
        PIPE.width,
        bottomHeight,
        14
      );
      ctx.fill();
    }

    const labelY = Math.max(gapTop - 12, 28);
    const scale = 1 + 0.28 * highlightProgress;
    ctx.save();
    ctx.translate(pipe.x + PIPE.width / 2, labelY);
    ctx.scale(scale, scale);
    ctx.fillStyle = pipe.passed
      ? pipeLabelPassedColor
      : pipeLabelBaseColor;
    ctx.fillText(`×${pipe.multiplier.toFixed(2)}`, 0, 0);
    ctx.restore();
  }
}

function drawBird(ctx, bird, spriteEntry) {
  ctx.save();
  const birdX = WORLD.birdX;
  const birdY = bird.y;
  ctx.translate(birdX, birdY);
  ctx.rotate(bird.rotation * RADIANS_PER_DEGREE);
  if (spriteEntry && spriteEntry.status === 'ready') {
    const width = spriteEntry.width || BIRD.width;
    const height = spriteEntry.height || BIRD.height;
    ctx.drawImage(
      spriteEntry.image,
      -width / 2,
      -height / 2,
      width,
      height
    );
  } else {
    ctx.fillStyle = '#fde047';
    drawRoundedRectPath(
      ctx,
      -BIRD.width / 2,
      -BIRD.height / 2,
      BIRD.width,
      BIRD.height,
      12
    );
    ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.fillRect(BIRD.width / 4, -6, BIRD.width / 3, 12);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(BIRD.width / 6, -BIRD.height / 6, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGround(ctx, level) {
  const groundTop = VIRTUAL_HEIGHT - WORLD.groundHeight;
  ctx.fillStyle =
    level.groundTheme === 'lava' ? COLORS.lava : COLORS.grass;
  ctx.fillRect(0, groundTop, VIRTUAL_WIDTH, WORLD.groundHeight);
  ctx.fillStyle =
    level.groundTheme === 'lava' ? '#b91c1c' : '#166534';
  ctx.fillRect(0, groundTop, VIRTUAL_WIDTH, 16);
}

function drawCrashOverlay(ctx) {
  ctx.fillStyle = 'rgba(15,23,42,0.22)';
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
}

function resolveAutopilotScript(level, crashIndex) {
  if (!level) return [];
  const preset = AUTOPILOT_PRESETS[level.id];
  if (!preset) return [];
  const allFlaps = Array.isArray(preset.flaps)
    ? [...preset.flaps].sort((a, b) => a - b)
    : [];
  if (!allFlaps.length) return [];
  const pipes = Array.isArray(level.pipes) ? level.pipes : [];
  if (!pipes.length) return allFlaps;
  const trimmed = [];
  const tolerance = 1e-2;
  let pipeIndex = 0;
  const maxIndex = Math.max(
    0,
    Math.min(Number.isInteger(crashIndex) ? crashIndex : 0, pipes.length - 1)
  );
  for (const value of allFlaps) {
    while (
      pipeIndex < pipes.length &&
      value > pipes[pipeIndex].spawnX + tolerance
    ) {
      pipeIndex += 1;
    }
    if (pipeIndex > maxIndex) break;
    trimmed.push(Number(value));
  }
  return trimmed;
}

function buildClouds() {
  return Array.from({ length: 6 }, (_, index) => ({
    id: index,
    x: Math.random() * VIRTUAL_WIDTH,
    y: 70 + Math.random() * 200,
    width: 120 + Math.random() * 100,
    height: 40 + Math.random() * 20,
    speed: 14 + Math.random() * 20,
  }));
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(
    0,
    Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2)
  );
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

class AutopilotController {
  constructor() {
    this.script = [];
    this.pointer = 0;
    this.cooldown = 0;
    this.minInterval = 0.12;
    this.locked = false;
    this.fallbackEnabled = true;
  }

  reset() {
    this.pointer = 0;
    this.cooldown = 0;
    this.locked = false;
    this.fallbackEnabled = true;
  }

  setScript(script = []) {
    this.script = Array.isArray(script) ? [...script] : [];
    this.pointer = 0;
    this.locked = false;
  }

  setFallbackEnabled(flag = true) {
    this.fallbackEnabled = flag;
  }

  lock() {
    this.locked = true;
  }

  unlock() {
    this.locked = false;
  }

  update({ dt, distance, bird, nextPipe }) {
    if (this.locked) return false;
    this.cooldown = Math.max(0, this.cooldown - dt);
    let scriptedFlap = false;
    if (this.pointer < this.script.length) {
      const targetDistance = this.script[this.pointer];
      if (distance >= targetDistance) {
        scriptedFlap = true;
        this.pointer += 1;
      }
    }

    if (scriptedFlap) {
      this.cooldown = this.minInterval;
      return true;
    }

    if (this.script.length > 0) {
      return false;
    }

    if (!this.fallbackEnabled) {
      return false;
    }

    if (!nextPipe) return false;

    if (this.cooldown > 0) return false;

    const birdBottom = bird.y + BIRD.height / 2;
    const gapCenter = nextPipe.gapCenter;
    const gapTop = nextPipe.gapCenter - nextPipe.gapHeight / 2 + 12;
    const targetHeight =
      nextPipe.x < WORLD.birdX + 120 ? gapCenter - 16 : VIRTUAL_HEIGHT / 2;
    const distanceToPipe = nextPipe.x - WORLD.birdX;

    const altitudeError = birdBottom - targetHeight;
    const fallingFast = bird.velocity > 160;

    if (
      distanceToPipe < 180 &&
      (altitudeError > 20 || (fallingFast && birdBottom > gapTop))
    ) {
      this.cooldown = this.minInterval;
      return true;
    }

    if (distanceToPipe >= 180 && birdBottom > targetHeight + 60 && fallingFast) {
      this.cooldown = this.minInterval;
      return true;
    }

    return false;
  }
}
