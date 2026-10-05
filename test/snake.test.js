import { test } from "node:test";
import assert from "node:assert/strict";
// src/snake.js is a plain script so index.html can load it straight from the
// filesystem with no dev server or build step. Importing it here just runs it
// against globalThis, keeping one source of truth for the game rules.
import "../src/snake.js";

const {
  createGame,
  step,
  turn,
  start,
  togglePause,
  restart,
  placeFood,
  occupiesCell,
  isOpposite,
  getStepDelay,
  DIRECTIONS
} = globalThis.Snake;

// Deterministic seed so food placement is predictable in tests.
const fixedSeed = () => 0.5;

function runningGame() {
  const game = createGame({ cols: 10, rows: 10, seed: fixedSeed });
  start(game);
  return game;
}

test("new game is three segments long, facing right, in the middle", () => {
  const game = createGame({ cols: 10, rows: 10, seed: fixedSeed });
  assert.equal(game.snake.length, 3);
  assert.equal(game.direction, "right");
  assert.deepEqual(game.snake[0], { x: 5, y: 5 });
  assert.equal(game.status, "ready");
  assert.equal(game.score, 0);
});

test("rejects boards that are too small", () => {
  assert.throws(() => createGame({ cols: 2, rows: 2 }));
});

test("a step moves the head one cell and drops the tail", () => {
  const game = runningGame();
  const tailBefore = { ...game.snake[game.snake.length - 1] };
  step(game);
  assert.deepEqual(game.snake[0], { x: 6, y: 5 });
  assert.equal(game.snake.length, 3);
  assert.ok(!game.snake.some((p) => p.x === tailBefore.x && p.y === tailBefore.y));
});

test("idle, paused and finished games do not move", () => {
  const game = createGame({ cols: 10, rows: 10, seed: fixedSeed });
  assert.deepEqual(step(game), { moved: false, ate: false, event: "idle" });
  start(game);
  togglePause(game);
  const head = { ...game.snake[0] };
  assert.equal(step(game).event, "idle");
  assert.deepEqual(game.snake[0], head);
  togglePause(game);
  assert.equal(game.status, "running");
});

test("queued turns are applied on the next step", () => {
  const game = runningGame();
  assert.equal(turn(game, "up"), true);
  step(game);
  assert.deepEqual(game.snake[0], { x: 5, y: 4 });
  assert.equal(game.direction, "up");
});

test("the snake cannot reverse into itself", () => {
  const game = runningGame();
  assert.equal(turn(game, "left"), false);
  assert.equal(turn(game, "right"), true);
  assert.equal(turn(game, "diagonal"), false);
  step(game);
  assert.deepEqual(game.snake[0], { x: 6, y: 5 });
});

test("hitting a wall ends the game", () => {
  const game = createGame({ cols: 6, rows: 6, seed: fixedSeed });
  start(game);
  assert.equal(step(game).event, "move"); // head (3,3) -> (4,3)
  assert.equal(step(game).event, "move"); // head       -> (5,3)
  assert.deepEqual(game.snake[0], { x: 5, y: 3 });
  assert.equal(step(game).event, "wall");
  assert.equal(game.status, "over");
  assert.deepEqual(game.snake[0], { x: 5, y: 3 });
});

test("following the tail is allowed because the tail moves away", () => {
  const game = createGame({ cols: 8, rows: 8, seed: fixedSeed });
  start(game);
  // Head at (2,2) moving down onto (2,3), which currently holds the tail.
  game.snake = [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 3, y: 3 },
    { x: 2, y: 3 }
  ];
  game.direction = "down";
  game.nextDirection = "down";
  game.food = { x: 0, y: 0 };
  const result = step(game);
  assert.equal(result.event, "move");
  assert.equal(game.status, "running");
  assert.deepEqual(game.snake[0], { x: 2, y: 3 });
});

test("running into the middle of the body ends the game", () => {
  const game = createGame({ cols: 12, rows: 12, seed: fixedSeed });
  start(game);
  // Spiral whose head, moving right, runs into its own middle at (3,2).
  game.snake = [
    { x: 2, y: 2 },
    { x: 1, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 3, y: 2 },
    { x: 4, y: 2 }
  ];
  game.direction = "right";
  game.nextDirection = "right";
  game.food = { x: 0, y: 0 };
  const result = step(game);
  assert.equal(result.event, "self");
  assert.equal(game.status, "over");
});

test("food is placed on a free cell and never on the snake", () => {
  const game = createGame({ cols: 5, rows: 5, seed: fixedSeed });
  assert.ok(game.food);
  assert.equal(occupiesCell(game, game.food.x, game.food.y), false);

  // Fill the board with the snake: no room left for food.
  game.snake = [];
  for (let y = 0; y < game.rows; y++) {
    for (let x = 0; x < game.cols; x++) game.snake.push({ x, y });
  }
  assert.equal(placeFood(game), null);
});

test("eating food scores a point and grows the snake", () => {
  const game = runningGame();
  game.food = { x: 6, y: 5 };
  const result = step(game);
  assert.equal(result.event, "eat");
  assert.equal(game.score, 1);
  assert.equal(game.snake.length, 4);
  assert.ok(game.food !== null);
});

test("filling the last free cell wins the game", () => {
  const game = createGame({ cols: 4, rows: 4, seed: fixedSeed });
  start(game);
  game.snake = [
    { x: 2, y: 2 },
    { x: 1, y: 2 }
  ];
  game.direction = "right";
  game.nextDirection = "right";
  game.food = { x: 3, y: 2 };
  // Every other cell is body, so eating the food leaves nowhere to place it.
  for (let y = 0; y < game.rows; y++) {
    for (let x = 0; x < game.cols; x++) {
      if (x === 3 && y === 2) continue;
      if (!occupiesCell(game, x, y)) game.snake.push({ x, y });
    }
  }
  assert.equal(game.snake.length, game.cols * game.rows - 1);
  const result = step(game);
  assert.equal(result.event, "won");
  assert.equal(game.score, 1);
  assert.equal(game.status, "won");
  assert.equal(game.food, null);
});

test("step delay shrinks with score and caps at a floor", () => {
  assert.equal(getStepDelay(0), 130);
  assert.ok(getStepDelay(50) < getStepDelay(0));
  assert.equal(getStepDelay(1000), 55);
});

test("isOpposite understands the four cardinal directions", () => {
  assert.equal(isOpposite("up", "down"), true);
  assert.equal(isOpposite("left", "right"), true);
  assert.equal(isOpposite("up", "left"), false);
  assert.equal(isOpposite("nope", "up"), false);
  assert.equal(Object.keys(DIRECTIONS).length, 4);
});

test("restart resets the board but keeps its size", () => {
  const game = runningGame();
  step(game);
  game.score = 7;
  restart(game);
  assert.equal(game.cols, 10);
  assert.equal(game.rows, 10);
  assert.equal(game.score, 0);
  assert.equal(game.status, "ready");
  assert.equal(game.snake.length, 3);
});
