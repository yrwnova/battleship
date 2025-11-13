"""Command-line Battleship game against a computer opponent."""
from __future__ import annotations

import random
import string
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Set, Tuple

Coordinate = Tuple[int, int]


BOARD_SIZE = 10
COLUMNS = string.ascii_uppercase[:BOARD_SIZE]
ROWS = [str(i) for i in range(1, BOARD_SIZE + 1)]


@dataclass
class Ship:
    name: str
    length: int
    coordinates: List[Coordinate] = field(default_factory=list)
    hits: Set[Coordinate] = field(default_factory=set)

    def place(self, start: Coordinate, horizontal: bool) -> None:
        row, col = start
        self.coordinates = [
            (row, col + offset) if horizontal else (row + offset, col)
            for offset in range(self.length)
        ]

    @property
    def is_sunk(self) -> bool:
        return set(self.coordinates) == self.hits

    def register_hit(self, coord: Coordinate) -> None:
        if coord in self.coordinates:
            self.hits.add(coord)


class Board:
    def __init__(self) -> None:
        self.ships: Dict[Coordinate, Ship] = {}
        self.misses: Set[Coordinate] = set()
        self.hits: Set[Coordinate] = set()

    def place_ship(self, ship: Ship) -> bool:
        for coord in ship.coordinates:
            if not self._in_bounds(coord) or coord in self.ships:
                return False
        for coord in ship.coordinates:
            self.ships[coord] = ship
        return True

    def receive_attack(self, coord: Coordinate) -> Tuple[bool, Optional[Ship]]:
        if coord in self.hits or coord in self.misses:
            raise ValueError("Coordinate has already been targeted.")

        ship = self.ships.get(coord)
        if ship:
            ship.register_hit(coord)
            self.hits.add(coord)
            return True, ship
        self.misses.add(coord)
        return False, None

    @staticmethod
    def _in_bounds(coord: Coordinate) -> bool:
        row, col = coord
        return 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE

    def has_lost(self) -> bool:
        ships = set(self.ships.values())
        return bool(ships) and all(ship.is_sunk for ship in ships)

    def render(self, reveal_ships: bool = False) -> str:
        grid = [["~" for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        for coord, ship in self.ships.items():
            row, col = coord
            if reveal_ships:
                grid[row][col] = "S"
        for row, col in self.misses:
            grid[row][col] = "o"
        for row, col in self.hits:
            grid[row][col] = "X"

        header = "   " + " ".join(COLUMNS)
        lines = [header]
        for idx, row_cells in enumerate(grid):
            row_label = f"{idx + 1:>2}"
            lines.append(f"{row_label} " + " ".join(row_cells))
        return "\n".join(lines)


class Player:
    def __init__(self, name: str) -> None:
        self.name = name
        self.board = Board()
        self.shots_taken: Set[Coordinate] = set()

    def all_ships_sunk(self) -> bool:
        return self.board.has_lost()

    @property
    def ships(self) -> Sequence[Ship]:
        seen: Dict[str, Ship] = {}
        for ship in self.board.ships.values():
            seen.setdefault(ship.name, ship)
        return list(seen.values())


class HumanPlayer(Player):
    def place_ships(self, ships: Sequence[Tuple[str, int]]) -> None:
        print("It's time to deploy your fleet!")
        print("Enter coordinates in the form 'A5 H' for horizontal or 'C3 V' for vertical placement.")
        print("Type 'random' to let the computer place the rest automatically.\n")

        for index, (name, length) in enumerate(ships):
            ship = Ship(name, length)
            while True:
                user_input = input(f"Place your {name} (length {length}): ").strip().upper()
                if user_input == "RANDOM":
                    self._randomly_place_remaining(ships[index:])
                    return
                try:
                    coord_part, orientation = user_input.split()
                except ValueError:
                    print("Invalid input. Provide coordinate and orientation separated by a space, e.g., 'B4 V'.")
                    continue
                if orientation not in {"H", "V"}:
                    print("Orientation must be 'H' or 'V'.")
                    continue
                coord = parse_coordinate(coord_part)
                if coord is None:
                    print("Invalid coordinate. Use a letter A-J and number 1-10, e.g., 'D6'.")
                    continue
                horizontal = orientation == "H"
                ship.place(coord, horizontal)
                if self.board.place_ship(ship):
                    print(self.board.render(reveal_ships=True))
                    break
                print("Ships cannot overlap or extend beyond the board. Try again.")

    def _randomly_place_remaining(self, ships: Sequence[Tuple[str, int]]) -> None:
        remaining_ships = list(ships)
        for name, length in remaining_ships:
            placed = False
            while not placed:
                row = random.randrange(BOARD_SIZE)
                col = random.randrange(BOARD_SIZE)
                horizontal = random.choice([True, False])
                ship = Ship(name, length)
                ship.place((row, col), horizontal)
                placed = self.board.place_ship(ship)
        print("Fleet deployed randomly:")
        print(self.board.render(reveal_ships=True))

    def take_turn(self, opponent: Player) -> None:
        while True:
            target_input = input("Choose your target (e.g., E7): ").strip().upper()
            coord = parse_coordinate(target_input)
            if coord is None:
                print("Invalid coordinate. Try again.")
                continue
            if coord in self.shots_taken:
                print("You already fired there. Choose another coordinate.")
                continue
            self.shots_taken.add(coord)
            hit, ship = opponent.board.receive_attack(coord)
            if hit:
                print(f"Hit! {ship.name} was struck.")
                if ship.is_sunk:
                    print(f"You sank the enemy {ship.name}!")
            else:
                print("Miss.")
            break


class ComputerPlayer(Player):
    def __init__(self, name: str = "Computer") -> None:
        super().__init__(name)
        self.available_targets: Set[Coordinate] = {(r, c) for r in range(BOARD_SIZE) for c in range(BOARD_SIZE)}
        self.target_queue: List[Coordinate] = []

    def place_ships(self, ships: Sequence[Tuple[str, int]]) -> None:
        for name, length in ships:
            placed = False
            while not placed:
                row = random.randrange(BOARD_SIZE)
                col = random.randrange(BOARD_SIZE)
                horizontal = random.choice([True, False])
                ship = Ship(name, length)
                ship.place((row, col), horizontal)
                placed = self.board.place_ship(ship)

    def take_turn(self, opponent: Player) -> None:
        coord = self._select_target()
        self.shots_taken.add(coord)
        self.available_targets.remove(coord)
        hit, ship = opponent.board.receive_attack(coord)
        print(f"{self.name} fires at {format_coordinate(coord)}...")
        if hit:
            print("It's a hit!")
            self._enqueue_neighbors(coord)
            if ship and ship.is_sunk:
                print(f"{self.name} sunk your {ship.name}!")
                self._clear_queue_for_sunk_ship(ship)
        else:
            print("It splashes into the sea.")

    def _select_target(self) -> Coordinate:
        while self.target_queue:
            coord = self.target_queue.pop(0)
            if coord in self.available_targets:
                return coord
        return random.choice(tuple(self.available_targets))

    def _enqueue_neighbors(self, coord: Coordinate) -> None:
        row, col = coord
        for delta_row, delta_col in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            neighbor = (row + delta_row, col + delta_col)
            if neighbor in self.available_targets and Board._in_bounds(neighbor):
                self.target_queue.append(neighbor)

    def _clear_queue_for_sunk_ship(self, ship: Ship) -> None:
        ship_coords = set(ship.coordinates)
        self.target_queue = [coord for coord in self.target_queue if coord not in ship_coords]


FLEET: Sequence[Tuple[str, int]] = [
    ("Carrier", 5),
    ("Battleship", 4),
    ("Cruiser", 3),
    ("Submarine", 3),
    ("Destroyer", 2),
]


def parse_coordinate(text: str) -> Optional[Coordinate]:
    if len(text) < 2:
        return None
    column_char = text[0]
    row_part = text[1:]
    if column_char not in COLUMNS or row_part not in ROWS:
        return None
    row = int(row_part) - 1
    col = COLUMNS.index(column_char)
    return row, col


def format_coordinate(coord: Coordinate) -> str:
    row, col = coord
    return f"{COLUMNS[col]}{row + 1}"


def setup_game() -> Tuple[HumanPlayer, ComputerPlayer]:
    human = HumanPlayer("Admiral")
    computer = ComputerPlayer()

    human.place_ships(FLEET)
    computer.place_ships(FLEET)
    print("\nEnemy fleet has been deployed. Prepare for battle!\n")
    return human, computer


def display_status(human: HumanPlayer, computer: ComputerPlayer) -> None:
    print("\nYour fleet:")
    print(human.board.render(reveal_ships=True))
    print("\nEnemy waters:")
    print(computer.board.render(reveal_ships=False))


def play_game() -> None:
    human, computer = setup_game()
    turn = 0
    while True:
        display_status(human, computer)
        if turn % 2 == 0:
            print("\nYour turn!")
            human.take_turn(computer)
            if computer.all_ships_sunk():
                print("\nAll enemy ships have been sunk. You win!")
                break
        else:
            print("\nEnemy turn...")
            computer.take_turn(human)
            if human.all_ships_sunk():
                print("\nYour fleet has been destroyed. You lose.")
                break
        turn += 1


def main() -> None:
    print("Welcome to Battleship!")
    print("Sink the enemy fleet before yours is sunk.\n")
    play_game()


if __name__ == "__main__":
    main()
