import { GoGame } from "./go-engine.js";
import { levels, chooseCpuMove, suggest } from "./ai.js";
import { createEffects } from "./effects.js";

const $ = id => document.getElementById(id);
const STORAGE = "ikan_go_v1";
const SETTINGS = "ikan_go_settings_v1";
const defaults = { volume: 50, flip: false, vibration: true, lastMove: true, speed: "normal", cutin: true, voice: true };
let settings = {...defaults};
let game = null;
let config = { mode: "cpu", level: "15", humanColor: 1, size: 19, komi: 6.5 };
let clocks = {1: 0, 2: 0};
let home = true;
let cpuTimer = null;
let toastTimer = null;
let lastTick = Date.now();
const effects = createEffects(() => settings);
let worker = null;
let workerRequest = 0;
function cancelAi() {
  if (worker) { worker.terminate(); worker = null; }
  workerRequest++;
}
function askAi(action, level, callback) {
  cancelAi();
  const id = workerRequest;
  const snapshot = game.toJSON();
  const fallback = () => {
    try {
      callback(action === "hint" ? suggest(game) : chooseCpuMove(game, level));
    } catch(e) { console.warn("CPU calculation failed", e); callback(null); }
  };
  if (typeof Worker === "undefined") {
    setTimeout(fallback, 0);
    return;
  }
  try {
    worker = new Worker("./ai-worker.js", { type: "module" });
    worker.onmessage = event => {
      if (event.data?.id !== id || id !== workerRequest) return;
      const data=event.data;
      cancelAi();
      if (data.ok) callback(data.move);
      else fallback();
    };
    worker.onerror = () => {
      if (id !== workerRequest) return;
      cancelAi();
      setTimeout(fallback,0);
    };
    worker.postMessage({id, action, level, game:snapshot});
  } catch (e) {
    console.warn("Web Worker unavailable",e);
    cancelAi();
    setTimeout(fallback,0);
  }
}
const ui = { preview: null, dragging: false, pointerId: null, novice: false,
  scoring: false, dead: new Set(), hint: null, baseCache: null, drawQueued: false };
let confirmCallback = null;

function safeParse(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); }
  catch { return null; }
}
function save() {
  try {
    if (game) localStorage.setItem(STORAGE, JSON.stringify({
      game: game.toJSON(), config, clocks
    }));
  } catch (e) { console.warn("Save unavailable", e); }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch {}
}
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2700);
}
function dialog(id) {
  for (const d of document.querySelectorAll("dialog[open]")) d.close();
  $(id).showModal();
}
function closeDialogs() {
  for (const d of document.querySelectorAll("dialog[open]")) d.close();
}
function sound(kind = "place") { effects.sound(kind); }
function cutin(phrase, subtitle, label, force = false) {
  effects.cutin(phrase, subtitle, label, {force});
}

function vibrate() {
  if (settings.vibration && navigator.vibrate) {
    try { navigator.vibrate(13); } catch {}
  }
}
function isCpuTurn() {
  return game && !home && !game.finished && !ui.scoring &&
    config.mode === "cpu" && game.turn !== config.humanColor;
}
function canPlay() {
  return Boolean(game && !home && !game.finished && !ui.scoring && !isCpuTurn());
}
function showHome() {
  home = true;
  ui.dragging = false;
  ui.preview = null;
  clearTimeout(cpuTimer);
  cancelAi();
  effects.stop();
  $("homeScreen").hidden = false;
  $("gameScreen").hidden = true;
  $("resumeBtn").hidden = !game;
  updateToolbar();
  closeDialogs();
}
function showGame() {
  if (!game) return;
  home = false;
  $("homeScreen").hidden = true;
  $("gameScreen").hidden = false;
  closeDialogs();
  update();
  scheduleCpu();
}
function startNewGame(e) {
  e.preventDefault();
  clearTimeout(cpuTimer);
  cancelAi();
  effects.stop();
  const form = new FormData($("setupForm"));
  const choice = form.get("color");
  const color = choice === "random" ? (Math.random() < 0.5 ? 1 : 2) : Number(choice);
  config = { mode: form.get("mode") === "local" ? "local" : "cpu",
    level: String(form.get("level") || "15"), humanColor: color,
    size: Number(form.get("size")), komi: Number(form.get("komi")) };
  game = new GoGame(config.size, config.komi);
  clocks = {1: 0, 2: 0};
  lastTick = Date.now();
  ui.novice = false; ui.scoring = false; ui.dead.clear(); ui.preview = null;
  ui.hint = null; ui.baseCache = null;
  save();
  showGame();
  toast("新たな審議が始まりました。発言には十分ご注意ください。");
}
function showSetup() {
  $("modeSelect").value = config.mode;
  $("levelSelect").value = config.level;
  $("sizeSelect").value = String(config.size);
  $("komiSelect").value = String(config.komi);
  $("colorSelect").value = String(config.humanColor);
  toggleSetupFields();
  dialog("setupDialog");
}
function toggleSetupFields() {
  const local = $("modeSelect").value === "local";
  $("levelField").hidden = local;
  $("colorField").hidden = local;
}
function updateToolbar() {
  const active = Boolean(game && !home);
  for (const id of ["passBtn", "undoBtn", "hintBtn", "scoreBtn", "noviceBtn"])
    $(id).disabled = !active;
  $("passBtn").disabled = !canPlay();
  $("undoBtn").disabled = !active || !game.snapshots.length;
  $("hintBtn").disabled = !canPlay();
  $("noviceBtn").setAttribute("aria-pressed", String(ui.novice));
  $("scoreBtn").classList.toggle("active", ui.scoring);
  $("noviceBtn").classList.toggle("active", ui.novice);
}
function clockText(value) {
  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}
function updateClocks() {
  $("blackClock").textContent = clockText(clocks[1]);
  $("whiteClock").textContent = clockText(clocks[2]);
}
function update() {
  if (!game) return;
  const modeName = config.mode === "cpu" ? "CPU " + (levels.find(l => l.value === config.level)?.label || "15級")
    : "対人（同じ端末）";
  $("matchTitle").textContent = game.size + "路盤 ／ " + modeName + " ／ コミ" + game.komi;
  $("moveText").textContent = "第" + (game.moves.length + 1) + "手";
  $("blackName").textContent = config.mode === "local" ? "黒番（先手）" :
    config.humanColor === 1 ? "あなた（黒）" : "CPU（黒）";
  $("whiteName").textContent = config.mode === "local" ? "白番（後手）" :
    config.humanColor === 2 ? "あなた（白）" : "CPU（白）";
  $("blackCaptured").textContent = game.captures[1];
  $("whiteCaptured").textContent = game.captures[2];
  const turn = game.turn;
  $("blackCard").classList.toggle("is-turn", turn === 1 && !game.finished);
  $("whiteCard").classList.toggle("is-turn", turn === 2 && !game.finished);
  $("turnIndicator").className = "turn-dot " + (turn === 1 ? "black" : "white");
  if (ui.scoring) $("statusText").textContent = "地合審議中：死に石のグループをタップで指定できます。";
  else if (game.finished) $("statusText").textContent = "本日の審議は終了しました。";
  else if (isCpuTurn()) $("statusText").textContent = "CPUが答弁を準備しています…";
  else $("statusText").textContent = (turn === 1 ? "黒" : "白") + "番です。石を置く交点を選んでください。";
  $("novicePanel").hidden = !ui.novice;
  $("hintPanel").hidden = !ui.hint;
  $("scorePanel").hidden = !ui.scoring;
  updateClocks();
  if (ui.scoring) updateScore();
  updateToolbar();
  requestDraw();
  save();
}
function play(x, y) {
  if (!canPlay()) return;
  const result = game.play(x, y);
  if (!result.ok) { toast(result.reason); cutin("その一手、いかんです。","囲碁規則に反する着手です。","審議差し戻し"); return; }
  ui.hint = null;
  ui.baseCache = null;
  sound(result.captured ? "capture" : "place");
  vibrate();
  if (result.captured) {
    toast(result.captured >= 5 ? "支持基盤が大きく揺らぎました。（" + result.captured + "子取り）" : result.captured + "子を確保。これは適切な行政執行です。");
    if (result.captured >= 3) cutin("支持基盤が崩壊！", result.captured+"子が一斉に退陣しました。", "緊急速報");
  }
  ui.preview = null;
  update();
  scheduleCpu();
}
function scheduleCpu() {
  clearTimeout(cpuTimer);
  if (!isCpuTurn()) return;
  const delay = settings.speed === "fast" ? 150 : settings.speed === "slow" ? 900 : 330;
  cpuTimer = setTimeout(() => {
    if (!isCpuTurn()) return;
    const current = game;
    const key = game.key(game.board), turn = game.turn, moves = game.moves.length;
    askAi("cpu", config.level, choice => {
      if (game !== current || !isCpuTurn() || game.turn !== turn ||
          game.moves.length !== moves || game.key(game.board) !== key) return;
      if (choice) {
        const result = game.play(choice.x, choice.y);
        if (result.ok) {
          sound(result.captured ? "capture" : "place");
          if (result.captured >= 4)
            cutin("説明責任を果たしていただきたい。", "CPUが"+result.captured+"子を確保しました。","緊急記者会見");
        } else game.pass();
      } else game.pass();
      ui.hint = null;
      ui.baseCache = null;
      update();
      if (game.finished && game.passes >= 2) {
        enterScoring();
        cutin("審議終了を宣言します。","双方パスにより地合計算へ移行。","閉会宣言",true);
      } else scheduleCpu();
    });
  }, delay);
}

function passTurn() {
  if (!canPlay()) return;
  game.pass();
  ui.hint = null;
  ui.preview = null;
  ui.baseCache = null;
  cutin("答弁を差し控えます。","パスにより手番を譲ります。","公式答弁");
  update();
  if (game.finished && game.passes >= 2) {
    enterScoring();
    toast("双方パス。地合の審議を始めます。");
  } else {
    toast("答弁を差し控えます。（パス）");
    scheduleCpu();
  }
}
function undoMove() {
  if (!game || home || !game.snapshots.length) return;
  clearTimeout(cpuTimer);
  cancelAi();
  if (ui.scoring) leaveScoring();
  const last = game.moves.at(-1);
  let count = 1;
  if (config.mode === "cpu" && last && last.color !== config.humanColor &&
      game.snapshots.length > 1) count = 2;
  // A CPU turn can be queued after the human move; then only the human move is undone.
  const undone = game.undo(count);
  if (!undone) return;
  ui.hint = null; ui.preview = null; ui.baseCache = null; ui.dead.clear();
  update();
  toast("記憶にございません。（" + undone + "手前に戻しました）");
  cutin("記憶にございません。","議事録を"+undone+"手分修正しました。","答弁撤回",true);
  vibrate();
  scheduleCpu();
}
function giveHint() {
  if (!canPlay()) return;
  const current = game, key = game.key(game.board), turn = game.turn;
  toast("専門家に見解を照会しています…");
  askAi("hint","dan2",move => {
    if (game !== current || !canPlay() || game.turn !== turn ||
        game.key(game.board) !== key) return;
    ui.hint = move;
    if (!ui.hint) { toast("有効な着手がありません。パスをご検討ください。"); return; }
    $("hintText").textContent = "推奨候補：" + (move.x + 1) + "列・" + (move.y + 1) + "行。"
      + move.reason + "。※ 局面を先読みした参考候補であり、最善手の保証ではありません。";
    update();
    cutin("専門家の意見を採用します。","候補手を盤上に示しました。","参考人招致");
  });
}

function toggleNovice() {
  if (!game || home) return;
  ui.novice = !ui.novice;
  ui.preview = null;
  ui.baseCache = null;
  if (ui.novice) toast("初心者向け：指先で候補地点をなぞってください。");
  update();
}
function enterScoring() {
  if (!game || home) return;
  clearTimeout(cpuTimer);
  cancelAi();
  ui.scoring = true;
  ui.novice = false;
  ui.hint = null;
  ui.preview = null;
  ui.dead.clear();
  update();
}
function leaveScoring() {
  if (!game) return;
  ui.scoring = false;
  ui.dead.clear();
  update();
  scheduleCpu();
}
function toggleDeadAt(x, y) {
  if (!ui.scoring || !game.inside(x, y)) return;
  const index = game.index(x, y);
  if (!game.board[index]) return;
  const group = game.group(game.board, index).stones;
  const remove = ui.dead.has(index);
  group.forEach(i => remove ? ui.dead.delete(i) : ui.dead.add(i));
  update();
}
function updateScore() {
  const result = game.score(ui.dead);
  $("scoreBlack").textContent = result.black + "目";
  $("scoreWhite").textContent = result.white + "目";
  $("scoreBlackDetail").textContent = "地"+result.territories[1]+" ＋ アゲハマ"+result.prisoners[1];
  $("scoreWhiteDetail").textContent = "地"+result.territories[2]+" ＋ アゲハマ"+result.prisoners[2]+" ＋ コミ"+game.komi;
  $("scoreLead").textContent = (result.lead === 0 ? "持碁（同点）" :
    (result.lead > 0 ? "黒" : "白") + "が" + Math.abs(result.lead).toFixed(1).replace(/\.0$/, "") + "目優勢")
    + " ／ 手動指定した死に石を含みます。";
}
function confirmAction(title, message, callback) {
  confirmCallback = callback;
  $("confirmTitle").textContent = title;
  $("confirmBody").textContent = message;
  dialog("confirmDialog");
}
function finishScoring() {
  if (!game || !ui.scoring) return;
  const settle = () => {
    const score = game.score(ui.dead);
    game.finished = true;
    ui.scoring = false;
    update();
    const winner = score.lead > 0 ? "黒" : score.lead < 0 ? "白" : null;
    const margin = Math.abs(score.lead).toFixed(1).replace(/\.0$/, "");
    const humanLost = config.mode === "cpu" && winner && ((winner === "黒" && config.humanColor === 2) || (winner === "白" && config.humanColor === 1));
    const title = !winner ? "議決は同数です。" : humanLost ? (Number(margin) >= 20 ? "誠に遺憾です。" : "遺憾です。") : "審議の結果、可決されました。";
    showResult(title, winner
      ? winner + "の" + margin + "目勝ち。黒" + score.black + "目 ／ 白" + score.white + "目（コミ" + game.komi + "目を含む）。"
      : "持碁です。両者の主張が一致しました。");
    save();
  };
  if (!game.finished)
    confirmAction("終局でよろしいですか？", "まだ双方が続けてパスしていません。地合に合意した場合のみ確定してください。", settle);
  else settle();
}
function resign() {
  if (!game || game.finished) return;
  confirmAction("投了を表明しますか？", "一度投了すると、この対局は終了します。報道各社にも通知されます。（冗談です）", () => {
    clearTimeout(cpuTimer);
    const loser = game.turn;
    const diff = game.score().lead * (loser === 1 ? 1 : -1);
    const dramatic = diff < -20;
    game.resign();
    ui.scoring = false;
    update();
    showResult(dramatic ? "誠に遺憾です。" : "遺憾です。",
      (loser === 1 ? "黒" : "白") + "の投了により、" + (loser === 1 ? "白" : "黒") +
      "の中押し勝ち。説明責任を果たせなかった可能性があります。");
  });
}
function showResult(title, body) {
  $("resultTitle").textContent = title;
  $("resultBody").textContent = body;
  dialog("resultDialog");
  cutin(title, "対局結果を正式に発表します。","政府見解",true);
}
function boardMetrics() {
  const canvas = $("boardCanvas");
  const w = Math.max(200, Math.round(canvas.getBoundingClientRect().width || 350));
  const padding = w * (game?.size === 19 ? .053 : .068);
  const cell = (w - padding * 2) / ((game?.size || 19) - 1);
  return {w, padding, cell};
}
function boardToView(x, y) {
  if (settings.flip && game) return {x: game.size - 1 - x, y: game.size - 1 - y};
  return {x, y};
}
function viewToBoard(x, y) {
  if (settings.flip && game) return {x: game.size - 1 - x, y: game.size - 1 - y};
  return {x, y};
}
function eventToBoard(e) {
  if (!game) return null;
  const rect = $("boardCanvas").getBoundingClientRect();
  const m = boardMetrics();
  const px = (e.clientX - rect.left) * m.w / rect.width;
  const py = (e.clientY - rect.top) * m.w / rect.height;
  const vx = Math.round((px - m.padding) / m.cell);
  const vy = Math.round((py - m.padding) / m.cell);
  if (vx < 0 || vy < 0 || vx >= game.size || vy >= game.size) return null;
  return viewToBoard(vx, vy);
}
function setPreview(pos) {
  if (!game || home || game.finished || ui.scoring || !canPlay()) { ui.preview = null; requestDraw(); return; }
  if (pos && game.board[game.index(pos.x, pos.y)]) pos = null;
  ui.preview = pos;
  requestDraw();
}
function onPointerDown(e) {
  if (!game || home) return;
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  if (!ui.scoring && !canPlay()) return;
  ui.dragging = true;
  ui.pointerId = e.pointerId;
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  setPreview(eventToBoard(e));
}
function onPointerMove(e) {
  if (!game || home) return;
  if (ui.dragging && e.pointerId !== ui.pointerId) return;
  if (ui.scoring) return;
  if (ui.dragging || e.pointerType === "mouse" || e.pointerType === "pen")
    setPreview(eventToBoard(e));
}
function onPointerUp(e) {
  if (!ui.dragging || e.pointerId !== ui.pointerId) return;
  e.preventDefault();
  ui.dragging = false;
  ui.pointerId = null;
  const pos = eventToBoard(e);
  ui.preview = null;
  if (pos) {
    if (ui.scoring) toggleDeadAt(pos.x, pos.y);
    else play(pos.x, pos.y);
  }
  requestDraw();
}
function onPointerCancel() {
  ui.dragging = false;
  ui.pointerId = null;
  ui.preview = null;
  requestDraw();
}
function onKeyboardBoard(e) {
  if (!game || home || ui.scoring) return;
  const arrows = {ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0]};
  if (arrows[e.key]) {
    e.preventDefault();
    const old = ui.preview || { x: Math.floor(game.size / 2), y: Math.floor(game.size / 2) };
    const move = arrows[e.key];
    const xy = boardToView(old.x, old.y);
    const next = viewToBoard(Math.max(0,Math.min(game.size-1, xy.x+move[0])),
      Math.max(0,Math.min(game.size-1, xy.y+move[1])));
    setPreview(next);
  } else if ((e.key === "Enter" || e.key === " ") && ui.preview) {
    e.preventDefault(); play(ui.preview.x, ui.preview.y);
  } else if (e.key === "Escape") setPreview(null);
}

function requestDraw() {
  if (ui.drawQueued || !game || home) return;
  ui.drawQueued = true;
  requestAnimationFrame(() => {
    ui.drawQueued = false;
    if (!home && game) drawBoard();
  });
}
function stone(ctx, x, y, radius, color, alpha = 1, ghost = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "#2f1c0ca8";
  ctx.shadowBlur = ghost ? 9 : Math.max(3, radius * .42);
  ctx.shadowOffsetY = ghost ? 4 : Math.max(2, radius * .22);
  const gradient = ctx.createRadialGradient(x - radius*.37,y - radius*.42,radius*.07,x,y,radius);
  if (color === 1) {
    gradient.addColorStop(0,"#82888b"); gradient.addColorStop(.18,"#434a50");
    gradient.addColorStop(.63,"#111820"); gradient.addColorStop(1,"#030509");
  } else {
    gradient.addColorStop(0,"#ffffff"); gradient.addColorStop(.38,"#fafafa");
    gradient.addColorStop(.75,"#e5e4e0"); gradient.addColorStop(1,"#b2ada3");
  }
  ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2);
  ctx.fillStyle = gradient; ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(.5, radius*.065);
  ctx.strokeStyle = color === 1 ? "#0009" : "#7776";
  ctx.stroke();
  ctx.restore();
}
function stars(n) {
  if (n === 9) return [[2,2],[2,6],[4,4],[6,2],[6,6]];
  if (n === 13) return [[3,3],[3,9],[6,6],[9,3],[9,9]];
  const s = [3,9,15];
  return s.flatMap(x => s.map(y => [x,y]));
}
function influenceBase() {
  const key = game.key(game.board);
  if (ui.baseCache && ui.baseCache.key === key) return ui.baseCache.values;
  const n = game.size, stones = [];
  for (let i=0;i<game.board.length;i++) if (game.board[i])
    stones.push({x:i % n,y:Math.floor(i/n),color:game.board[i]});
  const values = new Float32Array(n*n);
  for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
    let sum = 0;
    for (const p of stones) {
      const d2 = (p.x-x)**2+(p.y-y)**2;
      sum += (p.color === 1 ? 1:-1) * 3 / Math.pow(1 + d2*.28, 1.65);
    }
    values[y*n+x] = sum;
  }
  ui.baseCache = {key,values};
  return values;
}
function drawTerritory(ctx,m,regions) {
  for (const [key,color] of [["1","#29465439"],["2","#f0f3ec9a"]]) {
    ctx.fillStyle = color;
    for (const id of regions[key]) {
      const p=boardToView(id%game.size,Math.floor(id/game.size));
      ctx.fillRect(m.padding+(p.x-.49)*m.cell,m.padding+(p.y-.49)*m.cell,m.cell*.98,m.cell*.98);
    }
  }
}
function drawBeginner(ctx,m) {
  const base = influenceBase();
  const n=game.size, cand=ui.preview, color=game.turn;
  const sign=color===1?1:-1;
  let added = 0;
  for (let y=0;y<n;y++) for(let x=0;x<n;x++) {
    const idx=game.index(x,y);
    if(game.board[idx]) continue;
    const view=boardToView(x,y), px=m.padding+view.x*m.cell, py=m.padding+view.y*m.cell;
    let b=base[idx]*sign;
    if (b>.85) {
      ctx.fillStyle = "rgba(55,91,74,.075)";
      ctx.fillRect(px-m.cell*.45,py-m.cell*.45,m.cell*.9,m.cell*.9);
    }
    if (!cand) continue;
    const dist2=(x-cand.x)**2+(y-cand.y)**2;
    const increase=3/Math.pow(1+dist2*.28,1.65);
    const after=b+increase;
    // Newly favorable intersections get a stronger highlight; this is a
    // potential/influence indicator, not a proof that territory is secured.
    if (b<.85 && after>.85) {
      added++;
      const intensity=Math.min(.5,.17+(after-.85)*.11);
      ctx.fillStyle = color===1 ? "rgba(48,145,96,"+intensity+")" : "rgba(51,143,190,"+intensity+")";
      ctx.beginPath(); ctx.arc(px,py,m.cell*.38,0,Math.PI*2); ctx.fill();
    }
  }
  if (cand) $("noviceText").textContent =
    "この一手で勢力が増す交点：約" + added + "か所（独自の概算）。緑／青の印は確定した陣地ではありません。";
  else $("noviceText").textContent =
    "指で碁盤をなぞると、そこへ置いた場合の勢力の変化を表示します。";
}
function drawBoard() {
  const cv=$("boardCanvas"), m=boardMetrics(), dpr=Math.min(2.5,window.devicePixelRatio||1);
  cv.style.height=m.w+"px";
  const pixels=Math.round(m.w*dpr);
  if(cv.width!==pixels||cv.height!==pixels) {cv.width=pixels;cv.height=pixels;}
  const ctx=cv.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=m.w,n=game.size,p=m.padding,c=m.cell;
  ctx.clearRect(0,0,w,w);
  let wood=ctx.createLinearGradient(0,0,w,w);
  wood.addColorStop(0,"#f2d38f");wood.addColorStop(.45,"#e5b971");wood.addColorStop(.8,"#f4d193");wood.addColorStop(1,"#dda968");
  ctx.fillStyle=wood;ctx.fillRect(0,0,w,w);
  // Fine, deterministic woodgrain: consistent when the board re-renders.
  ctx.save();
  ctx.lineWidth=Math.max(.5,w*.0009);
  for(let i=0;i<38;i++){
    const origin=(i+.25)*w/38;
    ctx.beginPath();ctx.moveTo(origin,0);
    ctx.bezierCurveTo(origin+Math.sin(i*2.9)*9,w*.3,origin+Math.cos(i*1.7)*8,w*.6,origin+Math.sin(i)*6,w);
    ctx.strokeStyle=i%3===0?"#a56d3219":"#fff3cc2b";ctx.stroke();
  }
  ctx.restore();
  // Inner grid backing and outline.
  const edge=c*.52;
  ctx.strokeStyle="#936b3f";
  ctx.lineWidth=1.2;
  ctx.strokeRect(p-edge,p-edge,(n-1)*c+edge*2,(n-1)*c+edge*2);
  if (ui.scoring) drawTerritory(ctx,m,game.score(ui.dead).regions);
  else if (ui.novice) drawBeginner(ctx,m);
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const k=p+i*c;
    ctx.moveTo(p,k);ctx.lineTo(p+(n-1)*c,k);
    ctx.moveTo(k,p);ctx.lineTo(k,p+(n-1)*c);
  }
  ctx.strokeStyle="#503918e3";ctx.lineWidth=Math.max(.75,w*.00135);ctx.stroke();
  ctx.fillStyle="#49341d";
  for(const [x,y] of stars(n)){
    const v=boardToView(x,y);
    ctx.beginPath();ctx.arc(p+v.x*c,p+v.y*c,Math.max(2,w*.0048),0,Math.PI*2);ctx.fill();
  }
  // Numeric column labels, kanji row labels, following the reference screen.
  ctx.font="600 "+Math.max(9,Math.min(14,w*.028))+"px sans-serif";
  ctx.fillStyle="#593c1b";
  ctx.textAlign="center";ctx.textBaseline="middle";
  const kanji=["一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六","十七","十八","十九"];
  for(let i=0;i<n;i++){
    ctx.fillText(String(settings.flip?n-i:i+1),p+i*c,p-c*.75);
    ctx.fillText(settings.flip?kanji[n-1-i]:kanji[i],p-c*.73,p+i*c);
  }
  const r=Math.min(c*.49,w/(n*1.95));
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const id=game.index(x,y), color=game.board[id];
    if(!color)continue;
    const v=boardToView(x,y), sx=p+v.x*c,sy=p+v.y*c;
    stone(ctx,sx,sy,r,color,(ui.scoring && ui.dead.has(id)) ? 0.42 : 1);
    if (ui.scoring && ui.dead.has(id)) {
      ctx.save();ctx.strokeStyle="#dc4c3d";ctx.lineWidth=Math.max(2,c*.14);
      ctx.beginPath();ctx.moveTo(sx-r*.42,sy-r*.42);ctx.lineTo(sx+r*.42,sy+r*.42);
      ctx.moveTo(sx+r*.42,sy-r*.42);ctx.lineTo(sx-r*.42,sy+r*.42);ctx.stroke();ctx.restore();
    }
  }
  if(settings.lastMove&&game.lastMove&&!ui.scoring){
    const v=boardToView(game.lastMove.x,game.lastMove.y);
    ctx.save();ctx.lineWidth=Math.max(1.4,c*.085);ctx.strokeStyle="#e34f36";
    ctx.beginPath();ctx.arc(p+v.x*c,p+v.y*c,r*.43,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  if (ui.hint && !ui.scoring && !game.finished) {
    const v=boardToView(ui.hint.x,ui.hint.y);
    const x=p+v.x*c,y=p+v.y*c;
    ctx.save();ctx.lineWidth=Math.max(2,c*.1);ctx.strokeStyle="#ed642e";
    ctx.setLineDash([Math.max(3,c*.28),Math.max(2,c*.15)]);
    ctx.beginPath();ctx.arc(x,y,r*1.12,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    ctx.fillStyle="#ed642e";ctx.font="bold "+Math.max(12,c*.65)+"px sans-serif";
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("✦",x,y-r*1.75);
  }
  if(ui.preview&&!ui.scoring&&!game.finished){
    const result=game.simulate(ui.preview.x,ui.preview.y,game.turn);
    const v=boardToView(ui.preview.x,ui.preview.y);
    const x=p+v.x*c,y=p+v.y*c;
    ctx.save();ctx.strokeStyle=result.ok?"#fdf7db":"#dc5040";
    ctx.lineWidth=Math.max(1.8,r*.14);ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.arc(x,y,r*1.23,0,Math.PI*2);ctx.stroke();ctx.restore();
    stone(ctx,x,y,r,game.turn,result.ok?.65:.28,true);
    if(!result.ok){
      ctx.fillStyle="#e2483c";ctx.font="bold "+Math.max(14,c*.7)+"px sans-serif";
      ctx.textAlign="center";ctx.fillText("×",x,y-r*1.25);
    }
  }
}

function wire() {
  $("startBtn").onclick=showSetup;
  $("newBtn").onclick=showSetup;
  $("resumeBtn").onclick=showGame;
  $("homeHelpBtn").onclick=()=>dialog("helpDialog");
  $("menuBtn").onclick=()=>dialog("menuDialog");
  $("passBtn").onclick=passTurn;
  $("undoBtn").onclick=undoMove;
  $("hintBtn").onclick=giveHint;
  $("scoreBtn").onclick=()=>ui.scoring?leaveScoring():enterScoring();
  $("noviceBtn").onclick=toggleNovice;
  $("settingsBtn").onclick=()=>{fillSettings();dialog("settingsDialog");};
  $("clearHintBtn").onclick=()=>{ui.hint=null;update();};
  $("closeScoreBtn").onclick=leaveScoring;
  $("finishScoreBtn").onclick=finishScoring;
  $("menuResumeBtn").onclick=()=>game?showGame():showSetup();
  $("menuNewBtn").onclick=showSetup;
  $("menuHomeBtn").onclick=showHome;
  $("menuResignBtn").onclick=resign;
  $("menuHelpBtn").onclick=()=>dialog("helpDialog");
  $("setupForm").addEventListener("submit",startNewGame);
  $("modeSelect").addEventListener("change",toggleSetupFields);
  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click",()=>$(button.dataset.close).close());
  });
  $("confirmYesBtn").onclick=()=>{
    const callback=confirmCallback;
    confirmCallback=null;
    $("confirmDialog").close();
    if(callback)callback();
  };
  $("confirmCancelBtn").onclick=()=>{confirmCallback=null;$("confirmDialog").close();};
  $("resultHomeBtn").onclick=showHome;
  $("resultNewBtn").onclick=showSetup;
  $("settingsDoneBtn").onclick=()=>{$("settingsDialog").close();toast("施行規則を改定しました。");};
  $("volumeInput").oninput=e=>{$("volumeOutput").textContent=e.target.value+"%";settings.volume=Number(e.target.value);saveSettings();};
  $("flipInput").onchange=e=>{settings.flip=e.target.checked;ui.preview=null;saveSettings();requestDraw();};
  $("vibrationInput").onchange=e=>{settings.vibration=e.target.checked;saveSettings();};
  $("lastMoveInput").onchange=e=>{settings.lastMove=e.target.checked;saveSettings();requestDraw();};
  $("speedInput").onchange=e=>{settings.speed=e.target.value;saveSettings();scheduleCpu();};
  $("cutinInput").onchange=e=>{settings.cutin=e.target.checked;saveSettings();};
  $("voiceInput").onchange=e=>{settings.voice=e.target.checked;saveSettings();};
  const canvas=$("boardCanvas");
  canvas.addEventListener("pointerdown",onPointerDown);
  canvas.addEventListener("pointermove",onPointerMove);
  canvas.addEventListener("pointerup",onPointerUp);
  canvas.addEventListener("pointercancel",onPointerCancel);
  canvas.addEventListener("lostpointercapture",()=>{
    if(ui.dragging)onPointerCancel();
  });
  canvas.addEventListener("pointerleave",()=>{
    if(!ui.dragging) setPreview(null);
  });
  canvas.addEventListener("keydown",onKeyboardBoard);
  canvas.addEventListener("contextmenu",e=>e.preventDefault());
  window.addEventListener("resize",requestDraw);
  document.addEventListener("visibilitychange",()=>lastTick=Date.now());
  setInterval(()=>{
    const now=Date.now(),dt=Math.min(2,Math.max(0,(now-lastTick)/1000));
    lastTick=now;
    if(game&&!home&&!game.finished&&!ui.scoring&&!document.hidden){
      clocks[game.turn]+=dt;
      updateClocks();
      if(Math.floor(clocks[1]+clocks[2])%10===0)save();
    }
  },1000);
}
function fillSettings(){
  $("volumeInput").value=settings.volume;
  $("volumeOutput").textContent=settings.volume+"%";
  $("flipInput").checked=settings.flip;
  $("vibrationInput").checked=settings.vibration;
  $("lastMoveInput").checked=settings.lastMove;
  $("speedInput").value=settings.speed;
  $("cutinInput").checked=settings.cutin;
  $("voiceInput").checked=settings.voice;
}
function initialize(){
  const savedSettings=safeParse(SETTINGS);
  if(savedSettings&&typeof savedSettings==="object"){
    settings={...defaults,...savedSettings};
    settings.volume=Math.max(0,Math.min(100,Number(settings.volume)||0));
    if(!["fast","normal","slow"].includes(settings.speed))settings.speed="normal";
  }
  $("levelSelect").innerHTML=levels.map(l=>'<option value="'+l.value+'">'+l.label+'</option>').join("");
  const saved=safeParse(STORAGE);
  if(saved&&saved.game){
    try {
      game=GoGame.fromJSON(saved.game);
      config={...config,...saved.config,size:game.size,komi:game.komi};
      if(!["cpu","local"].includes(config.mode))config.mode="cpu";
      if(![1,2].includes(config.humanColor))config.humanColor=1;
      clocks={1:Number(saved.clocks?.[1])||0,2:Number(saved.clocks?.[2])||0};
    } catch(err){console.warn("Invalid saved game",err);game=null;}
  }
  fillSettings();
  wire();
  showHome();
  if("serviceWorker" in navigator && location.protocol!=="file:"){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }
}
initialize();