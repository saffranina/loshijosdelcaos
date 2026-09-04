// Difficulty.js — las cuatro dificultades y la traducción a la config del juego.
//
// El archivo src/data/mecanicas.json viene con las claves en español
// ("trampa_probabilidad_base", "emp_inicial"...) y el resto del código usa las
// inglesas de farkle-config.json ("cheat_probability", "starting_emp"...).
//
// En vez de renombrar uno de los dos —que obligaría a tocar media docena de
// archivos y a que la autora escriba en un idioma distinto del suyo en su
// propio archivo de datos—, aquí se traduce en un solo sitio. Lo que sale de
// `aplicar()` es una config normal, indistinguible de la de siempre.

const ORDEN = ['facil', 'normal', 'dificil', 'pesadilla'];
const POR_DEFECTO = 'normal';

// Dónde se guarda la última dificultad elegida, para no tener que repetirla.
const CLAVE = 'ldc_dificultad';

export const DIFFICULTY_ORDER = ORDEN;

/** Lee la dificultad guardada. Si no hay o no vale, la normal. */
export function leerGuardada() {
  try {
    const v = window.localStorage.getItem(CLAVE);
    if (ORDEN.includes(v)) return v;
  } catch (e) {
    // Modo privado, file:// con la cookie bloqueada, etc. No es un problema:
    // se juega en normal y no se guarda nada.
  }
  return POR_DEFECTO;
}

export function guardar(clave) {
  try { window.localStorage.setItem(CLAVE, clave); } catch (e) { /* da igual */ }
}

/**
 * Mezcla la dificultad elegida sobre la config base.
 *
 * @param {object} base      farkle-config.json
 * @param {object} mecanicas mecanicas.json
 * @param {string} clave     'facil' | 'normal' | 'dificil' | 'pesadilla'
 * @returns {object} una config completa, con las claves de siempre
 */
export function aplicar(base, mecanicas, clave) {
  const d = mecanicas?.dificultades?.[clave];
  if (!d) return { ...base, difficulty: POR_DEFECTO };

  const don = d.doble_o_nada || { habilitado: false };

  return {
    ...base,

    difficulty: clave,
    difficultyName: d.nombre,
    difficultyDesc: d.descripcion,

    // Trampas
    cheat_probability:    d.trampa_probabilidad_base,
    cheat_bonus_losing:   d.trampa_bonus_perdiendo,
    cheat_penalty_caught: d.trampa_penalizacion_pillado,
    cheat_flash_ms_sober: d.brillo_trampa_sobrio_ms,
    cheat_flash_ms_drunk: d.brillo_trampa_borracho_ms,
    // Solo en pesadilla: toca dos dados en vez de uno.
    cheat_double_dice:    !!d.trampa_dados_dobles,

    // Recursos
    starting_emp:             d.emp_inicial,
    max_emp:                  d.emp_maximo,
    emp_per_drink:            d.emp_por_trago,
    starting_sobriety:        d.sobriedad_inicial,
    // En el JSON viene en negativo ("cuánto baja"); el resto del código lo
    // quiere en positivo, porque lo resta.
    sobriety_loss_per_drink:  Math.abs(d.sobriedad_por_trago),
    sobriety_game_over:       d.sobriedad_game_over,

    // Partida
    ai_aggression: d.ia_agresividad,
    round_target:  d.meta_ronda,

    // Doble o nada
    don_enabled:        !!don.habilitado,
    // 'puntos' duplica lo que vale la ronda; 'prendas' hace que el perdedor
    // se quite dos en vez de una.
    don_type:           don.tipo || 'puntos',
    don_multiplier:     don.multiplicador ?? 2,
    don_garments:       don.prendas_perdidas ?? 2,
    // Rein solo se atreve a proponerlo con algo encima: por debajo de este
    // nivel de sobriedad aparece el botón.
    don_rein_sobriety:  don.rein_requiere_sobriedad_menor_a ?? 0,
    don_daku_when_losing: don.daku_propone_cuando_pierde !== false,
    don_daku_always:    !!don.daku_propone_siempre,
    don_daku_chance:    don.daku_propone_probabilidad ?? 0,
  };
}

/** Nombre y descripción para pintar el selector, sin cargar toda la config. */
export function listar(mecanicas) {
  return ORDEN.map((clave) => ({
    clave,
    nombre: mecanicas?.dificultades?.[clave]?.nombre || clave,
    descripcion: mecanicas?.dificultades?.[clave]?.descripcion || '',
  }));
}
