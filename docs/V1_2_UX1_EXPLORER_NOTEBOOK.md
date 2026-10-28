# v1.2-UX1 · 探索与任务界面整合

> 版本号不变（仍为 v1.1.1）· 开发分支 `zcode/v1.2-ux1-explore-notebook` · 不合并 main、不创建 Release。

## 1. 这次解决什么

v1.1.1 的顶部有两行：第一行是名称与工具，第二行是第 1–9 层横向导航。游戏初期大部分楼层未开放，孩子每天看到的是一排锁；同时左上角还有一张独立的主线引导卡。两套界面同时占据屏幕，游戏画面被压缩。

v1.2-UX1 只做三件事：

1. 顶部恢复成**一行工具栏**，九层导航不再常驻。
2. 把“当前主线”和“去哪里”整合进左侧同一本**阿土的探索小本子**：主线在上、楼层在下。
3. 小本子可以收起成一个小入口，不再长期遮挡地下家园。

没有新增任务、奖励、结算、NPC、楼层、设施或伙伴；主线仍然只由 `resolveGlobalGuide()` 从真实世界状态生成。

## 2. 界面结构

```
顶部工具栏（单行）
🏔️ 心心的小家园            物品栏 · 记忆匣 · 工具 · 声音

舞台左上角：阿土的探索小本子（可收起）
┌────────────────────────────┐
│ 阿土头像  阿土的探索小本子  ‹ │
├────────────────────────────┤
│ ⭐ 现在要做什么？            │
│ 第 4 层 · 暖光大厅 · 主线 0/11│
│ 梯口下方的旧木梁             │
│ [ 看看暖光大厅 ]             │
│ 需要帮忙？                   │
├────────────────────────────┤
│ 🗺️ 去哪里？                 │
│ 正在看 · 1层 · 暖窝          │
│ ● 1层 · 暖窝        正在看   │
│ ○ 2层 · 泉水                 │
│ ○ 3层 · 晶簇                 │
│ ○ 4层 · 大厅                 │
│ ▸ 看看更深的地方             │
│ [ 🗺️ 家园全景 ]             │
└────────────────────────────┘
```

收起后只剩 `🐹 探索小本子 ▸`（44px 高）。再点展开；Esc 也可收起。

- 主线任务楼层（`第 4 层 · 暖光大厅`）与镜头正在看的楼层（`1层 · 暖窝 · 正在看`）分开展示，不混在一起。
- 默认只列已开放楼层；点“看看更深的地方”才显示未开放楼层和锁。点锁仍会给出原有的解锁原因提示，不会提前进入。
- 已开放楼层增多时，楼层区域在面板内部滚动；面板整体也有最大高度。
- 选一层后小本子自动收起，把画面让出来；点未开放楼层不收起，方便孩子读完原因。

## 3. 复用关系（没有第二份任务/楼层规则）

| 内容 | 原实现 | 本次处理 |
| --- | --- | --- |
| 主线快照 | `src/app/guideAction.ts` `resolveGlobalGuide()` | 原样使用；App 继续接收 `onProgress`，只改变显示位置 |
| 主线主动作 | `performGuide()` | 原样保留，按钮从 GuidePanel 移进小本子 |
| 九层开放判定 | `src/components/DepthNavigation.vue` + `src/app/depthAccess.ts` 的 `CHAPTER_ACCESS` | 列表结构重写为内嵌样式，开放判定、锁定原因、事件名全部沿用 |
| 楼层镜头/章节入口 | `session.centerOnHome / lookDown / lookCrystal / openHall / … / showOverview` | 事件原样透传，未新增导航逻辑 |
| 任务进度 | 世界状态 → `progress.done/total` | 未改任务条件、未改存档 |

`GuidePanel.vue` 仍保留，并新增 `embedded` 模式：嵌入小本子时去掉绝对定位、阴影与重复头像；独立使用（现有单测）时行为不变。

## 4. 面板互斥与交接

单一主要关注对象原则不变：舞台上仍然最多一个 `data-attention-panel`、最多一个 `data-primary-action`。

新增的判定只有 App 内的两个 computed：

- `chapterPanelOpen` / `panelOpen`：与舞台 `v-else-if` 链一致，判断是否已有章节、房间、设施、施工、伙伴工作、对话、巢穴欢迎等主要面板。
- `guideVisible`：没有主要面板、不是全景、没有共餐演出、没有施工/壁灯/建造模式时才为真。为假时：
  - 小本子自动收起；
  - 主线区从 DOM 移除（不会留下隐藏的第二个主操作）；
  - 紧凑入口保留。

玩家在章节/工作期间仍可点紧凑入口查看楼层：

- 小本子只显示楼层，不显示主线，也不产生 `data-primary-action`；
- 台面上的面板保持不变，切换楼层走原有 session 方法；
- 伙伴工作不会因为看楼层/切楼层被取消（`lookDown` 等原本就不动 `partnerOrders`）；
- 窄屏下楼层面板自动落到**与主要面板相反**的一侧：章节面板在底部时从上方展开（`max-height: calc(52% - 74px)`），房间/设施/工作卡在左上时从底部展开（`max-height: 34%`），实测重叠为 0。

开合状态只是 App 内的 `notebookOpen`（外加“面板关闭后是否恢复”标记），不写入世界存档，也不建立新的全局状态库。

## 5. 窄屏判层修正（390px 问题）

现象：390px 宽时，第一层小窝在画面上方，底部导航却显示“2层”。

原因：窄屏聚焦建筑时，镜头把目标放在上方，屏幕几何中心已经落到第二层或岩盖。`cameraDepth()` 用中心判层，本身没有错，只是不适合“正在看”的界面文案。

修正（只影响显示）：

- `src/render/camera.ts` 新增 `lookDepth()`：在 `DepthView` 上附带 `displayLayer`。如果视野上部 30% 仍落在某个真实楼层（home/water/…/finale），就用它作为“正在看”；否则退回中心层。
- 渲染器改用 `lookDepth()` 发布视图；`cameraDepth()`、镜头坐标、缩放、拖动、判层规则全部不变。
- `session` 在房间编辑聚焦时把 `displayLayer` 固定为 `siteEditor.focusedLayer`。
- 只有小本子的“正在看”行使用 `displayLayer`；其他游戏规则继续用 `layer`。

## 6. 实际高度变化

同一生产构建页面、真实 CSS 高度（`getBoundingClientRect().height`），修改前为 v1.2-A `c5329d5` 基线构建：

| 视口 | 顶部前 | 顶部后 | 释放 | 舞台前 | 舞台后 | 变化 |
| --- | --- | --- | --- | --- | --- | --- |
| 1440×900 | 106px | **56px** | −50px | 740px | **790px** | +6.8% |
| 1280×720 | 106px | **56px** | −50px | 560px | **610px** | +8.9% |
| 390×844 | 152px | **52px** | −100px | 650px | **750px** | +15.4% |
| 360×800 | 152px | **52px** | −100px | 606px | **706px** | +16.5% |

顶部始终 5 个可交互分组、单行；在 320–1440px 宽度内均无横向溢出（320px + 三位数资源时短标题会压缩，规格验收宽度为 360px 起）。

## 7. 文件清单

新增：

- `src/components/ExplorerNotebook.vue`
- `tests/explorer-notebook.test.ts`
- `docs/V1_2_UX1_EXPLORER_NOTEBOOK.md`
- `docs/acceptance/v1.2-ux1/`（生产构建截图与 `browser-results.json`）

修改：

- `src/App.vue`：顶部单行；接入探索小本子；`panelOpen` / `guideVisible` / 自动让位；选层后收起；窄屏标题压缩。
- `src/components/DepthNavigation.vue`：改成小本子内的楼层列表；默认仅开放层、可展开未开放层、保留锁定原因与事件；显示“正在看”。
- `src/components/GuidePanel.vue`：`embedded` 模式；主线标签与进度；嵌入时去掉重复头像。
- `src/render/camera.ts`：`DepthView.displayLayer` 与 `lookDepth()`。
- `src/render/PixiRenderer.ts`：视图回调改用 `lookDepth()`。
- `src/app/session.ts`：视图回调同步 `displayLayer`（房间编辑时取 focusedLayer）。
- `tests/attention-contract.test.ts`：适配新的楼层列表与开合契约。
- `tests/terrain-renderer.test.ts`：视图回调断言允许附加 `displayLayer`。

未修改：任务规则、存档结构/版本、九层解锁规则、镜头缩放与拖动、Canvas 场景比例、地图内容、现有房间/设施/伙伴工作逻辑。

## 8. 验证

### 自动化

- `vue-tsc --noEmit`：通过。
- `vite build`：通过（保留原有 chunk 体积提示）。
- `vitest run --maxWorkers=1`：**64 个测试文件、777 项全部通过**。

新增/更新覆盖：

- 顶部不再有 `.depth-nav`，导航只在小本子里。
- 主线标题/楼层/进度随 `onProgress` 更新；主按钮继续调用原 `performGuide`。
- 默认只显示开放层；展开后未开放层带锁与原因；点击不进入章节。
- 收起/展开、Esc、焦点、`aria-expanded`；收起不调用镜头/世界操作。
- 章节面板出现 → 小本子自动收起、主线移除、只剩一个主操作；期间仍可打开楼层并切换。
- 伙伴工作时切楼层不取消工作，没有主操作，工作卡仍在。
- 窄屏默认收起；窄屏判层 `lookDepth()` 覆盖“小窝在上方但中心到第二层”的场景。

### 生产构建浏览器实景

无头 Chromium 加载 `vite preview` 的 `dist`，写入 v25 验收存档（旧存档可正常继续），逐个视口检查。结果保存在 `docs/acceptance/v1.2-ux1/browser-results.json`，4 个视口均为 0 页面错误、0 横向溢出、顶部 5 个分组。

截图（`docs/acceptance/v1.2-ux1/`）：

| 场景 | 文件 |
| --- | --- |
| 1440 桌面展开 | `1440-01-open.jpg` |
| 1440 未开放楼层 | `1440-03-locked.jpg` |
| 1440 工作期间换到第二层（工作卡仍在） | `1440-06-work-floor-switch.jpg` |
| 1440 暖光灯完成（部件 2→1，存档 v26） | `1440-07-work-completed.jpg` |
| 1280 桌面 | `1280-01-open.jpg` |
| 390 收起 / 展开 / 未开放楼层 | `390-01-collapsed.jpg` / `390-02-open.jpg` / `390-03-locked.jpg` |
| 390 第四章面板 / 面板期间看楼层（重叠 0） | `390-04-hall.jpg` / `390-05-hall-floors.jpg` |
| 360 收起 / 展开 / 未开放楼层 | `360-01-collapsed.jpg` / `360-02-open.jpg` / `360-03-locked.jpg` |

实景交互覆盖：收起后 Canvas 拖动（`cameraY` 实际变化）、放大/缩小、撤销、寻找阿土仍在；楼层按钮走原有镜头/章节入口；家园全景；未开放楼层原因；章节面板与小本子互斥；伙伴工作时换楼层后工作继续并最终完成（暖光灯装好、工坊部件扣 1、存档升到 v26）。

## 9. 已知问题与风险

1. `guideVisible` 是对舞台 `v-else-if` 链的镜像判定。后续新增主要面板时，必须同时接到 `panelOpen` 上；`tests/attention-contract.test.ts` 会捕获“同时出现两个主面板/主操作”的回归。
2. 应用内浏览器在窗口失焦/切后台时，游戏会按既有安全规则暂停伙伴工作。工作完成相关的验收使用无头 Playwright 的生产构建完成，未改动该安全规则。
3. 320px 超窄屏（低于本次 360px 验收下限）配合三位数库存时，短标题会被压缩省略；360px 及以上正常。
4. 家园全景下底部提示仍可能沿用当前镜头所在的章节文案（既有行为，不在本次范围）。
5. 小本子开合状态刻意不写入存档：刷新后按屏幕宽度恢复默认（桌面展开、窄屏收起）。

## 10. 合并前修订（2026-10-28）

只修复两个已确认的交互问题，其他设计、规则、存档与版本号不变。

### 10.1 展开未开放楼层后看不到新增内容

原因：`.floors` 内部滚动区域同时容纳“已开放楼层 + 展开按钮 + 未开放楼层”。已开放楼层较多时，展开按钮和锁定楼层都在滚动区下方，按钮虽然变成“收起没开放的楼层”，新增内容却在可视区外。

修复：

- `DepthNavigation.vue` 把展开按钮移出内部滚动容器，放进 `.floor-stack`，始终可操作；只有楼层列表滚动（`max-height: 238px` 不变）。
- 展开后 `nextTick()` 读取列表与第一条锁定楼层的实际 `getBoundingClientRect()`，只调整 `.floors` 自身的 `scrollTop`，把第一条锁定楼层放到列表上方 6px 处；已经完整可见时不滚动。
- 不使用 `scrollIntoView()`，不触碰页面或外层小本子的滚动；收起时 `scrollTop = 0`。
- 继续向下滚动可看到其余锁定楼层；点锁定楼层仍走原有原因提示，不切镜头。

对应测试：7 层已开放时展开的第一条锁定楼层进入列表可视区、收起回顶部、已可见时不额外滚动、不调用 `scrollIntoView`。生产页面 1440/390/360 实测 `firstVisible = true`、`listScrollTop = 190`、页面滚动为 0、镜头与 Canvas 位置不变；截图见 `docs/acceptance/v1.2-ux1/390-03-locked-fixed.jpg`，结果见同目录 `browser-results-fix.json`。

### 10.2 Esc 被主线帮助区域拦截

原因：嵌入的 `GuidePanel` 始终使用 `@keydown.esc.stop="collapse"`。焦点在主线按钮或帮助内容上时，Esc 只会收起帮助并把焦点移到“需要帮忙？”，永远到不了小本子的关闭处理。

修复：

- `GuidePanel.vue` 改为 `@keydown.esc="onEscape"`：
  - 帮助展开时：停止冒泡、收起帮助、焦点回到“需要帮忙？”，小本子保持展开；
  - 嵌入且帮助未展开时：不处理、不阻止冒泡，交给 `ExplorerNotebook` 收起整个小本子；
  - 独立使用时：保持原来的 Esc 行为（收起帮助并聚焦按钮、停止冒泡）。
- 小本子仍用现有 `@keydown.esc.stop` 收起并聚焦紧凑入口；没有新增全局键盘监听器。

对应测试：帮助展开时第一次 Esc 只收帮助、第二次 Esc 收小本子并聚焦紧凑入口；焦点在主按钮、楼层按钮上的 Esc 直接收起；独立 GuidePanel 行为不变且停止冒泡；单一主操作仍最多一个。

### 10.3 本轮验证

- `vitest run --maxWorkers=1`：**64 个测试文件、783 项全部通过**（基线 777 项）。
- `vue-tsc --noEmit`、`vite build`：通过。
- 生产构建实景（1440×900、390×844、360×800）：7 层已开放 + 8/9 层锁定；第一条锁定楼层真实可见；内部滚动正常；收起回顶部；页面滚动为 0；镜头/Canvas 不移动；Esc 两级关闭与焦点恢复全部通过；章节面板与小本子重叠面积为 0；0 页面错误、0 横向溢出。
- 本轮验收夹具：`docs/acceptance/v1.2-ux1/fixture-v26-seven-floors.json`（由现有通风层测试夹具序列化，v26）；结果：`docs/acceptance/v1.2-ux1/browser-results-fix.json`。
- 本轮修改文件：`src/components/DepthNavigation.vue`、`src/components/GuidePanel.vue`、`tests/explorer-notebook.test.ts`，以及本说明和新增验收资料。顶部布局、小本子视觉、任务解析、镜头、伙伴工作、小窝暖光灯、章节玩法、存档结构均未改动。
