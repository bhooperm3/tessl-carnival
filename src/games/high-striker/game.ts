import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const SWINGS_PER_ROUND = 5;
/** Needle sweeps per second (bottom to top) on the first swing. */
export const BASE_SWEEP_SPEED = 0.8;
/** How much faster the needle sweeps on each later swing. */
export const SWEEP_SPEED_STEP = 0.3;
/** Seconds the puck takes to rise and fall back. */
export const PUCK_TIME = 1;
const BELL_TIME = 0.8;

/** Score bands up the tower, from the top down. A height at or above `from` lands in the band. */
export const BANDS = [
  { from: 0.95, points: 100, label: 'DING!' },
  { from: 0.8, points: 50, label: 'Mighty' },
  { from: 0.6, points: 30, label: 'Strong' },
  { from: 0.4, points: 20, label: 'Fair' },
  { from: 0.2, points: 10, label: 'Weak' },
  { from: 0, points: 5, label: 'Wimpy' },
] as const;

export interface Puck {
  /** How high the swing sends the puck, from 0 (bottom) to 1 (the bell). */
  height: number;
  age: number;
}

export interface HighStrikerState {
  /** Sweeps travelled by the needle this swing; the needle's position comes from it. */
  sweep: number;
  /** The points scored by each swing so far. */
  swings: number[];
  puck: Puck | null;
  bell: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): HighStrikerState {
  return { sweep: 0, swings: [], puck: null, bell: 0, score: 0, phase: 'playing' };
}

/** Needle sweeps per second for a swing, counting from 0. Faster each swing. */
export function sweepSpeed(swing: number): number {
  return BASE_SWEEP_SPEED + SWEEP_SPEED_STEP * swing;
}

/** The needle's position, from 0 to 1, after `sweep` sweeps: up, then down, then up again. */
export function needlePosition(sweep: number): number {
  const p = ((sweep % 2) + 2) % 2;
  return p <= 1 ? p : 2 - p;
}

export function bandFor(height: number) {
  return BANDS.find((band) => height >= band.from) ?? BANDS[BANDS.length - 1];
}

export function scoreForHeight(height: number): number {
  return bandFor(height).points;
}

export function ringsBell(height: number): boolean {
  return height >= BANDS[0].from;
}

/** Swings the mallet at the needle's current position. Returns false if no swing happened. */
export function swing(state: HighStrikerState): boolean {
  if (state.phase !== 'playing' || state.puck || state.swings.length >= SWINGS_PER_ROUND) {
    return false;
  }
  const height = needlePosition(state.sweep);
  const points = scoreForHeight(height);
  state.swings.push(points);
  state.score += points;
  state.puck = { height, age: 0 };
  if (ringsBell(height)) state.bell = BELL_TIME;
  state.sweep = 0;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: HighStrikerState, dt: number): void {
  if (state.phase !== 'playing') return;
  state.bell = Math.max(0, state.bell - dt);
  if (state.puck) {
    state.puck.age += dt;
    if (state.puck.age >= PUCK_TIME) state.puck = null;
  } else {
    state.sweep += sweepSpeed(state.swings.length) * dt;
  }
  if (state.swings.length >= SWINGS_PER_ROUND && !state.puck) state.phase = 'over';
}

/** How high the puck is drawn: up to its height in the first half, back down in the second. */
function puckHeight(puck: Puck): number {
  const t = Math.min(puck.age / PUCK_TIME, 1);
  return puck.height * Math.sin(t * Math.PI);
}

const TOWER = { x: 340, top: 110, bottom: 440, width: 60 } as const;
const METER = { x: 560, top: 110, bottom: 440, width: 40 } as const;
const towerY = (height: number) => TOWER.bottom - height * (TOWER.bottom - TOWER.top);
const meterY = (height: number) => METER.bottom - height * (METER.bottom - METER.top);

function draw(ctx: CanvasRenderingContext2D, state: HighStrikerState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Tower, with its bands and their labels.
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'right';
  BANDS.forEach((band, i) => {
    const top = i === 0 ? 1 : BANDS[i - 1].from;
    const y = towerY(top);
    ctx.fillStyle = i % 2 === 0 ? colors.surface : colors.wood;
    ctx.fillRect(TOWER.x, y, TOWER.width, towerY(band.from) - y);
    ctx.fillStyle = i === 0 ? colors.accent : colors.muted;
    ctx.fillText(`${band.label} ${band.points}`, TOWER.x - 12, (y + towerY(band.from)) / 2 + 5);
  });

  // Bell, shaking while it rings.
  const shake = state.bell > 0 ? Math.sin(state.bell * 60) * 4 : 0;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(TOWER.x + TOWER.width / 2 + shake, TOWER.top - 14, 22, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(TOWER.x + TOWER.width / 2 - 26 + shake, TOWER.top - 16, 52, 6);
  if (state.bell > 0) {
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.textAlign = 'left';
    ctx.fillText('DING!', TOWER.x + TOWER.width + 20, TOWER.top);
  }

  // Puck.
  if (state.puck) {
    ctx.fillStyle = colors.danger;
    ctx.fillRect(TOWER.x + 8, towerY(puckHeight(state.puck)) - 12, TOWER.width - 16, 12);
  }

  // Base and mallet pad.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(TOWER.x - 30, TOWER.bottom, TOWER.width + 60, 14);

  // Power meter and its needle.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(METER.x, METER.top, METER.width, METER.bottom - METER.top);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(METER.x, METER.top, METER.width, meterY(BANDS[0].from) - METER.top);
  if (!state.puck && state.phase === 'playing') {
    const y = meterY(needlePosition(state.sweep));
    ctx.fillStyle = colors.danger;
    ctx.fillRect(METER.x - 10, y - 3, METER.width + 20, 6);
  }
  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'center';
  ctx.fillText('POWER', METER.x + METER.width / 2, METER.bottom + 30);

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(
    `Swing ${Math.min(state.swings.length + 1, SWINGS_PER_ROUND)}/${SWINGS_PER_ROUND}`,
    WIDTH - 16,
    HEIGHT - 20,
  );

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Five swings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const highStriker: CarnivalGame = {
  id: 'high-striker',
  name: 'High Striker',
  description:
    'Swing the mallet when the power needle peaks and ring the bell. Five swings a round.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const act = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        swing(state);
      }
    };
    const onDown = () => act();
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (!event.repeat) act();
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(highStriker.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  },
};

export default highStriker;
