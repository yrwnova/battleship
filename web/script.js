(() => {
  const BOARD_SIZE = 10;
  const COLUMNS = Array.from({ length: BOARD_SIZE }, (_, idx) =>
    String.fromCharCode(65 + idx)
  );
  const ROWS = Array.from({ length: BOARD_SIZE }, (_, idx) => idx + 1);
  const SHIPS = [
    { name: 'Carrier', length: 5 },
    { name: 'Battleship', length: 4 },
    { name: 'Cruiser', length: 3 },
    { name: 'Submarine', length: 3 },
    { name: 'Destroyer', length: 2 },
  ];

  const playerBoardEl = document.getElementById('player-board');
  const computerBoardEl = document.getElementById('computer-board');
  const orientationToggle = document.getElementById('orientation-toggle');
  const randomPlacementBtn = document.getElementById('random-placement');
  const startButton = document.getElementById('start-game');
  const resetButton = document.getElementById('reset-game');
  const messageEl = document.getElementById('message');
  const shipListEl = document.getElementById('ship-list');
  const placementInstructions = document.getElementById('placement-instructions');

  let placementOrientation = 'horizontal';
  let currentShipIndex = 0;
  let gamePhase = 'placement';
  let isPlayerTurn = true;

  let playerBoard = createEmptyBoard();
  let computerBoard = createEmptyBoard();
  let playerShips = createShipStates();
  let computerShips = createShipStates();
  let playerShots = new Set();
  let computerShots = new Set();
  let computerTargetQueue = [];
  let computerTargetSet = new Set();

  function init() {
    populateLabels();
    createBoard(playerBoardEl);
    createBoard(computerBoardEl);
    wireEvents();
    randomlyPlaceFleet(computerBoard, computerShips);
    updateShipList();
    setMessage('Deploy your fleet to begin.');
  }

  function wireEvents() {
    orientationToggle.addEventListener('click', () => {
      placementOrientation =
        placementOrientation === 'horizontal' ? 'vertical' : 'horizontal';
      const horizontal = placementOrientation === 'horizontal';
      orientationToggle.textContent = `Orientation: ${
        horizontal ? 'Horizontal' : 'Vertical'
      }`;
      orientationToggle.setAttribute('aria-pressed', String(!horizontal));
    });

    randomPlacementBtn.addEventListener('click', () => {
      randomlyPlacePlayerFleet();
      setMessage('Fleet deployed automatically. Press Start Battle to begin.');
    });

    startButton.addEventListener('click', () => {
      if (currentShipIndex < SHIPS.length) {
        setMessage('Place all ships before starting the battle.');
        return;
      }
      startBattle();
    });

    resetButton.addEventListener('click', resetGame);

    playerBoardEl.addEventListener('click', (event) => {
      if (gamePhase !== 'placement') {
        return;
      }
      const cell = event.target.closest('.cell');
      if (!cell) {
        return;
      }
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      placeNextShip(row, col);
    });

    computerBoardEl.addEventListener('click', async (event) => {
      if (gamePhase !== 'battle' || !isPlayerTurn) {
        return;
      }
      const cell = event.target.closest('.cell');
      if (!cell) {
        return;
      }
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      await handlePlayerAttack(row, col);
    });
  }

  function populateLabels() {
    const labelBlocks = document.querySelectorAll('.board-container .labels');
    labelBlocks.forEach((block) => {
      const columnsEl = block.querySelector('.columns');
      const rowsEl = block.querySelector('.rows');
      if (columnsEl) {
        columnsEl.innerHTML = '';
        COLUMNS.forEach((letter) => {
          const span = document.createElement('span');
          span.textContent = letter;
          columnsEl.appendChild(span);
        });
      }
      if (rowsEl) {
        rowsEl.innerHTML = '';
        ROWS.forEach((num) => {
          const span = document.createElement('span');
          span.textContent = num;
          rowsEl.appendChild(span);
        });
      }
    });
  }

  function createBoard(boardEl) {
    boardEl.innerHTML = '';
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        cell.setAttribute('aria-label', `${COLUMNS[col]}${ROWS[row]}`);
        boardEl.appendChild(cell);
      }
    }
  }

  function createEmptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  }

  function createShipStates() {
    return SHIPS.map((ship) => ({
      name: ship.name,
      length: ship.length,
      coordinates: [],
      hits: new Set(),
      sunk: false,
    }));
  }

  function coordKey(row, col) {
    return `${row},${col}`;
  }

  function getShipCoordinates(row, col, length, horizontal) {
    const coordinates = [];
    for (let offset = 0; offset < length; offset += 1) {
      const r = horizontal ? row : row + offset;
      const c = horizontal ? col + offset : col;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
        return null;
      }
      coordinates.push([r, c]);
    }
    return coordinates;
  }

  function placeNextShip(row, col) {
    if (currentShipIndex >= SHIPS.length) {
      return;
    }
    const shipConfig = SHIPS[currentShipIndex];
    const coordinates = getShipCoordinates(
      row,
      col,
      shipConfig.length,
      placementOrientation === 'horizontal'
    );
    if (!coordinates) {
      setMessage('Ship cannot extend beyond the board. Try another position.');
      return;
    }
    if (coordinates.some(([r, c]) => playerBoard[r][c] !== null)) {
      setMessage('Ships cannot overlap. Choose a different position.');
      return;
    }
    coordinates.forEach(([r, c]) => {
      playerBoard[r][c] = currentShipIndex;
    });
    playerShips[currentShipIndex].coordinates = coordinates.map(([r, c]) =>
      coordKey(r, c)
    );
    currentShipIndex += 1;
    if (currentShipIndex === SHIPS.length) {
      startButton.disabled = false;
      placementInstructions.textContent =
        'All ships placed. Press Start Battle to begin the fight.';
      setMessage('Fleet ready! Press Start Battle when you are prepared.');
    } else {
      const nextShip = SHIPS[currentShipIndex];
      placementInstructions.textContent = `Placing ${nextShip.name} (length ${nextShip.length}).`;
      setMessage(
        `Placed ${shipConfig.name}. Next: ${nextShip.name} (length ${nextShip.length}).`
      );
    }
    renderBoards();
    updateShipList();
  }

  function randomlyPlaceFleet(board, ships) {
    ships.forEach((shipState, index) => {
      let placed = false;
      while (!placed) {
        const horizontal = Math.random() < 0.5;
        const startRow = Math.floor(Math.random() * BOARD_SIZE);
        const startCol = Math.floor(Math.random() * BOARD_SIZE);
        const coordinates = getShipCoordinates(
          startRow,
          startCol,
          shipState.length,
          horizontal
        );
        if (!coordinates) {
          continue;
        }
        if (coordinates.some(([r, c]) => board[r][c] !== null)) {
          continue;
        }
        coordinates.forEach(([r, c]) => {
          board[r][c] = index;
        });
        shipState.coordinates = coordinates.map(([r, c]) => coordKey(r, c));
        placed = true;
      }
    });
  }

  function randomlyPlacePlayerFleet() {
    playerBoard = createEmptyBoard();
    playerShips = createShipStates();
    currentShipIndex = SHIPS.length;
    randomlyPlaceFleet(playerBoard, playerShips);
    startButton.disabled = false;
    placementInstructions.textContent =
      'Fleet positioned. Review the layout or start the battle!';
    renderBoards();
    updateShipList();
  }

  function startBattle() {
    gamePhase = 'battle';
    isPlayerTurn = true;
    startButton.disabled = true;
    startButton.textContent = 'Battle Underway';
    orientationToggle.disabled = true;
    randomPlacementBtn.disabled = true;
    placementInstructions.textContent =
      'Battle underway! Target the enemy waters to attack.';
    setMessage('Your turn! Select a coordinate on the enemy board.');
    renderBoards();
    updateShipList();
  }

  async function handlePlayerAttack(row, col) {
    const key = coordKey(row, col);
    if (playerShots.has(key)) {
      setMessage('You have already targeted that coordinate.');
      return;
    }
    playerShots.add(key);
    const shipIndex = computerBoard[row][col];
    let resultMessage;
    if (shipIndex !== null) {
      const ship = computerShips[shipIndex];
      ship.hits.add(key);
      if (ship.hits.size === ship.length) {
        ship.sunk = true;
        resultMessage = `Direct hit! You sank the enemy ${ship.name}.`;
      } else {
        resultMessage = `Hit confirmed on the enemy ${ship.name}!`;
      }
    } else {
      resultMessage = 'Splash! That shot was a miss.';
    }
    renderBoards();
    updateShipList();
    if (computerShips.every((ship) => ship.sunk)) {
      endGame('player');
      return;
    }
    setMessage(resultMessage + ' The enemy is preparing to fire...');
    isPlayerTurn = false;
    renderBoards();
    await delay(700);
    await computerTurn();
  }

  async function computerTurn() {
    if (gamePhase !== 'battle') {
      return;
    }
    const target = chooseComputerTarget();
    if (!target) {
      return;
    }
    const { row, col } = target;
    const key = coordKey(row, col);
    computerShots.add(key);
    const shipIndex = playerBoard[row][col];
    let resultMessage;
    if (shipIndex !== null) {
      const ship = playerShips[shipIndex];
      ship.hits.add(key);
      if (ship.hits.size === ship.length) {
        ship.sunk = true;
        resultMessage = `The enemy has sunk your ${ship.name}!`;
        pruneComputerTargets(ship.coordinates);
      } else {
        resultMessage = `The enemy scored a hit on your ${ship.name}!`;
        enqueueAdjacentTargets(row, col);
      }
    } else {
      resultMessage = 'Enemy missed! The seas are on your side.';
    }
    renderBoards();
    updateShipList();
    if (playerShips.every((ship) => ship.sunk)) {
      endGame('computer');
      return;
    }
    isPlayerTurn = true;
    setMessage(`${resultMessage} Your turn!`);
    renderBoards();
  }

  function chooseComputerTarget() {
    let candidate = dequeueTarget();
    if (!candidate) {
      const available = [];
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
          const key = coordKey(row, col);
          if (!computerShots.has(key)) {
            available.push({ row, col });
          }
        }
      }
      if (available.length === 0) {
        return null;
      }
      candidate = available[Math.floor(Math.random() * available.length)];
    }
    return candidate;
  }

  function enqueueAdjacentTargets(row, col) {
    const deltas = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    deltas.forEach(([dr, dc]) => {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
        return;
      }
      const key = coordKey(r, c);
      if (computerShots.has(key) || computerTargetSet.has(key)) {
        return;
      }
      computerTargetSet.add(key);
      computerTargetQueue.push({ row: r, col: c });
    });
  }

  function dequeueTarget() {
    while (computerTargetQueue.length > 0) {
      const next = computerTargetQueue.shift();
      const key = coordKey(next.row, next.col);
      computerTargetSet.delete(key);
      if (!computerShots.has(key)) {
        return next;
      }
    }
    return null;
  }

  function pruneComputerTargets(coordinates) {
    const keys = new Set(coordinates);
    computerTargetQueue = computerTargetQueue.filter((target) => {
      const key = coordKey(target.row, target.col);
      if (keys.has(key)) {
        computerTargetSet.delete(key);
        return false;
      }
      return true;
    });
  }

  function renderBoards() {
    const playerCells = playerBoardEl.querySelectorAll('.cell');
    playerCells.forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const key = coordKey(row, col);
      cell.classList.remove('ship', 'hit', 'miss', 'sunk');
      if (playerBoard[row][col] !== null) {
        cell.classList.add('ship');
        const ship = playerShips[playerBoard[row][col]];
        if (ship.sunk && ship.coordinates.includes(key)) {
          cell.classList.add('sunk');
        }
      }
      if (computerShots.has(key)) {
        if (playerBoard[row][col] !== null) {
          cell.classList.add('hit');
        } else {
          cell.classList.add('miss');
        }
      }
      cell.disabled = gamePhase !== 'placement';
    });

    const computerCells = computerBoardEl.querySelectorAll('.cell');
    computerCells.forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const key = coordKey(row, col);
      cell.classList.remove('ship', 'hit', 'miss', 'sunk');
      if (playerShots.has(key)) {
        const shipIndex = computerBoard[row][col];
        if (shipIndex !== null) {
          cell.classList.add('hit');
          const ship = computerShips[shipIndex];
          if (ship.sunk && ship.coordinates.includes(key)) {
            cell.classList.add('sunk');
          }
        } else {
          cell.classList.add('miss');
        }
      }
      const disabled =
        gamePhase !== 'battle' || !isPlayerTurn || playerShots.has(key);
      cell.disabled = disabled;
    });
  }

  function updateShipList() {
    shipListEl.innerHTML = '';
    SHIPS.forEach((ship, index) => {
      const item = document.createElement('li');
      item.textContent = ship.name;
      const status = document.createElement('span');
      if (gamePhase === 'placement') {
        if (index < currentShipIndex) {
          status.textContent = 'Placed';
        } else if (index === currentShipIndex) {
          status.textContent = `Place (${ship.length})`;
          item.classList.add('current');
        } else {
          status.textContent = `Awaiting (${ship.length})`;
        }
      } else {
        const shipState = playerShips[index];
        if (shipState.sunk) {
          status.textContent = 'Sunk';
        } else if (shipState.hits.size > 0) {
          status.textContent = 'Damaged';
        } else {
          status.textContent = 'Afloat';
        }
      }
      item.appendChild(status);
      shipListEl.appendChild(item);
    });
  }

  function setMessage(text) {
    messageEl.textContent = text;
  }

  function endGame(winner) {
    gamePhase = 'finished';
    isPlayerTurn = false;
    const victoryMessage =
      winner === 'player'
        ? 'Victory! You have sunk the entire enemy fleet.'
        : 'Defeat. Your fleet has been sunk.';
    setMessage(`${victoryMessage} Reset the game to play again.`);
    renderBoards();
  }

  function resetGame() {
    placementOrientation = 'horizontal';
    orientationToggle.textContent = 'Orientation: Horizontal';
    orientationToggle.setAttribute('aria-pressed', 'false');
    orientationToggle.disabled = false;
    randomPlacementBtn.disabled = false;
    startButton.disabled = true;
    startButton.textContent = 'Start Battle';
    gamePhase = 'placement';
    isPlayerTurn = true;
    currentShipIndex = 0;
    playerBoard = createEmptyBoard();
    computerBoard = createEmptyBoard();
    playerShips = createShipStates();
    computerShips = createShipStates();
    playerShots = new Set();
    computerShots = new Set();
    computerTargetQueue = [];
    computerTargetSet = new Set();
    placementInstructions.textContent =
      'Select an orientation and click on your grid to place each ship.';
    setMessage('Deploy your fleet to begin.');
    randomlyPlaceFleet(computerBoard, computerShips);
    renderBoards();
    updateShipList();
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  init();
})();
