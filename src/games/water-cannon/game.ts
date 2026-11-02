import {
  canvasFont,
  leaderboard,
  makesLeaderboard,
  normalizeName,
  recordScore,
  theme,
  type CarnivalGame,
  type LeaderboardRow,
} from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const TANK_SIZE = 15;
export const SHOT_SPEED = 700;
export const CANNON = { x: WIDTH / 2, y: HEIGHT - 30 } as const;
export const TITLE_SECONDS = 5;
export const LEADERBOARD_SECONDS = 5;
export const OVER_SECONDS = 3;
export const ENTRY_SECONDS = 30;
export const NAME_MAX_LENGTH = 12;
/** The countdown turns the accent colour at this many seconds and below. */
export const ENTRY_WARNING_SECONDS = 5;
const RAILS = [
  { y: 110, speed: 180, radius: 22 },
  { y: 200, speed: -120, radius: 28 },
  { y: 290, speed: 60, radius: 34 },
];
const TARGETS_PER_RAIL = 3;

export interface Target {
  x: number;
  y: number;
  radius: number;
  /** Pixels per second; negative moves left. */
  speed: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Splash {
  x: number;
  y: number;
  age: number;
}

export type Phase = 'title' | 'leaderboard' | 'playing' | 'entering' | 'over';

export interface WaterCannonState {
  targets: Target[];
  shots: Shot[];
  splashes: Splash[];
  tank: number;
  score: number;
  phase: Phase;
  /** Seconds spent in the current phase. */
  phaseTime: number;
  /** The name typed so far during `entering`. */
  name: string;
}

/** Where a round's score goes. The game uses the carnival's scores module. */
export interface ScoreSink {
  makesLeaderboard(score: number): boolean;
  record(score: number, name?: string): void;
}

const carnivalScores: ScoreSink = {
  makesLeaderboard: (score) => makesLeaderboard('water-cannon', score),
  record: (score, name) => void recordScore('water-cannon', score, name),
};

export function createState(phase: Phase = 'playing'): WaterCannonState {
  const spacing = WIDTH / TARGETS_PER_RAIL;
  const targets = RAILS.flatMap((rail) =>
    Array.from({ length: TARGETS_PER_RAIL }, (_, i) => ({
      x: spacing * i + spacing / 2,
      y: rail.y,
      radius: rail.radius,
      speed: rail.speed,
    })),
  );
  return {
    targets,
    shots: [],
    splashes: [],
    tank: TANK_SIZE,
    score: 0,
    phase,
    phaseTime: 0,
    name: '',
  };
}

function enter(state: WaterCannonState, phase: Phase): void {
  state.phase = phase;
  state.phaseTime = 0;
}

/** A click on the canvas: starts a round from the title or leaderboard, fires while playing, else nothing. */
export function click(state: WaterCannonState, x: number, y: number): boolean {
  if (state.phase === 'title' || state.phase === 'leaderboard') {
    Object.assign(state, createState('playing'));
    return true;
  }
  return fire(state, x, y);
}

/** Keeps only the characters `normalizeName` allows, so nothing else appears in the box. */
export function filterName(raw: string): string {
  return [...raw]
    .filter((char) => char === ' ' || normalizeName(char) !== '')
    .join('')
    .slice(0, NAME_MAX_LENGTH);
}

/** Whole seconds left to enter a name, from 30 down to 0. */
export function entryCountdown(state: WaterCannonState): number {
  return Math.max(0, Math.ceil(ENTRY_SECONDS - state.phaseTime));
}

/** Enter in the name box. Saves and returns to the title when the name has a visible character. */
export function submitName(state: WaterCannonState, scores: ScoreSink = carnivalScores): boolean {
  if (state.phase !== 'entering' || normalizeName(state.name) === '') return false;
  scores.record(state.score, state.name);
  enter(state, 'title');
  return true;
}

function endRound(state: WaterCannonState, scores: ScoreSink): void {
  if (scores.makesLeaderboard(state.score)) {
    state.name = '';
    enter(state, 'entering');
  } else {
    scores.record(state.score);
    enter(state, 'over');
  }
}

/** Moves between the screens as time passes. */
function advancePhase(state: WaterCannonState, dt: number, scores: ScoreSink): void {
  if (state.phase === 'playing') {
    if (state.tank === 0 && state.shots.length === 0) endRound(state, scores);
    return;
  }
  state.phaseTime += dt;
  if (state.phase === 'title' && state.phaseTime >= TITLE_SECONDS) enter(state, 'leaderboard');
  else if (state.phase === 'leaderboard' && state.phaseTime >= LEADERBOARD_SECONDS) {
    enter(state, 'title');
  } else if (state.phase === 'over' && state.phaseTime >= OVER_SECONDS) enter(state, 'title');
  else if (state.phase === 'entering' && state.phaseTime >= ENTRY_SECONDS) {
    scores.record(state.score, normalizeName(state.name) || undefined);
    enter(state, 'title');
  }
}

/** Faster targets are worth more: 10 points per 60 px/s, rounded up. */
export function scoreForHit(target: Target): number {
  return 10 * Math.ceil(Math.abs(target.speed) / 60);
}

export function isHit(shot: Shot, target: Target): boolean {
  return Math.hypot(shot.x - target.x, shot.y - target.y) <= target.radius;
}

/** Fires one shot of water towards the aim point. Returns false if nothing fired. */
export function fire(state: WaterCannonState, aimX: number, aimY: number): boolean {
  if (state.phase !== 'playing' || state.tank === 0) return false;
  const dx = aimX - CANNON.x;
  const dy = Math.min(aimY - CANNON.y, -1);
  const length = Math.hypot(dx, dy);
  state.shots.push({
    x: CANNON.x,
    y: CANNON.y,
    vx: (dx / length) * SHOT_SPEED,
    vy: (dy / length) * SHOT_SPEED,
  });
  state.tank -= 1;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(
  state: WaterCannonState,
  dt: number,
  scores: ScoreSink = carnivalScores,
): void {
  for (const target of state.targets) {
    target.x += target.speed * dt;
    if (target.x > WIDTH + target.radius) target.x = -target.radius;
    if (target.x < -target.radius) target.x = WIDTH + target.radius;
  }

  const remaining: Shot[] = [];
  for (const shot of state.shots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    const target = state.targets.find((t) => isHit(shot, t));
    if (target) {
      state.score += scoreForHit(target);
      state.splashes.push({ x: target.x, y: target.y, age: 0 });
      // Send the soaked target back to the start of its rail.
      target.x = target.speed > 0 ? -target.radius : WIDTH + target.radius;
    } else if (shot.y > -10 && shot.x > -10 && shot.x < WIDTH + 10) {
      remaining.push(shot);
    }
  }
  state.shots = remaining;

  for (const splash of state.splashes) splash.age += dt;
  state.splashes = state.splashes.filter((s) => s.age < 0.4);

  advancePhase(state, dt, scores);
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: WaterCannonState,
  aim: { x: number; y: number },
  rows: LeaderboardRow[],
) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  for (const rail of RAILS) {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(0, rail.y + rail.radius + 4, WIDTH, 6);
  }

  for (const target of state.targets) {
    ctx.fillStyle = colors.stripeB;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.stripeA;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.stripeB;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#4fc3f7';
  for (const shot of state.shots) {
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = colors.water;
  ctx.lineWidth = 3;
  for (const splash of state.splashes) {
    ctx.globalAlpha = 1 - splash.age / 0.4;
    ctx.beginPath();
    ctx.arc(splash.x, splash.y, 10 + splash.age * 90, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Cannon, pointing at the aim.
  const angle = Math.atan2(Math.min(aim.y - CANNON.y, -1), aim.x - CANNON.x);
  ctx.save();
  ctx.translate(CANNON.x, CANNON.y);
  ctx.rotate(angle);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(0, -8, 46, 16);
  ctx.restore();
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(CANNON.x, CANNON.y, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Water ${state.tank}/${TANK_SIZE}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    drawOverlay(ctx);
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Tank empty! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
  } else if (state.phase === 'entering') {
    drawOverlay(ctx);
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText('New high score! Enter your name', WIDTH / 2, 150);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body', 'bold');
    ctx.fillText(`You scored ${state.score}`, WIDTH / 2, 195);
    const seconds = entryCountdown(state);
    ctx.fillStyle = seconds <= ENTRY_WARNING_SECONDS ? colors.accent : colors.text;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(String(seconds), WIDTH / 2, NAME_BOX.y + NAME_BOX.height + 60);
  } else if (state.phase === 'title') {
    drawOverlay(ctx);
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(waterCannon.name, WIDTH / 2, HEIGHT / 2 - 10);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play', WIDTH / 2, HEIGHT / 2 + 30);
  } else if (state.phase === 'leaderboard') {
    drawOverlay(ctx);
    drawLeaderboard(ctx, rows);
  }
}

/** Where the name box sits on the canvas during `entering`. */
const NAME_BOX = { x: WIDTH / 2 - 140, y: 225, width: 280, height: 48 } as const;

function drawOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = theme.colors.background;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
}

function drawLeaderboard(ctx: CanvasRenderingContext2D, rows: LeaderboardRow[]) {
  const { colors } = theme;
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.accent;
  ctx.font = canvasFont('title', 'bold');
  ctx.fillText('Top 10', WIDTH / 2, 80);

  if (rows.length === 0) {
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('No scores yet. Be the first!', WIDTH / 2, HEIGHT / 2);
    return;
  }

  const left = WIDTH / 2 - 160;
  const right = WIDTH / 2 + 160;
  ctx.font = canvasFont('body', 'bold');
  rows.forEach((row, i) => {
    const y = 125 + i * 32;
    ctx.fillStyle = i === 0 ? colors.accent : colors.text;
    ctx.textAlign = 'left';
    ctx.fillText(String(row.rank), left, y);
    ctx.fillText(row.name, left + 50, y);
    ctx.textAlign = 'right';
    ctx.fillText(String(row.score), right, y);
  });
}

/** The name box: a real input over the canvas, so phones bring up their keyboard. */
function createNameInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = NAME_MAX_LENGTH;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Your name');
  Object.assign(input.style, {
    position: 'fixed',
    boxSizing: 'border-box',
    margin: '0',
    padding: '0 12px',
    textAlign: 'center',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '2px solid var(--color-accent)',
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-family)',
    fontWeight: 'bold',
    outline: 'none',
  });
  return input;
}

function placeNameInput(input: HTMLInputElement, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / WIDTH;
  Object.assign(input.style, {
    left: `${rect.left + NAME_BOX.x * scale}px`,
    top: `${rect.top + NAME_BOX.y * scale}px`,
    width: `${NAME_BOX.width * scale}px`,
    height: `${NAME_BOX.height * scale}px`,
    fontSize: `${theme.font.body * scale}px`,
  });
}

export const waterCannon: CarnivalGame = {
  id: 'water-cannon',
  name: 'Water Cannon',
  description: 'Soak the targets before your tank runs dry. Faster targets score more.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const state = createState('title');
    let rows: LeaderboardRow[] = [];
    let input: HTMLInputElement | undefined;
    const aim = { x: WIDTH / 2, y: 0 };

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
      // A click during name entry must not take the keyboard away from the box.
      if (input) event.preventDefault();
      click(state, aim.x, aim.y);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    const onInput = () => {
      if (!input) return;
      const filtered = filterName(input.value);
      if (filtered !== input.value) input.value = filtered;
      state.name = filtered;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') submitName(state);
    };
    const removeInput = () => {
      if (!input) return;
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeyDown);
      input.remove();
      input = undefined;
    };
    const syncInput = () => {
      if (state.phase !== 'entering') return removeInput();
      if (!input) {
        input = createNameInput();
        input.addEventListener('input', onInput);
        input.addEventListener('keydown', onKeyDown);
        document.body.append(input);
        placeNameInput(input, canvas);
        input.focus();
      }
      placeNameInput(input, canvas);
    };

    let frame = 0;
    let last = performance.now();
    let shownPhase = state.phase;
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'leaderboard' && shownPhase !== 'leaderboard') {
        rows = leaderboard(waterCannon.id);
      }
      shownPhase = state.phase;
      syncInput();
      draw(ctx, state, aim, rows);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      removeInput();
    };
  },
};

export default waterCannon;
