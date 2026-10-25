# 第七章 · 听风工区验收记录

2026-10-26。第七层开发已完成：蝙蝠铃铃、自由通风建设、三种风机模式、两种手作与实际送礼、七站电梯及章末听风。第八、九层未实施。详细规则与交接见 [LAYER7_SCOPE.md](../../LAYER7_SCOPE.md)。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 全量 Vitest，单 worker | **53 个文件，623 项通过，0 失败** |
| 与第六章相比 | 新增 33 项，原 590 项继续回归 |
| `npm run build` | **通过**：TypeScript／Vue 类型检查和 Vite 生产构建 |
| `git diff --check` | **通过**，既有文件 LF／CRLF 提示不计为失败 |
| 素材 | 三张最终 RGBA PNG，已检查原图与 alpha，合计约 6.93 MB |
| 浏览器实景 | **未完成**：工具明确返回 `Local browser use is disabled in Work settings` |

机器记录：[verification-summary.json](verification-summary.json)；逐项测试结果：[test-results.json](test-results.json)。没有新增依赖、发布或部署。

构建处理 954 个模块，主 JS 862.67 kB、gzip 283.52 kB。超过 500 kB 的分块体积提示仍存在，构建成功；首次加载与显存占用继续列入实机检查。

## 已覆盖的行为

- 检查静止飘带、安装风井护框、阿岩逐格凿岩；未护框不能施工，旧家、食物与第六层存水不变。
- x16／x27 旧梯口接入，前六层的既有地形保持；阿土和伙伴能走回家，底部地板不能挖穿。
- 新伙伴铃铃独立身份、听风动作、入场说明与床位优先位 8；前八位顺序保留，原六人宴名单不扩位。
- 自由建设进风口、风机、百叶和手作台；两套不同位置和建设顺序都能完成；缺净空、缺设施、梯口、重叠、缺料与不可达分别拒绝。
- 风管按四件设施间的真实连续洞壁连接；铃铃实际走完接管线路后才结算。
- 模式选择不直接改风，确认后铃铃到风机调节；家园微风才能首次检查，工区风才能制作，关机不会毁坏成果。
- 制作时明确扣旧木料 1、部件 1，一次仅一件待送作品；已有成品不能重复做或换品种覆盖。
- 阿土从七层手作台走到四层大厅、铃铃跟随到场才增加送礼次数、悬挂作品；中断保留待送成品，旧抵达不能补结算。
- 第七章完成后可继续做另一种作品，仍引导调微风和送礼；完成进度保留 19／19。
- 巡游等阿土、铃铃与阿木到场，三人各有不同格子；途中取消不提前完成。
- 同一会话内撤销制作退料、撤销送礼取回成品；已用梯道和章末床位受保护。
- 后台／离页、取消、停帧与重复点击不会提前扣料、调风或送达；完整会话每个中间快照都可恢复。
- 七站电梯从真实当前楼层发车，六层旧档未延长不能提前进入七层；旧站继续可用。
- 真实 App 与真实面板测试覆盖入口、相遇、选址、模式确认、手作、送礼工作、庆典、全景、老设施和伙伴对话：最多一个主要面板、一个主推进按钮。
- Pixi 对象测试覆盖设施和风机反馈在人物后侧、铃铃独立图像与移动、小屏目标位置；送礼抵达尊重玩家已拖图／收起后的镜头控制。
- 七类本地合成音效服从统一静音和后台停止；可选发现进入物品栏并提供定位入口。
- v21 支持真实 v20 44×76 旧档逐格迁移，v16—v19 旧档继续回归；伪造护框、风管、模式、产出、作品归属和未加入角色被拒绝。

## 尚未完成的实景项

本轮试图通过内置浏览器打开隔离测试页，但当前 Work 设置禁止本地浏览器使用。没有绕过设置，也没有把 Pixi 对象／DOM 测试视为画面验收。**没有第七章的游戏截图**；第六章既有截图不代表本章已验收。

待检查：七层色彩与暗部、风机叶片的轴心及缩放、手作台的小风车与插画叠层、铃铃的大小与人物遮挡、出场／凿井／长距离送礼时序、短屏面板滚动和主按钮、八个辅助导航入口的实际排版、触屏点挖与拖图、实际音量、首次加载与低性能设备帧率。

铃铃采用静态原画加程序移动、听风与睡眠裁切，未绘制独立多帧眨眼或飞行图集。风机的叶片、小风车和悬挂作品有程序运动，不模拟空气物理、氧气消耗或离线生产。新增插画约 6.93 MB，仍需要低性能设备实测。

## 隔离复现

执行 `npm run dev -- --host 127.0.0.1 --port 5174` 后：

- `/tests/manual/ventilation.html`：前六章完成，尚未检查旧风井。
- `?phase=entered`：已进入第七层，准备挖通右侧去见铃铃。
- `?phase=working`：四件风工设施与风管已接好，准备调模式、检查和做手作。
- `?phase=completed`：已完成，可验证两种作品、重复送礼、七站电梯与旧层回馈。
- `/tests/manual/ventilation-device.html`：398×756 iframe 独立视口，用于后续窄屏布局检查，本轮未实际打开验收。

以上仅注入内存存档，不读取／覆盖玩家 IndexedDB，不进入生产入口。

## 主要变更文件

| 职责 | 文件 |
| --- | --- |
| 规则与拓扑 | `src/core/ventilation.ts`、`ventilationTopology.ts` |
| 版本、通行、挖掘与撤销 | `src/core/world.ts`、`persistence.ts`、`atu.ts`、`exploration.ts`、`dig.ts`、`build.ts`、`history.ts` |
| 真实行动与交接 | `src/app/ventilationChapter.ts`、`session.ts`、`saveSummary.ts`、`guideAction.ts` |
| 伙伴、故事与床位 | `src/core/partners.ts`、`partnerWork.ts`、`partnerInteractions.ts`、`bag.ts`、`src/components/PartnerConversation.vue`、`InventoryDialog.vue` |
| 界面与导航 | `src/components/VentilationPanel.vue`、`DepthNavigation.vue`、`src/App.vue`、旧章面板与 lift UI 字段 |
| 画面、音效与素材 | `src/render/ventilationScene.ts`、`ventilationSound.ts`、`PixiRenderer.ts`、`companionVisual.ts`、`partnerMotion.ts`、`strataScene.ts`、三张 ventilation PNG |
| 大厅回馈 | `src/app/hallChapter.ts`、`src/app/itemArt.ts`、新场景内悬挂作品 |
| 测试与设计 | 新规则／会话／夹具／手动页，attention／audio／renderer／session／deep 与旧档回归；范围、总体基线、README |
