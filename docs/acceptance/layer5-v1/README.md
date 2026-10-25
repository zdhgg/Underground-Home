# 第五章 · 菌光花园验收记录

2026-10-25。本次只实施第五层和蜗牛苔苔，第六至九层继续保留规划。用户提出后续可以有新伙伴；本次实际增加一位，未批量创建未来角色。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 全量 Vitest | **49 个测试文件、557 项测试通过，0 失败** |
| `npm run build` | **通过**：TypeScript／Vue 类型检查和 Vite 生产构建完成 |
| `git diff --check` | **通过**；既有文件提示 LF／CRLF 转换，不是错误 |
| 素材源图复检 | 四张最终图均为 RGBA，alpha 范围 0—255；已查看原图并修正苔苔初稿的多余眼睛 |

机器记录：[verification-summary.json](verification-summary.json)；逐文件结果：[test-results.json](test-results.json)。相对第四章 526 项基线新增 31 项测试。全流程存档快照用例在并发全量测试时曾触发 5 秒默认超时；移除重复反序列化、为该长流程单独设置 20 秒时限后全量通过，保留全部中间存档可恢复断言。

构建主 JS 为 778.00 kB、gzip 263.62 kB，存在超过 500 kB 的分块体积提示，构建成功；新增四张最终 PNG 合计约 7.65 MB，首次加载和低性能设备帧率仍须实景验收。本轮没有新增运行时依赖，没有部署或发布。

## 覆盖的行为

- 四层暖屋宴完成后开放第五层；入口先检查再排水，未导流不能凿岩，旧家不受影响。
- x16／x27 两种旧梯口均可向下接入，前四层 47 行及设施保持；v18 的完整前 52 行存档逐格迁移保留。
- 阿岩按真实路径逐段凿岩，只在落手时改变一格；停工保留断点，旧回调不能补施工。
- 自由建设引水槽、多张菌床、多盏灯、长椅和岩壁小窝；梯口、地板、重叠、材料与可达性校验。
- 灯左右各照 2 格；连续菌毯传光，断毯／岩石截光；水源与整张菌床照明不足时拒绝照料。
- 小满到场照料两次后才能收获；每次食物 2、保留菌根、可重复；首次收获后空床可切换两种菌伞。
- 苔苔实际相遇后加入，稳定 ID／床位优先位独立；旧六位顺序不变；四层暖屋宴固定原六人名单。
- 阿土、苔苔、小满散步到场后才记录第五章完成，三人分开站位；取消不伪造到场。
- 新伙伴对话可以返回花园，切后台／停止画面出帧时安全取消；重复点击与旧回调不重复扣料或添食物。
- 五站电梯从第五层回家、从第一层回花园；新站未延长不能提前乘坐；前四站保留。
- 真实 App 面板测试覆盖入口、相遇、选址、工作、菌床、庆典和旧面板交接；同一舞台最多一个主面板与一个主推进按钮。
- 实际 Pixi 对象测试覆盖设施在角色后侧、苔苔独立实体与图像、移动回调、小屏目标定位；不将对象测试当作最终画面验收。
- 七类本地合成音效服从统一静音和后台停止；旧章节全量回归。
- v19 支持 v16／v17／v18 的旧地图尺寸迁移；半段施工、菌苗、菌毯、七位角色位置可恢复；伪造导流、光路、负收成、未知生长状态和未加入的伙伴被拒绝。

## 尚未完成的实景验收

浏览器工具返回 **Local browser use is disabled in Work settings**。本轮没有浏览器截图、触控试玩或实际试听，也没有绕过该设置使用其他方式操作浏览器。

仍须检查：第五层颜色和光照、菌床与菌毯传光的可读性、新伙伴缩放与遮挡、梯道施工和散步的时序、五站电梯的双人分离、手机导航和短屏滚动、点挖／拖图手感、实际音量、首次加载与低性能设备帧率。第三、四层原有待做的实景项仍未消除。

新伙伴原画采用轻量程序动作，未额外绘制多帧眨眼和睡眠姿势。第六至九层及其他新伙伴本次没有实施；最终终章仍位于第九层。

## 隔离复现入口

运行 `npm run dev -- --host 127.0.0.1 --port 5174` 后打开：

- `/tests/manual/garden.html`：暖屋宴已完成，检查新入口。
- `/tests/manual/garden.html?phase=entered`：已进入，准备认识苔苔。
- `/tests/manual/garden.html?phase=working`：水槽／菌床／灯／菌毯已接好，验证照料与收获。
- `/tests/manual/garden.html?phase=completed`：已完成，验证多床扩建、菌种切换、新朋友对话和五站电梯。

这些页面仅供开发服务器验收，注入内存存档，不读写玩家 IndexedDB，不包含在正式入口中。

## 主要变更文件

| 职责 | 文件 |
| --- | --- |
| 第五层规则／光路／存档 | `src/core/garden.ts`、`gardenTopology.ts`、`world.ts`、`persistence.ts` |
| 真实行动与交接 | `src/app/chapterJourney.ts`、`gardenChapter.ts`、`session.ts`、`saveSummary.ts`、`guideAction.ts` |
| 新伙伴与旧宴兼容 | `src/core/partners.ts`、`partnerWork.ts`、`partnerInteractions.ts`、`hall.ts`、`src/render/companionVisual.ts`、`partnerMotion.ts`、`src/components/PartnerConversation.vue` |
| 挖掘／通行／床位／撤销 | `src/core/atu.ts`、`exploration.ts`、`dig.ts`、`build.ts`、`history.ts` |
| 花园画面与音效 | `src/render/gardenScene.ts`、`gardenSound.ts`、`PixiRenderer.ts`、`strataScene.ts` |
| 面板／电梯／发现 | `src/App.vue`、`src/components/GardenPanel.vue`、`DepthNavigation.vue`、`DeepPanel.vue`、`HallPanel.vue`、`InventoryDialog.vue`、`src/core/deep.ts`、`bag.ts`、`src/app/deepChapter.ts`、`hallChapter.ts`、`itemArt.ts` |
| 图像与提示词 | `src/assets/art/garden/taitai-v2.png`、`bell-v1.png`、`fan-v1.png`、`rill-v1.png`、`ART.md` |
| 新测试与隔离入口 | `tests/garden.test.ts`、`garden-chapter.test.ts`、`fixtures/gardenWorld.ts`、`manual/garden.html`、`manual/garden.ts` |
| 扩展回归与设计 | `tests/attention-contract.test.ts`、`audio.test.ts`、`deep-chapter.test.ts`、`session-exploration.test.ts`、`terrain-renderer.test.ts`、`partners.test.ts`、`world.test.ts`、`deep.test.ts`、`hall.test.ts`；`docs/LAYER5_SCOPE.md`、`GAME_MASTER_DESIGN_V1.md`、`README.md` |

此前第三、四层及用户未提交工作完整保留，本次没有重置、清理或覆盖它们。
