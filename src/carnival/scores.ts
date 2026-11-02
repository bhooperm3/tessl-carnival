export interface ScoreEntry {
  gameId: string;
  score: number;
  /** When the score was recorded, in milliseconds since the epoch. */
  at: number;
  /** The player's name, cleaned by `normalizeName`. Older scores have none. */
  name?: string;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
}

export interface SeedGame {
  gameId: string;
  scores: { name: string; score: number }[];
}

type ScoreStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'tessl-carnival:scores';
const MAX_ENTRIES_PER_GAME = 50;
const LEADERBOARD_SIZE = 10;
const MAX_NAME_LENGTH = 12;
const NO_NAME = '???';

/** Keeps letters, digits, spaces, `-`, `'` and `.`, collapses spaces, trims, and cuts to 12. */
export function normalizeName(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9 '.-]/g, '')
    .replace(/ +/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
}

/** Reads `<game-id>:<name>=<score>,<name>=<score>;<game-id>:...`, skipping entries that don't parse. */
export function parseSeed(spec: string): SeedGame[] {
  const games: SeedGame[] = [];
  for (const part of spec.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const gameId = part.slice(0, colon).trim();
    if (!gameId) continue;
    const scores: SeedGame['scores'] = [];
    for (const item of part.slice(colon + 1).split(',')) {
      const equals = item.lastIndexOf('=');
      if (equals < 0) continue;
      const score = item.slice(equals + 1).trim();
      if (!/^\d+$/.test(score)) continue;
      scores.push({ name: normalizeName(item.slice(0, equals)), score: Number(score) });
    }
    games.push({ gameId, scores });
  }
  return games;
}

function memoryStorage(): ScoreStorage {
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
  };
}

export function createScoreBoard(storage: ScoreStorage, now: () => number = Date.now) {
  let store = storage;

  function load(): ScoreEntry[] {
    try {
      const parsed: unknown = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as ScoreEntry[]) : [];
    } catch {
      return [];
    }
  }

  function top(gameId: string, count: number): ScoreEntry[] {
    return load()
      .filter((entry) => entry.gameId === gameId)
      .sort((a, b) => b.score - a.score || a.at - b.at)
      .slice(0, count);
  }

  function save(entries: ScoreEntry[]) {
    const value = JSON.stringify(entries);
    try {
      store.setItem(STORAGE_KEY, value);
    } catch {
      // Storage can refuse a write, for example when it's full or blocked. A
      // round must still end normally, so keep scores for this page load only.
      store = memoryStorage();
      store.setItem(STORAGE_KEY, value);
    }
  }

  function record(gameId: string, score: number, name?: string): ScoreEntry {
    if (!Number.isFinite(score) || score < 0) {
      throw new Error(`Score must be a non-negative number, got ${score}`);
    }
    const entry: ScoreEntry = { gameId, score: Math.round(score), at: now() };
    const cleaned = name === undefined ? '' : normalizeName(name);
    if (cleaned) entry.name = cleaned;
    const others = load().filter((e) => e.gameId !== gameId);
    save([...others, ...top(gameId, MAX_ENTRIES_PER_GAME - 1), entry]);
    return entry;
  }

  function best(gameId: string): number | undefined {
    return top(gameId, 1)[0]?.score;
  }

  /** A game's top 10, highest first, oldest first on a tie, with dense ranks. */
  function leaderboard(gameId: string): LeaderboardRow[] {
    let rank = 0;
    let previous: number | undefined;
    return top(gameId, LEADERBOARD_SIZE).map((entry) => {
      if (entry.score !== previous) rank += 1;
      previous = entry.score;
      return { rank, name: entry.name || NO_NAME, score: entry.score };
    });
  }

  /** True when the score would list on the top 10. A tie with the 10th row lists below it. */
  function makesLeaderboard(gameId: string, score: number): boolean {
    const rows = top(gameId, LEADERBOARD_SIZE);
    return rows.length < LEADERBOARD_SIZE || score > rows[LEADERBOARD_SIZE - 1].score;
  }

  /** Replaces the saved scores of each seeded game. Ties list in the order written. */
  function seed(games: SeedGame[]) {
    const seeded = new Set(games.map((game) => game.gameId));
    const start = now();
    let offset = 0;
    const entries = games.flatMap((game) =>
      game.scores.map(({ name, score }) => {
        const entry: ScoreEntry = { gameId: game.gameId, score, at: start + offset++ };
        if (name) entry.name = name;
        return entry;
      }),
    );
    save([...load().filter((e) => !seeded.has(e.gameId)), ...entries]);
  }

  /** In development, `?seedScores=<spec>` replaces the named games' scores. */
  function applySeedFromUrl(search: string, isDev: boolean): boolean {
    if (!isDev) return false;
    const spec = new URLSearchParams(search).get('seedScores');
    if (spec === null) return false;
    seed(parseSeed(spec));
    return true;
  }

  return { record, best, top, leaderboard, makesLeaderboard, applySeedFromUrl };
}

function browserStorage(): ScoreStorage {
  try {
    return window.localStorage;
  } catch {
    // Private windows and test runs: keep scores for this page load only.
    return memoryStorage();
  }
}

const board = createScoreBoard(browserStorage());

/** Every game reports its final score through here. */
export const recordScore = board.record;
export const bestScore = board.best;
export const topScores = board.top;
export const leaderboard = board.leaderboard;
export const makesLeaderboard = board.makesLeaderboard;
export const applySeedFromUrl = board.applySeedFromUrl;

if (typeof window !== 'undefined') {
  applySeedFromUrl(window.location.search, import.meta.env.DEV);
}
