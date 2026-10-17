# 入口梯架与顶灯 v1

使用 Codex 内置 imagegen 分两次生成，均设置 `transparent_background: true`。未使用CLI/API fallback，原图及alpha原样保留，未抠图或重绘。

| 素材 | 实际规格 | 字节数 | 完全透明像素 |
| --- | --- | --- | --- |
| `shaft-ladder-v1.png` | 1024×1536 RGBA | 1,449,719 | 1,212,348 |
| `ceiling-lamp-v1.png` | 1254×1254 RGBA | 1,292,642 | 835,166 |

两图四角alpha均为0，梯架踏棍间隙抽样alpha为0。没有背景场景或岩墙。

- 梯架：木质踏棍、蓝灰金属固定件与黄铜螺栓；以原入口竖井顶部为起点，透明画布显示高160世界像素，保持源图比例。
- 顶灯：同系金属灯壳及玻璃灯芯；透明画布显示宽32世界像素，实际灯芯锚点为`(0.5, 0.59)`，与原7个程序化灯光中心重合。
- PNG均使用linear过滤和mipmap；固定结构位于原黑暗遮罩之下，只创建一次，刷新地标不重建。
- 灯壳未通电时压暗为`0x666666`，随原有点亮进度恢复到原图亮度；光晕、灯芯亮度、闪动和逐盏时序仍由原程序绘制。
- 仅新增这两件美术；不改变入口、地图格子、互动范围或存档。

## 梯架最终生成提示词

```text
Use case: stylized-concept.
Asset type: ONE transparent PNG game sprite, an entrance ladder for Underground Home, a welcoming 2D side-view underground shelter game for seven-year-old children.
Primary request: a tall narrow ladder fixed into a vertical underground shaft, seen straight-on from the FRONT. Two continuous sturdy honey-brown wooden side rails with 11 clearly separated chunky wooden rungs; a small number of desaturated slate-blue metal wall brackets and worn brass bolts securing the rails. Practical, friendly, gently worn, maintained and safe-looking. No broken parts.
Style/medium: hand-painted 2D game asset with softly faceted wood and metal surfaces, simple readable silhouette, restrained surface texture. Match a painterly slate-blue underground energy generator with brass fittings, blue-gray rock and warm brown soil. Readable at only about 26 to 36 pixels wide in the game.
Composition/framing: tall portrait canvas, ideally 1024 by 1536, with a single complete narrow ladder centered. Ladder occupies about 94% of canvas height and 27% of canvas width, including its small wall brackets. Full top and bottom visible, straight parallel rails, uniform rung spacing. Orthographic FRONT view, no isometric tilt, no perspective convergence.
Scene/backdrop: genuinely transparent alpha outside and BETWEEN the rungs and rails. No rock, cave, shaft wall, hatch, room, ground, support platform, characters or other props. No background shadow or colored rectangle.
Lighting: soft neutral upper-left highlights, no glow, no environment lighting baked into the image.
Constraints: ONE ladder only, not multiple variants or a sprite sheet. No text, letters, numbers, logos, UI or watermark. Clean transparent edges. Do not add buildings or decoration.
```

## 顶灯最终生成提示词

```text
Use case: stylized-concept.
Asset type: ONE production-ready transparent PNG sprite, a small ceiling-mounted utility lamp for Underground Home, a friendly 2D side-view underground shelter game for a seven-year-old child.
Primary request: a compact round industrial bulkhead lamp attached to a short sturdy ceiling mounting plate. Desaturated slate-blue painted steel outer housing, a few worn brass bolts and a clear thick brass bezel around ONE circular frosted-cream glass lens. Simple rounded safe-looking hardware, readable at 24 to 32 screen pixels wide. Match a hand-painted slate-blue energy generator with brass fittings and warm wooden shaft ladder.
Style/medium: softly faceted hand-painted 2D game art, restrained texture, broad readable shapes and gentle wear. Orthographic FRONT view, no isometric perspective.
Composition/framing: one centered isolated lamp on a square canvas. Full fixture including its short top bracket inside the canvas. Visible hardware occupies about 82% of canvas width and 82% of canvas height. The circular glass lens center must be at 50% of full canvas width and 65% of full canvas height; lens diameter about 31% of the full canvas width. The thick mounting plate is above the lens, suitable for anchoring into a rock ceiling. Nothing crossing the lens center so the game can overlay a small circular light.
Scene/backdrop: genuinely transparent alpha outside the complete lamp, and in any holes around the bracket. No ceiling, rock, room, cable, chain, rope, people, other props or environment. No cast-shadow rectangle.
Lighting: neutral unlit fixture. The lens is opaque dull pale cream with a soft material highlight; NO baked glow, no radiating light, bloom, beams, particles, or lit background. Runtime code supplies all light and brightness.
Constraints: ONE lamp only, not a sprite sheet, no variants, no text, letters, numbers, logos, watermark or UI. No house or street lamp silhouette, no dangling lantern. Clean transparent edges.
```
