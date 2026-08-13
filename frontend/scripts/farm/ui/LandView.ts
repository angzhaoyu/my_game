/**
 * ui/LandView.ts —— 农场土地视图（挂在场景 lands 节点）
 *
 * 负责：
 *  - 按等级解锁显示地块（未解锁隐藏）
 *  - 按土地状态切换土地贴图 a/b/c/d
 *  - 在土地上叠加作物生长阶段贴图
 *  - 交互：开发、种植、浇水、施肥、收获
 *  - 浇水 / 施肥动画（土块弹跳 + 飘字 + 水珠/肥雾）
 */
import {
  _decorator, Color, Component, Label, Layers, Node, resources, Sprite, SpriteFrame, tween, UITransform, Vec3,
} from 'cc';
import { LAND, fertAmountFor, plotsUnlockedAtLevel } from '../config/LandConfig';
import { getCropDef } from '../config/CropConfig';
import type { PlotData } from '../data/PlotData';
import { FarmModel } from '../data/FarmModel';
import { InventoryModel } from '../data/InventoryModel';
import { PlayerModel } from '../data/PlayerModel';
import { FarmPicker } from './FarmPicker';
import type { GameActionHandler } from '../GameAction';
import type { GameCommandType } from '../../core/network/Contracts';

const { ccclass } = _decorator;

export type ToolMode = 'none' | 'water' | 'fert';

@ccclass('LandView')
export class LandView extends Component {
  farm!: FarmModel;
  player!: PlayerModel;
  inventory!: InventoryModel;

  onToast: (msg: string, dur?: number) => void = () => {};
  onAction: GameActionHandler = async () => ({ ok: false, message: '网络服务尚未就绪' });
  now: () => number = () => Date.now();

  private plots: { id: number; node: Node; land: Sprite | null; cropNode: Node; cropSprite: Sprite | null }[] = [];
  private busyPlots = new Set<number>();
  private picker: FarmPicker | null = null;
  private lastKeys: Record<number, string> = {};

  private tool: ToolMode = 'none';
  private waterCooldown = 0; // 时间戳

  onLoad() {
    this.node.on(Node.EventType.TOUCH_END, (e) => { e.propagationStopped = true; });
    this.buildPlotMap();

    // 挂一个共用选择弹窗
    let pickerNode = this.node.getChildByName('FarmPicker');
    if (!pickerNode) {
      pickerNode = new Node('FarmPicker');
      pickerNode.layer = Layers.Enum.UI_2D;
      this.node.addChild(pickerNode);
    }
    this.picker = pickerNode.getComponent(FarmPicker) || pickerNode.addComponent(FarmPicker);
  }

  update() {
    if (!this.farm) return;
    this.farm.updateModel(this.now());
    this.render();
  }

  // ---------- 外部调用 ----------

  setTool(mode: ToolMode) {
    this.tool = mode;
  }

  get currentTool(): ToolMode {
    return this.tool;
  }

  render() {
    if (!this.farm || !this.player) return;
    const unlocked = plotsUnlockedAtLevel(this.player.level);
    for (const p of this.plots) {
      const visible = p.id <= unlocked;
      p.node.active = visible;
      if (!visible) { delete this.lastKeys[p.id]; continue; }
      const plot = this.farm.getPlot(p.id);
      if (!plot) continue;

      const state = this.farm.landState(plot);
      const col = ((plot.id - 1) % LAND.PLOTS_PER_ROW) + 1;
      const landPath = `farm/lands_${state}1/locked_${col}${state}/spriteFrame`;

      // 作物图标
      let cropIcon = '';
      let cropVisible = false;
      if (plot.crop) {
        const def = getCropDef(plot.crop);
        if (def) {
          const stage = this.farm.growthStage(plot, def.stageIcons.length);
          cropIcon = plot.harvestable ? def.fruitIcon : def.stageIcons[stage];
          cropVisible = true;
        }
      }

      // 仅当关键信息变化才重载贴图
      const key = `${state}|${cropVisible}|${cropIcon}`;
      if (this.lastKeys[p.id] === key) continue;
      this.lastKeys[p.id] = key;

      if (p.land) loadFrame(landPath, p.land);
      if (p.cropNode) p.cropNode.active = cropVisible;
      if (cropVisible && p.cropSprite) {
        loadFrame(`textures/items/${cropIcon}/spriteFrame`, p.cropSprite, () => {
          loadFrame(`farm/crop/${cropIcon}/spriteFrame`, p.cropSprite!);
        });
      }
    }
  }

  // ---------- 交互 ----------

  private onPlotTouch(p: { id: number; node: Node }) {
    if (this.busyPlots.has(p.id)) { this.onToast('操作正在同步，请稍候'); return; }
    const plot = this.farm.getPlot(p.id);
    if (!plot || !plot.developed) { this.tryDevelop(p.id); return; }

    // 工具模式优先
    if (this.tool === 'water') { this.tryWater(p.id); return; }
    if (this.tool === 'fert') { this.openFertilizer(p.id); return; }

    // 默认交互
    if (plot.harvestable) { this.tryHarvest(p.id); return; }
    if (plot.crop) { this.showCropStatus(plot); return; }
    this.openSeedPicker(p.id);
  }

  private async tryDevelop(id: number) {
    if (this.player.gold < LAND.DEVELOP_COST) {
      this.onToast('金币不足 💰，无法开发土地');
      return;
    }
    const result = await this.perform(id, 'develop_plot', { plotId: id });
    if (result.ok) this.onToast(result.message);
  }

  private openSeedPicker(id: number) {
    if (!this.picker || this.busyPlots.has(id)) return;
    const opts = this.seedOptions();
    if (opts.length === 0) { this.onToast('背包里没有种子，去商店买吧 🌱'); return; }
    this.picker.open('选择种子', opts, (key) => { void this.doPlant(id, key); });
  }

  private seedOptions(): (import('./FarmPicker').PickerOption & { key: string })[] {
    const seeds = this.inventory.query({ category: 'seed' });
    const out: (import('./FarmPicker').PickerOption & { key: string })[] = [];
    for (const seed of seeds) {
      const cropId = (seed.icon || '').replace(/^seed_/, '');
      const def = getCropDef(cropId);
      if (def) out.push({ key: def.id, name: def.name, icon: seed.icon, sub: `x${seed.count}` });
    }
    return out;
  }

  private async doPlant(id: number, cropId: string) {
    const result = await this.perform(id, 'plant', { plotId: id, cropId });
    if (result.ok) this.onToast(`${result.message} 🌱，记得浇水施肥`);
  }

  private async tryWater(id: number) {
    const now = this.now();
    if (now < this.waterCooldown || this.busyPlots.has(id)) return;
    this.waterCooldown = now + LAND.WATER_COOLDOWN_MS;
    const result = await this.perform(id, 'water', { plotId: id });
    if (result.ok) {
      this.animateWater(id, LAND.WATER_PER_USE);
      this.onToast(result.message);
    }
  }

  private openFertilizer(id: number) {
    if (!this.picker || this.busyPlots.has(id)) return;
    const opts = this.fertilizerOptions();
    if (opts.length === 0) { this.onToast('背包里没有化肥，去商店买吧 🧪'); return; }
    this.picker.open('选择化肥', opts, (key) => { void this.doFertilize(id, key); });
  }

  private fertilizerOptions(): (import('./FarmPicker').PickerOption & { key: string })[] {
    return this.inventory.query({ category: 'fert' }).map(item => ({
      key: item.id,
      name: item.name,
      icon: item.icon,
      sub: `+${fertAmountFor(item.icon)} 养分`,
    }));
  }

  private async doFertilize(id: number, itemId: string) {
    const item = this.inventory.findByItemId(itemId);
    const amount = item ? fertAmountFor(item.icon) : 0;
    const result = await this.perform(id, 'fertilize', { plotId: id, itemId });
    if (result.ok) {
      this.animateFert(id, amount);
      this.onToast(result.message);
    }
  }

  private async tryHarvest(id: number) {
    const result = await this.perform(id, 'harvest', { plotId: id });
    if (result.ok) this.onToast(result.message, 2.2);
  }

  private async perform(id: number, type: GameCommandType, payload: Record<string, unknown>) {
    if (this.busyPlots.has(id)) return { ok: false, message: '操作正在同步' };
    this.busyPlots.add(id);
    try {
      const result = await this.onAction(type, payload);
      if (!result.ok) this.onToast(result.message, 2);
      return result;
    } finally {
      this.busyPlots.delete(id);
    }
  }

  private showCropStatus(plot: PlotData) {
    const def = getCropDef(plot.crop!);
    if (!def) return;
    const hours = Math.max(0, def.duration - plot.progress * def.duration);
    const w = Math.round(plot.water), f = Math.round(plot.fert);
    this.onToast(`${def.name}：水${w} 肥${f} · 约${hours.toFixed(1)}h成熟`, 2);
  }

  // ---------- 动画 ----------

  private animateWater(id: number, amount: number) {
    const p = this.plots.find(x => x.id === id);
    if (!p) return;
    this.bounce(p.node);
    this.floatText(p.node, `+${amount} 💧`, new Color(90, 180, 255, 255));

    // 水珠从土上飞起
    const drop = this.makeFxNode('droplet', 26, 26, p.node, 0, 20);
    loadFrame('farm/effect/water_drop/spriteFrame', drop.sprite, () => {
      loadFrame('farm/effect/water_drop', drop.sprite!);
    });
    tween(drop.node).to(0.5, { position: new Vec3(0, 46, 0) }).start();
    tween(drop.node).delay(0.45).to(0.2, { angle: 0 }).call(() => drop.node.destroy()).start();
  }

  private animateFert(id: number, amount: number) {
    const p = this.plots.find(x => x.id === id);
    if (!p) return;
    this.bounce(p.node);
    this.floatText(p.node, `+${amount} 🧪`, new Color(255, 190, 90, 255));

    const puff = this.makeFxNode('puff', 40, 40, p.node, 0, 10);
    loadFrame('farm/effect/fert_puff/spriteFrame', puff.sprite, () => {
      loadFrame('farm/effect/fert_puff', puff.sprite!);
    });
    tween(puff.node).to(0.4, { scale: new Vec3(1.6, 1.6, 1) }).start();
    tween(puff.node).delay(0.4).to(0.2, { angle: 0 }).call(() => puff.node.destroy()).start();
  }

  private bounce(node: Node) {
    const pos = node.position.clone();
    tween(node).stop();
    tween(node)
      .to(0.08, { scale: new Vec3(1.06, 0.94, 1) })
      .to(0.14, { scale: new Vec3(0.98, 1.03, 1) })
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .start();
    node.setPosition(pos);
  }

  private floatText(parent: Node, text: string, color: Color) {
    const n = new Node('float');
    n.layer = Layers.Enum.UI_2D;
    n.addComponent(UITransform).setContentSize(140, 30);
    n.setPosition(0, 34);
    parent.addChild(n);
    const lb = n.addComponent(Label);
    lb.string = text;
    lb.fontSize = 18;
    lb.color = color;
    lb.isBold = true;
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    tween(n).to(0.7, { position: new Vec3(0, 62, 0) }).call(() => n.destroy()).start();
  }

  private makeFxNode(name: string, w: number, h: number, parent: Node, x: number, y: number) {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    n.addComponent(UITransform).setContentSize(w, h);
    n.setPosition(x, y);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    parent.addChild(n);
    return { node: n, sprite: sp };
  }

  // ---------- 场景结构 ----------

  private buildPlotMap() {
    this.plots = [];
    for (let row = 1; row <= LAND.ROWS; row++) {
      const rowNode = this.node.getChildByName(`lands_${row}`);
      if (!rowNode) continue;
      for (let col = 1; col <= LAND.PLOTS_PER_ROW; col++) {
        const id = (row - 1) * LAND.PLOTS_PER_ROW + col;
        const plotNode = rowNode.getChildByName(String(col));
        if (!plotNode) continue;

        const land = plotNode.getComponent(Sprite) || plotNode.addComponent(Sprite);
        land.sizeMode = Sprite.SizeMode.CUSTOM;

        let cropNode = plotNode.getChildByName('crop');
        if (!cropNode) {
          cropNode = new Node('crop');
          cropNode.layer = Layers.Enum.UI_2D;
          cropNode.addComponent(UITransform).setContentSize(60, 60);
          cropNode.setPosition(0, 12);
          plotNode.addChild(cropNode);
        }
        const cropSprite = cropNode.getComponent(Sprite) || cropNode.addComponent(Sprite);
        cropSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        const idCapture = id;
        plotNode.off(Node.EventType.TOUCH_END);
        plotNode.on(Node.EventType.TOUCH_END, (e) => {
          e.propagationStopped = true;
          this.onPlotTouch(this.plots.find(x => x.id === idCapture)!);
        });

        this.plots.push({ id, node: plotNode, land, cropNode, cropSprite });
      }
    }
  }
}

/** 从资源加载 SpriteFrame（带兜底） */
function loadFrame(path: string, sp: Sprite, fallback?: () => void): void {
  resources.load(path, SpriteFrame, (err, sf) => {
    if (!err && sf && sp) {
      sp.spriteFrame = sf;
    } else if (fallback) {
      fallback();
    }
  });
}