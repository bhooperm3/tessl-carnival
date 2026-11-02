import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const SHOTS_PER_ROUND = 5;
/** The arrow sweeps between -MAX_ANGLE and MAX_ANGLE degrees; 0 points at the hoop. */
export const MAX_ANGLE = 40;
export const ANGLE_SPEED = 60;
/** The power bar fills from 0 to 1 and empties again, this many times a second. */
export const POWER_SPEED = 0.8;
/** How far back the hoop is from the free-throw spot, in court units. */
export const HOOP_DISTANCE = 300;
/** How far a shot at full power carries. */
export const MAX_RANGE = 400;
export const HOOP_RADIUS = 30;
export const BALL_RADIUS = 12;
export const FLIGHT_TIME = 1;
/** How long the result stays on screen before the next shot. */
export const RESULT_TIME = 0.8;

export const BALL_SPOT = { x: WIDTH / 2, y: HEIGHT - 70 } as const;
export const HOOP = { x: WIDTH / 2, y: 170 } as const;
/** Screen pixels per court unit, for drawing where a shot lands. */
const COURT_SCALE = 0.9;
const ARC_HEIGHT = 220;

export type ShotResult = 'swish' | 'rim' | 'miss';

export interface Flight {
  angle: number;
  power: number;
  result: ShotResult;
  /** Seconds since the shot left the hand. */
  time: number;
}

export interface BasketballState {
  phase: 'angle' | 'power' | 'flying' | 'over';
  angle: number;
  /** 1 while the arrow sweeps right, -1 while it sweeps left. */
  angleDirection: 1 | -1;
  power: number;
  /** 1 while the power bar fills, -1 while it empties. */
  powerDirection: 1 | -1;
  flight: Flight | null;
  results: ShotResult[];
  score: number;
}

export function createState(): BasketballState {
  return {
    phase: 'angle',
    angle: 0,
    angleDirection: 1,
    power: 0,
    powerDirection: 1,
    flight: null,
    results: [],
    score: 0,
  };
}

export function scoreFor(result: ShotResult): number {
  return result === 'swish' ? 3 : result === 'rim' ? 2 : 0;
}

/**
 * Where a shot comes down, relative to the centre of the hoop: `lateral` is to
 * the right, and `depth` is past the hoop (negative is short).
 */
export function landingPoint(angle: number, power: number): { lateral: number; depth: number } {
  return {
    lateral: HOOP_DISTANCE * Math.tan((angle * Math.PI) / 180),
    depth: power * MAX_RANGE - HOOP_DISTANCE,
  };
}

/**
 * A ball that comes down clear of the rim is a swish, one that comes down with
 * its centre inside the rim touches it and drops in, and anything else misses.
 */
export function shotResult(angle: number, power: number): ShotResult {
  const { lateral, depth } = landingPoint(angle, power);
  const distance = Math.hypot(lateral, depth);
  if (distance <= HOOP_RADIUS - BALL_RADIUS) return 'swish';
  if (distance <= HOOP_RADIUS) return 'rim';
  return 'miss';
}

/** Moves a value back and forth between `min` and `max`, bouncing at each end. */
function sweep(
  value: number,
  direction: 1 | -1,
  distance: number,
  min: number,
  max: number,
): [number, 1 | -1] {
  let next = value + direction * distance;
  let nextDirection = direction;
  // Bounce as many times as the distance needs, so a long step stays in range.
  while (next > max || next < min) {
    if (next > max) {
      next = max - (next - max);
      nextDirection = -1;
    } else {
      next = min + (min - next);
      nextDirection = 1;
    }
  }
  return [next, nextDirection];
}

/**
 * The player's click, tap or space: locks the angle, then the power. Returns
 * false if the tap did nothing.
 */
export function tap(state: BasketballState): boolean {
  if (state.phase === 'angle') {
    state.phase = 'power';
    state.power = 0;
    state.powerDirection = 1;
    return true;
  }
  if (state.phase === 'power') {
    state.flight = {
      angle: state.angle,
      power: state.power,
      result: shotResult(state.angle, state.power),
      time: 0,
    };
    state.phase = 'flying';
    return true;
  }
  return false;
}

/** Advances the game by `dt` seconds. */
export function step(state: BasketballState, dt: number): void {
  if (state.phase === 'angle') {
    [state.angle, state.angleDirection] = sweep(
      state.angle,
      state.angleDirection,
      ANGLE_SPEED * dt,
      -MAX_ANGLE,
      MAX_ANGLE,
    );
  } else if (state.phase === 'power') {
    [state.power, state.powerDirection] = sweep(
      state.power,
      state.powerDirection,
      POWER_SPEED * dt,
      0,
      1,
    );
  } else if (state.phase === 'flying' && state.flight) {
    const landed = state.flight.time >= FLIGHT_TIME;
    state.flight.time += dt;
    if (!landed && state.flight.time >= FLIGHT_TIME) {
      state.results.push(state.flight.result);
      state.score += scoreFor(state.flight.result);
    }
    if (state.flight.time >= FLIGHT_TIME + RESULT_TIME) {
      state.flight = null;
      state.phase = state.results.length >= SHOTS_PER_ROUND ? 'over' : 'angle';
    }
  }
}

/** Where the ball is on screen during a flight. */
function ballPosition(flight: Flight): { x: number; y: number } {
  const { lateral, depth } = landingPoint(flight.angle, flight.power);
  const end = { x: HOOP.x + lateral * COURT_SCALE, y: HOOP.y - depth * COURT_SCALE };
  const t = Math.min(flight.time / FLIGHT_TIME, 1);
  const drop = Math.max(flight.time - FLIGHT_TIME, 0);
  // A made shot falls through the net; a miss falls away below where it came down.
  return {
    x: BALL_SPOT.x + (end.x - BALL_SPOT.x) * t,
    y: BALL_SPOT.y + (end.y - BALL_SPOT.y) * t - Math.sin(Math.PI * t) * ARC_HEIGHT + drop * 120,
  };
}

const RESULT_TEXT: Record<ShotResult, string> = {
  swish: 'Swish! +3',
  rim: 'Off the rim and in! +2',
  miss: 'Miss',
};

function draw(ctx: CanvasRenderingContext2D, state: BasketballState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Court floor and free-throw line.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(0, HOOP.y + 40, WIDTH, HEIGHT - HOOP.y - 40);
  ctx.strokeStyle = colors.stripeB;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(BALL_SPOT.x - 120, BALL_SPOT.y + BALL_RADIUS + 6);
  ctx.lineTo(BALL_SPOT.x + 120, BALL_SPOT.y + BALL_RADIUS + 6);
  ctx.stroke();

  // Backboard and hoop.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(HOOP.x - 80, HOOP.y - 100, 160, 100);
  ctx.strokeStyle = colors.stripeB;
  ctx.strokeRect(HOOP.x - 80, HOOP.y - 100, 160, 100);
  ctx.strokeRect(HOOP.x - 30, HOOP.y - 55, 60, 45);

  const flight = state.flight;
  const ball = flight ? ballPosition(flight) : BALL_SPOT;
  const ballBehindRim = flight !== null && flight.time > FLIGHT_TIME && flight.result !== 'miss';
  const drawBall = () => {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  };
  if (ballBehindRim) drawBall();

  // Net, then the rim in front of it.
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(HOOP.x + i * 12, HOOP.y);
    ctx.lineTo(HOOP.x + i * 7, HOOP.y + 40);
    ctx.stroke();
  }
  ctx.strokeStyle = colors.danger;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(HOOP.x, HOOP.y, HOOP_RADIUS, HOOP_RADIUS / 3, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (!ballBehindRim) drawBall();

  // The aiming arrow, while the player picks or has picked an angle.
  if (state.phase === 'angle' || state.phase === 'power') {
    ctx.save();
    ctx.translate(BALL_SPOT.x, BALL_SPOT.y);
    ctx.rotate((state.angle * Math.PI) / 180);
    ctx.strokeStyle = colors.text;
    ctx.fillStyle = colors.text;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -BALL_RADIUS - 6);
    ctx.lineTo(0, -90);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -104);
    ctx.lineTo(-10, -86);
    ctx.lineTo(10, -86);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // The power bar.
  if (state.phase === 'power') {
    const bar = { x: WIDTH - 60, y: HEIGHT - 260, width: 24, height: 200 };
    ctx.fillStyle = colors.surface;
    ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
    ctx.fillStyle = colors.accent;
    const filled = bar.height * state.power;
    ctx.fillRect(bar.x, bar.y + bar.height - filled, bar.width, filled);
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.strokeRect(bar.x, bar.y, bar.width, bar.height);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(
    `Shot ${Math.min(state.results.length + 1, SHOTS_PER_ROUND)}/${SHOTS_PER_ROUND}`,
    WIDTH - 16,
    HEIGHT - 20,
  );

  ctx.textAlign = 'center';
  if (state.phase === 'angle') {
    ctx.fillText('Tap or press space to lock the angle', WIDTH / 2, HEIGHT - 20);
  } else if (state.phase === 'power') {
    ctx.fillText('Tap again to lock the power', WIDTH / 2, HEIGHT - 20);
  } else if (flight && flight.time >= FLIGHT_TIME) {
    ctx.fillStyle = flight.result === 'miss' ? colors.danger : colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(RESULT_TEXT[flight.result], WIDTH / 2, HEIGHT / 2 + 40);
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Final buzzer! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const basketballShot: CarnivalGame = {
  id: 'basketball-shot',
  name: 'Basketball Shot',
  description: 'Lock the angle, lock the power and sink 5 shots. A swish scores 3.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onTap = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        tap(state);
      }
    };
    const onDown = () => onTap();
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (!event.repeat) onTap();
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
        recordScore(basketballShot.id, state.score);
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

export default basketballShot;
