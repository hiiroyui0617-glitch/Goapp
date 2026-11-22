import test from "node:test";
import assert from "node:assert/strict";
import {createEffects} from "../effects.js";

test("image cut-in displays matching artwork until voice finishes", async()=>{
  const prior={window:globalThis.window,document:globalThis.document,speech:globalThis.SpeechSynthesisUtterance};
  const classes=new Set(),fields=new Map();
  function make(id){
    const node={hidden:true,src:"",textContent:"",offsetHeight:300,
      classList:{add(...names){names.forEach(n=>classes.add(n));},
        remove(...names){names.forEach(n=>classes.delete(n));},
        toggle(name,value){if(value)classes.add(name);else classes.delete(name);},
        contains(name){return classes.has(name);}}};
    fields.set(id,node);return node;
  }
  const cutin=make("cutin"),art=make("cutinArt");
  for(const id of ["cutinText","cutinSub","cutinLabel"])make(id);
  let spoken=null,finished=0;
  try {
    globalThis.document={getElementById:id=>fields.get(id)};
    globalThis.SpeechSynthesisUtterance=class{
      constructor(text){this.text=text;this.lang="";this.rate=1;this.volume=1;this.pitch=1;}
    };
    globalThis.window={speechSynthesis:{
      getVoices(){return[{lang:"ja-JP",name:"日本語"}];},
      addEventListener(){},cancel(){},
      speak(u){spoken=u;}
    }};
    const effects=createEffects(()=>({volume:80,voice:true,cutin:true}));
    effects.cutin("支持率上昇！","3子を取りました","速報",{kind:"rise",onDone:()=>finished++});
    assert.equal(art.hidden,false);
    assert.equal(art.src,"./assets/cutins/rise.svg");
    assert.equal(cutin.hidden,false);
    assert.equal(classes.has("cutin-visible"),true);
    await new Promise(resolve=>setTimeout(resolve,30)); // IndexedDB miss falls back asynchronously
    assert.ok(spoken,"Device speech should start when there is no custom MP3");
    assert.equal(spoken.text,"支持率上昇！");
    assert.equal(finished,0);
    spoken.onend();
    await new Promise(resolve=>setTimeout(resolve,290));
    assert.equal(finished,1);
    assert.equal(cutin.hidden,true);
    assert.equal(classes.has("cutin-visible"),false);
    effects.stop();
  }finally {
    globalThis.window=prior.window;
    globalThis.document=prior.document;
    globalThis.SpeechSynthesisUtterance=prior.speech;
  }
});
