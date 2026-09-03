// DakuAI.js — decisiones de riesgo y sistema de trampas (telekinesis).

import { validKeeps, expectedValueOfRolling, hasScoring } from './FarkleLogic.js';

export class DakuAI {
  constructor(config) {
    this.config = config;
    this.aggression = config.ai_aggression ?? 0.6;
    this.cheatProbability = config.cheat_probability ?? 0.25;
    this.caughtStreak = 0;   // si lo pillan seguido, se vuelve más cuidadoso
    this.cheatsThisGame = 0;
  }

  // ------------------------------------------------------------------
  // Decisiones de dados
  // ------------------------------------------------------------------

  /**
   * Elige qué apartar. No siempre agarra todo: a veces deja un 5 suelto
   * para tener más dados que tirar.
   * @returns {{indices:number[], score:number}|null}
   */
  chooseKeep(dice, turnPoints) {
    const keeps = validKeeps(dice);
    if (keeps.length === 0) return null;

    let best = null;
    let bestValue = -Infinity;
    for (const k of keeps) {
      const remaining = dice.length - k.indices.length;
      const pts = turnPoints + k.score;
      // Valor = puntos apartados + lo que espera sacar si sigue tirando.
      const contValue = Math.max(0, expectedValueOfRolling(remaining, pts));
      const value = k.score + contValue * this.aggression;
      if (value > bestValue) {
        bestValue = value;
        best = k;
      }
    }
    return best;
  }

  /**
   * ¿Sigue tirando o se planta?
   * @param {object} ctx { turnPoints, remaining, myRound, oppRound, target, mustBeat }
   */
  shouldContinue(ctx) {
    const { turnPoints, remaining, myRound, oppRound, target, mustBeat } = ctx;

    // Si es su última oportunidad y va perdiendo, tira hasta pasar al otro.
    if (mustBeat != null && myRound + turnPoints <= mustBeat) return true;

    // Si ya llegó a la meta, guarda (salvo que siga por debajo del rival).
    if (myRound + turnPoints >= target && myRound + turnPoints > oppRound) return false;

    const ev = expectedValueOfRolling(remaining, turnPoints);
    // La agresividad inclina la balanza: 0.6 ≈ arriesga un poco de más.
    const bias = (this.aggression - 0.5) * 120;
    return ev + bias > 0;
  }

  // ------------------------------------------------------------------
  // Trampas
  // ------------------------------------------------------------------

  /**
   * ¿Intenta hacer trampa en este tiro?
   * Trampas chicas al principio (para que el jugador gaste EMP),
   * grandes al final. Si lo pillaron seguido, baja la frecuencia.
   */
  wantsToCheat(state) {
    let p = this.cheatProbability;

    // Más tentado cuando va perdiendo.
    if (state.dakuLost > state.reinLost) p += 0.12;

    // Si lo pillaron las últimas veces, se contiene.
    p -= this.caughtStreak * 0.07;

    return Math.random() < Math.max(0.03, p);
  }

  /**
   * Planea qué dado tocar. Prefiere el cambio que más puntos gana,
   * pero en rondas tempranas se conforma con una trampa chica.
   * @returns {{index:number, from:number, to:number, magnitude:'small'|'big'}|null}
   */
  planCheat(dice, round) {
    const early = round <= 2;
    const candidates = [];

    for (let i = 0; i < dice.length; i++) {
      for (let v = 1; v <= 6; v++) {
        if (v === dice[i]) continue;
        const after = dice.slice();
        after[i] = v;
        const gain = this._roughScore(after) - this._roughScore(dice);
        if (gain <= 0) continue;
        // Un salto de 1 punto en la cara es menos visible que de 6 a 1.
        const visibility = Math.abs(v - dice[i]);
        candidates.push({
          index: i,
          from: dice[i],
          to: v,
          gain,
          visibility,
          magnitude: gain >= 200 ? 'big' : 'small',
        });
      }
    }
    if (candidates.length === 0) return null;

    const pool = early
      ? candidates.filter((c) => c.magnitude === 'small')
      : candidates.filter((c) => c.magnitude === 'big');
    const use = pool.length ? pool : candidates;

    // Entre los del pool elegido, el que más gana; a igualdad, el menos visible.
    use.sort((a, b) => b.gain - a.gain || a.visibility - b.visibility);
    const pick = use[0];
    return { index: pick.index, from: pick.from, to: pick.to, magnitude: pick.magnitude };
  }

  /** Puntuación aproximada del tiro completo (solo para comparar opciones). */
  _roughScore(dice) {
    const keeps = validKeeps(dice);
    if (!keeps.length) return 0;
    return Math.max(...keeps.map((k) => k.score));
  }

  /** Cuánto dura el destello de la trampa. Más borracho = más difícil de ver. */
  cheatFlashMs(drunkenness) {
    const sober = this.config.cheat_flash_ms_sober ?? 520;
    const drunk = this.config.cheat_flash_ms_drunk ?? 170;
    return Math.round(sober + (drunk - sober) * drunkenness);
  }

  notifyCaught() { this.caughtStreak++; }
  notifyMissed() { this.caughtStreak = Math.max(0, this.caughtStreak - 1); }
}

export { hasScoring };
