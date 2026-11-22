import test from "node:test";
import assert from "node:assert/strict";
import {createEffects} from "../effects.js";

test("bundled MP3 is played on unlocked WebAudio and cut-in closes at actual audio end", async()=>{
  const original={
    window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,
    SpeechSynthesisUtterance:globalThis.SpeechSynthesisUtterance
  };
  const fields=new Map(),classNames=new Set();
  const make=id=>{
    const x={hidden:true,src:"",textContent:"",offsetHeight:100,
      classList:{
        add(...ns){ns.forEach(n=>classNames.add(n));},
        remove(...ns){ns.forEach(n=>classNames.delete(n));},
        toggle(n,v){v?classNames.add(n):classNames.delete(n);},
        contains(n){return classNames.has(n);}
      }};
    fields.set(id,x);return x;
  };
  make("cutin");make("cutinArt");make("cutinText");make("cutinSub");make("cutinLabel");
  let source=null,fetchUrl="",speechCalls=0,closed=0;
  class FakeAudio {
    constructor(){this.state="running";this.sampleRate=44100;this.destination={};this.currentTime=0;}
    createBuffer(channels,length,rate){return {getChannelData:()=>new Float32Array(length)};}
    createBufferSource(){
      source={buffer:null,onended:null,started:false,connect(){return this;},
        start(){this.started=true;},stop(){},playbackRate:{value:1}};
      return source;
    }
    createGain(){return {gain:{value:0},connect(){return this;}};}
    decodeAudioData(bytes){assert.ok(bytes.byteLength>5);return Promise.resolve({duration:8.1});}
    resume(){this.state="running";return Promise.resolve();}
  }
  try{
    globalThis.document={getElementById:id=>fields.get(id)};
    globalThis.window={
      AudioContext:FakeAudio,
      speechSynthesis:{cancel(){},speak(){speechCalls++;},getVoices(){return[];},addEventListener(){}}
    };
    globalThis.fetch=async url=>{
      fetchUrl=url;
      return {ok:true,blob:async()=>new Blob([new Uint8Array([73,68,51,4,0,0,0,0,0,0])],{type:"audio/mpeg"})};
    };
    const effects=createEffects(()=>({voice:true,cutin:true,volume:70}));
    effects.unlock();
    effects.cutin("支持率上昇！","1子を確保","速報",{kind:"rise",force:true,onDone:()=>closed++});
    // IndexedDB miss + bundled fetch + async MP3 decode all resolve.
    await new Promise(resolve=>setTimeout(resolve,90));
    assert.equal(fetchUrl,"./assets/voices/rise.mp3");
    assert.ok(source?.started,"Bundled Web Audio MP3 should play");
    assert.equal(fields.get("cutin").hidden,false);
    assert.equal(closed,0,"Cut-in must remain while audio plays");
    assert.equal(speechCalls,0,"Real bundled voice must override robotic TTS");
    source.onended();
    await new Promise(resolve=>setTimeout(resolve,310));
    assert.equal(fields.get("cutin").hidden,true);
    assert.equal(closed,1);
    effects.stop();
  }finally{
    globalThis.window=original.window;
    globalThis.document=original.document;
    globalThis.fetch=original.fetch;
    globalThis.SpeechSynthesisUtterance=original.SpeechSynthesisUtterance;
  }
});
