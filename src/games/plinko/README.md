# Plinko

Drop chips through a board of staggered pegs and into the prize slots at the bottom.

## How to play

- Move the chip along the top with the mouse or the left and right arrow keys.
- Click, tap or press the space bar to drop it.
- The chip bounces left or right off each of the 8 rows of pegs until it lands in a slot.
  At the edge of the board it bounces back off the wall.
- A round is 5 chips, dropped one at a time. Click or press space on the game over
  screen to play another round.

## Scoring

Each chip scores the value of the slot it lands in. The middle slots pay the most:

| Slot   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   |
| ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Points | 10  | 20  | 50  | 100 | 200 | 100 | 50  | 20  | 10  |

Your score is the total of your 5 chips, saved to the carnival's score board when the
last chip lands.

## Files

- `game.ts`: the game logic (`createState`, `moveAim`, `aimAt`, `drop`, `step`,
  `fallPath`, `landingSlot`, `slotValue`) and the `plinko` entry, the default export
  the midway finds. `fallPath` and `drop` take a random function, so tests can fix
  the bounces.
- `game.test.ts`: tests for the game logic.
