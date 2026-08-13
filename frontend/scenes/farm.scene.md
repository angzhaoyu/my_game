# farm 场景节点契约

> `GameRoot` 将服务端快照投影到这些节点。商店/背包/地块 UI 只能发送语义命令，禁止直接修改金币后整包保存。新场景优先用 `@property` 拖拽绑定，节点名查找仅用于兼容。

Canvas  挂载了GameRoot.ts
├─bg_ground  Sprite  背景图片。
├─Camera  相机。
  ├─lands Node  地地节点。下面的1234都是一个结构。
    ├─lands_1 Node  
      └─1~6 Sprite *6  地地图片，一共有6个图片。
    ├─lands_2 Node   
    ├─lands_3 Node  
    └─lands_4 Node  

  ├─TopBar Node  存储着玩家信息。
    └─ PlayerInfoSection  
        ├─ ExpBar  Sprite
           ├─ Bar  Sprite   经验条进度条
           └─ LevelLabel  等级，例如Lv.8
        ├─ AvatarMask  Mask  头像遮罩
           └─ AvatarSprite  Sprite  头像
    ├─ GoldHud  Node
       ├─ BgSprite  Sprite  金币HUD背景
       ├─ CoinsIcon  Sprite  金币图标
       └─ CoinsLabel  Label  金币数量
    ├─ DiamondsSection  Node 砖石节点
       ├─ BgSprite
       ├─ DiamondsIcon
       └─ DiamondsLabel
    └─ Energy  Node 能量节点。能量条。偷好友东西需要能量。会减少。
        ├─ BgSprite
        ├─ EnergyIcon
        └─ EnergyLabel

  ├─LeftBar Node  左侧栏节点。
    ├─ BgSprite  Sprite  左侧栏背景
    ├─ ShopBtn  Node  商店按钮节点。
       ├─ ShopBtn  Button  商店按钮
       └─ Shop  Sprite  商店按钮图片
    ├─ BackpackBtn  Node  背包按钮节点。
       ├─ BackpackBtn
       └─ Bag
    ├─ Water  浇水。 这个和后面的按钮我暂没有实现。
    ├─ Shovel  挖掘。
    ├─ Harvest  收获。
    ├─ Fertilizer  肥料。
    ├─ expand  Button  展开按钮。
    └─ collapse  Button  收起按钮。

  ├─RightBar Node  右侧栏节点。
    ├─ BgSprite  Sprite  右侧栏背景
    └─ Friend  Node  好友节点。还未实现。

  ├─Toast Node  提示节点。挂载了Toast.ts。
    └─ ToastLabel  Label  提示标签。

  ├─BackpackPanel Sprite  背包面板。用4A7A52D5作为背景。挂载了BackpackPanel.ts。
    └─ Panel  背包面板节点。用5A7A33作为背景，挂载了panel图片。
    ├─ header  Sprite  头部。
       ├─ Title  Label  标题，农 场 背 包
       └─ CloseBth  Button  关闭按钮
    ├─ toolbar  Sprite  工具栏。用于切换不同的物品的背包视图。
       ├─ tab  Sprite  全部。
           └─ Label  Label  全部
       ├─ tab-001 种子
       ├─ tab-002 果实
       ├─ tab-003 化肥
       ├─ lb_排序  Label  排序
       ├─ btn_时间  Button  时间按钮
       └─ btn_名称  Button  名称按钮
    ├─ ScrollView  ScrollView  滚动视图。
       └─ view  Mask  视图遮罩。
            └─ content  Node  内容节点。用于存储物品单元格。
                 └─ CellItem*100  预制体，有100个。
    └─ footer  Sprite  底部。
        ├─ lb_footer  Label  底部提示
        └─ lb_hint  Label  提示

  ├─ShopPanel  商店面板与backpackpanel结构类似。
    └─ Panel
    ├─ header
    ├─ toolbar
    │  ├─ tab
    │  ├─ tab-001
    │  └─ lb_排序
    ├─ ScrollView
    │  └─ view
    │     └─ content
    └─ footer


以下是预制体。
CellItem  
├─ cell_bg  Sprite  单元格背景
├─ icon  Sprite  物品图标
├─ lb_name  Label  物品名称
├─ lb_count  Label  物品数量
└─ btn_sell_badge  Button  出售标签
   └─ Label  Label  "出售"

ShopItem
├─ cell_bg  Sprite  单元格背景
├─ icon  Sprite  物品图标
├─ lb_name  Label  物品名称
├─ lb_price  Label  价格
├─ lb_recycle  Label  回收值
└─ btn_buy  Button  购买按钮
   └─ lb_buy_text  Label  "购买"


