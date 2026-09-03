// VNScene.js — base para los actos de visual novel pura (Actos 1, 2 y 4).
// Un portrait grande arriba, cuadro de diálogo abajo, splashes a pantalla completa.

import { C } from '../theme.js';
import { paintBackdrop } from '../systems/Ui.js';
import { PortraitView } from '../systems/Portraits.js';
import { DialogueSystem } from '../systems/DialogueSystem.js';
import { SplashScreen } from '../systems/SplashScreen.js';
import { GameState } from '../systems/GameState.js';

export class VNScene extends Phaser.Scene {
  /**
   * @param {string} key
   * @param {object} opts { bgKey, top, bottom } colores/imagen de fondo
   */
  constructor(key, opts = {}) {
    super(key);
    this.bgOpts = opts;
  }

  buildStage() {
    const { width, height } = this.scale;

    if (this.bgOpts.bgKey && this.textures.exists(this.bgOpts.bgKey)) {
      const img = this.add.image(width / 2, height / 2, this.bgOpts.bgKey);
      const src = this.textures.get(this.bgOpts.bgKey).getSourceImage();
      img.setScale(Math.max(width / src.width, height / src.height));
      this.add.rectangle(0, 0, width, height, 0x000000, 0.28).setOrigin(0);
    } else {
      paintBackdrop(this, this.bgOpts.top ?? C.roomWarm, this.bgOpts.bottom ?? C.roomDark);
    }

    // Nuri aparece poco (sirve los tragos en el Acto 1) pero habla, así que
    // tiene portrait propio como Rein y Daku.
    this.portraits = {};
    for (const who of ['rein', 'daku', 'nuri']) {
      this.portraits[who] = new PortraitView(this, {
        x: width / 2, y: 238, width: 320, height: 400, who,
      }).setVisible(false);
    }

    // Los portraits tienen que reflejar la ropa que se perdió en el Farkle.
    // Sin esto los endings mostraban al que perdió vestido de arriba a abajo,
    // porque ClothingManager solo existe en la escena del juego de dados.
    this.refreshClothing();

    this.splash = new SplashScreen(this);

    this.dialogue = new DialogueSystem(this, {
      onSpeaker: (speaker, expression) => this.showSpeaker(speaker, expression),
      onSplash: (line, done) => this.splash.show(line.splash, line.caption, done),
    });
  }

  /** Pone cada portrait en la etapa de ropa que corresponde al estado actual. */
  refreshClothing() {
    for (const who of ['rein', 'daku']) {
      this.portraits[who]?.setClothingStage(GameState.clothingStage(who));
    }
  }

  /** Muestra el portrait de quien habla; narrador y acotaciones lo atenúan. */
  showSpeaker(speaker, expression) {
    const isCharacter = speaker in this.portraits;
    for (const who of Object.keys(this.portraits)) {
      const p = this.portraits[who];
      if (isCharacter && who === speaker) {
        p.setVisible(true).setAlpha(1);
        if (expression) p.setExpression(expression);
      } else if (isCharacter) {
        p.setVisible(false);
      } else {
        // Narrador o acotación: dejamos el último portrait, atenuado.
        if (p.container.visible) p.setAlpha(0.4);
      }
    }
  }

  /** Fade a negro y salto a otra escena. */
  goTo(sceneKey, delay = 0) {
    this.time.delayedCall(delay, () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey));
    });
  }
}
