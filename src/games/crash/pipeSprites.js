import { PIPE, PIPE_SPRITES } from './constants.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

class PipeSprite {
  constructor(config) {
    this.bodySrc = config.bodySrc;
    this.capSrc = config.capSrc;
    this.cropFrom = config.cropFrom ?? 'bottom';
    this.capOverlap = config.capOverlap ?? 0;
    this.capWidthMultiplier = config.capWidthMultiplier ?? 1;
    this.bodyWidthMultiplier = config.bodyWidthMultiplier ?? 1;
    this.bodyImage = null;
    this.capImage = null;
    this.loading = null;
  }

  requestLoad() {
    if (this.bodyImage && (!this.capSrc || this.capImage)) return;
    if (this.loading) return;
    this.loading = (async () => {
      try {
        this.bodyImage = await loadImage(this.bodySrc);
        if (this.capSrc) {
          this.capImage = await loadImage(this.capSrc);
        }
      } catch (error) {
        console.warn('[PipeSprite] Failed to load sprite', error);
      }
    })();
  }

  isReady() {
    return this.bodyImage && (!this.capSrc || this.capImage);
  }

  drawBody(ctx, x, y, width, height) {
    const drawWidth = width * this.bodyWidthMultiplier;
    const offsetX = x + (width - drawWidth) / 2;
    const scale = drawWidth / this.bodyImage.width;
    const needsStretch = height / scale > this.bodyImage.height;
    const srcHeight = needsStretch
      ? this.bodyImage.height
      : Math.min(this.bodyImage.height, height / scale);
    const srcY =
      this.cropFrom === 'top'
        ? Math.max(0, this.bodyImage.height - srcHeight)
        : 0;

    if (srcHeight <= 0) return;

    ctx.drawImage(
      this.bodyImage,
      0,
      srcY,
      this.bodyImage.width,
      srcHeight,
      offsetX,
      y,
      drawWidth,
      height
    );
  }

  drawCap(ctx, x, y, width, height) {
    if (!this.capImage) return;
    const drawWidth = width * this.capWidthMultiplier;
    const offsetX = x + (width - drawWidth) / 2;
    ctx.drawImage(
      this.capImage,
      0,
      0,
      this.capImage.width,
      this.capImage.height,
      offsetX,
      y,
      drawWidth,
      height
    );
  }

  drawTop(ctx, x, height, width) {
    this.requestLoad();
    if (!this.isReady()) return false;

    const baseScale =
      (width * this.bodyWidthMultiplier) / this.bodyImage.width;
    const capHeight = this.capImage ? this.capImage.height * baseScale : 0;
    const overlap = this.capOverlap;
    const capY = Math.max(0, height - capHeight - overlap);
    const bodyHeight = Math.max(0, height - capHeight);
    const bodyY = Math.max(0, capY - bodyHeight);

    this.drawBody(ctx, x, bodyY, width, bodyHeight);
    this.drawCap(ctx, x, capY, width, capHeight);
    return true;
  }

  drawBottom(ctx, x, y, height, width) {
    this.requestLoad();
    if (!this.isReady()) return false;

    const baseScale =
      (width * this.bodyWidthMultiplier) / this.bodyImage.width;
    const capHeight = this.capImage ? this.capImage.height * baseScale : 0;
    const overlap = this.capOverlap;
    const capY = y - overlap;
    const bodyY = Math.max(y, y + capHeight - overlap * 2);
    const bodyHeight = Math.max(0, y + height - bodyY);

    this.drawBody(ctx, x, bodyY, width, bodyHeight);
    this.drawCap(ctx, x, capY, width, capHeight);
    return true;
  }
}

class PipeSpriteSet {
  constructor(config) {
    this.collisionInset = config.collisionInset ?? 0;
    this.top = config.top ? new PipeSprite(config.top) : null;
    this.bottom = config.bottom ? new PipeSprite(config.bottom) : null;
    this.top?.requestLoad?.();
    this.bottom?.requestLoad?.();
  }

  drawTop(ctx, x, height, width) {
    if (!this.top) return false;
    return this.top.drawTop(ctx, x, height, width);
  }

  drawBottom(ctx, x, y, height, width) {
    if (!this.bottom) return false;
    return this.bottom.drawBottom(ctx, x, y, height, width);
  }
}

export class PipeSpriteManager {
  constructor(config = PIPE_SPRITES) {
    this.config = config;
    this.cache = {};
  }

  getCollisionInset(key) {
    const set = this.getSet(key);
    return set?.collisionInset ?? 0;
  }

  drawTop(ctx, key, x, height) {
    const set = this.getSet(key);
    if (!set) return false;
    return set.drawTop(ctx, x, height, PIPE.width);
  }

  drawBottom(ctx, key, x, y, height) {
    const set = this.getSet(key);
    if (!set) return false;
    return set.drawBottom(ctx, x, y, height, PIPE.width);
  }

  getSet(key) {
    const spriteKey = key || 'metal';
    if (!this.cache[spriteKey]) {
      const config = this.config[spriteKey];
      if (!config) return null;
      this.cache[spriteKey] = new PipeSpriteSet(config);
    }
    return this.cache[spriteKey];
  }
}
