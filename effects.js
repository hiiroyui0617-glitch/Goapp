// Original political-news-flash animation and spoken Japanese phrases.
// Placement SE is a CC0 free sound by Mildly Useless, with a locally
// synthesized fallback that also works when the app is offline.
// Source: https://mildlyuseless.com/res/game-piece-place
// License: https://creativecommons.org/publicdomain/zero/1.0/
const STONE_AUDIO_URL = "https://mildlyuseless.com/res/sfx/game/game-piece-place.wav";
const DURATION_MS = 1750;

export function createEffects(getSettings) {
  let context = null;
  let timer = null;
  let lastCutInAt = 0;
  let lastSound = null;
  let voices = [];
  function settings() { return getSettings() || {}; }
  function loadVoices() {
    try { voices = globalThis.speechSynthesis?.getVoices?.() || []; }
    catch { voices = []; }
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  function getAudioContext() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context ||= new Ctor();
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }
  function fallbackStone(kind = "place") {
    const audio = getAudioContext();
    if (!audio) return;
    const now = audio.currentTime;
    const volume = (settings().volume || 0) / 100;
    const master = audio.createGain();
    master.gain.value = Math.min(.7, volume * .48);
    master.connect(audio.destination);
    const body = audio.createOscillator(), envelope = audio.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(232, now);
    body.frequency.exponentialRampToValueAtTime(118, now + .047);
    envelope.gain.setValueAtTime(.001, now);
    envelope.gain.linearRampToValueAtTime(.34, now + .001);
    envelope.gain.exponentialRampToValueAtTime(.001, now + .092);
    body.connect(envelope).connect(master);
    body.start(now);
    body.stop(now + .096);

    // Several millisecond impulses with wooden resonance, rather than an
    // electronic beep. Based on published CC0 design notes.
    const sr = audio.sampleRate;
    const buffer = audio.createBuffer(1, Math.ceil(sr * .1), sr);
    const samples = buffer.getChannelData(0);
    for (let i=0; i<samples.length; i++) {
      const t=i/sr;
      const attack = t<.001 ? t/.001 : 1;
      const click1=Math.exp(-t*260);
      const click2=t>.021 ? Math.exp(-(t-.021)*360)*.38 : 0;
      samples[i]=(Math.random()*2-1) * (click1+click2) * attack;
    }
    const source = audio.createBufferSource();
    source.buffer=buffer;
    const bp=audio.createBiquadFilter();bp.type="bandpass";bp.frequency.value=2650;bp.Q.value=1.2;
    const noiseGain=audio.createGain();noiseGain.gain.value=.29;
    source.connect(bp).connect(noiseGain).connect(master);
    source.start(now);source.stop(now + .1);
    if(kind==="capture"){
      const second=audio.createOscillator(),gain=audio.createGain();
      second.type="triangle";second.frequency.setValueAtTime(155,now+.05);
      second.frequency.exponentialRampToValueAtTime(95,now+.17);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.setValueAtTime(.07,now+.05);
      gain.gain.exponentialRampToValueAtTime(.001,now+.19);
      second.connect(gain).connect(master);
      second.start(now+.05);second.stop(now+.2);
    }
  }

  function sound(kind = "place") {
    const volume=(settings().volume || 0) / 100;
    if(volume<=0)return;
    // The sound is truly CC0. If offline, blocked or unavailable, use
    // a deliberately wooden two-contact synthetic sound.
    try {
      const clip = new Audio(STONE_AUDIO_URL);
      clip.volume=Math.min(1,volume*.95);
      clip.preload="auto";
      const promise=clip.play();
      if(promise && typeof promise.catch==="function")
        promise.catch(()=>fallbackStone(kind));
      lastSound=clip;
    }catch{try{fallbackStone(kind);}catch{}}
  }
  function speak(phrase) {
    const s=settings();
    if(s.voice===false || Number(s.volume)===0)return;
    if(!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined")return;
    try {
      // The speech uses the device's built-in voice, NOT any real politician
      // or the voice of a copyrighted game character.
      const synth=window.speechSynthesis;
      synth.cancel();
      const utterance=new SpeechSynthesisUtterance(phrase);
      utterance.lang="ja-JP";
      utterance.rate=.92;
      utterance.pitch=.83;
      utterance.volume=Math.min(1,Number(s.volume)/100);
      const japanese=voices.find(v=>v.lang?.toLowerCase().startsWith("ja"));
      if(japanese)utterance.voice=japanese;
      synth.speak(utterance);
    }catch(err){console.warn("Speech unavailable",err);}
  }
  function cutin(phrase,subtitle="臨時記者会見を開始します。",label="緊急記者会見",options={}) {
    const now=Date.now();
    const interval=options.force?0:1600;
    if(now-lastCutInAt<interval)return;
    lastCutInAt=now;
    const s=settings();
    if(s.cutin===false){speak(phrase);return;}
    const el=document.getElementById("cutin");
    if(!el)return;
    document.getElementById("cutinText").textContent=phrase;
    document.getElementById("cutinSub").textContent=subtitle;
    document.getElementById("cutinLabel").textContent=label;
    el.hidden=false;
    // Restart keyframes if the previous statement was still visible.
    el.classList.remove("cutin-animate");
    void el.offsetWidth;
    el.classList.add("cutin-animate");
    clearTimeout(timer);
    timer=setTimeout(()=>{
      el.classList.remove("cutin-animate");
      el.hidden=true;
    },DURATION_MS);
    speak(phrase);
  }
  function stop(){
    clearTimeout(timer);
    document.getElementById("cutin")?.classList.remove("cutin-animate");
    const el=document.getElementById("cutin");
    if(el)el.hidden=true;
    try{window.speechSynthesis?.cancel();}catch{}
  }
  return {sound,cutin,stop,speak};
}