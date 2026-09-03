// Ui.js — botones y paneles reutilizables. Placeholder pintado por código;
// cuando lleguen los assets de UI se reemplaza el Graphics por una imagen.

import { C } from '../theme.js';

// Los botones ahora se dibujan con HTML encima del canvas (DomUi.js): el área
// de click en el canvas no coincidía con el rectángulo pintado y los botones
// respondían corridos, solo cerca del texto. Se reexporta con el mismo nombre
// para que ninguna escena tenga que cambiar.
export { makeButton } from './DomUi.js';

/** Panel de fondo con borde, para cuadros de diálogo y paneles de recursos. */
export function panel(scene, x, y, w, h, opts = {}) {
  const g = scene.add.graphics();
  g.fillStyle(opts.fill ?? C.boxFill, opts.alpha ?? 0.88);
  g.lineStyle(opts.lineWidth ?? 1, opts.stroke ?? C.boxStroke, opts.strokeAlpha ?? 0.7);
  g.fillRoundedRect(x, y, w, h, opts.radius ?? 5);
  g.strokeRoundedRect(x, y, w, h, opts.radius ?? 5);
  return g;
}

/** Fondo de escena provisional: degradado vertical de dos tonos + viñeta. */
export function paintBackdrop(scene, topColor, bottomColor) {
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
