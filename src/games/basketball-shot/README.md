# Basketball Shot

Sink as many of your 5 shots as you can. The hoop hangs at the back of the
booth, and the ball sits at the free-throw spot.

## How to play

- An arrow sweeps left and right. Click, tap or press space to lock the angle.
- A power bar then fills and empties. Click, tap or press space again to lock
  the power, and the ball flies.
- Straight at the hoop with about three quarters power goes in.
- A round is 5 shots. Click again on the game over screen to play another round.

## Scoring

| Shot                               | Points |
| ---------------------------------- | ------ |
| Swish: clears the rim and drops in | 3      |
| Rim: touches the rim and drops in  | 2      |
| Miss                               | 0      |

Your score is the total of your 5 shots. The result comes from where the ball
comes down: the angle sets how far left or right of the hoop, and the power how
far short or long. A ball that comes down fully inside the rim is a swish, one
whose centre is inside the rim is a rim shot, and anything else misses.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `tap`, `step`, `shotResult`,
  `scoreFor`) and the `basketballShot` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
