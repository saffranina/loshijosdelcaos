// juego.js — TODOS los modulos de src/ en un solo archivo.
//
// Generado por tools/empaquetar.py. No editar a mano: se pisa en el
// proximo armado. Los originales estan en src/.
(function () {
"use strict";
var __M = {};

// --------------------------------------------------------------------
// src/theme.js
__M["src/theme.js"] = (function () {
// theme.js — paleta y tipografía compartidas.
// Todo lo que sea "provisional" (colores de placeholder) vive acá para que
// cambiarlo cuando llegue el arte sea un solo archivo.

const C = {
  // Ambiente
  night:      0x0a0708,
  roomDark:   0x1b1013,
  roomWarm:   0x2e1c1c,
  barDark:    0x140d0e,
  barWarm:    0x3a2418,
  lamp:       0xd9a05b,

  // UI
  boxFill:    0x111b27,
  boxStroke:  0x71859a,
  textMain:   '#f4f7fa',
  textDim:    '#ccd6df',
  // Las acotaciones iban en gris medio y eran lo que peor se leía: su tinta
  // nunca llegaba a un tono claro, así que la letra se veía lavada. Subido.
  textStage:  '#dbe3ea',
  textName:   '#ffffff',

  // Personajes (placeholder rects + nombres)
  rein:       0x3f5a72,
  reinName:   '#8fb4d4',
  daku:       0x6b2f4a,
  dakuName:   '#d98ab0',
  nuriName:   '#d9bd7a',
  narrator:   '#a99b8d',

  // Recursos
  emp:        0x6fd0e0,
  empEmpty:   0x344657,
  drink:      0xd98a3a,
  cloth:      0xb9cad9,
  clothLost:  0x33404d,

  // Dados
  dieFace:    0xe8dcc8,
  diePip:     0x2a1e18,
  dieHeld:    0xd9a05b,
  dieSelect:  0x8fd48f,
  dieDead:    0x8a7f70,
};

// Tipografía.
//
// Georgia para todo lo que sea texto chico (diálogo, nombres, botones). No es
// una elección estética sino técnica: Georgia fue diseñada para leerse en
// pantalla a tamaños chicos y trae "hinting", que ajusta los trazos a la
// grilla de píxeles. Las webfonts finas tipo Spectral o Cormorant Garamond no
// lo tienen y a 15-19px se ven blandas.
//
// Cormorant Garamond queda SOLO para el título grande (52px), que es el
// tamaño para el que esa fuente está pensada.
//
// Para comparar opciones lado a lado: tests/nitidez.html
const F = {
  body:  'Georgia, "Times New Roman", serif',
  name:  'Georgia, "Times New Roman", serif',
  title: '"Cormorant Garamond", Georgia, serif',

  sizeBody:   '17px',
  weightBody: 'normal',
  sizeName:   '19px',
  sizeSmall:  '14px',
};

/** Nombre visible y color por speaker. */
const SPEAKERS = {
  rein:     { name: 'Reinhart', color: C.reinName },
  daku:     { name: 'Daku',     color: C.dakuName },
  nuri:     { name: 'Nuri',     color: C.nuriName },
  narrator: { name: '',         color: C.narrator },
  stage:    { name: '',         color: C.textStage },
};
return { "C": C, "F": F, "SPEAKERS": SPEAKERS };
})();

// --------------------------------------------------------------------
// src/systems/GameState.js
__M["src/systems/GameState.js"] = (function () {
// GameState.js — estado global de la partida. Un solo objeto compartido entre escenas.

const GARMENTS = ['shirt', 'pants', 'underwear'];

const GARMENT_ES = {
  jacket: 'chaqueta',
  shoes: 'zapatos',
  socks: 'medias',
  shirt: 'camisa',
  pants: 'pantalón',
  underwear: 'ropa interior',
};

class State {
  constructor() {
    this.config = null;
    this.dialogues = null;
    this.reset();
  }

  reset(config = this.config) {
    this.config = config;
    const c = config || {};

    // Narrativa
    this.esryBranch = null;       // 'esry_aggressive' | 'esry_diplomatic' | 'esry_direct'
    this.lastTone = null;         // 'provoke' | 'flirt' | 'stoic'

    // Ropa: tres prendas, una en juego por cada ronda.
    this.reinLost = 0;
    this.dakuLost = 0;

    // Recursos
    this.emp = c.starting_emp ?? 3;
    this.maxEmp = c.max_emp ?? 5;
    this.sobriety = 1.0;          // 1 = lúcido, 0 = destruido
    this.drinks = 0;

    // Partida
    this.round = 1;
    this.reinRoundsWon = 0;
    this.dakuRoundsWon = 0;
    this.doubleOrNothing = false;
    this.donOffered = false;

    // Registro de trampas (define los endings secretos)
    this.cheatsTotal = 0;
    this.cheatsCaught = 0;
    this.accusationsMade = 0;
    this.falseAccusations = 0;

    this.ending = null;
  }

  // ---- ropa ----
  remaining(who) {
    return GARMENTS.length - (who === 'rein' ? this.reinLost : this.dakuLost);
  }

  /** Devuelve las claves de las tres prendas que se pierden, en orden. */
  loseGarments(who, count = 1) {
    const lost = [];
    for (let i = 0; i < count; i++) {
      const already = who === 'rein' ? this.reinLost : this.dakuLost;
      if (already >= GARMENTS.length) break;
      lost.push(GARMENTS[already]);
      if (who === 'rein') this.reinLost++;
      else this.dakuLost++;
    }
    return lost;
  }

  isNaked(who) {
    return this.remaining(who) <= 0;
  }

  /**
   * Qué portrait corresponde según la ropa que le queda.
   * Vive acá y no en ClothingManager porque también lo necesitan las escenas
   * de novela visual: en los endings hay que mostrar a quien perdió como
   * quedó, no vestido.
   * @param {'rein'|'daku'} who
   * @returns {'clothed'|'shirtless'|'underwear'}
   */
  clothingStage(who) {
    const lost = who === 'rein' ? this.reinLost : this.dakuLost;
    if (lost >= 2) return 'underwear';
    if (lost >= 1) return 'shirtless';
    return 'clothed';
  }

  /** Nivel de desnudez para elegir el pool de taunts. */
  nakednessLevel(who) {
    const lost = who === 'rein' ? this.reinLost : this.dakuLost;
    if (lost === 0) return 'clothed';
    if (lost === 1) return 'half_stripped';
    return 'nearly_naked';
  }

  /** El nivel de la escena combina a los dos: manda el más desnudo. */
  sceneLevel() {
    const lost = Math.max(this.reinLost, this.dakuLost);
    if (lost === 0) return 'clothed';
    if (lost === 1) return 'half_stripped';
    return 'nearly_naked';
  }

  // ---- recursos ----
  spendEmp() {
    if (this.emp <= 0) return false;
    this.emp--;
    return true;
  }

  drink() {
    const c = this.config || {};
    this.drinks++;
    this.emp = Math.min(this.maxEmp, this.emp + (c.emp_per_drink ?? 1));
    this.sobriety = Math.max(0, this.sobriety - (c.sobriety_loss_per_drink ?? 0.2));
  }

  restoreResources(empStages = 0, sobrietyStages = 0) {
    const step = this.config?.sobriety_loss_per_drink ?? 0.2;
    this.emp = Math.min(this.maxEmp, this.emp + empStages);
    this.sobriety = Math.min(1, this.sobriety + sobrietyStages * step);
  }

  /** 0 = sobrio, 1 = ciego. Se usa para escalar los efectos visuales. */
  get drunkenness() {
    return 1 - this.sobriety;
  }

  // ---- endings ----
  /**
   * Los endings secretos tienen prioridad sobre los principales (ver GDD §8).
   * @param {'rein'|'daku'|'tie'} loser quién se quedó sin ropa
   */
  resolveEnding(loser) {
    if (loser === 'daku') {
      this.ending = 'rein_wins';
    } else {
      this.ending = 'daku_wins';
    }
    return this.ending;
  }
}

const GameState = new State();
return { "GARMENTS": GARMENTS, "GARMENT_ES": GARMENT_ES, "GameState": GameState };
})();

// --------------------------------------------------------------------
// src/scenes/BootScene.js
__M["src/scenes/BootScene.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var GameState = __M["src/systems/GameState.js"].GameState;
// BootScene.js — carga datos y arte. Todo el arte es OPCIONAL: si un PNG
// todavía no existe, el juego sigue con placeholders y no rompe.


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

class BootScene extends Phaser.Scene {
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
return { "BootScene": BootScene };
})();

// --------------------------------------------------------------------
// src/systems/DomUi.js
__M["src/systems/DomUi.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
// DomUi.js — botones dibujados con HTML encima del canvas.
//
// ¿Por qué no en el canvas, como todo lo demás?
//
// Los botones de Phaser son Containers con un área de click definida a mano.
// Eso obliga a que dos cosas coincidan: dónde se DIBUJA el rectángulo y dónde
// Phaser CREE que está para el hit test. Cuando no coinciden —por la matriz de
// la cámara, por el tamaño del contenedor, por el origen— el botón responde en
// un lugar distinto del que se ve. Eso daba tres síntomas a la vez: los
// botones grandes solo reaccionaban cerca del texto, parecían corridos, y los
// chicos (como "? Reglas") quedaban directamente muertos.
//
// Un <button> de HTML no tiene ese problema: el navegador usa el rectángulo
// que realmente ocupa. Además hereda el suavizado de subpíxeles, igual que el
// cuadro de diálogo.
//
// Las coordenadas siguen siendo las del juego (x e y = CENTRO del botón en el
// espacio de 800x600). Funciona porque el canvas se muestra a escala 1:1.


const CSS_ID = 'ldc-estilos-botones';

function asegurarEstilos() {
  if (document.getElementById(CSS_ID)) return;
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const el = document.createElement('style');
  el.id = CSS_ID;
  el.textContent = `
.ldc-boton {
  position: absolute;
  box-sizing: border-box;
  margin: 0;
  padding: 2px 8px;
  z-index: 20;
  display: flex; align-items: center; justify-content: center;
  text-align: center;
  font-family: ${F.body};
  color: ${C.textMain};
  background: #172534f5;
  border: 1px solid ${hex(C.boxStroke)}99;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1.2;
  transition: background .12s, border-color .12s, color .12s;
}
.ldc-boton:hover:not(:disabled) {
  background: #2b4054; border-color: ${hex(C.boxStroke)}; color: #ffe9cf;
}
.ldc-boton:disabled { opacity: .38; cursor: default; }
.ldc-boton[hidden] { display: none !important; }
`;
  document.head.appendChild(el);
}

/**
 * Crea un botón. Misma firma y mismos métodos que la versión de canvas, así
 * que las escenas no cambian.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x centro horizontal, en coordenadas del juego
 * @param {number} y centro vertical
 * @param {number} w @param {number} h
 * @param {string} label
 * @param {Function} onClick
 * @param {object} opts { fontSize }
 */
function makeButton(scene, x, y, w, h, label, onClick, opts = {}) {
  asegurarEstilos();

  const host = scene.game.canvas.parentNode || document.body;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ldc-boton';
  b.textContent = label;
  b.style.left = `${Math.round(x - w / 2)}px`;
  b.style.top = `${Math.round(y - h / 2)}px`;
  b.style.width = `${w}px`;
  b.style.height = `${h}px`;
  b.style.fontSize = `${opts.fontSize ?? 15}px`;
  host.appendChild(b);

  let action = onClick;
  let visible = true;

  b.addEventListener('click', (ev) => {
    // Sin esto el click sigue viaje y además avanza el diálogo de atrás.
    ev.stopPropagation();
    if (!b.disabled && action) action();
  });

  // Mientras la escena está pausada (por ejemplo con las reglas abiertas) los
  // botones no deben verse ni responder: el canvas de abajo está tapado, pero
  // el HTML flota por encima de todo.
  const alPausar = () => { b.hidden = true; };
  const alReanudar = () => { b.hidden = !visible; };
  scene.events.on('pause', alPausar);
  scene.events.on('resume', alReanudar);
  scene.events.once('shutdown', () => api.destroy());
  scene.events.once('destroy', () => api.destroy());

  const api = {
    el: b,
    setLabel(t) { b.textContent = t; return api; },
    setEnabled(v) { b.disabled = !v; return api; },
    isEnabled() { return !b.disabled; },
    setAction(fn) { action = fn; return api; },
    setVisible(v) { visible = v; b.hidden = !v; return api; },
    // El apilado lo resuelve el z-index del CSS; se mantiene por compatibilidad
    // con las escenas que venían encadenando .setDepth().
    setDepth() { return api; },
    setPosition(nx, ny) {
      b.style.left = `${Math.round(nx - w / 2)}px`;
      b.style.top = `${Math.round(ny - h / 2)}px`;
      return api;
    },
    destroy() {
      scene.events.off('pause', alPausar);
      scene.events.off('resume', alReanudar);
      b.remove();
    },
  };
  return api;
}
return { "makeButton": makeButton };
})();

// --------------------------------------------------------------------
// src/systems/Ui.js
__M["src/systems/Ui.js"] = (function () {
var C = __M["src/theme.js"].C;
// Ui.js — botones y paneles reutilizables. Placeholder pintado por código;
// cuando lleguen los assets de UI se reemplaza el Graphics por una imagen.


// Los botones ahora se dibujan con HTML encima del canvas (DomUi.js): el área
// de click en el canvas no coincidía con el rectángulo pintado y los botones
// respondían corridos, solo cerca del texto. Se reexporta con el mismo nombre
// para que ninguna escena tenga que cambiar.

/** Panel de fondo con borde, para cuadros de diálogo y paneles de recursos. */
function panel(scene, x, y, w, h, opts = {}) {
  const g = scene.add.graphics();
  g.fillStyle(opts.fill ?? C.boxFill, opts.alpha ?? 0.88);
  g.lineStyle(opts.lineWidth ?? 1, opts.stroke ?? C.boxStroke, opts.strokeAlpha ?? 0.7);
  g.fillRoundedRect(x, y, w, h, opts.radius ?? 5);
  g.strokeRoundedRect(x, y, w, h, opts.radius ?? 5);
  return g;
}

/** Fondo de escena provisional: degradado vertical de dos tonos + viñeta. */
function paintBackdrop(scene, topColor, bottomColor) {
  const { width, height } = scene.scale;
  const g = scene.add.graphics();
  const steps = 40;
  const top = Phaser.Display.Color.IntegerToColor(topColor);
  const bot = Phaser.Display.Color.IntegerToColor(bottomColor);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(top, bot, 100, t * 100);
    g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
    g.fillRect(0, (height / steps) * i, width, height / steps + 1);
  }
  // viñeta
  const v = scene.add.graphics();
  v.fillStyle(0x000000, 0.5);
  v.fillRect(0, 0, width, 40);
  v.fillRect(0, height - 40, width, 40);
  return g;
}
return { "makeButton": __M["src/systems/DomUi.js"].makeButton, "paintBackdrop": paintBackdrop, "panel": panel };
})();

// --------------------------------------------------------------------
// src/systems/Music.js
__M["src/systems/Music.js"] = (function () {
let current = null;
let currentKey = null;

function playMusic(scene, key, volume = 0.34) {
  if (!scene.cache.audio.exists(key)) return;
  if (currentKey === key && current?.isPlaying) return;
  if (current) {
    current.stop();
    current.destroy();
  }
  currentKey = key;
  current = scene.sound.add(key, { loop: true, volume });
  current.play();
}

function stopMusic() {
  if (current) {
    current.stop();
    current.destroy();
  }
  current = null;
  currentKey = null;
}
return { "playMusic": playMusic, "stopMusic": stopMusic };
})();

// --------------------------------------------------------------------
// src/scenes/TitleScene.js
__M["src/scenes/TitleScene.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var makeButton = __M["src/systems/Ui.js"].makeButton;
var paintBackdrop = __M["src/systems/Ui.js"].paintBackdrop;
var GameState = __M["src/systems/GameState.js"].GameState;
var playMusic = __M["src/systems/Music.js"].playMusic;
// TitleScene.js — pantalla de título.


class TitleScene extends Phaser.Scene {
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

    makeButton(this, width / 2, height * 0.60, 230, 44, 'Entrar al bar', () => {
      GameState.reset(GameState.config);
      playMusic(this, 'music_bar');
      this.scene.start('Act1');
    }, { fontSize: 17 });

    makeButton(this, width / 2, height * 0.70, 230, 36, 'Ir directo al Farkle', () => {
      GameState.reset(GameState.config);
      playMusic(this, 'music_farkle');
      this.scene.start('Tutorial', { next: 'Farkle' });
    }, { fontSize: 14 });

    makeButton(this, width / 2, height * 0.78, 230, 34, 'Cómo jugar', () => {
      this.scene.start('Tutorial', { next: 'Title' });
    }, { fontSize: 13 });
  }
}
return { "TitleScene": TitleScene };
})();

// --------------------------------------------------------------------
// src/systems/Portraits.js
__M["src/systems/Portraits.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var SPEAKERS = __M["src/theme.js"].SPEAKERS;
// Portraits.js — muestra el portrait del que habla.
// Si el PNG existe, lo usa. Si no, dibuja un rectángulo de color con el nombre.
// Cuando lleguen las capas de ropa, ClothingManager las apila encima acá.


// Expresiones del guion → archivo. Si falta una, cae a la siguiente de la lista.
const FALLBACK = {
  neutral:   ['neutral', 'smile', 'smug'],
  smile:     ['smile', 'neutral', 'flirty'],
  flirty:    ['flirty', 'smile', 'neutral'],
  smug:      ['smug', 'flirty', 'smile', 'neutral'],
  surprised: ['surprised', 'neutral', 'smile'],
  dice:      ['dice', 'smug', 'smile', 'neutral'],
};

/** Clave de textura que existe para (personaje, expresión). null si no hay ninguna. */
function resolveTexture(scene, who, expression) {
  const chain = FALLBACK[expression] || FALLBACK.neutral;
  for (const e of chain) {
    const key = `${who}_${e}`;
    if (scene.textures.exists(key)) return key;
  }
  return null;
}

class PortraitView {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} opts { x, y, width, height, who }
   */
  constructor(scene, opts) {
    this.scene = scene;
    this.who = opts.who;
    this.w = opts.width;
    this.h = opts.height;

    this.container = scene.add.container(opts.x, opts.y);

    this.placeholder = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', {
      fontFamily: F.title, fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.75);

    this.image = scene.add.image(0, 0, '__MISSING').setVisible(false);
    this.container.add([this.placeholder, this.label, this.image]);

    this.expression = 'neutral';
    this.clothingStage = 'clothed';
    this.render();
  }

  setExpression(expression) {
    this.expression = expression || 'neutral';
    this.render();
    return this;
  }

  setClothingStage(stage) {
    this.clothingStage = stage;
    this.render();
    return this;
  }

  setDepth(d) { this.container.setDepth(d); return this; }
  setVisible(v) { this.container.setVisible(v); return this; }
  setAlpha(a) { this.container.setAlpha(a); return this; }
  setPosition(x, y) { this.container.setPosition(x, y); return this; }

  /** Atenúa al personaje que no está hablando. */
  setActive(active) {
    this.container.setAlpha(active ? 1 : 0.45);
    return this;
  }

  render() {
    let key = null;
    if (this.clothingStage === 'underwear') {
      const candidate = `${this.who}_underwear`;
      if (this.scene.textures.exists(candidate)) key = candidate;
    } else if (this.clothingStage === 'shirtless') {
      const surprised = `${this.who}_shirtless_surprised`;
      const normal = `${this.who}_shirtless`;
      if (this.expression === 'surprised' && this.scene.textures.exists(surprised)) key = surprised;
      else if (this.scene.textures.exists(normal)) key = normal;
    }
    if (!key) key = resolveTexture(this.scene, this.who, this.expression);
    if (key) {
      this.image.setTexture(key).setVisible(true);
      // Encaja la imagen dentro del alto disponible sin deformarla.
      const src = this.scene.textures.get(key).getSourceImage();
      const scale = Math.min(this.w / src.width, this.h / src.height);
      this.image.setScale(scale).setOrigin(0.5, 0.5);
      this.placeholder.setVisible(false);
      this.label.setVisible(false);
    } else {
      this.image.setVisible(false);
      this.placeholder.setVisible(true).clear();
      const col = C[this.who] ?? C.daku;
      this.placeholder.fillStyle(col, 0.85);
      this.placeholder.lineStyle(1, 0xffffff, 0.15);
      this.placeholder.fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 8);
      this.placeholder.strokeRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 8);
      const name = SPEAKERS[this.who]?.name ?? this.who;
      this.label.setVisible(true).setText(`${name}\n[${this.expression}]`);
      this.label.setAlign('center');
    }
  }

  destroy() { this.container.destroy(); }
}
return { "PortraitView": PortraitView, "resolveTexture": resolveTexture };
})();

// --------------------------------------------------------------------
// src/systems/Sfx.js
__M["src/systems/Sfx.js"] = (function () {
// Sfx.js — efectos de sonido cortos, sintetizados en el momento.
//
// No hay archivos de audio para esto todavía, así que en vez de esperar los
// assets se generan con WebAudio: son ruidos muy breves (5 a 60 ms) y salen
// más livianos que cualquier .mp3. Cuando haya sonidos pintados a mano, se
// reemplaza el cuerpo de cada función por scene.sound.play('...') y el resto
// del juego no cambia.
//
// Todo pasa por un único nodo de volumen para poder silenciarlo de una.

let ctx = null;
let master = null;
let apagado = false;

function audio() {
  if (apagado) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { apagado = true; return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  // El navegador suspende el contexto hasta que hay un gesto del usuario.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Ruido blanco corto, la base de los golpes secos (dados, teclas). */
function golpe({ dur = 0.03, vol = 0.2, corte = 3000, tipo = 'bandpass', q = 1 } = {}) {
  const c = audio();
  if (!c) return;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, n, c.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) {
    // Ruido que se apaga rápido: da la sensación de impacto, no de zumbido.
    datos[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;

  const filtro = c.createBiquadFilter();
  filtro.type = tipo;
  filtro.frequency.value = corte;
  filtro.Q.value = q;

  const g = c.createGain();
  g.gain.value = vol;

  src.connect(filtro); filtro.connect(g); g.connect(master);
  src.start();
}

/** Una letra del typewriter. Muy corto y muy bajo: se escucha en ráfaga. */
function tecla() {
  golpe({
    dur: 0.012,
    vol: 0.05,
    // Un poco de variación de tono para que no suene a metrónomo.
    corte: 1700 + Math.random() * 900,
    q: 1.6,
  });
}

/** Apartar o soltar un dado: un clic seco de marfil. */
function dadoElegido() {
  golpe({ dur: 0.035, vol: 0.16, corte: 2600 + Math.random() * 600, q: 2.2 });
}

/** Tirada: varios golpes seguidos, como los dados rebotando en la mesa. */
function dadosLanzados(cantidad = 6) {
  const c = audio();
  if (!c) return;
  const rebotes = Math.min(9, 3 + cantidad);
  for (let i = 0; i < rebotes; i++) {
    const t = 30 + i * (55 + Math.random() * 70);
    setTimeout(() => golpe({
      dur: 0.05,
      vol: 0.2 * (1 - i / rebotes) + 0.04,
      corte: 900 + Math.random() * 1400,
      q: 1.2,
    }), t);
  }
}

/** Silencia o reactiva todos los efectos. */
function silenciar(v) {
  if (master) master.gain.value = v ? 0 : 0.5;
}
return { "dadoElegido": dadoElegido, "dadosLanzados": dadosLanzados, "silenciar": silenciar, "tecla": tecla };
})();

// --------------------------------------------------------------------
// src/systems/DialogueSystem.js
__M["src/systems/DialogueSystem.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var SPEAKERS = __M["src/theme.js"].SPEAKERS;
var tecla = __M["src/systems/Sfx.js"].tecla;
// DialogueSystem.js — cuadro de texto, typewriter, opciones de respuesta.
//
// El cuadro NO se dibuja en el canvas: es una capa HTML posicionada encima.
//
// ¿Por qué? El canvas dibuja el texto con suavizado en escala de grises. El
// HTML puede usar el suavizado de subpíxeles de Windows, que aprovecha los
// tres subpíxeles RGB de cada punto de la pantalla y triplica la resolución
// horizontal efectiva de la letra. A 17px la diferencia es enorme: comparadas
// lado a lado en tests/nitidez.html, la versión canvas se ve lavada y la HTML
// se lee limpia. Ninguna fuente ni tamaño arregla eso mientras el texto viva
// dentro del canvas.
//
// La capa se posiciona en las mismas coordenadas que usaba el cuadro dibujado,
// y funciona porque el canvas se muestra a escala 1:1 (ver README). Si alguna
// vez se escala el canvas, hay que escalar esta capa igual.
//
// La API pública es idéntica a la versión anterior, así que las escenas no
// saben ni les importa que esto sea HTML.


const CHAR_MS = 18;        // velocidad del typewriter
const CHAR_MS_FAST = 10;   // para líneas largas

const CSS_ID = 'ldc-estilos-dialogo';

/** Inyecta una sola vez el CSS de la capa, tomando los colores de theme.js. */
function asegurarEstilos() {
  if (document.getElementById(CSS_ID)) return;
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const css = `
.ldc-dialogo {
  position: absolute;
  box-sizing: border-box;
  background: ${hex(C.boxFill)}e8;
  border: 1px solid ${hex(C.boxStroke)}b3;
  border-radius: 5px;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  color: ${C.textMain};
  font-family: ${F.body};
  opacity: 1;
  transition: opacity .35s ease;
  cursor: pointer;
  user-select: none;
  -webkit-font-smoothing: auto;
}
.ldc-dialogo[hidden] { display: none !important; }
.ldc-nombre {
  position: absolute; left: 0; top: 8px; width: 320px;
  text-align: center;
  font-family: ${F.name}; font-size: ${F.sizeName}; font-weight: bold;
  color: ${C.textName};
  text-shadow: 0 1px 2px rgba(0,0,0,.75);
}
.ldc-cuerpo {
  position: absolute; left: 34px; top: 44px; right: 34px;
  font-size: ${F.sizeBody}; line-height: 1.38;
  color: ${C.textMain};
  text-shadow: 0 1px 2px rgba(0,0,0,.75);
  white-space: pre-wrap;
}
.ldc-cuerpo.acotacion { font-style: italic; color: ${C.textStage}; }
.ldc-cuerpo.narrador  { color: ${C.narrator}; }
.ldc-cuerpo.consigna  { font-style: italic; color: ${C.textDim}; }
.ldc-hint {
  position: absolute; right: 20px; bottom: 10px;
  font-size: ${F.sizeSmall}; color: ${C.textDim};
  animation: ldc-parpadeo 1.24s ease-in-out infinite;
}
@keyframes ldc-parpadeo { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
.ldc-opciones {
  position: absolute; left: 18px; right: 18px; bottom: 12px;
  display: flex; flex-wrap: wrap; gap: 9px; justify-content: center;
}
.ldc-opcion {
  flex: 1 1 0; min-width: 150px;
  padding: 9px 10px;
  font-family: ${F.body}; font-size: 14px; line-height: 1.25;
  color: ${C.textMain};
  background: #241618ec;
  border: 1px solid ${hex(C.boxStroke)}99;
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
  transition: background .12s, border-color .12s, color .12s;
}
.ldc-opcion:hover { background: #3a2226; border-color: ${hex(C.boxStroke)}; color: #ffe9cf; }
`;
  const el = document.createElement('style');
  el.id = CSS_ID;
  el.textContent = css;
  document.head.appendChild(el);
}

class DialogueSystem {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} opts { x, y, w, h, onSpeaker, onSplash }
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.x = opts.x ?? 20;
    this.y = opts.y ?? 428;
    this.w = opts.w ?? 760;
    this.h = opts.h ?? 154;
    this.onSpeaker = opts.onSpeaker || (() => {});
    this.onSplash = opts.onSplash || null;

    asegurarEstilos();

    // La capa va dentro del mismo contenedor que el canvas, para que se mueva
    // con él si la página cambia de tamaño.
    const host = scene.game.canvas.parentNode || document.body;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    this.root = document.createElement('div');
    this.root.className = 'ldc-dialogo';
    this.root.style.left = `${this.x}px`;
    this.root.style.top = `${this.y}px`;
    this.root.style.width = `${this.w}px`;
    this.root.style.height = `${this.h}px`;
    if (scene.textures.exists('dialogue_frame')) {
      const src = scene.textures.get('dialogue_frame').getSourceImage();
      if (src && src.src) {
        this.root.style.backgroundImage = `url("${src.src}")`;
        this.root.style.border = 'none';
      }
    }

    this.nameEl = document.createElement('div');
    this.nameEl.className = 'ldc-nombre';

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'ldc-cuerpo';

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'ldc-hint';
    this.hintEl.textContent = '▼';
    this.hintEl.hidden = true;

    this.optionsEl = document.createElement('div');
    this.optionsEl.className = 'ldc-opciones';

    this.root.append(this.nameEl, this.bodyEl, this.hintEl, this.optionsEl);
    host.appendChild(this.root);

    this.choiceButtons = [];
    this.typing = false;
    this.waiting = false;
    this._full = '';
    this._timer = null;
    this._onAdvance = null;
    this._oculto = false;

    // Avanzar: click en el canvas, click en la capa, o teclado.
    this._pointerHandler = () => this._advance();
    scene.input.on('pointerdown', this._pointerHandler);
    this._domClick = () => this._advance();
    this.root.addEventListener('click', this._domClick);
    this._keyHandler = (ev) => {
      if (ev.code === 'Space' || ev.code === 'Enter') this._advance();
    };
    scene.input.keyboard.on('keydown', this._keyHandler);

    // Durante un fundido a negro la capa HTML seguiría visible sobre la
    // pantalla ya negra, así que la acompañamos.
    const cam = scene.cameras.main;
    this._onFadeOut = () => { this.root.style.opacity = '0'; };
    this._onFadeIn = () => { this.root.style.opacity = '1'; };
    cam.on('camerafadeoutstart', this._onFadeOut);
    cam.on('camerafadeincomplete', this._onFadeIn);

    scene.events.once('shutdown', () => this.destroy());
    scene.events.once('destroy', () => this.destroy());
  }

  setVisible(v) {
    this._oculto = !v;
    this.root.hidden = !v;
    return this;
  }

  // ------------------------------------------------------------------
  // Una línea
  // ------------------------------------------------------------------

  /** Muestra una línea con typewriter. onDone se llama cuando el jugador avanza. */
  say(line, onDone) {
    this.clearChoices();
    const speaker = line.speaker || 'narrator';
    const meta = SPEAKERS[speaker] || SPEAKERS.narrator;

    this.onSpeaker(speaker, line.expression);

    this.nameEl.textContent = meta.name;
    this.nameEl.style.color = meta.color;

    const isStage = speaker === 'stage';
    this.bodyEl.className = 'ldc-cuerpo' +
      (isStage ? ' acotacion' : speaker === 'narrator' ? ' narrador' : '');

    this._full = isStage ? `( ${line.text} )` : line.text;
    this._onAdvance = onDone;
    this._startTyping();
  }

  _startTyping() {
    this.bodyEl.textContent = '';
    this.hintEl.hidden = true;
    this.typing = true;
    this.waiting = false;

    let i = 0;
    const speed = this._full.length > 160 ? CHAR_MS_FAST : CHAR_MS;
    if (this._timer) this._timer.remove();
    this._timer = this.scene.time.addEvent({
      delay: speed,
      repeat: Math.max(0, this._full.length - 1),
      callback: () => {
        i++;
        this.bodyEl.textContent = this._full.slice(0, i);
        // Una de cada dos letras, y nunca en los espacios: con una por letra
        // el repiqueteo se vuelve un zumbido continuo.
        if (i % 2 === 0 && this._full[i - 1] !== ' ') tecla();
        if (i >= this._full.length) this._finishTyping();
      },
    });
  }

  _finishTyping() {
    if (this._timer) { this._timer.remove(); this._timer = null; }
    this.bodyEl.textContent = this._full;
    this.typing = false;
    this.waiting = true;
    this.hintEl.hidden = false;
  }

  _advance() {
    if (this.choiceButtons.length) return;   // hay opciones en pantalla
    if (this.typing) { this._finishTyping(); return; }
    if (!this.waiting) return;
    this.waiting = false;
    this.hintEl.hidden = true;
    const cb = this._onAdvance;
    this._onAdvance = null;
    if (cb) cb();
  }

  // ------------------------------------------------------------------
  // Secuencias
  // ------------------------------------------------------------------

  /**
   * Reproduce una lista de líneas. Las que traen `splash` se delegan a onSplash.
   * El splash se dibuja en el canvas, así que hay que esconder la capa mientras
   * dura o taparía la imagen.
   */
  play(lines, onComplete) {
    let i = 0;
    const next = () => {
      if (i >= lines.length) { if (onComplete) onComplete(); return; }
      const line = lines[i++];
      if (line.splash) {
        if (this.onSplash) {
          const estaba = !this.root.hidden;
          this.setVisible(false);
          this.onSplash(line, () => { if (estaba) this.setVisible(true); next(); });
        } else next();
      } else {
        this.say(line, next);
      }
    };
    next();
  }

  // ------------------------------------------------------------------
  // Opciones
  // ------------------------------------------------------------------

  /**
   * Muestra botones de respuesta dentro del cuadro.
   * @param {Array<{label:string}>} options
   * @param {Function} cb recibe (índice, opción)
   * @param {object} opts { prompt: string|null }
   */
  choices(options, cb, opts = {}) {
    this.clearChoices();
    this.hintEl.hidden = true;
    this.waiting = false;

    if (opts.prompt !== undefined && opts.prompt !== null) {
      this.nameEl.textContent = '';
      this.bodyEl.className = 'ldc-cuerpo consigna';
      this.bodyEl.textContent = opts.prompt;
    }

    options.forEach((o, idx) => {
      const b = document.createElement('button');
      b.className = 'ldc-opcion';
      b.type = 'button';
      b.textContent = o.label;
      b.addEventListener('click', (ev) => {
        // Sin esto el click sube hasta la capa y además avanza el diálogo.
        ev.stopPropagation();
        this.clearChoices();
        cb(idx, o);
      });
      this.optionsEl.appendChild(b);
      this.choiceButtons.push(b);
    });
  }

  clearChoices() {
    this.choiceButtons.forEach((b) => b.remove());
    this.choiceButtons = [];
  }

  /** Texto suelto sin esperar avance (para estados del juego). */
  note(speaker, text, expression) {
    this.clearChoices();
    const meta = SPEAKERS[speaker] || SPEAKERS.narrator;
    if (speaker && speaker !== 'stage' && speaker !== 'narrator') {
      this.onSpeaker(speaker, expression);
    }
    if (this._timer) { this._timer.remove(); this._timer = null; }
    this.typing = false;
    this.waiting = false;
    this.hintEl.hidden = true;
    this.nameEl.textContent = meta.name;
    this.nameEl.style.color = meta.color;
    this.bodyEl.className = 'ldc-cuerpo' + (speaker === 'stage' ? ' acotacion' : '');
    this.bodyEl.textContent = text;
  }

  destroy() {
    if (this._destruido) return;
    this._destruido = true;
    if (this._timer) this._timer.remove();
    this.scene.input.off('pointerdown', this._pointerHandler);
    this.scene.input.keyboard.off('keydown', this._keyHandler);
    const cam = this.scene.cameras && this.scene.cameras.main;
    if (cam) {
      cam.off('camerafadeoutstart', this._onFadeOut);
      cam.off('camerafadeincomplete', this._onFadeIn);
    }
    this.root.removeEventListener('click', this._domClick);
    this.clearChoices();
    this.root.remove();
  }
}
return { "DialogueSystem": DialogueSystem };
})();

// --------------------------------------------------------------------
// src/systems/SplashScreen.js
__M["src/systems/SplashScreen.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
// SplashScreen.js — imagen a pantalla completa dentro de la ventana del juego,
// con fade in / fade out. Si el PNG todavía no existe, muestra un cartel con
// la descripción del guion (así se puede jugar el flujo completo sin arte).


class SplashScreen {
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
return { "SplashScreen": SplashScreen };
})();

// --------------------------------------------------------------------
// src/scenes/VNScene.js
__M["src/scenes/VNScene.js"] = (function () {
var C = __M["src/theme.js"].C;
var paintBackdrop = __M["src/systems/Ui.js"].paintBackdrop;
var PortraitView = __M["src/systems/Portraits.js"].PortraitView;
var DialogueSystem = __M["src/systems/DialogueSystem.js"].DialogueSystem;
var SplashScreen = __M["src/systems/SplashScreen.js"].SplashScreen;
var GameState = __M["src/systems/GameState.js"].GameState;
// VNScene.js — base para los actos de visual novel pura (Actos 1, 2 y 4).
// Un portrait grande arriba, cuadro de diálogo abajo, splashes a pantalla completa.


class VNScene extends Phaser.Scene {
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

    // Nuri habla en el Acto 1 pero no tiene portrait: sus líneas dejan en pantalla
    // el último retrato, atenuado. Su retrato se sacó a pedido de la autora.
    this.portraits = {};
    for (const who of ['rein', 'daku']) {
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
return { "VNScene": VNScene };
})();

// --------------------------------------------------------------------
// src/scenes/Act1Scene.js
__M["src/scenes/Act1Scene.js"] = (function () {
var C = __M["src/theme.js"].C;
var VNScene = __M["src/scenes/VNScene.js"].VNScene;
var GameState = __M["src/systems/GameState.js"].GameState;
// Act1Scene.js — Acto 1: la entrada al bar y el reencuentro.


class Act1Scene extends VNScene {
  constructor() {
    super('Act1', { bgKey: 'bg_bar_inside', top: C.barWarm, bottom: C.barDark });
  }

  create() {
    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.buildStage();
    this.dialogue.play(GameState.dialogues.act1, () => this.goTo('Act2'));
  }
}
return { "Act1Scene": Act1Scene };
})();

// --------------------------------------------------------------------
// src/scenes/Act2Scene.js
__M["src/scenes/Act2Scene.js"] = (function () {
var C = __M["src/theme.js"].C;
var VNScene = __M["src/scenes/VNScene.js"].VNScene;
var GameState = __M["src/systems/GameState.js"].GameState;
// Act2Scene.js — Acto 2: la habitación 7, los stakes y la elección sobre Esry.
// Las tres ramas son cosméticas: llevan al mismo lugar, pero el jugador no lo sabe.


class Act2Scene extends VNScene {
  constructor() {
    super('Act2', { bgKey: 'bg_room', top: C.roomWarm, bottom: C.roomDark });
  }

  create() {
    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.buildStage();

    const act2 = GameState.dialogues.act2;

    this.dialogue.play(act2.intro, () => {
      this.dialogue.choices(
        act2.choice.options,
        (idx, opt) => {
          GameState.esryBranch = opt.next;
          this.dialogue.play(act2[opt.next], () => {
            this.dialogue.play(act2.continuation, () => this.goTo('Tutorial'));
          });
        },
        { prompt: '¿Cómo se lo preguntas?' }
      );
    });
  }
}
return { "Act2Scene": Act2Scene };
})();

// --------------------------------------------------------------------
// src/scenes/TutorialScene.js
__M["src/scenes/TutorialScene.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var makeButton = __M["src/systems/Ui.js"].makeButton;
var paintBackdrop = __M["src/systems/Ui.js"].paintBackdrop;
var panel = __M["src/systems/Ui.js"].panel;

const PAGES = [
  {
    title: '1 · Aparta dados que puntúan',
    body: 'Después de cada tirada debes elegir al menos un dado o combinación válida.\n\nHaz clic en un dado para seleccionarlo. Haz clic otra vez para deseleccionarlo.',
    visual: 'singles',
  },
  {
    title: '2 · Plantarse o arriesgar',
    body: 'APARTAR Y PLANTARSE guarda todos los puntos de tu turno. Ya no pueden perderse.\n\nAPARTAR Y TIRAR reserva esos dados y vuelve a lanzar los restantes. Si la nueva tirada no puntúa, haces Farkle y pierdes todo lo ganado durante ese turno.',
  },
  {
    title: '3 · Dados calientes',
    body: 'Si consigues puntuar usando los seis dados, recuperas los seis y puedes volver a tirarlos. Sigue siendo el mismo turno: si después haces Farkle, pierdes todos los puntos acumulados en él.',
  },
  {
    title: '4 · EMP, trampas y alcohol',
    body: 'Daku puede alterar un dado mientras te distrae. Acusar consume 1 EMP: si aciertas, Daku pierde su turno; si fallas, lo pierdes tú.\n\nBeber recupera 1 EMP, pero reduce tu sobriedad y dificulta ver los dados. Si tu sobriedad llega a cero, la partida termina.',
  },
  {
    title: '5 · Puntuación · dados iguales',
    body: '',
    visual: 'ofakind',
  },
  {
    title: '6 · Puntuación · combinaciones',
    body: '',
    visual: 'combos',
  },
];

class TutorialScene extends Phaser.Scene {
  constructor() { super('Tutorial'); }

  /**
   * Dos modos:
   *   { next: 'Farkle' }    tutorial de entrada; al terminar arranca esa escena.
   *   { volverA: 'Farkle' } consulta desde dentro de la partida; se abre encima
   *                         y al cerrar devuelve el control sin reiniciar nada.
   *
   * La distinción importa: usar `next` desde el Farkle reiniciaría la escena y
   * se perderían los puntos de la ronda, los dados y de quién es el turno.
   */
  init(data) {
    this.nextScene = data?.next || 'Farkle';
    this.volverA = data?.volverA || null;
  }

  /** Cierra la consulta y devuelve el control a la partida. */
  cerrar() {
    const volver = this.volverA;
    this.scene.stop();
    this.scene.resume(volver);
  }

  create() {
    const { width, height } = this.scale;

    // Abierto como consulta, el Farkle sigue vivo debajo: Phaser sigue
    // DIBUJANDO las escenas pausadas, y en la lista de main.js Tutorial va
    // antes que Farkle, o sea que se dibujaba debajo y no se veía ni una
    // regla. Solo asomaban los botones, que son HTML y van sobre el canvas.
    if (this.volverA) this.scene.bringToTop();

    if (this.textures.exists('bg_room')) {
      const bg = this.add.image(width / 2, height / 2, 'bg_room');
      const src = this.textures.get('bg_room').getSourceImage();
      bg.setScale(Math.max(width / src.width, height / src.height));
      this.add.rectangle(0, 0, width, height, 0x07111b, 0.46).setOrigin(0);
    } else {
      paintBackdrop(this, C.roomWarm, C.roomDark);
    }
    this.add.text(width / 2, 48, 'CÓMO JUGAR AL FARKLE', {
      fontFamily: F.title, fontSize: '30px', color: '#f4f7fa', letterSpacing: 2,
    }).setOrigin(0.5);
    panel(this, 92, 92, width - 184, 365, { alpha: 0.94, radius: 8 });

    this.titleText = this.add.text(width / 2, 128, '', {
      fontFamily: F.title, fontSize: '22px', color: '#f4f7fa', align: 'center',
    }).setOrigin(0.5);
    this.bodyText = this.add.text(width / 2, 188, '', {
      fontFamily: F.body, fontSize: '17px', color: C.textMain,
      align: 'left', lineSpacing: 8, wordWrap: { width: 530 },
    }).setOrigin(0.5, 0);
    this.pageText = this.add.text(width / 2, 435, '', {
      fontFamily: F.body, fontSize: '12px', color: C.textDim,
    }).setOrigin(0.5);

    this.back = makeButton(this, 255, 510, 150, 40, 'Anterior', () => {
      this.page = Math.max(0, this.page - 1); this.renderPage();
    });
    this.next = makeButton(this, 545, 510, 190, 40, 'Siguiente', () => {
      if (this.page < PAGES.length - 1) { this.page++; this.renderPage(); }
      else if (this.volverA) this.cerrar();
      else this.scene.start(this.nextScene);
    });

    // Abierto desde la partida se puede cerrar en cualquier página, sin tener
    // que pasar las seis.
    if (this.volverA) {
      makeButton(this, width - 74, 48, 108, 32, 'Cerrar', () => this.cerrar(), { fontSize: 14 });
      this.input.keyboard.on('keydown-ESC', () => this.cerrar());
    }

    this.page = 0;
    this.visualItems = [];
    this.renderPage();
  }

  clearVisuals() {
    this.visualItems.forEach((item) => item.destroy());
    this.visualItems = [];
  }

  die(value, x, y, size = 28) {
    const die = this.add.sprite(x, y, 'dice_sheet', value - 1).setScale(size / 512).setDepth(5);
    this.visualItems.push(die);
    return die;
  }

  diceRow(values, y, label) {
    const size = values.length > 5 ? 24 : 28;
    const gap = size + 5;
    const start = 185;
    values.forEach((value, i) => this.die(value, start + i * gap, y, size));
    const text = this.add.text(455, y, label, {
      fontFamily: F.body, fontSize: '15px', color: '#f4f7fa',
    }).setOrigin(0, 0.5).setDepth(5);
    this.visualItems.push(text);
  }

  renderVisual(kind) {
    if (!this.textures.exists('dice_sheet')) return;
    if (kind === 'singles') {
      // Debajo de donde el texto termine DE VERDAD, no en una altura fija:
      // si la primera frase pasa a dos líneas (depende de la tipografía que
      // haya conseguido cargar el navegador), una altura fija cae encima del
      // segundo párrafo y se leen las dos cosas superpuestas.
      const y = this.bodyText.y + this.bodyText.height + 36;

      for (const [x, label] of [[180, 'Cada'], [470, 'Cada']]) {
        const t = this.add.text(x, y, label, { fontFamily: F.body, fontSize: '16px', color: '#f4f7fa' })
          .setOrigin(0, 0.5).setDepth(5);
        this.visualItems.push(t);
      }
      this.die(1, 243, y, 42);
      this.die(5, 533, y, 42);
      for (const [x, label] of [[271, 'vale 100 puntos'], [561, 'vale 50 puntos']]) {
        const t = this.add.text(x, y, label, { fontFamily: F.body, fontSize: '16px', color: '#f4f7fa' })
          .setOrigin(0, 0.5).setDepth(5);
        this.visualItems.push(t);
      }
    } else if (kind === 'ofakind') {
      this.diceRow([1, 1, 1], 210, '= 1000');
      this.diceRow([6, 6, 6], 255, '= 600 · tríos del 2 al 6: valor ×100');
      this.diceRow([3, 3, 3, 3], 300, '= 1000');
      this.diceRow([4, 4, 4, 4, 4], 345, '= 2000');
      this.diceRow([2, 2, 2, 2, 2, 2], 390, '= 3000');
    } else if (kind === 'combos') {
      this.diceRow([1, 2, 3, 4, 5], 200, '= 750');
      this.diceRow([1, 2, 3, 4, 5, 6], 240, '= 1500');
      this.diceRow([1, 1, 3, 3, 5, 5], 280, '= 1500 · tres parejas');
      this.diceRow([2, 2, 2, 6, 6, 6], 320, '= 2500 · dos tríos');
      this.diceRow([4, 4, 4, 4, 2, 2], 360, '= 1500 · cuatro + pareja');
    }
  }

  renderPage() {
    this.clearVisuals();
    const p = PAGES[this.page];
    this.titleText.setText(p.title);
    this.bodyText.setText(p.body);
    this.pageText.setText(`${this.page + 1} / ${PAGES.length}`);
    this.back.setEnabled(this.page > 0);
    this.next.setLabel(
      this.page < PAGES.length - 1 ? 'Siguiente'
        : this.volverA ? 'Volver a la partida' : 'Empezar partida');
    this.renderVisual(p.visual);
  }
}
return { "TutorialScene": TutorialScene };
})();

// --------------------------------------------------------------------
// src/systems/Dice.js
__M["src/systems/Dice.js"] = (function () {
var C = __M["src/theme.js"].C;
// Dice.js — dado pintado por código. Cuando lleguen las 6 caras pintadas,
// se reemplaza _drawFace por un sprite y el resto sigue igual.


const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
};

class Die {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x @param {number} y @param {number} size
   * @param {Function} onClick recibe este Die
   */
  constructor(scene, x, y, size, onClick) {
    this.scene = scene;
    this.size = size;
    this.value = 1;
    this.selected = false;
    this.validSelection = false;
    this.kept = false;       // apartado en un tiro anterior de este turno
    this.dead = false;       // ya no participa
    this.drunk = 0;

    this.sprite = scene.textures.exists('dice_sheet')
      ? scene.add.sprite(0, 0, 'dice_sheet', 0).setVisible(true)
      : null;
    this.g = scene.add.graphics();
    this.container = scene.add.container(x, y, this.sprite ? [this.sprite, this.g] : [this.g]);
    this.container.setSize(size, size);
    this.homeX = x;
    this.homeY = y;

    this.container.setInteractive({ useHandCursor: true });
    this.container.on('pointerdown', () => { if (onClick) onClick(this); });
    this.redraw();
  }

  setDepth(d) { this.container.setDepth(d); return this; }
  setVisible(v) { this.container.setVisible(v); return this; }
  setPosition(x, y) { this.container.setPosition(x, y); this.homeX = x; this.homeY = y; return this; }

  setValue(v) { this.value = v; this.redraw(); return this; }
  setSelected(v) {
    this.selected = v;
    if (!v) this.validSelection = false;
    this.redraw();
    return this;
  }
  setSelectionValid(v) {
    this.validSelection = this.selected && v;
    this.redraw();
    return this;
  }
  setKept(v) {
    this.kept = v;
    this.selected = false;
    this.validSelection = false;
    this.redraw();
    return this;
  }
  setDead(v) { this.dead = v; this.redraw(); return this; }
  setDrunk(level) { this.drunk = Phaser.Math.Clamp(level, 0, 1); this.redraw(); return this; }

  redraw() {
    const s = this.size;
    const g = this.g;
    g.clear();

    if (this.sprite) {
      const frameW = 512;
      this.sprite.setFrame(this.value - 1);
      this.sprite.setScale(s / frameW).setAlpha(this.dead ? 0.42 : 1);
      this.sprite.clearTint();
      if (this.drunk > 0.35) this.sprite.setTint(0xb9c4cf);
      if (this.kept || this.selected) {
        const selectedBorder = this.validSelection ? 0xffd24a : C.dieSelect;
        g.lineStyle(this.selected ? 4 : 3, this.selected ? selectedBorder : C.dieHeld, 1);
        g.strokeRoundedRect(-s / 2, -s / 2, s, s, 5);
      }
      return;
    }

    let face = C.dieFace;
    let border = 0x0e0a08;
    let borderW = 1;
    if (this.dead) face = C.dieDead;
    if (this.kept) { border = C.dieHeld; borderW = 2; }
    if (this.selected) { border = this.validSelection ? 0xffd24a : C.dieSelect; borderW = 3; }

    g.fillStyle(face, this.dead ? 0.55 : 1);
    g.lineStyle(borderW, border, 1);
    g.fillRoundedRect(-s / 2, -s / 2, s, s, 7);
    g.strokeRoundedRect(-s / 2, -s / 2, s, s, 7);

    // Pips. Con alcohol pierden contraste y se les pega un fantasma desplazado.
    const r = Math.max(2.5, s * 0.085);
    const pips = PIPS[this.value] || [];
    const jitter = this.drunk * 2.2;
    const mainAlpha = 1 - this.drunk * 0.32;
    const ghostAlpha = this.drunk * 0.34;
    const ghostOff = this.drunk * 2.6;

    if (ghostAlpha > 0.02) {
      g.fillStyle(C.diePip, ghostAlpha);
      for (const [px, py] of pips) {
        g.fillCircle(-s / 2 + px * s + ghostOff, -s / 2 + py * s + ghostOff * 0.6, r);
      }
    }
    g.fillStyle(C.diePip, mainAlpha);
    for (const [px, py] of pips) {
      const jx = jitter ? Phaser.Math.FloatBetween(-jitter, jitter) : 0;
      const jy = jitter ? Phaser.Math.FloatBetween(-jitter, jitter) : 0;
      g.fillCircle(-s / 2 + px * s + jx, -s / 2 + py * s + jy, r);
    }
  }

  /** Animación de tirada: sacude y va cambiando de cara hasta el valor final. */
  rollTo(finalValue, duration = 460, onDone) {
    const scene = this.scene;
    this.setKept(false);
    this.setSelected(false);
    this.setDead(false);

    const ticks = Math.max(4, Math.floor(duration / 70));
    let n = 0;
    scene.time.addEvent({
      delay: 70,
      repeat: ticks - 1,
      callback: () => {
        n++;
        this.setValue(n >= ticks ? finalValue : 1 + Math.floor(Math.random() * 6));
        if (n >= ticks && onDone) onDone();
      },
    });
    scene.tweens.add({
      targets: this.container,
      y: { from: this.homeY - 16, to: this.homeY },
      angle: { from: Phaser.Math.Between(-25, 25), to: 0 },
      duration,
      ease: 'Bounce.easeOut',
    });
  }

  /**
   * La trampa: el dado cambia de valor con un destello.
   * flashMs largo = visible; corto = casi imperceptible.
   */
  cheatTo(newValue, flashMs) {
    const scene = this.scene;
    this.setValue(newValue);

    const s = this.size;
    const glow = scene.add.graphics();
    glow.lineStyle(2, 0xb98ce0, 0.9);
    glow.strokeRoundedRect(-s / 2 - 2, -s / 2 - 2, s + 4, s + 4, 8);
    this.container.add(glow);

    scene.tweens.add({
      targets: glow, alpha: { from: 0.95, to: 0 },
      duration: flashMs, ease: 'Sine.easeOut',
      onComplete: () => glow.destroy(),
    });
    scene.tweens.add({
      targets: this.container,
      angle: { from: -3.5, to: 0 },
      duration: Math.min(260, flashMs), ease: 'Elastic.easeOut',
    });
  }

  destroy() { this.container.destroy(); }
}
return { "Die": Die };
})();

// --------------------------------------------------------------------
// src/systems/EMPSystem.js
__M["src/systems/EMPSystem.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var GameState = __M["src/systems/GameState.js"].GameState;
// EMPSystem.js — barra de cargas de acusación.
// La lógica de gasto vive en GameState; esto es la vista + el botón de acusar.


class EMPSystem {
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
return { "EMPSystem": EMPSystem };
})();

// --------------------------------------------------------------------
// src/systems/DrinkSystem.js
__M["src/systems/DrinkSystem.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var GameState = __M["src/systems/GameState.js"].GameState;
// DrinkSystem.js — medidor de sobriedad y efectos visuales de ebriedad.
// Beber da +1 EMP y baja la sobriedad: más cargas para acusar, menos ojo para ver.


class DrinkSystem {
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
return { "DrinkSystem": DrinkSystem };
})();

// --------------------------------------------------------------------
// src/systems/ClothingManager.js
__M["src/systems/ClothingManager.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var GameState = __M["src/systems/GameState.js"].GameState;
var GARMENTS = __M["src/systems/GameState.js"].GARMENTS;
var GARMENT_ES = __M["src/systems/GameState.js"].GARMENT_ES;
// ClothingManager.js — 3 prendas por personaje. Dibuja el medidor de ropa que
// va debajo del portrait y elige qué retrato toca según lo que quede puesto.



class ClothingManager {
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

    // El número debajo de los cuadraditos: cuántas prendas quedan puestas
    // sobre el total. Empieza en 3/3 y baja. Los cuadraditos solos se leen
    // de un vistazo pero hay que contarlos, y en plena partida —con la vista
    // en los dados— es justo lo que uno no quiere hacer.
    this.label = scene.add.text(this.x, this.y + 13, '', {
      fontFamily: F.body, fontSize: F.sizeSmall, color: C.textDim,
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

    this.label.setText(`${remaining}/${GARMENTS.length}`);

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

  destroy() { this.g.destroy(); this.label.destroy(); }
}
return { "ClothingManager": ClothingManager };
})();

// --------------------------------------------------------------------
// src/systems/FarkleLogic.js
__M["src/systems/FarkleLogic.js"] = (function () {
// FarkleLogic.js — reglas y puntuación del Farkle. Módulo puro, sin Phaser.
// Todo acá es testeable de forma aislada (ver tests/test.html).

/** Tira n dados. */
function rollDice(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(1 + Math.floor(Math.random() * 6));
  return out;
}

function counts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}

/**
 * Puntúa un conjunto EXACTO de dados apartados.
 * Devuelve { score, valid }. valid = todos los dados aportan puntos.
 * Si sobra algún dado sin usar, valid es false (no se puede apartar basura).
 */
function scoreSelection(dice) {
  if (!dice || dice.length === 0) return { score: 0, valid: false };
  const c = counts(dice);
  const n = dice.length;
  let best = 0;

  // Combinaciones especiales de KCD.
  if (n === 6 && c.slice(1).every((x) => x === 1)) best = Math.max(best, 1500);

  // Escalera parcial 1-2-3-4-5.
  if (n === 5 && [1, 2, 3, 4, 5].every((v) => c[v] === 1)) best = Math.max(best, 750);

  // Tres pares
  if (n === 6 && c.slice(1).filter((x) => x === 2).length === 3) best = Math.max(best, 1500);

  // Dos tríos.
  if (n === 6 && c.slice(1).filter((x) => x === 3).length === 2) best = Math.max(best, 2500);

  // Póker + pareja.
  if (n === 6 && c.slice(1).some((x) => x === 4) && c.slice(1).some((x) => x === 2)) {
    best = Math.max(best, 1500);
  }

  // Combinaciones normales: n-de-un-tipo + 1s y 5s sueltos.
  let score = 0;
  let used = 0;
  for (let v = 1; v <= 6; v++) {
    const k = c[v];
    if (k >= 3) {
      const base = v === 1 ? 1000 : v * 100;
      score += k === 3 ? base : k === 4 ? 1000 : k === 5 ? 2000 : 3000;
      used += k;
    } else if (k > 0) {
      if (v === 1) { score += 100 * k; used += k; }
      else if (v === 5) { score += 50 * k; used += k; }
    }
  }
  if (used === n) best = Math.max(best, score);

  // valid: o bien una combinación especial de 6 dados, o todos los dados usados.
  const special =
    (n === 5 && [1, 2, 3, 4, 5].every((v) => c[v] === 1)) ||
    (n === 6 && (
      c.slice(1).every((x) => x === 1) ||
      c.slice(1).filter((x) => x === 2).length === 3 ||
      c.slice(1).filter((x) => x === 3).length === 2 ||
      (c.slice(1).some((x) => x === 4) && c.slice(1).some((x) => x === 2))
    ));
  const valid = best > 0 && (special || used === n);
  return { score: valid ? best : 0, valid };
}

/** ¿Este tiro tiene algún dado de puntuación? Si no, es Farkle. */
function hasScoring(dice) {
  const c = counts(dice);
  if (c[1] > 0 || c[5] > 0) return true;
  for (let v = 1; v <= 6; v++) if (c[v] >= 3) return true;
  if (dice.length === 6 && c.slice(1).every((x) => x === 1)) return true;
  if (dice.length === 6 && c.slice(1).filter((x) => x === 2).length === 3) return true;
  if (dice.length >= 5 && [1, 2, 3, 4, 5].every((v) => c[v] >= 1)) return true;
  if (dice.length === 6 && c.slice(1).filter((x) => x === 3).length === 2) return true;
  if (dice.length === 6 && c.slice(1).some((x) => x === 4) && c.slice(1).some((x) => x === 2)) return true;
  return false;
}

/** Todos los subconjuntos válidos de un tiro, como lista de índices. */
function validKeeps(dice) {
  const out = [];
  const total = 1 << dice.length;
  for (let mask = 1; mask < total; mask++) {
    const idx = [];
    for (let i = 0; i < dice.length; i++) if (mask & (1 << i)) idx.push(i);
    const r = scoreSelection(idx.map((i) => dice[i]));
    if (r.valid) out.push({ indices: idx, score: r.score });
  }
  return out;
}

/** El mejor apartado posible (máxima puntuación) de un tiro. */
function bestKeep(dice) {
  const keeps = validKeeps(dice);
  if (keeps.length === 0) return null;
  keeps.sort((a, b) => b.score - a.score || a.indices.length - b.indices.length);
  return keeps[0];
}

/** Probabilidad aproximada de farklear al tirar n dados. */
const FARKLE_ODDS = { 1: 0.667, 2: 0.444, 3: 0.278, 4: 0.157, 5: 0.077, 6: 0.023 };

/** Ganancia media aproximada de un tiro de n dados (cuando no farklea). */
const AVG_GAIN = { 1: 25, 2: 55, 3: 90, 4: 145, 5: 230, 6: 400 };

/**
 * Valor esperado de seguir tirando.
 * remaining = dados que quedarían (0 significa "dados calientes" → se tiran 6).
 */
function expectedValueOfRolling(remaining, turnPoints) {
  const n = remaining === 0 ? 6 : remaining;
  const risk = FARKLE_ODDS[n];
  return (1 - risk) * AVG_GAIN[n] - risk * turnPoints;
}

/** Etiqueta legible de una combinación, para el log de la mesa. */
function describeSelection(dice) {
  const c = counts(dice);
  const n = dice.length;
  if (n === 6 && c.slice(1).every((x) => x === 1)) return 'Escalera';
  if (n === 6 && c.slice(1).filter((x) => x === 2).length === 3) return 'Tres pares';
  if (n === 5 && [1, 2, 3, 4, 5].every((v) => c[v] === 1)) return 'Escalera 1–5';
  if (n === 6 && c.slice(1).filter((x) => x === 3).length === 2) return 'Dos tríos';
  if (n === 6 && c.slice(1).some((x) => x === 4) && c.slice(1).some((x) => x === 2)) return 'Póker + pareja';
  const parts = [];
  for (let v = 1; v <= 6; v++) {
    const k = c[v];
    if (k >= 3) parts.push(`${k}×${v}`);
    else if (k > 0 && (v === 1 || v === 5)) parts.push(k > 1 ? `${k} ${v}s` : `un ${v}`);
  }
  return parts.join(' + ') || '—';
}
return { "AVG_GAIN": AVG_GAIN, "FARKLE_ODDS": FARKLE_ODDS, "bestKeep": bestKeep, "describeSelection": describeSelection, "expectedValueOfRolling": expectedValueOfRolling, "hasScoring": hasScoring, "rollDice": rollDice, "scoreSelection": scoreSelection, "validKeeps": validKeeps };
})();

// --------------------------------------------------------------------
// src/systems/DakuAI.js
__M["src/systems/DakuAI.js"] = (function () {
var validKeeps = __M["src/systems/FarkleLogic.js"].validKeeps;
var expectedValueOfRolling = __M["src/systems/FarkleLogic.js"].expectedValueOfRolling;
var hasScoring = __M["src/systems/FarkleLogic.js"].hasScoring;
// DakuAI.js — decisiones de riesgo y sistema de trampas (telekinesis).


class DakuAI {
  constructor(config) {
    this.config = config;
    this.aggression = config.ai_aggression ?? 0.6;
    this.cheatProbability = config.cheat_probability ?? 0.25;
    this.caughtStreak = 0;   // si lo pillan seguido, se vuelve más cuidadoso
    this.cheatsThisGame = 0;
  }

  // ------------------------------------------------------------------
  // Decisiones de dados
  // ------------------------------------------------------------------

  /**
   * Elige qué apartar. No siempre agarra todo: a veces deja un 5 suelto
   * para tener más dados que tirar.
   * @returns {{indices:number[], score:number}|null}
   */
  chooseKeep(dice, turnPoints) {
    const keeps = validKeeps(dice);
    if (keeps.length === 0) return null;

    let best = null;
    let bestValue = -Infinity;
    for (const k of keeps) {
      const remaining = dice.length - k.indices.length;
      const pts = turnPoints + k.score;
      // Valor = puntos apartados + lo que espera sacar si sigue tirando.
      const contValue = Math.max(0, expectedValueOfRolling(remaining, pts));
      const value = k.score + contValue * this.aggression;
      if (value > bestValue) {
        bestValue = value;
        best = k;
      }
    }
    return best;
  }

  /**
   * ¿Sigue tirando o se planta?
   * @param {object} ctx { turnPoints, remaining, myRound, oppRound, target, mustBeat }
   */
  shouldContinue(ctx) {
    const { turnPoints, remaining, myRound, oppRound, target, mustBeat } = ctx;

    // Si es su última oportunidad y va perdiendo, tira hasta pasar al otro.
    if (mustBeat != null && myRound + turnPoints <= mustBeat) return true;

    // Si ya llegó a la meta, guarda (salvo que siga por debajo del rival).
    if (myRound + turnPoints >= target && myRound + turnPoints > oppRound) return false;

    const ev = expectedValueOfRolling(remaining, turnPoints);
    // La agresividad inclina la balanza: 0.6 ≈ arriesga un poco de más.
    const bias = (this.aggression - 0.5) * 120;
    return ev + bias > 0;
  }

  // ------------------------------------------------------------------
  // Trampas
  // ------------------------------------------------------------------

  /**
   * ¿Intenta hacer trampa en este tiro?
   * Trampas chicas al principio (para que el jugador gaste EMP),
   * grandes al final. Si lo pillaron seguido, baja la frecuencia.
   */
  wantsToCheat(state) {
    let p = this.cheatProbability;

    // Más tentado cuando va perdiendo.
    if (state.dakuLost > state.reinLost) p += 0.12;

    // Si lo pillaron las últimas veces, se contiene.
    p -= this.caughtStreak * 0.07;

    return Math.random() < Math.max(0.03, p);
  }

  /**
   * Planea qué dado tocar. Prefiere el cambio que más puntos gana,
   * pero en rondas tempranas se conforma con una trampa chica.
   * @returns {{index:number, from:number, to:number, magnitude:'small'|'big'}|null}
   */
  planCheat(dice, round) {
    const early = round <= 2;
    const candidates = [];

    for (let i = 0; i < dice.length; i++) {
      for (let v = 1; v <= 6; v++) {
        if (v === dice[i]) continue;
        const after = dice.slice();
        after[i] = v;
        const gain = this._roughScore(after) - this._roughScore(dice);
        if (gain <= 0) continue;
        // Un salto de 1 punto en la cara es menos visible que de 6 a 1.
        const visibility = Math.abs(v - dice[i]);
        candidates.push({
          index: i,
          from: dice[i],
          to: v,
          gain,
          visibility,
          magnitude: gain >= 200 ? 'big' : 'small',
        });
      }
    }
    if (candidates.length === 0) return null;

    const pool = early
      ? candidates.filter((c) => c.magnitude === 'small')
      : candidates.filter((c) => c.magnitude === 'big');
    const use = pool.length ? pool : candidates;

    // Entre los del pool elegido, el que más gana; a igualdad, el menos visible.
    use.sort((a, b) => b.gain - a.gain || a.visibility - b.visibility);
    const pick = use[0];
    return { index: pick.index, from: pick.from, to: pick.to, magnitude: pick.magnitude };
  }

  /** Puntuación aproximada del tiro completo (solo para comparar opciones). */
  _roughScore(dice) {
    const keeps = validKeeps(dice);
    if (!keeps.length) return 0;
    return Math.max(...keeps.map((k) => k.score));
  }

  /** Cuánto dura el destello de la trampa. Más borracho = más difícil de ver. */
  cheatFlashMs(drunkenness) {
    const sober = this.config.cheat_flash_ms_sober ?? 520;
    const drunk = this.config.cheat_flash_ms_drunk ?? 170;
    return Math.round(sober + (drunk - sober) * drunkenness);
  }

  notifyCaught() { this.caughtStreak++; }
  notifyMissed() { this.caughtStreak = Math.max(0, this.caughtStreak - 1); }
}
return { "DakuAI": DakuAI, "hasScoring": hasScoring };
})();

// --------------------------------------------------------------------
// src/scenes/FarkleScene.js
__M["src/scenes/FarkleScene.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var paintBackdrop = __M["src/systems/Ui.js"].paintBackdrop;
var makeButton = __M["src/systems/Ui.js"].makeButton;
var panel = __M["src/systems/Ui.js"].panel;
var PortraitView = __M["src/systems/Portraits.js"].PortraitView;
var DialogueSystem = __M["src/systems/DialogueSystem.js"].DialogueSystem;
var Die = __M["src/systems/Dice.js"].Die;
var EMPSystem = __M["src/systems/EMPSystem.js"].EMPSystem;
var DrinkSystem = __M["src/systems/DrinkSystem.js"].DrinkSystem;
var ClothingManager = __M["src/systems/ClothingManager.js"].ClothingManager;
var DakuAI = __M["src/systems/DakuAI.js"].DakuAI;
var GameState = __M["src/systems/GameState.js"].GameState;
var playMusic = __M["src/systems/Music.js"].playMusic;
var dadoElegido = __M["src/systems/Sfx.js"].dadoElegido;
var dadosLanzados = __M["src/systems/Sfx.js"].dadosLanzados;
var rollDice = __M["src/systems/FarkleLogic.js"].rollDice;
var hasScoring = __M["src/systems/FarkleLogic.js"].hasScoring;
var scoreSelection = __M["src/systems/FarkleLogic.js"].scoreSelection;
var describeSelection = __M["src/systems/FarkleLogic.js"].describeSelection;
// FarkleScene.js — Acto 3. El mini juego completo: dados, trampas, EMP, alcohol y ropa.
//
// Flujo de una ronda:
//   taunt del jugador → respuesta de Daku → (¿doble o nada?) → turnos alternados
//   → alguien llega a la meta → el otro tiene un último turno → se compara → strip.
//
// La trampa de Daku ocurre MIENTRAS el jugador lee el taunt o pide un trago.
// El juego nunca avisa que hubo trampa: el botón de acusar aparece siempre.


const PLAY_Y = 205;
const KEPT_Y = 292;
const DIE_SIZE = 54;
const MAX_TURNS_PER_ROUND = 16;   // red de seguridad contra rondas infinitas

const TONES = [
  { key: 'provoke', label: '🗡️ Provocar', daku: 'vs_provoke' },
  { key: 'flirt',   label: '😏 Coquetear', daku: 'vs_flirt' },
  { key: 'stoic',   label: '😐 Estoico',   daku: 'vs_stoic' },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class FarkleScene extends Phaser.Scene {
  constructor() { super('Farkle'); }

  create() {
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.d = GameState.dialogues;
    this.cfg = GameState.config;
    this.ai = new DakuAI(this.cfg);
    playMusic(this, 'music_farkle');

    this.target = this.cfg.round_target;
    this.busy = false;
    this.lastRestoredRound = 1;

    this.buildUi();
    this.startGame();
  }

  // ==================================================================
  // Construcción de la pantalla
  // ==================================================================

  buildUi() {
    const { width } = this.scale;

    const tableBg = this.textures.exists('bg_farkle') ? 'bg_farkle' : 'bg_room';
    if (this.textures.exists(tableBg)) {
      const img = this.add.image(width / 2, 300, tableBg);
      const src = this.textures.get(tableBg).getSourceImage();
      img.setScale(Math.max(width / src.width, 600 / src.height));
      this.add.rectangle(0, 0, width, 600, 0x000000, 0.42).setOrigin(0);
    } else {
      paintBackdrop(this, C.roomWarm, C.roomDark);
    }

    // ---- cabecera ----
    panel(this, 12, 8, width - 24, 56, { alpha: 0.6, radius: 3 });

    this.reinScoreText = this.add.text(24, 14, '', {
      fontFamily: F.title, fontSize: '17px', color: C.reinName,
    }).setDepth(60);
    this.dakuScoreText = this.add.text(width - 24, 14, '', {
      fontFamily: F.title, fontSize: '17px', color: C.dakuName,
    }).setOrigin(1, 0).setDepth(60);
    this.roundText = this.add.text(width / 2, 14, '', {
      fontFamily: F.body, fontSize: '13px', color: C.textDim, letterSpacing: 1,
    }).setOrigin(0.5, 0).setDepth(60);
    // Cartel grande de turno. Va en el centro de la mesa, encima de los dados:
    // es lo primero que hay que saber al mirar la pantalla.
    this.turnBanner = this.add.text(width / 2, 120, '', {
      fontFamily: F.title, fontSize: '27px', color: '#f4f7fa',
    }).setOrigin(0.5).setDepth(80).setAlpha(0);

    this.turnPointsText = this.add.text(width / 2, 40, '', {
      fontFamily: F.body, fontSize: '13px', color: C.lamp,
    }).setOrigin(0.5, 0).setDepth(60);

    this.emp = new EMPSystem(this, 24, 38);
    this.drinks = new DrinkSystem(this, 235, 38);

    // ---- portraits + ropa ----
    this.portraits = {
      rein: new PortraitView(this, { x: 100, y: 245, width: 152, height: 216, who: 'rein' }),
      daku: new PortraitView(this, { x: 700, y: 245, width: 152, height: 216, who: 'daku' }),
    };
    this.portraits.rein.setExpression('neutral').setActive(false);
    this.portraits.daku.setExpression('smile').setActive(false);

    this.clothing = {
      rein: new ClothingManager(this, { who: 'rein', x: 100, y: 358, portrait: this.portraits.rein }),
      daku: new ClothingManager(this, { who: 'daku', x: 700, y: 358, portrait: this.portraits.daku }),
    };

    // ---- dados ----
    this.dice = [];
    for (let i = 0; i < this.cfg.dice_count; i++) {
      const die = new Die(this, 0, PLAY_Y, DIE_SIZE, (d) => this.onDieClick(d));
      die.setDepth(50).setVisible(false);
      this.dice.push(die);
    }
    this.active = [];    // índices en juego este tiro
    this.kept = [];      // índices apartados este turno
    this.selected = new Set();

    this.tableText = this.add.text(width / 2, 336, '', {
      fontFamily: F.body, fontSize: '14px', color: C.textDim, align: 'center',
    }).setOrigin(0.5, 0).setDepth(60).setInteractive({ useHandCursor: true });
    this.tableText.on('pointerdown', () => this.clearSelection());
    this.input.keyboard.on('keydown-ESC', () => this.clearSelection());

    // ---- botones de acción ----
    this.buttons = {
      a: makeButton(this, 400 - 152, 384, 142, 34, '', () => {}, { fontSize: 13 }),
      b: makeButton(this, 400, 384, 142, 34, '', () => {}, { fontSize: 13 }),
      c: makeButton(this, 400 + 152, 384, 142, 34, '', () => {}, { fontSize: 13 }),
    };
    Object.values(this.buttons).forEach((b) => b.setDepth(70).setVisible(false));

    // Consultar las reglas sin perder la partida. Siempre visible: las reglas
    // del Farkle no se retienen a la primera y no queremos que haya que
    // abandonar la ronda para mirarlas.
    makeButton(this, 752, 82, 78, 24, '? Reglas', () => this.abrirReglas(), { fontSize: 12 })
      .setDepth(70);

    // ---- diálogo ----
    this.dialogue = new DialogueSystem(this, {
      y: 418, h: 166,
      onSpeaker: (speaker, expression) => this.showSpeaker(speaker, expression),
    });

    this.refreshHud();
  }

  showSpeaker(speaker, expression) {
    for (const who of ['rein', 'daku']) {
      const p = this.portraits[who];
      p.setActive(who === speaker);
      if (who === speaker && expression) p.setExpression(expression);
    }
  }

  /**
   * Abre las reglas encima de la partida, sin reiniciarla.
   *
   * Pausar la escena en vez de cambiarla es lo que conserva los puntos de la
   * ronda, los dados en la mesa y de quién es el turno. El cuadro de diálogo
   * se esconde a mano porque es una capa HTML sobre el canvas: si no, se vería
   * por encima del tutorial.
   */
  abrirReglas() {
    // Sin condiciones: antes había un `if (this.busy) return` y el botón moría
    // en silencio durante cualquier animación, que es justo cuando uno se
    // queda mirando la pantalla y quiere consultar las reglas.
    this.dialogue.setVisible(false);
    this.events.once('resume', () => this.dialogue.setVisible(true));
    this.scene.pause();
    this.scene.launch('Tutorial', { volverA: 'Farkle' });
  }

  refreshHud() {
    const s = GameState;
    this.reinScoreText.setText(`REINHART   ${this.reinRound ?? 0}`);
    this.dakuScoreText.setText(`${this.dakuRound ?? 0}   DAKU`);
    const don = this.don ? '  ·  DOBLE O NADA' : '';
    // Sin contador de rondas: lo que importa es la ropa, y eso ya se ve en
    // los medidores debajo de cada retrato.
    this.roundText.setText(`META ${this.target}${don}`);
    this.emp.refresh();
    this.drinks.refresh();
    this.clothing.rein.refresh();
    this.clothing.daku.refresh();
  }

  setButtons(defs) {
    const keys = ['a', 'b', 'c'];
    keys.forEach((k, i) => {
      const btn = this.buttons[k];
      const def = defs[i];
      if (!def) { btn.setVisible(false); return; }
      btn.setVisible(true).setLabel(def.label).setEnabled(def.enabled !== false);
      btn.setAction(def.onClick);
    });
  }

  hideButtons() {
    Object.values(this.buttons).forEach((b) => b.setVisible(false));
  }

  // ==================================================================
  // Ciclo de la partida
  // ==================================================================

  startGame() {
    this.dialogue.play(this.d.act3.start, () => this.startRound());
  }

  startRound() {
    if (GameState.round > 1 && this.lastRestoredRound !== GameState.round) {
      GameState.restoreResources(1, 1);
      this.lastRestoredRound = GameState.round;
    }
    this.reinRound = 0;
    this.dakuRound = 0;
    this.lastChance = null;
    this.turnsThisRound = 0;
    this.don = false;
    this.reinSkipsTurn = this.reinSkipsTurn || false;
    this.refreshHud();
    this.clearDice();

    // Son exactamente tres rondas y cada una disputa una sola prenda.
    if (GameState.round === 1) this.beginTurn('rein');
    else this.tauntPhase(() => this.beginTurn('rein'));
  }

  /** El jugador elige el tono; Daku responde. Es también un momento de distracción. */
  tauntPhase(next) {
    const level = GameState.sceneLevel();
    this.dialogue.choices(
      TONES.map((t) => ({ label: t.label })),
      (idx) => {
        const tone = TONES[idx];
        GameState.lastTone = tone.key;
        const reinLine = pick(this.d.act3.rein_taunts[tone.key][level]);
        const dakuLine = pick(this.d.act3.daku_taunts[tone.daku][level]);
        const stoic = tone.key === 'stoic';
        this.dialogue.say(
          { speaker: stoic && reinLine.startsWith('(') ? 'stage' : 'rein',
            expression: stoic ? 'neutral' : tone.key === 'flirt' ? 'flirty' : 'smug',
            text: stoic && reinLine.startsWith('(') ? reinLine.slice(1, -1) : reinLine },
          () => {
            this.dialogue.say(
              { speaker: 'daku', expression: 'flirty', text: dakuLine },
              next
            );
          }
        );
      },
      { prompt: 'Tu turno de hablar.' }
    );
  }

  /** Daku propone doble o nada cuando va perdiendo. */
  offerDoubleOrNothing(next) {
    const th = this.cfg.double_or_nothing_threshold ?? 3;
    const losing = GameState.dakuLost >= th && GameState.dakuLost > GameState.reinLost;
    if (GameState.donOffered || !losing) { next(); return; }
    GameState.donOffered = true;

    const don = this.d.act3.double_or_nothing;
    this.dialogue.say(don.propose, () => {
      this.dialogue.choices(don.options.map((o) => ({ label: o.label })), (idx) => {
        const opt = don.options[idx];
        this.don = !!opt.accept;
        this.refreshHud();
        this.dialogue.say(
          { speaker: 'daku', expression: opt.expression, text: opt.reply },
          next
        );
      });
    });
  }

  /**
   * Anuncia de quién es el turno con un cartel que entra y se va solo.
   * Antes había que deducirlo del texto chico de la acotación.
   */
  anunciarTurno(who) {
    const nombre = who === 'rein' ? 'Turno de Rein' : 'Turno de Daku';
    this.turnBanner.setText(nombre)
      .setColor(who === 'rein' ? C.reinName : C.dakuName)
      .setAlpha(0)
      .setScale(0.92);
    this.tweens.killTweensOf(this.turnBanner);
    this.tweens.add({
      targets: this.turnBanner,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.92, to: 1 },
      duration: 260,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 850,
    });
  }

  beginTurn(who) {
    this.turn = who;
    this.turnPoints = 0;
    this.clearDice();
    this.turnsThisRound++;

    if (this.turnsThisRound > MAX_TURNS_PER_ROUND) { this.endRound(); return; }

    this.anunciarTurno(who);

    if (who === 'rein' && this.reinSkipsTurn) {
      this.reinSkipsTurn = false;
      this.dialogue.note('stage', 'Rein pierde el turno.');
      this.time.delayedCall(1100, () => this.endTurn('rein'));
      return;
    }

    this.refreshHud();
    if (who === 'rein') this.playerRoll();
    else this.dakuStep();
  }

  endTurn(who) {
    this.hideButtons();
    this.selected.clear();

    if (this.lastChance === who) { this.endRound(); return; }

    const score = who === 'rein' ? this.reinRound : this.dakuRound;
    const other = who === 'rein' ? 'daku' : 'rein';
    if (score >= this.target && this.lastChance === null) {
      this.lastChance = other;
      this.dialogue.note('stage',
        `${who === 'rein' ? 'Rein' : 'Daku'} llegó a la meta. ` +
        `${other === 'rein' ? 'Rein tiene' : 'Daku tiene'} un último turno.`);
      this.time.delayedCall(1400, () => this.beginTurn(other));
      return;
    }
    this.beginTurn(other);
  }

  // ==================================================================
  // Dados
  // ==================================================================

  clearDice() {
    this.active = [];
    this.kept = [];
    this.selected.clear();
    this.dice.forEach((d) => { d.setVisible(false).setKept(false).setSelected(false); d.container.setScale(1); });
    this.tableText.setText('');
  }

  layoutDice() {
    const drunk = this.turn === 'rein' ? GameState.drunkenness : GameState.drunkenness * 0.6;

    const spread = (indices, y, scale) => {
      const gap = DIE_SIZE * scale + 10;
      const total = indices.length * gap - 10;
      indices.forEach((i, n) => {
        const d = this.dice[i];
        d.setVisible(true);
        d.container.setScale(scale);
        d.setPosition(this.scale.width / 2 - total / 2 + gap * n + (DIE_SIZE * scale) / 2, y);
        d.setDrunk(drunk);
      });
    };
    spread(this.active, PLAY_Y, 1);
    spread(this.kept, KEPT_Y, 0.72);
  }

  /** Devuelve los índices que participarían en el próximo tiro. */
  availableCount() {
    return this.cfg.dice_count - this.kept.length;
  }

  rollFor(who, onDone) {
    // Dados calientes: si apartó los 6, vuelve a tirar los 6.
    if (this.kept.length >= this.cfg.dice_count) {
      this.kept = [];
      this.dice.forEach((d) => d.setKept(false));
    }
    const keptSet = new Set(this.kept);
    this.active = this.dice.map((_, i) => i).filter((i) => !keptSet.has(i));
    this.selected.clear();

    const values = rollDice(this.active.length);
    this.layoutDice();
    dadosLanzados(this.active.length);

    let pending = this.active.length;
    this.active.forEach((idx, n) => {
      this.dice[idx].rollTo(values[n], 430 + n * 25, () => {
        pending--;
        if (pending === 0) onDone(values);
      });
    });
  }

  currentValues() { return this.active.map((i) => this.dice[i].value); }
  selectedValues() { return [...this.selected].map((i) => this.dice[i].value); }

  clearSelection() {
    if (this.busy || this.turn !== 'rein' || !this.selectable || this.selected.size === 0) return;
    this.selected.forEach((i) => this.dice[i].setSelected(false));
    this.selected.clear();
    this.updateSelectionUi();
  }

  onDieClick(die) {
    if (this.busy || this.turn !== 'rein' || !this.selectable) return;
    const idx = this.dice.indexOf(die);
    if (!this.active.includes(idx)) return;
    if (this.selected.has(idx)) this.selected.delete(idx);
    else this.selected.add(idx);
    die.setSelected(this.selected.has(idx));
    dadoElegido();
    this.updateSelectionUi();
  }

  updateSelectionUi() {
    const vals = this.selectedValues();
    const r = scoreSelection(vals);
    if (vals.length === 0) {
      this.tableText.setText('Elige los dados que quieres apartar.');
    } else if (!r.valid) {
      this.tableText.setText(`Dados elegidos: ${vals.join(', ')} · Esa selección no puntúa · Clic aquí o Esc para limpiar`);
    } else {
      this.tableText.setText(`${describeSelection(vals)}  →  +${r.score} · Clic aquí o Esc para limpiar`);
    }

    const ok = r.valid;
    this.selected.forEach((i) => this.dice[i].setSelectionValid(ok));
    this.buttons.a.setEnabled(ok);
    this.buttons.b.setEnabled(ok);
  }

  // ==================================================================
  // Turno de Rein
  // ==================================================================

  playerRoll() {
    this.busy = true;
    this.selectable = false;
    this.hideButtons();
    this.dialogue.note('stage', `Turno de Rein — ${this.turnPoints} en la mesa.`);
    this.portraits.rein.setExpression('dice');

    this.rollFor('rein', (values) => {
      this.busy = false;
      if (!hasScoring(values)) { this.playerFarkle(); return; }
      this.selectable = true;
      this.updateSelectionUi();
      this.setButtons([
        { label: 'Apartar y tirar', enabled: false, onClick: () => this.playerKeep(true) },
        { label: 'Apartar y plantarse', enabled: false, onClick: () => this.playerKeep(false) },
        { label: '🥃 Beber', enabled: GameState.sobriety > 0, onClick: () => this.playerDrink('turn') },
      ]);
    });
  }

  playerKeep(rollAgain) {
    if (this.busy) return;
    const vals = this.selectedValues();
    const r = scoreSelection(vals);
    if (!r.valid) return;
    this.busy = true;

    this.turnPoints += r.score;
    this.selected.forEach((i) => { this.kept.push(i); this.dice[i].setKept(true); });
    this.active = this.active.filter((i) => !this.selected.has(i));
    this.selected.clear();
    this.selectable = false;
    this.hideButtons();
    this.layoutDice();
    this.turnPointsText.setText(`en la mesa: ${this.turnPoints}`);

    const seguir = () => {
      if (rollAgain) this.time.delayedCall(320, () => this.playerRoll());
      else this.playerBank();
    };
    if (!this.reaccionJugada('rein', r.score, seguir)) seguir();
  }

  /**
   * Reacción a una jugada grande: quien puntúa lo celebra y el otro contesta.
   *
   * Mira lo que vale UN apartado, no el total del turno: lo que impresiona es
   * sacar la escalera de una, no ir sumando de a cincuenta.
   *
   * Mientras no haya líneas escritas para esto no pasa nada — devuelve false y
   * el turno sigue su curso normal. Así el mecanismo puede existir antes que
   * el texto sin dejar el juego a medias.
   *
   * @returns {boolean} true si se puso a hablar (y llamará a `next` al acabar)
   */
  reaccionJugada(quien, puntos, next) {
    if (puntos <= (this.cfg.big_score_threshold ?? 1000)) return false;

    const pool = this.d.act3.big_score && this.d.act3.big_score[quien];
    if (!pool) return false;

    const otro = quien === 'rein' ? 'daku' : 'rein';
    const lines = [];
    if (pool[quien] && pool[quien].length) {
      lines.push({ speaker: quien, expression: 'smug', text: pick(pool[quien]) });
    }
    if (pool[otro] && pool[otro].length) {
      lines.push({ speaker: otro, expression: 'surprised', text: pick(pool[otro]) });
    }
    if (!lines.length) return false;

    this.dialogue.play(lines, next);
    return true;
  }

  playerBank() {
    this.reinRound += this.turnPoints;
    this.turnPointsText.setText('');
    this.refreshHud();
    this.dialogue.note('stage', `Rein se planta con ${this.turnPoints}. Total de ronda: ${this.reinRound}.`);
    this.time.delayedCall(1300, () => this.endTurn('rein'));
  }

  playerFarkle() {
    this.turnPoints = 0;
    this.turnPointsText.setText('');
    this.tableText.setText('');
    this.active.forEach((i) => this.dice[i].setDead(true));
    this.dialogue.note('stage', 'Farkle. Ningún dado puntúa. Rein pierde lo del turno.');
    this.cameras.main.shake(220, 0.004);
    this.time.delayedCall(1600, () => this.endTurn('rein'));
  }

  playerDrink(context, resume) {
    this.hideButtons();
    this.selectable = false;
    GameState.drink();
    this.refreshHud();
    this.emp.pulse();
    this.drinks.applyCameraWobble();

    if (GameState.sobriety <= 0) {
      this.busy = true;
      this.dialogue.note('stage', 'El mundo se inclina. Rein ya no puede distinguir los dados.');
      this.time.delayedCall(1500, () => {
        GameState.ending = 'drunk_game_over';
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ending'));
      });
      return;
    }

    this.drinks.playDrinkAnimation(() => {
      // Beber es un hueco de atención: si hay dados de Daku en la mesa,
      // aprovecha para tocar uno.
      if (context === 'accuse' && !this.pendingCheat && this.ai.wantsToCheat(GameState)) {
        this.tryCheat();
      }
      this.afterDrinkDialogue(() => {
        this.dice.forEach((d) => d.setDrunk(
          this.turn === 'rein' ? GameState.drunkenness : GameState.drunkenness * 0.6));
        if (resume) resume();
        else {
          this.selectable = true;
          this.updateSelectionUi();
          this.setButtons([
            { label: 'Apartar y tirar', enabled: false, onClick: () => this.playerKeep(true) },
            { label: 'Apartar y plantarse', enabled: false, onClick: () => this.playerKeep(false) },
            { label: '🥃 Beber', enabled: GameState.sobriety > 0, onClick: () => this.playerDrink('turn') },
          ]);
          this.updateSelectionUi();
        }
      });
    });
  }

  afterDrinkDialogue(next) {
    const drink = this.d.act3.drink;
    if (GameState.sobriety <= 0.4 && !this._saidVeryDrunk) {
      this._saidVeryDrunk = true;
      this.dialogue.play(drink.very_drunk, next);
    } else if (GameState.drinks === 3 && !this._saidSeveral) {
      this._saidSeveral = true;
      this.dialogue.play(drink.several, next);
    } else {
      this.dialogue.say(drink.prompt, () => {
        this.dialogue.choices(drink.options.map((o) => ({ label: o.label })), (idx) => {
          const opt = drink.options[idx];
          this.dialogue.say({ speaker: 'daku', expression: opt.expression, text: opt.reply }, next);
        });
      });
    }
  }

  // ==================================================================
  // Turno de Daku
  // ==================================================================

  dakuStep() {
    this.busy = true;
    this.selectable = false;
    this.hideButtons();
    this.pendingCheat = null;
    this.dialogue.note('stage', `Turno de Daku — ${this.turnPoints} en la mesa.`);
    this.portraits.daku.setExpression('dice');

    this.time.delayedCall(500, () => {
      this.rollFor('daku', (values) => {
        this.busy = false;
        if (!hasScoring(values)) { this.dakuFarkle(); return; }
        this.dakuTaunt(values);
      });
    });
  }

  /**
   * Daku suelta un taunt. El jugador mira abajo a leerlo — y ahí cambia el dado.
   * Después aparecen SIEMPRE los botones de acusar, haya trampa o no.
   */
  dakuTaunt(values) {
    const level = GameState.sceneLevel();
    const toneKey = GameState.lastTone
      ? TONES.find((t) => t.key === GameState.lastTone).daku
      : 'vs_provoke';
    const line = pick(this.d.act3.daku_taunts[toneKey][level]);

    const willCheat = this.ai.wantsToCheat(GameState);
    if (willCheat) this.time.delayedCall(900, () => this.tryCheat());

    this.dialogue.say({ speaker: 'daku', expression: 'flirty', text: line }, () => {
      this.showAccuseWindow();
    });
  }

  tryCheat() {
    const values = this.currentValues();
    const plan = this.ai.planCheat(values, GameState.round);
    if (!plan) return;
    const dieIndex = this.active[plan.index];
    GameState.cheatsTotal++;
    this.pendingCheat = { dieIndex, ...plan };
    this.dice[dieIndex].cheatTo(plan.to, this.ai.cheatFlashMs(GameState.drunkenness));
  }

  showAccuseWindow() {
    const canAccuse = GameState.emp > 0;
    this.setButtons([
      {
        label: `⚡ Acusar trampa (${GameState.emp})`,
        enabled: canAccuse,
        onClick: () => this.accuse(),
      },
      {
        label: '🥃 Beber',
        enabled: GameState.sobriety > 0,
        onClick: () => this.playerDrink('accuse', () => this.showAccuseWindow()),
      },
      { label: 'Continuar', onClick: () => this.dakuDecide() },
    ]);
  }

  accuse() {
    this.hideButtons();
    if (!GameState.spendEmp()) return;
    GameState.accusationsMade++;
    this.emp.pulse();
    this.refreshHud();

    if (this.pendingCheat) {
      // Acierto: Daku pierde el turno.
      GameState.cheatsCaught++;
      GameState.restoreResources(1, 2);
      this.ai.notifyCaught();
      this.pendingCheat = null;
      this.emp.pulse();
      this.refreshHud();
      this.dialogue.play(pick(this.d.act3.cheat_caught), () => {
        this.turnPoints = 0;
        this.turnPointsText.setText('');
        this.endTurn('daku');
      });
    } else {
      // Fallo: Rein pierde el turno siguiente.
      GameState.falseAccusations++;
      this.ai.notifyMissed();
      this.reinSkipsTurn = true;
      this.dialogue.play(pick(this.d.act3.cheat_false), () => this.dakuDecide());
    }
  }

  dakuDecide() {
    this.hideButtons();
    const values = this.currentValues();
    const keep = this.ai.chooseKeep(values, this.turnPoints);
    if (!keep) { this.dakuFarkle(); return; }

    // Aparta lo elegido.
    const keptDice = keep.indices.map((i) => this.active[i]);
    keptDice.forEach((i) => { this.kept.push(i); this.dice[i].setKept(true); });
    this.active = this.active.filter((i) => !keptDice.includes(i));
    this.turnPoints += keep.score;
    this.turnPointsText.setText(`en la mesa: ${this.turnPoints}`);
    this.tableText.setText(
      `Daku aparta ${describeSelection(keptDice.map((i) => this.dice[i].value))}  →  +${keep.score}`);
    this.layoutDice();

    const remaining = this.availableCount();
    const cont = this.ai.shouldContinue({
      turnPoints: this.turnPoints,
      remaining,
      myRound: this.dakuRound,
      oppRound: this.reinRound,
      target: this.target,
      mustBeat: this.lastChance === 'daku' ? this.reinRound : null,
    });

    const seguir = () => this.time.delayedCall(1000, () => {
      if (cont) this.dakuStep();
      else this.dakuBank();
    });
    if (!this.reaccionJugada('daku', keep.score, seguir)) seguir();
  }

  dakuBank() {
    this.dakuRound += this.turnPoints;
    this.turnPointsText.setText('');
    this.refreshHud();
    this.dialogue.note('stage', `Daku se planta con ${this.turnPoints}. Total de ronda: ${this.dakuRound}.`);
    this.time.delayedCall(1300, () => this.endTurn('daku'));
  }

  dakuFarkle() {
    this.turnPoints = 0;
    this.turnPointsText.setText('');
    this.active.forEach((i) => this.dice[i].setDead(true));
    this.dialogue.note('stage', 'Farkle. Daku pierde lo del turno.');
    this.time.delayedCall(1600, () => this.endTurn('daku'));
  }

  // ==================================================================
  // Fin de ronda y de partida
  // ==================================================================

  endRound() {
    this.hideButtons();
    this.clearDice();
    this.refreshHud();

    if (this.reinRound === this.dakuRound) {
      this.dialogue.note('stage',
        `Empate a ${this.reinRound}. La misma prenda sigue en juego: desempate.`);
      this.time.delayedCall(1800, () => this.startRound());
      return;
    }

    const loser = this.reinRound < this.dakuRound ? 'rein' : 'daku';
    if (loser === 'rein') GameState.dakuRoundsWon++;
    else GameState.reinRoundsWon++;
    const lost = GameState.loseGarments(loser, 1);
    const pool = loser === 'rein' ? this.d.act3.rein_loses_garment : this.d.act3.daku_loses_garment;

    this.dialogue.note('stage',
      `${this.reinRound} — ${this.dakuRound}. ` +
      `${loser === 'rein' ? 'Rein' : 'Daku'} pierde ${lost.length > 1 ? 'dos prendas' : 'una prenda'}.`);

    this.clothing[loser].playStrip(() => {
      this.refreshHud();
      const lines = lost
        .map((g) => pick(pool[g] || ['...']))
        .map((t) => ({ speaker: 'daku', expression: 'flirty', text: t }));

      this.time.delayedCall(700, () => {
        this.dialogue.play(lines, () => this.checkGameOver());
      });
    });
  }

  checkGameOver() {
    if (GameState.round >= 3) {
      const loser = GameState.reinRoundsWon > GameState.dakuRoundsWon ? 'daku' : 'rein';
      this.finish(loser);
      return;
    }

    GameState.round++;
    this.don = false;
    this.refreshHud();
    this.startRound();
  }

  /** @param {'rein'|'daku'|'tie'} loser quién se quedó sin nada */
  finish(loser) {
    GameState.resolveEnding(loser);
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ending'));
  }
}
return { "FarkleScene": FarkleScene };
})();

// --------------------------------------------------------------------
// src/scenes/EndingScene.js
__M["src/scenes/EndingScene.js"] = (function () {
var C = __M["src/theme.js"].C;
var F = __M["src/theme.js"].F;
var VNScene = __M["src/scenes/VNScene.js"].VNScene;
var makeButton = __M["src/systems/Ui.js"].makeButton;
var GameState = __M["src/systems/GameState.js"].GameState;
var playMusic = __M["src/systems/Music.js"].playMusic;
// EndingScene.js — Acto 4. Reproduce el ending que resolvió GameState,
// después los créditos, y ofrece volver a jugar.


const TITLES = {
  rein_wins:   'Rein gana',
  daku_wins:   'Daku gana',
  drunk_game_over: 'Demasiado alcohol',
};

const DRUNK_GAME_OVER = [
  { speaker: 'stage', text: 'La habitación gira. Los dados se duplican, luego desaparecen.' },
  { speaker: 'daku', expression: 'surprised', text: 'Eh. Sargento. Mírame. Se acabó el juego.' },
  { speaker: 'stage', text: 'Rein intenta responder, pero el cuerpo deja de obedecerle. Daku aparta la botella y da por terminada la partida.' },
  { speaker: 'stage', text: 'GAME OVER — Bebiste hasta perder toda la sobriedad.' },
];

class EndingScene extends VNScene {
  constructor() { super('Ending', { bgKey: 'bg_room', top: C.roomWarm, bottom: 0x120a0c }); }

  create() {
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.buildStage();

    const key = GameState.ending || 'daku_wins';
    playMusic(this, key === 'drunk_game_over' ? 'music_gameover' : 'music_endings');
    const lines = key === 'drunk_game_over' ? DRUNK_GAME_OVER : GameState.dialogues.act4[key];

    this.dialogue.play(lines, () => {
      this.dialogue.play(GameState.dialogues.credits, () => this.showSummary(key));
    });
  }

  showSummary(key) {
    const { width, height } = this.scale;
    this.dialogue.setVisible(false);
    Object.values(this.portraits).forEach((p) => p.setVisible(false));

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.72)
      .setOrigin(0).setDepth(300);

    this.add.text(width / 2, 120, TITLES[key] || key, {
      fontFamily: F.title, fontSize: '38px', color: '#e0b878', align: 'center',
    }).setOrigin(0.5).setDepth(301);

    const s = GameState;
    const stats = [
      `Rondas jugadas: ${s.round}`,
      `Trampas de Daku: ${s.cheatsTotal}   ·   acusadas bien: ${s.cheatsCaught}`,
      `Acusaciones falsas: ${s.falseAccusations}`,
      `Tragos: ${s.drinks}   ·   sobriedad final: ${Math.round(s.sobriety * 100)}%`,
      `Rondas ganadas — Rein: ${s.reinRoundsWon}   ·   Daku: ${s.dakuRoundsWon}`,
      `Ropa — Rein: ${s.remaining('rein')}/3   ·   Daku: ${s.remaining('daku')}/3`,
    ].join('\n');

    this.add.text(width / 2, 210, stats, {
      fontFamily: F.body, fontSize: '15px', color: C.textDim,
      align: 'center', lineSpacing: 9,
    }).setOrigin(0.5, 0).setDepth(301);

    makeButton(this, width / 2, 430, 220, 42, 'Otra vez', () => {
      GameState.reset(GameState.config);
      this.scene.start('Title');
    }, { fontSize: 16 }).setDepth(301);
  }
}
return { "EndingScene": EndingScene };
})();

// --------------------------------------------------------------------
// src/main.js
__M["src/main.js"] = (function () {
var BootScene = __M["src/scenes/BootScene.js"].BootScene;
var TitleScene = __M["src/scenes/TitleScene.js"].TitleScene;
var Act1Scene = __M["src/scenes/Act1Scene.js"].Act1Scene;
var Act2Scene = __M["src/scenes/Act2Scene.js"].Act2Scene;
var TutorialScene = __M["src/scenes/TutorialScene.js"].TutorialScene;
var FarkleScene = __M["src/scenes/FarkleScene.js"].FarkleScene;
var EndingScene = __M["src/scenes/EndingScene.js"].EndingScene;
// main.js — configuración de Phaser y arranque.


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
  scene: [BootScene, TitleScene, Act1Scene, Act2Scene, TutorialScene, FarkleScene, EndingScene],

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
return {  };
})();

})();
