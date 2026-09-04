// GameState.js — estado global de la partida. Un solo objeto compartido entre escenas.

import { difficultyConfig } from './Mechanics.js';
import { Achievements } from './Achievements.js';

export const GARMENTS = ['shirt', 'pants', 'underwear'];

export const GARMENT_ES = {
  jacket: 'chaqueta',
  shoes: 'zapatos',
  socks: 'medias',
  shirt: 'camisa',
  pants: 'pantalón',
  underwear: 'ropa interior',
};

class State {
  constructor() {
    this.config = null;
    this.baseConfig = null;
    this.mechanics = null;
    this.selectedDifficulty = 'normal';
    this.dialogues = null;
    this.reset();
  }

  reset(config = this.config) {
    this.config = config;
    const c = config || {};

    // Narrativa
    this.esryBranch = null;       // 'esry_aggressive' | 'esry_diplomatic' | 'esry_direct'
    this.lastTone = null;         // 'provoke' | 'flirt' | 'stoic'

    // Ropa: tres prendas, una en juego por cada ronda.
    this.reinLost = 0;
    this.dakuLost = 0;

    // Recursos
    this.emp = c.starting_emp ?? 3;
    this.maxEmp = c.max_emp ?? 5;
    this.sobriety = c.starting_sobriety ?? 1.0;
    this.drinks = 0;

    // Partida
    this.round = 1;
    this.reinRoundsWon = 0;
    this.dakuRoundsWon = 0;
    this.doubleOrNothing = false;
    this.donOffered = false;

    // Registro de trampas (define los endings secretos)
    this.cheatsTotal = 0;
    this.cheatsCaught = 0;
    this.correctAccusations = 0;
    this.accusationsMade = 0;
    this.falseAccusations = 0;
    this.defensesMade = 0;
    this.successfulDefenses = 0;
    this.falseDefenses = 0;

    this.ending = null;
    this.prelude = null;
    this.achievementsFinalized = false;
  }

  setDifficulty(key) {
    this.selectedDifficulty = key;
    this.config = difficultyConfig(this.baseConfig || this.config || {}, this.mechanics, key);
    return this.config;
  }

  startNewGame() {
    this.setDifficulty(this.selectedDifficulty);
    this.reset(this.config);
    Achievements.beginRun(this.selectedDifficulty);
  }

  /** Aplica la dificultad elegida al terminar el tutorial sin perder la rama narrativa. */
  prepareFarkle() {
    const esryBranch = this.esryBranch;
    this.setDifficulty(this.selectedDifficulty);
    this.reset(this.config);
    this.esryBranch = esryBranch;
    Achievements.beginRun(this.selectedDifficulty);
  }

  // ---- ropa ----
  remaining(who) {
    return GARMENTS.length - (who === 'rein' ? this.reinLost : this.dakuLost);
  }

  /** Devuelve las claves de las tres prendas que se pierden, en orden. */
  loseGarments(who, count = 1) {
    const lost = [];
    for (let i = 0; i < count; i++) {
      const already = who === 'rein' ? this.reinLost : this.dakuLost;
      if (already >= GARMENTS.length) break;
      lost.push(GARMENTS[already]);
      if (who === 'rein') this.reinLost++;
      else this.dakuLost++;
    }
    return lost;
  }

  isNaked(who) {
    return this.remaining(who) <= 0;
  }

  /**
   * Qué portrait corresponde según la ropa que le queda.
   * Vive acá y no en ClothingManager porque también lo necesitan las escenas
   * de novela visual: en los endings hay que mostrar a quien perdió como
   * quedó, no vestido.
   * @param {'rein'|'daku'} who
   * @returns {'clothed'|'shirtless'|'underwear'}
   */
  clothingStage(who) {
    const lost = who === 'rein' ? this.reinLost : this.dakuLost;
    if (lost >= 2) return 'underwear';
    if (lost >= 1) return 'shirtless';
    return 'clothed';
  }

  /** Nivel de desnudez para elegir el pool de taunts. */
  nakednessLevel(who) {
    const lost = who === 'rein' ? this.reinLost : this.dakuLost;
    if (lost === 0) return 'clothed';
    if (lost === 1) return 'half_stripped';
    return 'nearly_naked';
  }

  /** El nivel de la escena combina a los dos: manda el más desnudo. */
  sceneLevel() {
    const lost = Math.max(this.reinLost, this.dakuLost);
    if (lost === 0) return 'clothed';
    if (lost === 1) return 'half_stripped';
    return 'nearly_naked';
  }

  // ---- recursos ----
  spendEmp() {
    if (this.emp <= 0) return false;
    this.emp--;
    return true;
  }

  drink() {
    const c = this.config || {};
    this.drinks++;
    this.emp = Math.min(this.maxEmp, this.emp + (c.emp_per_drink ?? 1));
    this.sobriety = Math.max(0, this.sobriety - (c.sobriety_loss_per_drink ?? 0.2));
  }

  restoreResources(empStages = 0, sobrietyStages = 0) {
    const step = this.config?.sobriety_loss_per_drink ?? 0.2;
    this.emp = Math.min(this.maxEmp, this.emp + empStages);
    this.sobriety = Math.min(1, this.sobriety + sobrietyStages * step);
  }

  /** 0 = sobrio, 1 = ciego. Se usa para escalar los efectos visuales. */
  get drunkenness() {
    return 1 - this.sobriety;
  }

  // ---- endings ----
  /**
   * Quién se quedó sin las tres prendas.
   *
   * No hay empate: cada ronda la pierde uno solo, así que los dos no pueden
   * quedarse sin ropa a la vez. El ending de empate se quitó por eso.
   *
   * @param {'rein'|'daku'} loser
   */
  resolveEnding(loser) {
    this.ending = loser === 'daku' ? 'rein_wins' : 'daku_wins';
    this.prelude = this.resolvePrelude();
    return this.ending;
  }

  /**
   * Escena que se juega ANTES del final, según cómo se leyó a Daku.
   *
   * No sustituye al final: quien gana sigue ganando y se ve su splash. Esto
   * es un momento extra que se gana jugando de una forma concreta.
   *
   * Las dos condiciones no pueden darse a la vez: cazarlas todas exige haber
   * acusado, y la otra exige no haber acusado nunca.
   *
   * @returns {'all_caught'|'none_caught'|null}
   */
  resolvePrelude() {
    const c = this.config || {};

    // Las vio todas y no acusó ni una vez de más.
    const minCazadas = c.all_caught_min_cheats ?? 1;
    if (this.cheatsTotal >= minCazadas &&
        this.cheatsCaught === this.cheatsTotal &&
        this.falseAccusations === 0 && this.falseDefenses === 0) {
      return 'all_caught';
    }

    // Daku hizo trampa varias veces y el jugador no dijo nada en toda la noche.
    const minCallado = c.none_caught_min_cheats ?? 3;
    if (this.cheatsTotal >= minCallado && this.accusationsMade === 0 && this.defensesMade === 0) {
      return 'none_caught';
    }

    return null;
  }
}

export const GameState = new State();
