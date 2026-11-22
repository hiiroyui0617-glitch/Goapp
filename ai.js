// Offline Go opponent, version 2.
// Tactical safety, group survival, territory awareness and limited reply search.
// Difficulty labels are presets; no human rank / dan strength is certified.

export const levels = [
  ...Array.from({length:15},(_,i)=>({value:String(15-i),label:(15-i)+"級"})),
  {value:"dan1",label:"初段"},{value:"dan2",label:"二段"}
];
export function levelIndex(level) {
  if(level==="dan2")return 16;
  if(level==="dan1")return 15;
  const n=Number(level);
  return Number.isInteger(n)&&n>=1&&n<=15?15-n:0;
}
function groups(game,board=game.board){
  const array=[], at=Array(board.length).fill(null), seen=new Set();
  for(let i=0;i<board.length;i++){
    if(!board[i]||seen.has(i))continue;
    const g=game.group(board,i);
    g.color=board[i];
    g.stones.forEach(p=>{seen.add(p);at[p]=g;});
    array.push(g);
  }
  return {array,at};
}
// Empty regions with ONLY one bordering color are already surrounded.
// Invasions into such regions are suppressed unless the move captures stones.
// This avoids futile re-entry in captured enemy territory.
export function surroundedRegions(game){
  const size=game.board.length, n=game.size, b=game.board;
  const owner=new Int8Array(size), seen=new Uint8Array(size);
  for(let i=0;i<size;i++){
    if(b[i]||seen[i])continue;
    const todo=[i],borders=new Set(),spots=[],edgeSides=new Set();
    seen[i]=1;
    for(let j=0;j<todo.length;j++){
      const point=todo[j],x=point%n,y=(point/n)|0;
      spots.push(point);
      if(x===0)edgeSides.add("left");
      if(x===n-1)edgeSides.add("right");
      if(y===0)edgeSides.add("top");
      if(y===n-1)edgeSides.add("bottom");
      for(const q of game.neighbors(point)){
        if(b[q]!==0)borders.add(b[q]);
        else if(!seen[q]){seen[q]=1;todo.push(q);}
      }
    }
    // An empty sea covering most of an unplayed board and touching 3-4
    // edges is not a secure, enclosed territory. Do not forbid invasions
    // there just because all currently visible border stones are one color.
    // Only apply the re-entry ban to modest, convincingly enclosed pockets.
    if(borders.size===1 &&
       spots.length<=Math.max(8,Math.floor(size*.28)) &&
       edgeSides.size<=2){
      const val=[...borders][0];
      spots.forEach(p=>{owner[p]=val;});
    }
  }
  return owner;
}

function opening(game,x,y,color,occupied){
  if(occupied.length>Math.max(14,game.size*1.1))return 0;
  const n=game.size,s=n===19?3:n===13?3:2;
  const corners=[[s,s],[n-1-s,s],[s,n-1-s],[n-1-s,n-1-s]];
  const starDist=Math.min(...corners.map(([a,b])=>Math.abs(x-a)+Math.abs(y-b)));
  let result=Math.max(0,12-starDist*2.6);
  const friends=occupied.filter(p=>p.c===color);
  const others=occupied.filter(p=>p.c!==color);
  const mindist=(array)=>array.length?Math.min(...array.map(p=>Math.max(Math.abs(p.x-x),Math.abs(p.y-y)))):99;
  const f=mindist(friends),e=mindist(others);
  if(f<3)result-=Math.max(0,3-f)*5;
  else if(f>=4&&f<=n*.65)result+=3;
  if(e>=4&&e<=8)result+=1.8;
  if(n===9&&occupied.length===0&&x===4&&y===4)result+=5;
  return result;
}
function boardInfluence(game, color, x, y, occupied){
  let score=0;
  for(const stone of occupied){
    const d=(stone.x-x)**2+(stone.y-y)**2;
    score+=(stone.c===color?1:-1)*3.5/Math.pow(1+.32*d,1.65);
  }
  return score;
}
function neighborGroups(game,at,index,color){
  const unique=new Set(),arr=[];
  for(const neighbor of game.neighbors(index)){
    const group=at[neighbor];
    if(group && group.color===color && !unique.has(group)){
      unique.add(group);arr.push(group);
    }
  }
  return arr;
}
function isObviousEye(game,x,y,color){
  const i=game.index(x,y), b=game.board;
  const nn=game.neighbors(i);
  if(nn.length===0||nn.some(p=>b[p]!==color))return false;
  // diagonally cuttable false eyes should not be marked as safe eyes.
  const diagonal=[[x-1,y-1],[x-1,y+1],[x+1,y-1],[x+1,y+1]];
  const inside=diagonal.filter(([a,v])=>game.inside(a,v));
  const opp=inside.filter(([a,v])=>b[game.index(a,v)]===3-color).length;
  return opp <= (nn.length===4?1:0);
}
export function candidateMoves(game,color=game.turn,options={}){
  const n=game.size,b=game.board,cellOwners=surroundedRegions(game);
  const {at}=groups(game),occupied=[];
  for(let i=0;i<b.length;i++)if(b[i])occupied.push({x:i%n,y:(i/n)|0,c:b[i]});
  const moves=[];
  const start=game.moves?.filter(m=>m.type==="play").length||occupied.length;
  const opponent=3-color;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=game.index(x,y);
    if(b[i])continue;
    const sim=game.simulate(x,y,color);
    if(!sim.ok)continue;
    const captures=sim.captured;
    const ownRegion=cellOwners[i]===color, enemyRegion=cellOwners[i]===opponent;
    // No fruitless invasion of completely surrounded enemy territory.
    if(enemyRegion&&captures===0)continue;
    if(!captures&&sim.liberties<=1)continue;
    // Never destroy own secure eye unless needed to capture.
    if(ownRegion&&!captures&&isObviousEye(game,x,y,color))continue;
    const friendly=neighborGroups(game,at,i,color);
    const opposing=neighborGroups(game,at,i,opponent);
    const neighbor=game.neighbors(i),empty=neighbor.filter(p=>!b[p]).length;
    const friendStones=friendly.reduce((a,g)=>a+g.stones.length,0);
    let score=0;
    const localOpp=opposing.reduce((a,g)=>a+g.stones.length,0);
    score+=opening(game,x,y,color,occupied);
    const influence=boardInfluence(game,color,x,y,occupied);
    const phase=Math.min(1,start/(n*n*.42));
    score+=Math.max(-5,Math.min(5,-influence*.8));
    if(!ownRegion&&influence>2.5&&captures===0)score-=7+phase*8;
    if(ownRegion&&captures===0)score-=8+phase*15;
    score+=Math.min(3,empty)*1.05;
    const same=neighbor.filter(p=>b[p]===color).length;
    const enemy=neighbor.filter(p=>b[p]===opponent).length;
    score+=Math.min(same,2)*1.5+Math.min(enemy,2)*2.3;
    // Connection, attacking and saving endangered own stones.
    if(friendly.length>=2)score+=Math.min(12,(friendly.length-1)*5+Math.sqrt(friendStones)*.8);
    let rescued=0;
    for(const g of friendly){
      if(g.liberties.size===1&&g.liberties.has(i)){
        rescued+=g.stones.length;
        if(sim.liberties>=2)score+=19+g.stones.length*7;
        else score-=36;
      }
      else if(g.liberties.size===2&&g.liberties.has(i)&&sim.liberties>=3){
        score+=Math.min(11,g.stones.length*2.4);
      }
    }
    if(captures)score+=24+captures*12;
    for(const g of opposing){
      if(g.liberties.size===1&&g.liberties.has(i)&&captures===0){
        // Usually unreachable except complex shared liberties.
        score+=10;
      } else if(g.liberties.size===2&&g.liberties.has(i)){
        const still=game.group(sim.board,g.stones[0]);
        if(still.liberties.size===1)score+=8+Math.min(16,g.stones.length*3);
      }
    }
    if(sim.liberties===2){
      score-=enemy>=1?12:4;
      if(enemy>=2)score-=6;
    }else if(sim.liberties===3){
      score-=enemy>=2?2.5:0;
    }else score+=Math.min(7,sim.liberties*.65);
    // A move surrounded by enemy stones is likely to be an immediately
    // doomed placement, even if still technically legal.
    if(enemy>=3&&captures===0){
      score-=25;
      if(sim.liberties<=2)score-=35;
    }
    if(enemy===2&&same===0&&sim.liberties<=2&&captures===0)score-=12;
    // Endgame: do not repeatedly place useless stones in owned points.
    if(start>n*n*.5&&enemy===0&&ownRegion&&!captures)score-=25;
    if(occupied.length){
      const nearby=occupied.reduce((min,p)=>Math.min(min,Math.max(Math.abs(p.x-x),Math.abs(p.y-y))),99);
      if(nearby>n/3&&start>20)score-=4;
    }
    let reason=captures?captures+"子を取りにいく手":rescued?"弱い石を助ける手":
      opposing.length?"相手の弱点に働きかける手":friendly.length>=2?"石をつなぐ手":
      start<Math.max(10,n)?"布石と模様を広げる手":"勢力と地を広げる手";
    moves.push({x,y,score,reason,captured:captures,liberties:sim.liberties});
  }
  moves.sort((a,b)=>b.score-a.score);
  return moves;
}
function makeChild(game, move, color){
  const sim=game.simulate(move.x,move.y,color);
  if(!sim.ok)return null;
  const child=new game.constructor(game.size,game.komi);
  child.board=sim.board;
  child.turn=3-color;
  child.positionKeys=[...game.positionKeys,sim.key];
  child.moves=game.moves.concat([{type:"play",x:move.x,y:move.y,color}]);
  child.captures={...game.captures};
  child.captures[color]+=sim.captured;
  return child;
}
function evaluate(game,color){
  const n=game.size,board=game.board,opp=3-color;
  const score=game.captures[color]*11-game.captures[opp]*11;
  let total=score;
  const {array}=groups(game);
  for(const g of array){
    const sign=g.color===color?1:-1;
    const count=g.stones.length,libs=g.liberties.size;
    let life=libs<=1?-12*count:libs===2?-3.5*count:libs===3?-count*.5:Math.min(6,libs)*.6+count*.8;
    total+=sign*(count*1.5+life);
  }
  // Group-aware potential territory. Small empty pockets often belong to
  // one owner even when neither side has placed a stone inside them.
  const owner=surroundedRegions(game);
  for(let i=0;i<board.length;i++)if(!board[i]&&owner[i]){
    total+=owner[i]===color?1.2:-1.2;
  }
  // Discount far-fetched influence. Use a sparse sampling grid to bound work.
  const occupied=[];
  for(let i=0;i<board.length;i++)if(board[i])
    occupied.push({x:i%n,y:(i/n)|0,c:board[i]});
  const stride=n===19?2:1;
  for(let y=0;y<n;y+=stride)for(let x=0;x<n;x+=stride){
    if(board[game.index(x,y)])continue;
    const inf=boardInfluence(game,color,x,y,occupied);
    total+=Math.max(-1,Math.min(1,inf*.32))*stride*stride*.42;
  }
  return total;
}
function rankedWithReplySearch(game,color,moves,level){
  const limit=level>=15?15:level>=12?11:level>=8?7:4;
  const responses=level>=15?5:level>=12?4:level>=8?3:2;
  const before=evaluate(game,color);
  const output=[];
  for(const m of moves.slice(0,limit)){
    const child=makeChild(game,m,color);
    if(!child)continue;
    const ours=evaluate(child,color)-before;
    const enemyMoves=candidateMoves(child,3-color).slice(0,responses);
    let worst=ours;
    for(const reply of enemyMoves){
      const future=makeChild(child,reply,3-color);
      if(!future)continue;
      // Opponent plays the reply that hurts our evaluated position most.
      let next=evaluate(future,color)-before;
      // Losing the stone we just placed the very next move is very bad.
      if(future.board[future.index(m.x,m.y)]!==color)next-=16;
      worst=Math.min(worst,next);
    }
    const tacticalWeight=level>=12?.42:.32;
    output.push({...m,score:m.score*(1-tacticalWeight)+worst*tacticalWeight});
  }
  // Other legal candidates remain available, but receive a search uncertainty
  // penalty so the engine prefers a studied move when scores are close.
  for(const m of moves.slice(limit,Math.min(moves.length,limit+8)))
    output.push({...m,score:m.score*.73-8});
  return output.sort((a,b)=>b.score-a.score);
}
export function suggest(game,color=game.turn){
  return chooseCpuMove(game,"dan2",color,true);
}
export function chooseCpuMove(game,level="15",color=game.turn,deterministic=false){
  const moves=candidateMoves(game,color);
  if(!moves.length)return null;
  const strength=levelIndex(level);
  const quality=strength<3?0:strength<8?1:2;
  const candidates=quality===2?rankedWithReplySearch(game,color,moves,strength):moves;
  const head=candidates[0]?.score??-Infinity;
  // If all remaining moves are truly poor in the middle/endgame, passing is
  // better than mindlessly filling the other side's territory.
  const played=game.moves?.filter(m=>m.type==="play").length||0;
  if(played>game.size*game.size*.50&&head<-13)return null;
  if(deterministic||strength>=15)return candidates[0];
  const noise=(16-strength)/16;
  const pool=candidates.slice(0,Math.min(8,candidates.length));
  const ranking=pool.map(m=>({...m,randomScore:m.score+(Math.random()-.5)*noise*27}));
  ranking.sort((a,b)=>b.randomScore-a.randomScore);
  return ranking[0];
}