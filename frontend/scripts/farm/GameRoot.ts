/**
 * GameRoot.ts —— 顶层装配（农场场景主逻辑，完全基于 farm.scene 布局）
 */
import { _decorator, Button, Component, Label, Node, ResolutionPolicy, sys, view } from 'cc';
import { InventoryModel } from './data/InventoryModel';
import { PlayerModel } from './data/PlayerModel';
import { FarmModel } from './data/FarmModel';
import { INITIAL_GOLD, buildInitialInventory } from './config/ItemConfig';
import { BackpackPanel } from './ui/BackpackPanel';
import { ShopPanel } from './ui/ShopPanel';
import { Toast } from './ui/Toast';
import { LandView } from './ui/LandView';
import { UserApi, FarmApi, RemoteUserState, LOGIN_UID_KEY, LOGIN_NAME_KEY } from '../login/Net';

const { ccclass, property } = _decorator;

export const DESIGN_W = 1280;
export const DESIGN_H = 720;
const DEMO_USER_ID = 1;

@ccclass('GameRoot')
export class GameRoot extends Component {
  @property({ type: Node }) public backpackButton: Node | null = null;
  @property({ type: Node }) public shopButton: Node | null = null;
  @property({ type: Node }) public backpackPanelNode: Node | null = null;
  @property({ type: Node }) public shopPanelNode: Node | null = null;
  @property({ type: Node }) public goldLabelNode: Node | null = null;
  @property({ type: Node }) public toastNode: Node | null = null;

  private player    = new PlayerModel(INITIAL_GOLD);
  private inventory = new InventoryModel();
  private api       = new UserApi();
  private farmApi   = new FarmApi();
  private farm      = new FarmModel();
  private landView: LandView | null = null;
  private userId: string | number = DEMO_USER_ID;

  private goldLabel: Label | null = null;
  private levelLabel: Label | null = null;
  private toast: Toast | null = null;
  private backpack: BackpackPanel | null = null;
  private shop: ShopPanel | null = null;

  private static FARM_SAVE_KEY = 'farm_state_';

  async onLoad() {
    view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_HEIGHT);

    const savedId   = sys.localStorage.getItem(LOGIN_UID_KEY);
    const savedName = sys.localStorage.getItem(LOGIN_NAME_KEY);
    if (savedId) {
      const n = Number(savedId);
      this.userId = isNaN(n) ? savedId : n;
    }
    if (savedName) this.player.username = savedName;

    this.bindSceneNodes();

    const onGold  = (g: number) => { if (this.goldLabel) this.goldLabel.string = '💰 ' + g; };
    const onToast = (m: string, d = 1.2) => this.toast?.show(m, d);

    const persist = async () => {
      try {
        const latest: RemoteUserState = await this.api.saveAndSync(
          this.userId, this.player.gold, this.inventory.toJSON()
        );
        this.player.gold = latest.gold;
        if (latest.inventory && latest.inventory.length > 0) {
          this.inventory.loadJSON(latest.inventory);
        }
        onGold(this.player.gold);

        if (this.backpack?.isOpen) this.backpack.render();
        if (this.shop?.isOpen)     this.shop.render();
      } catch (err) {
        console.warn('[GameRoot] 实时保存/同步失败', err);
        this.api.saveInventory(this.userId, this.player.gold, this.inventory.toJSON())
          .catch(() => {});
      }
    };

    if (this.backpack) {
      this.backpack.onGoldChanged = onGold;
      this.backpack.onToast       = onToast;
      this.backpack.onChanged     = persist;
    }
    if (this.shop) {
      this.shop.onGoldChanged     = onGold;
      this.shop.onToast           = onToast;
      this.shop.onChanged         = persist;
    }

    try {
      const s = await this.api.fetchState(this.userId);
      this.player.bindUser(String(this.userId), s.username ?? savedName);
      this.player.gold = s.gold;
      if (s.inventory.length > 0) {
        this.inventory.loadJSON(s.inventory);
      } else {
        this.inventory.loadJSON(buildInitialInventory());
        persist();
      }
    } catch (e) {
      console.warn('[GameRoot] 后端不可用，使用本地存档', e);
      const localInv = this.readLocalInventory();
      if (localInv.length > 0) {
        this.inventory.loadJSON(localInv);
      } else {
        this.inventory.loadJSON(buildInitialInventory());
      }
      const localGold = sys.localStorage.getItem(this.inventoryKey() + '_gold');
      const g = localGold ? Number(localGold) : NaN;
      if (isFinite(g)) this.player.gold = g;
    }
    onGold(this.player.gold);

    // 农场土地：读档 → 补算离线时间 → 渲染
    this.loadFarmState();
    this.farm.updateModel(Date.now());
    this.refreshLevelLabel();
    if (this.landView) this.landView.render();
  }

  // ===== 农场相关 =====

  private farmStorageKey(): string {
    return GameRoot.FARM_SAVE_KEY + String(this.userId);
  }

  private loadFarmState() {
    // 1) 先读本地玩家等级/经验
    try {
      const p = JSON.parse(sys.localStorage.getItem(this.farmStorageKey() + '_p') || 'null');
      if (p) this.player.loadJSON({ level: p.level, exp: p.exp, energy: p.energy });
    } catch (e) { /* ignore */ }

    // 2) 尝试从后端拉取（失败则用本地兜底）
    this.farmApi.fetchState(this.userId).then((remote) => {
      if (remote && Array.isArray(remote.plots) && remote.plots.length > 0) {
        this.farm.loadJSON({ plots: remote.plots, lastTick: remote.lastTick ?? Date.now() });
      } else {
        this.loadFarmLocal();
      }
      this.farm.updateModel(Date.now());
      if (this.landView) this.landView.render();
    }).catch(() => this.loadFarmLocal());
  }

  private inventoryKey(): string {
    return 'farm_inv_' + String(this.userId);
  }

  private readLocalInventory(): any[] {
    try {
      const raw = sys.localStorage.getItem(this.inventoryKey());
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  private loadFarmLocal() {
    try {
      const raw = sys.localStorage.getItem(this.farmStorageKey());
      if (raw) this.farm.loadJSON(JSON.parse(raw));
    } catch (e) {
      this.farm.reset();
    }
  }

  private persistFarm() {
    try {
      sys.localStorage.setItem(this.farmStorageKey(), JSON.stringify(this.farm.toJSON()));
      sys.localStorage.setItem(
        this.farmStorageKey() + '_p',
        JSON.stringify({ level: this.player.level, exp: this.player.exp, energy: this.player.energy }),
      );
      // 种植/施肥会消耗背包，一并本地存档
      sys.localStorage.setItem(this.inventoryKey(), JSON.stringify(this.inventory.toJSON()));
      sys.localStorage.setItem(this.inventoryKey() + '_gold', String(this.player.gold));
    } catch (e) { /* ignore */ }
    // 尽量同步到后端（失败静默）
    this.farmApi.saveState(this.userId, this.farm.toJSON()).catch(() => {});
  }

  private refreshLevelLabel() {
    if (this.levelLabel) {
      this.levelLabel.string = `Lv.${this.player.level}`;
    }
  }

  private bindToolButton(leftBar: Node, childName: string, mode: 'water' | 'fert') {
    const btn = leftBar.getChildByName(childName);
    if (!btn) return;
    const comp = btn.getComponent(Button) || btn.addComponent(Button);
    if (comp) {
      comp.transition = Button.Transition.SCALE;
      comp.zoomScale = 0.92;
    }
    btn.off(Button.EventType.CLICK);
    btn.on(Button.EventType.CLICK, () => {
      if (!this.landView) return;
      const next = this.landView.currentTool === mode ? 'none' : mode;
      this.landView.setTool(next);
      if (next === 'none') this.toast?.show('已取消工具');
    });
  }

  private findNode(root: Node | null, name: string): Node | null {
    if (!root) return null;
    if (root.name === name) return root;
    for (const child of root.children) {
      const found = this.findNode(child, name);
      if (found) return found;
    }
    return null;
  }

  private getSearchRoot(): Node {
    return this.node?.scene || this.node;
  }

  private bindSceneNodes() {
    const root = this.getSearchRoot();

    // 金币 Label
    const goldNode = this.goldLabelNode || this.findNode(root, 'CoinsLabel') || this.findNode(root, 'gold_hud');
    if (goldNode) {
      this.goldLabel = goldNode.getComponent(Label) || goldNode.getComponentInChildren(Label);
    }

    // 商店按钮
    const shopBtn = this.shopButton || this.findNode(root, 'ShopBtn') || this.findNode(root, 'btn_shop_btn');
    if (shopBtn) {
      const btn = shopBtn.getComponent(Button) || shopBtn.addComponent(Button);
      if (btn) {
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.92;
      }
      shopBtn.off(Button.EventType.CLICK);
      shopBtn.on(Button.EventType.CLICK, () => this.openShop());
    }

    // 背包按钮
    const bpBtn = this.backpackButton || this.findNode(root, 'BackpackBtn') || this.findNode(root, 'btn_open_btn');
    if (bpBtn) {
      const btn = bpBtn.getComponent(Button) || bpBtn.addComponent(Button);
      if (btn) {
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.92;
      }
      bpBtn.off(Button.EventType.CLICK);
      bpBtn.on(Button.EventType.CLICK, () => this.openBackpack());
    }

    // Toast
    const toastN = this.toastNode || this.findNode(root, 'Toast');
    if (toastN) {
      this.toast = toastN.getComponent(Toast) || toastN.addComponent(Toast);
    }

    // 等级 Label
    const levelNode = this.findNode(root, 'LevelLabel');
    if (levelNode) {
      this.levelLabel = levelNode.getComponent(Label) || levelNode.getComponentInChildren(Label);
    }

    // ===== 农场土地 =====
    const lands = this.findNode(root, 'lands');
    if (lands) {
      this.landView = lands.getComponent(LandView) || lands.addComponent(LandView);
      if (this.landView) {
        this.landView.farm = this.farm;
        this.landView.player = this.player;
        this.landView.inventory = this.inventory;
        this.landView.onToast = (m, d) => this.toast?.show(m, d);
        this.landView.onGoldChanged = (g) => { if (this.goldLabel) this.goldLabel.string = '💰 ' + g; };
        this.landView.onExpChanged = (lv) => this.refreshLevelLabel();
        this.landView.onPersist = () => this.persistFarm();
      }
    }

    // ===== 左侧工具栏：浇水 / 施肥 =====
    const leftBar = this.findNode(root, 'LefttBar');
    if (leftBar) {
      this.bindToolButton(leftBar, 'Water', 'water');
      this.bindToolButton(leftBar, 'Fertilizer', 'fert');
    }

    // 背包面板
    const bpPanel = this.backpackPanelNode || this.findNode(root, 'BackpackPanel');
    if (bpPanel) {
      this.backpack = bpPanel.getComponent(BackpackPanel) || bpPanel.addComponent(BackpackPanel);
      if (this.backpack) {
        this.backpack.inventory = this.inventory;
        this.backpack.player = this.player;
      }
    }

    // 商店面板
    const shopPanel = this.shopPanelNode || this.findNode(root, 'ShopPanel');
    if (shopPanel) {
      this.shop = shopPanel.getComponent(ShopPanel) || shopPanel.addComponent(ShopPanel);
      if (this.shop) {
        this.shop.inventory = this.inventory;
        this.shop.player = this.player;
      }
    }
  }

  private openBackpack() {
    if (this.shop?.isOpen) this.shop.close();
    this.backpack?.open();
  }

  private openShop() {
    if (this.backpack?.isOpen) this.backpack.close();
    this.shop?.open();
  }
}
