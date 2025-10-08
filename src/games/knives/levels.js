export const LEVELS = {
  arena: {
    id: 'arena',
    name: 'Arena',
    description: 'Balanced throw pattern with moderate speed.',
    groundTheme: 'arena',
    crashPoints: [1.1, 1.5, 2.0, 2.6, 3.4, 4.5, 6.1, 8.3],
    randomCrashWeights: [0.4, 0.22, 0.14, 0.1, 0.07, 0.04, 0.02, 0.01, 0.003],
    assets: {
      background: '#1d1f2a',
      knifeColor: '#f24c4c',
    },
  },
  gauntlet: {
    id: 'gauntlet',
    name: 'Gauntlet',
    description: 'Faster throws, higher variance, high reward.',
    groundTheme: 'gauntlet',
    crashPoints: [1.3, 1.9, 2.8, 4.1, 6.0, 9.5, 14.2],
    randomCrashWeights: [0.32, 0.2, 0.16, 0.12, 0.09, 0.07, 0.04, 0.02],
    assets: {
      background: '#221426',
      knifeColor: '#d74efc',
    },
  },
};
