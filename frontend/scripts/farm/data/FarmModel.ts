/**
 * FarmModel.ts —— 农场「逻辑层」（纯逻辑，不依赖引擎，可单测）
 *
 * 负责：
 *  - 24 块地状态管理（开发/种植/浇水/施肥/收获）
 *  - 按真实时间做水分/肥料消耗与生长进度模拟
 *  - 0 点 / 12 点生长奖励
 *  - 根据水肥算"生长环境系数"（超出或不足都会降速）
 *  - 地块显示态计算（a/b/c/d）
 *  - 存档 / 读档（toJSON / fromJSON）
 */
import { LAND, plotsUnlockedAtLevel } from '../config/LandConfig';
import { waterDrainPerHour } from '../config/WeatherConfig';
import { getCropDef } from '../config/CropConfig';
import type { FarmSave, LandState, PlotData } from './PlotData';

const HOUR_MS = 3600 * 1000;

/** 一个可种植的种子项（供 UI 层选用） */
export interface SeedOption {
  id: string;       // 作物 id
  name: string;
  icon: string;     // seed 贴图
  count: number;    // 背包里该种子数量
}

export class FarmModel {
  plots: PlotData[] = [];
  lastTick: number = Date.now();

  constructor() {
    this.reset();
  }

  reset() {
    this.plots = [];
    for (let i = 1; i <= LAND.TOTAL_PLOTS; i++) {
      this.plots.push(this.newPlot(i));
    }
    this.lastTick = Date.now();
  }

  private newPlot(id: number): PlotData {
    return {
      id,
      developed: false,
      water: 0,
      fert: 0,
      crop: null,
      plantedAt: 0,
      progress: 0,
      harvestable: false,
      lastBoostKey: '',
    };
  }

  // ---------------- 查询 ----------------

  getPlot(id: number): PlotData | undefined {
    return this.plots.find(p => p.id === id);
  }

  /** 是否已解锁（等级内） */
  isUnlocked(id: number, level: number): boolean {
    return id <= plotsUnlockedAtLevel(level);
  }

  /** 计算某块地的显示态（b > d > c > a 的规则见注释） */
  landState(p: PlotData): LandState {
    if (!p.developed) return 'b';                       // 未开发
    if (p.water < LAND.DRY_THRESHOLD) return 'd';       // 缺水优先
    if (p.fert >= LAND.FERT_FERTILIZED) return 'c';     // 施肥
    return 'a';                                          // 普通
  }

  /**
   * 当前生长阶段索引（用于选贴图）。
   * 已收获返回最后一个阶段，否则按进度分档。
   */
  growthStage(p: PlotData, stages: number): number {
    const n = Math.max(1, stages);
    if (p.harvestable) return n - 1;
    const idx = Math.floor(p.progress * n);
    return Math.min(n - 1, Math.max(0, idx));
  }

  // ---------------- 操作 ----------------

  /** 开发一块地（花费金币由 UI 层判断） */
  develop(id: number): boolean {
    const p = this.getPlot(id);
    if (!p || p.developed) return false;
    p.developed = true;
    // 新开发的土地给一个"初始水分"，显示为普通态(a)，等玩家浇水/施肥
    if (p.water < LAND.DRY_THRESHOLD) p.water = LAND.DRY_THRESHOLD;
    if (p.fert < 0) p.fert = 0;
    return true;
  }

  /** 种植：地块必须已开发、空着，且已解锁 */
  plant(id: number, cropId: string, level: number): boolean {
    const p = this.getPlot(id);
    if (!p) return false;
    if (!p.developed) return false;
    if (p.crop) return false;
    if (!this.isUnlocked(id, level)) return false;
    const def = getCropDef(cropId);
    if (!def) return false;

    p.crop = def.id;
    p.plantedAt = Date.now();
    p.progress = 0;
    p.harvestable = false;
    p.lastBoostKey = '';
    return true;
  }

  /** 浇水：+ 固定水分（封顶 WATER_MAX） */
  water(id: number, amount = LAND.WATER_PER_USE): boolean {
    const p = this.getPlot(id);
    if (!p || !p.developed) return false;
    p.water = Math.min(LAND.WATER_MAX, p.water + amount);
    return true;
  }

  /** 施肥：+ 该肥料养分（封顶 FERT_MAX） */
  fertilize(id: number, amount: number): boolean {
    const p = this.getPlot(id);
    if (!p || !p.developed) return false;
    p.fert = Math.min(LAND.FERT_MAX, p.fert + amount);
    return true;
  }

  /**
   * 收获：把成熟作物收走，返回其金币价值。
   * 收获后地块重置为"可再种"的空地（保留水肥，方便连种）。
   */
  harvest(id: number): number {
    const p = this.getPlot(id);
    if (!p || !p.crop || !p.harvestable) return 0;
    const def = getCropDef(p.crop);
    if (!def) return 0;
    p.crop = null;
    p.plantedAt = 0;
    p.progress = 0;
    p.harvestable = false;
    p.lastBoostKey = '';
    return def.value;
  }

  // ---------------- 时间模拟 ----------------

  /** 按真实时间推进模拟（供 UI 层在 onLoad / 定时器调用） */
  updateModel(nowMs: number) {
    if (!isFinite(nowMs)) nowMs = Date.now();
    const hours = (nowMs - this.lastTick) / HOUR_MS;
    if (hours <= 0) return;

    // 逐小时推进，保证 0/12 点奖励边界准确
    let t = this.lastTick;
    while (t < nowMs) {
      const stepEnd = Math.min(t + HOUR_MS, nowMs);
      const frac = (stepEnd - t) / HOUR_MS; // 本步占一小时的比例
      this.tickHour(stepEnd, frac);
      t = stepEnd;
    }
    this.lastTick = nowMs;
  }

  private tickHour(stepEnd: number, frac: number) {
    // 用"本步结束所在小时"作为该小时消耗与奖励判断（边界小时更准确）
    const hour = new Date(stepEnd).getHours();
    const drainWater = waterDrainPerHour(hour) * frac;

    for (const p of this.plots) {
      if (!p.developed) continue;

      // 空地的水也会慢慢蒸发（让显示更真实），有作物时同样消耗
      if (p.water > 0) {
        p.water = Math.max(0, p.water - drainWater);
      }

      if (!p.crop) continue;
      const def = getCropDef(p.crop);
      if (!def) continue;

      // 肥料随种植时间消耗
      p.fert = Math.max(0, p.fert - def.fertConsume * frac);

      // 生长推进
      const m = this.envMultiplier(p, def);
      p.progress += (1 / def.duration) * m * frac;
      if (p.progress >= 1) {
        p.progress = 1;
        p.harvestable = true;
      }

      // 0/12 点生长奖励（满足水肥则一次 -2h）
      if (hour === 0 || hour === 12) {
        const key = this.hourKey(stepEnd);
        if (p.lastBoostKey !== key && p.water >= def.boostWater && p.fert >= def.boostFert) {
          p.lastBoostKey = key;
          p.progress += def.boostHours / def.duration;
          if (p.progress >= 1) { p.progress = 1; p.harvestable = true; }
        }
      }
    }
  }

  private hourKey(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}`;
  }

  /**
   * 生长环境系数：最佳区间内 ≈1（=12小时可收），超出或不足都会降速。
   */
  envMultiplier(p: PlotData, def: import('./PlotData').CropDef): number {
    let m = 1;
    const w = p.water, f = p.fert;

    if (w < def.optWater[0]) m -= (def.optWater[0] - w) * def.penaltyDry;
    else if (w > def.optWater[1]) m -= (w - def.optWater[1]) * def.penaltyOverWater;

    if (f < def.optFert[0]) m -= (def.optFert[0] - f) * def.penaltyLowFert;
    else if (f > def.optFert[1]) m -= (f - def.optFert[1]) * def.penaltyOverFert;

    // 严重缺水额外惩罚
    if (w < 20) m -= (20 - w) * 0.01;

    return Math.max(0.04, Math.min(1, m));
  }

  // ---------------- 存档 ----------------

  toJSON(): FarmSave {
    return {
      plots: this.plots.map(p => ({ ...p })),
      lastTick: this.lastTick,
    };
  }

  loadJSON(data: FarmSave | null) {
    if (!data || !Array.isArray(data.plots) || data.plots.length === 0) {
      this.reset();
      return;
    }
    this.plots = [];
    for (let i = 1; i <= LAND.TOTAL_PLOTS; i++) {
      const src = data.plots.find(p => p.id === i);
      this.plots.push(src ? { ...src } : this.newPlot(i));
    }
    this.lastTick = typeof data.lastTick === 'number' ? data.lastTick : Date.now();
  }
}
