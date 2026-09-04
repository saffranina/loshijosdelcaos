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
import { playMusic } from '../systems/Music.js';
import { dadoElegido, dadosLanzados } from '../systems/Sfx.js';
import { Achievements } from '../systems/Achievements.js';
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
      fontFamily: F.body, fontSize: '13px', color: '#ffffff',
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
    this.lastChance = null;
    this.turnsThisRound = 0;
    this.reinTurnsThisRound = 0;
    this.reinRollsThisRound = 0;
    this.don = false;
    this.donRules = null;
    this.dakuProposedDon = false;
    this.target = this.cfg.round_target;
    this.reinSkipsTurn = this.reinSkipsTurn || false;
    this.refreshHud();
    this.clearDice();

    // Cada ronda disputa una sola prenda; se juegan las que hagan falta hasta
    // que alguien se quede sin las tres (ver checkGameOver).
    const empezar = () => this.prepareDoubleOrNothing(() => this.beginTurn('rein'));
    if (GameState.round === 1) empezar();
    else this.tauntPhase(empezar);
  }

  /** El jugador elige el tono; Daku responde. Es también un momento de distracción. */
  tauntPhase(next) {
    const level = GameState.sceneLevel();
    this.dialogue.choices(
      TONES.map((t) => ({ label: t.label })),
      (idx) => {
        const tone = TONES[idx];
        GameState.lastTone = tone.key;
        Achievements.event('tone', { tone: tone.key, nearlyNaked: level === 'nearly_naked' });
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

  /** Daku propone doble o nada cuando va perdiendo. */
  prepareDoubleOrNothing(next) {
    const rules = this.cfg.double_or_nothing || { habilitado:false };
    const limit = rules.rein_requiere_sobriedad_menor_a;
    if (!rules.habilitado || limit == null || GameState.sobriety >= limit) {
      this.offerDoubleOrNothing(next); return;
    }
    this.dialogue.choices([
      { label:'Proponer doble o nada' }, { label:'Jugar normal' },
    ], (idx) => {
      if (idx !== 0) { this.offerDoubleOrNothing(next); return; }
      this.don = true;
      this.donRules = rules;
      Achievements.event('rein_don_propose');
      if (rules.tipo === 'puntos') this.target = this.cfg.round_target * (rules.multiplicador ?? 2);
      const tone = { provoke:'provocar', flirt:'coquetear', stoic:'estoico' }[GameState.lastTone] || 'estoico';
      const lines = GameState.mechanics?.doble_o_nada_dialogos?.rein_propone?.[tone] || [];
      this.refreshHud();
      if (lines.length) this.dialogue.play(lines, next); else next();
    }, { prompt:'La apuesta puede subir.' });
  }

  offerDoubleOrNothing(next) {
    const rules = this.cfg.double_or_nothing || { habilitado:false };
    const losing = GameState.dakuLost > GameState.reinLost;
    const chance = rules.daku_propone_siempre ? 1 : (rules.daku_propone_probabilidad ?? 0);
    if (!rules.habilitado || !rules.daku_propone_cuando_pierde || !losing || Math.random() >= chance) {
      next(); return;
    }

    const dialog = GameState.mechanics?.doble_o_nada_dialogos?.daku_propone;
    const proposal = dialog?.propuesta || [this.d.act3.double_or_nothing.propose];
    this.dakuProposedDon = true;
    this.dialogue.play(proposal, () => {
      this.dialogue.choices([{ label:'Aceptar' }, { label:'Rechazar' }], (idx) => {
        this.don = idx === 0;
        this.donRules = rules;
        if (this.don && rules.tipo === 'puntos') this.target = this.cfg.round_target * (rules.multiplicador ?? 2);
        this.refreshHud();
        const reply = idx === 0 ? dialog?.rein_acepta : dialog?.rein_rechaza;
        if (reply?.length) this.dialogue.play(reply, next); else next();
      });
    });
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
    this.clearDice();
    this.turnsThisRound++;
    if (who === 'rein') {
      this.reinTurnsThisRound++;
      this.playerSabotageChecked = false;
    }

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
    this.reinRollsThisRound++;
    this.busy = true;
    this.selectable = false;
    this.hideButtons();
    this.dialogue.note('stage', `Turno de Rein — ${this.turnPoints} en la mesa.`);
    this.portraits.rein.setExpression('dice');

    this.rollFor('rein', () => this.maybeSabotagePlayerRoll());
  }

  /** En Pesadilla, Daku tiene una oportunidad de tocar la primera tirada del turno de Rein. */
  maybeSabotagePlayerRoll() {
    if (!this.cfg.player_sabotage_enabled || this.playerSabotageChecked) {
      this.finishPlayerRoll();
      return;
    }
    this.playerSabotageChecked = true;
    this.pendingPlayerCheat = null;

    if (Math.random() < (this.cfg.player_sabotage_probability ?? 0)) {
      const plan = this.ai.planSabotage(this.currentValues());
      if (plan) {
        const dieIndex = this.active[plan.index];
        this.pendingPlayerCheat = { dieIndex, ...plan };
        GameState.cheatsTotal++;
        this.dice[dieIndex].cheatTo(plan.to, this.ai.cheatFlashMs(GameState.drunkenness));
      }
    }
    this.showPlayerDefenseWindow();
  }

  /** La opción aparece haya habido sabotaje o no, para no regalar la respuesta. */
  showPlayerDefenseWindow() {
    this.busy = false;
    this.selectable = false;
    this.tableText.setText('Observa la tirada. Daku podría haber tocado un dado.');
    this.setButtons([
      {
        label: `⚡ Defender tirada (${GameState.emp})`,
        enabled: GameState.emp > 0,
        onClick: () => this.defendPlayerRoll(),
      },
      {
        label: '🥃 Beber',
        enabled: GameState.sobriety > 0,
        onClick: () => this.playerDrink('defense', () => this.showPlayerDefenseWindow()),
      },
      { label: 'Continuar', onClick: () => this.finishPlayerRoll() },
    ]);
  }

  defendPlayerRoll() {
    this.hideButtons();
    if (!GameState.spendEmp()) return;
    GameState.defensesMade++;
    this.emp.pulse();

    if (this.pendingPlayerCheat) {
      const cheat = this.pendingPlayerCheat;
      this.dice[cheat.dieIndex].cheatTo(cheat.from, 180);
      GameState.cheatsCaught++;
      GameState.successfulDefenses++;
      Achievements.event('defend_correct');
      GameState.restoreResources(0, 2);
      this.dialogue.note('stage', 'Rein bloquea la telequinesis. El dado recupera su valor.');
    } else {
      GameState.falseDefenses++;
      this.dialogue.note('stage', 'Rein levanta una barrera, pero Daku no había tocado nada.');
    }
    this.pendingPlayerCheat = null;
    this.refreshHud();
    if (GameState.emp === 0) Achievements.event('emp_zero');
    this.time.delayedCall(700, () => this.finishPlayerRoll());
  }

  finishPlayerRoll() {
    this.pendingPlayerCheat = null;
    this.busy = false;
    const values = this.currentValues();
    if (!hasScoring(values)) { this.playerFarkle(); return; }
    this.selectable = true;
    this.updateSelectionUi();
    this.setButtons([
      { label: 'Apartar y tirar', enabled: false, onClick: () => this.playerKeep(true) },
      { label: 'Apartar y plantarse', enabled: false, onClick: () => this.playerKeep(false) },
      { label: '🥃 Beber', enabled: GameState.sobriety > 0, onClick: () => this.playerDrink('turn') },
    ]);
  }

  playerKeep(rollAgain) {
    if (this.busy) return;
    const vals = this.selectedValues();
    const r = scoreSelection(vals);
    if (!r.valid) return;
    this.busy = true;

    this.turnPoints += r.score;
    const allSix = this.kept.length + this.selected.size >= this.cfg.dice_count;
    Achievements.event('selection', {
      values: vals, rollAgain, allSix, turnPoints: this.turnPoints,
    });
    this.selected.forEach((i) => { this.kept.push(i); this.dice[i].setKept(true); });
    this.active = this.active.filter((i) => !this.selected.has(i));
    this.selected.clear();
    this.selectable = false;
    this.hideButtons();
    this.layoutDice();
    this.turnPointsText.setText(`en la mesa: ${this.turnPoints}`);

    const seguir = () => {
      if (rollAgain) this.time.delayedCall(320, () => this.playerRoll());
      else this.playerBank();
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

  playerBank() {
    Achievements.event('bank', { points: this.turnPoints });
    this.reinRound += this.turnPoints;
    this.turnPointsText.setText('');
    this.refreshHud();
    this.dialogue.note('stage', `Rein se planta con ${this.turnPoints}. Total de ronda: ${this.reinRound}.`);
    this.time.delayedCall(1300, () => this.endTurn('rein'));
  }

  playerFarkle() {
    Achievements.event('farkle', { turnPoints: this.turnPoints });
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
    Achievements.event('drink', {
      round: GameState.round, total: GameState.drinks,
      beforeFinal: GameState.reinLost >= 2 || GameState.dakuLost >= 2,
    });
    this.refreshHud();
    this.emp.pulse();
    this.drinks.applyCameraWobble();

    if (GameState.sobriety <= 0) {
      this.busy = true;
      this.dialogue.note('stage', 'El mundo se inclina. Rein ya no puede distinguir los dados.');
      this.time.delayedCall(1500, () => {
        GameState.ending = 'drunk_game_over';
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

    // En Pesadilla Daku puede alterar dos dados durante la misma distracción.
    // Sigue siendo una sola oportunidad de acusación: acertar revierte su turno entero.
    if (this.cfg.cheat_double_dice && this.active.length > 1) {
      const changed = values.slice();
      changed[plan.index] = plan.to;
      const remainingPositions = changed.map((_, i) => i).filter((i) => i !== plan.index);
      const second = this.ai.planCheat(remainingPositions.map((i) => changed[i]), GameState.round);
      if (second) {
        const originalPosition = remainingPositions[second.index];
        const secondDieIndex = this.active[originalPosition];
        this.pendingCheat.extra = { dieIndex: secondDieIndex, ...second, index: originalPosition };
        this.dice[secondDieIndex].cheatTo(second.to, this.ai.cheatFlashMs(GameState.drunkenness));
      }
    }
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
    const empBefore = GameState.emp;
    if (!GameState.spendEmp()) return;
    GameState.accusationsMade++;
    this.emp.pulse();
    this.refreshHud();

    if (this.pendingCheat) {
      // Acierto: Daku pierde el turno.
      GameState.cheatsCaught++;
      GameState.correctAccusations++;
      Achievements.event('accuse_correct', {
        total: GameState.correctAccusations, empBefore, sobriety: GameState.sobriety,
        minimumSobriety: this.cfg.sobriety_loss_per_drink ?? .2,
      });
      GameState.restoreResources(this.cfg.correct_accusation_emp_restore ?? 0, 2);
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
      Achievements.event('accuse_false', {
        total: GameState.falseAccusations, round: GameState.round, empAfter: GameState.emp,
        correctTotal: GameState.correctAccusations, otherEmpUses: GameState.defensesMade,
      });
      this.ai.notifyMissed();
      this.reinSkipsTurn = true;
      this.dialogue.play(pick(this.d.act3.cheat_false), () => this.dakuDecide());
    }
    if (GameState.emp === 0) Achievements.event('emp_zero');
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
    const garmentCount = this.don && this.donRules?.tipo === 'prendas'
      ? (this.donRules.prendas_perdidas ?? 2) : 1;
    const lost = GameState.loseGarments(loser, garmentCount);
    Achievements.event('garment_lost', { who: loser, round: GameState.round });
    if (loser === 'daku') {
      Achievements.event('round_won', { oneTurn: this.reinRollsThisRound === 1 });
      if (this.don) Achievements.event('don_win');
    } else {
      Achievements.event('round_lost');
      if (this.don) Achievements.event('don_lose');
      if (this.don && this.dakuProposedDon) Achievements.event('daku_don_win');
    }
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
    this.target = this.cfg.round_target;
    this.donRules = null;
    this.dakuProposedDon = false;
    this.refreshHud();
    this.startRound();
  }

  /** @param {'rein'|'daku'} loser quién se quedó sin las tres prendas */
  finish(loser) {
    GameState.resolveEnding(loser);
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ending'));
  }
}
