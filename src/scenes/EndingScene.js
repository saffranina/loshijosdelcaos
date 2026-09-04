// EndingScene.js — Acto 4. Reproduce el ending que resolvió GameState,
// después los créditos, y ofrece volver a jugar.

import { C, F } from '../theme.js';
import { VNScene } from './VNScene.js';
import { makeButton } from '../systems/Ui.js';
import { GameState } from '../systems/GameState.js';
import { playMusic } from '../systems/Music.js';
import { Achievements } from '../systems/Achievements.js';

const TITLES = {
  rein_wins:   'Rein gana',
  daku_wins:   'Daku gana',
  drunk_game_over: 'Demasiado alcohol',
};

const DRUNK_GAME_OVER = [
  { speaker: 'stage', text: 'La habitación gira. Los dados se duplican, luego desaparecen.' },
  { speaker: 'daku', expression: 'surprised', text: 'Eh. Sargento. Mírame. Se acabó el juego.' },
  { speaker: 'stage', text: 'Rein intenta responder, pero el cuerpo deja de obedecerle. Daku aparta la botella y da por terminada la partida.' },
  { speaker: 'stage', text: 'GAME OVER — Bebiste hasta perder toda la sobriedad.' },
];

export class EndingScene extends VNScene {
  constructor() { super('Ending', { bgKey: 'bg_room', top: C.roomWarm, bottom: 0x120a0c }); }

  create() {
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.buildStage();

    const key = GameState.ending || 'daku_wins';
    if (!GameState.achievementsFinalized) {
      GameState.achievementsFinalized = true;
      Achievements.finish(key, GameState);
    }
    playMusic(this, key === 'drunk_game_over' ? 'music_gameover' : 'music_endings');
    const act4 = GameState.dialogues.act4;
    const base = key === 'drunk_game_over' ? DRUNK_GAME_OVER : act4[key];

    // El preludio va DELANTE del final, no en su lugar: el que gana sigue
    // ganando y se ve su splash. Por eso estas escenas no necesitan arte
    // propio. En el game over por alcohol no hay preludio: la partida se
    // interrumpió, no se leyó a nadie.
    const preludio = (key !== 'drunk_game_over' && GameState.prelude)
      ? act4[`${GameState.prelude}_prelude`] || []
      : [];
    const lines = preludio.concat(base);

    this.dialogue.play(lines, () => {
      this.dialogue.play(GameState.dialogues.credits, () => this.showSummary(key));
    });
  }

  showSummary(key) {
    const { width, height } = this.scale;
    this.dialogue.setVisible(false);
    Object.values(this.portraits).forEach((p) => p.setVisible(false));

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.72)
      .setOrigin(0).setDepth(300);

    this.add.text(width / 2, 120, TITLES[key] || key, {
      fontFamily: F.title, fontSize: '38px', color: '#e0b878', align: 'center',
    }).setOrigin(0.5).setDepth(301);

    const s = GameState;
    const stats = [
      `Rondas jugadas: ${s.round}`,
      `Trampas de Daku: ${s.cheatsTotal}   ·   acusadas bien: ${s.cheatsCaught}`,
      `Acusaciones falsas: ${s.falseAccusations}`,
      `Tragos: ${s.drinks}   ·   sobriedad final: ${Math.round(s.sobriety * 100)}%`,
      `Rondas ganadas — Rein: ${s.reinRoundsWon}   ·   Daku: ${s.dakuRoundsWon}`,
      `Ropa — Rein: ${s.remaining('rein')}/3   ·   Daku: ${s.remaining('daku')}/3`,
    ].join('\n');

    this.add.text(width / 2, 210, stats, {
      fontFamily: F.body, fontSize: '15px', color: C.textDim,
      align: 'center', lineSpacing: 9,
    }).setOrigin(0.5, 0).setDepth(301);

    makeButton(this, width / 2, 430, 220, 42, 'Otra vez', () => {
      GameState.reset(GameState.config);
      this.scene.start('Title');
    }, { fontSize: 16 }).setDepth(301);
  }
}
