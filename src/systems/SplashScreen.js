// SplashScreen.js — imagen a pantalla completa dentro de la ventana del juego,
// con fade in / fade out. Si el PNG todavía no existe, muestra un cartel con
// la descripción del guion (así se puede jugar el flujo completo sin arte).

import { C, F } from '../theme.js';

export class SplashScreen {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * @param {string} key clave de textura (assets/splash/<key>.png)
   * @param {string} caption texto del guion, se usa como placeholder
   * @param {Function} onDone
   */
  show(key, caption, onDone) {
    const scene = this.scene;
    const { width, height } = scene.scale;
    const depth = 500;

    const layer = scene.add.container(0, 0).setDepth(depth).setAlpha(0);

    const bg = scene.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);
    layer.add(bg);

    const hasArt = scene.textures.exists(`splash_${key}`);
    if (hasArt) {
      const img = scene.add.image(width / 2, height / 2, `splash_${key}`);
      const src = scene.textures.get(`splash_${key}`).getSourceImage();
      img.setScale(Math.max(width / src.width, height / src.height));
      layer.add(img);
    } else {
      const frame = scene.add.graphics();
      frame.lineStyle(1, C.boxStroke, 0.55);
      frame.strokeRect(40, 40, width - 80, height - 80);
      const tag = scene.add.text(width / 2, 92, '[ SPLASH ART ]', {
        fontFamily: F.title, fontSize: '17px', color: '#6b5548', letterSpacing: 3,
      }).setOrigin(0.5);
      const nameTxt = scene.add.text(width / 2, height / 2 - 40, key, {
        fontFamily: F.title, fontSize: '30px', color: '#c9a56b',
      }).setOrigin(0.5);
      const capTxt = scene.add.text(width / 2, height / 2 + 24, caption || '', {
        fontFamily: F.body, fontSize: '16px', color: C.textDim, fontStyle: 'italic',
        align: 'center', wordWrap: { width: width - 200 }, lineSpacing: 5,
      }).setOrigin(0.5);
      layer.add([frame, tag, nameTxt, capTxt]);
    }

    const hint = scene.add.text(width / 2, height - 56, 'click para continuar', {
      fontFamily: F.body, fontSize: '13px', color: '#5c4a44',
    }).setOrigin(0.5);
    layer.add(hint);

    // Bloquea clicks a lo que hay debajo mientras el splash está arriba.
    const blocker = scene.add.rectangle(0, 0, width, height, 0x000000, 0.001)
      .setOrigin(0).setInteractive();
    layer.add(blocker);

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      scene.tweens.add({
        targets: layer, alpha: 0, duration: 420,
        onComplete: () => { layer.destroy(); if (onDone) onDone(); },
      });
    };

    scene.tweens.add({
      targets: layer, alpha: 1, duration: 520,
      onComplete: () => { blocker.once('pointerdown', dismiss); },
    });
  }
}
