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

import { C, F } from '../theme.js';

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
export function makeButton(scene, x, y, w, h, label, onClick, opts = {}) {
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
