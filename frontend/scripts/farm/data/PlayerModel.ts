/**
 * PlayerModel.ts —— 玩家「模型层」（纯逻辑，不依赖引擎）
 * 管理金币、用户 id、等级/经验；以后可扩展体力等。
 */
import { expForNextLevel, LEVEL } from '../config/LandConfig';

export class PlayerModel {
  gold: number;
  userId: string | null = null;
  username: string | null = null;
  level: number;
  exp: number;          // 当前等级内累计经验
  energy: number;

  constructor(initialGold = 500) {
    this.gold = initialGold;
    this.level = 1;
    this.exp = 0;
    this.energy = 100;
  }

  /** 加金币（出售时） */
  addGold(amount: number): void {
    if (amount <= 0) return;
    this.gold += amount;
  }

  /** 花金币（购买时）。不够返回 false 且不扣。 */
  spend(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  /** 本等级距下一级还差多少经验 */
  get expToNext(): number {
    return Math.max(1, expForNextLevel(this.level));
  }

  /**
   * 加经验并尝试升级。返回是否发生了升级（用于弹提示）。
   */
  addExp(amount: number): number {
    if (amount <= 0 || this.level >= LEVEL.MAX_LEVEL) return 0;
    this.exp += amount;
    let leveledUp = 0;
    while (this.level < LEVEL.MAX_LEVEL && this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level += 1;
      leveledUp += 1;
    }
    return leveledUp;
  }

  bindUser(id: string, username: string | null): void {
    this.userId = id;
    this.username = username;
  }

  toJSON() {
    return {
      gold: this.gold,
      userId: this.userId,
      username: this.username,
      level: this.level,
      exp: this.exp,
      energy: this.energy,
    };
  }

  loadJSON(o: any) {
    if (!o) return;
    if (typeof o.gold === 'number') this.gold = o.gold;
    if (typeof o.level === 'number') this.level = o.level;
    if (typeof o.exp === 'number') this.exp = o.exp;
    if (typeof o.energy === 'number') this.energy = o.energy;
    if (typeof o.userId === 'string' || typeof o.userId === 'number') this.userId = String(o.userId);
    if (typeof o.username === 'string') this.username = o.username;
  }
}
