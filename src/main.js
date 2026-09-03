// main.js — configuración de Phaser y arranque.

import { BootScene } from './scenes/BootScene.js?v=20260903c';
import { TitleScene } from './scenes/TitleScene.js';
import { Act1Scene } from './scenes/Act1Scene.js';
import { Act2Scene } from './scenes/Act2Scene.js';
import { TutorialScene } from './scenes/TutorialScene.js';
import { FarkleScene } from './scenes/FarkleScene.js';
import { EndingScene } from './scenes/EndingScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  backgroundColor: '#0a0708',
  antialias: true,
  antialiasGL: true,
  pixelArt: false,
  // Redondea las posiciones de dibujo a píxeles enteros: sin esto, un texto
  // centrado con setOrigin(0.5) puede caer en x.5 y sale con las serifas
  // difuminadas entre dos píxeles.
  roundPixels: true,
  scale: {
    // NONE, no FIT: el canvas se muestra a sus 800x600 reales y no lo estira
    // nadie. FIT lo escalaba a un factor fraccionario y ahí se perdía el texto.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  scene: [BootScene, TitleScene, Act1Scene, Act2Scene, TutorialScene, FarkleScene, EndingScene],
};

// Poner `ctx.font = '52px Cormorant Garamond'` en un canvas NO hace que el
// navegador descargue esa webfont: solo la baja cuando un elemento del DOM la
// necesita. Como index.html no tiene texto HTML, Phaser rasterizaba en la
// fuente de reserva sin avisar. Hay que pedirlas a mano y esperar antes de
// crear el juego, porque Phaser dibuja cada texto una sola vez y no lo rehace
// cuando la fuente llega tarde.
//
// Solo hace falta Cormorant Garamond, y solo para los títulos grandes: el
// texto chico usa Georgia, que ya viene con Windows.
const FUENTES = [
  '500 52px "Cormorant Garamond"',
  '500 30px "Cormorant Garamond"',
];

async function precargarFuentes() {
  if (!document.fonts) return;
  // Si no hay internet no nos quedamos colgados: se arranca con la de reserva.
  const limite = new Promise((r) => setTimeout(r, 2500));
  try {
    await Promise.race([
      Promise.all(FUENTES.map((f) => document.fonts.load(f))).then(() => document.fonts.ready),
      limite,
    ]);
  } catch (e) {
    console.warn('[La Estrella de Mar] Fuentes no disponibles, se usa Georgia.', e);
  }
}

// Expuesto en window para poder inspeccionar el estado desde la consola
// del navegador durante el playtesting: window.game.scene.getScene('Farkle')
precargarFuentes().then(() => {
  window.game = new Phaser.Game(config);
});
