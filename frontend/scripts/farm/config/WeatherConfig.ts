/**
 * WeatherConfig.ts —— 天气系统「配置中心」（纯数据）
 *
 * 决定"水分每小时消耗多少"，从而让缺水有快有慢、需要玩家去浇水。
 * 示例：晴 38° → 6 小时减约 50（≈8.3/小时）。
 */

export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'night';

export interface WeatherDef {
  type: WeatherType;
  name: string;
  temp: number;
  /** 每小时水分消耗 */
  drainPerHour: number;
  /** 图例/表现色（仅提示用） */
  color: string;
}

export const WEATHER: Record<WeatherType, WeatherDef> = {
  sunny:  { type: 'sunny',  name: '晴',   temp: 38, drainPerHour: 8.3, color: '#ffd54a' },
  cloudy: { type: 'cloudy', name: '多云', temp: 30, drainPerHour: 5.5, color: '#b8c4d0' },
  rainy:  { type: 'rainy',  name: '雨',   temp: 25, drainPerHour: 1.5, color: '#7fb8e6' },
  night:  { type: 'night',  name: '夜',   temp: 22, drainPerHour: 2.5, color: '#4a5a7a' },
};

/** 一天 24 小时的天气排表（确定性，方便测试与调参） */
const DAY_SCHEDULE: WeatherType[] = [
  // 0-5  夜
  'night','night','night','night','night','night',
  // 6-8  多云 → 晴
  'cloudy','sunny','sunny',
  // 9-15 晴（最晒，耗水快）
  'sunny','sunny','sunny','sunny','sunny','sunny','sunny',
  // 16-18 多云
  'cloudy','cloudy','cloudy',
  // 19-20 晴转多云
  'sunny','cloudy',
  // 21-23 夜
  'night','night','night',
];

/** 当前小时对应的天气 */
export function weatherAtHour(hour: number): WeatherDef {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  return WEATHER[DAY_SCHEDULE[h]];
}

/** 该小时的水分消耗量 */
export function waterDrainPerHour(hour: number): number {
  return weatherAtHour(hour).drainPerHour;
}

/** 取个代表天气用于展示（取当天正午） */
export function representativeWeather(now: number): WeatherDef {
  const d = new Date(now);
  return weatherAtHour(d.getHours());
}
