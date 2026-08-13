/**
 * ItemConfig.ts —— 物品「配置中心」（纯逻辑，不依赖引擎）
 *
 * 设计目标：以后要加新物品 / 新分类，只改这个文件即可，
 * 背包、商店、后端都会自动同步（它们都 import 这里的导出）。
 *
 * 新增物品只需在对应 RAW 数组里加一行 { name, icon }，
 * 价值(value) 会按公式自动生成，无需手动维护。
 */
import type { ItemCategory, ItemDef, ShopDef, InventoryStack } from '../data/ItemData';

/** 初始金币 */
export const INITIAL_GOLD = 500;
/** 商店售价 = 回收价 × 此倍率（形成经济循环） */
export const BUY_MULT = 2;

/** 不同物品 → 不同价值（回收价）。按分类给区间，保证每件都不同。 */
function valueFor(category: ItemCategory, index: number): number {
  if (category === 'seed') return 6 + ((index * 5 + 3) % 17);   // 6 ~ 22
  if (category === 'fruit') return 18 + ((index * 7 + 5) % 37); // 18 ~ 54
  return 10 + ((index * 3 + 2) % 23);                            // 10 ~ 32
}

/** ===== 原始素材（只写名字+图标，价值自动算） ===== */
const SEED_RAW = [
  { name: '小麦种子', icon: 'seed_wheat' }, { name: '水稻种子', icon: 'seed_rice' },
  { name: '玉米种子', icon: 'seed_corn' }, { name: '胡萝卜种子', icon: 'seed_carrot' },
  { name: '番茄种子', icon: 'seed_tomato' }, { name: '土豆种子', icon: 'seed_potato' },
  { name: '草莓种子', icon: 'seed_strawberry' }, { name: '南瓜种子', icon: 'seed_pumpkin' },
  { name: '辣椒种子', icon: 'seed_pepper' }, { name: '茄子种子', icon: 'seed_eggplant' },
  { name: '西瓜种子', icon: 'seed_watermelon' }, { name: '向日葵种子', icon: 'seed_sunflower' },
  { name: '蓝莓种子', icon: 'seed_blueberry' }, { name: '葡萄种子', icon: 'seed_grape' },
  { name: '大豆种子', icon: 'seed_soy' }, { name: '花生种子', icon: 'seed_peanut' },
  { name: '洋葱种子', icon: 'seed_onion' }, { name: '大蒜种子', icon: 'seed_garlic' },
  { name: '菠菜种子', icon: 'seed_spinach' }, { name: '生菜种子', icon: 'seed_lettuce' },
  { name: '棉花种子', icon: 'seed_cotton' },
];

const FRUIT_RAW = [
  { name: '小麦', icon: 'fruit_wheat' }, { name: '水稻', icon: 'fruit_rice' },
  { name: '玉米', icon: 'fruit_corn' }, { name: '胡萝卜', icon: 'fruit_carrot' },
  { name: '番茄', icon: 'fruit_tomato' }, { name: '土豆', icon: 'fruit_potato' },
  { name: '草莓', icon: 'fruit_strawberry' }, { name: '南瓜', icon: 'fruit_pumpkin' },
  { name: '辣椒', icon: 'fruit_pepper' }, { name: '茄子', icon: 'fruit_eggplant' },
  { name: '西瓜', icon: 'fruit_watermelon' }, { name: '苹果', icon: 'fruit_apple' },
  { name: '蓝莓', icon: 'fruit_blueberry' }, { name: '葡萄', icon: 'fruit_grape' },
  { name: '橙子', icon: 'fruit_orange' }, { name: '柠檬', icon: 'fruit_lemon' },
  { name: '桃子', icon: 'fruit_peach' }, { name: '椰子', icon: 'fruit_coconut' },
  { name: '香蕉', icon: 'fruit_banana' }, { name: '菠萝', icon: 'fruit_pineapple' },
  { name: '芒果', icon: 'fruit_mango' }, { name: '杨梅', icon: 'fruit_bayberry' },
  { name: '柿子', icon: 'fruit_persimmon' }, { name: '猕猴桃', icon: 'fruit_kiwi' },
  { name: '哈密瓜', icon: 'fruit_hami' }, { name: '大豆', icon: 'fruit_soy' },
  { name: '花生', icon: 'fruit_peanut' },
];

const FERT_RAW = [
  { name: '有机肥', icon: 'fert_organic' }, { name: '复合肥', icon: 'fert_compound' },
  { name: '氮肥', icon: 'fert_n' }, { name: '磷肥', icon: 'fert_p' },
  { name: '钾肥', icon: 'fert_k' }, { name: '营养液', icon: 'fert_liquid' },
  { name: '堆肥', icon: 'fert_compost' }, { name: '骨粉', icon: 'fert_bone' },
  { name: '草木灰', icon: 'fert_ash' }, { name: '缓释肥', icon: 'fert_slow' },
  { name: '鱼蛋白', icon: 'fert_fish' }, { name: '海藻肥', icon: 'fert_seaweed' },
];

/** 把 RAW 转成带 id / value 的 ItemDef */
function buildDefs(raw: { name: string; icon: string }[], category: ItemCategory, prefix: string): ItemDef[] {
  return raw.map((r, i) => ({
    id: `${prefix}_${i}`,
    name: r.name,
    icon: r.icon,
    category,
    value: valueFor(category, i),
  }));
}

export const SEED_ITEMS: ItemDef[] = buildDefs(SEED_RAW, 'seed', 'seed');
export const FRUIT_ITEMS: ItemDef[] = buildDefs(FRUIT_RAW, 'fruit', 'fruit');
export const FERT_ITEMS: ItemDef[] = buildDefs(FERT_RAW, 'fert', 'fert');

/** 全部可存在于背包的物品（种子 + 果实 + 化肥） */
export const ALL_ITEMS: ItemDef[] = [...SEED_ITEMS, ...FRUIT_ITEMS, ...FERT_ITEMS];

/** 商店在售目录（仅 种子 + 化肥） */
export const SHOP_ITEMS: ShopDef[] = [...SEED_ITEMS, ...FERT_ITEMS].map(d => ({
  ...d,
  price: d.value * BUY_MULT,
}));

/** 按物品 id 查定义 */
export function getItemDef(id: string): ItemDef | undefined {
  return ALL_ITEMS.find(d => d.id === id);
}

/**
 * 生成初始背包（给每个物品一个初始数量，便于演示）。
 * 真实项目里这些数据应从后端拉取，而不是本地生成。
 */
export function buildInitialInventory(): InventoryStack[] {
  const now = Date.now();
  return ALL_ITEMS.map((d, i) => ({
    ...d,
    count: ((i * 7 + 3) % 12) + 1,
    acquired: now - (i * 5 + (i % 6) * 9 + 2) * 3600 * 1000,
  }));
}
