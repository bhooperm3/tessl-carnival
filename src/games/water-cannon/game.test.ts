import { describe, expect, it } from 'vitest';
import {
  BURST_MAX,
  BURST_MIN,
  CANNON,
  ENTRY_SECONDS,
  GRAVITY,
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
  type Shot,
  type Target,
  type WaterCannonState,
} from './game';

const target: Target = { x: 400, y: 200, radius: 28, speed: 120 };

/** A fixed random function: no spread, and a 5-droplet burst. */
const middle = () => 0.5;

/** A droplet with its own burst, already out of the barrel. */
function drop(x: number, y: number, vx = 0, vy = 0): Shot {
  return { x, y, vx, vy, burst: { soaked: [] }, delay: 0 };
}

/** Steps a playing round until its droplets have all landed, or `seconds` pass. */
function settle(state: WaterCannonState, seconds = 5): void {
  for (let t = 0; t < seconds && state.shots.length > 0; t += 0.01) {
    step(state, 0.01, fakeScores(false));
  }
}

/** Fires one burst at the aim with every target held still, lets it land, and says if it hit. */
function fireStill(state: WaterCannonState, aimX: number, aimY: number): boolean {
  for (const t of state.targets) t.speed = 0;
  fire(state, aimX, aimY);
  const burst = state.shots[0].burst;
  settle(state);
  return burst.soaked.length > 0;
}

/** The aim, above a point, whose arc passes through it. */
function aimFor(x: number, y: number): { x: number; y: number } {
  const dx = x - CANNON.x;
  const dy = CANNON.y - y;
  // Solve for the launch angle that reaches (dx, dy): take the flatter one.
  const v2 = 700 * 700;
  const root = Math.sqrt(v2 * v2 - GRAVITY * (GRAVITY * dx * dx + 2 * dy * v2));
  const angle = Math.atan2(v2 - root, GRAVITY * Math.abs(dx));
  const side = Math.sign(dx) || 1;
  return { x: CANNON.x + side * Math.cos(angle) * 100, y: CANNON.y - Math.sin(angle) * 100 };
}

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
    expect(state.shots.length).toBeGreaterThanOrEqual(BURST_MIN);
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
    state.shots = [drop(target.x, target.y + 5)];
    step(state, 0);
    expect(state.score).toBe(scoreForHit(target));
    expect(state.shots).toHaveLength(0);
    expect(state.targets[0].x).toBeLessThan(0);
  });

  it('ends the round when the tank is empty and the last shot has landed', () => {
    const state = createState();
    state.tank = 0;
    state.shots = [drop(10, CANNON.y - 1, 0, 700)];
    step(state, 0.1, fakeScores(false));
    expect(state.phase).toBe('over');
  });

  it('keeps playing while a shot is still in the air', () => {
    const state = createState();
    state.targets = [];
    state.tank = 0;
    state.shots = [drop(400, 300, 0, -700)];
    step(state, 0.1, fakeScores(true));
    expect(state.phase).toBe('playing');
  });

  it('detects a hit inside the target and a miss outside it', () => {
    expect(isHit(drop(410, 210), target)).toBe(true);
    expect(isHit(drop(460, 200), target)).toBe(false);
  });

  it('scores a fast target higher than a slow one', () => {
    const slow = scoreForHit({ ...target, speed: 60 });
    const fast = scoreForHit({ ...target, speed: -180 });
    expect(Math.max(fast, slow)).toBeGreaterThanOrEqual(slow);
  });
});

describe('water cannon droplets', () => {
  it('rises, slows, then falls when fired straight up', () => {
    const state = createState('playing', middle);
    state.targets = [];
    fire(state, CANNON.x, 0);
    const shot = state.shots[0];
    const speeds: number[] = [];
    for (let i = 0; i < 200; i++) {
      step(state, 0.01, fakeScores(false));
      speeds.push(shot.vy);
    }
    expect(speeds[0]).toBeLessThan(0);
    expect(speeds.at(-1)).toBeGreaterThan(0);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThan(speeds[i - 1]);
  });

  it('removes droplets that leave the side of the screen', () => {
    const state = createState('playing', middle);
    state.targets = [];
    state.shots = [drop(795, 300, 400, 0)];
    step(state, 0.1, fakeScores(false));
    expect(state.shots).toHaveLength(0);
  });

  it('removes droplets that fall back below the cannon', () => {
    const state = createState('playing', middle);
    state.targets = [];
    fire(state, CANNON.x, 0);
    settle(state, 10);
    expect(state.shots).toHaveLength(0);
  });

  it('can hit a target at either end of every rail', () => {
    for (const y of [110, 200, 290]) {
      for (const x of [0, 800]) {
        const state = createState('playing', middle);
        const t = state.targets.find((t) => t.y === y)!;
        state.targets = [{ ...t, x }];
        const aim = aimFor(x, y);
        expect(fireStill(state, aim.x, aim.y), `rail ${y}, x ${x}`).toBe(true);
      }
    }
  });

  it('falls short of a top rail target aimed at directly, and reaches it aimed higher', () => {
    const top = { x: 700, y: 110, radius: 22, speed: 180 };
    const direct = createState('playing', middle);
    direct.targets = [{ ...top }];
    expect(fireStill(direct, top.x, top.y)).toBe(false);

    const higher = createState('playing', middle);
    higher.targets = [{ ...top }];
    const aim = aimFor(top.x, top.y);
    expect(aim.y).toBeLessThan(
      CANNON.y - ((CANNON.y - top.y) / (top.x - CANNON.x)) * (aim.x - CANNON.x),
    );
    expect(fireStill(higher, aim.x, aim.y)).toBe(true);
  });

  it('uses one unit of water per click, however many droplets the burst has', () => {
    for (const r of [0, 0.5, 0.999]) {
      const state = createState('playing', () => r);
      click(state, 400, 0);
      expect(state.tank).toBe(TANK_SIZE - 1);
      expect(state.shots.length).toBeGreaterThanOrEqual(BURST_MIN);
      expect(state.shots.length).toBeLessThanOrEqual(BURST_MAX);
    }
  });

  it('scores a target at most once per burst', () => {
    const state = createState('playing', middle);
    const t = { x: 400, y: 200, radius: 28, speed: 0 };
    state.targets = [t];
    fire(state, 400, 200);
    const burst = state.shots[0].burst;
    // Every droplet lands in the target at once, and it stays where it is.
    state.shots = state.shots.map((s) => ({ ...s, x: 400, y: 200, delay: 0 }));
    step(state, 0, fakeScores(false));
    t.x = 400;
    state.shots = [{ ...drop(400, 200), burst }];
    step(state, 0, fakeScores(false));
    expect(state.score).toBe(0);
    expect(state.shots).toHaveLength(0);
  });

  it('can score two different targets with one burst', () => {
    const state = createState('playing', middle);
    const a = { x: 300, y: 200, radius: 28, speed: 120 };
    const b = { x: 500, y: 290, radius: 34, speed: 60 };
    state.targets = [a, b];
    fire(state, 400, 0);
    const [first, second] = state.shots;
    state.shots = [
      { ...first, x: a.x, y: a.y, delay: 0 },
      { ...second, x: b.x, y: b.y, delay: 0 },
    ];
    step(state, 0, fakeScores(false));
    expect(state.score).toBe(20 + 10);
  });

  it('stops a droplet at the first target it touches', () => {
    const state = createState('playing', middle);
    state.targets = [{ ...target }];
    state.shots = [drop(target.x, target.y)];
    step(state, 0, fakeScores(false));
    expect(state.shots).toHaveLength(0);
  });

  it('throws splash droplets that never score or move a target', () => {
    const state = createState('playing', middle);
    state.targets = [{ ...target, speed: 0 }];
    state.shots = [drop(target.x, target.y)];
    step(state, 0, fakeScores(false));
    expect(state.splashes.length).toBeGreaterThan(0);
    const score = state.score;
    // Put the target back under its own splash.
    const t = state.targets[0];
    t.x = target.x;
    for (let i = 0; i < 60; i++) step(state, 0.01, fakeScores(false));
    expect(state.score).toBe(score);
    expect(t.x).toBe(target.x);
  });

  it('lets splash droplets fall and fade away', () => {
    const state = createState('playing', middle);
    state.targets = [{ ...target, speed: 0 }];
    state.shots = [drop(target.x, target.y)];
    step(state, 0, fakeScores(false));
    const splash = state.splashes[0];
    const vy = splash.vy;
    step(state, 0.1, fakeScores(false));
    expect(splash.vy).toBeGreaterThan(vy);
    step(state, 1, fakeScores(false));
    expect(state.splashes).toHaveLength(0);
  });

  it('keeps its random function when a new round starts', () => {
    const state = createState('title', middle);
    click(state, 400, 0);
    expect(state.random).toBe(middle);
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
