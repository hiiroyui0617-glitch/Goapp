// Per-device voice customization. Audio is stored locally in IndexedDB,
// never uploaded to GitHub or a third-party server by this app.
const DB_NAME="ikan-go-voice-clips-v1";
const STORE="clips";
const SCENES=["rise","fall","win","lose","undo","pass","illegal","hint","score","start","novice"];
export const voiceScenes={
  rise:"支持率上昇", fall:"支持率下落", win:"当選", lose:"遺憾です",
  undo:"記憶にございません", pass:"答弁を差し控えます",
  illegal:"その一手、いかんです", hint:"有識者会議",
  score:"議席集計中", start:"開会", novice:"初心者支援策"
};
function database(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined"){reject(new Error("このブラウザは音声保存に対応していません"));return;}
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("音声保存データベースが開けません"));
  });
}
async function transaction(kind,mode,value){
  if(!SCENES.includes(kind))throw new Error("不正なカットイン名です");
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    const store=tx.objectStore(STORE);
    let req;
    if(mode==="readonly")req=store.get(kind);
    else if(value===null)req=store.delete(kind);
    else req=store.put(value,kind);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("音声データの読み書きに失敗しました"));
    tx.oncomplete=()=>db.close();
  });
}
export async function saveClip(kind,file){
  if(!(file instanceof Blob)||!file.type.startsWith("audio/"))
    throw new Error("音声ファイルを選んでください");
  if(file.size>8*1024*1024)throw new Error("8MB以下の音声を選んでください");
  return transaction(kind,"readwrite",file);
}
export async function loadClip(kind){
  try{return await transaction(kind,"readonly");}catch{return null;}
}
export async function deleteClip(kind){
  return transaction(kind,"readwrite",null);
}
