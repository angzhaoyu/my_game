/**
 * InventoryModel.ts —— 背包库存「模型层」（纯逻辑，不依赖引擎）
 *
 * 负责：增 / 删 / 改 / 查、过滤(分类)、排序(时间/名称)。
 * UI 层只调用这里的方法并重新渲染，不写任何业务逻辑。
 */
import type { ItemCategory, ItemDef, InventoryStack } from './ItemData';

export type SortKey = 'time' | 'name';
export type SortDir = 'asc' | 'desc';

export interface QueryOptions {
  category?: ItemCategory | 'all';
  sort?: SortKey;
  dir?: SortDir;
}

export class InventoryModel {
  private stacks: InventoryStack[] = [];

  constructor(initial?: InventoryStack[]) {
    this.stacks = initial ? initial.map(s => ({ ...s })) : [];
  }

  /** 全部（拷贝，防止外部直接改内部数组） */
  getAll(): InventoryStack[] {
    return this.stacks.map(s => ({ ...s }));
  }

  get length(): number {
    return this.stacks.length;
  }

  /** 按物品 id 查某一堆 */
  findByItemId(itemId: string): InventoryStack | undefined {
    return this.stacks.find(s => s.id === itemId);
  }

  /** 购买 / 获得：已有则数量 +count，否则新增一堆 */
  addItem(def: ItemDef, count = 1): void {
    const exist = this.stacks.find(s => s.id === def.id);
    if (exist) {
      exist.count += count;
    } else {
      this.stacks.push({ ...def, count, acquired: Date.now() });
    }
  }

  /**
   * 出售 1 个，返回获得的金币。
   * 数量减到 0 时自动移除该堆。卖光返回 0。
   */
  sellOne(itemId: string): number {
    const idx = this.stacks.findIndex(s => s.id === itemId);
    if (idx < 0) return 0;
    const stack = this.stacks[idx];
    const gain = stack.value;
    stack.count -= 1;
    if (stack.count <= 0) this.stacks.splice(idx, 1);
    return gain;
  }

  /** 过滤 + 排序，返回用于渲染的列表 */
  query(opts: QueryOptions = {}): InventoryStack[] {
    const { category = 'all', sort = 'time', dir = 'desc' } = opts;
    let list = this.stacks.slice();
    if (category !== 'all') list = list.filter(s => s.category === category);

    list.sort((a, b) => {
      let r = 0;
      if (sort === 'time') {
        r = a.acquired - b.acquired; // 升序：早→晚
      } else {
        r = a.name.localeCompare(b.name, 'zh-Hans-CN'); // 拼音升序
      }
      return dir === 'desc' ? -r : r;
    });
    return list;
  }

  /** 存档：导出为可序列化结构 */
  toJSON(): InventoryStack[] {
    return this.stacks.map(s => ({ ...s }));
  }

  /** 读档 */
  loadJSON(data: InventoryStack[]): void {
    this.stacks = Array.isArray(data) ? data.map(s => ({ ...s })) : [];
  }
}
