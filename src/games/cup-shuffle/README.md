# Cup Shuffle

Watch the ball go under a cup, follow it through the shuffle, then pick the cup
that hides it.

## How to play

- Three cups sit in a row. At the start of each level one cup lifts to show the ball.
- The cups then shuffle, swapping places two at a time.
- When the shuffle stops, click or tap the cup you think hides the ball. It lifts
  to show the answer, along with the cup the ball was really under.
- A right pick takes you to the next level. A wrong pick ends the round.
- Click again on the game over screen to play another round.

## Levels

Level 1 shuffles 3 times, and each level after it shuffles 2 more times. Each
swap takes 0.6 seconds at level 1 and 15% less time at every level after it,
down to 0.15 seconds.

## Scoring

Your score is the number of right picks in a row. It is saved to the carnival's
score board when a wrong pick ends the round.

## Files

- `game.ts`: the game logic (`createState`, `levelSettings`, `generateShuffle`,
  `applySwap`, `trackBall`, `pick`, `step`, `slotAt`) and the `cupShuffle` entry,
  the default export the midway finds.
- `game.test.ts`: tests for the game logic.
