// BootScene.js — carga datos y arte. Todo el arte es OPCIONAL: si un PNG
// todavía no existe, el juego sigue con placeholders y no rompe.

import { C, F } from '../theme.js';
import { GameState } from '../systems/GameState.js';

const EXPRESSIONS = ['neutral', 'smile', 'flirty', 'smug', 'surprised', 'dice'];
const CLOTHING_PORTRAITS = [
  ['daku_shirtless', 'assets/portraits/daku/daku_shirtless.png'],
  ['daku_underwear', 'assets/portraits/daku/daku_underwear.png'],
  ['rein_shirtless', 'assets/portraits/rein/rein_shirtless.png'],
  ['rein_shirtless_surprised', 'assets/portraits/rein/rein_shirtless_surprised.png'],
  ['rein_underwear', 'assets/portraits/rein/rein_underwear.png'],
];
const SPLASHES = [
  'bar_entrance', 'daku_behind', 'room_invite',
  'ending_rein_wins', 'ending_daku_wins',
];

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const { width, height } = this.scale;

    const barW = 300;
    const barBg = this.add.graphics();
    barBg.lineStyle(1, C.boxStroke, 0.6);
    barBg.strokeRect(width / 2 - barW / 2, height / 2 + 20, barW, 6);
    const barFill = this.add.graphics();
    this.load.on('progress', (p) => {
      barFill.clear();
      barFill.fillStyle(C.lamp, 0.9);
      barFill.fillRect(width / 2 - barW / 2 + 1, height / 2 + 21, (barW - 2) * p, 4);
    });

    // Los assets que faltan son normales durante el prototipo: se ignoran.
    this.missing = [];
    this.load.on('loaderror', (file) => this.missing.push(file.key));

    // Datos (obligatorios).
    //
    // En el paquete offline vienen ya incrustados en datos.js: load.json usa
    // XHR y desde file:// (doble clic, sin servidor) el navegador lo bloquea.
    // Ver tools/empaquetar.py.
    if (window.LDC_DATOS) {
      this.cache.json.add('dialogues', window.LDC_DATOS.dialogues);
      this.cache.json.add('farkleConfig', window.LDC_DATOS.farkleConfig);
    } else {
      this.load.json('dialogues', 'src/data/dialogues.json');
      this.load.json('farkleConfig', 'src/data/farkle-config.json');
    }

    // Portraits (opcionales)
    for (const who of ['rein', 'daku']) {
      for (const e of EXPRESSIONS) {
        this.load.image(`${who}_${e}`, `assets/portraits/${who}/${who}_${e}.png`);
      }
    }
    for (const [key, path] of CLOTHING_PORTRAITS) this.load.image(key, path);


    // Splash arts (opcionales)
    for (const s of SPLASHES) {
      const ext = s === 'ending_rein_wins' ? 'jpg' : 'png';
      this.load.image(`splash_${s}`, `assets/splash/${s}.${ext}`);
    }

    // Fondos (opcionales)
    this.load.image('bg_bar', 'assets/backgrounds/bar.png');
    this.load.image('bg_bar_inside', 'assets/backgrounds/bar_inside.png');
    this.load.image('bg_room', 'assets/backgrounds/room.png');
    this.load.image('bg_farkle', 'assets/backgrounds/farkle.png');
    this.load.image('title_art', 'assets/ui/title.png');
    this.load.image('dialogue_frame', 'assets/ui/dialogue.png');
    this.load.spritesheet('dice_sheet', 'assets/ui/dice.png', { frameWidth: 512, frameHeight: 512 });

    this.load.audio('music_bar', 'assets/music/bar.mp3');
    this.load.audio('music_farkle', 'assets/music/farkle.mp3');
    this.load.audio('music_endings', 'assets/music/endings.mp3');
    this.load.audio('music_gameover', 'assets/music/gameover.mp3');
  }

  create() {
    const dialogues = this.cache.json.get('dialogues');
    const config = this.cache.json.get('farkleConfig');

    if (!dialogues || !config) {
      this.add.text(40, 40,
        'No se pudieron cargar los datos.\n\n' +
        'El juego tiene que correr desde un servidor local,\n' +
        'no abriendo el index.html directamente.\n\n' +
        'Doble clic en jugar.bat',
        { fontFamily: F.body, fontSize: '16px', color: '#e08a7a', lineSpacing: 6 });
      return;
    }

    GameState.dialogues = dialogues;
    GameState.reset(config);

    if (this.missing.length) {
      console.info(
        `[Los hijos del caos: El último dado] ${this.missing.length} assets todavía sin pintar ` +
        `(se usan placeholders): ${this.missing.join(', ')}`
      );
    }

    this.scene.start('Title');
  }
}
