// main.js — configuración de Phaser y arranque.

import { BootScene } from './scenes/BootScene.js?v=20260903c';
import { TitleScene } from './scenes/TitleScene.js';
import { Act1Scene } from './scenes/Act1Scene.js';
import { Act2Scene } from './scenes/Act2Scene.js';
import { TutorialScene } from './scenes/TutorialScene.js';
import { FarkleScene } from './scenes/FarkleScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { AchievementsScene } from './scenes/AchievementsScene.js';

// El juego abierto con doble clic, sin servidor (ver tools/empaquetar.py).
const SIN_SERVIDOR = location.protocol === 'file:';

const config = {
  // WebGL se niega a subir a la placa una imagen leída del disco: la considera
  // "de otro sitio" y la bloquea (texImage2D: contains cross-origin data). Se
  // cargaba el arte pero no se dibujaba ni un pixel y el juego no pasaba de la
  // barra de carga.
  //
  // El renderer de canvas no tiene ese problema: solo prohíbe LEER los pixeles
  // de vuelta, y el juego no lee ninguno. Para una novela visual con un puñado
  // de sprites la diferencia de rendimiento no se nota.
  type: SIN_SERVIDOR ? Phaser.CANVAS : Phaser.AUTO,
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
  scene: [BootScene, TitleScene, Act1Scene, Act2Scene, TutorialScene, FarkleScene, EndingScene, AchievementsScene],

  // El paquete que se le pasa a alguien para jugar sin instalar nada se abre
  // con doble clic, o sea con la dirección file:// (ver tools/empaquetar.py).
  // Ahí el navegador bloquea TODO pedido XHR, y Phaser por defecto baja las
  // imágenes por XHR y la música por WebAudio (que también es XHR): la barra
  // de carga se quedaba en cero y no cargaba ni un asset.
  //
  // Con estas dos opciones usa una etiqueta <img> y una <audio>, que sí leen
  // archivos del disco. Solo se activan en file://; con servidor se sigue
  // usando WebAudio, que suena mejor y arranca más rápido.
  ...(SIN_SERVIDOR
    ? { loader: { imageLoadType: 'HTMLImageElement' }, audio: { disableWebAudio: true } }
    : {}),
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

/**
 * Portada de "click para empezar".
 *
 * No es decorativa: los navegadores no dejan que una página inicie audio hasta
 * que la persona interactúa con ella. Phaser se queda esperando a que se
 * decodifiquen los cuatro mp3 de música y la barra de carga se congela — se
 * quedaba en 89% sin decir nada, como si el juego se hubiera colgado. Con un
 * click previo el audio queda desbloqueado y la carga corre entera.
 */
function esperarClick() {
  return new Promise((resolve) => {
    const host = document.getElementById('game') || document.body;
    const portada = document.createElement('button');
    portada.type = 'button';
    portada.setAttribute('aria-label', 'Empezar el juego');
    portada.style.cssText = `
      position:absolute; inset:0; width:100%; height:100%;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:22px; border:0; cursor:pointer;
      background:#0a0708; color:#e0b878;
      font-family:"Cormorant Garamond", Georgia, serif;
    `;

    const titulo = document.createElement('div');
    titulo.textContent = 'Los hijos del caos';
    titulo.style.cssText = 'font-size:46px; line-height:1;';

    const sub = document.createElement('div');
    sub.textContent = 'El último dado';
    sub.style.cssText = 'font-size:20px; color:#8a6f5c; letter-spacing:.18em;';

    const pista = document.createElement('div');
    pista.textContent = 'click para empezar';
    pista.style.cssText =
      'font-family:Georgia,serif; font-size:14px; color:#6b5548; margin-top:26px;' +
      'animation:ldc-latido 1.8s ease-in-out infinite;';

    const est = document.createElement('style');
    est.textContent = '@keyframes ldc-latido{0%,100%{opacity:.45}50%{opacity:1}}';
    document.head.appendChild(est);

    portada.append(titulo, sub, pista);
    host.appendChild(portada);
    portada.focus();

    const empezar = () => { portada.remove(); resolve(); };
    portada.addEventListener('click', empezar, { once: true });
  });
}

// Expuesto en window para poder inspeccionar el estado desde la consola
// del navegador durante el playtesting: window.game.scene.getScene('Farkle')
Promise.all([precargarFuentes(), esperarClick()]).then(() => {
  const game = new Phaser.Game(config);
  window.game = game;

  // Phaser guarda en caché dónde está el canvas en la página y solo lo
  // recalcula al redimensionar. Si la ventana es más chica que 800x600 la
  // página se puede desplazar (ver index.html), y entonces el canvas se mueve
  // sin que Phaser se entere: los clicks caen corridos justo lo que se
  // desplazó, y los botones dejan de responder donde se ven.
  const reubicar = () => game.scale && game.scale.updateBounds();
  window.addEventListener('scroll', reubicar, { passive: true });
  window.addEventListener('resize', reubicar);
  document.addEventListener('visibilitychange', reubicar);
});
