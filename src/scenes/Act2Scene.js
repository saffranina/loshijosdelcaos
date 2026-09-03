// Act2Scene.js — Acto 2: la habitación 7, los stakes y la elección sobre Esry.
// Las tres ramas son cosméticas: llevan al mismo lugar, pero el jugador no lo sabe.

import { C } from '../theme.js';
import { VNScene } from './VNScene.js';
import { GameState } from '../systems/GameState.js';

export class Act2Scene extends VNScene {
  constructor() {
    super('Act2', { bgKey: 'bg_room', top: C.roomWarm, bottom: C.roomDark });
  }

  create() {
    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.buildStage();

    const act2 = GameState.dialogues.act2;

    this.dialogue.play(act2.intro, () => {
      this.dialogue.choices(
        act2.choice.options,
        (idx, opt) => {
          GameState.esryBranch = opt.next;
          this.dialogue.play(act2[opt.next], () => {
            this.dialogue.play(act2.continuation, () => this.goTo('Tutorial'));
          });
        },
        { prompt: '¿Cómo se lo preguntas?' }
      );
    });
  }
}
