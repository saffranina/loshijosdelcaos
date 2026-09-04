// TitleScene.js — pantalla de título.

import { C, F } from '../theme.js';
import { makeButton, paintBackdrop } from '../systems/Ui.js';
import { GameState } from '../systems/GameState.js';
import { playMusic } from '../systems/Music.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const { width, height } = this.scale;
    if (this.textures.exists('bg_bar')) {
      const bg = this.add.image(width / 2, height / 2, 'bg_bar');
      const src = this.textures.get('bg_bar').getSourceImage();
      bg.setScale(Math.max(width / src.width, height / src.height));
      this.add.rectangle(0, 0, width, height, 0x06101c, 0.35).setOrigin(0);
    } else {
      paintBackdrop(this, C.barDark, 0x060404);
    }

    // Luz cálida latiendo, como la ventana de un bar desde la calle.
    const glow = this.add.graphics();
    glow.fillStyle(C.lamp, 0.055);
    glow.fillCircle(width / 2, height * 0.36, 230);
    this.tweens.add({ targets: glow, alpha: { from: 0.55, to: 1 }, duration: 3400, yoyo: true, repeat: -1 });

    if (this.textures.exists('title_art')) {
      this.add.image(width / 2, height * 0.27, 'title_art').setDisplaySize(650, 260);
    } else {
      this.add.text(width / 2, height * 0.28, 'Los hijos del caos:\nEl último dado', {
        fontFamily: F.title, fontSize: '46px', color: '#edf4fa', align: 'center',
      }).setOrigin(0.5);
    }

    makeButton(this, width / 2, height * 0.57, 230, 44, 'Entrar al bar', () => {
      GameState.startNewGame();
      playMusic(this, 'music_bar');
      this.scene.start('Act1');
    }, { fontSize: 17 });

    makeButton(this, width / 2, height * 0.66, 230, 36, 'Ir directo al Farkle', () => {
      GameState.startNewGame();
      playMusic(this, 'music_farkle');
      this.scene.start('Tutorial', { next: 'Farkle' });
    }, { fontSize: 14 });

    makeButton(this, width / 2, height * 0.75, 230, 34, 'Logros', () => {
      this.scene.start('Achievements');
    }, { fontSize: 13 });

    makeButton(this, width / 2, height * 0.83, 230, 34, 'Cómo jugar', () => {
      this.scene.start('Tutorial', { next: 'Title' });
    }, { fontSize: 13 });
  }
}
