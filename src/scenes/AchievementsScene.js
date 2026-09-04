import { C, F } from '../theme.js';
import { paintBackdrop, panel, makeButton } from '../systems/Ui.js';
import { Achievements } from '../systems/Achievements.js';

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
        this.items.push(this.add.text(90 + (i % 2) * 350, 145 + Math.floor(i / 2) * 42,
          `${mark} ${visibleName}`, { fontFamily:F.body, fontSize:'15px', color:a.unlocked?'#f4f7fa':'#71859a' }));
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
