# Water Cannon

Soak the targets on the three rails before your tank runs dry.

## How to play

- The game opens on its title screen, which swaps with the Top 10 leaderboard
  every 5 seconds. Click either one to start a round.
- Move the mouse to aim the cannon, and click to fire a burst of water.
- You have 15 bursts in the tank. The round ends when the tank is empty and the
  last droplet has landed.

## Aiming with the arc

Water falls. Every droplet leaves the barrel at 700 px/s and gravity pulls it
down at 400 px/s², so it flies in a curve that bends towards the ground. Aim at
a near target and the water lands close to where you point; aim at a far one,
such as a target at the end of the top rail, and the water drops below it. Aim
above a far target to land on it. There is no aiming guide: the barrel shows the
direction you fire, and judging the arc is the skill. A droplet that falls back
below the cannon, or leaves the side of the screen, is gone. One fired higher
than the top of the screen falls back into view.

## The burst

One click fires a short burst of 4 to 6 droplets, each a little off your aim,
and uses one unit of water however many droplets it has. Each droplet stops at
the first target it touches, so a lower target can block a burst aimed at a
higher rail. A burst scores each target at most once, but its droplets can soak
two or more different targets. A hit throws a splash of droplets that fall and
fade; splash droplets are only for show and never score or move a target.

## After a round

- **You make the top 10:** the game shows "New high score! Enter your name",
  your score, a text box and a countdown from 30 seconds. Type a name (up to 12
  letters, digits, spaces, `-`, `'` or `.`; other characters are ignored) and
  press Enter to save it and go back to the title. Enter on an empty box does
  nothing. When the countdown reaches 0, the score is saved with whatever you
  typed, or with no name, which the leaderboard shows as `???`. Leaving the
  game during name entry, for example through "Back to the midway", saves the
  score the same way. Clicks on the game do nothing while you enter a name.
- **You don't make the top 10:** the score is saved straight away with no
  name, and "Tank empty! You scored N" shows for 3 seconds before the title
  comes back. Clicks do nothing during those 3 seconds.

A score makes the top 10 when it is strictly higher than the 10th place score,
or always while the board has fewer than 10 scores. A score that ties 10th
place doesn't make it.

## The leaderboard

The Top 10 screen lists rank, name and score, highest score first. Ranks are
dense: equal scores share a rank and the next score takes the next rank, so
120, 120, 90 rank 1, 1, 2. On a tie the oldest score lists first. With no
scores yet, it says "No scores yet. Be the first!".

## Scoring

Each target scores 10 points for every 60 px/s of speed, rounded up:

| Rail   | Speed    | Points |
| ------ | -------- | ------ |
| Top    | 180 px/s | 30     |
| Middle | 120 px/s | 20     |
| Bottom | 60 px/s  | 10     |

Each round saves its final score to the carnival's score board once, when the
round ends, when its name is entered, or when you leave during name entry.
The screen timers count real seconds, so they last as long as they say even
when frames are slow.

## Options

Add `?shots=25` to the page URL to change the size of the tank, for example
`http://localhost:5173/?shots=25#/play/water-cannon`.

## Testing

In development (`npm run dev`), `?seedScores=` replaces the game's saved
scores, so you can try the leaderboard without playing ten rounds:
`http://localhost:5173/?seedScores=water-cannon:Ada=120,Bob=120,Cy=90#/play/water-cannon`

That board shows 1 Ada 120, 1 Bob 120, 2 Cy 90.

## Files

- `game.ts`: the game logic (`createState`, which takes an optional random
  function for the spread and splashes, `click`, `fire`, `step`, `tick`,
  `stop`, `submitName`, `filterName`, `entryCountdown`, `scoreForHit`) and the
  `waterCannon` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic and the screens.
