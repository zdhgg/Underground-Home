# 第九层 · 地心暖光终章美术

2026-10-26。使用内置 ImageGen 生成并直接复制三张最终 PNG 到本项目，未使用 CLI、远程素材链接或脚本改图。原始生成文件保留在本机 generated_images。

| 文件 | 用途 |
| --- | --- |
| warm-heart-v1.png | 终章实际使用的心形暖晶；透明背景，晶体留在原岩壁，柔光不代表可挖走的消耗材料 |
| heart-v1.png | 早期水晶洞参考图，保留在本目录，不再接入游戏 |
| table-v1.png | 嵌岩九人长桌与九个后侧小凳，前侧为真实人物保留；食物、清水、风铃和主题装饰由 Pixi 随状态叠加 |
| memory-v1.png | 三行三列九个空格的家园纪念壁，九层回忆标记由 Pixi 绘制 |

图片均查看过原图；桌后共有九个小凳，纪念壁为九个空格。早期三张图片保留生成的 alpha 边缘，不做脚本抠图；`warm-heart-v1.png` 以 `heart-v1.png` 为风格参考生成后，用本地脚本从四角泛洪去除白底并裁切，保留透明 alpha。具体尺寸、alpha、字节数和 SHA-256 见 manifest.json。人物使用已有九位伙伴，不新增替代造型；图案和准备物件在人物后侧，选址框单独在前侧。插画审查与对象测试不能替代实景色彩、遮挡和缩放检查。

暖光台、梯道护框、石凳、九层光路、食物瓶碗、风铃与菌叶用项目原生绘制。八类音效由 finaleSound.ts 在本地 WebAudio 合成：凿岩、建造、发现、接暖光、风铃、开席、翻页、终章；共享音量、静音与后台门禁，没有外部音频下载。

## 实际提示词

### warm-heart-v1.png

Use case: children's game asset, storybook watercolor
Input images: Image 1: style reference only (warm amber crystal cave, hand-painted watercolor, mossy stone frame). Do not copy its composition or exact shapes; borrow only the palette, brushwork, soft edges and paper texture.
Primary request: a single large heart-shaped warm amber crystal formation, clearly readable as a heart, embedded in a small natural stone frame with a little green moss at the base.
Scene/backdrop: fully transparent background, no environment behind the object.
Subject: faceted translucent golden-amber crystal cluster forming a clear heart silhouette, with a soft warm inner glow.
Style/medium: hand-painted watercolor illustration, same warm earthy palette as the reference, gentle paper grain, soft hand-painted edges.
Composition/framing: centered, whole object visible, generous transparent padding, no cropping, no extra objects.
Lighting/mood: warm golden light from inside the crystal, cozy and magical, suitable for a 7-year-old's game finale.
Constraints: heart silhouette must stay clear and readable when scaled down to about 80x54 pixels; no text, no watermark, no characters, no background scenery; transparent alpha background.

### heart-v1.png

Use case: illustration-story. Transparent game asset for a cozy hand-painted children's underground home game: one natural warm amber crystal geode embedded into a low horizontal rough limestone cave recess. Rounded honey golden crystals, tiny soft moss at the edges, muted mineral veins, gentle welcoming light, NOT lava or fire. Orthographic front-facing underground cutaway, textured storybook gouache, irregular compact 1.5:1 silhouette, readable at 100 pixels wide. Natural formation stays in the rock, not a machine. No characters, text, letters, numbers, roof, sky, floor scene, cast shadow or rectangular background. True alpha transparent outside silhouette.

### table-v1.png

Use case: illustration-story. Transparent landscape 3.5:1 game asset: one very long low oak communal feast table set into a broad shallow limestone alcove for a warm children's underground home game. Exactly nine small simple round wooden stools evenly spaced behind the table, all at the back side, leaving the front edge open for nine real game characters. Tabletop is EMPTY, game adds food and water later. Gentle small leaf garland along top of natural rock arch, warm restrained grey stone, ochre wood, moss green; cozy textured hand-painted gouache. Front-facing orthographic underground cutaway, compact clearly readable at 300px wide. No characters, food, bottles, plates, text, letters, numbers, sky, surface building roof, entire room or background. True transparent alpha outside irregular silhouette.

### memory-v1.png

Use case: illustration-story. Transparent game asset: small underground family memory wall built INTO a weathered limestone alcove, with a plain low oak display ledge and exactly NINE small EMPTY square stone niches arranged three by three. Each niche is blank dark stone for game to overlay nine chapter symbols. Soft moss at two corners and tiny copper ties, warm amber edge light, quiet celebratory mood. Front-facing orthographic cave cutaway, hand-painted textured storybook gouache for a children's underground building game. Compact 1.3:1 silhouette readable at 120px wide. No letters, writing, symbols inside niches, characters, roofs, sky, cast shadow, entire room, rectangular background. True alpha transparent outside irregular stone silhouette.
