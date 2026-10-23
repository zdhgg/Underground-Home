# 第二层设施美术验收

日期：2026-10-23。范围：泉边灶台、围坐餐桌、泉边小菜园和休息角的分层美术、建造卡预览、现有种植状态显示。未增加玩法、改变费用、建设条件、通路、任务或存档结构。

## 美术与保存路径

使用**内置 image_gen**，以已有小窝和客厅素材为风格参考，生成四张透明 PNG；保留输出 alpha，未通过脚本抠图或修改生成图片。最终提示词与参考图见 [prompts.json](prompts.json)，尺寸与透明度检查见 [asset-report.json](asset-report.json)。原始输出保留在 Codex 生成目录，游戏只引用下列项目内文件。

| 文件 | 用途 |
| --- | --- |
| `src/assets/art/rooms/utility-shell-v1.png` | 灶台与菜园共用的方形石拱洞室外壳 |
| `src/assets/art/rooms/stove-furniture-v1.png` | 独立石砌灶台、铁锅、工作台与柴火 |
| `src/assets/art/rooms/dining-furniture-v1.png` | 独立餐桌、餐具、凳子与长凳 |
| `src/assets/art/environment/planter-empty-v1.png` | 空菜槽，用于种子/发芽/成长阶段的底图与建造预览 |

餐桌和休息角复用 `lounge-shell-v1.png`；休息角继续复用 `lounge-furniture-v1.png`。菜园成熟阶段复用 `planter-v1.png`，未重复生成整套客厅或把静态作物烘焙在洞室背景中。

## 实现与行为

- `facilityArtSpec.ts` 是地图和建造卡共用的图片与比例来源；外壳和家具分别绘制，家具不随房间宽度任意拉长。
- `facilityArt.ts` 独立加载、组合素材。一类新增图片失败时使用原有程序化造型；卡片图片失败时明确提示，仍保留主要操作。
- `FacilityPreview.vue` 替代厨房、餐桌、菜园的表情符号示意。当前详情只展示当前设施，仍最多一个主要面板与一个主要推进按钮；关闭、返回列表、完工后的交接沿用现有规则。
- 菜槽由原种植系统绘制，背景不重复绘制。种子、发芽、成长、成熟四阶段各有外观；成熟时仍由原有交互调用小满沿真实通路收获。
- 预设菜园内的菜槽缩小并稍向内侧调整，其视觉中心仍位于原可点击格内；自由菜槽与旧存档保持原位置。
- 做饭与吃饭保留现有程序效果和围坐走位；静态家具图不固定显示正在做饭或摆满食物。未给建筑额外添加反复发光、聚焦或自动弹窗。
- 旧菜园缺水时保留“等水来，再种菜”的反馈；新素材不影响供水判定。

## 本轮变更文件

- 上述四张 PNG。
- 新增 `src/render/facilityArtSpec.ts`、`src/render/facilityArt.ts`、`src/components/FacilityPreview.vue`。
- 修改 `src/render/roomScene.ts`、`PixiRenderer.ts`、`environmentArt.ts`、`farmProps.ts`、`src/components/SiteTools.vue`。
- 新增 `tests/facility-art.test.ts`；更新 `tests/attention-contract.test.ts` 与 `tests/terrain-renderer.test.ts`。
- README 与本目录的提示词、资源报告、浏览器脚本、截图和结果。

工作区原有未提交改动保留；不把此前交互聚焦、苔斑、蓝图和存档改动归入本轮。

## 验证

- `npx vitest run --pool=threads --maxWorkers=1`（`NODE_OPTIONS=--max-old-space-size=512`）：39 个文件、402 项测试通过。覆盖四类详情的单一关注对象、图片失败、共享纹理生命周期、地图/预览图层、缺水反馈和生长阶段。
- `npm run build`（`RAYON_NUM_THREADS=1`）：类型检查与生产构建通过。保留现有主包大于 500 kB 的提示。
- `git diff --check`：通过。
- `node docs/acceptance/water-facilities-art-v1/verify.cjs`：隔离 Chromium / 软件 WebGL，1440×960 与 390×844，运行时错误 0。当前规则构建并校验独立存档夹具，不访问玩家存档。详见 [browser-report.json](browser-report.json)。
- 浏览器逐一查看四类实际设施和建造卡，检查图片加载及单一主操作；展示四个作物阶段，真实点击成熟作物，由伙伴收获后食物增加 1；主动阻断灶台 PNG，确认地图备用造型、卡片失败反馈及操作可用。

本轮构建曾发现测试替身未匹配 Pixi 资源加载重载的类型问题，修正后重新通过类型检查、构建和测试。

## 实景

- [第二层整体](01-water-layer.png)
- [泉边灶台](02-kitchen-detail.png)、[围坐餐桌](02-dining-detail.png)
- [泉边小菜园](02-garden-detail.png)、[休息角](02-lounge-detail.png)
- [四个作物阶段](04-crop-stages.png)、[窄屏灶台](03-narrow-kitchen.png)
- [阻断图片后的备用显示](05-missing-stove-fallback.png)

复现：启动 `npm run dev -- --host 127.0.0.1 --port 5212 --strictPort`，再运行本目录的 `verify.cjs`。可通过 `FACILITY_TEST_URL` 指定其他独立开发服务器。

未完成项：尚未进行真实儿童试玩；PNG 尚未另做移动端压缩规格。水管、泉水及伙伴原素材继续沿用现状，本轮没有扩充新章节或美术状态数量。
