# 能源石 v1

- 文件：`energy-crystal-v1.png`。
- 生成方式：Codex 内置 imagegen，`transparent_background: true`，没有使用 CLI / API fallback。
- 实际源图：1254×1254 RGBA，925,229字节；alpha范围0—255，1,062,320个像素完全透明，原始透明通道完整保留。未抠图、重绘或合成。
- 显示：透明画布高48世界像素，晶体实际轮廓约46像素；保持原比例、中心锚点，linear过滤和mipmap。
- 仅新增这一张能源石 PNG。微光、光晕、收集粒子、安装尾迹和核心状态灯由程序绘制。
- 埋藏时只显示原微光；挖开显示PNG；收集后移除地图上的PNG，上浮缩小反馈持续0.45秒。
- 安装时复用同一PNG，从核心左下附近的携带位置沿弧线进入槽心，持续0.7秒，再触发原启动闪烁、点灯和庆祝。
- 动画无世界数据、存档字段或定时器；存档恢复不重播，快速安装可覆盖尚未结束的收集尾迹。

## 最终生成提示词

```text
Use case: stylized-concept.
Asset type: ONE production-ready transparent PNG sprite, a collectible energy crystal for Underground Home, a friendly 2D side-view underground shelter game for a seven-year-old child.
Primary request: a single chunky faceted turquoise-blue energy crystal, an upright slightly asymmetric hexagonal mineral with a pointed top and short tapered base. A strong simple silhouette, five or six broad readable facets, a bright pale-cyan face, deeper blue shaded faces, restrained hand-painted surface texture and tiny soft highlights. This is the energy source that fits inside a round brass-and-slate-blue underground generator; keep a painterly softly faceted 2D game style matching that machine and blue-gray rock terrain.
Composition/framing: orthographic FRONT view. One isolated crystal centered on a square canvas. Crystal silhouette should occupy about 60% of the canvas width and 82% of its height. Entire crystal visible, equal transparent padding, no cropped edges. It must remain clearly recognizable when displayed about 36 to 44 pixels high in the actual game.
Scene/backdrop: genuinely transparent alpha outside the crystal. No room, ground, stone slab, pedestal, mining tools, frame, UI or other objects.
Lighting/mood: friendly, clear, luminous-looking colored facets but NO baked outer glow, light rays, sparkles or floating particles; the game renders its own halo and collection effects. Soft neutral upper-left highlights. No photorealistic jewelry or glass product-photo appearance.
Constraints: ONE crystal only, not a cluster, not a sprite sheet, no alternative states. No text, numbers, logos, watermark or checkerboard background. No metal socket or machine parts. Keep clean transparent edges.
```
