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
          220, 240, 240, 240, 240, 260, 260, 260, 280, 280, 280, 300, 300, 320,
          320, 320, 340, 360, 360, 380, 400, 420, 440, 460, 480, 500, 520, 540,
        ],
        gapHeights: [
          190, 190, 190, 188, 186, 184, 182, 180, 178, 176, 174, 168, 168, 162,
          158, 154, 150, 148, 146, 142, 138, 134, 130, 128, 126, 124, 122, 120,
        ],
        offsets: [
          0, -16, 20, -30, 10, -24, 32, -38, 16, -20, 14, -24, 32, -38, 26, -22,
          18, -18, 22, -30, 28, -26, 30, -32, 26, -18, 14, -12,
        ],
      }
    ),
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
          240, 260, 260, 280, 300, 320, 340, 360, 380, 400, 430, 460, 490, 520,
          550, 580, 620, 660,
        ],
        gapHeights: [
          180, 176, 172, 168, 164, 160, 156, 152, 148, 144, 140, 136, 132, 128,
          124, 120, 116, 112,
        ],
        offsets: [
          0, -18, 22, -26, 30, -34, 30, -32, 28, -24, 26, -22, 30, -28, 26, -24,
          22, -20,
        ],
      }
    ),
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
