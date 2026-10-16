# 能源核心 PNG 接入验收

日期：2026-10-17。本轮只升级能源核心机身，未进入新的建设阶段。

## 变更文件

- `src/assets/art/landmarks/energy-core-body-v1.png`：内置 imagegen 生成的透明机身。
- `src/assets/art/landmarks/ENERGY_CORE_V1.md`：真实尺寸、alpha检查、显示规格和完整提示词。
- `src/render/energyCoreTexture.ts`：加载入口、过滤参数、显示宽度和能源槽锚点。
- `src/render/PixiRenderer.ts`：以 PNG 替换旧圆角方框机身；按源图比例显示，并将现有三态灯芯嵌入能源槽。呼吸、启动闪烁、光晕、灯光渐亮及庆祝时序保持原实现。
- `tests/terrain-renderer.test.ts`：资源入口补充机身纹理；新增完整三态渲染回归检查，使用真实 Pixi Sprite 验证比例、坐标、槽心、颜色标签及渲染不写世界数据。

`src/core/`、`src/input/`、`src/app/session.ts`、相机与存档结构没有改动。没有新增依赖。

## 实际验证

- `npm test`：9个文件，82项测试全部通过。
- `npm run build`：vue-tsc 类型检查和 Vite 生产构建通过。
- alpha检查：源文件为1536×1024 RGBA，553,883个像素完全透明，四角透明；机身未带入固定场景或背景矩形。
- 浏览器使用 `npm run preview -- --host 127.0.0.1 --port 4174`，在独立本地端口走新存档的0/3 → 1/3 → 2/3 → 3/3流程。
- 检查了灰色待修复、暖橙色呼吸、绿色运行的真实画面；能源石发现、收集和点击原核心区域仍能正常推进任务，顶灯依次点亮。
- 2.2倍近景检查机身、管线、能源槽和状态灯对齐；PNG按比例显示，无拉伸。
- 0.6倍全景仍可辨认核心位置与绿色状态；拖动、放大和回到家园可正常使用。
- 刷新后等待素材加载，任务仍为3/3，机身、绿色状态灯和大厅灯光均正常恢复；浏览器 warn/error 日志为空。

## 截图

均为生产构建实景，未合成或润色。

| 文件 | 说明 |
| --- | --- |
| [01-idle.png](01-idle.png) | 待修复状态 |
| [02-ready.png](02-ready.png) | 收集能源石后，等待安装 |
| [03-ready-closeup.png](03-ready-closeup.png) | 2.2倍近景，机身与暖色状态灯 |
| [04-running-wide.png](04-running-wide.png) | 点亮演出完成后的家园全景 |
| [05-running-closeup.png](05-running-closeup.png) | 2.2倍近景，绿色运行状态 |
| [06-reloaded-home.png](06-reloaded-home.png) | 刷新恢复存档后的实际画面 |

## 当前限制

- 机身只有一张固定图，状态灯与演出由程序控制；没有新增机身帧动画。
- 保留生成原图约2.33MB，尚未做运行贴图降采样；本地预览可正常加载，后续发布前可按目标设备另做资源体积优化。
- 待用户验收美术风格和小尺寸辨识度；能源石、梯子和灯具素材留在后续阶段。
