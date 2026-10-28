# 发光蘑菇拾取后的场景清理

## 结果

- 原实现会保留菌根贴图、程序化残光和呼吸光圈，容易被理解为没有拾取成功。
- 改为沿用现有的一次性发现记录：拾取后两处蘑菇整簇消失，只播放一次短暂的采集反馈。
- 原地不再有蘑菇点击区或重复光效，释放种植槽的选址限制。
- 已有存档中的 `foundMushroom: true` 直接采用新表现，不需要重开或迁移存档。

## 交互交接

- 当前关注对象：玩家点击的未拾取蘑菇。
- 主要操作：点击拾取，不新增情境面板或主要推进按钮。
- 退出方式：拾取反馈不锁输入；可以继续点地图或拖动查看，不会强制移动镜头。
- 完成后的交接：一次短暂反馈后，继续当前任务；玩家进入建设时由原有建设面板接管。

## 本次变更文件

- `src/core/exploration.ts`：统一返回仍存在的蘑菇点位。
- `src/core/farm.ts`：说明拾取前后的选址规则。
- `src/render/glowMushrooms.ts`：只绘制未拾取蘑菇。
- `src/render/explorationScene.ts`：移除菌根精灵和动画。
- `src/render/environmentArt.ts`：移除菌根贴图的加载依赖。
- `src/app/session.ts`：一次性拾取反馈与文案，取消空地重复点击特效。
- `tests/glow-mushroom.test.ts`：拾取、读档、后续帧与素材降级回归。
- `tests/nursery.test.ts`：原地释放与读档后种植选址回归。
- `tests/session-exploration.test.ts`：重复点击不再触发蘑菇特效。
- `tests/attention-contract.test.ts`：拾取反馈与原有引导、建设面板之间的真实界面状态检查。

## 验证

- `npm run build`：通过；Vite 提示已有的大于 500 kB 的打包块。
- 四个相关测试文件：115 / 115 项通过。
- 默认全量测试曾因系统可用虚拟内存不足而中断；随后使用 `node --max-old-space-size=384 node_modules/vitest/vitest.mjs run --maxWorkers=1 --pool=threads` 完整通过：58 个文件，693 / 693 项测试通过。
- 实景视觉验收：使用 `tests/manual/crystal.html` 的独立内存测试存档进入泉水层，实际点击左侧蘑菇。拾取前两处蘑菇可见；拾取后两处均消失，没有菌根、残光或光圈。镜头位置、角色与当前引导保持原状，短暂提示自动收起。
- 未完成项：本次范围内无。

## 实景截图

- [拾取前](./before.png)
- [拾取后](./after.png)
