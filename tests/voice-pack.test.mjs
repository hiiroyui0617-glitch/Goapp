import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {extractVoiceZip, VOICE_SCENE_IDS} from "../voice-clips.js";

// The same bundled, license-compliant ZIP reader used by iPhone Safari.
vm.runInThisContext(readFileSync(new URL("../vendor/jszip.min.js", import.meta.url), "utf8"));
const Zip = globalThis.JSZip;
assert.ok(Zip?.loadAsync, "Bundled JSZip is available");

function syntheticMp3(valid=true) {
  const bytes = new Uint8Array(512);
  if(valid){bytes.set([0x49,0x44,0x33,0x04,0,0,0,0,0,0]);}
  else {bytes.set([0x01,0x02,0x03,0x04]);}
  return bytes;
}
async function pack({missing=null,broken=null,duplicate=false,nested=true}={}) {
  const zip = new Zip();
  for(const id of VOICE_SCENE_IDS) {
    if(missing===id)continue;
    const filename=(id==="pass"?"skip":id)+".mp3";
    zip.file((nested?"voice/":"")+filename,syntheticMp3(broken!==id));
  }
  if(duplicate)zip.file("pass.mp3",syntheticMp3());
  zip.file("README.txt","Original clips. The importer ignores this text.");
  return new Blob([await zip.generateAsync({type:"uint8array",compression:"DEFLATE"})],{type:"application/zip"});
}
test("all eleven voices import from the user's voice/ folder (skip => pass)", async()=>{
  const reports=[];
  const extracted=await extractVoiceZip(await pack(),Zip,(done,total,id)=>reports.push([done,total,id]));
  assert.equal(extracted.length,11);
  assert.deepEqual(extracted.map(x=>x.id),VOICE_SCENE_IDS);
  assert.equal(reports.length,11);
  assert.ok(reports.every(([done,total])=>done>=1 && total===11));
  assert.equal(extracted.find(x=>x.id==="pass").blob.type,"audio/mpeg");
  assert.equal(extracted.find(x=>x.id==="pass").blob.size,512);
});
test("root level pass.mp3 and all eleven MP3s also work", async()=>{
  const zip=new Zip();
  for(const id of VOICE_SCENE_IDS)zip.file(id+".mp3",syntheticMp3());
  const blob=new Blob([await zip.generateAsync({type:"uint8array"})]);
  assert.equal((await extractVoiceZip(blob,Zip)).length,11);
});
test("missing tracks are caught before any persistent write",async()=>{
  await assert.rejects(()=>extractVoiceZip(pack({missing:"score"}).then(x=>x),Zip),/足りない音声/);
});
test("broken track header is rejected",async()=>{
  await assert.rejects(async()=>extractVoiceZip(await pack({broken:"win"}),Zip),/MP3形式/);
});
test("duplicate skip and pass tracks are rejected",async()=>{
  await assert.rejects(async()=>extractVoiceZip(await pack({duplicate:true}),Zip),/重複/);
});
test("overlarge ZIP file is rejected early",async()=>{
  const bloated=new Blob([new Uint8Array(21*1024*1024)]);
  await assert.rejects(async()=>extractVoiceZip(bloated,Zip),/20MB/);
});