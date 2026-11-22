import test from "node:test";
import assert from "node:assert/strict";
import { GoGame } from "../go-engine.js";
import { candidateMoves, chooseCpuMove, levels, suggest } from "../ai.js";

test("all advertised board sizes initialize empty", () => {
  for (const size of [9,13,19]) {
    const g = new GoGame(size,6.5);
    assert.equal(g.board.length,size*size);
    assert.equal(g.turn,1);
  }
});

test("captures surrounded stones and restores them on undo", () => {
  const g = new GoGame(5,6.5);
  for (const [x,y] of [[0,1],[1,1],[1,0],[4,4],[2,1],[3,4],[1,2]])
    assert.equal(g.play(x,y).ok,true);
  assert.equal(g.board[g.index(1,1)],0);
  assert.equal(g.captures[1],1);
  assert.equal(g.undo(),1);
  assert.equal(g.board[g.index(1,1)],2);
  assert.equal(g.captures[1],0);
});

test("forbids suicide and occupied cells", () => {
  const g = new GoGame(5,6.5);
  for (const [x,y] of [[1,0],[0,1],[2,1],[1,2]]) g.board[g.index(x,y)] = 1;
  g.positionKeys=[g.key(g.board)];
  assert.equal(g.simulate(1,1,2).ok,false);
  assert.equal(g.simulate(1,0,2).ok,false);
});

test("forbids repeated board positions", () => {
  const g = new GoGame(9,6.5);
  const next = g.simulate(4,4,1);
  assert.equal(next.ok,true);
  g.positionKeys.push(next.key);
  assert.equal(g.simulate(4,4,1).ok,false);
});

test("two passes finish the game and undo reopens it", () => {
  const g = new GoGame(9);
  g.pass();g.pass();
  assert.equal(g.finished,true);
  assert.equal(g.moves.length,2);
  assert.equal(g.undo(1),1);
  assert.equal(g.finished,false);
  assert.equal(g.passes,1);
});

test("territory score counts manual dead stones and komi", () => {
  const g = new GoGame(5,6.5);
  g.board.fill(1);
  g.board[g.index(1,1)]=0;
  g.board[g.index(3,3)]=2;
  const score=g.score();
  assert.equal(score.territories[1],1);
  assert.equal(score.white,6.5);
  const corrected=g.score(new Set([g.index(3,3)]));
  assert.equal(corrected.prisoners[1],1);
  assert.equal(corrected.territories[1],2);
});

test("game state persists and can be recovered", () => {
  const g = new GoGame(13,5.5);
  g.play(3,3);
  const restored = GoGame.fromJSON(JSON.parse(JSON.stringify(g.toJSON())));
  assert.deepEqual(restored.board,g.board);
  assert.equal(restored.turn,2);
  assert.equal(restored.komi,5.5);
  assert.equal(restored.undo(),1);
  assert.equal(restored.moves.length,0);
});

test("CPU has 17 difficulty presets and returns a legal move", () => {
  assert.equal(levels.length,17);
  for (const size of [9,13,19]) {
    const g=new GoGame(size);
    const move=chooseCpuMove(g,"dan2");
    assert.ok(move);
    assert.equal(g.simulate(move.x,move.y).ok,true);
    const hint=suggest(g);
    assert.equal(g.simulate(hint.x,hint.y).ok,true);
    assert.ok(candidateMoves(g).length>0);
  }
});