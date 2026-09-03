// Act1Scene.js — Acto 1: la entrada al bar y el reencuentro.

import { C } from '../theme.js';
import { VNScene } from './VNScene.js';
import { GameState } from '../systems/GameState.js';

export class Act1Scene extends VNScene {
  constructor() {
    super('Act1', { bgKey: 'bg_bar_inside', top: C.barWarm, bottom: C.barDark });
  }

  create() {
    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.buildStage();
    this.dialogue.play(GameState.dialogues.act1, () => this.goTo('Act2'));
  }
}
