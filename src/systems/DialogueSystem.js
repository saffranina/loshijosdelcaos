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

import { C, F, SPEAKERS } from '../theme.js';
import { tecla } from './Sfx.js';

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

export class DialogueSystem {
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
