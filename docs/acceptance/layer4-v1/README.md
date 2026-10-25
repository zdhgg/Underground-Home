# 第四章 · 暖光大厅验收记录

2026-10-25；本次交付为第四层开发版。九层设计已更新，终章位于第九层，第五至九层没有实施。

## 自动验证

| 检查 | 实际结果 |
| --- | --- |
| 全量 Vitest | **47 个测试文件、526 项测试通过，0 失败** |
| `npm run build` | **通过**：`vue-tsc --noEmit` 和 Vite 生产构建完成；最终餐桌修订图已进入产物 |
| `git diff --check` | **通过**；既有文件有 Git CRLF 提示，不是构建或测试失败 |
| 三张最终插画 | 已人工查看源图；RGBA、包含真实透明像素；长桌修订版六椅、六碗、六勺 |

机器摘要：[verification-summary.json](verification-summary.json)；逐文件摘要：[test-results.json](test-results.json)。相对第三层 499 项基线，本次增加 27 项自动测试。最终构建主 JS 735.42 kB、gzip 251.80 kB，仍有大于 500 kB 的分块提示，构建成功。未新增运行时依赖。

覆盖内容：

- 三层完成后才开放第四层；先检查旧梁、主动加固，未加固不能凿岩；不修改旧层地形。
- x16／x27 两处旧梯口均能接入；真实逐段凿岩和实际站位，四层之间保有回家通路。
- 四格高侧向扩挖的双层施工架、实心地板、梯口保护、设施重叠与材料不足提示。
- 大厅、纪念墙、双人小窝自由选址；小窝提供真实床位；前三层床位继续有效。
- 四站电梯从第四层回家、从第一层回大厅，实际抵达后更新位置；未延长时拒绝第四站。
- 阿土与五位伙伴各走真实路线到六个不同位置，聚集完成才扣食物；重复点击／过期回调不重复结算。
- 施工／聚餐取消、关闭、切后台、画面停帧看门狗；已完成地形保留，可从断点继续。
- v17 真实 44×40 旧档只追加新蓝图；v16 44×28 迁移继续回归；施工中与四层角色站位均可恢复；损坏数据拒绝。
- 真实 App 面板交接：旧梁 → 选址 → 施工 → 纪念墙 → 庆典；与前三层对话、设施和全景互斥，每个舞台最多一个主面板／主操作。
- 实际 Pixi 对象检查：大厅插画在角色后侧，六位伙伴实体存在，窄屏目标定位留在情境面板上方；这些只证明对象状态，不替代实景。
- 六类合成音效服从总静音、后台停止；旧音频与前三层功能全量回归。

## 尚未完成的实景验收

工具再次返回 **Local browser use is disabled in Work settings**。本轮没有实际浏览器截图或触控试玩，也没有绕过该设置调用其他方式控制浏览器。

以下仍须实景验收，不能用自动断言宣称完成：第四层及第三层镜头交接、色彩与灯光观感、六人桌前角色遮挡、上下电梯的双人分离、短屏面板滚动、触控拖图与点挖手感、实际音量和音效衔接。第三层此前待做的实景项在本轮仍未消除。

没有第五至九层、观景天窗、独立大件组装技能树、复杂居民 AI、战斗、后端或付费系统。本次不包含发布或部署。

## 隔离复现入口

运行 `npm run dev -- --host 127.0.0.1 --port 5174`，打开：

- `/tests/manual/hall.html`：三层完成、第四层尚未发现。
- `/tests/manual/hall.html?phase=entered`：已加固并进入，准备建设。
- `/tests/manual/hall.html?phase=furnished`：大厅、纪念墙、六床和长桌齐备，准备邀请聚餐。
- `/tests/manual/hall.html?phase=celebrated`：已暖屋，检查相册与四站电梯。
- `/tests/manual/crystal.html?phase=lift`：补验第三层首次电梯回家。

这些入口仅供开发服务器使用，采用注入的内存存档；不访问玩家 IndexedDB，不进入生产入口。

## 主要变更文件

| 职责 | 文件 |
| --- | --- |
| 九层设计与当前边界 | `docs/GAME_MASTER_DESIGN_V1.md`、`docs/LAYER4_SCOPE.md`、`README.md` |
| 地图、规则、寻路与撤销 | `src/core/world.ts`、`hallTopology.ts`、`hall.ts`、`atu.ts`、`dig.ts`、`build.ts`、`exploration.ts`、`history.ts` |
| 存档与物品 | `src/core/persistence.ts`、`bag.ts`、`src/app/saveSummary.ts`、`itemArt.ts` |
| 章节会话与交接 | `src/app/hallChapter.ts`、`session.ts`、`deepChapter.ts`、`guideAction.ts` |
| 界面与楼层导航 | `src/App.vue`、`components/HallPanel.vue`、`DeepPanel.vue`、`DepthNavigation.vue`、`InventoryDialog.vue` |
| 场景、施工与音效 | `src/render/hallScene.ts`、`hallSound.ts`、`PixiRenderer.ts`、`explorationScene.ts`、`atuConstruction.ts`、`strataScene.ts` |
| 新生成素材 | `src/assets/art/hall/shell-v1.png`、`table-v2.png`、`memory-v1.png`；提示词规格见同目录 `ART.md` |
| 新增／扩展测试 | `tests/hall.test.ts`、`hall-chapter.test.ts`、`fixtures/hallWorld.ts`、`attention-contract.test.ts`、`audio.test.ts`、`deep-chapter.test.ts`、`session-exploration.test.ts`、`terrain-renderer.test.ts`、`world.test.ts`、`deep.test.ts` |

此前第三层未提交的变更继续保留，没有重置或覆盖用户工作。
