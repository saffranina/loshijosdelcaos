// TitleScene.js — pantalla de título.

import { C, F } from '../theme.js';
import { makeButton, paintBackdrop } from '../systems/Ui.js';
import { GameState } from '../systems/GameState.js';
import { playMusic } from '../systems/Music.js';
import * as Achievements from '../systems/Achievements.js';
import { aplicar, listar, leerGuardada, guardar, DIFFICULTY_ORDER } from '../systems/Difficulty.js';

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

    Achievements.setScene(this);
    this.pintarSelectorDificultad(width, height);

    makeButton(this, width / 2, height * 0.655, 230, 42, 'Entrar al bar', () => {
      GameState.reset(GameState.config);
      playMusic(this, 'music_bar');
      this.scene.start('Act1');
    }, { fontSize: 17 });

    makeButton(this, width / 2, height * 0.745, 230, 34, 'Ir directo al Farkle', () => {
      GameState.reset(GameState.config);
      playMusic(this, 'music_farkle');
      this.scene.start('Tutorial', { next: 'Farkle' });
    }, { fontSize: 14 });

    makeButton(this, width / 2 - 62, height * 0.825, 106, 30, 'Cómo jugar', () => {
      this.scene.start('Tutorial', { next: 'Title' });
    }, { fontSize: 12 });

    makeButton(this, width / 2 + 62, height * 0.825, 106, 30, 'Logros', () => {
      this.scene.start('Achievements');
    }, { fontSize: 12 });
  }

  /**
   * Las cuatro dificultades, en fila. Se guarda la elegida para la próxima
   * vez: nadie quiere volver a poner "pesadilla" cada vez que reintenta.
   *
   * Cambiarla rehace la config entera (ver Difficulty.js), así que hay que
   * hacerlo aquí y no al empezar la partida: el tutorial y los textos ya
   * consultan cosas como la meta de la ronda.
   */
  pintarSelectorDificultad(width, height) {
    const mec = GameState.mecanicas || {};
    const opciones = listar(mec);
    if (!opciones.length) return;

    const y = height * 0.55;
    this.add.text(width / 2, y - 24, 'DIFICULTAD', {
      fontFamily: F.body, fontSize: '11px', color: C.textDim, letterSpacing: 2,
    }).setOrigin(0.5);

    const ancho = 128, hueco = 6;
    const total = opciones.length * ancho + (opciones.length - 1) * hueco;
    this.botonesDif = [];
    this.descripcion = this.add.text(width / 2, y + 26, '', {
      fontFamily: F.body, fontSize: '12px', color: C.textDim,
    }).setOrigin(0.5);

    opciones.forEach((op, i) => {
      const x = width / 2 - total / 2 + ancho / 2 + i * (ancho + hueco);
      const btn = makeButton(this, x, y, ancho, 28, op.nombre,
        () => this.elegirDificultad(op.clave), { fontSize: 12 });
      this.botonesDif.push({ clave: op.clave, btn, desc: op.descripcion });
    });

    this.marcarDificultad(leerGuardada());
  }

  elegirDificultad(clave) {
    guardar(clave);
    const base = GameState.configBase || GameState.config;
    GameState.configBase = base;
    GameState.config = aplicar(base, GameState.mecanicas || {}, clave);
    GameState.reset(GameState.config);
    this.marcarDificultad(clave);
  }

  marcarDificultad(clave) {
    if (!this.botonesDif) return;
    for (const { clave: c, btn, desc } of this.botonesDif) {
      // El elegido se ve apagado a propósito: es el que NO se puede pulsar.
      btn.setEnabled(c !== clave);
      if (c === clave && this.descripcion) this.descripcion.setText(desc);
    }
  }
}
