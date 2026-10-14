# 绝望岛求生记 · 脑洞关卡 IAA（Canvas 原生）

小游戏名称仍为 **绝望岛求生记**（不改备案/展示名策略）。  
玩法已从「合成放置求生」替换为类「脑子转一下」的 **脑洞闯关 + 现实向 IAA**。

> 一句话：脑子转一下，在岛上活下去。

## 玩法循环

大厅（继续 / 分享）→ 加载关卡 → 读题 + 场景交互 → 过关吐槽 → 下一关（可插屏）  
卡住：提示 / 跳过（激励视频或每日免费次数）+ **轻分享**（+提示，禁止强制分享才能过关）

### 交互类型（MVP 三种）

| type | 说明 |
|------|------|
| `tap_find` | 点找物 / 多步点选 |
| `drag_combine` | 拖到目标 / 合并 / 序列拖 |
| `unconventional` | 点题干、摇一摇、拖出屏、旋转设备等 |

关卡数据驱动，禁止一关一套脚本。题库字段见 `levels/`。

## 目录结构

```
├── game.js / game.json          # 入口（竖屏 + 分包）
├── levels/pack0.json|.js        # 主包 lv_001–020
├── levels_pack1/levels/pack1.*  # 分包 lv_021–100
├── js/
│   ├── config.js                # 广告位、免费次数、插屏节奏
│   ├── ad.js                    # 激励 + 插屏（无 Banner）
│   ├── storage.js               # brain_v1 存档
│   ├── level_loader.js          # 主包/分包加载
│   ├── scene_build.js / win.js  # 场景占位 + 通关状态机
│   ├── interactions/            # TapFind / DragCombine / Unconventional
│   ├── scenes/home.js / play.js
│   └── app.js                   # 新主循环
├── images/bg_beach.jpg          # 复用沙滩底图
└── _legacy/                     # 旧合成玩法（默认不引用）
```

## 如何运行（微信开发者工具）

1. 打开微信开发者工具 → 小游戏 → 导入本仓库根目录（含 `game.js`）
2. AppID：测试号或现有小游戏 AppID（**不要改项目展示名策略**）
3. 编译运行
4. 验收建议：
   - 从第 1 关打到第 20 关（主包）无报错
   - 进入第 21 关应触发分包 `levels_pack1` 加载
   - 杀进程重进：进度仍在（`brain_v1`）
   - 提示耗尽：无广告位时 toast 说明；有广告位则拉激励
   - 跳过：写入进度并进下一关
   - 分享卡片文案含关卡号或 `shareHook`
   - 旧合成玩法入口不可达

### 本地冒烟（可选）

```bash
node _brain_smoke.js
```

## 广告配置（开通流量主后）

编辑 `js/config.js`（勿编造 ID，留空即降级）：

```js
REWARD_UNIT: '',              // 激励视频 adunit
INTERSTITIAL_UNIT: '',        // 插屏 adunit
INTERSTITIAL_EVERY: 5,        // 每过 N 关尝试插屏
INTERSTITIAL_COOLDOWN_SEC: 60,
INTERSTITIAL_STARTUP_COOLDOWN_SEC: 30, // 开局禁止立刻插屏
HINT_FREE_DAILY: 5,
SKIP_FREE_DAILY: 2,
SHARE_HINT_DAILY_CAP: 3
```

- 空 ID → `AD.mode = 'none'`：提示/跳过走每日免费次数；插屏 no-op  
- 激励仅在用户主动点「提示/跳过」且 `isEnded` 后发奖  
- **不做 Banner**；**禁止**「不分享不能过关」

## 分包说明

`game.json`：

```json
"subpackages": [{ "name": "levels_pack1", "root": "levels_pack1/" }]
```

- 主包：`levels/pack0.js`（1–20）+ 少量图片  
- 分包：`levels_pack1/levels/pack1.js`（21–100）  
- `level_loader.js` 在进入 ≥21 关或启动预热时 `wx.loadSubpackage`；开发环境若分包失败会回退同仓 `require`

完整题库备份：`levels/levels-100.json`。

## 存档

- 新 key：`brain_v1`（`levelIndex` / `clearedMax` / 每日免费次数 / 分享奖励计数）  
- 旧合成档 `islandSave_v1` 废弃，互不串档  

## 明确不做（本期）

原著深度关、合成棋盘、体力离线、Banner、IAP、排行榜、改名/换 AppID、Cocos 重做。

## 合规

个人主体 IAA；不诱导强制分享；不编造广告位 ID。
