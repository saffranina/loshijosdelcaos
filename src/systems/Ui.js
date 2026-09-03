// Ui.js — botones y paneles reutilizables. Placeholder pintado por código;
// cuando lleguen los assets de UI se reemplaza el Graphics por una imagen.

import { C, F } from '../theme.js';

/**
 * Botón rectangular con hover y estado deshabilitado.
 * Devuelve un Container con .setEnabled(bool) y .setLabel(text).
 */
export function makeButton(scene, x, y, w, h, label, onClick, opts = {}) {
  const fill = opts.fill ?? 0x172534;
  const stroke = opts.stroke ?? C.boxStroke;
  const fontSize = opts.fontSize ?? 15;

  const box = scene.add.graphics();
  const text = scene.add.text(0, 0, label, {
    fontFamily: F.body,
    fontSize: `${fontSize}px`,
    color: C.textMain,
    align: 'center',
    wordWrap: { width: w - 16 },
  }).setOrigin(0.5);

  const container = scene.add.container(x, y, [box, text]);
  container.setSize(w, h);

  let enabled = true;
  let hover = false;
  let action = onClick;

  const redraw = () => {
    box.clear();
    const a = enabled ? 1 : 0.35;
    box.fillStyle(hover && enabled ? 0x2b4054 : fill, 0.96 * a);
    box.lineStyle(1, stroke, (hover && enabled ? 1 : 0.6) * a);
    box.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    box.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
    text.setAlpha(enabled ? 1 : 0.4);
    text.setColor(hover && enabled ? '#ffe9cf' : C.textMain);
  };
  redraw();

  // El arte del botón está centrado en el Container; definimos el hitbox con
  // las mismas coordenadas para que hover y clic no queden corridos.
  container.setInteractive(
    new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
    Phaser.Geom.Rectangle.Contains,
    true,
  );
  container.input.cursor = 'pointer';
  container.on('pointerover', () => { hover = true; redraw(); });
  container.on('pointerout', () => { hover = false; redraw(); });
  container.on('pointerdown', (_pointer, _x, _y, event) => {
    if (event?.stopPropagation) event.stopPropagation();
    if (enabled && action) action();
  });

  container.setEnabled = (v) => { enabled = v; redraw(); return container; };
  container.setLabel = (t) => { text.setText(t); return container; };
  container.setAction = (fn) => { action = fn; return container; };
  container.isEnabled = () => enabled;
  return container;
}

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
