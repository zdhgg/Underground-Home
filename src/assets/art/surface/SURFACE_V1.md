# 风雪山林地表素材 v1

日期：2026-10-18。使用内置 image_gen 生成和编辑，无 CLI/API 密钥。生成原图原样复制进本目录，未做抠图或重绘。

| 文件 | 尺寸 | 用途 |
| --- | --- | --- |
| storm-horizon-v1.png | 2172×724 RGB | 风暴云层、远山与远林，独立背景层 |
| windwood-snow-v1.png | 2172×724 RGBA | 有积雪的树冠、灌木、岩石与地面，保持中心留白 |
| shelter-mouth-snow-v1.png | 1536×1024 RGBA | 积雪井口、木石结构、右侧暖灯 |
| windwood-v1.png | 2172×724 RGBA | 原始无雪树林，作为冬季编辑的源图保留，不在当前运行包中引用 |
| shelter-mouth-v1.png | 1536×1024 RGBA | 原始无雪入口，作为冬季编辑的源图保留，不在当前运行包中引用 |

树林按原比例摆放三组，实测土边在第648行，脚底锚点为(0.5, 648/724)，排除原图下方透明留白，根部贴住 y=128；仅倾斜树冠。入口按原比例显示112世界像素宽，锚点(0.5, 0.9)，位置(704, 131)；开口约占55%图宽，接两格竖井。雪粒、阵风和远处闪电由程序化天气层提供，远雷18秒一次、1.4秒平滑亮灭，无全屏闪光。

地表装饰不写入存档，不参与挖掘和路径判定。每张素材独立失败降级为程序化景色。未来地表玩法应另设规则模块，可复用本目录分层素材。

当前使用3张原图合计5,860,595字节（约5.86 MB）；后续可统一优化全项目贴图体积。当前未加入天气音效、积雪模拟、伤害或地表探索玩法。

## 最终素材提示词（内置 image_gen）

### storm-horizon-v1.png（生成，不透明）

```text
Use case: illustration-story.
Asset type: opaque panoramic distant background layer for a side-view 2D children's underground shelter building game.
Primary request: a beautiful painterly stormy mountain woodland horizon, extra-wide panoramic 3:1 image. Sky occupies upper 70%, distant overlapping low mountain ridges and misty evergreen woodland occupy bottom 30%. Gentle wind-stretched layered blue-gray storm clouds with soft silver light behind clouds, muted slate blue mountains, desaturated sage-teal distant trees. The mood is windy but safe and inviting, suitable for 7-year-olds.
Style: hand-painted game illustration, chunky softly faceted forms and restrained brush textures matching detailed blue-gray rock tiles, warm brown soil and worn brass machinery. Rich layered atmospheric perspective, no vector-flat look, no photorealism.
Composition: perfectly flat side-scrolling panorama, no perspective ground plane. Mountains stay low, no huge central peak. Continuous full-bleed sky and landscape extending to both edges. Bottom edge dark muted teal. NO foreground objects, NO buildings, NO characters, NO text, NO UI. This is ONLY the distant sky/mountain layer; foreground trees and shelter are separate game sprites. Opaque background. Wide 3072x1024 composition.
```

### windwood-snow-v1.png（编辑 windwood-v1.png，透明）

```text
Use case: lighting-weather.
Edit target: the supplied transparent panoramic woodland sprite. This is a production 2D side-view game asset.
Change ONLY the season/weather to an active WINTER SNOWSTORM: add clearly visible soft blue-white snow caps on the upward-facing pine boughs of EVERY tree, snow on all boulder tops, frosted shrubs and a continuous low irregular snow blanket along the earth baseline. Snow is about 40% of the foliage area, branches still show dark green below the snow. Wind blows left to right, build up snow on left-facing branch edges. Preserve rich painterly blue-gray stone and bark textures and hand-painted faceted children's game style.
Keep the EXACT layout, silhouettes, individual tree positions, open central 35%, flat ground baseline, panoramic 3:1 proportions and fully transparent negative space. Keep ALL original trees and rocks in the same positions. This is an EDIT of the provided layer, NOT a new composition.
CRITICAL: preserve genuine transparency outside the vegetation and ground strip, including spaces between trees. NO sky, NO fog, NO mountain background, NO falling snow particles, NO opaque color background or checkerboard; the game draws moving snowfall separately. No buildings, no text. Snow should be readily visible when this asset is drawn only 190px tall. Do not create a white snow wall across the open center, just a thin ground blanket.
```

### shelter-mouth-snow-v1.png（编辑 shelter-mouth-v1.png，透明）

```text
Use case: lighting-weather.
Edit target: supplied transparent isolated stone-and-timber underground refuge entrance sprite.
Change ONLY weather to winter snowstorm: add thick but natural blue-white snow caps to the TOP of the wooden lintel, top stones and upward facing stone ledges on both abutments. Frost and thin snow patches on moss. Preserve the exact 3:2 front orthographic composition, original structure silhouette, large dark central opening, copper brass corner plates and warm amber lantern on right. Warm lantern melts a little snow directly around itself; entrance interior stays dark and snow-free. Do not block the entrance or add a door. Painterly detailed children's 2D game sprite matching blue-gray underground rocks. Snow clearly readable at 112px displayed width.
CRITICAL: preserve genuinely transparent background outside the object and at the lower central exit. Do not add sky, ground, trees, fog, text, UI or shadow rectangle. No perspective change, no house roof or chimney. Do not add falling snow particles; game draws those separately.
```
