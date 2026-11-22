import {GoGame} from "./go-engine.js";
import {chooseCpuMove, suggest} from "./ai.js";

// AI runs off the UI thread. Input is a serializable game snapshot.
self.onmessage = ({data}) => {
  const {id,action,level,game:state} = data;
  try {
    const game=GoGame.fromJSON(state);
    const move=action==="hint" ? suggest(game) : chooseCpuMove(game,level);
    self.postMessage({id,ok:true,move});
  } catch (error) {
    self.postMessage({id,ok:false,error:String(error?.message || error)});
  }
};