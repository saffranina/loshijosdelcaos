import { C, F } from '../theme.js';
import { makeButton, paintBackdrop, panel } from '../systems/Ui.js';

const PAGES = [
  {
    title: '1 · Aparta dados que puntúan',
    body: 'Después de cada tirada debes elegir al menos un dado o combinación válida.\n\n\n\nHaz clic en un dado para seleccionarlo. Haz clic otra vez para deseleccionarlo.',
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

export class TutorialScene extends Phaser.Scene {
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
      for (const [x, label] of [[180, 'Cada'], [470, 'Cada']]) {
        const t = this.add.text(x, 292, label, { fontFamily: F.body, fontSize: '16px', color: '#f4f7fa' })
          .setOrigin(0, 0.5).setDepth(5);
        this.visualItems.push(t);
      }
      this.die(1, 243, 292, 42);
      this.die(5, 533, 292, 42);
      for (const [x, label] of [[271, 'vale 100 puntos'], [561, 'vale 50 puntos']]) {
        const t = this.add.text(x, 292, label, { fontFamily: F.body, fontSize: '16px', color: '#f4f7fa' })
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
