import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const expected={
  "fall.mp3":["82386264e493d607e255e111111eecdcf9630f49",117932],
  "hint.mp3":["654e9a9c4445313fec9c3ace5e4b1464b5436564",125037],
  "illegal.mp3":["87c7753d0feaa12b63b56389508f725977551fe4",106647],
  "lose.mp3":["1f43294910071702747a947f3ac548d9498ed30d",117096],
  "novice.mp3":["ed3067c6994874706cc61f0a86b7aefe6494774c",120022],
  "pass.mp3":["984f3f7e0f5c0d54cd0d6fad9cf68d37e7706bd1",136322],
  "rise.mp3":["a710a581bc6f2b8c9f5c536bde82d155c46c66b2",127963],
  "score.mp3":["949e39d886bcf05d72fff0f65c58049f32b29322",126709],
  "start.mp3":["a9aef87ea4d60d1d942667185f775b74d522f6e9",124619],
  "undo.mp3":["8ea2c3367390c78ca76eecf9bff6b166d2b1d6e8",139248],
  "win.mp3":["397ff5f3b76699a3c4aa2c3cb5e76f1f49e5e37c",144681]
};
test("all eleven user's MP3s are exactly preserved on GitHub",()=>{
  const sw=readFileSync("sw.js","utf8");
  const effects=readFileSync("effects.js","utf8");
  for(const [filename,[gitSha,size]] of Object.entries(expected)){
    const data=readFileSync("assets/voices/"+filename);
    assert.equal(data.length,size,filename+" size");
    assert.equal(data.subarray(0,3).toString(),"ID3",filename+" MP3 signature");
    const blobHash=createHash("sha1")
      .update("blob "+data.length+"\0").update(data).digest("hex");
    assert.equal(blobHash,gitSha,filename+" matches original user voice.zip");
    assert.ok(sw.includes("./assets/voices/"+filename),filename+" is PWA-offline cached");
  }
  assert.match(effects,/loadVoiceForScene/);
  assert.match(effects,/decodeAudioData/);
});
test("iPhone ZIP parser is bundled and licensed",()=>{
  const page=readFileSync("index.html","utf8");
  const sw=readFileSync("sw.js","utf8");
  assert.match(page,/vendor\/jszip.min.js/);
  assert.match(page,/id="voicePackInput"/);
  assert.match(sw,/\.\/vendor\/jszip.min.js/);
  assert.match(readFileSync("vendor/JSZIP_LICENSE.md","utf8"),/MIT License/);
});