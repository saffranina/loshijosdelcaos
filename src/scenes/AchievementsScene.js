// AchievementsScene.js — la vitrina de logros, desde el título.
//
// Los ocultos no enseñan su nombre hasta que se ganan: si el jugador lee
// "Ver ambos endings, ambos preludios y el game over" antes de jugar, deja de
// ser un descubrimiento y pasa a ser una lista de tareas.

import { C, F } from '../theme.js';
import { makeButton, paintBackdrop, panel } from '../systems/Ui.js';
import * as Achievements from '../systems/Achievements.js';

const CATEGORIAS = {
  endings: 'Finales',
  farkle: 'Farkle',
  doble_o_nada: 'Doble o nada',
  trampas: 'Trampas',
  alcohol: 'Alcohol',
  dialogos: 'Diálogos',
  meta: 'Constancia',
  dificultad: 'Dificultad',
};

const POR_PAGINA = 14;

export class AchievementsScene extends Phaser.Scene {
  constructor() { super('Achievements'); }

  create() {
    const { width, height } = this.scale;
    if (this.textures.exists('bg_room')) {
      const bg = this.add.image(width / 2, height / 2, 'bg_room');
      const src = this.textures.get('bg_room').getSourceImage();
      bg.setScale(Math.max(width / src.width, height / src.height));
      this.add.rectangle(0, 0, width, height, 0x07111b, 0.72).setOrigin(0);
    } else {
      paintBackdrop(this, C.roomWarm, C.roomDark);
    }

    const { ganados, total } = Achievements.cuantos();
    this.add.text(width / 2, 34, 'LOGROS', {
      fontFamily: F.title, fontSize: '30px', color: '#f4f7fa', letterSpacing: 2,
    }).setOrigin(0.5);
    this.add.text(width / 2, 66, `${ganados} de ${total}`, {
      fontFamily: F.body, fontSize: '14px', color: C.textDim,
    }).setOrigin(0.5);

    panel(this, 40, 88, width - 80, 372, { alpha: 0.9, radius: 6 });

    // Ordenados por categoría, en el mismo orden que el archivo de datos.
    const orden = Object.keys(CATEGORIAS);
    this.lista = Achievements.todos().sort(
      (a, b) => orden.indexOf(a.categoria) - orden.indexOf(b.categoria));

    this.pagina = 0;
    this.filas = [];
    this.pintar();

    this.anterior = makeButton(this, 250, 500, 130, 34, 'Anterior',
      () => { this.pagina--; this.pintar(); }, { fontSize: 13 });
    this.siguiente = makeButton(this, 400, 500, 130, 34, 'Siguiente',
      () => { this.pagina++; this.pintar(); }, { fontSize: 13 });
    makeButton(this, 550, 500, 130, 34, 'Volver',
      () => this.scene.start('Title'), { fontSize: 13 });
  }

  pintar() {
    this.filas.forEach((f) => f.destroy());
    this.filas = [];

    const paginas = Math.max(1, Math.ceil(this.lista.length / POR_PAGINA));
    this.pagina = Math.max(0, Math.min(this.pagina, paginas - 1));
    const trozo = this.lista.slice(this.pagina * POR_PAGINA, (this.pagina + 1) * POR_PAGINA);

    let y = 104;
    let categoriaAnterior = null;

    for (const a of trozo) {
      if (a.categoria !== categoriaAnterior) {
        categoriaAnterior = a.categoria;
        this.filas.push(this.add.text(62, y, (CATEGORIAS[a.categoria] || a.categoria).toUpperCase(), {
          fontFamily: F.body, fontSize: '11px', color: C.lamp, letterSpacing: 2,
        }));
        y += 18;
      }

      // Un oculto sin ganar no dice ni cómo se consigue.
      const secreto = a.oculto && !a.ganado;
      const nombre = secreto ? '???' : a.nombre;
      const color = a.ganado ? '#e0b878' : (secreto ? '#4b5560' : '#7d8892');

      this.filas.push(this.add.text(66, y, a.ganado ? '◆' : '◇', {
        fontFamily: F.body, fontSize: '13px', color,
      }));
      this.filas.push(this.add.text(88, y, nombre, {
        fontFamily: F.body, fontSize: '14px', color,
      }));
      y += 22;
    }

    this.filas.push(this.add.text(this.scale.width / 2, 466,
      `${this.pagina + 1} / ${paginas}`, {
        fontFamily: F.body, fontSize: '12px', color: C.textDim,
      }).setOrigin(0.5));

    if (this.anterior) this.anterior.setEnabled(this.pagina > 0);
    if (this.siguiente) this.siguiente.setEnabled(this.pagina < paginas - 1);
  }
}
