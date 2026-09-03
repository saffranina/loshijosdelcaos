// Portraits.js — muestra el portrait del que habla.
// Si el PNG existe, lo usa. Si no, dibuja un rectángulo de color con el nombre.
// Cuando lleguen las capas de ropa, ClothingManager las apila encima acá.

import { C, F, SPEAKERS } from '../theme.js';

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
export function resolveTexture(scene, who, expression) {
  const chain = FALLBACK[expression] || FALLBACK.neutral;
  for (const e of chain) {
    const key = `${who}_${e}`;
    if (scene.textures.exists(key)) return key;
  }
  return null;
}

export class PortraitView {
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
