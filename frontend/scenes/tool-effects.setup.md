# farm 场景工具光标与动画配置

> 本说明是 `farm.scene.md` 的补充。以下节点放在 `Canvas/Camera` 下，与 `lands` 同级。

## 1. 场景节点

```text
Canvas
└─Camera
  ├─lands
  ├─ToolEffectLayer
  │ ├─WaterEffectTemplate       [inactive]
  │ ├─FertilizerEffectTemplate  [inactive]
  │ ├─HarvestEffectTemplate     [inactive]
  │ └─ShovelEffectTemplate      [inactive]
  ├─TopBar / LeftBar / RightBar
  ├─ToolCursorLayer
  ├─Toast
  └─BackpackPanel / ShopPanel
```

Sibling 顺序建议：

1. `lands`；
2. `ToolEffectLayer`，保证动画覆盖土地；
3. HUD；
4. `ToolCursorLayer`，保证跟随图标可见；
5. Toast 和弹窗。

`ToolCursorLayer` 保持空节点即可。选择工具后，`LandView` 会复制 LeftBar 对应按钮中 Sprite 的 `spriteFrame`，自动生成 `ToolCursor`，设置 `UIOpacity=179`（约 70%），并跟随鼠标或触摸位置。该节点不要添加 Button、BlockInputEvents。

## 2. 四个动画模板

每个 `*EffectTemplate`：

- 默认 `active=false`；
- 根节点锚点为中心 `(0.5, 0.5)`，局部坐标 `(0, 0)` 就是动画中心；
- 添加 `Sprite`（或动画所需的渲染组件）；
- 添加 `Animation`；
- 设置一个 `defaultClip`；
- `Play On Load=false`；
- AnimationClip 使用单次播放，禁止 Loop；
- 动画内容围绕模板根节点 `(0, 0)` 制作。

操作成功后，代码会克隆对应模板，把模板根节点的世界坐标设置为**土地节点中心**，播放默认 Clip，并在 `clip.duration` 后销毁克隆。代码没有任何水滴、肥雾、弹跳或飘字兜底动画；未提供模板时只输出缺失提示。

对应关系：

| 工具 | 场景模板 | 建议 Clip |
|---|---|---|
| 浇水 | `WaterEffectTemplate` | `water_effect.anim` |
| 施肥 | `FertilizerEffectTemplate` | `fertilizer_effect.anim` |
| 采摘 | `HarvestEffectTemplate` | `harvest_effect.anim` |
| 铲子 | `ShovelEffectTemplate` | `shovel_effect.anim` |

## 3. 资源位置

正常情况下直接复用 LeftBar 的 `nav_water/nav_fertilizer/nav_harvest/nav_shovel` Sprite，不需要复制图片。如果某个 LeftBar 按钮没有 Sprite，代码才会按以下路径加载备用光标：

```text
assets/resources/farm/tools/
├─cursor_water.png
├─cursor_fertilizer.png
├─cursor_harvest.png
└─cursor_shovel.png
```

动画资源建议放在：

```text
assets/resources/farm/effects/
├─water/
│ ├─water_effect.anim
│ └─frames/...
├─fertilizer/
│ ├─fertilizer_effect.anim
│ └─frames/...
├─harvest/
│ ├─harvest_effect.anim
│ └─frames/...
└─shovel/
  ├─shovel_effect.anim
  └─frames/...
```

动画 Clip 可以引用同目录 SpriteFrame。将 Clip 拖给场景中对应模板的 `Animation/defaultClip`；代码不按路径加载动画，因此后续可以自由更换 Clip，不需要改 TypeScript。

## 4. 验收

- 点击 LeftBar 的四个工具，出现对应 70% 透明跟随图标；
- 再次点击同一工具，取消模式并隐藏图标；
- 点击未开发土地不会误扣开发金币；
- 操作成功后，动画中心与被点击土地中心一致；
- 施肥先弹出化肥选择，选择且服务端确认成功后才播放动画；
- 未成熟作物不能采摘；空地不能使用铲子；
- 缺失动画模板时业务仍成功，但控制台明确提示缺少哪个模板。
