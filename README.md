# 地下小家园（Underground Home）

面向 7 岁儿童的 2D 横截面地下家园建造与探索游戏：地表风暴迫使小伙伴搬入旧避难所，玩家通过自由挖掘、修复设施、建立地下生态，把避难所逐渐变成温暖、能运转的家园。

技术栈：**Vite + Vue 3 + TypeScript + PixiJS + Vitest**。

## 快速开始

```bash
npm install
npm run dev      # 开发服务器（默认 http://localhost:5173）
npm run build    # 类型检查（vue-tsc）+ 生产构建（输出 dist/）
npm run preview  # 预览生产构建
npm test         # Vitest 单元测试
```

## 当前状态：P0 工程初始化（已完成）

- 可启动、可构建、可测试的最小工程；模块职责分离，没有包揽全部职责的巨型 GameEngine。
- 已实现：
  - 固定小地图渲染：风暴地表、旧避难所大厅与竖井、松软泥土、坚硬岩层、隐约的地下泉水；
  - 单击挖一格（严格单格，不连带）；拖动平移；滚轮 / 按钮缩放；悬停高亮；
  - 第一夜首个任务（"找到发光的能源石"）基于世界数据的真实判定与进度徽章；
  - 带版本号的 IndexedDB 自动存档与恢复；损坏存档自动降级为新世界，不白屏。
- 尚未实现（后续阶段）：任务引导流程（小鼹鼠）、撤销、睡眠舱 / 温室 / 泉水玩法、全景庆祝等，详见 `docs/PHASES.md`。

## 目录结构

```
src/
  core/              纯逻辑（无 DOM / PixiJS 依赖，可单测）
    world.ts         世界数据模型与岩层蓝图（避难所、软土口袋、关键地点）
    dig.ts           挖掘规则（单格、岩石不可挖、边界与地表保护）
    missions.ts      任务定义与基于世界数据的完成判定
    persistence.ts   带版本号的存档：序列化 / 严格校验 / IndexedDB 与内存适配器
  render/            渲染层（PixiJS）
    camera.ts        相机换算（屏幕 ↔ 世界坐标、平移、缩放约束）
    PixiRenderer.ts  瓦片地图、地表风暴、关键地点绘制
  input/             输入层
    gesture.ts       点击 / 拖动阈值判定（互不误触）
    pointerControls.ts  指针事件 → 交互意图
  app/
    session.ts       组合根：装配 world / rules / missions / persistence / render / input
  App.vue            界面壳层（任务徽章、缩放按钮、提示、图例）
tests/               Vitest 用例（规则、任务、存档、手势、相机）
```

## 设计资料（交接包）

1. `docs/GAME_BRIEF.md`：产品定位、玩法及边界（设计基线 v0.5）。
2. `AGENTS.md`：持续开发规则。
3. `docs/PHASES.md`：分阶段目标与验收标准。
4. `reference/first-night-v0.4.html`：早期单文件 HTML 原型，**仅作参考**，不迁移其单文件架构。
5. `reference/first-night-v0.4-preview.png`：画面参考。

## 已知限制（P0 范围内）

- 浏览器自动化冒烟验证尚未执行，待人工打开页面确认（点挖、拖动、存档恢复）。
- 暂不支持双指捏合缩放，多指手势留待后续阶段。
- IndexedDB 不可用时自动降级为内存存储（刷新不保留进度），仅作兜底。
