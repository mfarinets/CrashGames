export const VIRTUAL_WIDTH = 432;
export const VIRTUAL_HEIGHT = 768;

export const WORLD = {
  gravity: 1400,
  flapVelocity: -420,
  maxFallSpeed: 720,
  scrollSpeed: 180,
  birdX: 96,
  groundHeight: 96,
};

export const BIRD = {
  width: 64,
  height: 48,
};

export const PIPE = {
  width: 92,
  edgePadding: 12,
};

export const PIPE_SPRITES = {
  metal: {
    collisionInset: 8,
    top: {
      bodySrc: 'assets/pipes/metal/top-body.png',
      capSrc: 'assets/pipes/metal/top-cap.png',
      cropFrom: 'top',
      capOverlap: 10,
      capWidthMultiplier: 1.16,
      bodyWidthMultiplier: 0.9,
    },
    bottom: {
      bodySrc: 'assets/pipes/metal/bottom-body.png',
      capSrc: 'assets/pipes/metal/bottom-cap.png',
      cropFrom: 'bottom',
      capOverlap: 8,
      capWidthMultiplier: 1.16,
      bodyWidthMultiplier: 0.9,
    },
  },
};

export const BIRD_SPRITES = {
  medium: {
    src: 'assets/birds/classic.png',
    width: 64,
    height: 48,
  },
  devil: {
    src: 'assets/birds/high-volatility.png',
    width: 64,
    height: 48,
  },
};

export const COLORS = {
  skyTop: '#38bdf8',
  skyBottom: '#0f172a',
  cloud: 'rgba(255,255,255,0.25)',
  pipeTop: '#16a34a',
  pipeBottom: '#15803d',
  lava: '#ef4444',
  grass: '#22c55e',
  hudAccent: '#38bdf8',
};
