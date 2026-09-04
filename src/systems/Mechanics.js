export const DIFFICULTY_ORDER = ['facil', 'normal', 'dificil', 'pesadilla'];

export function difficultyConfig(base, mechanics, key = 'normal') {
  const d = mechanics?.dificultades?.[key] || mechanics?.dificultades?.normal;
  if (!d) return { ...base };
  return {
    ...base,
    round_target: d.meta_ronda,
    cheat_probability: d.trampa_probabilidad_base,
    cheat_losing_bonus: d.trampa_bonus_perdiendo,
    cheat_caught_penalty: d.trampa_penalizacion_pillado,
    cheat_flash_ms_sober: d.brillo_trampa_sobrio_ms,
    cheat_flash_ms_drunk: d.brillo_trampa_borracho_ms,
    starting_emp: d.emp_inicial,
    max_emp: d.emp_maximo,
    emp_per_drink: d.emp_por_trago,
    starting_sobriety: d.sobriedad_inicial,
    sobriety_loss_per_drink: Math.abs(d.sobriedad_por_trago),
    ai_aggression: d.ia_agresividad,
    double_or_nothing: d.doble_o_nada || { habilitado: false },
    cheat_double_dice: !!d.trampa_dados_dobles,
  };
}

export function difficultyLabel(mechanics, key) {
  const d = mechanics?.dificultades?.[key];
  return d ? `${d.nombre} — ${d.descripcion}` : key;
}
