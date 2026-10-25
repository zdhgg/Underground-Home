# 第八层 · 旧地脉遗迹美术

2026-10-26。使用内置 ImageGen 生成三张图片，直接复制原始生成文件进项目，没有脚本改图。提示词与透明背景要求如下。独立文件规格、alpha 和 SHA-256 见 manifest.json。

| 文件 | 用途 |
| --- | --- |
| mosaic-v1.png | 嵌入石拱的三个空石槽；修复图案和九枚小爪印由 Pixi 随存档状态叠加 |
| desk-v1.png | 岩壁拓印工作台；放置软纸、刷子和炭笔 |
| folio-v1.png | 拓印剧情和物品栏故事册插画 |

原岩画的灯、水、交叉工具、护拱、梯子、柔光灯、石凳和小爪印使用项目原生 Pixi 绘制；不另加房屋外壳。图案分为未辨认和已看清，修复石壁三槽分别出现对应图案。人物始终在设施和图案前侧，选址框独立在前侧。

七类音效由 ruinsSound.ts 使用本地 WebAudio 合成：凿岩、建造、发现、拓印、修复、添页亮灯、章节完成，经过统一音量、静音与后台门禁。没有外部素材链接、音频下载或新增依赖。

已查看生成原图；图片查看和对象叠层测试不等同于浏览器实景验收。本轮浏览器工具设置禁用了本地控制，实际图案落在石槽中的位置、缩放清晰度和音量仍待实景检查。

## 实际提示词

### mosaic-v1.png

Use case: illustration-story. Transparent wide 2.5:1 sprite for a cozy children's underground cutaway home game. An ANCIENT LIMESTONE STORY WALL embedded into natural cave rock, with three clearly separated EMPTY shallow recessed stone panels left, middle, right inside one low rounded arch frame. The panels are dark plain stone, absolutely no drawings inside: game will overlay lamp, water, tools symbols and restoration progress. Weathered stone, tiny moss at corners, muted amber mineral veins, delicate old copper ties. Front-facing orthographic cross section, hand painted textured gouache, compact irregular silhouette, readable at 180px wide. No writing, runes, letters, numbers, characters, roof, sky, full room, cast shadow or rectangular background. True transparent alpha outside irregular stone silhouette.

### desk-v1.png

Use case: illustration-story. Transparent wide 2:1 game sprite: a small stone-backed rubbing and restoration workbench EMBEDDED in a natural underground limestone alcove. Worn low oak tabletop, two rolled cream rubbing sheets, tiny soft brush, charcoal stick, a smooth rounded stone paperweight, amber lantern. Quiet archaeological children's storybook atmosphere. Orthographic side-on underground cutaway, textured hand-painted gouache, warm wood and cool grey stone, compact clear silhouette, readable at 128px wide. Papers have NO drawings or writing. No characters, extra room, roof, sky, text, runes, letters, numbers, background or cast shadow. True transparent alpha.

### folio-v1.png

Use case: illustration-story. Transparent standalone collectible illustration for a cozy hand-painted children's underground home game. One open small handmade rubbing folio, thick softly worn paper and simple fabric binding, laid in three-quarter front view. Two blank parchment pages, a short charcoal stick resting along bottom edge, one tiny ochre cord bookmark. Warm restrained textured gouache matching storybook game assets, centered compact silhouette, readable at 80px. Pages are blank: no text, symbols, drawings, letters, numbers or UI. No surrounding scenery, no background, no cast shadow. True transparent alpha.
