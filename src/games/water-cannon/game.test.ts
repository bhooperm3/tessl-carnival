import { describe, expect, it } from 'vitest';
import {
  CANNON,
  ENTRY_SECONDS,
  LEADERBOARD_SECONDS,
  MAX_STEP_SECONDS,
  OVER_SECONDS,
  TANK_SIZE,
  TITLE_SECONDS,
  click,
  createState,
  entryCountdown,
  filterName,
  fire,
  isHit,
  scoreForHit,
  step,
  stop,
  submitName,
  tick,
  type ScoreSink,
  type Target,
  type WaterCannonState,
} from './game';

const target: Target = { x: 400, y: 200, radius: 28, speed: 120 };

describe('water cannon', () => {
  it('starts with a full tank and no score', () => {
    const state = createState();
    expect(state.tank).toBe(TANK_SIZE);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('uses one shot of water per fire', () => {
    const state = createState();
    expect(fire(state, 400, 0)).toBe(true);
    expect(state.tank).toBe(TANK_SIZE - 1);
    expect(state.shots).toHaveLength(1);
  });

  it('cannot fire once the tank is empty', () => {
    const state = createState();
    state.tank = 0;
    expect(fire(state, 400, 0)).toBe(false);
    expect(state.shots).toHaveLength(0);
  });

  it('never fires downwards, even when aimed below the cannon', () => {
    const state = createState();
    fire(state, CANNON.x + 100, CANNON.y + 100);
    expect(state.shots[0].vy).toBeLessThan(0);
  });

  it('scores a hit and sends the target back to the start of its rail', () => {
    const state = createState();
    state.targets = [{ ...target }];
    state.shots = [{ x: target.x, y: target.y + 5, vx: 0, vy: 0 }];
    step(state, 0);
    expect(state.score).toBe(scoreForHit(target));
    expect(state.shots).toHaveLength(0);
    expect(state.targets[0].x).toBeLessThan(0);
  });

  it('ends the round when the tank is empty and the last shot has landed', () => {
    const state = createState();
    state.tank = 0;
    state.shots = [{ x: 10, y: -20, vx: 0, vy: -700 }];
    step(state, 0.1, fakeScores(false));
    expect(state.phase).toBe('over');
  });

  it('keeps playing while a shot is still in the air', () => {
    const state = createState();
    state.targets = [];
    state.tank = 0;
    state.shots = [{ x: 400, y: 300, vx: 0, vy: -700 }];
    step(state, 0.1, fakeScores(true));
    expect(state.phase).toBe('playing');
  });

  it('detects a hit inside the target and a miss outside it', () => {
    expect(isHit({ x: 410, y: 210, vx: 0, vy: 0 }, target)).toBe(true);
    expect(isHit({ x: 460, y: 200, vx: 0, vy: 0 }, target)).toBe(false);
  });

  it('scores a fast target higher than a slow one', () => {
    const slow = scoreForHit({ ...target, speed: 60 });
    const fast = scoreForHit({ ...target, speed: -180 });
    expect(Math.max(fast, slow)).toBeGreaterThanOrEqual(slow);
  });
});

function fakeScores(makesBoard: boolean) {
  const records: { score: number; name?: string }[] = [];
  const scores: ScoreSink = {
    makesLeaderboard: () => makesBoard,
    record: (score, name) => void records.push(name === undefined ? { score } : { score, name }),
  };
  return { ...scores, records };
}

/** A round that has just used its last shot, with nothing in the air. */
function finishedRound(score: number): WaterCannonState {
  const state = createState();
  state.targets = [];
  state.tank = 0;
  state.score = score;
  return state;
}

describe('water cannon screens', () => {
  it('opens on the title, not a round in progress', () => {
    const state = createState('title');
    expect(state.phase).toBe('title');
    expect(fire(state, 400, 0)).toBe(false);
  });

  it('swaps the title and the leaderboard every 5 seconds', () => {
    const scores = fakeScores(true);
    const state = createState('title');
    step(state, TITLE_SECONDS - 0.1, scores);
    expect(state.phase).toBe('title');
    step(state, 0.1, scores);
    expect(state.phase).toBe('leaderboard');
    step(state, LEADERBOARD_SECONDS - 0.1, scores);
    expect(state.phase).toBe('leaderboard');
    step(state, 0.1, scores);
    expect(state.phase).toBe('title');
  });

  it('starts a fresh round on a click from the title or the leaderboard', () => {
    for (const phase of ['title', 'leaderboard'] as const) {
      const state = createState(phase);
      state.score = 99;
      state.tank = 0;
      expect(click(state, 400, 0)).toBe(true);
      expect(state.phase).toBe('playing');
      expect(state.tank).toBe(TANK_SIZE);
      expect(state.score).toBe(0);
      expect(state.shots).toHaveLength(0);
    }
  });

  it('fires on a click while playing', () => {
    const state = createState();
    expect(click(state, 400, 0)).toBe(true);
    expect(state.tank).toBe(TANK_SIZE - 1);
  });

  it('asks for a name when the round makes the top 10, and saves nothing yet', () => {
    const scores = fakeScores(true);
    const state = finishedRound(80);
    step(state, 0.01, scores);
    expect(state.phase).toBe('entering');
    expect(scores.records).toEqual([]);
  });

  it('saves with no name, shows the score for 3 seconds, then the title, when it misses the top 10', () => {
    const scores = fakeScores(false);
    const state = finishedRound(40);
    step(state, 0.01, scores);
    expect(state.phase).toBe('over');
    expect(scores.records).toEqual([{ score: 40 }]);
    step(state, OVER_SECONDS - 0.1, scores);
    expect(state.phase).toBe('over');
    step(state, 0.1, scores);
    expect(state.phase).toBe('title');
    expect(scores.records).toHaveLength(1);
  });

  it('ignores clicks on the game over screen', () => {
    const scores = fakeScores(false);
    const state = finishedRound(40);
    step(state, 0.01, scores);
    expect(click(state, 400, 0)).toBe(false);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(40);
  });

  it('ignores clicks during name entry', () => {
    const scores = fakeScores(true);
    const state = finishedRound(80);
    step(state, 0.01, scores);
    expect(click(state, 400, 0)).toBe(false);
    expect(state.phase).toBe('entering');
    expect(state.score).toBe(80);
  });

  it('counts down whole seconds from 30 to 0', () => {
    const scores = fakeScores(true);
    const state = finishedRound(80);
    step(state, 0, scores);
    expect(entryCountdown(state)).toBe(30);
    step(state, 0.5, scores);
    expect(entryCountdown(state)).toBe(30);
    step(state, 0.5, scores);
    expect(entryCountdown(state)).toBe(29);
    step(state, ENTRY_SECONDS - 1.5, scores);
    expect(entryCountdown(state)).toBe(1);
    expect(state.phase).toBe('entering');
  });

  it('saves the typed name on Enter and returns to the title', () => {
    const scores = fakeScores(true);
    const state = finishedRound(80);
    step(state, 0.01, scores);
    state.name = 'Ada';
    expect(submitName(state, scores)).toBe(true);
    expect(state.phase).toBe('title');
    expect(scores.records).toEqual([{ score: 80, name: 'Ada' }]);
    step(state, ENTRY_SECONDS, scores);
    expect(scores.records).toHaveLength(1);
  });

  it('does nothing on Enter with an empty or spaces-only name', () => {
    const scores = fakeScores(true);
    const state = finishedRound(80);
    step(state, 0.01, scores);
    for (const name of ['', '   ']) {
      state.name = name;
      expect(submitName(state, scores)).toBe(false);
      expect(state.phase).toBe('entering');
    }
    expect(scores.records).toEqual([]);
  });

  it('saves what is typed when the countdown reaches 0', () => {
    const scores = fakeScores(true);
    const state = finishedRound(80);
    step(state, 0.01, scores);
    state.name = 'Bo';
    step(state, ENTRY_SECONDS, scores);
    expect(state.phase).toBe('title');
    expect(scores.records).toEqual([{ score: 80, name: 'Bo' }]);
  });

  it('saves with no name when the countdown reaches 0 on an empty box', () => {
    const scores = fakeScores(true);
    const state = finishedRound(80);
    step(state, 0.01, scores);
    state.name = '  ';
    step(state, ENTRY_SECONDS, scores);
    expect(state.phase).toBe('title');
    expect(scores.records).toEqual([{ score: 80 }]);
  });

  it('records exactly one score per round', () => {
    for (const makesBoard of [true, false]) {
      const scores = fakeScores(makesBoard);
      const state = finishedRound(50);
      for (let i = 0; i < 4; i++) step(state, ENTRY_SECONDS, scores);
      expect(scores.records).toHaveLength(1);
    }
  });

  it('drops the characters a name may not hold as they are typed', () => {
    expect(filterName('Ada!@#')).toBe('Ada');
    expect(filterName("O'Neil-Jr.")).toBe("O'Neil-Jr.");
    expect(filterName('Zoë 😀 K')).toBe('Zo  K');
    expect(filterName('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKL');
  });

  it('filters a pasted name before cutting it to 12 characters', () => {
    expect(filterName('!!!ABCDEFGHIJKL')).toBe('ABCDEFGHIJKL');
  });

  it('moves the countdown by a full second on a 1-second tick, but caps the physics', () => {
    const scores = fakeScores(true);
    const state = finishedRound(80);
    step(state, 0, scores);
    state.targets = [{ ...target }];
    tick(state, 1, scores);
    expect(entryCountdown(state)).toBe(ENTRY_SECONDS - 1);
    expect(state.targets[0].x).toBeCloseTo(target.x + target.speed * MAX_STEP_SECONDS);
  });

  it('times the title and game over screens in real seconds on slow frames', () => {
    const scores = fakeScores(false);
    const title = createState('title');
    for (let i = 0; i < TITLE_SECONDS; i++) tick(title, 1, scores);
    expect(title.phase).toBe('leaderboard');
    const over = finishedRound(40);
    tick(over, 0.01, scores);
    for (let i = 0; i < OVER_SECONDS; i++) tick(over, 1, scores);
    expect(over.phase).toBe('title');
  });

  it('saves the pending score once when the game stops during name entry', () => {
    for (const [typed, saved] of [
      ['Ada', { score: 80, name: 'Ada' }],
      ['  ', { score: 80 }],
    ] as const) {
      const scores = fakeScores(true);
      const state = finishedRound(80);
      step(state, 0.01, scores);
      state.name = typed;
      stop(state, scores);
      stop(state, scores);
      expect(scores.records).toEqual([saved]);
    }
  });

  it('saves nothing extra when the game stops in any other phase', () => {
    for (const phase of ['title', 'leaderboard', 'playing', 'over'] as const) {
      const scores = fakeScores(true);
      const state = createState(phase);
      state.score = 80;
      stop(state, scores);
      expect(scores.records).toEqual([]);
    }
    const scores = fakeScores(true);
    const state = finishedRound(80);
    step(state, 0.01, scores);
    state.name = 'Ada';
    submitName(state, scores);
    stop(state, scores);
    expect(scores.records).toHaveLength(1);
  });
});
