import { describe, expect, it } from 'vitest';
import {
  BANDS,
  PUCK_TIME,
  SWINGS_PER_ROUND,
  bandFor,
  createState,
  needlePosition,
  ringsBell,
  scoreForHeight,
  step,
  sweepSpeed,
  swing,
} from './game';

/** Puts the needle at `height` on the way up, ready for a swing. */
function atNeedle(height: number) {
  const state = createState();
  state.sweep = height;
  return state;
}

/** Swings at `height`, then lets the puck land. */
function swingAt(state: ReturnType<typeof createState>, height: number) {
  state.sweep = height;
  swing(state);
  step(state, PUCK_TIME);
}

describe('high striker', () => {
  it('starts with no swings and no score', () => {
    const state = createState();
    expect(state.swings).toEqual([]);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(needlePosition(state.sweep)).toBe(0);
  });

  it('sweeps the needle up to the top and back down again', () => {
    expect(needlePosition(0)).toBe(0);
    expect(needlePosition(0.5)).toBe(0.5);
    expect(needlePosition(1)).toBe(1);
    expect(needlePosition(1.25)).toBe(0.75);
    expect(needlePosition(2)).toBe(0);
    expect(needlePosition(2.5)).toBe(0.5);
  });

  it('moves the needle with time while no puck is in the air', () => {
    const state = createState();
    step(state, 0.5);
    expect(needlePosition(state.sweep)).toBeCloseTo(sweepSpeed(0) * 0.5);
  });

  it('sweeps the needle faster on each swing', () => {
    for (let i = 1; i < SWINGS_PER_ROUND; i++) {
      expect(sweepSpeed(i)).toBeGreaterThan(sweepSpeed(i - 1));
    }
    const state = createState();
    swingAt(state, 0.5);
    const before = state.sweep;
    step(state, 0.1);
    expect(state.sweep - before).toBeCloseTo(sweepSpeed(1) * 0.1);
  });

  it('scores each band, more for higher bands', () => {
    expect(scoreForHeight(1)).toBe(100);
    expect(scoreForHeight(0.95)).toBe(100);
    expect(scoreForHeight(0.9)).toBe(50);
    expect(scoreForHeight(0.7)).toBe(30);
    expect(scoreForHeight(0.5)).toBe(20);
    expect(scoreForHeight(0.3)).toBe(10);
    expect(scoreForHeight(0.1)).toBe(5);
    expect(scoreForHeight(0)).toBe(5);
    for (const band of BANDS) expect(bandFor(band.from)).toBe(band);
  });

  it('rings the bell only from the top band', () => {
    expect(ringsBell(1)).toBe(true);
    expect(ringsBell(0.95)).toBe(true);
    expect(ringsBell(0.94)).toBe(false);

    const top = atNeedle(0.97);
    swing(top);
    expect(top.bell).toBeGreaterThan(0);
    expect(top.score).toBe(100);

    const low = atNeedle(0.5);
    swing(low);
    expect(low.bell).toBe(0);
  });

  it('sends the puck as high as the needle when the mallet swings', () => {
    const state = atNeedle(0.7);
    expect(swing(state)).toBe(true);
    expect(state.puck?.height).toBeCloseTo(0.7);
    expect(state.swings).toEqual([30]);
    expect(state.score).toBe(30);
  });

  it('cannot swing again while the puck is in the air', () => {
    const state = atNeedle(0.5);
    swing(state);
    expect(swing(state)).toBe(false);
    expect(state.swings).toHaveLength(1);
  });

  it('ends the round after five swings, totalling their scores', () => {
    const state = createState();
    const heights = [1, 0.9, 0.7, 0.5, 0.1];
    heights.forEach((height, i) => {
      swingAt(state, height);
      expect(state.phase).toBe(i === heights.length - 1 ? 'over' : 'playing');
    });
    expect(state.swings).toHaveLength(SWINGS_PER_ROUND);
    expect(state.score).toBe(100 + 50 + 30 + 20 + 5);
    expect(swing(state)).toBe(false);
  });

  it('waits for the last puck to land before ending the round', () => {
    const state = createState();
    for (let i = 0; i < SWINGS_PER_ROUND - 1; i++) swingAt(state, 0.5);
    state.sweep = 0.5;
    swing(state);
    step(state, PUCK_TIME / 2);
    expect(state.phase).toBe('playing');
    step(state, PUCK_TIME / 2);
    expect(state.phase).toBe('over');
  });
});
