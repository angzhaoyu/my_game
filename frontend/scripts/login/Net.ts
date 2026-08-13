// ============================================================
// 网络请求封装：自动适配两种环境
//   1) 微信小游戏：wx.request
//   2) 浏览器 / Cocos 预览：XMLHttpRequest
// 后端接口返回统一格式：{ success, message?, user?, regions? }
// ============================================================

export interface UserInfo {
    id?: number;            // 数据库 users 表主键，farm 场景按它拉取玩家数据
    username: string;
    region: string;
    coins: number;
    level: number;
    exp: number;
    diamonds: number;
    created_at?: string;
}

export interface ApiResult {
    success: boolean;
    message?: string;
    code?: string;
    user?: UserInfo;
    regions?: string[];
}

/** 登录态在 localStorage 中的键名（login 与 farm 场景共享，解决继承问题） */
export const LOGIN_UID_KEY = 'loggedInUserId';
export const LOGIN_NAME_KEY = 'loggedInUsername';

/** 服务器地址配置（从原 ServerConfig 合并，避免重复文件） */
export const SERVER = {
    baseUrl: 'http://127.0.0.1:8000',
};

type Callback = (status: number, data: ApiResult | null) => void;

function parseData(raw: any): ApiResult | null {
    try {
        if (typeof raw === 'string') return JSON.parse(raw);
        if (raw && typeof raw === 'object') return raw;
    } catch (e) { /* 非 JSON */ }
    return null;
}

export function httpJson(url: string, method: 'GET' | 'POST', body: object | null, cb: Callback) {
    const wxGlobal = (globalThis as any).wx;

    // ---------- 微信小游戏环境 ----------
    if (wxGlobal && typeof wxGlobal.request === 'function') {
        wxGlobal.request({
            url: url,
            method: method,
            data: body || {},
            header: { 'Content-Type': 'application/json' },
            success: (res: any) => cb(res.statusCode || 0, parseData(res.data)),
            fail: (err: any) =>
                cb(-1, { success: false, message: '网络请求失败：' + ((err && err.errMsg) || '未知错误') }),
        });
        return;
    }

    // ---------- 浏览器 / Cocos 预览环境 ----------
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        cb(xhr.status, parseData(xhr.responseText));
    };
    xhr.onerror = () =>
        cb(-1, { success: false, message: '无法连接服务器，请确认后端已启动（http://127.0.0.1:8000）' });
    xhr.send(body ? JSON.stringify(body) : undefined);
}

export const Http = {
    get(url: string, cb: Callback) { httpJson(url, 'GET', null, cb); },
    post(url: string, body: object, cb: Callback) { httpJson(url, 'POST', body, cb); },
};

// ============================================================
// 农场游戏 API（从 farm/net/UserApi.ts 合并而来，减少重复网络文件）
// 复用 login/Net 的 Http / SERVER
// ============================================================

/** 拉取玩家状态后统一整理成这个结构喂给 GameRoot */
export interface RemoteUserState {
  username: string | null;
  gold: number;
  inventory: any[];  // InventoryStack[] ; 避免循环依赖，运行时为 farm/data/ItemData 中的
}

/** 游戏状态 API（与后端 /api/game/* 对接） */
export class UserApi {
  constructor(private base: string = SERVER.baseUrl) {}

  private async getJSON<T>(path: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`);
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    return (await res.json()) as T;
  }

  /** 拉取玩家状态（用户名 + 金币 + 背包） */
  async fetchState(id: string | number): Promise<RemoteUserState> {
    const j = await this.getJSON<any>(`/api/game/state?user_id=${encodeURIComponent(id)}`);
    const d = (j && (j.data ?? j)) || {};

    // 金币字段名容错
    const goldRaw = d.gold ?? d.coins ?? d.user?.gold ?? d.user?.coins;

    const rows: any[] = Array.isArray(d.inventory) ? d.inventory : [];
    const inventory = rows.map((row: any) => toStack(row)).filter((s: any): s is any => !!s && s.count > 0);

    return {
      username: d.username ?? d.user?.username ?? null,
      gold: typeof goldRaw === 'number' && isFinite(goldRaw) ? goldRaw : 500,
      inventory,
    };
  }

  /** 整包保存背包（购买 / 出售后立即调用）。gold 一并上送 */
  async saveInventory(id: string | number, gold: number, inventory: any[]): Promise<void> {
    const res = await fetch(`${this.base}/api/game/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: id,
        gold,
        inventory: inventory.map(toRow),
      }),
    });
    if (!res.ok) throw new Error(`POST /api/game/inventory -> ${res.status}`);
  }

  /**
   * 实时验证 + 更新：保存后立即重新拉取服务端权威数据
   * 用于 farm 操作后时时同步验证
   */
  async saveAndSync(id: string | number, gold: number, inventory: any[]): Promise<RemoteUserState> {
    await this.saveInventory(id, gold, inventory);
    // 立即验证并返回最新数据
    return await this.fetchState(id);
  }
}

// ============================================================
// 农场（土地）API：拉取 / 保存 24 块土地状态
// 后端未就绪时由调用方用本地存储兜底（见 GameRoot）
// ============================================================

/** 远端土地状态的约定结构（与 FarmSave 对齐，键名兼容服务端 snake/camel） */
export interface RemoteFarmState {
  plots?: any[];
  lastTick?: number;
}

export class FarmApi {
  constructor(private base: string = SERVER.baseUrl) {}

  /** 拉取玩家土地状态 */
  async fetchState(id: string | number): Promise<RemoteFarmState | null> {
    try {
      const res = await fetch(`${this.base}/api/farm/state?user_id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`GET /api/farm/state -> ${res.status}`);
      const j = await res.json();
      const d = (j && (j.data ?? j)) || {};
      return {
        plots: Array.isArray(d.plots) ? d.plots : undefined,
        lastTick: typeof d.last_tick === 'number' ? d.last_tick
                 : (typeof d.lastTick === 'number' ? d.lastTick : undefined),
      };
    } catch (e) {
      console.warn('[FarmApi] 拉取土地状态失败（使用本地兜底）', e);
      return null;
    }
  }

  /** 保存玩家土地状态 */
  async saveState(id: string | number, save: { plots: any[]; lastTick: number }): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/api/farm/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: id,
          plots: save.plots,
          last_tick: save.lastTick,
        }),
      });
      if (!res.ok) throw new Error(`POST /api/farm/state -> ${res.status}`);
      return true;
    } catch (e) {
      console.warn('[FarmApi] 保存土地状态失败（仅本地兜底）', e);
      return false;
    }
  }
}

/** 数据库行 / 服务端对象 → InventoryStack 容错映射 */
function toStack(row: any): any | null {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.item_id ?? row.id ?? '');
  if (!id) return null;
  const acquired = typeof row.acquired === 'number'
    ? row.acquired
    : (row.acquired_at ? (Date.parse(row.acquired_at) || Date.now()) : Date.now());
  return {
    id,
    name: row.item_name ?? row.name ?? id,
    icon: row.icon ?? '',
    category: row.category ?? 'fruit',
    value: row.value ?? 1,
    count: Math.max(0, Math.floor(Number(row.count) || 0)),
    acquired,
  };
}

/** 运行时 → 数据库行 */
function toRow(s: any) {
  return {
    item_id: s.id,
    item_name: s.name,
    icon: s.icon,
    category: s.category,
    count: s.count,
    value: s.value,
    acquired_at: new Date(s.acquired).toISOString(),
  };
}