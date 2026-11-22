import test from "node:test";
import assert from "node:assert/strict";
import {GoGame} from "../go-engine.js";
import {candidateMoves, chooseCpuMove, surroundedRegions, levels} from "../ai.js";

function ringBoard(){
  const game=new GoGame(9);
  for(let y=2;y<=6;y++)for(let x=2;x<=6;x++){
    if(x===2||x===6||y===2||y===6)
      game.board[game.index(x,y)]=1;
  }
  game.positionKeys=[game.key(game.board)];
  game.turn=2;
  return game;
}

test("CPU does not re-enter enclosed enemy territory to lose stones",()=>{
  const game=ringBoard();
  const eye=game.index(4,4);
  assert.equal(game.board[eye],0);
  assert.equal(game.simulate(4,4,2).ok,true);
  assert.equal(surroundedRegions(game)[eye],1);
  assert.equal(candidateMoves(game,2).some(m=>m.x===4&&m.y===4),false);
});

test("CPU still sees open outside of ring as valid playable space",()=>{
  const game=ringBoard();
  assert.equal(surroundedRegions(game)[game.index(0,0)],0);
  assert.ok(candidateMoves(game,2).length>=10);
  assert.ok(chooseCpuMove(game,"dan2"));
});

test("CPU never intentionally chooses a one-liberty no-capture suicide trap",()=>{
  const game=new GoGame(9);
  const black=[[3,4],[5,4],[4,3]];
  for(const [x,y] of black)game.board[game.index(x,y)]=1;
  game.positionKeys=[game.key(game.board)];
  game.turn=2;
  const dangerous=game.simulate(4,4,2);
  assert.equal(dangerous.ok,true);
  assert.equal(dangerous.liberties,1);
  assert.equal(dangerous.captured,0);
  assert.equal(candidateMoves(game,2).some(m=>m.x===4&&m.y===4),false);
});

test("strong preset and legal moves work at 9,13,19 intersections",()=>{
  assert.equal(levels.length,17);
  for(const size of [9,13,19]){
    const game=new GoGame(size);
    const move=chooseCpuMove(game,"dan2");
    assert.ok(move);
    assert.equal(game.simulate(move.x,move.y).ok,true);
    assert.ok(move.reason.length>0);
  }
});

test("two CPU levels can play 20 legal turns without getting stuck",()=>{
  const game=new GoGame(9);
  for(let i=0;i<20;i++){
    const choice=chooseCpuMove(game,i%2?"8":"dan2");
    if(!choice){game.pass();continue;}
    assert.equal(game.play(choice.x,choice.y).ok,true);
  }
  assert.equal(game.moves.length,20);
});