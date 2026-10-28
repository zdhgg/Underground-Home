# 第 3 层 · 晶簇与工坊验收

日期：2026-10-25。设计、资源与关注对象的详细决策见 [LAYER3_SCOPE.md](../../LAYER3_SCOPE.md)。本轮在原工作区上衔接开发，没有重置原有未提交改动；没有提交、发布或部署。

## 已交付

- 连续剖面 44×40：原双层保留，新增晶纹盖层、天然晶簇洞、左右软土扩建带和指定小矿脉。
- 阿岩侧洞相遇、硬岩爪逐段施工、真实梯道、阿土沿梯到达、晶簇发现与首次资源获取。
- 自由选址的晶簇采集台、配电箱、岩壁工坊、小石炉和可多摆的晶光壁灯；选址绿／红框、材料说明、取消、撤销。
- 可重复的采集与加工：晶簇／矿石 → 金属锭 → 部件；阿木实际走到工坊或炉边动手。资源不足给出明确提示，不扣料、不跳结算。
- 五项能力成果：阿岩硬岩爪、阿木精密工具、阿土硬岩镐、阿灯远光灯、竖井支撑。精密工具改变产量，远光灯改变真实光场，硬岩镐只开放指定小矿脉。
- 三层安全吊篮：先走到梯口接伙伴，再沿原竖井上下；第一次实际抵达且本章成果齐全后庆祝。到站后阿木走到旁边，和阿土分开站位。
- 晶簇、晶苔、旧钻头的发现和故事；实时材料进入物品栏。
- 五张新手绘透明图片、两个向量物品图标、七类 WebAudio 合成音效。
- 存档 v17：真实旧 44×28 双层地图扩展迁移、完整设施与能力往返、施工断点恢复、损坏数据反馈。
- 单一关注对象：当前目标、设施、选址、升级、施工与旧对话面板互斥；主操作标记与真实 App 状态测试同步扩展。
- 第三层任务卡一次只告诉玩家当前要搭的设施，主按钮进入这件设施的选址；界面不同时展示建筑清单，完成后自动交接到下一件。
- 采集台选址与设施详情明确说明：本章只需 1 台，建好后每次可取晶簇 3、矿石 2；面板只突出当前要做的事情，不要求孩子理解章节计数。

## 自动验证

最终运行：

| 命令／检查 | 结果 |
| --- | --- |
| `npm test -- --reporter=json --outputFile=tmp-tests.json` | **45 个文件通过，499 项通过，0 失败** |
| `npm run build` | **通过**：`vue-tsc --noEmit` 与 Vite 生产构建完成 |
| `git diff --check` | **通过** |

机器摘要见 [verification-summary.json](verification-summary.json)。构建仍报告主 JS 约 700.52 kB、gzip 241.23 kB 的分块体积提示，构建成功；本轮没有引入新运行依赖。

本轮新回归重点：

- x16 与 x27 两种旧梯口都能接入第三层；前两层逐格保留。
- 新设施材料不足、重叠、未通路、未发现晶簇、占梯口／晶根的拒绝；位置不固定。
- 从相遇、逐段施工、到达、发现、五类建设到加工、电梯与完成的完整规则／会话流程。
- 采集补给、精密工具双产量、硬岩镐指定矿石、远光范围与岩石遮光。
- 双层旧档迁移、全部新状态往返、角色在深层／施工梯上的存档，以及未知设施／负资源／伪造电梯／非法破岩等坏档拒绝。
- 每一个施工中或移动中的会话快照都能加载；停工、后台、3 秒无新帧、30 秒上限、取消后的旧回调和重复工作完成回调。
- 电梯抵达前不计完成，取消不瞬移，重试能抵达；阿木下梯分开站稳。
- 实际 App 的引导 → 选址 → 施工 → 设施 → 升级 → 对话／原设施接管 → 全景切换；主面板和主要推进按钮始终至多一个。
- 晶苔／钻头点击不吞掉其上方仍待挖的土；新增第二盏晶光灯可用且可存。
- 窄屏相机把最低层设施定位在面板上方；收起、拖动、缩放后完成回调不再次抢镜头。
- 七种新声音都通过现场合成和总静音／后台生命周期测试。

## 已完成的实景检查

使用实际 Vue + Pixi 场景、实际 PNG、真实输入与动画，在本地 Vite 页面验收。测试入口注入内存存档，**不读写玩家的 IndexedDB**。

实际 CSS 视口检查了 **1280×800、842×526 和 412×915**；本机显示缩放下先读取 DOM 尺寸确认，再进行尺寸验收。

1. 桌面从前两层完成状态主动打开线索，阿土走到侧洞，结识阿岩，下一目标改为盖层施工。阿岩逐段行走、落手、岩石消失、梯子接长，施工完成后出现下楼操作。
2. 阿土沿通路到晶簇层，点击天然晶簇后材料显示晶簇 3、矿石 3；点击地图选择位置只产生当前采集台的一个绿色预览，确认后才建造扣料。
3. 已建工坊场景的五类设施贴在岩壁上，阿木造型与场景一致；执行冶炼后矿石从 3 减为 1、金属锭从 0 增为 2，主操作交接到部件制作。
4. 电梯试乘状态从 12/13 开始，伙伴走到梯口，吊篮沿井移动；回到暖窝层出现“第 3 层 · 完成啦”，主操作变为返回晶簇层；再次乘坐能返回第三层。
5. 窄屏导航、说明、材料与主要按钮可见；没有叠出第二个主要面板。检查过程中修正了导航横向溢出、矮屏装饰挤走主要按钮、伙伴叠站与旧蓝图遮挡。
6. 浏览器控制台所检查的运行阶段无错误记录。

保存的实景证据：

| 截图 | 所示状态 |
| --- | --- |
| [02-cap-open.png](02-cap-open.png) | 阿岩逐段凿通后，盖层与施工梯真实连通 |
| [03-free-placement.png](03-free-placement.png) | 自由选址、绿框与唯一确认操作 |
| [04-workshop-and-lift.png](04-workshop-and-lift.png) | 工坊、石炉、配电、采集、壁灯与电梯齐备 |
| [05-chapter-complete.png](05-chapter-complete.png) | 实际乘梯回到暖窝层后的章末状态 |

## 验证边界与未完成项

- 终轮复拍时，工具返回 **“Local browser use is disabled in Work settings”**。因此最后的窄屏相机边界修正、乘员缩放及到站分开站位、镜头让位和第二盏灯入口，已完成代码与回归测试，**尚未重新截取最终实景**。上面的截图真实记录较早一轮可玩的结果，不冒充最终改动后的复拍。
- 新音效已合成并验证调度、静音、后台停止；未进行独立音频设备的听感评审。
- 未做儿童用户试玩；不把自动断言当作儿童理解、画面时序、颜色和遮挡的完整评价。
- 第四层继续留待后续；第三层没有新增战斗、经济交易、联网后端或持续居民 AI。

## 复核入口

正式游戏仍从 [本地首页](http://127.0.0.1:5173/) 继续，完成第二层第一次共餐并送电后出现第三层线索。

开发服务器下的隔离验收入口（不进入生产构建）：

- `/tests/manual/crystal.html`：第二层完成、等待去侧洞见阿岩。
- `/tests/manual/crystal.html?phase=entered`：已抵达第三层、等待发现晶簇。
- `/tests/manual/crystal.html?phase=workshop`：五类设施齐备，等待冶炼加工。
- `/tests/manual/crystal.html?phase=lift`：电梯已装好，等待第一次试乘。

每个入口点“继续游戏”进入；刷新会重新读取该入口的内存夹具，不是玩家的长期存档。

## 本轮变更文件

新增主实现：

- `src/core/deep.ts`、`src/core/deepTopology.ts`。
- `src/app/deepChapter.ts`、`src/components/DeepPanel.vue`。
- `src/render/deepScene.ts`、`deepArt.ts`、`deepSound.ts`。
- `src/assets/art/deep/` 下五张 PNG、两个 SVG 与 `ART.md`。

接入与兼容修改：

- `src/core/world.ts`、`persistence.ts`：世界与 v17 结构、严格加载及旧图迁移。
- `src/core/atu.ts`、`dig.ts`、`exploration.ts`、`build.ts`、`history.ts`、`lighting.ts`：通行、指定硬岩、撤销、光传播。
- `src/core/partners.ts`、`partnerInteractions.ts`、`partnerWork.ts`、`bag.ts`：稳定身份、加入、站位、对话、发现物。
- `src/app/session.ts`、`guideAction.ts`、`saveSummary.ts`、`itemArt.ts`：章节控制器装配、引导、摘要、物品栏。
- `src/App.vue`、`components/DepthNavigation.vue`、`PartnerConversation.vue`、`InventoryDialog.vue`：面板互斥、新楼层导航、响应式排布、伙伴与物品。
- `src/render/PixiRenderer.ts`、`strataScene.ts`、`companionVisual.ts`、`explorationScene.ts`：场景装配、纵深色彩、伙伴美术、镜头、乘梯与工具表现。
- `tests/deep.test.ts`、`deep-chapter.test.ts`、`fixtures/deepWorld.ts`、`manual/crystal.html`、`manual/crystal.ts`；扩展 `attention-contract.test.ts`、`audio.test.ts`、`terrain-renderer.test.ts`，更新 `partners.test.ts`、`world.test.ts` 的蓝图事实。
- `README.md`、`docs/LAYER3_SCOPE.md`、`docs/GAME_MASTER_DESIGN_V1.md`、本验收目录。

启动前已存在的房间面板、物品图、旧照片／钥匙、设施与房间建设等未提交改动继续保留。它们涉及 `facilityPanel.ts`、`roomEditor.ts`、`RoomTools.vue`、`roomConstruction.ts`、`rooms.ts`、`collectionScene.ts`、`roomScene.ts`、部分既有测试、`docs/ART_PLAN.md` 和 `png素材/`，不将其全部归为本轮第三层新增内容。
