import { describe, expect, it } from 'vitest';
import {
  CHIPS_PER_ROUND,
  MAX_POSITION,
  ROWS,
  SLOTS,
  SLOT_VALUES,
  aimAt,
  createState,
  drop,
  fallPath,
  landingSlot,
  moveAim,
  slotValue,
  step,
} from './game';

const always = (value: number) => () => value;
/** Bounces in a fixed order: true is right, false is left. */
const bounces = (...rights: boolean[]) => {
  let i = 0;
  return () => (rights[i++ % rights.length] ? 0.9 : 0.1);
};
/** A small seeded random, so the fuzz test is the same every run. */
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

/** Steps until the falling chip lands. */
const land = (state: ReturnType<typeof createState>) => {
  while (state.chip) step(state, 0.05);
};

describe('plinko', () => {
  it('starts with 5 chips, no score and the chip over the middle slot', () => {
    const state = createState();
    expect(state.chipsLeft).toBe(CHIPS_PER_ROUND);
    expect(CHIPS_PER_ROUND).toBe(5);
    expect(state.score).toBe(0);
    expect(state.aim).toBe(4);
    expect(state.phase).toBe('playing');
  });

  it('pays the most in the middle and the least at the edges', () => {
    expect(SLOT_VALUES).toEqual([10, 20, 50, 100, 200, 100, 50, 20, 10]);
    const middle = Math.floor(SLOTS / 2);
    for (let slot = 0; slot < SLOTS; slot++) {
      expect(slotValue(slot)).toBeLessThanOrEqual(slotValue(middle));
      expect(slotValue(slot)).toBeGreaterThanOrEqual(slotValue(0));
      expect(slotValue(slot)).toBe(slotValue(SLOTS - 1 - slot));
    }
    expect(slotValue(0)).toBeLessThan(slotValue(middle));
  });

  it('lands a chip with fixed bounces in the expected slot', () => {
    // Even bounces cancel out: back where it started.
    expect(landingSlot(fallPath(4, bounces(true, false)))).toBe(4);
    // Six rights and two lefts: two slots to the right.
    expect(landingSlot(fallPath(2, bounces(true, true, true, false)))).toBe(4);
    expect(landingSlot(fallPath(6, always(0.1)))).toBe(2);
  });

  it('scores the slot the chip lands in', () => {
    const state = createState();
    moveAim(state, -2);
    drop(state, bounces(true, false));
    land(state);
    expect(state.landings).toEqual([{ slot: 2, value: 50 }]);
    expect(state.score).toBe(50);
  });

  it('bounces a chip off the wall instead of leaving the board', () => {
    const left = fallPath(0, always(0.1));
    expect(left).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0]);
    expect(landingSlot(left)).toBe(0);
    const right = fallPath(SLOTS - 1, always(0.9));
    expect(Math.max(...right)).toBe(MAX_POSITION);
    expect(landingSlot(right)).toBe(SLOTS - 1);
  });

  it('never lets a chip leave the board, from any slot', () => {
    const random = seeded(42);
    for (let i = 0; i < 500; i++) {
      const path = fallPath(i % SLOTS, random);
      expect(path).toHaveLength(ROWS + 1);
      for (const position of path) {
        expect(position).toBeGreaterThanOrEqual(0);
        expect(position).toBeLessThanOrEqual(MAX_POSITION);
      }
      const slot = landingSlot(path);
      expect(Number.isInteger(slot)).toBe(true);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(SLOTS);
    }
  });

  it('keeps the chip on the rail inside the board', () => {
    const state = createState();
    moveAim(state, -20);
    expect(state.aim).toBe(0);
    moveAim(state, 20);
    expect(state.aim).toBe(SLOTS - 1);
    aimAt(state, -50);
    expect(state.aim).toBe(0);
    aimAt(state, 10_000);
    expect(state.aim).toBe(SLOTS - 1);
  });

  it('drops one chip at a time', () => {
    const state = createState();
    expect(drop(state, always(0.1))).toBe(true);
    expect(drop(state, always(0.1))).toBe(false);
    expect(state.chipsLeft).toBe(CHIPS_PER_ROUND - 1);
  });

  it('ends the round after 5 chips and totals them', () => {
    const state = createState();
    for (let chip = 0; chip < CHIPS_PER_ROUND; chip++) {
      expect(state.phase).toBe('playing');
      expect(drop(state, bounces(true, false))).toBe(true);
      land(state);
    }
    expect(state.phase).toBe('over');
    expect(state.landings).toHaveLength(5);
    expect(state.score).toBe(5 * slotValue(4));
    expect(drop(state, always(0.1))).toBe(false);
  });

  it('keeps playing while the last chip is still falling', () => {
    const state = createState();
    state.chipsLeft = 1;
    drop(state, always(0.1));
    step(state, 0.05);
    expect(state.phase).toBe('playing');
    land(state);
    expect(state.phase).toBe('over');
  });
});
