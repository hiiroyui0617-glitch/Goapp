// Original sound and spoken cut-in system. No third-party game audio
// or imitation of a recognizable actor/politician is used.
// Acoustic model: sharp stone impact + damped wooden board resonance.
export function createEffects(getSettings) {
  const readSettings = () => getSettings?.() || {};
  const assets = {
    rise: "./assets/cutins/rise.svg",
    fall: "./assets/cutins/fall.svg",
    win: "./assets/cutins/win.svg",
    lose: "./assets/cutins/lose.svg",
    undo: "./assets/cutins/undo.svg"
  };
  let audioContext = null;
  let buffers = [];
  let queueVersion = 0;
  let cutinTimeout = 0;
  let lastCutin = 0;
  let currentVoice = null;
  let voices = [];
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  function loadVoices() {
    try { voices = synth?.getVoices?.() || []; } catch { voices = []; }
  }
  if(synth) {
    loadVoices();
    try { synth.addEventListener("voiceschanged",loadVoices); } catch {}
  }

  // Pre-render a resonant 0.24 s wooden goban hit. The dominant resonance
  // follows the initial dry clack, while higher partials dissipate quickly.
  // Each variation uses a different strike position and sound color.
  function synthesizeStoneBuffer(ctx, variation=0) {
    const rate = ctx.sampleRate;
    const duration = .245;
    const buffer = ctx.createBuffer(1,Math.ceil(rate * duration),rate);
    const arr = buffer.getChannelData(0);
    const rand = () => Math.random()*2-1;
    const freqs = [159,293,497,814,1316,2250,3780];
    const amplitudes = [.22,.29,.24,.18,.13,.14,.13];
    const decays = [.145,.115,.075,.060,.043,.031,.015];
    let lastNoise = 0, peak=0;
    for(let i=0;i<arr.length;i++){
      const t=i/rate;
      // A short broadband snap (stone hitting wood) with two contact pulses.
      const noise = rand();
      const sharp = noise-lastNoise*.63;
      lastNoise = noise;
      const first = Math.exp(-Math.pow(t/.0028,1.17)) * .86;
      const second = t>.004 ? Math.exp(-(t-.004)/.0033)*.25 : 0;
      let wave=(first+second)*sharp*.53;
      for(let k=0;k<freqs.length;k++){
        const detune=1+variation*.011+Math.sin((k+2)*variation)*.012;
        const freq=freqs[k]*detune;
        const impact=.0005+variation*.00008;
        const attack=Math.min(1,t/impact);
        wave+=amplitudes[k] * Math.sin(2*Math.PI*freq*t+variation*.7+k*.23)
          * Math.exp(-t/decays[k]) * attack;
      }
      // The last low rumble fades down into the wood; no arcade beep.
      arr[i]=wave;
      peak=Math.max(peak,Math.abs(wave));
    }
    const gain=peak? .93/peak : 1;
    for(let i=0;i<arr.length;i++)arr[i]=Math.tanh(arr[i]*gain*.95);
    return buffer;
  }
  function createContext() {
    const Ctor=window.AudioContext || window.webkitAudioContext;
    if(!Ctor)return null;
    if(!audioContext){
      audioContext=new Ctor();
      buffers=[0,1,2,3].map(i=>synthesizeStoneBuffer(audioContext,i));
    }
    if(audioContext.state==="suspended"){
      try { audioContext.resume().catch(()=>{}); } catch {}
    }
    return audioContext;
  }
  function unlock() {
    try { createContext(); } catch {}
  }
  function playBuffer(ctx,sourceBuffer,gain,startAt,rate=1){
    const source=ctx.createBufferSource();
    const level=ctx.createGain();
    source.buffer=sourceBuffer;
    source.playbackRate.value=rate;
    level.gain.value=gain;
    source.connect(level).connect(ctx.destination);
    source.start(startAt);
    return source;
  }
  function sound(kind="place",count=1) {
    const volume=Number(readSettings().volume||0)/100;
    if(volume<=0)return;
    try{
      const ctx=createContext();
      if(!ctx||!buffers.length)return;
      const now=ctx.currentTime;
      const rate=.94+Math.random()*.12;
      const variation=(Math.random()*buffers.length)|0;
      playBuffer(ctx,buffers[variation],volume*.82,now,rate);
      if(kind==="capture"&&count>0){
        // Captured stones trickle into the lid/bowl after the board click.
        for(let i=0;i<Math.min(4,count);i++){
          const c=buffers[(variation+i+1)%buffers.length];
          playBuffer(ctx,c,volume*(.22-i*.035),now+.075+i*.048,1.12+Math.random()*.13);
        }
      }
    }catch(err){console.warn("Board sound unavailable",err);}
  }
  function hide() {
    const el=document.getElementById("cutin");
    if(!el)return;
    el.classList.remove("cutin-visible");
    el.classList.add("cutin-exit");
    setTimeout(()=>{
      if(!el.classList.contains("cutin-visible")){
        el.hidden=true;
        el.classList.remove("cutin-exit");
      }
    },240);
  }
  function finish(version,callback) {
    if(version!==queueVersion)return;
    clearTimeout(cutinTimeout);
    currentVoice=null;
    hide();
    if(typeof callback==="function"){
      // Results should appear only after the spoken cut-in is done.
      setTimeout(callback,260);
    }
  }
  function stop() {
    queueVersion++;
    clearTimeout(cutinTimeout);
    currentVoice=null;
    try{synth?.cancel();}catch{}
    const el=document.getElementById("cutin");
    if(el){el.hidden=true;el.classList.remove("cutin-visible","cutin-exit","has-art");}
  }
  function cutin(phrase,subtitle="",label="",options={}) {
    const time=Date.now();
    if(!options.force && time-lastCutin<480)return;
    lastCutin=time;
    stop();
    const version=queueVersion;
    const settings=readSettings();
    const visualEnabled=settings.cutin!==false;
    const el=document.getElementById("cutin");
    if(visualEnabled && el){
      const img=document.getElementById("cutinArt");
      const kind=assets[options.kind] ? options.kind : null;
      img.hidden=!kind;
      el.classList.toggle("has-art",Boolean(kind));
      if(kind)img.src=assets[kind];
      document.getElementById("cutinText").textContent=phrase;
      document.getElementById("cutinSub").textContent=subtitle;
      document.getElementById("cutinLabel").textContent=label;
      el.hidden=false;
      el.classList.remove("cutin-exit");
      void el.offsetHeight;
      el.classList.add("cutin-visible");
    }
    const end=()=>finish(version,options.onDone);
    if(settings.voice===false||Number(settings.volume)===0||!synth||
       typeof SpeechSynthesisUtterance==="undefined"){
      cutinTimeout=setTimeout(end,visualEnabled?1600:0);
      return;
    }
    try {
      loadVoices();
      const u=new SpeechSynthesisUtterance(phrase);
      currentVoice=u;
      u.lang="ja-JP";
      u.rate=.93;
      u.pitch=.88;
      u.volume=Math.min(1,Number(settings.volume)/100);
      const japanese=voices.find(v=>v.lang?.toLowerCase().startsWith("ja"));
      if(japanese)u.voice=japanese;
      let hasEnded=false;
      const onEnd=()=>{
        if(hasEnded)return;
        hasEnded=true;
        end();
      };
      u.onend=onEnd;
      u.onerror=onEnd;
      synth.cancel();
      synth.speak(u);
      // Some iOS versions never dispatch end/error when the app is in
      // standalone mode. A safety timeout prevents a permanent overlay.
      cutinTimeout=setTimeout(onEnd,Math.max(7000,phrase.length*480));
    } catch(err) {
      console.warn("Japanese TTS unavailable",err);
      cutinTimeout=setTimeout(end,1700);
    }
  }
  return {sound,unlock,cutin,stop};
}
