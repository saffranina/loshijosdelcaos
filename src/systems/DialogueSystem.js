// DialogueSystem.js — cuadro de texto, typewriter, opciones de respuesta.
// No sabe nada de portraits: avisa al scene con onSpeaker(speaker, expression)
// y el scene decide cómo mostrarlos.

import { C, F, SPEAKERS } from '../theme.js';
import { panel, makeButton } from './Ui.js';

const CHAR_MS = 18;      // velocidad del typewriter
const CHAR_MS_FAST = 4;

export class DialogueSystem {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} opts { x, y, w, h, onSpeaker, onSplash, depth }
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.x = opts.x ?? 20;
    this.y = opts.y ?? 428;
    this.w = opts.w ?? 760;
    this.h = opts.h ?? 154;
    this.onSpeaker = opts.onSpeaker || (() => {});
    this.onSplash = opts.onSplash || null;
    this.depth = opts.depth ?? 100;

    this.container = scene.add.container(0, 0).setDepth(this.depth);

    this.bg = scene.textures.exists('dialogue_frame')
      ? scene.add.image(this.x, this.y, 'dialogue_frame').setOrigin(0).setDisplaySize(this.w, this.h)
      : panel(scene, this.x, this.y, this.w, this.h);
    this.nameText = scene.add.text(this.x + 160, this.y + 8, '', {
      fontFamily: F.title, fontSize: F.sizeName, color: C.textName, fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0);
    this.bodyText = scene.add.text(this.x + 34, this.y + 47, '', {
      fontFamily: F.body, fontSize: F.sizeBody, fontStyle: F.weightBody, color: C.textMain,
      wordWrap: { width: this.w - 68, useAdvancedWrap: true }, lineSpacing: 3,
    });
    this.hint = scene.add.text(this.x + this.w - 22, this.y + this.h - 28, '▼', {
      fontFamily: F.body, fontSize: F.sizeSmall, color: C.textDim,
    }).setOrigin(1, 0).setVisible(false);

    this.container.add([this.bg, this.nameText, this.bodyText, this.hint]);

    this.choiceButtons = [];
    this.typing = false;
    this.waiting = false;
    this._full = '';
    this._timer = null;
    this._onAdvance = null;

    // Avanzar con click o teclado
    this._pointerHandler = () => this._advance();
    scene.input.on('pointerdown', this._pointerHandler);
    this._keys = scene.input.keyboard.addKeys('SPACE,ENTER');
    this._keyHandler = (ev) => {
      if (ev.code === 'Space' || ev.code === 'Enter') this._advance();
    };
    scene.input.keyboard.on('keydown', this._keyHandler);

    scene.events.once('shutdown', () => this.destroy());
  }

  setVisible(v) { this.container.setVisible(v); return this; }

  // ------------------------------------------------------------------
  // Una línea
  // ------------------------------------------------------------------

  /** Muestra una línea con typewriter. onDone se llama cuando el jugador avanza. */
  say(line, onDone) {
    this.clearChoices();
    const speaker = line.speaker || 'narrator';
    const meta = SPEAKERS[speaker] || SPEAKERS.narrator;

    this.onSpeaker(speaker, line.expression);

    this.nameText.setText(meta.name).setColor(meta.color);

    const isStage = speaker === 'stage';
    this.bodyText
      .setColor(isStage ? C.textStage : speaker === 'narrator' ? C.narrator : C.textMain)
      .setFontStyle(isStage ? 'italic' : F.weightBody);

    this._full = isStage ? `( ${line.text} )` : line.text;
    this._onAdvance = onDone;
    this._startTyping();
  }

  _startTyping() {
    this.bodyText.setText('');
    this.hint.setVisible(false);
    this.typing = true;
    this.waiting = false;

    let i = 0;
    const speed = this._full.length > 160 ? CHAR_MS_FAST + 6 : CHAR_MS;
    if (this._timer) this._timer.remove();
    this._timer = this.scene.time.addEvent({
      delay: speed,
      repeat: this._full.length - 1,
      callback: () => {
        i++;
        this.bodyText.setText(this._full.slice(0, i));
        if (i >= this._full.length) this._finishTyping();
      },
    });
  }

  _finishTyping() {
    if (this._timer) { this._timer.remove(); this._timer = null; }
    this.bodyText.setText(this._full);
    this.typing = false;
    this.waiting = true;
    this.hint.setVisible(true);
    this.scene.tweens.add({
      targets: this.hint, alpha: { from: 0.25, to: 1 },
      duration: 620, yoyo: true, repeat: -1,
    });
  }

  _advance() {
    if (this.choiceButtons.length) return;   // hay opciones en pantalla
    if (this.typing) { this._finishTyping(); return; }
    if (!this.waiting) return;
    this.waiting = false;
    this.hint.setVisible(false);
    this.scene.tweens.killTweensOf(this.hint);
    const cb = this._onAdvance;
    this._onAdvance = null;
    if (cb) cb();
  }

  // ------------------------------------------------------------------
  // Secuencias
  // ------------------------------------------------------------------

  /**
   * Reproduce una lista de líneas. Las que traen `splash` se delegan a onSplash.
   * @param {Array} lines
   * @param {Function} onComplete
   */
  play(lines, onComplete) {
    let i = 0;
    const next = () => {
      if (i >= lines.length) { if (onComplete) onComplete(); return; }
      const line = lines[i++];
      if (line.splash) {
        if (this.onSplash) this.onSplash(line, next);
        else next();
      } else {
        this.say(line, next);
      }
    };
    next();
  }

  // ------------------------------------------------------------------
  // Opciones
  // ------------------------------------------------------------------

  /**
   * Muestra botones de respuesta dentro del cuadro.
   * @param {Array<{label:string}>} options
   * @param {Function} cb recibe el índice elegido
   * @param {object} opts { prompt: string|null }
   */
  choices(options, cb, opts = {}) {
    this.clearChoices();
    this.hint.setVisible(false);
    this.waiting = false;

    if (opts.prompt !== undefined && opts.prompt !== null) {
      this.nameText.setText('');
      this.bodyText.setText(opts.prompt).setColor(C.textDim).setFontStyle('italic');
    }

    const n = options.length;
    const perRow = n <= 3 ? n : 2;
    const rows = Math.ceil(n / perRow);
    const gap = 10;
    const bw = Math.floor((this.w - 36 - gap * (perRow - 1)) / perRow);
    const bh = rows > 1 ? 34 : 40;
    const startY = this.y + this.h - 18 - (rows * bh + (rows - 1) * gap) / 2;

    options.forEach((o, idx) => {
      const row = Math.floor(idx / perRow);
      const col = idx % perRow;
      const inRow = Math.min(perRow, n - row * perRow);
      const rowWidth = inRow * bw + (inRow - 1) * gap;
      const x0 = this.x + (this.w - rowWidth) / 2;
      const bx = x0 + col * (bw + gap) + bw / 2;
      const by = startY + row * (bh + gap);
      const btn = makeButton(this.scene, bx, by, bw, bh, o.label, () => {
        this.clearChoices();
        cb(idx, o);
      }, { fontSize: n > 3 ? 13 : 14 });
      btn.setDepth(this.depth + 1);
      this.choiceButtons.push(btn);
    });
  }

  clearChoices() {
    this.choiceButtons.forEach((b) => b.destroy());
    this.choiceButtons = [];
  }

  /** Texto suelto sin esperar avance (para estados del juego). */
  note(speaker, text, expression) {
    this.clearChoices();
    const meta = SPEAKERS[speaker] || SPEAKERS.narrator;
    if (speaker && speaker !== 'stage' && speaker !== 'narrator') {
      this.onSpeaker(speaker, expression);
    }
    if (this._timer) { this._timer.remove(); this._timer = null; }
    this.typing = false;
    this.waiting = false;
    this.hint.setVisible(false);
    this.nameText.setText(meta.name).setColor(meta.color);
    this.bodyText
      .setColor(speaker === 'stage' ? C.textStage : C.textMain)
      .setFontStyle(speaker === 'stage' ? 'italic' : F.weightBody)
      .setText(text);
  }

  destroy() {
    if (this._timer) this._timer.remove();
    this.scene.input.off('pointerdown', this._pointerHandler);
    this.scene.input.keyboard.off('keydown', this._keyHandler);
    this.clearChoices();
    this.container.destroy();
  }
}
