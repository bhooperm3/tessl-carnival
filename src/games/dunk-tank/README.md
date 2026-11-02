# Dunk Tank

A clown sits on a plank over a tank of water. Hit the round target beside the
tank and the clown drops in with a splash.

## How to play

- Aim with the mouse, or hold the arrow keys to move the aim marker.
- Throw a ball with a click, a tap or the space bar. The ball lands where you aimed.
- The target slides up and down on its own, and gets 25% faster after every dunk.
- After a dunk, the clown climbs back onto the plank before you can throw again.
- A round is 6 balls. Click or press space on the game over screen to play again.

## Scoring

Each ball scores by how close to the target's centre it lands:

| Where it lands             | Points |
| -------------------------- | ------ |
| Inner third of the target  | 30     |
| Middle third of the target | 20     |
| Outer third of the target  | 10     |
| Off the target             | 0      |

Your score is the total of the 6 balls, and is saved to the carnival's score
board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `moveTarget`, `isHit`,
  `scoreForThrow`, `throwBall`, `land`, `step`) and the `dunkTank` entry, the
  default export the midway finds.
- `game.test.ts`: tests for the game logic.
