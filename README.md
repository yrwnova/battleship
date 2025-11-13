# Battleship

Command the classic Battleship experience right from your browser. Deploy your fleet, trade volleys with an adaptive computer opponent, and be the first to sink every ship.

## Features

- Playable entirely in Chrome (or any modern browser) with a responsive layout and keyboard-accessible controls.
- Manual ship placement with visual feedback, plus a "Randomly Place Fleet" option for quick deployment.
- Smart-but-fair computer rival that scouts randomly until it finds a hit, then fans out to finish the job.
- Dynamic battle log, fleet status tracking, and clear indicators for hits, misses, and sunk ships.

## Requirements

- A modern desktop browser (Chrome, Firefox, or Edge work great).
- Optional: Python 3.9+ if you'd like to serve the files locally via `http.server`.

## Running the game

1. Open `web/index.html` directly in your browser, **or** start a lightweight static server:

   ```bash
   cd web
   python -m http.server 8000
   ```

2. Visit `http://localhost:8000` in Chrome and follow the on-screen instructions to place your fleet and engage the enemy.

Tip: Use the orientation toggle to switch between horizontal and vertical placement while positioning your ships.
