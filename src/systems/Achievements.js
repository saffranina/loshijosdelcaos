// Achievements.js — los 57 logros: cuándo se ganan, dónde se guardan y el
// aviso que sale en pantalla.
//
// Se guardan en localStorage y sobreviven entre partidas: hay logros que piden
// jugar 25 veces o ver todos los finales. Si el navegador no deja guardar
// (modo privado, o un file:// con el almacenamiento bloqueado) el juego sigue
// funcionando igual, solo que los logros duran lo que dure la pestaña.
//
// La lista vive en src/data/mecanicas.json, no aquí: los nombres son de la
// autora. Este archivo solo decide CUÁNDO se cumple cada condición.

const CLAVE_LOGROS = 'ldc_logros';
const CLAVE_CONTADORES = 'ldc_contadores';

let catalogo = {};       // id -> { nombre, oculto, condicion, categoria }
let ganados = {};        // id -> fecha ISO
let contadores = {};     // lo que se acumula entre partidas
let escena = null;       // dónde pintar el aviso
let cola = [];

// ---------------------------------------------------------------- guardado

function leer(clave, porDefecto) {
  try {
    const v = window.localStorage.getItem(clave);
    return v ? JSON.parse(v) : porDefecto;
  } catch (e) {
    return porDefecto;
  }
}

function escribir(clave, valor) {
  try { window.localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* da igual */ }
}

/** Carga el catálogo desde mecanicas.json y lo ganado desde el navegador. */
export function init(mecanicas) {
  catalogo = {};
  for (const [categoria, grupo] of Object.entries(mecanicas?.achievements || {})) {
    for (const [id, a] of Object.entries(grupo)) {
      catalogo[id] = { ...a, categoria };
    }
  }
  ganados = leer(CLAVE_LOGROS, {});
  contadores = leer(CLAVE_CONTADORES, {
    partidas: 0, endings: {}, preludios: {},
  });
}

export function todos() {
  return Object.entries(catalogo).map(([id, a]) => ({
    id, ...a, ganado: !!ganados[id], fecha: ganados[id] || null,
  }));
}

export function cuantos() {
  const total = Object.keys(catalogo).length;
  return { ganados: Object.keys(ganados).length, total };
}

/** Solo para pruebas y para el botón de borrar progreso. */
export function borrarTodo() {
  ganados = {};
  contadores = { partidas: 0, endings: {}, preludios: {} };
  escribir(CLAVE_LOGROS, ganados);
  escribir(CLAVE_CONTADORES, contadores);
}

// ------------------------------------------------------------- desbloquear

/** La escena donde salen los avisos. Cada escena que quiera avisos la fija. */
export function setScene(s) {
  escena = s;
  if (cola.length && s) volcarCola();
}

export function unlock(id) {
  if (!catalogo[id] || ganados[id]) return false;
  ganados[id] = new Date().toISOString();
  escribir(CLAVE_LOGROS, ganados);
  cola.push(catalogo[id].nombre);
  volcarCola();

  // "Maestro del dado" se gana al tener todo lo demás, así que hay que
  // mirarlo justo después de cada logro nuevo. Se excluye a sí mismo para no
  // entrar en bucle.
  const pendientes = Object.keys(catalogo).filter((k) => k !== 'maestro_del_dado' && !ganados[k]);
  if (pendientes.length === 0) unlock('maestro_del_dado');
  return true;
}

function volcarCola() {
  if (!escena || !escena.add || !cola.length) return;
  const nombre = cola.shift();
  mostrarAviso(escena, nombre, () => volcarCola());
}

/** Cartelito que entra por arriba, se queda un momento y se va. */
function mostrarAviso(s, nombre, alTerminar) {
  const ancho = 300;
  const x = s.scale.width / 2;
  const caja = s.add.container(x, -50).setDepth(5000);

  const fondo = s.add.graphics();
  fondo.fillStyle(0x0d1520, 0.94);
  fondo.fillRoundedRect(-ancho / 2, -24, ancho, 48, 6);
  fondo.lineStyle(1, 0xe0b878, 0.8);
  fondo.strokeRoundedRect(-ancho / 2, -24, ancho, 48, 6);

  const titulo = s.add.text(0, -10, 'LOGRO DESBLOQUEADO', {
    fontFamily: 'Georgia, serif', fontSize: '10px', color: '#8a6f5c', letterSpacing: 2,
  }).setOrigin(0.5);
  const texto = s.add.text(0, 8, nombre, {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: '#e0b878',
  }).setOrigin(0.5);

  caja.add([fondo, titulo, texto]);

  s.tweens.add({
    targets: caja, y: 46, duration: 380, ease: 'Back.easeOut',
    onComplete: () => {
      s.time.delayedCall(1900, () => {
        s.tweens.add({
          targets: caja, y: -60, alpha: 0, duration: 320,
          onComplete: () => { caja.destroy(); if (alTerminar) alTerminar(); },
        });
      });
    },
  });
}

// ------------------------------------------------- comprobaciones de partida

/**
 * Se llama al terminar una partida. Mira todo lo que solo se puede saber
 * cuando ya acabó: el final, cómo se bebió, qué tonos se usaron, y los
 * contadores que se acumulan entre partidas.
 *
 * @param {object} s  GameState
 */
export function alTerminarPartida(s) {
  const c = s.config || {};

  // ---- finales ----
  if (s.ending === 'rein_wins') unlock('buen_soldado');
  if (s.ending === 'daku_wins') unlock('mala_apuesta');
  if (s.ending === 'drunk_game_over') unlock('fondo_de_botella');
  if (s.prelude === 'all_caught') unlock('ojo_de_halcon');
  if (s.prelude === 'none_caught') unlock('sabias');

  const gano = s.ending === 'rein_wins';

  // ---- Farkle ----
  if (gano && s.reinLost === 0) unlock('impecable');
  if (gano && s.reinLost === 2) unlock('remontada');
  if (s.round <= 3 && s.ending !== 'drunk_game_over') unlock('partida_relampago');
  if (s.rachaRondas >= 3) unlock('racha_perfecta');
  if (s.perdioPrendaEnRonda1) unlock('exhibicionista');
  if (s.triplesEnPartida >= 3) unlock('amenaza_triple');

  // ---- trampas ----
  if (s.cheatsCaught >= 3) unlock('tercer_ojo');
  if (s.falseAccusations >= 3) unlock('paranoico');
  if (s.accusationsMade === 0) unlock('ciego_voluntario');
  if (s.falseAccusations > 0 && s.cheatsCaught === 0 && s.emp === 0) unlock('desarmado');

  // ---- alcohol ----
  if (gano && s.drinks === 0) unlock('sobrio');
  if (s.drinks >= 3) unlock('una_mas');
  if (s.bebioEnRondas && s.bebioEnRondas.size >= s.round) unlock('catador');
  if (gano && s.sobriety >= 1) unlock('aguanta_sargento');
  const minSobriedad = c.sobriety_loss_per_drink ?? 0.2;
  if (gano && s.sobriety <= minSobriedad + 0.001) unlock('tolerancia');

  // ---- diálogos ----
  const tonos = s.tonosUsados || new Set();
  if (tonos.size >= 3) unlock('versatil');
  if (tonos.size === 1 && tonos.has('stoic')) unlock('estoico');
  if (tonos.size === 1 && tonos.has('flirt')) unlock('lengua_suelta');
  if (tonos.size === 1 && tonos.has('provoke')) unlock('soldado_de_hielo');
  if (tonos.size > 0 && !tonos.has('flirt')) unlock('de_pocas_palabras');

  // ---- dificultad ----
  if (gano) {
    const porDificultad = {
      facil: 'noche_tranquila', normal: 'estrella_de_mar',
      dificil: 'reglas_de_petri', pesadilla: 'ultimo_dado',
    };
    const id = porDificultad[c.difficulty];
    if (id) unlock(id);
  }
  if (c.difficulty === 'pesadilla' && !gano && s.reinRoundsWon === 0) unlock('masoquista');

  // ---- contadores entre partidas ----
  contadores.partidas = (contadores.partidas || 0) + 1;
  if (s.ending) contadores.endings[s.ending] = true;
  if (s.prelude) contadores.preludios[s.prelude] = true;
  escribir(CLAVE_CONTADORES, contadores);

  if (contadores.partidas >= 5) unlock('otra_vez');
  if (contadores.partidas >= 10) unlock('habitual');
  if (contadores.partidas >= 25) unlock('vive_aqui');

  const e = contadores.endings;
  const p = contadores.preludios;
  if (e.rein_wins && e.daku_wins) unlock('coleccionista');
  if (p.all_caught && p.none_caught) unlock('completista');
  if (e.rein_wins && e.daku_wins && e.drunk_game_over && p.all_caught && p.none_caught) {
    unlock('todas_las_noches');
  }
}
