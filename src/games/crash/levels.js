export const LEVELS = {
  medium: {
    id: 'medium',
    name: 'Medium',
    description: 'Classic course with 28 crash points.',
    groundTheme: 'grass',
    gapBaseline: 360,
    crashPoints: [
      1.08, 1.21, 1.37, 1.56, 1.78, 2.05, 2.37, 2.77, 3.24, 3.85, 4.62, 5.61,
      6.91, 8.64, 10.99, 14.29, 18.96, 26.07, 37.24, 53.82, 82.36, 137.59,
      265.35, 638.82, 899.11, 1265.47, 1781.1, 2500.0,
    ],
    pipes: buildPipeConfig(
      [
        1.08, 1.21, 1.37, 1.56, 1.78, 2.05, 2.37, 2.77, 3.24, 3.85, 4.62, 5.61,
        6.91, 8.64, 10.99, 14.29, 18.96, 26.07, 37.24, 53.82, 82.36, 137.59,
        265.35, 638.82, 899.11, 1265.47, 1781.1, 2500.0,
      ],
      {
        distances: [
          220, 180, 240, 220, 240, 260, 260, 260, 280, 280, 280, 220, 300, 320,
          240, 280, 220, 200, 300, 240, 260, 240, 280, 180, 200, 220, 240, 540,
        ],
        gapHeights: [
          220, 180, 110, 128, 190, 184, 182, 180, 178, 112, 134, 134, 138, 122,
          158, 154, 150, 112, 134, 140, 140, 120, 170, 112, 126, 124, 122, 120,
        ],
        offsets: [
          0, -16, 20, 40, -10, -44, 60, -38, 16, -20, 80, -54, 32, -38, 46, -52,
          78, -18, 44, -60, 18, -36, 60, -32, 26, -18, 14, -12,
        ],
      }
    ),
    randomCrashWeights: [
      0.12, 0.52567, 0.100225, 0.170458, 0.049532, 0.034821, 0.024479,
      0.017209, 0.012098, 0.008505, 0.005979, 0.004203, 0.002955, 0.002077,
      0.00146, 0.001027, 0.000722, 0.000507, 0.000357, 0.000251, 0.000176,
      0.000124, 0.000087, 0.000061, 0.000043, 0.00003, 0.000021, 0.000015,
      0.000011,
    ],
  },
  devil: {
    id: 'devil',
    name: 'High Volatility',
    description: 'Lava floor, tighter windows, 18 crash points.',
    groundTheme: 'lava',
    gapBaseline: 340,
    crashPoints: [
      1.4, 2.22, 3.44, 5.54, 9.08, 15.32, 26.77, 48.14, 92.34, 185.01, 391,
      894.01, 2235.02, 6000, 8000, 16000, 32000, 320000,
    ],
    pipes: buildPipeConfig(
      [
        1.4, 2.22, 3.44, 5.54, 9.08, 15.32, 26.77, 48.14, 92.34, 185.01, 391,
        894.01, 2235.02, 6000, 8000, 16000, 32000, 320000,
      ],
      {
        distances: [
          240, 280, 260, 240, 180, 220, 140, 360, 300, 460, 430, 240, 210, 180,
          220, 225, 240, 160,
        ],
        gapHeights: [
          110, 126, 172, 168, 164, 160, 156, 152, 148, 144, 140, 136, 132, 128,
          124, 120, 116, 112,
        ],
        offsets: [
          0, -48, 44, -44, 80, -34, 30, -92, 28, -24, 26, -22, 30, -28, 26, -24,
          22, -20,
        ],
      }
    ),
    randomCrashWeights: [
      0.52, 0.1, 0.1, 0.1, 0.1, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
      0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    ],
  },
};

function buildPipeConfig(multipliers, { distances, gapHeights, offsets }) {
  const baseGapCenter = 360;
  let cursorX = 420;
  return multipliers.map((multiplier, index) => {
    const distance = distances[index] ?? distances[distances.length - 1];
    const gapHeight = gapHeights[index] ?? gapHeights[gapHeights.length - 1];
    const offset = offsets[index] ?? 0;
    cursorX += distance;
    return {
      id: index,
      multiplier,
      distanceFromPrev: distance,
      gapCenter: baseGapCenter + offset,
      gapHeight,
      spawnX: cursorX,
      spriteKey: 'metal',
    };
  });
}
