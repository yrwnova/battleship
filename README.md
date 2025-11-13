# Battleship

A faithful command-line adaptation of the classic Battleship board game. Deploy your fleet, take aim, and sink the enemy ships before they destroy yours. Play against a computer opponent that hunts intelligently without feeling unbeatable.

## Features

- Standard 10x10 grid with the traditional fleet: Carrier, Battleship, Cruiser, Submarine, and Destroyer.
- Manual ship placement with validation for overlaps and boundaries, plus an option to deploy the remainder of your fleet automatically.
- Turn-based play against a computer foe that searches at random until it finds a target, then probes the surrounding waters to finish the job.
- Clear visual board rendering that shows hits (`X`), misses (`o`), and your own ships (`S`).

## Requirements

- Python 3.9 or newer (no external dependencies required).

## Running the game

From the project root, launch the game with:

```bash
python -m battleship.game
```

Follow the on-screen prompts to place your fleet and fire on the enemy. Coordinates use the format `A1` through `J10`, with `H` for horizontal and `V` for vertical placement.

Good luck, Admiral!
