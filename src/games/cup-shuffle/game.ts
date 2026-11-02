import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const CUPS = 3;
/** The x of each slot's centre, left to right. */
export const SLOT_X = [WIDTH / 2 - 200, WIDTH / 2, WIDTH / 2 + 200] as const;
const TABLE_Y = 360;
const CUP_WIDTH = 110;
const CUP_HEIGHT = 120;
const BALL_RADIUS = 20;
/** Seconds the ball shows before the shuffle starts. */
export const SHOW_TIME = 1.5;
/** Seconds the picked cup stays lifted before the next level or the end. */
export const REVEAL_TIME = 1.2;

/** A random number in [0, 1), like Math.random. */
export type Random = () => number;

/** Two slots whose cups trade places. */
export type Swap = readonly [number, number];

export interface CupShuffleState {
  level: number;
  /** The slot the ball is under right now. */
  ball: number;
  swaps: Swap[];
  /** Seconds each swap takes at this level. */
  swapDuration: number;
  /** How many swaps of this level's shuffle are done. */
  swapIndex: number;
  /** How far through the current swap, from 0 to 1. */
  swapProgress: number;
  /** Seconds spent in the current showing or revealing phase. */
  timer: number;
  picked: number | null;
  score: number;
  phase: 'showing' | 'shuffling' | 'picking' | 'revealing' | 'over';
  random: Random;
}

/** Each level shuffles two more times than the last, and each swap is quicker. */
export function levelSettings(level: number): { swaps: number; swapDuration: number } {
  return {
    swaps: 3 + 2 * (level - 1),
    swapDuration: Math.max(0.15, 0.6 * 0.85 ** (level - 1)),
  };
}

/** A shuffle of `count` swaps, each between two different slots. */
export function generateShuffle(count: number, random: Random = Math.random): Swap[] {
  return Array.from({ length: count }, () => {
    const a = Math.floor(random() * CUPS);
    const b = (a + 1 + Math.floor(random() * (CUPS - 1))) % CUPS;
    return [a, b] as const;
  });
}

/** Where the ball is after one swap. */
export function applySwap(ball: number, [a, b]: Swap): number {
  if (ball === a) return b;
  if (ball === b) return a;
  return ball;
}

/** Where the ball ends up after every swap, in order. */
export function trackBall(ball: number, swaps: readonly Swap[]): number {
  return swaps.reduce(applySwap, ball);
}

function startLevel(state: CupShuffleState, level: number): void {
  const settings = levelSettings(level);
  state.level = level;
  state.swaps = generateShuffle(settings.swaps, state.random);
  state.swapDuration = settings.swapDuration;
  state.swapIndex = 0;
  state.swapProgress = 0;
  state.timer = 0;
  state.picked = null;
  state.phase = 'showing';
}

export function createState(random: Random = Math.random): CupShuffleState {
  const state: CupShuffleState = {
    level: 1,
    ball: Math.floor(random() * CUPS),
    swaps: [],
    swapDuration: 0,
    swapIndex: 0,
    swapProgress: 0,
    timer: 0,
    picked: null,
    score: 0,
    phase: 'showing',
    random,
  };
  startLevel(state, 1);
  return state;
}

/** Picks the cup in `slot`. Returns false if the cups can't be picked right now. */
export function pick(state: CupShuffleState, slot: number): boolean {
  if (state.phase !== 'picking' || slot < 0 || slot >= CUPS) return false;
  state.picked = slot;
  if (slot === state.ball) state.score += 1;
  state.timer = 0;
  state.phase = 'revealing';
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: CupShuffleState, dt: number): void {
  if (state.phase === 'showing') {
    state.timer += dt;
    if (state.timer >= SHOW_TIME) state.phase = 'shuffling';
  } else if (state.phase === 'shuffling') {
    state.swapProgress += dt / state.swapDuration;
    while (state.swapProgress >= 1 && state.swapIndex < state.swaps.length) {
      state.ball = applySwap(state.ball, state.swaps[state.swapIndex]);
      state.swapIndex += 1;
      state.swapProgress -= 1;
    }
    if (state.swapIndex >= state.swaps.length) {
      state.swapProgress = 0;
      state.phase = 'picking';
    }
  } else if (state.phase === 'revealing') {
    state.timer += dt;
    if (state.timer >= REVEAL_TIME) {
      if (state.picked === state.ball) startLevel(state, state.level + 1);
      else state.phase = 'over';
    }
  }
}

/** The slot of the cup under a point on the canvas, or -1 for none. */
export function slotAt(x: number, y: number): number {
  if (y < TABLE_Y - CUP_HEIGHT - 20 || y > TABLE_Y + 10) return -1;
  return SLOT_X.findIndex((slotX) => Math.abs(x - slotX) <= CUP_WIDTH / 2);
}

/** How high each slot's cup is lifted, from 0 (down) to 1 (fully up). */
function cupLifts(state: CupShuffleState): number[] {
  const lifts = Array.from({ length: CUPS }, () => 0);
  if (state.phase === 'showing') {
    // Up for most of the show, then down just before the shuffle.
    lifts[state.ball] = Math.min(1, Math.max(0, (SHOW_TIME - state.timer) / 0.4));
  } else if ((state.phase === 'revealing' || state.phase === 'over') && state.picked !== null) {
    const lift = state.phase === 'over' ? 1 : Math.min(1, state.timer / 0.25);
    lifts[state.picked] = lift;
    lifts[state.ball] = lift;
  }
  return lifts;
}

/** Where each slot's cup is drawn, moving along an arc while it swaps. */
function cupPositions(state: CupShuffleState): { x: number; y: number }[] {
  const positions = SLOT_X.map((x) => ({ x, y: TABLE_Y }));
  if (state.phase !== 'shuffling' || state.swapIndex >= state.swaps.length) return positions;
  const [a, b] = state.swaps[state.swapIndex];
  const t = state.swapProgress;
  const eased = t * t * (3 - 2 * t);
  const arc = Math.sin(Math.PI * t) * 40;
  positions[a] = { x: SLOT_X[a] + (SLOT_X[b] - SLOT_X[a]) * eased, y: TABLE_Y - arc };
  positions[b] = { x: SLOT_X[b] + (SLOT_X[a] - SLOT_X[b]) * eased, y: TABLE_Y + arc / 2 };
  return positions;
}

function drawCup(ctx: CanvasRenderingContext2D, x: number, y: number, highlight: boolean) {
  const { colors } = theme;
  const top = y - CUP_HEIGHT;
  ctx.fillStyle = colors.stripeA;
  ctx.beginPath();
  ctx.moveTo(x - CUP_WIDTH / 2, y);
  ctx.lineTo(x - CUP_WIDTH / 3, top);
  ctx.lineTo(x + CUP_WIDTH / 3, top);
  ctx.lineTo(x + CUP_WIDTH / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.stripeB;
  ctx.fillRect(x - CUP_WIDTH / 2.6, top + CUP_HEIGHT * 0.45, (CUP_WIDTH / 2.6) * 2, 12);
  if (highlight) {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function draw(ctx: CanvasRenderingContext2D, state: CupShuffleState, hover: number) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  ctx.fillStyle = colors.wood;
  ctx.fillRect(40, TABLE_Y, WIDTH - 80, 18);

  const lifts = cupLifts(state);

  // The ball only shows while its cup is lifted, so a sliding cup never gives it away.
  if (lifts[state.ball] > 0) {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(SLOT_X[state.ball], TABLE_Y - BALL_RADIUS, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  const positions = cupPositions(state);
  for (let slot = 0; slot < CUPS; slot++) {
    const { x, y } = positions[slot];
    drawCup(ctx, x, y - lifts[slot] * 90, state.phase === 'picking' && slot === hover);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Level ${state.level}`, WIDTH - 16, HEIGHT - 20);

  ctx.textAlign = 'center';
  ctx.font = canvasFont('body');
  ctx.fillStyle = colors.muted;
  const hints: Record<CupShuffleState['phase'], string> = {
    showing: 'Watch the ball...',
    shuffling: 'Keep your eye on it!',
    picking: 'Which cup hides the ball?',
    revealing: state.picked === state.ball ? 'Found it!' : 'Not that one!',
    over: '',
  };
  ctx.fillText(hints[state.phase], WIDTH / 2, 90);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Wrong cup! You found it ${state.score} in a row`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const cupShuffle: CarnivalGame = {
  id: 'cup-shuffle',
  name: 'Cup Shuffle',
  description: 'Follow the ball as the cups shuffle, then pick the cup that hides it.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    let hover = -1;

    const slotFor = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return slotAt(
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
    };
    const onMove = (event: PointerEvent) => {
      hover = slotFor(event);
    };
    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        pick(state, slotFor(event));
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the shuffle.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(cupShuffle.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, hover);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default cupShuffle;
