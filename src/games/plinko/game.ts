import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const CHIPS_PER_ROUND = 5;
/** Slot values from left to right: the middle is worth the most. */
export const SLOT_VALUES = [10, 20, 50, 100, 200, 100, 50, 20, 10] as const;
export const SLOTS = SLOT_VALUES.length;
export const ROWS = 8;
/** The furthest right a chip can be, in half-slot steps from the left edge. */
export const MAX_POSITION = (SLOTS - 1) * 2;
/** Peg rows passed per second while a chip falls. */
const FALL_SPEED = 6;

const SLOT_WIDTH = WIDTH / SLOTS;
const RAIL_Y = 80;
const FIRST_ROW_Y = 120;
const ROW_GAP = 40;
const SLOT_TOP = FIRST_ROW_Y + ROW_GAP * ROWS - 10;
const PEG_RADIUS = 5;
const CHIP_RADIUS = 13;

export interface Chip {
  /** Where the chip is at each peg row and then in its slot, in half-slot steps. */
  path: number[];
  /** How far it has fallen, in steps along the path. */
  progress: number;
}

export interface Landing {
  slot: number;
  value: number;
}

export interface PlinkoState {
  /** The slot the chip on the rail is above, 0 to SLOTS - 1. */
  aim: number;
  chip: Chip | undefined;
  chipsLeft: number;
  landings: Landing[];
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): PlinkoState {
  return {
    aim: Math.floor(SLOTS / 2),
    chip: undefined,
    chipsLeft: CHIPS_PER_ROUND,
    landings: [],
    score: 0,
    phase: 'playing',
  };
}

export function slotValue(slot: number): number {
  return SLOT_VALUES[slot] ?? 0;
}

/**
 * Where a chip dropped above `slot` goes: one bounce per peg row, left when
 * `random()` is below 0.5 and right otherwise. A chip at the edge bounces back
 * off the wall, so it never leaves the board.
 */
export function fallPath(slot: number, random: () => number = Math.random): number[] {
  let position = Math.min(Math.max(Math.round(slot), 0), SLOTS - 1) * 2;
  const path = [position];
  for (let row = 0; row < ROWS; row++) {
    let move = random() < 0.5 ? -1 : 1;
    if (position + move < 0 || position + move > MAX_POSITION) move = -move;
    position += move;
    path.push(position);
  }
  return path;
}

/** The slot at the end of a path. ROWS is even, so it ends on a whole slot. */
export function landingSlot(path: readonly number[]): number {
  return path[path.length - 1] / 2;
}

/** Moves the chip on the rail by `slots`, staying on the board. */
export function moveAim(state: PlinkoState, slots: number): void {
  state.aim = Math.min(Math.max(state.aim + slots, 0), SLOTS - 1);
}

/** Puts the chip on the rail above the slot under canvas position `x`. */
export function aimAt(state: PlinkoState, x: number): void {
  state.aim = Math.min(Math.max(Math.floor(x / SLOT_WIDTH), 0), SLOTS - 1);
}

/** Drops a chip from the rail. Returns false if nothing dropped. */
export function drop(state: PlinkoState, random: () => number = Math.random): boolean {
  if (state.phase !== 'playing' || state.chip || state.chipsLeft === 0) return false;
  state.chip = { path: fallPath(state.aim, random), progress: 0 };
  state.chipsLeft -= 1;
  return true;
}

/** Advances the falling chip by `dt` seconds, scoring it when it lands. */
export function step(state: PlinkoState, dt: number): void {
  const chip = state.chip;
  if (chip) {
    // The path has one more stop than it has bounces: the drop onto the first peg.
    chip.progress += dt * FALL_SPEED;
    if (chip.progress >= chip.path.length) {
      const slot = landingSlot(chip.path);
      const value = slotValue(slot);
      state.landings.push({ slot, value });
      state.score += value;
      state.chip = undefined;
    }
  }
  if (state.chipsLeft === 0 && !state.chip) state.phase = 'over';
}

const xFor = (position: number) => (position / 2 + 0.5) * SLOT_WIDTH;
const rowY = (row: number) => FIRST_ROW_Y + row * ROW_GAP;

/** Where to draw a falling chip: straight down onto the first peg, then peg to peg. */
function chipPoint(chip: Chip): { x: number; y: number } {
  const stops = [
    { x: xFor(chip.path[0]), y: RAIL_Y },
    ...chip.path.map((position, row) => ({
      x: xFor(position),
      y: row < ROWS ? rowY(row) - PEG_RADIUS - CHIP_RADIUS : SLOT_TOP + 30,
    })),
  ];
  const index = Math.min(Math.floor(chip.progress), stops.length - 2);
  const t = Math.min(chip.progress - index, 1);
  const from = stops[index];
  const to = stops[index + 1];
  // A small hop off each peg so the bounce reads on screen.
  const hop = index === 0 ? 0 : Math.sin(t * Math.PI) * 12;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - hop };
}

function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = theme.colors.accent;
  ctx.beginPath();
  ctx.arc(x, y, CHIP_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.colors.stripeA;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, CHIP_RADIUS * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: PlinkoState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The rail the chip slides along.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(0, RAIL_Y + CHIP_RADIUS + 2, WIDTH, 4);

  // Staggered pegs: odd rows sit half a slot over.
  ctx.fillStyle = colors.muted;
  for (let row = 0; row < ROWS; row++) {
    for (let position = row % 2; position <= MAX_POSITION; position += 2) {
      ctx.beginPath();
      ctx.arc(xFor(position), rowY(row), PEG_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Prize slots.
  const lastSlot = state.landings.at(-1)?.slot;
  for (let slot = 0; slot < SLOTS; slot++) {
    ctx.fillStyle = slot === lastSlot && !state.chip ? colors.accent : colors.surface;
    ctx.fillRect(slot * SLOT_WIDTH + 3, SLOT_TOP, SLOT_WIDTH - 6, HEIGHT - SLOT_TOP);
    ctx.fillStyle = slot === lastSlot && !state.chip ? colors.background : colors.text;
    ctx.font = canvasFont('body', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(String(slotValue(slot)), xFor(slot * 2), HEIGHT - 20);
  }
  ctx.fillStyle = colors.wood;
  for (let slot = 0; slot <= SLOTS; slot++) {
    ctx.fillRect(slot * SLOT_WIDTH - 3, SLOT_TOP, 6, HEIGHT - SLOT_TOP);
  }

  if (state.chip) {
    const { x, y } = chipPoint(state.chip);
    drawChip(ctx, x, y);
  } else if (state.phase === 'playing') {
    drawChip(ctx, xFor(state.aim * 2), RAIL_Y);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, 64);
  ctx.textAlign = 'right';
  ctx.fillText(`Chips ${state.chipsLeft}/${CHIPS_PER_ROUND}`, WIDTH - 16, 64);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of chips! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const plinko: CarnivalGame = {
  id: 'plinko',
  name: 'Plinko',
  description: 'Drop 5 chips through the pegs. The middle slots pay the most.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const canvasX = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return ((event.clientX - rect.left) / rect.width) * WIDTH;
    };
    const dropOrRestart = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        drop(state);
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!state.chip) aimAt(state, canvasX(event));
    };
    const onDown = (event: PointerEvent) => {
      if (state.phase === 'playing' && !state.chip) aimAt(state, canvasX(event));
      dropOrRestart();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (!state.chip) moveAim(state, event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) dropOrRestart();
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport the chip.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(plinko.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  },
};

export default plinko;
