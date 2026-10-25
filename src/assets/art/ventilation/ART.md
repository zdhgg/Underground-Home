# 第七层 · 听风工区美术

2026-10-26。使用内置 ImageGen 生成并复制到本项目；未使用 CLI、外部素材或脚本改图。原始生成文件保留在本机 generated_images。

| 使用文件 | 用途 |
| --- | --- |
| `lingling-v1.png` | 蝙蝠铃铃独立角色与头像，地图身高 43px，折翼沿通道移动，耳侧回声线表示听风工作 |
| `fan-v1.png` | 嵌入石拱的空风机机壳；四片木叶由 Pixi 绘制，关机停止、微风慢转、工区风快转 |
| `bench-v1.png` | 嵌岩手作台，带铜管和木片；工作小风车、成品和大厅风铃另用 Pixi 绘制 |

进风格栅、消音百叶、施工护框、风管、飘带、风标、回声石和两种手作采用项目原生绘制。新增七类音效由本地 WebAudio 合成，共用游戏声音开关；没有外部音频 URL。

三张图均为 RGBA。角色／手作台 alpha 为 0—255；风机为 0—254，主体近不透明，外缘保留生成的 alpha。实际规格、字节数、SHA-256 见 `manifest.json`。风机第二次背景清理试稿仍保留相近轮廓，未采用；运行时继续使用 v1，所有消费路径均指向本项目文件。

已查看三张最终原图。原图审查和 Pixi 对象测试不等同于实景验收；当前浏览器工具设置禁止本地浏览器使用，实际缩放、转叶对齐、叠层与色彩尚待检查。

## 实际提示词

### lingling-v1.png

Use case: illustration-story. Transparent full-body sprite of ONE friendly tiny bat called Lingling for a cozy hand-painted children's underground home game. Exactly two kind eyes and two tall bat ears, soft taupe-purple fur, small round nose, a muted ochre neckerchief. Clearly recognizable bat with two folded membranous wings at sides and small feet, relaxed upright stance three-quarter facing right, entire compact silhouette visible. Storybook textured gouache, soft warm shaded edges, readable at 43 pixels tall. No scary fangs, extra eyes, clothes beyond scarf, tools, text, scenery, UI or background. True alpha transparent background.

### fan-v1.png

Use case: illustration-story. Transparent game asset: an underground ventilation fan HOUSING embedded into a grey limestone arch recess, side-on orthographic underground cutaway. Round dark EMPTY opening centered in a broad stone wall arch, thin aged copper rim, small external green motor and copper connection on right, moss only at outer corners. IMPORTANT: no rotor, no blades, no spokes inside circular opening; the game will draw rotating wooden blades inside it. Compact landscape 1.5:1 silhouette, textured hand-painted storybook gouache matching a warm children's underground home game. No surface building roof, text, lettering, characters, sky, full room or background. True alpha outside silhouette.

### bench-v1.png

Use case: illustration-story. Transparent wide 2:1 game asset of a small underground tinkering workbench set into a natural limestone alcove. Warm worn oak tabletop, two tiny copper chime tubes, a spool of muted teal ribbon, a little wooden pinwheel resting on tabletop, short shelves of smooth wood pieces, one amber lantern. Stone supports and back wall merge into cave rock. Side-on orthographic cutaway, cozy textured hand-painted storybook gouache, readable at 155 pixels wide. No characters, text, numbers, logos, surface house roof, full room or background. True alpha outside compact silhouette.

### 未采用的风机编辑试稿

Edit the supplied underground fan housing asset. Preserve stone arch, copper rim, green motor, empty dark round opening, proportions and all interior painted details. Remove ONLY all background, smoky gradient, glow, shadow outside the irregular stone silhouette. Entire exterior must be perfectly transparent alpha=0, sharp clean natural silhouette; the housing itself fully opaque alpha=255. No cast shadow or halo anywhere outside rock. Keep the central hole DARK SOLID (not transparent), no rotor blades. Standalone transparent game sprite.

