import { describe, expect, it } from 'vitest';
import {
  ANGLE_SPEED,
  FLIGHT_TIME,
  MAX_ANGLE,
  POWER_SPEED,
  RESULT_TIME,
  SHOTS_PER_ROUND,
  createState,
  scoreFor,
  shotResult,
  step,
  tap,
  type BasketballState,
} from './game';

/** Takes one shot at a known angle and power, and plays it out. */
function shoot(state: BasketballState, angle: number, power: number) {
  state.angle = angle;
  tap(state);
  state.power = power;
  tap(state);
  step(state, FLIGHT_TIME);
  step(state, RESULT_TIME);
}

describe('basketball shot', () => {
  it('starts aiming with no shots taken and no score', () => {
    const state = createState();
    expect(state.phase).toBe('angle');
    expect(state.results).toHaveLength(0);
    expect(state.score).toBe(0);
  });

  it('sweeps the arrow right, then back left at the edge', () => {
    const state = createState();
    step(state, 0.5);
    expect(state.angle).toBeCloseTo(ANGLE_SPEED * 0.5);
    step(state, MAX_ANGLE / ANGLE_SPEED);
    expect(state.angle).toBeLessThan(MAX_ANGLE);
    expect(state.angleDirection).toBe(-1);
    step(state, 10);
    expect(Math.abs(state.angle)).toBeLessThanOrEqual(MAX_ANGLE);
  });

  it('locks the angle on the first tap and starts the power bar', () => {
    const state = createState();
    step(state, 0.2);
    const angle = state.angle;
    expect(tap(state)).toBe(true);
    expect(state.phase).toBe('power');
    step(state, 0.3);
    expect(state.angle).toBe(angle);
    expect(state.power).toBeCloseTo(POWER_SPEED * 0.3);
  });

  it('fills the power bar, then empties it once full', () => {
    const state = createState();
    tap(state);
    step(state, 1 / POWER_SPEED - 0.1);
    expect(state.powerDirection).toBe(1);
    step(state, 0.2);
    expect(state.power).toBeLessThan(1);
    expect(state.powerDirection).toBe(-1);
    step(state, 1 / POWER_SPEED);
    expect(state.power).toBeGreaterThanOrEqual(0);
    expect(state.powerDirection).toBe(1);
  });

  it('locks the power on the second tap and shoots with the locked angle and power', () => {
    const state = createState();
    state.angle = 0;
    tap(state);
    state.power = 0.75;
    expect(tap(state)).toBe(true);
    expect(state.phase).toBe('flying');
    expect(state.flight).toMatchObject({ angle: 0, power: 0.75, result: 'swish' });
    expect(tap(state)).toBe(false);
  });

  it('calls a straight shot at the right power a swish, worth 3', () => {
    expect(shotResult(0, 0.75)).toBe('swish');
    expect(scoreFor('swish')).toBe(3);
  });

  it('calls a shot that comes down on the rim a rim shot, worth 2', () => {
    expect(shotResult(0, 0.8)).toBe('rim');
    expect(shotResult(5, 0.75)).toBe('rim');
    expect(scoreFor('rim')).toBe(2);
  });

  it('calls a short, long or wide shot a miss, worth 0', () => {
    expect(shotResult(0, 0.5)).toBe('miss');
    expect(shotResult(0, 1)).toBe('miss');
    expect(shotResult(MAX_ANGLE, 0.75)).toBe('miss');
    expect(scoreFor('miss')).toBe(0);
  });

  it('scores a shot when it lands, then goes back to aiming', () => {
    const state = createState();
    shoot(state, 0, 0.75);
    expect(state.results).toEqual(['swish']);
    expect(state.score).toBe(3);
    expect(state.phase).toBe('angle');
  });

  it('ends the round after 5 shots with the total of the 5', () => {
    const state = createState();
    shoot(state, 0, 0.75);
    shoot(state, 0, 0.8);
    shoot(state, 0, 0.5);
    shoot(state, 0, 0.75);
    expect(state.phase).toBe('angle');
    shoot(state, 0, 0.8);
    expect(state.results).toHaveLength(SHOTS_PER_ROUND);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(3 + 2 + 0 + 3 + 2);
    expect(tap(state)).toBe(false);
  });
});
