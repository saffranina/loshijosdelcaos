// DrinkSystem.js — medidor de sobriedad y efectos visuales de ebriedad.
// Beber da +1 EMP y baja la sobriedad: más cargas para acusar, menos ojo para ver.

import { C, F } from '../theme.js';
import { GameState } from './GameState.js';

export class DrinkSystem {
  /**
   * `right` es el borde derecho de la barra; la etiqueta se apoya a su izquierda,
   * en la misma línea, para no pisar el marcador de Daku.
   */
  constructor(scene, center, y) {
    this.scene = scene;
    this.width = 105;
    this.x = center - this.width / 2;
    this.y = y;
    this.label = scene.add.text(center, y - 15, 'SOBRIEDAD', {
      fontFamily: F.body, fontSize: '11px', color: C.textDim, letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(60);
    this.g = scene.add.graphics().setDepth(60);
    this.refresh();
  }

  refresh() {
    const g = this.g;
    g.clear();
    const h = 17;
    g.fillStyle(0x1e1512, 0.85);
    g.lineStyle(1, C.boxStroke, 0.6);
    g.fillRoundedRect(this.x, this.y, this.width, h, 3);
    g.strokeRoundedRect(this.x, this.y, this.width, h, 3);

    const fillW = Math.max(0, (this.width - 4) * GameState.sobriety);
    // Del ámbar al rojo a medida que se hunde.
    const col = GameState.sobriety > 0.6 ? C.drink : GameState.sobriety > 0.3 ? 0xc9682e : 0x9c3226;
    if (fillW > 0) {
      g.fillStyle(col, 0.9);
      g.fillRoundedRect(this.x + 2, this.y + 2, fillW, h - 4, 2);
    }
  }

  /** Nivel de ebriedad 0..1 para pasarle a los dados y a la cámara. */
  get drunkenness() { return GameState.drunkenness; }

  /**
   * Animación del trago. Este es uno de los momentos de distracción:
   * el scene aprovecha el hueco para dejar que Daku haga trampa.
   */
  playDrinkAnimation(onDone) {
    const scene = this.scene;
    const { width, height } = scene.scale;
    const glass = scene.add.text(width / 2, height / 2 - 40, '🥃', {
      fontSize: '64px',
    }).setOrigin(0.5).setDepth(400).setAlpha(0);

    scene.tweens.add({
      targets: glass,
      alpha: { from: 0, to: 1 },
      y: { from: height / 2 - 10, to: height / 2 - 70 },
      scale: { from: 0.7, to: 1.15 },
      duration: 480, ease: 'Sine.easeOut',
      yoyo: true, hold: 260,
      onComplete: () => { glass.destroy(); if (onDone) onDone(); },
    });
  }

  /** Bamboleo leve de cámara, escala con la ebriedad. */
  applyCameraWobble() {
    const d = this.drunkenness;
    const cam = this.scene.cameras.main;
    if (d < 0.35) { cam.setRotation(0); return; }
    this.scene.tweens.add({
      targets: cam,
      rotation: { from: -0.004 * d, to: 0.004 * d },
      duration: 2600 - d * 900,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  destroy() { this.g.destroy(); this.label.destroy(); }
}
