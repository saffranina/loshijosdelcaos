import { C, F } from '../theme.js';
import { paintBackdrop, panel, makeButton } from '../systems/Ui.js';
import { Achievements } from '../systems/Achievements.js';

const CONDITION_TEXT = {
  rein_wins: 'Gana una partida con Rein.',
  daku_wins: 'Pierde una partida contra Daku.',
  all_caught_prelude: 'Descubre todas las trampas de Daku sin acusarlo en falso.',
  none_caught_prelude: 'Deja pasar todas las trampas de Daku sin hacer ninguna acusación.',
  game_over_alcohol: 'Pierde toda la sobriedad por beber.',
  sacar_escalera_1_6: 'Aparta una escalera completa del 1 al 6.',
  puntuar_6_dados_y_seguir: 'Puntúa con los seis dados y vuelve a tirar.',
  puntuar_6_dados_un_tiro: 'Aparta los seis dados puntuables en una sola tirada.',
  farkle_con_mas_de_1000_acumulados: 'Haz Farkle con más de 1000 puntos acumulados en el turno.',
  plantarse_con_menos_de_200: 'Plántate con menos de 200 puntos.',
  seguir_tirando_con_mas_de_1500: 'Vuelve a tirar con más de 1500 puntos en riesgo.',
  tres_triples_en_partida: 'Consigue tres tríos durante una misma partida.',
  ganar_ronda_solo_1s_y_5s: 'Gana una ronda puntuando únicamente con unos y cincos.',
  ganar_sin_perder_prenda: 'Gana la partida sin perder ninguna prenda.',
  ganar_con_2_prendas_perdidas: 'Gana después de perder dos prendas.',
  perder_prenda_ronda_1: 'Pierde una prenda en la primera ronda.',
  terminar_en_3_rondas: 'Termina la partida en exactamente tres rondas.',
  ganar_ronda_un_solo_tiro: 'Gana una ronda con una sola tirada de dados.',
  ganar_3_rondas_seguidas: 'Gana tres rondas consecutivas.',
  ganar_ronda_doble_o_nada: 'Gana una ronda de doble o nada.',
  perder_ronda_doble_o_nada: 'Pierde una ronda de doble o nada.',
  proponer_doble_o_nada_3_veces: 'Haz que Rein proponga doble o nada tres veces.',
  daku_propone_doble_o_nada_y_gana: 'Acepta la propuesta de Daku y deja que gane la ronda.',
  primera_acusacion_correcta: 'Acusa correctamente a Daku por primera vez.',
  '3_acusaciones_correctas_en_partida': 'Haz tres acusaciones correctas en una partida.',
  acusar_correctamente_con_1_emp: 'Acusa correctamente cuando solo te queda 1 EMP.',
  '3_acusaciones_falsas_en_partida': 'Haz tres acusaciones falsas en una partida.',
  acusar_sin_trampa_ronda_1: 'Acusa en falso durante la primera ronda.',
  '2_acusaciones_falsas_seguidas': 'Haz dos acusaciones falsas consecutivas.',
  todo_emp_en_acusaciones_falsas: 'Gasta todo tu EMP únicamente en acusaciones falsas.',
  terminar_sin_acusar: 'Termina una partida sin acusar a Daku.',
  llegar_a_0_emp: 'Quédate sin EMP.',
  defender_tirada_saboteada: 'Usa EMP para restaurar un dado que Daku alteró en tu tirada.',
  ganar_sin_beber: 'Gana una partida sin beber.',
  beber_3_veces: 'Bebe tres veces en una partida.',
  beber_en_todas_las_rondas: 'Bebe al menos una vez en cada ronda.',
  beber_antes_de_ronda_final: 'Bebe cuando la siguiente prenda puede decidir la partida.',
  ganar_con_sobriedad_1: 'Gana con un solo nivel de sobriedad restante.',
  acusar_correctamente_sobriedad_minima: 'Descubre una trampa con la sobriedad al mínimo.',
  ganar_con_sobriedad_minima: 'Gana la partida con la sobriedad al mínimo.',
  siempre_estoico: 'Elige siempre respuestas estoicas durante la partida.',
  siempre_coquetear: 'Elige siempre coquetear durante la partida.',
  siempre_provocar: 'Elige siempre provocar durante la partida.',
  usar_3_tonos_en_partida: 'Usa provocar, coquetear y estoico en una misma partida.',
  nunca_coquetear: 'Termina una partida sin coquetear.',
  coquetear_en_ropa_interior: 'Coquetea cuando alguno esté en ropa interior.',
  jugar_5_partidas: 'Completa cinco partidas.',
  jugar_10_partidas: 'Completa diez partidas.',
  jugar_25_partidas: 'Completa veinticinco partidas.',
  ver_ambos_endings_principales: 'Mira los finales principales de victoria y derrota.',
  activar_ambos_preludios: 'Activa los dos preludios secretos.',
  ver_ambos_endings_ambos_preludios_y_game_over: 'Mira ambos finales, ambos preludios y el game over por alcohol.',
  desbloquear_todos_los_logros: 'Desbloquea todos los demás logros.',
  ganar_en_facil: 'Gana una partida en Noche tranquila.',
  ganar_en_normal: 'Gana una partida en La Estrella de Mar.',
  ganar_en_dificil: 'Gana una partida en Reglas de Petri.',
  ganar_en_pesadilla: 'Gana una partida en Último dado.',
  perder_pesadilla_sin_ganar_ronda: 'Pierde en Último dado sin ganar ninguna ronda.',
};

export class AchievementsScene extends Phaser.Scene {
  constructor() { super('Achievements'); }

  create() {
    const { width, height } = this.scale;
    if (this.textures.exists('bg_room')) {
      const bg = this.add.image(width / 2, height / 2, 'bg_room');
      const src = this.textures.get('bg_room').getSourceImage();
      bg.setScale(Math.max(width / src.width, height / src.height));
      this.add.rectangle(0, 0, width, height, 0x06101c, 0.68).setOrigin(0);
    } else paintBackdrop(this, C.roomWarm, C.roomDark);
    this.add.text(width / 2, 35, 'LOGROS', { fontFamily:F.title, fontSize:'32px', color:'#f4f7fa' }).setOrigin(.5);
    panel(this, 45, 66, 710, 455, { alpha:.95, radius:6 });

    const entries = Achievements.entries();
    const unlocked = entries.filter((x) => x.unlocked).length;
    this.add.text(width / 2, 74, `${unlocked} / ${entries.length} desbloqueados`, {
      fontFamily:F.body, fontSize:'14px', color:C.textDim,
    }).setOrigin(.5, 0);
    const defaultHint = 'Pasa el cursor sobre un logro desbloqueado para ver cómo se consiguió.';
    this.hint = this.add.text(width / 2, 455, defaultHint, {
      fontFamily:F.body, fontSize:'13px', color:'#cbd7e2', align:'center',
      wordWrap:{ width:620 },
    }).setOrigin(.5).setDepth(10);

    const categories = [...new Set(entries.map((x) => x.category))];
    this.page = 0;
    const render = () => {
      this.items?.forEach((x) => x.destroy()); this.items = [];
      const cat = categories[this.page];
      const list = entries.filter((x) => x.category === cat);
      this.items.push(this.add.text(width/2, 108, cat.toUpperCase().replaceAll('_',' '), {
        fontFamily:F.title, fontSize:'19px', color:'#ffd24a',
      }).setOrigin(.5));
      list.forEach((a, i) => {
        const visibleName = a.unlocked || !a.oculto ? a.nombre : '???';
        const mark = a.unlocked ? '◆' : '◇';
        const item = this.add.text(90 + (i % 2) * 350, 145 + Math.floor(i / 2) * 42,
          `${mark} ${visibleName}`, { fontFamily:F.body, fontSize:'15px', color:a.unlocked?'#f4f7fa':'#71859a' });
        if (a.unlocked) {
          const show = () => this.hint.setText(CONDITION_TEXT[a.condicion] || a.condicion.replaceAll('_', ' '));
          item.setInteractive({ useHandCursor:true });
          item.on('pointerover', show);
          item.on('pointerdown', show);
          item.on('pointerout', () => this.hint.setText(defaultHint));
        }
        this.items.push(item);
      });
      this.pageLabel.setText(`${this.page + 1} / ${categories.length}`);
    };
    this.pageLabel = this.add.text(width/2, 493, '', { fontFamily:F.body, fontSize:'13px', color:C.textDim }).setOrigin(.5);
    makeButton(this, 195, 552, 150, 34, 'Anterior', () => { this.page=(this.page-1+categories.length)%categories.length; render(); });
    makeButton(this, 400, 552, 150, 34, 'Volver', () => this.scene.start('Title'));
    makeButton(this, 605, 552, 150, 34, 'Siguiente', () => { this.page=(this.page+1)%categories.length; render(); });
    render();
  }
}
