import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const BALLS_PER_ROUND = 6;
export const BALL_SPEED = 900;
/** Pixels per second the aim moves while an arrow key is held. */
export const AIM_SPEED = 360;
/** Each dunk makes the target this much faster. */
export const SPEED_UP = 1.25;
/** Seconds the clown takes to climb back onto the plank. */
export const CLIMB_TIME = 1.2;
export const THROWER = { x: 110, y: HEIGHT - 40 } as const;
export const TARGET_TRACK = { x: 500, top: 110, bottom: 400, radius: 40, speed: 120 } as const;
const TANK = { x: 590, y: 280, width: 190, height: 190 } as const;
const PLANK_Y = 220;

export interface Target {
  x: number;
  y: number;
  radius: number;
  /** Pixels per second; negative moves up. */
  speed: number;
}

export interface Ball {
  x: number;
  y: number;
  /** Where the ball is aimed, and lands. */
  toX: number;
  toY: number;
}

export interface Splash {
  age: number;
}

export interface DunkTankState {
  target: Target;
  ball: Ball | null;
  ballsLeft: number;
  /** Seconds until the clown is back on the plank; 0 while sitting. */
  dunked: number;
  splash: Splash | null;
  /** Points from the last throw, for the label on screen. */
  lastPoints: number | null;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): DunkTankState {
  return {
    target: {
      x: TARGET_TRACK.x,
      y: (TARGET_TRACK.top + TARGET_TRACK.bottom) / 2,
      radius: TARGET_TRACK.radius,
      speed: TARGET_TRACK.speed,
    },
    ball: null,
    ballsLeft: BALLS_PER_ROUND,
    dunked: 0,
    splash: null,
    lastPoints: null,
    score: 0,
    phase: 'playing',
  };
}

/** Slides the target along its track by `dt` seconds, bouncing at each end. */
export function moveTarget(target: Target, dt: number): void {
  target.y += target.speed * dt;
  if (target.y < TARGET_TRACK.top) {
    target.y = TARGET_TRACK.top + (TARGET_TRACK.top - target.y);
    target.speed = Math.abs(target.speed);
  } else if (target.y > TARGET_TRACK.bottom) {
    target.y = TARGET_TRACK.bottom - (target.y - TARGET_TRACK.bottom);
    target.speed = -Math.abs(target.speed);
  }
}

export function isHit(x: number, y: number, target: Target): boolean {
  return Math.hypot(x - target.x, y - target.y) <= target.radius;
}

/**
 * Points for a ball landing at (x, y): 30 in the inner third of the target,
 * 20 in the middle third, 10 in the outer third and 0 for a miss.
 */
export function scoreForThrow(x: number, y: number, target: Target): number {
  const distance = Math.hypot(x - target.x, y - target.y) / target.radius;
  if (distance <= 1 / 3) return 30;
  if (distance <= 2 / 3) return 20;
  if (distance <= 1) return 10;
  return 0;
}

/** Throws a ball at the aim point. Returns false if no ball was thrown. */
export function throwBall(state: DunkTankState, aimX: number, aimY: number): boolean {
  if (state.phase !== 'playing' || state.ballsLeft === 0) return false;
  if (state.ball || state.dunked > 0) return false;
  state.ball = { x: THROWER.x, y: THROWER.y, toX: aimX, toY: aimY };
  state.ballsLeft -= 1;
  return true;
}

/** Scores a ball landing at (x, y): a hit dunks the clown and speeds up the target. */
export function land(state: DunkTankState, x: number, y: number): number {
  const points = scoreForThrow(x, y, state.target);
  state.lastPoints = points;
  if (points > 0) {
    state.score += points;
    state.dunked = CLIMB_TIME;
    state.splash = { age: 0 };
    state.target.speed *= SPEED_UP;
  }
  return points;
}

/** Advances the game by `dt` seconds. */
export function step(state: DunkTankState, dt: number): void {
  moveTarget(state.target, dt);

  const ball = state.ball;
  if (ball) {
    const dx = ball.toX - ball.x;
    const dy = ball.toY - ball.y;
    const distance = Math.hypot(dx, dy);
    const travel = BALL_SPEED * dt;
    if (travel >= distance) {
      state.ball = null;
      land(state, ball.toX, ball.toY);
    } else {
      ball.x += (dx / distance) * travel;
      ball.y += (dy / distance) * travel;
    }
  }

  state.dunked = Math.max(0, state.dunked - dt);
  if (state.splash) {
    state.splash.age += dt;
    if (state.splash.age >= 0.6) state.splash = null;
  }

  if (state.ballsLeft === 0 && !state.ball && state.dunked === 0) state.phase = 'over';
}

function drawClown(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const { colors } = theme;
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(x - 16, y - 36, 32, 36);
  ctx.fillStyle = colors.stripeB;
  ctx.beginPath();
  ctx.arc(x, y - 52, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.danger;
  ctx.beginPath();
  ctx.arc(x, y - 50, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 64);
  ctx.lineTo(x + 12, y - 64);
  ctx.lineTo(x, y - 90);
  ctx.closePath();
  ctx.fill();
}

function draw(ctx: CanvasRenderingContext2D, state: DunkTankState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The target's track and the arm that links it to the plank.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(
    TARGET_TRACK.x - 4,
    TARGET_TRACK.top - 20,
    8,
    TARGET_TRACK.bottom - TARGET_TRACK.top + 40,
  );
  ctx.fillRect(TARGET_TRACK.x, PLANK_Y - 40, TANK.x - TARGET_TRACK.x, 6);

  const { target } = state;
  const rings = [colors.stripeA, colors.stripeB, colors.stripeA];
  rings.forEach((colour, i) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(target.x, target.y, (target.radius * (3 - i)) / 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // The tank, with the clown on the plank or in the water.
  const climb = state.dunked / CLIMB_TIME;
  const clownY = PLANK_Y + climb * (TANK.y + 80 - PLANK_Y);
  ctx.fillStyle = colors.wood;
  ctx.fillRect(TANK.x, PLANK_Y, state.dunked > 0 ? 40 : TANK.width - 30, 8);
  drawClown(ctx, TANK.x + TANK.width / 2, clownY);
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = colors.water;
  ctx.fillRect(TANK.x, TANK.y, TANK.width, TANK.height);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 4;
  ctx.strokeRect(TANK.x, TANK.y, TANK.width, TANK.height);

  if (state.splash) {
    const age = state.splash.age;
    ctx.strokeStyle = colors.water;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 1 - age / 0.6;
    ctx.beginPath();
    ctx.arc(TANK.x + TANK.width / 2, TANK.y, 20 + age * 160, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Thrower and the ball.
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(THROWER.x, THROWER.y, 22, 0, Math.PI * 2);
  ctx.fill();
  if (state.ball) {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aim marker.
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, 12, 0, Math.PI * 2);
  ctx.moveTo(aim.x - 18, aim.y);
  ctx.lineTo(aim.x + 18, aim.y);
  ctx.moveTo(aim.x, aim.y - 18);
  ctx.lineTo(aim.x, aim.y + 18);
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 160, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Balls ${state.ballsLeft}/${BALLS_PER_ROUND}`, TANK.x - 20, HEIGHT - 20);
  if (state.lastPoints !== null) {
    ctx.textAlign = 'left';
    ctx.fillStyle = state.lastPoints > 0 ? colors.accent : colors.muted;
    ctx.fillText(state.lastPoints > 0 ? `Dunk! +${state.lastPoints}` : 'Miss', 16, 70);
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of balls! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const dunkTank: CarnivalGame = {
  id: 'dunk-tank',
  name: 'Dunk Tank',
  description: 'Hit the sliding target to drop the clown in the water. Bullseyes score more.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim: { x: number; y: number } = {
      x: TARGET_TRACK.x,
      y: (TARGET_TRACK.top + TARGET_TRACK.bottom) / 2,
    };
    const held = new Set<string>();

    const throwOrRestart = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        throwBall(state, aim.x, aim.y);
      }
    };
    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(aim, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(aim, toCanvas(event));
      throwOrRestart();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) throwOrRestart();
      } else if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        held.add(event.key);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => held.delete(event.key);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      const dx = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
      const dy = (held.has('ArrowDown') ? 1 : 0) - (held.has('ArrowUp') ? 1 : 0);
      aim.x = Math.min(WIDTH, Math.max(0, aim.x + dx * AIM_SPEED * dt));
      aim.y = Math.min(HEIGHT, Math.max(0, aim.y + dy * AIM_SPEED * dt));
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(dunkTank.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, aim);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  },
};

export default dunkTank;
