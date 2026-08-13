/**
 * LandConfig.ts —— 土地 / 环境 / 升级「配置中心」（纯数据，不依赖引擎）
 *
 * 想调整数值，只改这个文件即可，其它逻辑都会自动跟随。
 */

/** 土地通用数值 */
export const LAND = {
  /** 总地块数 = 24（场景 lands_1..lands_4 各 6 块） */
  TOTAL_PLOTS: 24,
  /** 每行地块数（对应场景 lands_1..lands_4 里 "1".."6" 节点） */
  PLOTS_PER_ROW: 6,
  /** 行数（场景节点名 lands_1..lands_4） */
  ROWS: 4,

  /** 水分 / 肥料总量上限 */
  WATER_MAX: 100,
  FERT_MAX: 100,

  /** 水分低于此值 → 土地显示 d（缺水，优先级最高） */
  DRY_THRESHOLD: 30,
  /** 肥料 >= 此值 → 土地显示 c（施肥） */
  FERT_FERTILIZED: 50,

  /** 一次浇水补充的水分 */
  WATER_PER_USE: 20,
  /** 浇水的"冷却"：浇水后 x 秒内不能再浇（给动画留时间） */
  WATER_COOLDOWN_MS: 600,

  /** 开发（解锁）一块未开发地块的金币花费 */
  DEVELOP_COST: 50,
  /** 种植一次消耗的体力（若以后接入体力系统可复用；现仅记录） */
  PLANT_ENERGY: 2,
};

/**
 * 不同化肥 → 提供的养分值（按化肥贴图名索引，方便与 ItemConfig 对齐）。
 * 想调"每种化肥加多少"，改这里即可。
 */
export const FERT_AMOUNTS: Record<string, number> = {
  fert_organic: 18, fert_compound: 30, fert_n: 22, fert_p: 22, fert_k: 22,
  fert_liquid: 15, fert_compost: 12, fert_bone: 20, fert_ash: 10, fert_slow: 35,
  fert_fish: 25, fert_seaweed: 28,
};

export function fertAmountFor(icon: string): number {
  const v = FERT_AMOUNTS[icon];
  return typeof v === 'number' ? v : 20;
}

/**
 * 等级 → 可解锁地块数（累计）。
 * 下标 0 对应 1 级。1 级 = 1 块，随等级线性变多，24 块约到 24 级。
 * 想调解锁节奏，改这里即可。
 */
export const LEVEL_PLOTS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

/** 每个等级可解锁的地块数（= 相邻差），便于展示"下一级解锁几块" */
export function plotsUnlockedAtLevel(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  if (lv >= LEVEL_PLOTS.length) return LEVEL_PLOTS[LEVEL_PLOTS.length - 1];
  return LEVEL_PLOTS[lv - 1];
}

/** 每个等级本次新解锁的地块数 */
export function newlyUnlockedAtLevel(level: number): number {
  const cur = plotsUnlockedAtLevel(level);
  const prev = plotsUnlockedAtLevel(level - 1);
  return Math.max(0, cur - prev);
}

/**
 * 升级经验曲线 —— 升级会越来越难。
 * 升到 level+1 级所需经验 = ceil(BASE_EXP * EXP_GROWTH ^ (level-1))。
 */
export const LEVEL = {
  BASE_EXP: 100,
  EXP_GROWTH: 1.5,
  MAX_LEVEL: 10,
};

export function expForNextLevel(level: number): number {
  return Math.ceil(LEVEL.BASE_EXP * Math.pow(LEVEL.EXP_GROWTH, Math.max(0, level - 1)));
}

/** 当前等级内所需总经验 */
export function expTotalForLevel(level: number): number {
  if (level <= 1) return 0;
  let sum = 0;
  for (let i = 1; i < level; i++) sum += expForNextLevel(i);
  return sum;
}
