# 三位伙伴角色素材 v1

日期：2026-10-18。使用内置 `image_gen.imagegen`，非CLI/API模式。

## 交付素材

| 角色 | 文件（本目录） | 尺寸 | 两帧共用裁切框（原图坐标） |
| --- | --- | --- | --- |
| 阿灯 | `adeng-idle-v1.png` / `adeng-blink-v1.png` | 523×512 RGBA | `{"left":39,"top":22,"width":1196,"height":1171}` |
| 小满 | `xiaoman-idle-v1.png` / `xiaoman-blink-v1.png` | 311×512 RGBA | `{"left":274,"top":5,"width":754,"height":1240}` |
| 小泉 | `xiaoquan-idle-v1.png` / `xiaoquan-blink-v1.png` | 472×512 RGBA | `{"left":61,"top":17,"width":1116,"height":1211}` |

六张原图均1254×1254，具有真实透明通道。每位角色用两帧alpha包围盒的并集加8px留白，统一裁切后等比缩至512px高；保留alpha，只做工程裁切、缩放和PNG压缩。运行时对闭眼图做头部纹理区域采样，用于睡眠，不另下载睡眠图片。

- 阿灯：36世界像素高（含触角）、睡眠头部28px，向上偏移8px；原躲藏、点亮后飞回大厅演出保留，尾光由代码轻微脉动。
- 小满：44世界像素高（含竖耳）、睡眠头部32px，向上偏移11px，避免耳朵占高后眼睛藏进被子；一立一垂的耳朵和两颗门牙为辨识特征。
- 小泉：40世界像素高、睡眠头部28px，向上偏移3px；沙黄色身体、奶油色脸、胡须与粗尾巴。
- 三位角色脚底均以原身体中心下13px作为落点；阿灯在该落点内部轻微漂浮。
- 睡眠仍套用原有0.65倍入床缩放；两间舱、床位间距和寻路均保留。
- 每位素材独立加载/回退；一对图片失败只影响这一位，不阻止其他伙伴显示或游戏启动。
- 目前是静态图片加程序化呼吸、眨眼、轻跳/摇摆，不含完整肢体逐帧动画。

## 生成输入与来源

新图的唯一风格参考是已有 `atu-idle-v1.png`；不是编辑阿土。闭眼帧分别编辑对应角色的新图，要求保持形状与位置。六次调用均使用 `transparent_background=true`；新图用 `referenced_image_paths` 指向阿土，闭眼帧指向各自新图。完整提示词如下。

### 阿灯 · 睁眼新图

```text
Use case: illustration-story. Production transparent PNG full-body sprite for a 2D underground home-building game for 7-year-old children. Input Image 1 is ONLY a STYLE REFERENCE (the existing mole Atu); do NOT draw the mole. Match its soft hand-painted storybook rendering, gentle rounded volume, friendly expressive eyes, warm upper-left lighting, clear contour and readable small-scale shapes. One character only, isolated on genuine transparent alpha background, no floor, no cast shadow, no scenery, no text, no props, no clothes, no white sticker border. Strict orthographic side-game asset in three-quarter view facing slightly RIGHT, see both eyes. Whole body visible, centered with clear margin, occupies 85% of square image. Face and silhouette must read at 36-44 pixels high.
Subject: Adeng, a shy and gentle FIREFLY friend, definitely an insect not a furry mammal or fairy. Compact lavender-purple teardrop body, large kind dark eyes with white highlights, tiny warm smile, two slender dark-purple antennae with tiny round tips, two pairs of delicate semi-transparent pale lavender wings spread behind the body. Six small rounded insect limbs, simplified. Her abdomen's lower rear tip is a distinct large round pale yellow-green bioluminescent lantern segment (an organic part of her body, not a handheld object) positioned at the LOWER CENTER just above the lowest point of the sprite, plainly visible, approximately 15% of full sprite height. Paint only the softly luminous tail segment itself, with NO surrounding glow haze or baked radial halo: the game animates that glow. Floating upright, small limbs gently tucked, shy and kind. Wings must be visible against dark cave yet translucent. Palette lavender #b9a7e0, muted violet contour, cream-yellow tail light. Avoid photorealistic insect anatomy, spiky limbs, butterfly antenna curls, fur, nose, round ears or eyeglasses.
```

### 阿灯 · 闭眼编辑

```text
Use case: identity-preserve. Edit the attached adeng game character sprite into a perfectly aligned closed-eye blink/rest frame of the SAME character. Change ONLY the two open eyes into gently closed, peaceful curved eyelids and the mouth into a small closed relaxed smile. Keep EXACTLY the same body, pose, silhouette, proportions, wing transparency, antennae, ears, paws, feet, tail, colors, shading and lighting, and EXACTLY the same position and scale on the transparent canvas. Keep the tail light exactly as it is, and preserve every wing and small limb. Do not recline, curl up, add a blanket, add scenery or change any body part. It is an animation frame to overlay the original so alignment matters. Keep genuine transparent alpha, one character, no text, no background, no cast shadow.
```

### 小满 · 睁眼新图

```text
Use case: illustration-story. Production transparent PNG full-body sprite for a 2D underground home-building game for 7-year-old children. Input Image 1 is ONLY a STYLE REFERENCE (the existing mole Atu); do NOT draw the mole. Match its soft hand-painted storybook rendering, gentle rounded volume, friendly expressive eyes, warm upper-left lighting, clear contour and readable small-scale shapes. One character only, isolated on genuine transparent alpha background, no floor, no cast shadow, no scenery, no text, no props, no clothes, no white sticker border. Strict orthographic side-game asset in three-quarter view facing slightly RIGHT, see both eyes. Whole body visible, centered with clear margin, occupies 85% of square image. Face and silhouette must read at 36-44 pixels high.
Subject: Xiaoman, a cheerful hungry little RABBIT friend. Soft muted blush-pink and peach fur (#e9b6a7), ivory muzzle and oval belly, small pink nose, friendly round dark eyes, two distinct small front teeth in an eager smile. Tall rabbit ears: ONE ear stands vertically, the OTHER ear FLOPS visibly sideways/down, both pink inside. Distinctly rabbit silhouette: slimmer and taller than the squat mole reference, round hips and sturdy elongated rabbit feet, little round cream puff tail visible behind the right hip. Two little front paws held together near her belly expectantly, no object. Full body standing on both feet. Happy impatient expression, friendly and playful. Large simple shapes, no fine fur strands. Avoid two upright matching ears, hamster proportions, eyeglasses, clothing, vegetables or accessories.
```

### 小满 · 闭眼编辑

```text
Use case: identity-preserve. Edit the attached xiaoman game character sprite into a perfectly aligned closed-eye blink/rest frame of the SAME character. Change ONLY the two open eyes into gently closed, peaceful curved eyelids and the mouth into a small closed relaxed smile, retaining the two small front teeth just visible. Keep EXACTLY the same body, pose, silhouette, proportions, wing transparency, antennae, ears, paws, feet, tail, colors, shading and lighting, and EXACTLY the same position and scale on the transparent canvas.  Do not recline, curl up, add a blanket, add scenery or change any body part. It is an animation frame to overlay the original so alignment matters. Keep genuine transparent alpha, one character, no text, no background, no cast shadow.
```

### 小泉 · 睁眼新图

```text
Use case: illustration-story. Production transparent PNG full-body sprite for a 2D underground home-building game for 7-year-old children. Input Image 1 is ONLY a STYLE REFERENCE (the existing mole Atu); do NOT draw the mole. Match its soft hand-painted storybook rendering, gentle rounded volume, friendly expressive eyes, warm upper-left lighting, clear contour and readable small-scale shapes. One character only, isolated on genuine transparent alpha background, no floor, no cast shadow, no scenery, no text, no props, no clothes, no white sticker border. Strict orthographic side-game asset in three-quarter view facing slightly RIGHT, see both eyes. Whole body visible, centered with clear margin, occupies 85% of square image. Face and silhouette must read at 36-44 pixels high.
Subject: Xiaoquan, a calm gentle little OTTER friend. Sand-golden/tan fur (#e5cf95) with creamy round muzzle, cheek patches and belly. Small round ears, dark brown bean nose, dark kind eyes, THREE clear short whiskers on each cheek. An elongated softly pear-shaped upright body, short rounded paws held comfortably in front of the belly, sturdy little webbed feet, and a prominent BROAD THICK OTTER TAIL curving out behind the lower left side, ending in a softly tapering flattened oval. No beaver paddle texture: this is a river otter. The tail should be clearly visible but not dominate the body. A slight wet sheen as a few broad soft highlights on head and shoulders, not water droplets or splashes. Slow, mellow, friendly expression with a small closed smile. Standing alone with feet flat on the baseline. Avoid bear/hamster silhouette, beaver teeth, glasses, clothes, held objects or water scenery.
```

### 小泉 · 闭眼编辑

```text
Use case: identity-preserve. Edit the attached xiaoquan game character sprite into a perfectly aligned closed-eye blink/rest frame of the SAME character. Change ONLY the two open eyes into gently closed, peaceful curved eyelids and the mouth into a small closed relaxed smile. Keep EXACTLY the same body, pose, silhouette, proportions, wing transparency, antennae, ears, paws, feet, tail, colors, shading and lighting, and EXACTLY the same position and scale on the transparent canvas.  Do not recline, curl up, add a blanket, add scenery or change any body part. It is an animation frame to overlay the original so alignment matters. Keep genuine transparent alpha, one character, no text, no background, no cast shadow.
```

