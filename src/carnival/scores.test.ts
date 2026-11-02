import { describe, expect, it } from 'vitest';
import { createScoreBoard, normalizeName, parseSeed } from './scores';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('score board', () => {
  it('has no best score for a game nobody has played', () => {
    const board = createScoreBoard(memoryStorage());
    expect(board.best('water-cannon')).toBeUndefined();
  });

  it('keeps the best score per game', () => {
    const board = createScoreBoard(memoryStorage());
    board.record('water-cannon', 120);
    board.record('water-cannon', 340);
    board.record('ring-toss', 900);
    board.record('water-cannon', 80);
    expect(board.best('water-cannon')).toBe(340);
    expect(board.best('ring-toss')).toBe(900);
  });

  it('lists top scores highest first, earliest first on a tie', () => {
    let clock = 0;
    const board = createScoreBoard(memoryStorage(), () => ++clock);
    board.record('water-cannon', 50);
    board.record('water-cannon', 200);
    board.record('water-cannon', 200);
    board.record('water-cannon', 10);
    expect(board.top('water-cannon', 3).map((e) => [e.score, e.at])).toEqual([
      [200, 2],
      [200, 3],
      [50, 1],
    ]);
  });

  it('survives corrupt storage', () => {
    const storage = memoryStorage();
    storage.setItem('tessl-carnival:scores', '{not json');
    const board = createScoreBoard(storage);
    expect(board.best('water-cannon')).toBeUndefined();
    board.record('water-cannon', 5);
    expect(board.best('water-cannon')).toBe(5);
  });

  it('keeps working when storage refuses a write', () => {
    const storage = memoryStorage();
    storage.setItem(
      'tessl-carnival:scores',
      JSON.stringify([{ gameId: 'ring-toss', score: 70, at: 1 }]),
    );
    const board = createScoreBoard({
      getItem: storage.getItem,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => board.record('water-cannon', 40)).not.toThrow();
    expect(board.best('water-cannon')).toBe(40);
    expect(board.best('ring-toss')).toBe(70);
    board.record('water-cannon', 90);
    expect(board.best('water-cannon')).toBe(90);
  });

  it('rejects negative and non-numeric scores', () => {
    const board = createScoreBoard(memoryStorage());
    expect(() => board.record('water-cannon', -1)).toThrow();
    expect(() => board.record('water-cannon', Number.NaN)).toThrow();
  });
});

describe('player names', () => {
  it('saves the cleaned name with a score', () => {
    const board = createScoreBoard(memoryStorage());
    const entry = board.record('water-cannon', 120, '  Ada!!  Lovelace ');
    expect(entry.name).toBe('Ada Lovelace');
    expect(board.top('water-cannon', 1)[0].name).toBe('Ada Lovelace');
  });

  it('saves no name for a two-argument call', () => {
    const board = createScoreBoard(memoryStorage());
    const entry = board.record('water-cannon', 120);
    expect(entry).not.toHaveProperty('name');
  });

  it('saves no name when nothing allowed is left', () => {
    const board = createScoreBoard(memoryStorage());
    const entry = board.record('water-cannon', 120, '!!@@##');
    expect(entry).not.toHaveProperty('name');
    expect(board.leaderboard('water-cannon')[0].name).toBe('???');
  });
});

describe('normalizeName', () => {
  it('drops disallowed characters', () => {
    expect(normalizeName("O'Brien-Smith Jr.")).toBe("O'Brien-Smit");
    expect(normalizeName('Zoë_<b>#1</b>')).toBe('Zob1b');
  });

  it('keeps the case as typed', () => {
    expect(normalizeName('aDa')).toBe('aDa');
  });

  it('collapses spaces and trims both ends', () => {
    expect(normalizeName('   Ada    Bob  ')).toBe('Ada Bob');
  });

  it('cuts the result to 12 characters', () => {
    expect(normalizeName('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKL');
  });

  it('returns an empty string when every character is disallowed', () => {
    expect(normalizeName('***')).toBe('');
  });
});

describe('leaderboard', () => {
  it('lists at most 10 rows, highest first', () => {
    let clock = 0;
    const board = createScoreBoard(memoryStorage(), () => ++clock);
    for (let score = 1; score <= 12; score++) board.record('water-cannon', score, `P${score}`);
    const rows = board.leaderboard('water-cannon');
    expect(rows).toHaveLength(10);
    expect(rows.map((r) => r.score)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });

  it('lists the oldest first on a tie, with dense ranks', () => {
    let clock = 0;
    const board = createScoreBoard(memoryStorage(), () => ++clock);
    board.record('water-cannon', 90, 'Cy');
    board.record('water-cannon', 120, 'Ada');
    board.record('water-cannon', 120, 'Bob');
    expect(board.leaderboard('water-cannon')).toEqual([
      { rank: 1, name: 'Ada', score: 120 },
      { rank: 1, name: 'Bob', score: 120 },
      { rank: 2, name: 'Cy', score: 90 },
    ]);
  });

  it('shows ??? for a score saved without a name', () => {
    const storage = memoryStorage();
    storage.setItem(
      'tessl-carnival:scores',
      JSON.stringify([{ gameId: 'water-cannon', score: 70, at: 1 }]),
    );
    const board = createScoreBoard(storage);
    expect(board.leaderboard('water-cannon')).toEqual([{ rank: 1, name: '???', score: 70 }]);
  });
});

describe('makesLeaderboard', () => {
  function fullBoard() {
    let clock = 0;
    const board = createScoreBoard(memoryStorage(), () => ++clock);
    for (let score = 10; score <= 100; score += 10) board.record('water-cannon', score);
    return board;
  }

  it('is true when the game has fewer than 10 scores', () => {
    const board = createScoreBoard(memoryStorage());
    board.record('water-cannon', 500);
    expect(board.makesLeaderboard('water-cannon', 0)).toBe(true);
  });

  it('is true when strictly above the 10th row', () => {
    expect(fullBoard().makesLeaderboard('water-cannon', 11)).toBe(true);
  });

  it('is false when equal to the 10th row', () => {
    expect(fullBoard().makesLeaderboard('water-cannon', 10)).toBe(false);
  });

  it('is false when below the 10th row', () => {
    expect(fullBoard().makesLeaderboard('water-cannon', 5)).toBe(false);
  });
});

describe('parseSeed', () => {
  it('reads several games and cleans the names', () => {
    expect(parseSeed('water-cannon:Ada=120,Bob!=120,Cy=90;ring-toss:Di=5')).toEqual([
      {
        gameId: 'water-cannon',
        scores: [
          { name: 'Ada', score: 120 },
          { name: 'Bob', score: 120 },
          { name: 'Cy', score: 90 },
        ],
      },
      { gameId: 'ring-toss', scores: [{ name: 'Di', score: 5 }] },
    ]);
  });

  it('skips entries that do not parse', () => {
    expect(parseSeed('nogame;water-cannon:Ada=x,Bob,=7,Cy=-3,Di=4;:Ed=1')).toEqual([
      {
        gameId: 'water-cannon',
        scores: [
          { name: '', score: 7 },
          { name: 'Di', score: 4 },
        ],
      },
    ]);
  });
});

describe('applySeedFromUrl', () => {
  it('replaces the seeded games and lists ties in the order written', () => {
    const board = createScoreBoard(memoryStorage(), () => 1000);
    board.record('water-cannon', 999, 'Old');
    board.record('ring-toss', 70, 'Kept');
    const search = '?seedScores=' + encodeURIComponent('water-cannon:Bob=120,Ada=120,Cy=90');
    expect(board.applySeedFromUrl(search, true)).toBe(true);
    expect(board.leaderboard('water-cannon')).toEqual([
      { rank: 1, name: 'Bob', score: 120 },
      { rank: 1, name: 'Ada', score: 120 },
      { rank: 2, name: 'Cy', score: 90 },
    ]);
    expect(board.best('ring-toss')).toBe(70);
  });

  it('does nothing without a seedScores parameter', () => {
    const board = createScoreBoard(memoryStorage());
    expect(board.applySeedFromUrl('?other=1', true)).toBe(false);
    expect(board.best('water-cannon')).toBeUndefined();
  });

  it('saves nothing and returns false outside development', () => {
    const board = createScoreBoard(memoryStorage());
    expect(board.applySeedFromUrl('?seedScores=water-cannon:Ada=120', false)).toBe(false);
    expect(board.best('water-cannon')).toBeUndefined();
  });
});
