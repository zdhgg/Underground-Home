# 功能先行的房间建设验收

日期：2026-10-18。未提交或发布。范围见[实施决策](../../ROOM_CONSTRUCTION_SCOPE.md)。本次改造建房流程，没有启动个人床、厨房或共同生活阶段。

## 已实现

- 选功能、预览宽度/层高/最大容量、自由选址、保存施工蓝图；蓝图不改土、不提前生成床或菜。
- 点土仍走原阿土行动：逐格移动、地面/向上/踏台施工；挖好并接通两格高走道后才允许确认。梯口旁新增实地矮凳向正上方施工，避免侧向踏台无处落脚导致死角。
- 住处自动安置双人床位，种植区建好后接水启用，客厅安排公共休息座。基础设施避开旧设施与保护点；旧床和旧苗保留。
- 后侧设施、前侧走道和开放门框；阿土与伙伴沿真实地面穿过房间，泥土、岩石及楼层梯道继续约束移动。
- 扩建保留原房间，完工后沿用ID、补新增容量；可取消蓝图或撤销完工，保留已挖空间。撤销保护人物和回家通路，不回滚水、食物、收成及学会的能力。
- v12持久化蓝图、扩建关系、后侧床位和自动菜槽归属；兼容旧成果，加载失败不覆盖原档。

## 工程结果

- `npm test`：**26个测试文件、301项通过**。
- `npm run build`：**类型检查与生产构建通过**。主包约539.92 kB，仍有原有的单包超过500 kB提示；本次未做打包拆分。
- 生产预览：`http://127.0.0.1:5191/`，使用独立Chromium上下文，不改玩家浏览器存档。桌面1440×960、小屏900×620，另有真实触摸上下文检查。
- 自动实景结果见[browser-report.json](browser-report.json)，控制台无运行时错误。自动检查不替代儿童实际理解、选址手感和美术偏好的试玩。

## 实景复现与截图

1. 新开局，实际指挥阿土挖出能源石、收集并修核心；打开“建房与扩建”，选住处，查看[功能与大小预览](01-function-size-preview.png)。
2. 放蓝图后瓦片与床位保持不变；逐格挖掘，三格高处有施工道具，见[施工中](02-real-construction.png)。[中途真实存档](partial-save.json)刷新后可继续施工；确认后才产生床位，见[第一间住处](03-first-home-built.png)。
3. 扩为6格宽，施工期间保留原房间，完成后有4个床位；阿土从前侧经过两组床。[扩建与前侧走道](04-expanded-home-front-passage.png)、[真实扩建存档](expanded-home-save.json)。撤销只回到原房间与扩建蓝图，已挖空间保留；再次完成和刷新均正常。
4. 读取此前实际玩到泉水的v8存档，在右侧从土中挖出5格种植区，确认后仍无作物，见[建好等水](05-built-garden-waiting-for-water.png)。由小泉实际接通管道后自动启用2个菜槽，见[接水启用](06-water-activates-room.png)、[真实种植区存档](garden-save.json)；刷新保持。
5. 读取v11阿灯升级实测存档，逐项比对地形、旧房间、床、水电、食物、苗、灯罩和人物位置，均保持原值。900×620的[规划面板](07-narrow-blueprint-controls.png)主操作可达，长列表可滚动；损坏施工状态会显示失败提示，原存档不被覆盖。
6. 900×620真实触摸：选已有蓝图，拖图不挖土，点土实际施工，取消蓝图保留挖掘，撤销恢复蓝图，再完成高处施工并确认；[触摸建成画面](08-touch-construction-complete.png)。刷新后床和房间保留。

## 主要变更文件

- 规则：新增`src/core/roomConstruction.ts`、`src/core/passages.ts`；调整`rooms.ts`、`world.ts`、`build.ts`、`atu.ts`、`exploration.ts`、`history.ts`和`persistence.ts`。
- 交互：`src/app/roomEditor.ts`、`atuOrders.ts`、`session.ts`、`src/components/RoomTools.vue`、`src/App.vue`；引导与对话同步到`missions.ts`、`partnerInteractions.ts`。
- 表现：`src/render/roomScene.ts`、`sleepPods.ts`、`friendRoutes.ts`、`atuConstruction.ts`、`PixiRenderer.ts`。
- 验证：新增`tests/room-construction.test.ts`，调整`rooms.test.ts`、`session-exploration.test.ts`、`atu-orders.test.ts`、`atu-construction.test.ts`；同步README与阶段方案。

## 本次边界

首层建设带、三种既有功能、最大9格宽；不开放深层建房或全部岩石。房间升级本轮体现为扩建增容，阿灯既有照明能力继续保留；没有额外房间等级、材料或经验系统。客厅本轮提供休息座与公共空间，未新增聚会行为或属性加成。已建新房暂不提供拆除/改用途，施工蓝图可调整或取消；旧档功能与设施不要求重建。撤销记录只保留本次会话。
