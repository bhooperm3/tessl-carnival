import { describe, expect, it } from 'vitest';
import {
  CUPS,
  REVEAL_TIME,
  SHOW_TIME,
  SLOT_X,
  applySwap,
  createState,
  generateShuffle,
  levelSettings,
  pick,
  slotAt,
  step,
  trackBall,
  type CupShuffleState,
  type Swap,
} from './game';

/** A random function that returns the given values in turn, then starts over. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Steps through the showing and the whole shuffle, until the cups can be picked. */
function shuffleToPick(state: CupShuffleState): void {
  step(state, SHOW_TIME);
  while (state.phase === 'shuffling') step(state, state.swapDuration);
}

describe('cup shuffle', () => {
  it('starts on level 1 with no score, showing the ball', () => {
    const state = createState(sequence(0.5));
    expect(state.level).toBe(1);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('showing');
    expect(state.ball).toBe(1);
    expect(state.swaps).toHaveLength(levelSettings(1).swaps);
  });

  it('moves the ball only when its cup is in the swap', () => {
    expect(applySwap(0, [0, 2])).toBe(2);
    expect(applySwap(2, [0, 2])).toBe(0);
    expect(applySwap(1, [0, 2])).toBe(1);
  });

  it('tracks the ball through a fixed list of swaps', () => {
    const swaps: Swap[] = [
      [0, 1],
      [1, 2],
      [0, 2],
      [0, 1],
    ];
    // 0 -> 1 -> 2 -> 0 -> 1
    expect(trackBall(0, swaps)).toBe(1);
    // 2 -> 2 -> 1 -> 1 -> 0
    expect(trackBall(2, swaps)).toBe(0);
    expect(trackBall(1, [])).toBe(1);
  });

  it('builds a shuffle from the random function it is given', () => {
    const swaps = generateShuffle(3, sequence(0, 0, 0.5, 0.9, 0.9, 0));
    expect(swaps).toEqual([
      [0, 1],
      [1, 0],
      [2, 0],
    ]);
  });

  it('always swaps two different cups', () => {
    const swaps = generateShuffle(200);
    for (const [a, b] of swaps) {
      expect(a).not.toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(CUPS);
    }
  });

  it('ends the shuffle with the ball where trackBall says', () => {
    const state = createState(sequence(0.1, 0.7, 0.3, 0.4, 0.9));
    const expected = trackBall(state.ball, state.swaps);
    shuffleToPick(state);
    expect(state.phase).toBe('picking');
    expect(state.ball).toBe(expected);
  });

  it('ignores picks before the shuffle has stopped', () => {
    const state = createState(sequence(0));
    expect(pick(state, state.ball)).toBe(false);
    step(state, SHOW_TIME);
    expect(state.phase).toBe('shuffling');
    expect(pick(state, state.ball)).toBe(false);
    expect(state.score).toBe(0);
  });

  it('scores a right pick and moves to the next level', () => {
    const state = createState(sequence(0.2, 0.6, 0.8));
    shuffleToPick(state);
    expect(pick(state, state.ball)).toBe(true);
    expect(state.score).toBe(1);
    expect(state.phase).toBe('revealing');
    step(state, REVEAL_TIME);
    expect(state.level).toBe(2);
    expect(state.phase).toBe('showing');
    expect(state.swaps).toHaveLength(levelSettings(2).swaps);
  });

  it('ends the round on a wrong pick, keeping the score', () => {
    const state = createState(sequence(0.2, 0.6, 0.8));
    shuffleToPick(state);
    pick(state, state.ball);
    step(state, REVEAL_TIME);
    shuffleToPick(state);
    const wrong = (state.ball + 1) % CUPS;
    expect(pick(state, wrong)).toBe(true);
    expect(state.score).toBe(1);
    step(state, REVEAL_TIME);
    expect(state.phase).toBe('over');
    expect(pick(state, state.ball)).toBe(false);
  });

  it('shuffles more times and faster at each level', () => {
    for (let level = 1; level < 10; level++) {
      const now = levelSettings(level);
      const next = levelSettings(level + 1);
      expect(next.swaps).toBeGreaterThan(now.swaps);
      expect(next.swapDuration).toBeLessThan(now.swapDuration);
    }
  });

  it('finds the cup under a click, and no cup between them', () => {
    expect(slotAt(SLOT_X[0], 300)).toBe(0);
    expect(slotAt(SLOT_X[2], 300)).toBe(2);
    expect(slotAt((SLOT_X[0] + SLOT_X[1]) / 2, 300)).toBe(-1);
    expect(slotAt(SLOT_X[1], 50)).toBe(-1);
  });
});
