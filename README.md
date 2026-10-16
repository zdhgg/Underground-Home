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

## 当前状态：P1 第一夜主线 + 体验收口 P1.1（已完成）

- 可启动、可构建、可测试；模块职责分离，没有包揽全部职责的巨型 GameEngine。
- 已实现：
  - 固定小地图渲染：风暴地表、旧避难所大厅与竖井、松软泥土、坚硬岩层、未点亮时的昏暗地下灯光；
  - 初始镜头一眼看到避难所、能源核心与左侧能源石区；单击挖一格（严格单格）；拖动平移；缩放；悬停高亮；鼠标指针随区域变化；
  - 小鼹鼠阿土：一句短话只说当前唯一目标 + "做完会怎样"，配"带我去看看"（只移动镜头）；
  - 地图高亮当前目标区域（线索，不代替挖掘；小鼹鼠只给一个问题和一个真实目标）；
  - 第一夜主线三步：挖开泥土找到能源石 → 收集能源石 → 修复能源核心；
  - 修复演出：核心启动闪烁 → 顶灯一盏一盏依次亮起 → 伙伴撒花庆祝 → 镜头自动拉开展示点亮后的家园；
  - 挖错撤销：LIFO 撤销；已挖开的能源石不会被"撤销"埋回去（避免任务状态矛盾）；
  - 带版本号的 IndexedDB 自动存档与恢复（v2，含 v1 旧档自动迁移）；损坏存档降级不白屏。
- 尚未实现（后续阶段）：睡眠舱、泉水、水培温室、全景庆祝等，详见 `docs/PHASES.md`。

## 目录结构

第01批地形美术已接入：泥土、岩石、洞穴背景使用提供的 PNG，四向洞壁叠图跟随挖掘 / 撤销刷新；64px图块按32px显示。运行素材与原包说明位于 `src/assets/art/terrain/`，加载入口为 `src/render/terrainTextures.ts`。验收记录和生产版实景截图见 [地形美术接入验收](docs/acceptance/terrain-v1/README.md)。

```
src/
  core/              纯逻辑（无 DOM / PixiJS 依赖，可单测）
    world.ts         世界数据模型与岩层蓝图（避难所、软土口袋、关键地点、进度位）
    dig.ts           挖掘规则（单格、岩石不可挖、边界保护、挖开即发现能源石）
    interact.ts      互动规则（收集能源石 / 修复能源核心的判定）
    history.ts       挖掘撤销栈（LIFO；支持"受保护格子"，保护记录会被跳过）
    missions.ts      任务链定义、完成判定与地图高亮指引
    persistence.ts   带版本号的存档：序列化 / 校验 / v1 迁移 / IndexedDB 与内存适配器
  render/            渲染层（PixiJS）
    camera.ts        相机换算（屏幕 ↔ 世界坐标、平移、缩放约束）
    PixiRenderer.ts  瓦片地图、风暴地表、灯光过渡、伙伴、高亮与挖掘特效
  input/             输入层
    gesture.ts       点击 / 拖动阈值判定（互不误触）
    pointerControls.ts  指针事件 → 交互意图
  app/
    session.ts       组合根：装配 world / rules / missions / persistence / render / input
  App.vue            界面壳层（小鼹鼠引导卡、任务徽章、撤销、缩放、提示、图例）
tests/               Vitest 用例（规则、互动、撤销、任务、存档、手势、相机）
```

## 设计资料（交接包）

1. `docs/GAME_BRIEF.md`：产品定位、玩法及边界（设计基线 v0.5）。
2. `AGENTS.md`：持续开发规则。
3. `docs/PHASES.md`：分阶段目标与验收标准。
4. `reference/first-night-v0.4.html`：早期单文件 HTML 原型，**仅作参考**，不迁移其单文件架构。
5. `reference/first-night-v0.4-preview.png`：画面参考。

## 已知限制（P1.1 范围内）

- 人工试玩验收待完成（指引是否更清楚、点亮演出观感、初始镜头与撤销保护手感）。
- 撤销栈只保留本次会话的挖掘记录，刷新页面后不能撤销刷新前的操作。
- 暂不支持双指捏合缩放，多指手势留待后续阶段。
- IndexedDB 不可用时自动降级为内存存储（刷新不保留进度），仅作兜底。
