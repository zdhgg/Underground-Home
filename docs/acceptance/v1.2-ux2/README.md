# v1.2-UX2 · 我的家园心愿 · 实景验收

本目录记录 2026-10-28 的 UX2 生产构建浏览器验收；开发时正式版本为 v1.1.1。UX2 已通过 PR #4 合并，v1.2.0 发布准备在此基础上进行，存档保持 v26。

## 运行方式

在仓库根目录启动两个服务：

```bash
node ./node_modules/vite/bin/vite.js --port 5197 --strictPort
node ./node_modules/vite/bin/vite.js build
node ./node_modules/vite/bin/vite.js preview --port 5198 --strictPort
```

然后在另一个终端运行：

```bash
node docs/acceptance/v1.2-ux2/verify.cjs
```

- `5197` 是 Vite 开发服务，只用于把 `tests/fixtures/homeWishesWorld.ts` 序列化成验收存档。
- `5198` 是 `dist` 生产构建；所有截图与交互断言都在这里完成。
- 脚本使用独立 Playwright 上下文，只写临时浏览器的 IndexedDB，不读取或覆盖玩家档案。
- 当前机器使用缓存中的 Playwright：`C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`。

## 验收夹具

`tests/fixtures/homeWishesWorld.ts` 通过现有规则生成五种可加载存档：

| 夹具 | 用途 |
| --- | --- |
| `earlyHomeWorld()` | 场景 A：游戏初期没有心愿 |
| `lampWishWorld(1)` | 场景 B：第三层完成 + 第一层未装灯小窝，部件充足 |
| `lampWishWorld(0)` | 场景 C：第三层完成 + 未装灯小窝，但部件不足 |
| `ripeWishWorld()` | 场景 D/E：第二层泉边有真实成熟菜槽 |
| `bothWishesWorld()` | 场景 F：两项心愿同时存在 |

场景 G 复用 `ripeWishWorld()` 的真实小满收菜工作，以及 `lampWishWorld(1)` 的第三层面板。

## 结果

- 视口：1440×900、1280×720、390×844、360×800。
- 4 个视口均为真实 WebGL 2.0 画布。
- 页面错误：0。
- 横向溢出：0。
- 场景 A–G 全部通过；结果数据见 `browser-results.json`。
- 截图命名：`{视口}-A-early.jpg`、`{视口}-B-wishes.jpg`、`{视口}-B-focus.jpg`、`{视口}-C-wishes.jpg`、`{视口}-C-no-parts.jpg`、`{视口}-D-wishes.jpg`、`{视口}-D-ripe-focus.jpg`、`{视口}-F-two-wishes.jpg`、`{视口}-E-after-harvest.jpg`、`{视口}-G-work.jpg`、`1440-G-chapter.jpg`。

## 重点实测

- 场景 B 点击“去看看小窝”后，镜头定位到第一层小窝，`deep.parts` 保持 1，小窝没有灯。
- 场景 C 缺料提示为“还差1个工坊部件，可以去第三层再做一个。”；点击后仍不安装、不扣料。
- 场景 D 点击“去看看菜园”后定位到 `(28,21)` 的真实成熟菜槽，生长阶段与食物不变。
- 场景 E 通过真实小满收菜完成：食物 2→3、生长阶段回 0，最后一槽熟菜收完后心愿消失。
- 场景 F 两条心愿同时显示；小本子高度不超过舞台，内部滚动可用，“家园全景”仍可达。
- 场景 G 小满收菜期间打开小本子只显示楼层导航；心愿与主线都让位，工作卡继续、最终完成，舞台主要操作数为 0。第三层面板打开时同样不显示心愿，章节自己的主要操作为 1。

## 合并前窄屏紧凑修订复核（2026-10-28）

修改前截图保留在本目录。窄屏修订后使用独立脚本复核，避免覆盖旧证据：

```bash
node docs/acceptance/v1.2-ux2/verify-compact.cjs
```

需要与上一节相同的 `5197` 开发服务和 `5198` 生产预览服务。脚本会：

- 在 1440/1280/390/360 四个视口打开 `bothWishesWorld()`，测量心愿区高度、按钮 `getBoundingClientRect()`、按钮与标题重叠、文字截断、首屏楼层可见性与横向溢出。
- 在 390 打开缺料存档，确认普通说明收起但缺料提示仍在。
- 在 390 打开初期存档，确认无心愿时栏目不存在。
- 在 390 点击“去看看小窝”“去看看菜园”，确认只定位、小本子收起、存档中的 `deep`/`pods`/`farm` 不变。

结果：

- `compact-fixed-before.json`：`d58e621` 基线测量（390/360）。
- `compact-fixed-results.json`：修改前后对比、四视口 after 数据与功能抽查。
- 新增截图：`{1440,1280,390,360}-F-two-wishes-compact-fixed.jpg`、`390-C-no-parts-compact-fixed.jpg`、`390-A-no-wishes-compact-fixed.jpg`、`390-B-focus-compact-fixed.jpg`、`390-D-ripe-focus-compact-fixed.jpg`。
