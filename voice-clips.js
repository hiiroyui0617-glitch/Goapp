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


export const VOICE_SCENE_IDS=Object.freeze(Object.keys(voiceScenes));
const VOICE_PACK_LIMIT = 20 * 1024 * 1024;
const VOICE_ITEM_LIMIT = 8 * 1024 * 1024;

/** Bulk-import a ZIP with eleven MP3 clips using one atomic IndexedDB write.
 * A previous voice pack remains intact if extraction or validation fails.
 * skip.mp3 is accepted as the user's synonym for pass.mp3.
 */
export async function extractVoiceZip(file, ZipReader, onProgress=()=>{}) {
  if (!file || !(file instanceof Blob)) throw new Error("ZIPファイルを選択してください。");
  if (file.size > VOICE_PACK_LIMIT) throw new Error("ZIPが20MBを超えています。");
  if (!ZipReader?.loadAsync) throw new Error("ZIP読み込み機能が利用できません。ページを再読み込みしてください。");
  const zip=await ZipReader.loadAsync(await file.arrayBuffer(),{checkCRC32:true,createFolders:false});
  const entries=new Map();
  zip.forEach((path,entry)=>{
    if(entry.dir)return;
    const filename=path.split("/").pop()?.toLowerCase()||"";
    if(!filename.endsWith(".mp3"))return;
    let id=filename.slice(0,-4);
    if(id==="skip")id="pass";
    if(!VOICE_SCENE_IDS.includes(id))return;
    if(entries.has(id))throw new Error("音声ファイルが重複しています："+id);
    const expected=Number(entry._data?.uncompressedSize || 0);
    if(expected>VOICE_ITEM_LIMIT)throw new Error(id+"の音声が8MBを超えています。");
    entries.set(id,entry);
  });
  const missing=VOICE_SCENE_IDS.filter(id=>!entries.has(id));
  if(missing.length)throw new Error("足りない音声："+missing.join(", "));
  const decoded=[];
  let total=0,finished=0;
  for(const id of VOICE_SCENE_IDS){
    const bytes=await entries.get(id).async("uint8array");
    if(bytes.length<100||bytes.length>VOICE_ITEM_LIMIT)throw new Error(id+"のMP3が不正です。");
    if (!(bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33) &&
        !(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0))
      throw new Error(id+"はMP3形式ではないようです。");
    total+=bytes.length;
    if(total>VOICE_PACK_LIMIT)throw new Error("音声の総容量が大きすぎます。");
    decoded.push({id,blob:new Blob([bytes],{type:"audio/mpeg"})});
    finished++;
    onProgress(finished,VOICE_SCENE_IDS.length,id);
  }
  return decoded;
}

export async function importVoiceZip(file, onProgress=()=>{}) {
  const reader=typeof window==="undefined" ? null : window.JSZip;
  const decoded=await extractVoiceZip(file,reader,onProgress);
  const db=await database();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    const store=tx.objectStore(STORE);
    for(const entry of decoded)store.put(entry.blob,entry.id);
    tx.oncomplete=()=>{db.close();resolve(decoded.map(v=>v.id));};
    tx.onerror=()=>{db.close();reject(tx.error||new Error("音声の保存に失敗しました。"));};
    tx.onabort=()=>{db.close();reject(tx.error||new Error("音声を保存できませんでした。"));};
  });
}

export async function listRegisteredClips() {
  try{
    const db=await database();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readonly");
      const request=tx.objectStore(STORE).getAllKeys();
      request.onsuccess=()=>resolve(request.result.filter(id=>VOICE_SCENE_IDS.includes(id)));
      request.onerror=()=>reject(request.error);
      tx.oncomplete=()=>db.close();
    });
  }catch{return [];}
}
