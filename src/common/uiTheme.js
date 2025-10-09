const BASE_BUTTON_THEME = {
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
};

export const UI_THEME = {
  multiplier: {
    centerFontSize: 52,
    centerColor: '#ffffffff',
    pipeLabelBaseColor: '#ffffff',
    pipeLabelPassedColor: '#facc15',
  },
  modes: {
    classic: {
      buttons: BASE_BUTTON_THEME,
    },
    devil: {
      buttons: BASE_BUTTON_THEME,
    },
  },
};
