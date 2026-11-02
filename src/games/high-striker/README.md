# High Striker

Test your strength: swing the mallet and send the puck up the tower to ring the
bell.

## How to play

- The needle on the power meter beside the tower sweeps up and down on its own.
- Click, tap or press the space bar to swing the mallet. The puck shoots up the
  tower as high as the needle was when you swung.
- You can't swing again until the puck has come back down.
- The needle sweeps faster on each swing: 0.8 sweeps a second on the first,
  then 0.3 more on each one after.
- A round is 5 swings. Click or press space on the game over screen to play
  another round.

## Scoring

Each swing scores the band the puck reaches. Your score is the total of the 5
swings.

| Band   | Height (bottom 0, top 1) | Points          |
| ------ | ------------------------ | --------------- |
| DING!  | 0.95 and up              | 100, rings bell |
| Mighty | 0.8 to 0.95              | 50              |
| Strong | 0.6 to 0.8               | 30              |
| Fair   | 0.4 to 0.6               | 20              |
| Weak   | 0.2 to 0.4               | 10              |
| Wimpy  | below 0.2                | 5               |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `needlePosition`, `sweepSpeed`,
  `scoreForHeight`, `ringsBell`, `swing`, `step`) and the `highStriker` entry,
  the default export the midway finds.
- `game.test.ts`: tests for the game logic.
