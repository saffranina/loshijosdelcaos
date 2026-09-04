// FarkleScene.js — Acto 3. El mini juego completo: dados, trampas, EMP, alcohol y ropa.
//
// Flujo de una ronda:
//   taunt del jugador → respuesta de Daku → (¿doble o nada?) → turnos alternados
//   → alguien llega a la meta → el otro tiene un último turno → se compara → strip.
//
// La trampa de Daku ocurre MIENTRAS el jugador lee el taunt o pide un trago.
// El juego nunca avisa que hubo trampa: el botón de acusar aparece siempre.

import { C, F } from '../theme.js';
import { paintBackdrop, makeButton, panel } from '../systems/Ui.js';
import { PortraitView } from '../systems/Portraits.js';
import { DialogueSystem } from '../systems/DialogueSystem.js';
import { Die } from '../systems/Dice.js';
import { EMPSystem } from '../systems/EMPSystem.js';
import { DrinkSystem } from '../systems/DrinkSystem.js';
import { ClothingManager } from '../systems/ClothingManager.js';
import { DakuAI } from '../systems/DakuAI.js';
import { GameState } from '../systems/GameState.js';
import * as Achievements from '../systems/Achievements.js';
import { playMusic } from '../systems/Music.js';
import { dadoElegido, dadosLanzados } from '../systems/Sfx.js';
import {
  rollDice, hasScoring, scoreSelection, describeSelection,
} from '../systems/FarkleLogic.js';

const PLAY_Y = 205;
const KEPT_Y = 292;
const DIE_SIZE = 54;
const MAX_TURNS_PER_ROUND = 16;   // red de seguridad contra rondas infinitas

const TONES = [
  { key: 'provoke', label: '🗡️ Provocar', daku: 'vs_provoke' },
  { key: 'flirt',   label: '😏 Coquetear', daku: 'vs_flirt' },
  { key: 'stoic',   label: '😐 Estoico',   daku: 'vs_stoic' },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Normaliza una entrada de un pool de diálogo.
 *
 * Una entrada puede ser de dos formas:
 *   "texto"                   una sola línea, la dice `porDefecto`
 *   [{ speaker, text }, ...]  un intercambio: una línea y su respuesta
 *
 * Lo segundo hace falta porque hay parejas escritas para ir juntas — la
 * respuesta solo tiene sentido después de SU línea. Sorteando los dos pools
 * por separado se emparejaban al azar y la contestación no venía a cuento.
 */
const lineasDe = (entrada, porDefecto, expresion) => (
  typeof entrada === 'string'
    ? [{ speaker: porDefecto, expression: expresion, text: entrada }]
    : entrada.map((l) => ({
        speaker: l.speaker,
        expression: l.expression || expresion,
        text: l.text,
      }))
);

export class FarkleScene extends Phaser.Scene {
  constructor() { super('Farkle'); }

  create() {
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.d = GameState.dialogues;
    this.cfg = GameState.config;
    this.ai = new DakuAI(this.cfg);
    playMusic(this, 'music_farkle');

    this.target = this.cfg.round_target;
    this.busy = false;
    this.lastRestoredRound = 1;

    this.buildUi();
    this.startGame();
  }

  // ==================================================================
  // Construcción de la pantalla
  // ==================================================================

  buildUi() {
    const { width } = this.scale;

    const tableBg = this.textures.exists('bg_farkle') ? 'bg_farkle' : 'bg_room';
    if (this.textures.exists(tableBg)) {
      const img = this.add.image(width / 2, 300, tableBg);
      const src = this.textures.get(tableBg).getSourceImage();
      img.setScale(Math.max(width / src.width, 600 / src.height));
      this.add.rectangle(0, 0, width, 600, 0x000000, 0.42).setOrigin(0);
    } else {
      paintBackdrop(this, C.roomWarm, C.roomDark);
    }

    // ---- cabecera ----
    panel(this, 12, 8, width - 24, 56, { alpha: 0.6, radius: 3 });

    this.reinScoreText = this.add.text(24, 14, '', {
      fontFamily: F.title, fontSize: '17px', color: C.reinName,
    }).setDepth(60);
    this.dakuScoreText = this.add.text(width - 24, 14, '', {
      fontFamily: F.title, fontSize: '17px', color: C.dakuName,
    }).setOrigin(1, 0).setDepth(60);
    this.roundText = this.add.text(width / 2, 14, '', {
      fontFamily: F.body, fontSize: '13px', color: C.textDim, letterSpacing: 1,
    }).setOrigin(0.5, 0).setDepth(60);
    // Cartel grande de turno. Va en el centro de la mesa, encima de los dados:
    // es lo primero que hay que saber al mirar la pantalla.
    this.turnBanner = this.add.text(width / 2, 120, '', {
      fontFamily: F.title, fontSize: '27px', color: '#f4f7fa',
    }).setOrigin(0.5).setDepth(80).setAlpha(0);

    this.turnPointsText = this.add.text(width / 2, 40, '', {
      fontFamily: F.body, fontSize: '13px', color: C.lamp,
    }).setOrigin(0.5, 0).setDepth(60);

    this.emp = new EMPSystem(this, 24, 38);
    this.drinks = new DrinkSystem(this, 235, 38);

    // ---- portraits + ropa ----
    this.portraits = {
      rein: new PortraitView(this, { x: 100, y: 245, width: 152, height: 216, who: 'rein' }),
      daku: new PortraitView(this, { x: 700, y: 245, width: 152, height: 216, who: 'daku' }),
    };
    this.portraits.rein.setExpression('neutral').setActive(false);
    this.portraits.daku.setExpression('smile').setActive(false);

    this.clothing = {
      rein: new ClothingManager(this, { who: 'rein', x: 100, y: 358, portrait: this.portraits.rein }),
      daku: new ClothingManager(this, { who: 'daku', x: 700, y: 358, portrait: this.portraits.daku }),
    };

    // ---- dados ----
    this.dice = [];
    for (let i = 0; i < this.cfg.dice_count; i++) {
      const die = new Die(this, 0, PLAY_Y, DIE_SIZE, (d) => this.onDieClick(d));
      die.setDepth(50).setVisible(false);
      this.dice.push(die);
    }
    this.active = [];    // índices en juego este tiro
    this.kept = [];      // índices apartados este turno
    this.selected = new Set();

    this.tableText = this.add.text(width / 2, 336, '', {
      fontFamily: F.body, fontSize: '14px', color: C.textDim, align: 'center',
    }).setOrigin(0.5, 0).setDepth(60).setInteractive({ useHandCursor: true });
    this.tableText.on('pointerdown', () => this.clearSelection());
    this.input.keyboard.on('keydown-ESC', () => this.clearSelection());

    // ---- botones de acción ----
    this.buttons = {
      a: makeButton(this, 400 - 152, 384, 142, 34, '', () => {}, { fontSize: 13 }),
      b: makeButton(this, 400, 384, 142, 34, '', () => {}, { fontSize: 13 }),
      c: makeButton(this, 400 + 152, 384, 142, 34, '', () => {}, { fontSize: 13 }),
    };
    Object.values(this.buttons).forEach((b) => b.setDepth(70).setVisible(false));

    // Consultar las reglas sin perder la partida. Siempre visible: las reglas
    // del Farkle no se retienen a la primera y no queremos que haya que
    // abandonar la ronda para mirarlas.
    makeButton(this, 752, 82, 78, 24, '? Reglas', () => this.abrirReglas(), { fontSize: 12 })
      .setDepth(70);

    // ---- diálogo ----
    this.dialogue = new DialogueSystem(this, {
      y: 418, h: 166,
      onSpeaker: (speaker, expression) => this.showSpeaker(speaker, expression),
    });

    this.refreshHud();
    Achievements.setScene(this);
  }

  showSpeaker(speaker, expression) {
    for (const who of ['rein', 'daku']) {
      const p = this.portraits[who];
      p.setActive(who === speaker);
      if (who === speaker && expression) p.setExpression(expression);
    }
  }

  /**
   * Abre las reglas encima de la partida, sin reiniciarla.
   *
   * Pausar la escena en vez de cambiarla es lo que conserva los puntos de la
   * ronda, los dados en la mesa y de quién es el turno. El cuadro de diálogo
   * se esconde a mano porque es una capa HTML sobre el canvas: si no, se vería
   * por encima del tutorial.
   */
  abrirReglas() {
    // Sin condiciones: antes había un `if (this.busy) return` y el botón moría
    // en silencio durante cualquier animación, que es justo cuando uno se
    // queda mirando la pantalla y quiere consultar las reglas.
    this.dialogue.setVisible(false);
    this.events.once('resume', () => this.dialogue.setVisible(true));
    this.scene.pause();
    this.scene.launch('Tutorial', { volverA: 'Farkle' });
  }

  refreshHud() {
    const s = GameState;
    this.reinScoreText.setText(`REINHART   ${this.reinRound ?? 0}`);
    this.dakuScoreText.setText(`${this.dakuRound ?? 0}   DAKU`);
    const don = this.don ? '  ·  DOBLE O NADA' : '';
    // Sin contador de rondas: lo que importa es la ropa, y eso ya se ve en
    // los medidores debajo de cada retrato.
    this.roundText.setText(`META ${this.target}${don}`);
    this.emp.refresh();
    this.drinks.refresh();
    this.clothing.rein.refresh();
    this.clothing.daku.refresh();
  }

  setButtons(defs) {
    const keys = ['a', 'b', 'c'];
    keys.forEach((k, i) => {
      const btn = this.buttons[k];
      const def = defs[i];
      if (!def) { btn.setVisible(false); return; }
      btn.setVisible(true).setLabel(def.label).setEnabled(def.enabled !== false);
      btn.setAction(def.onClick);
    });
  }

  hideButtons() {
    Object.values(this.buttons).forEach((b) => b.setVisible(false));
  }

  // ==================================================================
  // Ciclo de la partida
  // ==================================================================

  startGame() {
    this.dialogue.play(this.d.act3.start, () => this.startRound());
  }

  startRound() {
    if (GameState.round > 1 && this.lastRestoredRound !== GameState.round) {
      GameState.restoreResources(1, 1);
      this.lastRestoredRound = GameState.round;
    }
    this.reinRound = 0;
    this.dakuRound = 0;
    this.rondaSoloUnosYCincos = true;
    this.target = this.cfg.round_target;
    this.lastChance = null;
    this.turnsThisRound = 0;
    this.don = false;
    this.reinSkipsTurn = this.reinSkipsTurn || false;
    this.refreshHud();
    this.clearDice();

    // Cada ronda disputa una sola prenda; se juegan las que hagan falta hasta
    // que alguien se quede sin las tres (ver checkGameOver).
    if (GameState.round === 1) this.beginTurn('rein');
    else this.tauntPhase(() => this.offerDoubleOrNothing(() => this.beginTurn('rein')));
  }

  /** El jugador elige el tono; Daku responde. Es también un momento de distracción. */
  tauntPhase(next) {
    const level = GameState.sceneLevel();
    this.dialogue.choices(
      TONES.map((t) => ({ label: t.label })),
      (idx) => {
        const tone = TONES[idx];
        GameState.lastTone = tone.key;
        GameState.tonosUsados.add(tone.key);
        if (tone.key === 'flirt' && GameState.nakednessLevel('rein') === 'nearly_naked') {
          Achievements.unlock('tension_insostenible');
        }
        const reinEntry = pick(this.d.act3.rein_taunts[tone.key][level]);

        // Intercambio ya escrito de principio a fin: se juega tal cual y no se
        // le pega encima una respuesta sorteada de otro sitio.
        if (typeof reinEntry !== 'string') {
          this.dialogue.play(lineasDe(reinEntry, 'rein', 'smug'), next);
          return;
        }

        const reinLine = reinEntry;
        const dakuEntry = pick(this.d.act3.daku_taunts[tone.daku][level]);
        const stoic = tone.key === 'stoic';
        this.dialogue.say(
          { speaker: stoic && reinLine.startsWith('(') ? 'stage' : 'rein',
            expression: stoic ? 'neutral' : tone.key === 'flirt' ? 'flirty' : 'smug',
            text: stoic && reinLine.startsWith('(') ? reinLine.slice(1, -1) : reinLine },
          () => this.dialogue.play(lineasDe(dakuEntry, 'daku', 'flirty'), next)
        );
      },
      { prompt: 'Tu turno de hablar.' }
    );
  }

  /**
   * Doble o nada. Lo puede proponer cualquiera de los dos.
   *
   * Antes esto era código muerto: existía el método, nadie lo llamaba, y al
   * perder la ronda se quitaba una prenda igual. Ahora hace algo de verdad y
   * cambia según la dificultad:
   *
   *   tipo 'puntos'   la ronda vale el doble (fácil de digerir)
   *   tipo 'prendas'  quien pierda se quita dos en vez de una
   *
   * Rein solo puede proponerlo con algo encima: por debajo de cierta
   * sobriedad. Sobrio no se le ocurre.
   */
  offerDoubleOrNothing(next) {
    const c = this.cfg;
    if (!c.don_enabled || this.don) { next(); return; }

    const don = this.d.act3.double_or_nothing;
    const nuevos = GameState.mecanicas?.doble_o_nada_dialogos;

    const dakuVaPerdiendo = GameState.dakuLost > GameState.reinLost;
    const dakuQuiere = c.don_daku_always
      || (c.don_daku_when_losing && dakuVaPerdiendo && Math.random() < c.don_daku_chance);

    if (dakuQuiere && !GameState.donOffered) {
      GameState.donOffered = true;
      this.dakuProponeDon(nuevos, don, next);
      return;
    }

    // Rein necesita haber bebido algo para atreverse.
    const reinPuede = nuevos && GameState.sobriety < (c.don_rein_sobriety ?? 0);
    if (reinPuede) { this.ofrecerDonAlJugador(nuevos, next); return; }

    next();
  }

  dakuProponeDon(nuevos, viejo, next) {
    const propuesta = nuevos?.daku_propone?.propuesta || [viejo?.propose].filter(Boolean);
    this.dialogue.play(propuesta, () => {
      this.dialogue.choices(
        [{ label: 'Acepto' }, { label: 'No' }],
        (idx) => {
          const acepta = idx === 0;
          const respuesta = acepta
            ? nuevos?.daku_propone?.rein_acepta
            : nuevos?.daku_propone?.rein_rechaza;
          if (acepta) this.activarDon('daku');
          this.dialogue.play(respuesta || [], next);
        },
        { prompt: 'Doble o nada.' }
      );
    });
  }

  ofrecerDonAlJugador(nuevos, next) {
    this.dialogue.choices(
      [{ label: 'Doble o nada' }, { label: 'Jugar normal' }],
      (idx) => {
        if (idx !== 0) { next(); return; }
        GameState.donPropuestasRein++;
        if (GameState.donPropuestasRein >= 3) Achievements.unlock('jugador_compulsivo');
        this.activarDon('rein');
        // Daku contesta según el tono que Rein venga usando.
        const tono = GameState.lastTone === 'flirt' ? 'coquetear'
          : GameState.lastTone === 'stoic' ? 'estoico' : 'provocar';
        this.dialogue.play(nuevos.rein_propone[tono] || [], next);
      },
      { prompt: '¿Subes la apuesta?' }
    );
  }

  activarDon(quienLoPropuso) {
    this.don = true;
    this.donAutor = quienLoPropuso;

    // Tipo 'puntos': la ronda se juega a la meta doble. Es la lectura que le
    // damos a "la ronda vale el doble" — la ronda se hace larga y arriesgada,
    // con más ocasiones de hacer Farkle, pero la ropa que se juega sigue
    // siendo una prenda.
    // Tipo 'prendas': la meta no cambia y quien pierda se quita dos.
    if (this.cfg.don_type === 'puntos') {
      this.target = this.cfg.round_target * (this.cfg.don_multiplier ?? 2);
    }
    this.refreshHud();
  }

  /**
   * Anuncia de quién es el turno con un cartel que entra y se va solo.
   * Antes había que deducirlo del texto chico de la acotación.
   */
  anunciarTurno(who) {
    const nombre = who === 'rein' ? 'Turno de Rein' : 'Turno de Daku';
    this.turnBanner.setText(nombre)
      .setColor(who === 'rein' ? C.reinName : C.dakuName)
      .setAlpha(0)
      .setScale(0.92);
    this.tweens.killTweensOf(this.turnBanner);
    this.tweens.add({
      targets: this.turnBanner,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.92, to: 1 },
      duration: 260,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 850,
    });
  }

  beginTurn(who) {
    this.turn = who;
    this.turnPoints = 0;
    this.tirosEsteTurno = 0;
    this.clearDice();
    this.turnsThisRound++;

    if (this.turnsThisRound > MAX_TURNS_PER_ROUND) { this.endRound(); return; }

    this.anunciarTurno(who);

    if (who === 'rein' && this.reinSkipsTurn) {
      this.reinSkipsTurn = false;
      this.dialogue.note('stage', 'Rein pierde el turno.');
      this.time.delayedCall(1100, () => this.endTurn('rein'));
      return;
    }

    this.refreshHud();
    if (who === 'rein') this.playerRoll();
    else this.dakuStep();
  }

  endTurn(who) {
    this.hideButtons();
    this.selected.clear();

    if (this.lastChance === who) { this.endRound(); return; }

    const score = who === 'rein' ? this.reinRound : this.dakuRound;
    const other = who === 'rein' ? 'daku' : 'rein';
    if (score >= this.target && this.lastChance === null) {
      this.lastChance = other;
      this.dialogue.note('stage',
        `${who === 'rein' ? 'Rein' : 'Daku'} llegó a la meta. ` +
        `${other === 'rein' ? 'Rein tiene' : 'Daku tiene'} un último turno.`);
      this.time.delayedCall(1400, () => this.beginTurn(other));
      return;
    }
    this.beginTurn(other);
  }

  // ==================================================================
  // Dados
  // ==================================================================

  clearDice() {
    this.active = [];
    this.kept = [];
    this.selected.clear();
    this.dice.forEach((d) => { d.setVisible(false).setKept(false).setSelected(false); d.container.setScale(1); });
    this.tableText.setText('');
  }

  layoutDice() {
    const drunk = this.turn === 'rein' ? GameState.drunkenness : GameState.drunkenness * 0.6;

    const spread = (indices, y, scale) => {
      const gap = DIE_SIZE * scale + 10;
      const total = indices.length * gap - 10;
      indices.forEach((i, n) => {
        const d = this.dice[i];
        d.setVisible(true);
        d.container.setScale(scale);
        d.setPosition(this.scale.width / 2 - total / 2 + gap * n + (DIE_SIZE * scale) / 2, y);
        d.setDrunk(drunk);
      });
    };
    spread(this.active, PLAY_Y, 1);
    spread(this.kept, KEPT_Y, 0.72);
  }

  /** Devuelve los índices que participarían en el próximo tiro. */
  availableCount() {
    return this.cfg.dice_count - this.kept.length;
  }

  rollFor(who, onDone) {
    // Dados calientes: si apartó los 6, vuelve a tirar los 6.
    if (this.kept.length >= this.cfg.dice_count) {
      this.kept = [];
      this.dice.forEach((d) => d.setKept(false));
    }
    const keptSet = new Set(this.kept);
    this.active = this.dice.map((_, i) => i).filter((i) => !keptSet.has(i));
    this.selected.clear();

    const values = rollDice(this.active.length);
    this.layoutDice();
    dadosLanzados(this.active.length);

    let pending = this.active.length;
    this.active.forEach((idx, n) => {
      this.dice[idx].rollTo(values[n], 430 + n * 25, () => {
        pending--;
        if (pending === 0) onDone(values);
      });
    });
  }

  currentValues() { return this.active.map((i) => this.dice[i].value); }
  selectedValues() { return [...this.selected].map((i) => this.dice[i].value); }

  clearSelection() {
    if (this.busy || this.turn !== 'rein' || !this.selectable || this.selected.size === 0) return;
    this.selected.forEach((i) => this.dice[i].setSelected(false));
    this.selected.clear();
    this.updateSelectionUi();
  }

  onDieClick(die) {
    if (this.busy || this.turn !== 'rein' || !this.selectable) return;
    const idx = this.dice.indexOf(die);
    if (!this.active.includes(idx)) return;
    if (this.selected.has(idx)) this.selected.delete(idx);
    else this.selected.add(idx);
    die.setSelected(this.selected.has(idx));
    dadoElegido();
    this.updateSelectionUi();
  }

  updateSelectionUi() {
    const vals = this.selectedValues();
    const r = scoreSelection(vals);
    if (vals.length === 0) {
      this.tableText.setText('Elige los dados que quieres apartar.');
    } else if (!r.valid) {
      this.tableText.setText(`Dados elegidos: ${vals.join(', ')} · Esa selección no puntúa · Clic aquí o Esc para limpiar`);
    } else {
      this.tableText.setText(`${describeSelection(vals)}  →  +${r.score} · Clic aquí o Esc para limpiar`);
    }

    const ok = r.valid;
    this.selected.forEach((i) => this.dice[i].setSelectionValid(ok));
    this.buttons.a.setEnabled(ok);
    this.buttons.b.setEnabled(ok);
  }

  // ==================================================================
  // Turno de Rein
  // ==================================================================

  playerRoll() {
    this.tirosEsteTurno = (this.tirosEsteTurno || 0) + 1;
    this.busy = true;
    this.selectable = false;
    this.hideButtons();
    this.dialogue.note('stage', `Turno de Rein — ${this.turnPoints} en la mesa.`);
    this.portraits.rein.setExpression('dice');

    this.rollFor('rein', (values) => {
      this.busy = false;
      if (!hasScoring(values)) { this.playerFarkle(); return; }
      this.selectable = true;
      this.updateSelectionUi();
      this.setButtons([
        { label: 'Apartar y tirar', enabled: false, onClick: () => this.playerKeep(true) },
        { label: 'Apartar y plantarse', enabled: false, onClick: () => this.playerKeep(false) },
        { label: '🥃 Beber', enabled: GameState.sobriety > 0, onClick: () => this.playerDrink('turn') },
      ]);
    });
  }

  playerKeep(rollAgain) {
    if (this.busy) return;
    const vals = this.selectedValues();
    const r = scoreSelection(vals);
    if (!r.valid) return;
    this.busy = true;

    this.turnPoints += r.score;
    this.comprobarLogrosDeJugada(vals, r.score);
    this.selected.forEach((i) => { this.kept.push(i); this.dice[i].setKept(true); });
    this.active = this.active.filter((i) => !this.selected.has(i));
    this.selected.clear();
    this.selectable = false;
    this.hideButtons();
    this.layoutDice();
    this.turnPointsText.setText(`en la mesa: ${this.turnPoints}`);

    const seguir = () => {
      if (rollAgain) {
        if (this.turnPoints > 1500) Achievements.unlock('adicto_al_riesgo');
        this.time.delayedCall(320, () => this.playerRoll());
      } else this.playerBank();
    };
    if (!this.reaccionJugada('rein', r.score, seguir)) seguir();
  }

  /**
   * Reacción a una jugada grande: quien puntúa lo celebra y el otro contesta.
   *
   * Mira lo que vale UN apartado, no el total del turno: lo que impresiona es
   * sacar la escalera de una, no ir sumando de a cincuenta.
   *
   * Mientras no haya líneas escritas para esto no pasa nada — devuelve false y
   * el turno sigue su curso normal. Así el mecanismo puede existir antes que
   * el texto sin dejar el juego a medias.
   *
   * @returns {boolean} true si se puso a hablar (y llamará a `next` al acabar)
   */
  reaccionJugada(quien, puntos, next) {
    if (puntos <= (this.cfg.big_score_threshold ?? 1000)) return false;

    const pool = this.d.act3.big_score && this.d.act3.big_score[quien];
    if (!pool) return false;

    const otro = quien === 'rein' ? 'daku' : 'rein';
    const lines = [];
    if (pool[quien] && pool[quien].length) {
      lines.push({ speaker: quien, expression: 'smug', text: pick(pool[quien]) });
    }
    if (pool[otro] && pool[otro].length) {
      lines.push({ speaker: otro, expression: 'surprised', text: pick(pool[otro]) });
    }
    if (!lines.length) return false;

    this.dialogue.play(lines, next);
    return true;
  }

  /**
   * Logros que dependen de QUÉ apartó Rein, no de cuánto sumó.
   * Se mira la selección concreta, antes de que los dados se muevan.
   */
  comprobarLogrosDeJugada(vals, score) {
    const cuenta = {};
    vals.forEach((v) => { cuenta[v] = (cuenta[v] || 0) + 1; });
    const distintos = Object.keys(cuenta).length;

    // Escalera 1-6: los seis dados, todos distintos.
    if (vals.length === 6 && distintos === 6) Achievements.unlock('escalera_de_marfil');

    // Los seis dados apartados de una sola vez.
    if (vals.length === 6) Achievements.unlock('seis_de_seis');

    // Trío o mejor.
    if (Object.values(cuenta).some((n) => n >= 3)) GameState.triplesEnPartida++;

    // Dados calientes: apartó todo lo que quedaba en la mesa y por tanto
    // vuelve a tirar los seis.
    if (this.kept.length + vals.length >= this.cfg.dice_count) {
      Achievements.unlock('dados_calientes');
    }

    // Solo unos y cincos en toda la ronda.
    if (!vals.every((v) => v === 1 || v === 5)) this.rondaSoloUnosYCincos = false;
  }

  playerBank() {
    if (this.turnPoints > 0 && this.turnPoints < 200) Achievements.unlock('gallina');
    if (this.tirosEsteTurno === 1) Achievements.unlock('conservador');
    this.reinRound += this.turnPoints;
    this.turnPointsText.setText('');
    this.refreshHud();
    this.dialogue.note('stage', `Rein se planta con ${this.turnPoints}. Total de ronda: ${this.reinRound}.`);
    this.time.delayedCall(1300, () => this.endTurn('rein'));
  }

  playerFarkle() {
    if (this.turnPoints > 1000) Achievements.unlock('codicia');
    this.turnPoints = 0;
    this.turnPointsText.setText('');
    this.tableText.setText('');
    this.active.forEach((i) => this.dice[i].setDead(true));
    this.dialogue.note('stage', 'Farkle. Ningún dado puntúa. Rein pierde lo del turno.');
    this.cameras.main.shake(220, 0.004);
    this.time.delayedCall(1600, () => this.endTurn('rein'));
  }

  playerDrink(context, resume) {
    this.hideButtons();
    this.selectable = false;
    GameState.drink();
    GameState.bebioEnRondas.add(GameState.round);
    if (this.lastChance) Achievements.unlock('brindis');
    this.refreshHud();
    this.emp.pulse();
    this.drinks.applyCameraWobble();

    if (GameState.sobriety <= 0) {
      this.busy = true;
      this.dialogue.note('stage', 'El mundo se inclina. Rein ya no puede distinguir los dados.');
      this.time.delayedCall(1500, () => {
        GameState.ending = 'drunk_game_over';
        Achievements.alTerminarPartida(GameState);
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ending'));
      });
      return;
    }

    this.drinks.playDrinkAnimation(() => {
      // Beber es un hueco de atención: si hay dados de Daku en la mesa,
      // aprovecha para tocar uno.
      if (context === 'accuse' && !this.pendingCheat && this.ai.wantsToCheat(GameState)) {
        this.tryCheat();
      }
      this.afterDrinkDialogue(() => {
        this.dice.forEach((d) => d.setDrunk(
          this.turn === 'rein' ? GameState.drunkenness : GameState.drunkenness * 0.6));
        if (resume) resume();
        else {
          this.selectable = true;
          this.updateSelectionUi();
          this.setButtons([
            { label: 'Apartar y tirar', enabled: false, onClick: () => this.playerKeep(true) },
            { label: 'Apartar y plantarse', enabled: false, onClick: () => this.playerKeep(false) },
            { label: '🥃 Beber', enabled: GameState.sobriety > 0, onClick: () => this.playerDrink('turn') },
          ]);
          this.updateSelectionUi();
        }
      });
    });
  }

  afterDrinkDialogue(next) {
    const drink = this.d.act3.drink;
    if (GameState.sobriety <= 0.4 && !this._saidVeryDrunk) {
      this._saidVeryDrunk = true;
      this.dialogue.play(drink.very_drunk, next);
    } else if (GameState.drinks === 3 && !this._saidSeveral) {
      this._saidSeveral = true;
      this.dialogue.play(drink.several, next);
    } else {
      this.dialogue.say(drink.prompt, () => {
        this.dialogue.choices(drink.options.map((o) => ({ label: o.label })), (idx) => {
          const opt = drink.options[idx];
          this.dialogue.say({ speaker: 'daku', expression: opt.expression, text: opt.reply }, next);
        });
      });
    }
  }

  // ==================================================================
  // Turno de Daku
  // ==================================================================

  dakuStep() {
    this.busy = true;
    this.selectable = false;
    this.hideButtons();
    this.pendingCheat = null;
    this.dialogue.note('stage', `Turno de Daku — ${this.turnPoints} en la mesa.`);
    this.portraits.daku.setExpression('dice');

    this.time.delayedCall(500, () => {
      this.rollFor('daku', (values) => {
        this.busy = false;
        if (!hasScoring(values)) { this.dakuFarkle(); return; }
        this.dakuTaunt(values);
      });
    });
  }

  /**
   * Daku suelta un taunt. El jugador mira abajo a leerlo — y ahí cambia el dado.
   * Después aparecen SIEMPRE los botones de acusar, haya trampa o no.
   */
  dakuTaunt(values) {
    const level = GameState.sceneLevel();
    const toneKey = GameState.lastTone
      ? TONES.find((t) => t.key === GameState.lastTone).daku
      : 'vs_provoke';
    const entry = pick(this.d.act3.daku_taunts[toneKey][level]);

    const willCheat = this.ai.wantsToCheat(GameState);
    if (willCheat) this.time.delayedCall(900, () => this.tryCheat());

    this.dialogue.play(lineasDe(entry, 'daku', 'flirty'), () => {
      this.showAccuseWindow();
    });
  }

  tryCheat() {
    const values = this.currentValues();
    const plan = this.ai.planCheat(values, GameState.round);
    if (!plan) return;
    const dieIndex = this.active[plan.index];
    GameState.cheatsTotal++;
    this.pendingCheat = { dieIndex, ...plan };
    this.dice[dieIndex].cheatTo(plan.to, this.ai.cheatFlashMs(GameState.drunkenness));
  }

  showAccuseWindow() {
    const canAccuse = GameState.emp > 0;
    this.setButtons([
      {
        label: `⚡ Acusar trampa (${GameState.emp})`,
        enabled: canAccuse,
        onClick: () => this.accuse(),
      },
      {
        label: '🥃 Beber',
        enabled: GameState.sobriety > 0,
        onClick: () => this.playerDrink('accuse', () => this.showAccuseWindow()),
      },
      { label: 'Continuar', onClick: () => this.dakuDecide() },
    ]);
  }

  accuse() {
    this.hideButtons();
    if (!GameState.spendEmp()) return;
    GameState.accusationsMade++;
    if (GameState.emp === 0) Achievements.unlock('sin_bateria');
    this.emp.pulse();
    this.refreshHud();

    if (this.pendingCheat) {
      // Acierto: Daku pierde el turno.
      GameState.cheatsCaught++;
      GameState.falsasSeguidas = 0;
      Achievements.unlock('descarga');
      // Acusó con la última carga que le quedaba.
      if (GameState.emp === 0) Achievements.unlock('francotirador');
      const minSob = this.cfg.sobriety_loss_per_drink ?? 0.2;
      if (GameState.sobriety <= minSob + 0.001) Achievements.unlock('vision_doble');
      GameState.restoreResources(1, 2);
      this.ai.notifyCaught();
      this.pendingCheat = null;
      this.emp.pulse();
      this.refreshHud();
      this.dialogue.play(pick(this.d.act3.cheat_caught), () => {
        this.turnPoints = 0;
        this.turnPointsText.setText('');
        this.endTurn('daku');
      });
    } else {
      // Fallo: Rein pierde el turno siguiente.
      GameState.falseAccusations++;
      GameState.falsasSeguidas++;
      if (GameState.falsasSeguidas >= 2) Achievements.unlock('nunca_aprendes');
      if (GameState.round === 1) Achievements.unlock('gatillo_facil');
      this.ai.notifyMissed();
      this.reinSkipsTurn = true;
      this.dialogue.play(pick(this.d.act3.cheat_false), () => this.dakuDecide());
    }
  }

  dakuDecide() {
    this.hideButtons();
    const values = this.currentValues();
    const keep = this.ai.chooseKeep(values, this.turnPoints);
    if (!keep) { this.dakuFarkle(); return; }

    // Aparta lo elegido.
    const keptDice = keep.indices.map((i) => this.active[i]);
    keptDice.forEach((i) => { this.kept.push(i); this.dice[i].setKept(true); });
    this.active = this.active.filter((i) => !keptDice.includes(i));
    this.turnPoints += keep.score;
    this.turnPointsText.setText(`en la mesa: ${this.turnPoints}`);
    this.tableText.setText(
      `Daku aparta ${describeSelection(keptDice.map((i) => this.dice[i].value))}  →  +${keep.score}`);
    this.layoutDice();

    const remaining = this.availableCount();
    const cont = this.ai.shouldContinue({
      turnPoints: this.turnPoints,
      remaining,
      myRound: this.dakuRound,
      oppRound: this.reinRound,
      target: this.target,
      mustBeat: this.lastChance === 'daku' ? this.reinRound : null,
    });

    const seguir = () => this.time.delayedCall(1000, () => {
      if (cont) this.dakuStep();
      else this.dakuBank();
    });
    if (!this.reaccionJugada('daku', keep.score, seguir)) seguir();
  }

  dakuBank() {
    this.dakuRound += this.turnPoints;
    this.turnPointsText.setText('');
    this.refreshHud();
    this.dialogue.note('stage', `Daku se planta con ${this.turnPoints}. Total de ronda: ${this.dakuRound}.`);
    this.time.delayedCall(1300, () => this.endTurn('daku'));
  }

  dakuFarkle() {
    this.turnPoints = 0;
    this.turnPointsText.setText('');
    this.active.forEach((i) => this.dice[i].setDead(true));
    this.dialogue.note('stage', 'Farkle. Daku pierde lo del turno.');
    this.time.delayedCall(1600, () => this.endTurn('daku'));
  }

  // ==================================================================
  // Fin de ronda y de partida
  // ==================================================================

  endRound() {
    this.hideButtons();
    this.clearDice();
    this.refreshHud();

    if (this.reinRound === this.dakuRound) {
      this.dialogue.note('stage',
        `Empate a ${this.reinRound}. La misma prenda sigue en juego: desempate.`);
      this.time.delayedCall(1800, () => this.startRound());
      return;
    }

    const loser = this.reinRound < this.dakuRound ? 'rein' : 'daku';
    if (loser === 'rein') GameState.dakuRoundsWon++;
    else GameState.reinRoundsWon++;

    if (loser === 'daku' && this.rondaSoloUnosYCincos && this.reinRound > 0) {
      Achievements.unlock('de_uno_en_uno');
    }

    // Racha de rondas seguidas de Rein, para el logro correspondiente.
    GameState.rachaRondas = loser === 'daku' ? GameState.rachaRondas + 1 : 0;
    GameState.mejorRacha = Math.max(GameState.mejorRacha, GameState.rachaRondas);

    // Doble o nada: con el tipo 'prendas' la ronda cuesta dos en vez de una.
    // Con el tipo 'puntos' no cambia la ropa, solo lo que valía la ronda.
    const cuantas = (this.don && this.cfg.don_type === 'prendas')
      ? (this.cfg.don_garments ?? 2) : 1;
    const lost = GameState.loseGarments(loser, cuantas);

    if (this.don) {
      if (loser === 'daku') Achievements.unlock('todo_o_nada');
      else Achievements.unlock('mal_calculo');
      if (loser === 'rein' && this.donAutor === 'daku') {
        Achievements.unlock('la_casa_siempre_gana');
      }
    }
    if (GameState.round === 1 && loser === 'rein') GameState.perdioPrendaEnRonda1 = true;
    this.don = false;
    this.donAutor = null;
    const pool = loser === 'rein' ? this.d.act3.rein_loses_garment : this.d.act3.daku_loses_garment;

    this.dialogue.note('stage',
      `${this.reinRound} — ${this.dakuRound}. ` +
      `${loser === 'rein' ? 'Rein' : 'Daku'} pierde ${lost.length > 1 ? 'dos prendas' : 'una prenda'}.`);

    this.clothing[loser].playStrip(() => {
      this.refreshHud();
      const lines = lost
        .map((g) => pick(pool[g] || ['...']))
        .flatMap((entrada) => lineasDe(entrada, 'daku', 'flirty'));

      this.time.delayedCall(700, () => {
        this.dialogue.play(lines, () => this.checkGameOver());
      });
    });
  }

  /**
   * Se pierde al quedarse sin las TRES prendas, no al cabo de N rondas.
   *
   * Antes eran exactamente tres rondas y perdía quien hubiera ganado menos.
   * Con eso, siete de cada diez partidas terminaban con los dos todavía
   * vestidos y el juego declarando un perdedor que aún llevaba ropa puesta.
   *
   * Ahora se juega hasta que alguien pierde camisa, pantalón y ropa interior.
   * Si van dos a dos, se juega otra ronda. Como cada ronda cuesta una sola
   * prenda, hacen falta tres rondas como mínimo y cinco como máximo.
   */
  checkGameOver() {
    const reinFuera = GameState.isNaked('rein');
    const dakuFuera = GameState.isNaked('daku');
    if (reinFuera || dakuFuera) {
      this.finish(reinFuera ? 'rein' : 'daku');
      return;
    }

    GameState.round++;
    this.refreshHud();
    this.startRound();
  }

  /** @param {'rein'|'daku'} loser quién se quedó sin las tres prendas */
  finish(loser) {
    GameState.resolveEnding(loser);
    Achievements.alTerminarPartida(GameState);
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ending'));
  }
}
