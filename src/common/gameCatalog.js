import { Game as CrashGame } from '../games/crash/Game.js';
import { LEVELS as CRASH_LEVELS } from '../games/crash/levels.js';
import { KnivesGame } from '../games/knives/KnivesGame.js';
import { LEVELS as KNIVES_LEVELS } from '../games/knives/levels.js';

export const GAME_REGISTRY = {
  crash: {
    id: 'crash',
    name: 'Crash Flight',
    description: 'Fly through pipes and beat the crash curve.',
    createGame: (canvas, callbacks) => new CrashGame(canvas, callbacks),
    levels: CRASH_LEVELS,
    defaultLevelId: 'medium',
    modeOrder: ['medium', 'devil'],
    tags: ['featured'],
  },
  knives: {
    id: 'knives',
    name: 'Knives',
    description: 'Dodge incoming knives in this upcoming mode.',
    createGame: (canvas, callbacks) => new KnivesGame(canvas, callbacks),
    levels: KNIVES_LEVELS,
    defaultLevelId: 'arena',
    modeOrder: ['arena', 'gauntlet'],
    tags: ['coming soon'],
  },
};

export const GAME_LIST = Object.values(GAME_REGISTRY);

export const DEFAULT_GAME_ID = 'crash';

export function getGameDefinition(id) {
  return GAME_REGISTRY[id] ?? null;
}

export function createGameInstance(gameId, canvas, callbacks) {
  const definition = getGameDefinition(gameId);
  return definition ? definition.createGame(canvas, callbacks) : null;
}
