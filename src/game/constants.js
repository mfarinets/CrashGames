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

export const UI_THEME = {
  multiplier: {
    centerFontSize: 34,
    centerColor: '#111827',
    pipeLabelBaseColor: '#ffffff',
    pipeLabelPassedColor: '#facc15',
  },
  modes: {
    classic: {
      buttons: {
        ready: {
          background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 100%)',
          textColor: '#052e16',
          subtextColor: '#09421c',
          borderColor: '#16a34a',
          borderRadius: 26,
          boxShadow: '0 16px 32px rgba(34, 197, 94, 0.35)',
        },
        running: {
          background: 'linear-gradient(180deg, #f87171 0%, #ef4444 100%)',
          textColor: '#450a0a',
          subtextColor: '#7f1d1d',
          borderColor: '#dc2626',
          borderRadius: 26,
          boxShadow: '0 16px 32px rgba(239, 68, 68, 0.32)',
        },
        win: {
          background: 'linear-gradient(180deg, #facc15 0%, #eab308 100%)',
          textColor: '#422006',
          subtextColor: '#854d0e',
          borderColor: '#ca8a04',
          borderRadius: 26,
          boxShadow: '0 16px 32px rgba(234, 179, 8, 0.32)',
        },
      },
    },
    devil: {
      buttons: {
        ready: {
          background: 'linear-gradient(180deg, #67e8f9 0%, #38bdf8 100%)',
          textColor: '#082f49',
          subtextColor: '#0e7490',
          borderColor: '#0ea5e9',
          borderRadius: 26,
          boxShadow: '0 16px 32px rgba(14, 165, 233, 0.32)',
        },
        running: {
          background: 'linear-gradient(180deg, #fb7185 0%, #f43f5e 100%)',
          textColor: '#4c0519',
          subtextColor: '#881337',
          borderColor: '#e11d48',
          borderRadius: 26,
          boxShadow: '0 16px 32px rgba(244, 63, 94, 0.35)',
        },
        win: {
          background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)',
          textColor: '#431407',
          subtextColor: '#92400e',
          borderColor: '#d97706',
          borderRadius: 26,
          boxShadow: '0 16px 32px rgba(245, 158, 11, 0.35)',
        },
      },
    },
  },
};

export const COLORS = {
  skyTop: '#38bdf8',
  skyBottom: '#0f172a',
  cloud: 'rgba(255,255,255,0.65)',
  pipeTop: '#16a34a',
  pipeBottom: '#15803d',
  lava: '#ef4444',
  grass: '#22c55e',
  hudAccent: '#38bdf8',
};
