// Pure Go rules: liberties, captures, positional superko and Japanese-style scoring.
// Board values: 0 empty, 1 black, 2 white. No external dependencies.
export class GoGame {
  constructor(size = 19, komi = 6.5) {
    this.size = size;
    this.komi = komi;
    this.board = Array(size * size).fill(0);
    this.turn = 1;
    this.captures = {1: 0, 2: 0};
    this.passes = 0;
    this.lastMove = null;
    this.moves = [];
    this.snapshots = [];
    this.positionKeys = [this.key(this.board)];
    this.finished = false;
    this.resigned = null;
  }

  index(x, y) { return y * this.size + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }
  key(board) { return board.join(""); }
  neighbors(index) {
    const x = index % this.size, y = Math.floor(index / this.size);
    const result = [];
    if (x > 0) result.push(index - 1);
    if (x < this.size - 1) result.push(index + 1);
    if (y > 0) result.push(index - this.size);
    if (y < this.size - 1) result.push(index + this.size);
    return result;
  }
  group(board, start) {
    const color = board[start];
    if (!color) return { stones: [], liberties: new Set() };
    const seen = new Set([start]), todo = [start], liberties = new Set();
    for (let i = 0; i < todo.length; i++) {
      for (const neighbor of this.neighbors(todo[i])) {
        if (board[neighbor] === 0) liberties.add(neighbor);
        else if (board[neighbor] === color && !seen.has(neighbor)) {
          seen.add(neighbor);
          todo.push(neighbor);
        }
      }
    }
    return { stones: todo, liberties };
  }

  simulate(x, y, color = this.turn, checkSuperko = true) {
    if (!this.inside(x, y)) return { ok: false, reason: "盤外です。" };
    const index = this.index(x, y);
    if (this.board[index] !== 0) return { ok: false, reason: "そこにはすでに石があります。" };
    const next = this.board.slice();
    next[index] = color;
    let captured = 0;
    const opponent = 3 - color;
    const checked = new Set();
    for (const neighbor of this.neighbors(index)) {
      if (next[neighbor] !== opponent || checked.has(neighbor)) continue;
      const group = this.group(next, neighbor);
      group.stones.forEach(stone => checked.add(stone));
      if (group.liberties.size === 0) {
        group.stones.forEach(stone => { next[stone] = 0; });
        captured += group.stones.length;
      }
    }
    const own = this.group(next, index);
    if (own.liberties.size === 0) return { ok: false, reason: "自殺手は禁止されています。" };
    const key = this.key(next);
    if (checkSuperko && this.positionKeys.includes(key))
      return { ok: false, reason: "コウ：同じ盤面の再現はできません。" };
    return { ok: true, board: next, captured, liberties: own.liberties.size, groupSize: own.stones.length, key };
  }

  saveSnapshot() {
    this.snapshots.push({
      board: this.board.slice(), turn: this.turn,
      captures: {...this.captures}, passes: this.passes,
      lastMove: this.lastMove ? {...this.lastMove} : null,
      moveLength: this.moves.length, keyLength: this.positionKeys.length,
      finished: this.finished, resigned: this.resigned
    });
  }
  play(x, y) {
    if (this.finished) return { ok: false, reason: "終局しています。" };
    const result = this.simulate(x, y);
    if (!result.ok) return result;
    const color = this.turn;
    this.saveSnapshot();
    this.board = result.board;
    this.captures[color] += result.captured;
    this.positionKeys.push(result.key);
    this.moves.push({ type: "play", x, y, color, captured: result.captured });
    this.lastMove = { x, y, color };
    this.passes = 0;
    this.turn = 3 - this.turn;
    return result;
  }
  pass() {
    if (this.finished) return false;
    this.saveSnapshot();
    this.moves.push({ type: "pass", color: this.turn });
    this.lastMove = null;
    this.passes += 1;
    this.turn = 3 - this.turn;
    if (this.passes >= 2) this.finished = true;
    return true;
  }
  undo(count = 1) {
    let undone = 0;
    while (count-- > 0 && this.snapshots.length) {
      const snap = this.snapshots.pop();
      this.board = snap.board;
      this.turn = snap.turn;
      this.captures = snap.captures;
      this.passes = snap.passes;
      this.lastMove = snap.lastMove;
      this.moves.length = snap.moveLength;
      this.positionKeys.length = snap.keyLength;
      this.finished = snap.finished;
      this.resigned = snap.resigned;
      undone++;
    }
    return undone;
  }
  resign() {
    if (this.finished) return false;
    this.saveSnapshot();
    this.resigned = this.turn;
    this.finished = true;
    return true;
  }

  // Marking dead stones is a manual settlement step; the app never silently
  // assumes which living group is dead.
  score(dead = new Set()) {
    const board = this.board.slice();
    const prisoners = {...this.captures};
    for (const index of dead) {
      const stone = board[index];
      if (stone) { prisoners[3 - stone]++; board[index] = 0; }
    }
    const territories = {1: 0, 2: 0};
    const regions = {1: [], 2: [], neutral: []};
    const seen = new Set();
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== 0 || seen.has(i)) continue;
      const region = [], borders = new Set(), pending = [i];
      seen.add(i);
      for (let p = 0; p < pending.length; p++) {
        const current = pending[p];
        region.push(current);
        for (const neighbor of this.neighbors(current)) {
          if (board[neighbor] === 0 && !seen.has(neighbor)) {
            seen.add(neighbor); pending.push(neighbor);
          } else if (board[neighbor] !== 0) borders.add(board[neighbor]);
        }
      }
      if (borders.size === 1) {
        const owner = [...borders][0];
        territories[owner] += region.length;
        regions[owner].push(...region);
      } else regions.neutral.push(...region);
    }
    const black = territories[1] + prisoners[1];
    const white = territories[2] + prisoners[2] + this.komi;
    return { black, white, lead: black - white, territories, prisoners, regions };
  }
  toJSON() {
    return {
      size: this.size, komi: this.komi, board: this.board,
      turn: this.turn, captures: this.captures, passes: this.passes,
      lastMove: this.lastMove, moves: this.moves, snapshots: this.snapshots,
      positionKeys: this.positionKeys, finished: this.finished, resigned: this.resigned
    };
  }
  static fromJSON(raw) {
    if (![9, 13, 19].includes(raw.size) || !Array.isArray(raw.board) ||
        raw.board.length !== raw.size * raw.size ||
        !raw.board.every(n => [0, 1, 2].includes(n))) throw new Error("Invalid saved board");
    const game = new GoGame(raw.size, Number(raw.komi));
    if (!Number.isFinite(game.komi)) throw new Error("Invalid komi");
    game.board = raw.board;
    game.turn = raw.turn === 2 ? 2 : 1;
    game.captures = raw.captures || {1: 0, 2: 0};
    game.passes = raw.passes || 0;
    game.lastMove = raw.lastMove || null;
    game.moves = Array.isArray(raw.moves) ? raw.moves : [];
    game.snapshots = Array.isArray(raw.snapshots) ? raw.snapshots : [];
    game.positionKeys = Array.isArray(raw.positionKeys) && raw.positionKeys.length
      ? raw.positionKeys : [game.key(game.board)];
    game.finished = Boolean(raw.finished);
    game.resigned = raw.resigned || null;
    return game;
  }
}