// ClothingManager.js — 3 prendas por personaje. Dibuja el medidor de ropa que
// va debajo del portrait y elige qué retrato toca según lo que quede puesto.


import { C, F } from '../theme.js';
import { GameState, GARMENTS, GARMENT_ES } from './GameState.js';

export class ClothingManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} opts { who, x, y, portrait }
   */
  constructor(scene, opts) {
    this.scene = scene;
    this.who = opts.who;
    this.x = opts.x;
    this.y = opts.y;
    this.portrait = opts.portrait || null;

    this.g = scene.add.graphics().setDepth(60);

    // El número debajo de los cuadraditos: cuántas prendas quedan puestas
    // sobre el total. Empieza en 3/3 y baja. Los cuadraditos solos se leen
    // de un vistazo pero hay que contarlos, y en plena partida —con la vista
    // en los dados— es justo lo que uno no quiere hacer.
    this.label = scene.add.text(this.x, this.y + 13, '', {
      fontFamily: F.body, fontSize: F.sizeSmall, color: C.textDim,
    }).setOrigin(0.5, 0).setDepth(60);

    this.refresh();
  }

  refresh() {
    const g = this.g;
    g.clear();
    const remaining = GameState.remaining(this.who);
    const lostCount = GARMENTS.length - remaining;
    const pw = 14, ph = 8, gap = 4;
    const totalW = GARMENTS.length * pw + (GARMENTS.length - 1) * gap;
    const x0 = this.x - totalW / 2;

    for (let i = 0; i < GARMENTS.length; i++) {
      const on = i < remaining;
      g.fillStyle(on ? C.cloth : C.clothLost, on ? 0.9 : 0.55);
      g.fillRoundedRect(x0 + i * (pw + gap), this.y, pw, ph, 2);
    }

    this.label.setText(`${remaining}/${GARMENTS.length}`);

    if (this.portrait?.setClothingStage) {
      this.portrait.setClothingStage(GameState.clothingStage(this.who));
    }
  }

  /** Nombre en español de la prenda, para los diálogos. */
  static nameOf(key) { return GARMENT_ES[key] || key; }

  /** Animación de quitarse una prenda: el portrait tiembla y parpadea. */
  playStrip(onDone) {
    const target = this.portrait?.container;
    if (!target) { if (onDone) onDone(); return; }
    this.scene.tweens.add({
      targets: target,
      x: { from: target.x - 5, to: target.x },
      duration: 90, yoyo: true, repeat: 3,
      onComplete: () => { this.refresh(); if (onDone) onDone(); },
    });
  }

  destroy() { this.g.destroy(); this.label.destroy(); }
}
