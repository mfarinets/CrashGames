const BASE_BUTTON_THEME = {
  ready: {
    background: 'linear-gradient(180deg, #30da6eff 0%, #22c55e 100%)',
    textColor: '#ffffffff',
    subtextColor: '#ffffffff',
    borderColor: '#077b31ff',
    borderRadius: 20,
    boxShadow: '0 16px 32px rgba(34, 197, 94, 0.35)',
  },
  running: {
    background: 'linear-gradient(180deg, #e85858ff 0%, #ef4444 100%)',
    textColor: '#ffffffff',
    subtextColor: '#ffffffff',
    borderColor: '#9a1010ff',
    borderRadius: 20,
    boxShadow: '0 16px 32px rgba(239, 68, 68, 0.32)',
  },
  win: {
    background: 'linear-gradient(180deg, #facc15 0%, #eab308 100%)',
    textColor: '#ffffffff',
    subtextColor: '#ffffffff',
    borderColor: '#896007ff',
    borderRadius: 20,
    boxShadow: '0 16px 32px rgba(234, 179, 8, 0.32)',
  },
};

export const UI_THEME = {
  multiplier: {
    centerFontSize: 52,
    centerColor: '#ffffffff',
    pipeLabelBaseColor: '#ebebebff',
    pipeLabelPassedColor: '#de4458ff',
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
