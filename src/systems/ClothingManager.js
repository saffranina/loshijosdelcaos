// ClothingManager.js — 3 prendas por personaje, una por ronda. Dibuja un contador
// de prendas debajo del portrait; cuando lleguen las capas PNG, addLayer()
// las apila sobre el portrait base y el resto del código no cambia.

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
    this.text = scene.add.text(opts.x, opts.y + 20, '', {
      fontFamily: F.body, fontSize: '11px', color: C.textDim,
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
    const label = remaining === 0
      ? 'sin nada'
      : `${remaining} prenda${remaining === 1 ? '' : 's'}`;
    this.text.setText(label);

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

  destroy() { this.g.destroy(); this.text.destroy(); }
}
