// ============================================================
// 网络请求封装：自动适配两种环境
//   1) 微信小游戏：wx.request
//   2) 浏览器 / Cocos 预览：XMLHttpRequest
// 后端接口返回统一格式：{ success, message?, user?, regions? }
// ============================================================

export interface UserInfo {
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
