import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const variants={rise:"支持率上昇",fall:"支持率下落",win:"当選",lose:"遺憾です",undo:"記憶にございません"};
test("five original cut-in assets exist with their requested text",()=>{
  for(const [name,headline] of Object.entries(variants)){
    const path="assets/cutins/"+name+".svg";
    const svg=fs.readFileSync(path,"utf8");
    assert.match(svg,/<svg /);
    assert.match(svg,/<\/svg>$/);
    assert.ok(svg.includes(headline));
  }
});
test("offline cache includes all five cut-in assets",()=>{
  const sw=fs.readFileSync("sw.js","utf8");
  for(const name of Object.keys(variants))
    assert.ok(sw.includes("./assets/cutins/"+name+".svg"));
});
test("game page includes current art and voice settings",()=>{
  const html=fs.readFileSync("index.html","utf8");
  assert.match(html,/id="cutinArt"/);
  assert.match(html,/id="voiceInput"/);
  assert.match(html,/id="cutinInput"/);
});
