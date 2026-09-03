// EMPSystem.js — barra de cargas de acusación.
// La lógica de gasto vive en GameState; esto es la vista + el botón de acusar.

import { C, F } from '../theme.js';
import { GameState } from './GameState.js';

export class EMPSystem {
  /** La etiqueta va a la izquierda de la barra, en la misma línea. */
  constructor(scene, x, y) {
    this.scene = scene;
    this.label = scene.add.text(x, y + 3, 'EMP', {
      fontFamily: F.body, fontSize: '11px', color: C.textDim, letterSpacing: 2,
    }).setDepth(60);
    this.x = x + this.label.width + 10;
    this.y = y;
    this.g = scene.add.graphics().setDepth(60);
    this.refresh();
  }

  refresh() {
    const g = this.g;
    g.clear();
    const cw = 15, ch = 17, gap = 4;
    for (let i = 0; i < GameState.maxEmp; i++) {
      const filled = i < GameState.emp;
      g.fillStyle(filled ? C.emp : C.empEmpty, filled ? 0.9 : 0.5);
      g.lineStyle(1, filled ? C.emp : C.empEmpty, filled ? 1 : 0.6);
      g.fillRoundedRect(this.x + i * (cw + gap), this.y, cw, ch, 2);
      g.strokeRoundedRect(this.x + i * (cw + gap), this.y, cw, ch, 2);
    }
  }

  /** Destello cuando se gana o se gasta una carga. */
  pulse(color = C.emp) {
    const flash = this.scene.add.graphics().setDepth(61);
    const w = GameState.maxEmp * 19;
    flash.fillStyle(color, 0.5);
    flash.fillRoundedRect(this.x - 3, this.y - 3, w + 6, 23, 3);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 420,
      onComplete: () => flash.destroy(),
    });
  }

  destroy() { this.g.destroy(); this.label.destroy(); }
}
