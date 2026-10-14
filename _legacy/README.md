# Legacy：合成放置求生（已停用）

本目录保留改造前的合成放置玩法代码（`data.js` / `render.js` / `fx.js` / `ad.js` / `app.js`），**不进入**当前 `game.js` 编译路径。

- 新玩法入口：仓库根目录 `game.js` → 脑洞关卡 IAA
- `Game.Config.LEGACY_ENABLED` 默认为 `false`
- 旧存档 key：`islandSave_v1`（与新档 `brain_v1` 隔离）

仅作回滚参考，请勿在主包 `require` 本目录。
