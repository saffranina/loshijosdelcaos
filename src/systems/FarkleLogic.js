// FarkleLogic.js — reglas y puntuación del Farkle. Módulo puro, sin Phaser.
// Todo acá es testeable de forma aislada (ver tests/test.html).

/** Tira n dados. */
export function rollDice(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(1 + Math.floor(Math.random() * 6));
  return out;
}

function counts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}

/**
 * Puntúa un conjunto EXACTO de dados apartados.
 * Devuelve { score, valid }. valid = todos los dados aportan puntos.
 * Si sobra algún dado sin usar, valid es false (no se puede apartar basura).
 */
export function scoreSelection(dice) {
  if (!dice || dice.length === 0) return { score: 0, valid: false };
  const c = counts(dice);
  const n = dice.length;
  let best = 0;

  // Combinaciones especiales de KCD.
  if (n === 6 && c.slice(1).every((x) => x === 1)) best = Math.max(best, 1500);

  // Escalera parcial 1-2-3-4-5.
  if (n === 5 && [1, 2, 3, 4, 5].every((v) => c[v] === 1)) best = Math.max(best, 750);

  // Tres pares
  if (n === 6 && c.slice(1).filter((x) => x === 2).length === 3) best = Math.max(best, 1500);

  // Dos tríos.
  if (n === 6 && c.slice(1).filter((x) => x === 3).length === 2) best = Math.max(best, 2500);

  // Póker + pareja.
  if (n === 6 && c.slice(1).some((x) => x === 4) && c.slice(1).some((x) => x === 2)) {
    best = Math.max(best, 1500);
  }

  // Combinaciones normales: n-de-un-tipo + 1s y 5s sueltos.
  let score = 0;
  let used = 0;
  for (let v = 1; v <= 6; v++) {
    const k = c[v];
    if (k >= 3) {
      const base = v === 1 ? 1000 : v * 100;
      score += k === 3 ? base : k === 4 ? 1000 : k === 5 ? 2000 : 3000;
      used += k;
    } else if (k > 0) {
      if (v === 1) { score += 100 * k; used += k; }
      else if (v === 5) { score += 50 * k; used += k; }
    }
  }
  if (used === n) best = Math.max(best, score);

  // valid: o bien una combinación especial de 6 dados, o todos los dados usados.
  const special =
    (n === 5 && [1, 2, 3, 4, 5].every((v) => c[v] === 1)) ||
    (n === 6 && (
      c.slice(1).every((x) => x === 1) ||
      c.slice(1).filter((x) => x === 2).length === 3 ||
      c.slice(1).filter((x) => x === 3).length === 2 ||
      (c.slice(1).some((x) => x === 4) && c.slice(1).some((x) => x === 2))
    ));
  const valid = best > 0 && (special || used === n);
  return { score: valid ? best : 0, valid };
}

/** ¿Este tiro tiene algún dado de puntuación? Si no, es Farkle. */
export function hasScoring(dice) {
  const c = counts(dice);
  if (c[1] > 0 || c[5] > 0) return true;
  for (let v = 1; v <= 6; v++) if (c[v] >= 3) return true;
  if (dice.length === 6 && c.slice(1).every((x) => x === 1)) return true;
  if (dice.length === 6 && c.slice(1).filter((x) => x === 2).length === 3) return true;
  if (dice.length >= 5 && [1, 2, 3, 4, 5].every((v) => c[v] >= 1)) return true;
  if (dice.length === 6 && c.slice(1).filter((x) => x === 3).length === 2) return true;
  if (dice.length === 6 && c.slice(1).some((x) => x === 4) && c.slice(1).some((x) => x === 2)) return true;
  return false;
}

/** Todos los subconjuntos válidos de un tiro, como lista de índices. */
export function validKeeps(dice) {
  const out = [];
  const total = 1 << dice.length;
  for (let mask = 1; mask < total; mask++) {
    const idx = [];
    for (let i = 0; i < dice.length; i++) if (mask & (1 << i)) idx.push(i);
    const r = scoreSelection(idx.map((i) => dice[i]));
    if (r.valid) out.push({ indices: idx, score: r.score });
  }
  return out;
}

/** El mejor apartado posible (máxima puntuación) de un tiro. */
export function bestKeep(dice) {
  const keeps = validKeeps(dice);
  if (keeps.length === 0) return null;
  keeps.sort((a, b) => b.score - a.score || a.indices.length - b.indices.length);
  return keeps[0];
}

/** Probabilidad aproximada de farklear al tirar n dados. */
export const FARKLE_ODDS = { 1: 0.667, 2: 0.444, 3: 0.278, 4: 0.157, 5: 0.077, 6: 0.023 };

/** Ganancia media aproximada de un tiro de n dados (cuando no farklea). */
export const AVG_GAIN = { 1: 25, 2: 55, 3: 90, 4: 145, 5: 230, 6: 400 };

/**
 * Valor esperado de seguir tirando.
 * remaining = dados que quedarían (0 significa "dados calientes" → se tiran 6).
 */
export function expectedValueOfRolling(remaining, turnPoints) {
  const n = remaining === 0 ? 6 : remaining;
  const risk = FARKLE_ODDS[n];
  return (1 - risk) * AVG_GAIN[n] - risk * turnPoints;
}

/** Etiqueta legible de una combinación, para el log de la mesa. */
export function describeSelection(dice) {
  const c = counts(dice);
  const n = dice.length;
  if (n === 6 && c.slice(1).every((x) => x === 1)) return 'Escalera';
  if (n === 6 && c.slice(1).filter((x) => x === 2).length === 3) return 'Tres pares';
  if (n === 5 && [1, 2, 3, 4, 5].every((v) => c[v] === 1)) return 'Escalera 1–5';
  if (n === 6 && c.slice(1).filter((x) => x === 3).length === 2) return 'Dos tríos';
  if (n === 6 && c.slice(1).some((x) => x === 4) && c.slice(1).some((x) => x === 2)) return 'Póker + pareja';
  const parts = [];
  for (let v = 1; v <= 6; v++) {
    const k = c[v];
    if (k >= 3) parts.push(`${k}×${v}`);
    else if (k > 0 && (v === 1 || v === 5)) parts.push(k > 1 ? `${k} ${v}s` : `un ${v}`);
  }
  return parts.join(' + ') || '—';
}
