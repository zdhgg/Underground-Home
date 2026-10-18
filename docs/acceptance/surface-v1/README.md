# 风雪地表视觉升级验收

日期：2026-10-18。按用户要求收口，其他视觉细节等待试玩决定。

## 本次内容

- 分层山林远景、积雪树冠/灌木/岩石、积雪入口和暖灯，生成原图与最终提示词见 `src/assets/art/surface/SURFACE_V1.md`。
- `src/render/surfaceScene.ts` 管理静态景色、地表衔接和视差；`surfaceWeather.ts` 单独提供阵风、斜向飘雪与18秒一次的远处闪电；`surfaceTextures.ts` 独立加载、失败降级。
- `src/render/PixiRenderer.ts` 接入地表模块并调整已有初始取景，入口仍对齐原竖井。之后不再调整镜头。
- `src/App.vue`、`src/core/missions.ts` 仅修改本次开场风雪提示文案；玩法、任务判定、存档不变。
- `tests/surface-scene.test.ts`、`tests/terrain-renderer.test.ts` 覆盖素材降级、地表裁剪、雪粒边界、闪电时序与初始取景。

## 已执行验证

- 修改前工作区：26个测试文件、301项通过。
- 最终工作区：`npm test -- --maxWorkers=2`，27个测试文件、308项全部通过。
- 最终工作区：`npm run build`，vue-tsc类型检查和Vite生产构建通过。曾修正新增测试中Assets.load重载的类型标注；一次系统内存分配失败后，将当次命令的NODE_OPTIONS设为 `--max-old-space-size=512` 完成构建，未修改项目配置。
- 构建仍提示主JS包大于500 kB；不影响构建成功。本轮3张运行用地表原图合计约5.86 MB，后续再统一优化。
- 生产预览实景已确认3张地表素材正常显示，雪树与入口贴住地层，梯道接入地下，浏览器warn/error日志为空。
- 原图解码检查：远景2172×724 RGB；雪林2172×724 RGBA；雪入口1536×1024 RGBA。透明图保留原生alpha。
- 实际截图：[01-snow-surface.jpg](01-snow-surface.jpg)。浏览器原始截图，未合成、重绘或调色。

## 交付边界

没有新增伤害、倒计时、地面探索、天气音效或积雪物理模拟。其他视觉问题待用户试玩后决定。用户工作区原有的房间、伙伴、UI等未提交改动单独保留，不归入此次地表提交；上述测试结果针对完整当前工作区。
