// Lightweight, fully offline heuristic opponent. The labels are adjustable
// difficulty presets, NOT certified human kyu/dan playing strengths.
export const levels = [
  ...Array.from({ length: 15 }, (_, i) => ({ value: String(15 - i), label: (15 - i) + "級" })),
  { value: "dan1", label: "初段" }, { value: "dan2", label: "二段" }
];

export function levelIndex(level) {
  if (level === "dan2") return 16;
  if (level === "dan1") return 15;
  const kyu = Number(level);
  return Number.isFinite(kyu) && kyu >= 1 && kyu <= 15 ? 15 - kyu : 0;
}

function openingBonus(game, x, y) {
  const n = game.size, played = game.moves.filter(m => m.type === "play").length;
  if (played >= Math.max(8, n * 0.9)) return 0;
  const star = n === 19 ? 3 : n === 13 ? 3 : 2;
  const corners = [[star, star], [star, n - 1 - star], [n - 1 - star, star], [n - 1 - star, n - 1 - star]];
  const dist = Math.min(...corners.map(([a, b]) => Math.abs(x - a) + Math.abs(y - b)));
  const boardCenter = (n - 1) / 2;
  const notTooCenter = n === 9 ? 2 : 1;
  return Math.max(0, 6 - dist * 1.8) + Math.max(0, 2.0 - Math.abs(x - boardCenter) * 0.16 - Math.abs(y - boardCenter) * 0.16) * notTooCenter;
}

export function candidateMoves(game, color = game.turn) {
  const n = game.size, b = game.board;
  const existing = [];
  for (let i = 0; i < b.length; i++) if (b[i]) existing.push({ x: i % n, y: Math.floor(i / n), color: b[i] });
  const moves = [];
  const turnCount = game.moves.filter(m => m.type === "play").length;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = game.index(x, y);
    if (b[i]) continue;
    const sim = game.simulate(x, y, color);
    if (!sim.ok) continue;
    let score = openingBonus(game, x, y);
    const ns = game.neighbors(i);
    const own = ns.filter(p => b[p] === color).length;
    const enemy = ns.filter(p => b[p] === 3 - color).length;
    const open = ns.filter(p => b[p] === 0).length;
    const friends = existing.filter(p => p.color === color);
    const foes = existing.filter(p => p.color !== color);
    const distanceTo = points => points.length
      ? Math.min(...points.map(p => Math.max(Math.abs(p.x - x), Math.abs(p.y - y))))
      : n;
    const closeOwn = distanceTo(friends), closeEnemy = distanceTo(foes);
    // Play around active fighting areas without filling clearly safe eyes.
    score += 3.8 * enemy + 1.2 * Math.min(own, 2) + 0.7 * open;
    score += closeEnemy < 5 ? 4.8 - closeEnemy : 0;
    score += closeOwn > 5 ? -3 : closeOwn >= 2 ? 3 : 0;
    if (own === ns.length && !enemy && sim.captured === 0) score -= 45;
    if (own >= 3 && !enemy && sim.captured === 0) score -= 22;
    if (sim.liberties === 1 && sim.captured === 0) score -= 43;
    else if (sim.liberties === 2) score -= 3;
    score += sim.captured * 13;
    // Atari, urgent defense and connections.
    const seen = new Set();
    for (const q of ns) {
      if (!b[q] || seen.has(q)) continue;
      const g = game.group(b, q);
      g.stones.forEach(k => seen.add(k));
      if (b[q] === 3 - color) {
        if (g.liberties.size === 1 && g.liberties.has(i)) score += 10 + g.stones.length * 3;
        else if (g.liberties.size === 2 && g.liberties.has(i)) score += 4 + Math.min(g.stones.length, 6);
      } else if (g.liberties.size === 1 && g.liberties.has(i)) {
        score += 13 + g.stones.length * 2;
      } else if (g.liberties.size === 2 && g.liberties.has(i)) score += 2;
    }
    if (!existing.length) score += n === 9 && x === 4 && y === 4 ? 5 : 0;
    if (turnCount > n * n * 0.55) {
      if (open === 0 && sim.captured === 0) score -= 22;
      if (closeEnemy > 4 && own > 0) score -= 7;
    }
    moves.push({ x, y, score, reason: sim.captured > 0 ? sim.captured + "子を取れます" : enemy ? "相手への攻め・守り" : turnCount < 12 ? "序盤の布石候補" : "勢力の拡大候補" });
  }
  moves.sort((a, b) => b.score - a.score);
  return moves;
}

export function suggest(game, color = game.turn) {
  const moves = candidateMoves(game, color);
  return moves.length ? moves[0] : null;
}

export function chooseCpuMove(game, level = "15") {
  const moves = candidateMoves(game);
  if (!moves.length) return null;
  const strength = levelIndex(level);
  // Higher levels choose from the highest-rated local candidates more often.
  // The model stays a simple heuristic, even when its UI difficulty says "二段".
  const noise = Math.pow((16 - strength) / 16, 1.55) * 19;
  const pool = moves.slice(0, strength >= 12 ? 9 : strength >= 7 ? 18 : 32);
  const ranked = pool.map(m => ({ m, adjusted: m.score + (Math.random() - 0.5) * 2 * noise }));
  ranked.sort((a, b) => b.adjusted - a.adjusted);
  if (ranked[0].m.score < -9 && game.moves.length > game.size * game.size * 0.5) return null;
  return ranked[0].m;
}