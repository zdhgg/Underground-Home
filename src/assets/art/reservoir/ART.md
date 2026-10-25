# 蓄水回廊美术 v1

2026-10-25，使用内置 ImageGen 生成。四张透明 PNG 在地图与面板复用，未通过脚本编辑图像。生成原件保存在本机 generated_images，本目录使用版本化副本。

- `tuantuan-v1.png`：河狸团团，全身与扁尾巴；地图身高 43px，独立睡眠裁切和轻量移动、呼吸、转闸动作。
- `basin-v1.png`：空的嵌岩池；0—3 格水位由 Pixi 单独绘制在插画前侧。原画三条琥珀刻线保留。
- `wheel-v1.png`：石拱、水轮与铜泵；原图自带渠内水纹，提水时叠加旋转轴标记与管内水珠，未制作逐帧转轮图集。
- `intake-v1.png`：卵石滤水口与芦苇；不随关闭游戏流失清水。
- 双路闸柄、后壁管渠、水位、送水、芦穗与贝印使用项目原生 Pixi 绘制；五类水工设施继续嵌在洞壁后侧。

已查看四张原图。实景缩放、叠层、色彩与性能仍待浏览器验收；原图检查不等同于游戏截图。

## 实际生成提示词

### tuantuan-v1.png

Transparent full body sprite of one friendly beaver waterworks builder for a cozy hand-painted children's underground home game. Warm brown fur, very recognizable broad FLAT paddle tail visible behind, two small round ears, exactly two kind eyes, two little front teeth, small blue-green cloth neckerchief and a short reed tucked in a belt. Stocky small animal, side-on three-quarter facing right, whole body and tail visible, feet aligned at bottom, standalone character on true transparent background. Textured storybook gouache with soft warm shading, restrained colors, readable at 44px tall. No text, tools in hands, hats, helmet, scenery, water or other characters.

### basin-v1.png

Transparent wide 2.5:1 game sprite, an underground reservoir carved INTO a natural grey limestone cave wall, NOT a surface tank building. Low stone rim, a shallow dark empty basin interior, three small amber level notches at left, copper inlet pipe emerging from back rock. A little moss and rounded smooth water-worn stones. IMPORTANT interior is EMPTY with no water surface so the game can render three changing water levels. Cozy hand-painted textured gouache storybook art, orthographic side-on underground cutaway, readable at 160px wide. No character, text, letters, numbers, sky, surrounding room, UI or background, true alpha outside the compact irregular stone silhouette.

### wheel-v1.png

Transparent landscape 1.6:1 game asset of a small wooden waterwheel and copper pump embedded into a low underground stone arch recess. One clearly visible eight-paddle wooden wheel, slim axle, tiny copper pump outlet and curved discharge pipe. Warm oak, grey limestone, muted verdigris metal. Side-on orthographic cross-section, storybook textured gouache hand-painted illustration matching a cozy children's underground home game, readable at 128px wide. No characters, text, numbers, sky, building roof, whole room, water waterfall or background; transparent alpha outside compact silhouette.

### intake-v1.png

Transparent wide 2:1 game asset: underground spring intake and coarse pebble filter carved into a limestone recess. Short copper pipe emerges from rear wall into a low stone bowl with smooth gravel layers, three green reeds at one edge and a little handwheel on the pipe. Cozy hand-painted storybook textured gouache, orthographic side-on cross-section, grey stone and muted blue-green accents, readable at 96px wide. No characters, text, numbers, labels, sky, surface building, whole room or background; true alpha outside a compact irregular silhouette.

