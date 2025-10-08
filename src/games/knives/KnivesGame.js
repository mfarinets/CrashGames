import { LEVELS as KNIVES_LEVELS } from './levels.js';

const WHEEL_RADIUS = 160;
const KNIFE_LENGTH = 130;
const KNIFE_WIDTH = 16;
const THROW_DURATION = 0.32;
const KNIFE_COOLDOWN = 0.22;
const COLLISION_THRESHOLD = 0.2; // radians (~11 degrees)

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function normalizeAngle(angle) {
  let result = angle % (Math.PI * 2);
  if (result <= -Math.PI) result += Math.PI * 2;
  if (result > Math.PI) result -= Math.PI * 2;
  return result;
}

export class KnivesGame {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = { ...callbacks };
    this.pixelRatio = window.devicePixelRatio || 1;
    this.level = KNIVES_LEVELS.arena;
    this.roundState = 'idle';
    this.currentMultiplier = 1;
    this.trainerMode = false;
    this.crashIndex = 0;
    this.autopilotScript = [];
    this.trainerLog = [];

    this.elapsed = 0;
    this.successfulHits = 0;
    this.projectiles = [];
    this.stuckKnives = [];
    this.lastThrowAt = -Infinity;

    this.rotationSegments = [
      { duration: 2.1, speed: 2.6 },
      { duration: 1.6, speed: -1.9 },
      { duration: 2.0, speed: 1.4 },
      { duration: 1.3, speed: -2.8 },
    ];
    this.segmentIndex = 0;
    this.wheel = {
      angle: 0,
      angularVelocity: 0,
      startVelocity: 0,
      targetVelocity: 0,
      transitionTimer: 0,
      transitionDuration: 1,
    };

    this.autopilotTimer = 0;
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.layout = {
      centerX: this.viewportWidth / 2,
      centerY: this.viewportHeight * 0.45,
      wheelRadius: WHEEL_RADIUS,
      throwOriginY: this.viewportHeight * 0.86,
      knifeGap: 60,
    };
    this.scaleRatio = 1;
    this.renderKnifeLength = KNIFE_LENGTH;
    this.renderKnifeWidth = KNIFE_WIDTH;

    this.boundFrame = (ts) => this.frame(ts);
    this.resizeHandler = () => this.resize();
    this.pointerDownHandler = (event) => {
      event.preventDefault();
      if (this.isDestroyed) return;
      if (this.roundState === 'idle') {
        this.startRound({ crashIndex: this.crashIndex });
        return;
      }
      if (this.roundState === 'running' && this.trainerMode) {
        this.throwKnife('trainer');
      }
    };

    window.addEventListener('resize', this.resizeHandler);
    canvas.addEventListener('pointerdown', this.pointerDownHandler);

    this.isDestroyed = false;
    this.resize();
    requestAnimationFrame(this.boundFrame);
  }

  setCallbacks(callbacks = {}) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  setLevel(levelId) {
    const level = KNIVES_LEVELS[levelId];
    if (!level) return;
    this.level = level;
    this.callbacks?.onLevelChange?.(level);
    this.resetRound();
  }

  setTrainerMode(enabled) {
    this.trainerMode = Boolean(enabled);
    if (enabled) {
      this.trainerLog = [];
    }
    this.callbacks?.onTrainerMode?.(this.trainerMode);
  }

  isCrashIndexValid(index) {
    const points = this.level?.crashPoints || [];
    return Number.isInteger(index) && index >= 0 && index < points.length;
  }

  loadAutopilotScript(crashIndex = 0) {
    this.crashIndex = crashIndex;
    this.autopilotScript = [];
  }

  startRound({ crashIndex } = {}) {
    if (this.roundState === 'running') return;
    const index = Number.isInteger(crashIndex) ? crashIndex : 0;
    this.crashIndex = this.isCrashIndexValid(index) ? index : 0;
    this.roundState = 'running';
    this.currentMultiplier = 1;
    this.elapsed = 0;
    this.successfulHits = 0;
    this.projectiles = [];
    this.stuckKnives = [];
    this.trainerLog = [];
    this.lastThrowAt = -KNIFE_COOLDOWN;
    this.segmentIndex = 0;
    this.autopilotTimer = 0;
    this.wheel.angle = 0;
    this.wheel.angularVelocity = 0;
    this.wheel.startVelocity = 0;
    this.configureWheelSegment(this.rotationSegments[this.segmentIndex] ?? null);
    this.callbacks?.onStatus?.('Running');
    this.callbacks?.onMultiplier?.(this.currentMultiplier);
  }

  cashOut() {
    if (this.roundState !== 'running') return null;
    const result = {
      type: 'cashout',
      multiplier: this.currentMultiplier,
    };
    this.roundState = 'settled';
    this.projectiles = [];
    this.callbacks?.onStatus?.('Settled');
    this.callbacks?.onRoundEnd?.({
      status: 'cashed_out',
      multiplier: this.currentMultiplier,
    });
    return result;
  }

  resetRound() {
    this.roundState = 'idle';
    this.currentMultiplier = 1;
    this.elapsed = 0;
    this.successfulHits = 0;
    this.projectiles = [];
    this.stuckKnives = [];
    this.autopilotTimer = 0;
    this.wheel.angle = 0;
    this.wheel.angularVelocity = 0;
    this.wheel.startVelocity = 0;
    this.callbacks?.onStatus?.('Idle');
    this.callbacks?.onMultiplier?.(this.currentMultiplier);
  }

  getCrashCount() {
    return this.level?.crashPoints?.length ?? 0;
  }

  getMultiplierForCrashIndex(index) {
    if (!this.level) return null;
    return this.level.crashPoints?.[index] ?? null;
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    window.removeEventListener('resize', this.resizeHandler);
    this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
  }

  frame(timestamp) {
    if (this.isDestroyed) return;
    if (!this.lastFrameTime) {
      this.lastFrameTime = timestamp;
    }
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;
    this.update(dt);
    this.draw();
    if (!this.isDestroyed) {
      requestAnimationFrame(this.boundFrame);
    }
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.roundState !== 'running') return;

    this.elapsed += dt;
    this.updateWheel(dt);
    this.updateProjectiles(dt);

    if (!this.trainerMode) {
      this.updateAutopilot(dt);
    }
  }

  updateWheel(dt) {
    const segment = this.rotationSegments[this.segmentIndex];
    if (!segment) return;
    const wheel = this.wheel;
    wheel.transitionTimer += dt;
    const duration = Math.max(segment.duration, 0.1);
    const progress = Math.min(1, wheel.transitionTimer / duration);
    const eased = easeInOut(progress);
    wheel.angularVelocity = lerp(wheel.startVelocity, wheel.targetVelocity, eased);
    wheel.angle += wheel.angularVelocity * dt;

    if (progress >= 1) {
      this.segmentIndex = (this.segmentIndex + 1) % this.rotationSegments.length;
      this.configureWheelSegment(this.rotationSegments[this.segmentIndex]);
    }
  }

  configureWheelSegment(segment) {
    if (!segment) return;
    this.wheel.startVelocity = this.wheel.angularVelocity;
    this.wheel.targetVelocity = segment.speed;
    this.wheel.transitionTimer = 0;
    this.wheel.transitionDuration = Math.max(segment.duration, 0.1);
  }

  updateProjectiles(dt) {
    const impactKnives = [];
    this.projectiles.forEach((knife) => {
      knife.progress += dt / knife.duration;
      knife.progress = Math.min(knife.progress, 1);
      const t = easeInOut(knife.progress);
      knife.x = lerp(knife.startX, knife.targetX, t);
      knife.y = lerp(knife.startY, knife.targetY, t);
      if (knife.progress >= 1 && !knife.resolved) {
        impactKnives.push(knife);
      }
    });

    impactKnives.forEach((knife) => this.resolveImpact(knife));
    this.projectiles = this.projectiles.filter((knife) => !knife.resolved);
  }

  resolveImpact(knife) {
    knife.resolved = true;
    const impactAngle = normalizeAngle(this.wheel.angle);
    const relativeAngle = normalizeAngle(-impactAngle);
    const collision = this.stuckKnives.some((existing) => {
      const delta = Math.abs(normalizeAngle(existing.offset - relativeAngle));
      return delta < COLLISION_THRESHOLD;
    });

    if (collision) {
      this.finishRound('crashed');
      this.callbacks?.onCrash?.({
        status: 'crashed',
        multiplier: this.currentMultiplier,
      });
      return;
    }

    this.stuckKnives.push({
      offset: relativeAngle,
    });
    this.successfulHits += 1;
    const nextMultiplier =
      this.level?.crashPoints?.[this.successfulHits - 1] ??
      Number((this.currentMultiplier + 0.2).toFixed(2));
    if (nextMultiplier > this.currentMultiplier) {
      this.currentMultiplier = nextMultiplier;
      this.callbacks?.onMultiplier?.(this.currentMultiplier);
    }

    if (this.trainerMode) {
      this.trainerLog.push({
        time: this.elapsed,
        wheelAngle: impactAngle,
        speed: this.wheel.angularVelocity,
      });
    }

    if (this.successfulHits >= this.getCrashCount()) {
      this.finishRound('cleared');
    }
  }

  updateAutopilot(dt) {
    this.autopilotTimer += dt;
    if (this.autopilotTimer < KNIFE_COOLDOWN * 2) return;
    if (this.projectiles.some((knife) => !knife.resolved)) return;
    this.autopilotTimer = 0;
    this.throwKnife('autopilot');
  }

  throwKnife(source) {
    if (this.roundState !== 'running') return;
    if (this.projectiles.some((knife) => !knife.resolved && knife.progress < 1)) {
      if (source === 'trainer') return;
    }
    const timeSinceLast = this.elapsed - this.lastThrowAt;
    if (timeSinceLast < KNIFE_COOLDOWN) {
      if (source === 'trainer') return;
    }
    this.lastThrowAt = this.elapsed;

    const { centerX, centerY, wheelRadius, throwOriginY } = this.layout;

    const projectile = {
      state: 'flying',
      source,
      duration: THROW_DURATION,
      progress: 0,
      resolved: false,
      startX: centerX,
      startY: throwOriginY,
      targetX: centerX,
      targetY: centerY - wheelRadius,
      x: centerX,
      y: throwOriginY,
    };

    this.projectiles.push(projectile);
  }

  finishRound(status) {
    if (this.roundState !== 'running') return;
    this.roundState = status;
    this.projectiles = [];
    this.callbacks?.onStatus?.(status === 'crashed' ? 'Crashed' : 'Settled');
    if (this.trainerMode && this.trainerLog.length) {
      this.callbacks?.onTrainerScript?.([...this.trainerLog]);
    }
    this.callbacks?.onRoundEnd?.({
      status,
      multiplier: this.currentMultiplier,
    });
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    const background = this.level?.assets?.background ?? '#0c101c';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    const { centerX, centerY } = this.layout;

    this.drawWheel(ctx, centerX, centerY);
    this.drawStuckKnives(ctx, centerX, centerY);
    this.drawProjectiles(ctx);
    this.drawHud(ctx);

    ctx.restore();
  }

  drawWheel(ctx, x, y) {
    const radius = this.layout.wheelRadius;
    const rimRadius = radius + 10 * this.scaleRatio;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.wheel.angle);

    ctx.fillStyle = '#4b3728';
    ctx.beginPath();
    ctx.arc(0, 0, rimRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#90674d';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = Math.max(2, 6 * this.scaleRatio);
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -radius);
      ctx.rotate((Math.PI * 2) / 8);
    }
    ctx.stroke();

    ctx.restore();
  }

  drawStuckKnives(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.wheel.angle);
    this.stuckKnives.forEach((knife) => {
      ctx.save();
      ctx.rotate(knife.offset);
      ctx.translate(0, -this.layout.wheelRadius);
      this.renderKnife(ctx, this.renderKnifeLength * 0.9, this.renderKnifeWidth, 1);
      ctx.restore();
    });
    ctx.restore();
  }

  drawProjectiles(ctx) {
    this.drawReadyKnife(ctx);

    this.projectiles.forEach((knife) => {
      if (knife.resolved && knife.progress >= 1) return;
      ctx.save();
      ctx.translate(knife.x, knife.y);
      this.renderKnife(ctx, this.renderKnifeLength, this.renderKnifeWidth, 0.8);
      ctx.restore();
    });
  }

  drawReadyKnife(ctx) {
    if (!this.layout?.throwOriginY) return;
    const originY = this.layout.throwOriginY;
    ctx.save();
    ctx.translate(this.layout.centerX, originY);
    this.renderKnife(ctx, this.renderKnifeLength, this.renderKnifeWidth, 1);
    ctx.restore();
  }

  renderKnife(ctx, length, width, opacity = 1) {
    const knifeAsset = this.level?.assets?.knife;
    if (knifeAsset) {
      if (knifeAsset.loaded && knifeAsset.image) {
        const { image } = knifeAsset;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(image, -width / 2, -length, width, length);
        ctx.restore();
        return;
      }
      if (!knifeAsset.requested && typeof knifeAsset.src === 'string') {
        knifeAsset.requested = true;
        const img = new Image();
        img.onload = () => {
          knifeAsset.image = img;
          knifeAsset.loaded = true;
          knifeAsset.requested = false;
        };
        img.onerror = () => {
          knifeAsset.loaded = false;
          knifeAsset.requested = false;
        };
        img.src = knifeAsset.src;
        knifeAsset.image = img;
      }
    }
    ctx.fillStyle = `rgba(232, 240, 255, ${opacity})`;
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.lineTo(width / 2, -length);
    ctx.lineTo(-width / 2, -length);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(226, 68, 68, ${opacity})`;
    ctx.beginPath();
    ctx.moveTo(0, -length - 18 * this.scaleRatio);
    ctx.lineTo(width / 2, -length);
    ctx.lineTo(-width / 2, -length);
    ctx.closePath();
    ctx.fill();
  }

  drawHud(ctx) {
    const centerX = this.viewportWidth / 2;
    const rawLabelY =
      this.layout.centerY + this.layout.wheelRadius + 48 * this.scaleRatio;
    const labelY = Math.min(this.viewportHeight - 140, rawLabelY);
    const multiplierFont = Math.max(20, 32 * this.scaleRatio);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `${multiplierFont}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(
      `Multiplier ×${this.currentMultiplier.toFixed(2)}`,
      centerX,
      labelY
    );
    if (this.trainerMode) {
      const trainerFont = Math.max(14, 20 * this.scaleRatio);
      ctx.font = `${trainerFont}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(94, 234, 212, 0.9)';
      const trainerY = Math.min(
        this.viewportHeight - 100,
        labelY + 28 * this.scaleRatio
      );
      ctx.fillText('Trainer Mode', centerX, trainerY);
    }
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const portrait = height >= width;
    const minDim = Math.min(width, height);
    const wheelRadius = Math.max(80, minDim * (portrait ? 0.2 : 0.15));
    const baseCenterY = portrait ? height * 0.23 : height * 0.5;
    const centerY = Math.max(wheelRadius + 80, baseCenterY);
    const defaultGap = Math.max(60, height * 0.08);
    const knifeGap = this.level?.assets?.knifeGap ?? defaultGap;
    const throwOriginY = Math.min(
      height - 80,
      centerY + wheelRadius + knifeGap
    );

    this.viewportWidth = width;
    this.viewportHeight = height;
    this.layout = {
      width,
      height,
      centerX: width / 2,
      centerY,
      wheelRadius,
      throwOriginY,
      knifeGap,
    };

    this.scaleRatio = wheelRadius / WHEEL_RADIUS;
    this.renderKnifeLength = KNIFE_LENGTH * this.scaleRatio;
    this.renderKnifeWidth = Math.max(8, KNIFE_WIDTH * this.scaleRatio);

    const layoutThrowStartY = this.layout.throwOriginY;
    this.projectiles.forEach((knife) => {
      knife.startX = this.layout.centerX;
      knife.startY = layoutThrowStartY;
      knife.targetX = this.layout.centerX;
      knife.targetY = this.layout.centerY - this.layout.wheelRadius;
      const eased = easeInOut(Math.min(1, knife.progress));
      knife.x = lerp(knife.startX, knife.targetX, eased);
      knife.y = lerp(knife.startY, knife.targetY, eased);
    });

    const pixelWidth = Math.floor(width * this.pixelRatio);
    const pixelHeight = Math.floor(height * this.pixelRatio);
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }
}
