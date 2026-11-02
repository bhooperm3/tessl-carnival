export { createRegistry, type CarnivalGame } from './registry';
export {
  recordScore,
  bestScore,
  topScores,
  leaderboard,
  makesLeaderboard,
  normalizeName,
  parseSeed,
  applySeedFromUrl,
  createScoreBoard,
  type ScoreEntry,
  type LeaderboardRow,
  type SeedGame,
} from './scores';
export { prizeFor, type PrizeTier } from './prizes';
export { theme, canvasFont, applyTheme } from './theme';
