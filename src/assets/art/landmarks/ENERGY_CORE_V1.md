# 能源核心机身 v1

- 文件：`energy-core-body-v1.png`
- 生成方式：Codex 内置 imagegen，`transparent_background: true`；未使用 CLI / API fallback。
- 仅生成一张固定机身，没有生成角色、能源石、梯子、灯具或地形。
- 实际源图：1536×1024 RGBA，2,325,755字节。553,883个像素完全透明，四角alpha为0；完整保留生成结果的alpha，未做抠图或重绘。
- 显示：保持3:2比例，宽128世界像素、高约85.33世界像素；linear过滤，mipmap。
- 锚点：`(0.5, 0.46)`，将实际图中的圆形槽心对齐原能源核心世界坐标。
- 动态内容：三态颜色、呼吸、启动闪烁与光晕使用原程序化渲染；灯芯半径调整为15/8世界像素以嵌入新槽口。
- 机身在原结构层，受地下黑暗遮罩影响；状态灯在原发光层。没有改变交互范围、世界网格或存档字段。

## 最终生成提示词

```text
Use case: stylized-concept.
Asset type: one production-ready transparent PNG game sprite for Underground Home, a 2D side-view underground shelter-building game for a seven-year-old child.
Primary request: a welcoming, sturdy wall-mounted energy-core generator, visibly engineered to be bolted into an underground rock cavity, with a broad readable silhouette, rounded metal housing, an obvious central circular energy socket, short attached copper pipes and steel mounting brackets, and a compact foundation integrated into the machine.
Style/medium: hand-painted 2D game asset, softly faceted surfaces and restrained surface texture, matching painterly blue-gray rock tiles and warm brown soil. Cool desaturated slate-blue / muted teal painted steel, worn brass and copper accents. Small number of chunky readable components, friendly and practical, no busy microdetail.
Composition/framing: straight-on orthographic FRONT view, NO isometric perspective. A single isolated horizontally proportioned machine centered on a square transparent canvas. All machine parts fully inside the canvas. Main machine silhouette occupies about 90% of canvas width and 62% of canvas height; transparent padding above and below. The circular socket must be exactly at the center of the full canvas (50% width, 50% height), its opening diameter about 29% of the full canvas width. Leave a clear dark neutral recessed socket interior so procedural status lights can be drawn on it. A clearly defined thick metal ring surrounds the socket, with no crossbars or decorations covering its center.
Lighting/mood: soft neutral upper-left illumination, readable even at an on-screen width of 128 pixels. Inactive chassis only: no glowing parts, no colored status LEDs, no baked light bloom.
Scene/backdrop: genuinely transparent alpha outside the machine, with transparent gaps between pipes and brackets; NO rock wall, room, terrain, sky, ground plane or shadow rectangle.
Constraints: ONE machine sprite only, no people, no extra props, no text, letters, digits, logos, UI, arrows, frames or watermark. No house silhouette, roof or freestanding surface building. Do not render a sprite sheet or alternative states. Preserve a clean alpha edge.
```
