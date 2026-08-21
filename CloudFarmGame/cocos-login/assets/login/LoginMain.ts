// ============================================================
// 星域传说 · 登录界面（Cocos Creator 3.8 / TypeScript）
// 功能：账号密码登录 + 大区选择 + 注册 + 游戏主页（金币/等级/经验/钻石）
// 对接后端：Flask + MySQL 的 /api/login /api/register /api/regions
//
// 使用：把本组件挂到场景的 Canvas 节点上即可，UI 全部由代码生成。
// ============================================================

import { _decorator, Button, Color, Component, EditBox, Graphics, Label, Layers, Node, ResolutionPolicy, sys, UITransform, view } from 'cc';
import { Http, UserInfo } from './Net';
import { SERVER } from './ServerConfig';

const { ccclass } = _decorator;

const DW = 1280;   // 设计分辨率（横屏）
const DH = 720;

const CLR = {
    bg:       new Color(6, 9, 24, 255),
    panel:    new Color(14, 20, 50, 235),
    border:   new Color(74, 96, 170, 255),
    gold:     new Color(255, 215, 106, 255),
    goldBtn:  new Color(255, 226, 140, 255),
    goldDark: new Color(178, 116, 24, 255),
    input:    new Color(10, 15, 41, 255),
    white:    new Color(235, 240, 255, 255),
    muted:    new Color(140, 158, 196, 255),
    red:      new Color(255, 96, 110, 255),
    cyan:     new Color(62, 226, 255, 255),
    blue:     new Color(100, 120, 255, 255),
    textDark: new Color(58, 36, 5, 255),
};

// ---------------- UI 构建小工具 ----------------

function ui(name: string, parent: Node, x: number, y: number, w: number, h: number): Node {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    const ut = n.addComponent(UITransform);
    ut.setContentSize(w, h);
    parent.addChild(n);
    n.setPosition(x, y);
    return n;
}

function label(parent: Node, text: string, size: number, color: Color,
               x: number, y: number, w: number, h: number, left = false): Label {
    const n = ui('label_' + text.replace(/\s/g, '').slice(0, 8), parent, x, y, w, h);
    const lb = n.addComponent(Label);
    lb.string = text;
    lb.fontSize = size;
    lb.lineHeight = Math.round(size * 1.25);
    lb.color = color;
    lb.horizontalAlign = left ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    return lb;
}

/** 画一个圆角矩形底（Graphics 纯代码绘制，不需要任何图片资源） */
function box(parent: Node, x: number, y: number, w: number, h: number,
             fill: Color, radius = 12, stroke?: Color): Node {
    const n = ui('box', parent, x, y, w, h);
    const g = n.addComponent(Graphics);
    g.fillColor = fill;
    g.roundRect(-w / 2, -h / 2, w, h, Math.min(radius, w / 2, h / 2));
    g.fill();
    if (stroke) {
        g.lineWidth = 2;
        g.strokeColor = stroke;
        g.stroke();
    }
    return n;
}

function button(parent: Node, x: number, y: number, w: number, h: number,
                text: string, cb: () => void, gold = false, fontSize = 22): Node {
    const n = box(parent, x, y, w, h, gold ? CLR.goldBtn : CLR.panel, 12, gold ? CLR.goldDark : CLR.border);
    label(n, text, fontSize, gold ? CLR.textDark : CLR.white, 0, 0, w, h);
    const b = n.addComponent(Button);
    b.transition = Button.Transition.SCALE;
    b.zoomScale = 0.96;
    n.on(Button.EventType.CLICK, cb);
    return n;
}

function edit(parent: Node, x: number, y: number, w: number, h: number,
              placeholder: string, isPwd = false): EditBox {
    const n = box(parent, x, y, w, h, CLR.input, 10, CLR.border);
    const e = n.addComponent(EditBox);
    e.placeholder = placeholder;
    e.maxLength = isPwd ? 20 : 16;
    e.inputMode = EditBox.InputMode.SINGLE_LINE;
    e.returnType = EditBox.KeyboardReturnType.DONE;
    if (isPwd) e.inputFlag = EditBox.InputFlag.PASSWORD;

    const tn = ui('TEXT_LABEL', n, 0, 0, w - 30, h);
    const t = tn.addComponent(Label);
    t.fontSize = 24; t.lineHeight = 30; t.color = CLR.white;
    t.horizontalAlign = Label.HorizontalAlign.LEFT;
    t.verticalAlign = Label.VerticalAlign.CENTER;
    e.textLabel = t;

    const pn = ui('PLACEHOLDER_LABEL', n, 0, 0, w - 30, h);
    const p = pn.addComponent(Label);
    p.fontSize = 24; p.lineHeight = 30; p.color = CLR.muted;
    p.horizontalAlign = Label.HorizontalAlign.LEFT;
    p.verticalAlign = Label.VerticalAlign.CENTER;
    e.placeholderLabel = p;
    return e;
}

// ---------------- 主组件 ----------------

@ccclass('LoginMain')
export class LoginMain extends Component {

    private regions: string[] = ['大区一 · 电信', '大区二 · 网通', '大区三 · 移动'];
    private region = '大区一 · 电信';

    private pageLogin!: Node;
    private pageReg!: Node;
    private pageHome!: Node;
    private popup!: Node;
    private regionList!: Node;
    private toastBox!: Node;

    private accEdit!: EditBox;
    private pwdEdit!: EditBox;
    private regionLabel!: Label;
    private loginError!: Label;

    private regAccEdit!: EditBox;
    private regPwdEdit!: EditBox;
    private regPwd2Edit!: EditBox;
    private regRegionLabel!: Label;
    private regError!: Label;

    private rememberLabel!: Label;
    private rememberOn = true;

    private homeName!: Label;
    private homeRegion!: Label;
    private homeLevel!: Label;
    private homeCoins!: Label;
    private homeDiamonds!: Label;
    private homeExpText!: Label;
    private expFill!: Graphics;
    private toast!: Label;

    // ==================== 初始化 ====================

    onLoad() {
        view.setDesignResolutionSize(DW, DH, ResolutionPolicy.FIXED_HEIGHT);

        this.buildBackground();
        this.pageLogin = this.buildLoginPage();
        this.pageReg = this.buildRegPage();
        this.pageHome = this.buildHomePage();
        this.popup = this.buildRegionPopup();
        this.buildToast();

        this.showPage(this.pageLogin);
        this.loadRemember();

        // 从后端拉取大区列表（失败则用默认三个）
        Http.get(SERVER.baseUrl + '/api/regions', (code, data) => {
            if (data && data.success && data.regions && data.regions.length > 0) {
                this.regions = data.regions;
                this.refreshRegionLabel();
            }
        });
    }

    // ==================== 背景 ====================

    private buildBackground() {
        const root = this.node;
        const bg = ui('bg', root, 0, 0, DW, DH);
        const g = bg.addComponent(Graphics);
        g.fillColor = CLR.bg;
        g.rect(-DW / 2, -DH / 2, DW, DH);
        g.fill();

        // 星星
        for (let i = 0; i < 46; i++) {
            const s = ui('star', root, Math.random() * DW - DW / 2, Math.random() * DH - DH / 2, 4, 4);
            const sg = s.addComponent(Graphics);
            sg.fillColor = new Color(255, 255, 255, 40 + Math.floor(Math.random() * 160));
            sg.circle(0, 0, 0.8 + Math.random() * 1.6);
            sg.fill();
        }

        label(root, '星域传说', 68, CLR.gold, 0, 238, 700, 90);
        label(root, 'STAR REALM LEGENDS · 横屏登录', 18, CLR.muted, 0, 176, 700, 30);
        label(root, 'v1.0.0 · Cocos 版', 14, CLR.muted, 520, -320, 220, 30);
        label(root, '对接 Flask + MySQL 后端', 14, CLR.muted, -520, -320, 300, 30, true);
    }

    // ==================== 登录页 ====================

    private buildLoginPage(): Node {
        const page = ui('page_login', this.node, 0, 0, DW, DH);
        const panel = box(page, 0, -40, 500, 470, CLR.panel, 16, CLR.border);
        label(panel, '账 号 登 录', 26, CLR.gold, 0, 196, 400, 40);

        this.accEdit = edit(panel, 0, 108, 440, 58, '请输入游戏账号');
        this.pwdEdit = edit(panel, 0, 32, 440, 58, '请输入密码', true);

        // 大区选择（点击弹出大区列表）
        const regionBtn = box(panel, 0, -44, 440, 58, CLR.input, 10, CLR.border);
        this.regionLabel = label(regionBtn, '大区：' + this.region, 22, CLR.white, 0, 0, 440, 58);
        const rb = regionBtn.addComponent(Button);
        rb.transition = Button.Transition.SCALE;
        rb.zoomScale = 0.96;
        regionBtn.on(Button.EventType.CLICK, () => this.openPopup());

        // 错误提示
        this.loginError = label(panel, '', 18, CLR.red, 0, -96, 440, 30);
        this.loginError.node.active = false;

        // 登录按钮
        button(panel, 0, -152, 440, 62, '登  录', () => this.onLogin(), true, 26);

        // 记住账号 + 注册链接
        this.rememberLabel = label(panel, '☑ 记住账号', 16, CLR.muted, -120, -218, 170, 30);
        this.rememberLabel.node.addComponent(Button).transition = Button.Transition.NONE;
        this.rememberLabel.node.on(Button.EventType.CLICK, () => this.toggleRemember());

        const regLink = label(panel, '注册新账号 →', 16, CLR.cyan, 130, -218, 160, 30);
        regLink.node.addComponent(Button).transition = Button.Transition.NONE;
        regLink.node.on(Button.EventType.CLICK, () => this.showPage(this.pageReg));
        return page;
    }

    // ==================== 注册页 ====================

    private buildRegPage(): Node {
        const page = ui('page_reg', this.node, 0, 0, DW, DH);
        const panel = box(page, 0, 0, 500, 520, CLR.panel, 16, CLR.border);
        label(panel, '注 册 新 账 号', 26, CLR.gold, 0, 220, 400, 40);

        this.regAccEdit = edit(panel, 0, 136, 440, 56, '账号（3-16位，字母/数字/下划线/中文）');
        this.regPwdEdit = edit(panel, 0, 62, 440, 56, '密码（6-20位）', true);
        this.regPwd2Edit = edit(panel, 0, -12, 440, 56, '确认密码', true);

        const regionBtn = box(panel, 0, -86, 440, 56, CLR.input, 10, CLR.border);
        this.regRegionLabel = label(regionBtn, '大区：' + this.region, 22, CLR.white, 0, 0, 440, 56);
        const rb = regionBtn.addComponent(Button);
        rb.transition = Button.Transition.SCALE;
        rb.zoomScale = 0.96;
        regionBtn.on(Button.EventType.CLICK, () => this.openPopup());

        this.regError = label(panel, '', 18, CLR.red, 0, -140, 440, 28);
        this.regError.node.active = false;

        button(panel, 0, -200, 440, 60, '注  册', () => this.onRegister(), true, 26);

        const back = label(panel, '← 返回登录', 16, CLR.cyan, 0, -258, 200, 28);
        back.node.addComponent(Button).transition = Button.Transition.NONE;
        back.node.on(Button.EventType.CLICK, () => this.showPage(this.pageLogin));
        return page;
    }

    // ==================== 游戏主页（登录成功） ====================

    private buildHomePage(): Node {
        const page = ui('page_home', this.node, 0, 0, DW, DH);

        this.homeName = label(page, '玩家 —', 30, CLR.white, -470, 300, 300, 44, true);
        this.homeRegion = label(page, '', 16, CLR.gold, -470, 262, 300, 26, true);
        label(page, '✦ 欢迎回来，愿星辰指引你的征途 ✦', 20, CLR.gold, 0, 250, 700, 36);
        button(page, 470, 300, 130, 44, '退出登录', () => this.onLogout(), false, 18);

        this.homeLevel = this.statCard(page, -290, 60, '等 级', 'LEVEL', CLR.blue);
        this.homeCoins = this.statCard(page, 290, 60, '金 币', 'COINS', CLR.gold);
        this.homeDiamonds = this.statCard(page, -290, -110, '钻 石', 'DIAMONDS', CLR.cyan);

        // 经验卡（含经验条）
        const expCard = box(page, 290, -110, 320, 130, CLR.panel, 14, CLR.border);
        label(expCard, '经 验', 14, CLR.muted, -120, 38, 120, 24, true);
        this.homeExpText = label(expCard, 'EXP 0 / 0', 18, CLR.cyan, 110, 38, 180, 26, true);
        const barBg = box(expCard, 0, -12, 280, 18, CLR.input, 9, CLR.border);
        this.expFill = ui('exp_fill', barBg, 0, 0, 280, 18).addComponent(Graphics);
        return page;
    }

    private statCard(parent: Node, x: number, y: number, title: string, en: string, color: Color): Label {
        const card = box(parent, x, y, 320, 130, CLR.panel, 14, CLR.border);
        label(card, en, 12, CLR.muted, -120, 38, 160, 22, true);
        const v = label(card, '0', 40, color, 0, -16, 300, 48);
        label(card, title, 14, CLR.muted, 120, 38, 120, 22, true);
        return v;
    }

    // ==================== 大区选择弹窗 ====================

    private buildRegionPopup(): Node {
        const overlay = ui('popup', this.node, 0, 0, DW, DH);
        const g = overlay.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 170);
        g.rect(-DW / 2, -DH / 2, DW, DH);
        g.fill();
        overlay.on(Node.EventType.TOUCH_END, () => this.closePopup());

        const boxN = box(overlay, 0, 0, 420, 360, CLR.panel, 16, CLR.border);
        label(boxN, '选 择 大 区', 26, CLR.gold, 0, 140, 320, 40);
        this.regionList = ui('region_list', boxN, 0, -10, 420, 300);
        overlay.active = false;
        return overlay;
    }

    private openPopup() {
        this.regionList.destroyAllChildren();
        this.regions.forEach((r, i) => {
            button(this.regionList, 0, 50 - i * 76, 360, 60, r,
                () => { this.region = r; this.refreshRegionLabel(); this.closePopup(); }, false, 22);
        });
        this.popup.active = true;
    }

    private closePopup() { this.popup.active = false; }

    private refreshRegionLabel() {
        if (this.regionLabel) this.regionLabel.string = '大区：' + this.region;
        if (this.regRegionLabel) this.regRegionLabel.string = '大区：' + this.region;
    }

    // ==================== Toast ====================

    private buildToast() {
        const tb = box(this.node, 0, 300, 460, 52, CLR.goldBtn, 26);
        this.toast = label(tb, '', 22, CLR.textDark, 0, 0, 460, 52);
        tb.active = false;
        this.toastBox = tb;
    }

    private showToast(msg: string) {
        this.toast.string = msg;
        this.toastBox.active = true;
        this.unschedule(this.hideToast);
        this.scheduleOnce(this.hideToast, 2.2);
    }

    private hideToast = () => { this.toastBox.active = false; };

    // ==================== 页面切换 ====================

    private showPage(p: Node) {
        [this.pageLogin, this.pageReg, this.pageHome].forEach(x => { if (x) x.active = x === p; });
    }

    private showError(lb: Label, msg: string) {
        lb.string = '⚠ ' + msg;
        lb.node.active = true;
    }

    // ==================== 登录 ====================

    private onLogin() {
        const acc = this.accEdit.string.trim();
        const pwd = this.pwdEdit.string;
        if (!acc || !pwd) { this.showError(this.loginError, '请输入账号和密码'); return; }
        this.loginError.node.active = false;

        // 与后端 MySQL users 表比对
        Http.post(SERVER.baseUrl + '/api/login', { username: acc, password: pwd, region: this.region }, (code, data) => {
            if (data && data.success && data.user) {
                if (this.rememberOn) {
                    sys.localStorage.setItem('game_remember', JSON.stringify({ acc, region: this.region }));
                }
                this.renderHome(data.user);
                this.showPage(this.pageHome);
            } else {
                this.showError(this.loginError, (data && data.message) || '登录失败，请稍后重试');
            }
        });
    }

    // ==================== 注册 ====================

    private onRegister() {
        const acc = this.regAccEdit.string.trim();
        const pwd = this.regPwdEdit.string;
        const pwd2 = this.regPwd2Edit.string;
        if (!acc || !pwd || !pwd2) { this.showError(this.regError, '请填写完整信息'); return; }
        if (pwd !== pwd2) { this.showError(this.regError, '两次输入的密码不一致'); return; }
        if (acc.length < 3 || acc.length > 16) { this.showError(this.regError, '账号需为 3-16 位字符'); return; }
        if (pwd.length < 6 || pwd.length > 20) { this.showError(this.regError, '密码长度需为 6-20 位'); return; }
        this.regError.node.active = false;

        Http.post(SERVER.baseUrl + '/api/register', { username: acc, password: pwd, region: this.region }, (code, data) => {
            if (data && data.success && data.user) {
                this.accEdit.string = data.user.username;
                this.pwdEdit.string = '';
                this.showPage(this.pageLogin);
                this.showToast('注册成功，请登录！');
            } else {
                this.showError(this.regError, (data && data.message) || '注册失败，请稍后重试');
            }
        });
    }

    // ==================== 游戏主页 ====================

    private renderHome(u: UserInfo) {
        this.homeName.string = '玩家 ' + u.username;
        this.homeRegion.string = u.region;
        this.homeLevel.string = String(u.level);
        this.homeCoins.string = Number(u.coins || 0).toLocaleString();
        this.homeDiamonds.string = Number(u.diamonds || 0).toLocaleString();
        const need = Math.max(1, 500 * (u.level || 1));
        const exp = u.exp || 0;
        this.homeExpText.string = 'EXP ' + exp.toLocaleString() + ' / ' + need.toLocaleString();
        this.expFill.clear();
        this.expFill.fillColor = CLR.cyan;
        const pct = Math.min(1, exp / need);
        this.expFill.rect(-140, -9, 280 * pct, 18);
        this.expFill.fill();
    }

    private onLogout() {
        this.showPage(this.pageLogin);
        this.pwdEdit.string = '';
        this.loginError.node.active = false;
    }

    // ==================== 记住账号 ====================

    private toggleRemember() {
        this.rememberOn = !this.rememberOn;
        this.rememberLabel.string = (this.rememberOn ? '☑ ' : '☐ ') + '记住账号';
    }

    private loadRemember() {
        try {
            const raw = sys.localStorage.getItem('game_remember');
            if (raw) {
                const o = JSON.parse(raw);
                if (o && o.acc) this.accEdit.string = o.acc;
                if (o && o.region) { this.region = o.region; this.refreshRegionLabel(); }
            }
        } catch (e) { /* ignore */ }
    }
}
