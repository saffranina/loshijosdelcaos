// Logros persistentes. El progreso se guarda en localStorage por navegador.

const STORAGE_KEY = 'ldc_logros_v1';

const emptySave = () => ({ unlocked: {}, games: 0, endings: {}, preludes: {} });

function readSave() {
  try { return { ...emptySave(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch (_) { return emptySave(); }
}

function writeSave(save) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch (_) {}
}

class AchievementTracker {
  configure(config) {
    this.config = config || { achievements: {} };
    this.definitions = {};
    for (const [category, entries] of Object.entries(this.config.achievements || {})) {
      for (const [id, def] of Object.entries(entries)) this.definitions[id] = { ...def, id, category };
    }
    this.save = readSave();
    this.beginRun('normal');
  }

  beginRun(difficulty = 'normal') {
    this.run = {
      difficulty, tones: [], drinkRounds: [], falseStreak: 0, maxFalseStreak: 0,
      tripleSelections: 0, onlyOnesFives: true, consecutiveRoundWins: 0,
      maxConsecutiveRoundWins: 0, wonRoundOneRoll: false, reinDonProposals: 0,
    };
  }

  unlock(id) {
    if (!this.definitions?.[id] || this.save.unlocked[id]) return false;
    this.save.unlocked[id] = Date.now();
    writeSave(this.save);
    this.toast(this.definitions[id].nombre);
    window.dispatchEvent(new CustomEvent('ldc-achievement', { detail: { id } }));
    return true;
  }

  toast(name) {
    const host = document.getElementById('game') || document.body;
    const el = document.createElement('div');
    el.textContent = `🏆 Logro desbloqueado: ${name}`;
    el.style.cssText = 'position:absolute;right:14px;top:76px;z-index:1000;padding:10px 14px;' +
      'max-width:330px;background:#172534f2;border:1px solid #ffd24a;color:#fff;' +
      'font:14px Georgia,serif;border-radius:5px;box-shadow:0 8px 24px #0009;' +
      'transition:opacity .35s,transform .35s;';
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; }, 2600);
    setTimeout(() => el.remove(), 3100);
  }

  event(type, data = {}) {
    const r = this.run;
    if (!r) return;
    if (type === 'tone') {
      r.tones.push(data.tone);
      if (new Set(r.tones).size >= 3) this.unlock('versatil');
      if (data.tone === 'flirt' && data.nearlyNaked) this.unlock('tension_insostenible');
    }
    if (type === 'selection') {
      const values = data.values || [];
      if (values.length === 6) this.unlock('seis_de_seis');
      if (values.length === 6 && [1,2,3,4,5,6].every((v) => values.includes(v))) this.unlock('escalera_de_marfil');
      const counts = values.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {});
      r.tripleSelections += Object.values(counts).filter((n) => n === 3).length;
      if (r.tripleSelections >= 3) this.unlock('amenaza_triple');
      if (values.some((v) => v !== 1 && v !== 5)) r.onlyOnesFives = false;
      if (data.rollAgain && data.allSix) this.unlock('dados_calientes');
      if (data.rollAgain && data.turnPoints > 1500) this.unlock('adicto_al_riesgo');
    }
    if (type === 'bank') {
      if (data.points < 200) this.unlock('gallina');
    }
    if (type === 'farkle' && data.turnPoints > 1000) this.unlock('codicia');
    if (type === 'drink') {
      if (!r.drinkRounds.includes(data.round)) r.drinkRounds.push(data.round);
      if (data.total >= 3) this.unlock('una_mas');
      if (data.beforeFinal) this.unlock('brindis');
    }
    if (type === 'accuse_correct') {
      this.unlock('descarga');
      if (data.total >= 3) this.unlock('tercer_ojo');
      if (data.empBefore === 1) this.unlock('francotirador');
      if (data.sobriety <= data.minimumSobriety + 0.001) this.unlock('vision_doble');
      r.falseStreak = 0;
    }
    if (type === 'accuse_false') {
      r.falseStreak++;
      r.maxFalseStreak = Math.max(r.maxFalseStreak, r.falseStreak);
      if (data.total >= 3) this.unlock('paranoico');
      if (r.falseStreak >= 2) this.unlock('nunca_aprendes');
      if (data.round === 1) this.unlock('gatillo_facil');
      if (data.empAfter === 0 && data.correctTotal === 0) this.unlock('desarmado');
    }
    if (type === 'emp_zero') this.unlock('sin_bateria');
    if (type === 'garment_lost' && data.who === 'rein' && data.round === 1) this.unlock('exhibicionista');
    if (type === 'round_won') {
      r.consecutiveRoundWins++;
      r.maxConsecutiveRoundWins = Math.max(r.maxConsecutiveRoundWins, r.consecutiveRoundWins);
      if (data.oneTurn) this.unlock('conservador');
      if (r.onlyOnesFives) this.unlock('de_uno_en_uno');
      if (r.consecutiveRoundWins >= 3) this.unlock('racha_perfecta');
      r.onlyOnesFives = true;
    }
    if (type === 'round_lost') { r.consecutiveRoundWins = 0; r.onlyOnesFives = true; }
    if (type === 'don_win') this.unlock('todo_o_nada');
    if (type === 'don_lose') this.unlock('mal_calculo');
    if (type === 'rein_don_propose') {
      r.reinDonProposals = (r.reinDonProposals || 0) + 1;
      if (r.reinDonProposals >= 3) this.unlock('jugador_compulsivo');
    }
    if (type === 'daku_don_win') this.unlock('la_casa_siempre_gana');
  }

  finish(ending, state) {
    const r = this.run;
    const won = ending === 'rein_wins';
    this.save.games++;
    this.save.endings[ending] = true;
    if (state.prelude) this.save.preludes[state.prelude] = true;
    if (ending === 'rein_wins') this.unlock('buen_soldado');
    if (ending === 'daku_wins') this.unlock('mala_apuesta');
    if (ending === 'drunk_game_over') this.unlock('fondo_de_botella');
    if (state.prelude === 'all_caught') this.unlock('ojo_de_halcon');
    if (state.prelude === 'none_caught') this.unlock('sabias');
    if (won && state.drinks === 0) this.unlock('sobrio');
    if (won && state.reinLost === 0) this.unlock('impecable');
    if (won && state.reinLost === 2) this.unlock('remontada');
    if (state.round === 3) this.unlock('partida_relampago');
    if (r.drinkRounds.length >= state.round) this.unlock('catador');
    if (!r.tones.includes('flirt')) this.unlock('de_pocas_palabras');
    if (r.tones.length && r.tones.every((tone) => tone === 'stoic')) this.unlock('estoico');
    if (r.tones.length && r.tones.every((tone) => tone === 'flirt')) this.unlock('lengua_suelta');
    if (r.tones.length && r.tones.every((tone) => tone === 'provoke')) this.unlock('soldado_de_hielo');
    if (won && state.sobriety <= 0.2 + 0.001) {
      this.unlock('aguanta_sargento'); this.unlock('tolerancia');
    }
    if (state.accusationsMade === 0) this.unlock('ciego_voluntario');
    const difficultyAchievement = {
      facil:'noche_tranquila', normal:'estrella_de_mar',
      dificil:'reglas_de_petri', pesadilla:'ultimo_dado',
    }[r.difficulty];
    if (won && difficultyAchievement) this.unlock(difficultyAchievement);
    if (!won && r.difficulty === 'pesadilla' && state.reinRoundsWon === 0) this.unlock('masoquista');
    if (this.save.games >= 5) this.unlock('otra_vez');
    if (this.save.games >= 10) this.unlock('habitual');
    if (this.save.games >= 25) this.unlock('vive_aqui');
    if (this.save.endings.rein_wins && this.save.endings.daku_wins) this.unlock('coleccionista');
    if (this.save.preludes.all_caught && this.save.preludes.none_caught) this.unlock('completista');
    if (this.save.endings.rein_wins && this.save.endings.daku_wins &&
        this.save.endings.drunk_game_over && this.save.preludes.all_caught && this.save.preludes.none_caught) {
      this.unlock('todas_las_noches');
    }
    const ids = Object.keys(this.definitions).filter((id) => id !== 'maestro_del_dado');
    if (ids.every((id) => this.save.unlocked[id])) this.unlock('maestro_del_dado');
    writeSave(this.save);
  }

  entries() {
    return Object.values(this.definitions || {}).map((d) => ({ ...d, unlocked: !!this.save.unlocked[d.id] }));
  }
}

export const Achievements = new AchievementTracker();
