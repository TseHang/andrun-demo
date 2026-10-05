// Snake game logic — no DOM, no timers.
//
// Written as a plain classic script so index.html can be opened directly from
// the filesystem (no dev server, no build step, no module/CORS issues). It
// attaches itself to globalThis.Snake either way, so Node tests can pull the
// exact same functions in via `import "../src/snake.js"`.
(function (global) {
  "use strict";

  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  function createGame(options) {
    const opts = options || {};
    const cols = opts.cols === undefined ? 20 : opts.cols;
    const rows = opts.rows === undefined ? 20 : opts.rows;
    const seed = opts.seed || Math.random;

    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 4 || rows < 4) {
      throw new Error("Board must be at least 4x4");
    }

    const game = {
      cols: cols,
      rows: rows,
      seed: seed,
      snake: [
        { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
        { x: Math.floor(cols / 2) - 1, y: Math.floor(rows / 2) },
        { x: Math.floor(cols / 2) - 2, y: Math.floor(rows / 2) }
      ],
      direction: "right",
      // Direction the head will actually move on the next step. Turns are
      // buffered here, so two key presses inside one tick can't flip the snake
      // back into itself.
      nextDirection: "right",
      food: null,
      score: 0,
      status: "ready", // ready | running | paused | over | won
      ticks: 0
    };

    game.food = placeFood(game);
    return game;
  }

  function occupiesCell(game, x, y) {
    return game.snake.some(function (part) {
      return part.x === x && part.y === y;
    });
  }

  function placeFood(game) {
    const free = [];
    for (let y = 0; y < game.rows; y++) {
      for (let x = 0; x < game.cols; x++) {
        if (!occupiesCell(game, x, y)) free.push({ x: x, y: y });
      }
    }
    if (free.length === 0) return null;
    const index = Math.min(free.length - 1, Math.floor(game.seed() * free.length));
    return { x: free[index].x, y: free[index].y };
  }

  function isOpposite(a, b) {
    const dirA = DIRECTIONS[a];
    const dirB = DIRECTIONS[b];
    if (!dirA || !dirB) return false;
    return dirA.x + dirB.x === 0 && dirA.y + dirB.y === 0;
  }

  function turn(game, direction) {
    if (!DIRECTIONS[direction]) return false;
    // Reversing straight into the snake's own neck is never allowed.
    if (isOpposite(game.direction, direction)) return false;
    game.nextDirection = direction;
    return true;
  }

  function start(game) {
    if (game.status === "ready" || game.status === "paused") game.status = "running";
    return game.status;
  }

  function togglePause(game) {
    if (game.status === "running") game.status = "paused";
    else if (game.status === "paused") game.status = "running";
    return game.status;
  }

  function restart(game) {
    const fresh = createGame({ cols: game.cols, rows: game.rows, seed: game.seed });
    Object.keys(fresh).forEach(function (key) {
      game[key] = fresh[key];
    });
    return game;
  }

  // Milliseconds between steps: starts at ~7.5 steps/s, caps at ~18 steps/s.
  function getStepDelay(score) {
    return Math.max(55, 130 - Math.floor(score / 5) * 8);
  }

  function step(game) {
    if (game.status !== "running") {
      return { moved: false, ate: false, event: "idle" };
    }

    game.direction = game.nextDirection;
    const dir = DIRECTIONS[game.direction];
    const head = game.snake[0];
    const next = { x: head.x + dir.x, y: head.y + dir.y };

    if (next.x < 0 || next.y < 0 || next.x >= game.cols || next.y >= game.rows) {
      game.status = "over";
      return { moved: false, ate: false, event: "wall" };
    }

    const ate = !!game.food && next.x === game.food.x && next.y === game.food.y;
    // Without food the tail vacates its cell, so following the tail is allowed.
    const body = ate ? game.snake : game.snake.slice(0, -1);
    if (body.some(function (part) { return part.x === next.x && part.y === next.y; })) {
      game.status = "over";
      return { moved: false, ate: false, event: "self" };
    }

    game.snake.unshift(next);
    if (ate) {
      game.score += 1;
      game.food = placeFood(game);
      if (!game.food) {
        game.status = "won";
        return { moved: true, ate: true, event: "won" };
      }
    } else {
      game.snake.pop();
    }

    game.ticks += 1;
    return { moved: true, ate: ate, event: ate ? "eat" : "move" };
  }

  global.Snake = {
    DIRECTIONS: DIRECTIONS,
    createGame: createGame,
    placeFood: placeFood,
    occupiesCell: occupiesCell,
    isOpposite: isOpposite,
    turn: turn,
    start: start,
    togglePause: togglePause,
    restart: restart,
    getStepDelay: getStepDelay,
    step: step
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
