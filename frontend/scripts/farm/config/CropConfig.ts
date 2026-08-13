/**
 * CropConfig.ts —— 作物「配置中心」（纯数据，不依赖引擎）
 *
 * 每种作物：
 *  - duration      良好生长下可收获的小时数（默认 12，即"良好生长固定 12 小时"）
 *  - stageIcons    生长阶段贴图（阶段0=刚种下，最后一张=成熟）。阶段数=数组长度。
 *  - optWater/optFert  最佳水/肥区间；超出或不足都会让生长变慢
 *  - boostWater/boostFert  触发 0 点/12 点生长奖励所需的最低水肥
 *  - boostHours    每次奖励减少的成长小时数
 *  - fertConsume   每小时肥料消耗
 *  - value         收获金币价值
 *  - fruitIcon     收获（成熟）时叠在土地上的果实贴图
 *
 * 想新增作物，在 CROPS 里加一行即可。
 */
import type { CropDef } from '../data/PlotData';

/** 通用生长阶段贴图（苗→长→熟，资源见 resources/farm/crop/） */
export const PLANT_STAGE_ICONS = ['plant_1', 'plant_2', 'plant_3'];

function build(
  id: string,
  name: string,
  seedIcon: string,
  fruitIcon: string,
  value: number,
  optWater: [number, number],
  optFert: [number, number],
): CropDef {
  return {
    id,
    name,
    seedIcon,
    fruitIcon,
    value,
    duration: 12,                       // 良好生长 12 小时
    optWater,
    optFert,
    stageIcons: [seedIcon, ...PLANT_STAGE_ICONS],
    boostWater: 40,
    boostFert: 30,
    boostHours: 2,
    fertConsume: 0.7,
    penaltyDry: 0.030,                  // 水分每低于最佳下限 1 → 减速系数
    penaltyOverWater: 0.015,            // 水分每高于最佳上限 1 → 减速系数
    penaltyLowFert: 0.020,
    penaltyOverFert: 0.018,
  };
}

export const CROPS: CropDef[] = [
  build('wheat',      '小麦',   'seed_wheat',      'fruit_wheat',      20, [55, 75], [40, 60]),
  build('rice',       '水稻',   'seed_rice',       'fruit_rice',       22, [60, 85], [35, 55]),
  build('corn',       '玉米',   'seed_corn',       'fruit_corn',       30, [55, 75], [45, 65]),
  build('carrot',     '胡萝卜', 'seed_carrot',     'fruit_carrot',     24, [55, 75], [35, 55]),
  build('tomato',     '番茄',   'seed_tomato',     'fruit_tomato',     26, [55, 75], [45, 65]),
  build('potato',     '土豆',   'seed_potato',     'fruit_potato',     28, [55, 75], [40, 60]),
  build('strawberry', '草莓',   'seed_strawberry', 'fruit_strawberry', 40, [60, 80], [40, 60]),
  build('pumpkin',    '南瓜',   'seed_pumpkin',    'fruit_pumpkin',    36, [55, 75], [45, 65]),
  build('pepper',     '辣椒',   'seed_pepper',     'fruit_pepper',     34, [55, 75], [45, 65]),
  build('eggplant',   '茄子',   'seed_eggplant',   'fruit_eggplant',   32, [55, 75], [40, 60]),
  build('watermelon', '西瓜',   'seed_watermelon', 'fruit_watermelon', 48, [60, 80], [40, 60]),
  build('grape',      '葡萄',   'seed_grape',      'fruit_grape',      44, [55, 75], [45, 65]),
  build('soy',        '大豆',   'seed_soy',        'fruit_soy',        26, [55, 75], [40, 60]),
  build('peanut',     '花生',   'seed_peanut',     'fruit_peanut',     30, [55, 75], [45, 65]),
];

export function getCropDef(id: string): CropDef | undefined {
  return CROPS.find(c => c.id === id);
}
