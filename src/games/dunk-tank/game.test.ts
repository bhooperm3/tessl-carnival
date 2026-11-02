import { describe, expect, it } from 'vitest';
import {
  BALLS_PER_ROUND,
  CLIMB_TIME,
  SPEED_UP,
  TARGET_TRACK,
  createState,
  isHit,
  land,
  moveTarget,
  scoreForThrow,
  step,
  throwBall,
  type Target,
} from './game';

const target: Target = { x: 500, y: 250, radius: 40, speed: 120 };

/** Lets the ball land and the clown climb back up. */
function settle(state: ReturnType<typeof createState>) {
  for (let i = 0; i < 200 && (state.ball || state.dunked > 0); i++) step(state, 0.05);
}

describe('dunk tank', () => {
  it('starts with a full round of balls and no score', () => {
    const state = createState();
    expect(state.ballsLeft).toBe(BALLS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('slides the target along its track', () => {
    const t = { ...target };
    moveTarget(t, 0.5);
    expect(t.y).toBe(310);
    expect(t.x).toBe(500);
  });

  it('bounces the target back at the ends of its track', () => {
    const down = { ...target, y: TARGET_TRACK.bottom - 10 };
    moveTarget(down, 0.25);
    expect(down.y).toBe(TARGET_TRACK.bottom - 20);
    expect(down.speed).toBeLessThan(0);

    const up = { ...target, y: TARGET_TRACK.top + 10, speed: -120 };
    moveTarget(up, 0.25);
    expect(up.y).toBe(TARGET_TRACK.top + 20);
    expect(up.speed).toBeGreaterThan(0);
  });

  it('scores a centre hit higher than an edge hit, and a miss as nothing', () => {
    const centre = scoreForThrow(target.x, target.y, target);
    const edge = scoreForThrow(target.x + 38, target.y, target);
    expect(centre).toBe(30);
    expect(edge).toBe(10);
    expect(scoreForThrow(target.x + 41, target.y, target)).toBe(0);
    expect(isHit(target.x + 41, target.y, target)).toBe(false);
  });

  it('dunks the clown and scores on a centre hit', () => {
    const state = createState();
    const { x, y } = state.target;
    expect(land(state, x, y)).toBe(30);
    expect(state.score).toBe(30);
    expect(state.dunked).toBe(CLIMB_TIME);
    expect(state.splash).not.toBeNull();
  });

  it('scores less for a dunk near the edge', () => {
    const state = createState();
    const { x, y, radius } = state.target;
    expect(land(state, x, y + radius - 1)).toBe(10);
    expect(state.score).toBe(10);
    expect(state.dunked).toBe(CLIMB_TIME);
  });

  it('leaves the clown dry and the score alone on a miss', () => {
    const state = createState();
    const speed = state.target.speed;
    expect(land(state, 100, 100)).toBe(0);
    expect(state.score).toBe(0);
    expect(state.dunked).toBe(0);
    expect(state.target.speed).toBe(speed);
  });

  it('speeds the target up after each dunk', () => {
    const state = createState();
    const speed = state.target.speed;
    land(state, state.target.x, state.target.y);
    expect(state.target.speed).toBeCloseTo(speed * SPEED_UP);
    land(state, state.target.x, state.target.y);
    expect(state.target.speed).toBeCloseTo(speed * SPEED_UP * SPEED_UP);
  });

  it('lands a thrown ball at the aim point', () => {
    const state = createState();
    expect(throwBall(state, 100, 100)).toBe(true);
    expect(state.ballsLeft).toBe(BALLS_PER_ROUND - 1);
    settle(state);
    expect(state.ball).toBeNull();
    expect(state.lastPoints).toBe(0);
  });

  it('waits for the clown to climb back up before the next throw', () => {
    const state = createState();
    land(state, state.target.x, state.target.y);
    expect(throwBall(state, 100, 100)).toBe(false);
    settle(state);
    expect(throwBall(state, 100, 100)).toBe(true);
  });

  it('ends the round after 6 balls, with the total as the score', () => {
    const state = createState();
    for (let i = 0; i < BALLS_PER_ROUND; i++) {
      expect(state.phase).toBe('playing');
      expect(throwBall(state, 100, 100)).toBe(true);
      settle(state);
    }
    expect(state.phase).toBe('over');
    expect(throwBall(state, 100, 100)).toBe(false);
  });

  it('keeps playing while the last ball is in the air', () => {
    const state = createState();
    state.ballsLeft = 1;
    throwBall(state, 100, 100);
    step(state, 0.01);
    expect(state.phase).toBe('playing');
  });
});
