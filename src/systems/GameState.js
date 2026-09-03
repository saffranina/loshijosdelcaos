// GameState.js — estado global de la partida. Un solo objeto compartido entre escenas.

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
    this.sobriety = 1.0;          // 1 = lúcido, 0 = destruido
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
    this.accusationsMade = 0;
    this.falseAccusations = 0;

    this.ending = null;
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
   * Los endings secretos tienen prioridad sobre los principales (ver GDD §8).
   * @param {'rein'|'daku'|'tie'} loser quién se quedó sin ropa
   */
  resolveEnding(loser) {
    if (loser === 'daku') {
      this.ending = 'rein_wins';
    } else {
      this.ending = 'daku_wins';
    }
    return this.ending;
  }
}

export const GameState = new State();
