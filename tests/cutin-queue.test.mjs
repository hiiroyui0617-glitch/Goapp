import test from "node:test";
import assert from "node:assert/strict";
import {createEffects} from "../effects.js";

test("rapid capture announcements queue rather than truncate ongoing recorded speech",async()=>{
  const original={
    window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,
    SpeechSynthesisUtterance:globalThis.SpeechSynthesisUtterance
  };
  const items=new Map(),classes=new Set(),spoken=[];
  function el(id){
    const item={hidden:true,textContent:"",src:"",offsetHeight:50,
      classList:{
        add(...ns){ns.forEach(n=>classes.add(n));},
        remove(...ns){ns.forEach(n=>classes.delete(n));},
        toggle(n,v){v?classes.add(n):classes.delete(n);},
        contains(n){return classes.has(n);}
      }};
    items.set(id,item);return item;
  }
  for(const id of ["cutin","cutinArt","cutinText","cutinSub","cutinLabel"])el(id);
  let effects=null;
  try{
    globalThis.document={getElementById:id=>items.get(id)};
    globalThis.fetch=async()=>({ok:false});
    globalThis.SpeechSynthesisUtterance=class{
      constructor(text){this.text=text;}
    };
    globalThis.window={speechSynthesis:{
      getVoices(){return[{lang:"ja-JP"}];},
      addEventListener(){},cancel(){},speak(u){spoken.push(u);}
    }};
    effects=createEffects(()=>({cutin:true,voice:true,volume:50}));
    effects.cutin("第一の発表","一手目","会見",{kind:"rise",force:true});
    await new Promise(r=>setTimeout(r,35));
    assert.equal(spoken.length,1);
    effects.cutin("第二の発表","二手目","会見",{kind:"fall",force:true});
    assert.equal(spoken.length,1,"Ongoing audio must not be interrupted");
    assert.equal(items.get("cutinText").textContent,"第一の発表");
    spoken[0].onend();
    await new Promise(r=>setTimeout(r,390));
    assert.equal(spoken.length,2);
    assert.equal(spoken[1].text,"第二の発表");
    assert.equal(items.get("cutinText").textContent,"第二の発表");
    spoken[1].onend();
    await new Promise(r=>setTimeout(r,340));
    assert.equal(items.get("cutin").hidden,true);
  }finally {
    effects?.stop();
    globalThis.window=original.window;
    globalThis.document=original.document;
    globalThis.fetch=original.fetch;
    globalThis.SpeechSynthesisUtterance=original.SpeechSynthesisUtterance;
  }
});