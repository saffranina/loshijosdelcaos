// Dice.js — dado pintado por código. Cuando lleguen las 6 caras pintadas,
// se reemplaza _drawFace por un sprite y el resto sigue igual.

import { C } from '../theme.js';

const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
};

export class Die {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x @param {number} y @param {number} size
   * @param {Function} onClick recibe este Die
   */
  constructor(scene, x, y, size, onClick) {
    this.scene = scene;
    this.size = size;
    this.value = 1;
    this.selected = false;
    this.validSelection = false;
    this.kept = false;       // apartado en un tiro anterior de este turno
    this.dead = false;       // ya no participa
    this.drunk = 0;

    this.sprite = scene.textures.exists('dice_sheet')
      ? scene.add.sprite(0, 0, 'dice_sheet', 0).setVisible(true)
      : null;
    this.g = scene.add.graphics();
    this.container = scene.add.container(x, y, this.sprite ? [this.sprite, this.g] : [this.g]);
    this.container.setSize(size, size);
    this.homeX = x;
    this.homeY = y;

    this.container.setInteractive({ useHandCursor: true });
    this.container.on('pointerdown', () => { if (onClick) onClick(this); });
    this.redraw();
  }

  setDepth(d) { this.container.setDepth(d); return this; }
  setVisible(v) { this.container.setVisible(v); return this; }
  setPosition(x, y) { this.container.setPosition(x, y); this.homeX = x; this.homeY = y; return this; }

  setValue(v) { this.value = v; this.redraw(); return this; }
  setSelected(v) {
    this.selected = v;
    if (!v) this.validSelection = false;
    this.redraw();
    return this;
  }
  setSelectionValid(v) {
    this.validSelection = this.selected && v;
    this.redraw();
    return this;
  }
  setKept(v) {
    this.kept = v;
    this.selected = false;
    this.validSelection = false;
    this.redraw();
    return this;
  }
  setDead(v) { this.dead = v; this.redraw(); return this; }
  setDrunk(level) { this.drunk = Phaser.Math.Clamp(level, 0, 1); this.redraw(); return this; }

  redraw() {
    const s = this.size;
    const g = this.g;
    g.clear();

    if (this.sprite) {
      const frameW = 512;
      this.sprite.setFrame(this.value - 1);
      this.sprite.setScale(s / frameW).setAlpha(this.dead ? 0.42 : 1);
      this.sprite.clearTint();
      if (this.drunk > 0.35) this.sprite.setTint(0xb9c4cf);
      if (this.kept || this.selected) {
        const selectedBorder = this.validSelection ? 0xffd24a : C.dieSelect;
        g.lineStyle(this.selected ? 4 : 3, this.selected ? selectedBorder : C.dieHeld, 1);
        g.strokeRoundedRect(-s / 2, -s / 2, s, s, 5);
      }
      return;
    }

    let face = C.dieFace;
    let border = 0x0e0a08;
    let borderW = 1;
    if (this.dead) face = C.dieDead;
    if (this.kept) { border = C.dieHeld; borderW = 2; }
    if (this.selected) { border = this.validSelection ? 0xffd24a : C.dieSelect; borderW = 3; }

    g.fillStyle(face, this.dead ? 0.55 : 1);
    g.lineStyle(borderW, border, 1);
    g.fillRoundedRect(-s / 2, -s / 2, s, s, 7);
    g.strokeRoundedRect(-s / 2, -s / 2, s, s, 7);

    // Pips. Con alcohol pierden contraste y se les pega un fantasma desplazado.
    const r = Math.max(2.5, s * 0.085);
    const pips = PIPS[this.value] || [];
    const jitter = this.drunk * 2.2;
    const mainAlpha = 1 - this.drunk * 0.32;
    const ghostAlpha = this.drunk * 0.34;
    const ghostOff = this.drunk * 2.6;

    if (ghostAlpha > 0.02) {
      g.fillStyle(C.diePip, ghostAlpha);
      for (const [px, py] of pips) {
        g.fillCircle(-s / 2 + px * s + ghostOff, -s / 2 + py * s + ghostOff * 0.6, r);
      }
    }
    g.fillStyle(C.diePip, mainAlpha);
    for (const [px, py] of pips) {
      const jx = jitter ? Phaser.Math.FloatBetween(-jitter, jitter) : 0;
      const jy = jitter ? Phaser.Math.FloatBetween(-jitter, jitter) : 0;
      g.fillCircle(-s / 2 + px * s + jx, -s / 2 + py * s + jy, r);
    }
  }

  /** Animación de tirada: sacude y va cambiando de cara hasta el valor final. */
  rollTo(finalValue, duration = 460, onDone) {
    const scene = this.scene;
    this.setKept(false);
    this.setSelected(false);
    this.setDead(false);

    const ticks = Math.max(4, Math.floor(duration / 70));
    let n = 0;
    scene.time.addEvent({
      delay: 70,
      repeat: ticks - 1,
      callback: () => {
        n++;
        this.setValue(n >= ticks ? finalValue : 1 + Math.floor(Math.random() * 6));
        if (n >= ticks && onDone) onDone();
      },
    });
    scene.tweens.add({
      targets: this.container,
      y: { from: this.homeY - 16, to: this.homeY },
      angle: { from: Phaser.Math.Between(-25, 25), to: 0 },
      duration,
      ease: 'Bounce.easeOut',
    });
  }

  /**
   * La trampa: el dado cambia de valor con un destello.
   * flashMs largo = visible; corto = casi imperceptible.
   */
  cheatTo(newValue, flashMs) {
    const scene = this.scene;
    this.setValue(newValue);

    const s = this.size;
    const glow = scene.add.graphics();
    glow.lineStyle(2, 0xb98ce0, 0.9);
    glow.strokeRoundedRect(-s / 2 - 2, -s / 2 - 2, s + 4, s + 4, 8);
    this.container.add(glow);

    scene.tweens.add({
      targets: glow, alpha: { from: 0.95, to: 0 },
      duration: flashMs, ease: 'Sine.easeOut',
      onComplete: () => glow.destroy(),
    });
    scene.tweens.add({
      targets: this.container,
      angle: { from: -3.5, to: 0 },
      duration: Math.min(260, flashMs), ease: 'Elastic.easeOut',
    });
  }

  destroy() { this.container.destroy(); }
}
