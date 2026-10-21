# 阿土双爪挖土姿势 v1

日期：2026-10-20。使用内置 `image_gen.imagegen` 编辑 `atu-idle-v1.png`，`transparent_background=true`，未使用 CLI/API 模式。

## 文件和对齐

- `atu-dig-side-v1.png`：512×640 RGBA，向右侧挖，替换原有双手位置。
- `atu-dig-up-v1.png`：512×640 RGBA，双手举过头顶，用于高处与短踏台。
- 两帧脚底中心统一为 `(256,630)`，以512源像素对应40世界像素的身体比例显示。运行时水平翻转朝左，围绕脚底蓄力和收招。
- 原图均1121×1403且含实际透明通道；仅裁切、等比缩放、透明填边及PNG压缩，没有手工抠图或补画肢体。
- 侧挖裁切 `(11,26,1103,1333)`，缩至424×512，身体脚底中心原图x=500；向上裁切 `(140,32,943,1326)`，缩至395×556，以原图头顶136至脚底1358的1222px高度对应512px身体高度，身体脚底中心原图x=562。
- 施工时替换完整角色纹理，不保留站姿双手再加手臂。泥屑仅在命中后出现。姿势属于渲染资源，不进入存档。

## 最终提示词

### 侧挖

```text
Use case: identity-preserve. Edit target: the provided transparent full-body game sprite of Atu. Produce ONE replacement animation pose of exactly the SAME mole, facing RIGHT in three-quarter view. Change ONLY the pose of his EXISTING TWO arms and paws: lean his torso slightly forward and extend BOTH short natural forearms toward the right, the nearer paw at chest height reaching to scratch a vertical dirt wall just beyond his right side, the other paw slightly behind it. Exactly two arms total, each emerging from its original shoulder, exactly two paws total, three rounded ivory claws per paw; remove the original belly-held paw positions entirely, smooth continuous cream belly. Keep identical character identity, bronze round glasses, friendly eyes, pink nose, warm taupe fur, cream belly, face/head shape, body proportions, tiny planted feet and soft painterly shading. Full body visible, no wall, no dirt, no tools, no effects, no props, no text, no shadow. Actual transparent alpha background. Feet flat at the bottom, keep body upright enough for a 40-pixel-tall game character. Short compact natural arms, no long rubber arms. One character, not a sprite sheet.
```

### 向上挖

```text
Use case: identity-preserve. Edit target: the provided transparent full-body game sprite of Atu. Produce ONE replacement animation pose of exactly the SAME mole, facing slightly RIGHT in three-quarter view. Change ONLY the pose of his EXISTING TWO arms and paws: raise BOTH short natural forearms above his head to scratch soil on a ceiling overhead; look up slightly, both elbows bent and paws reaching upwards just over the top of his head, claws pointing UP. Exactly two arms total emerging from their original shoulders and exactly two paws total, three rounded ivory claws per paw; REMOVE the old belly-held paws entirely, smooth continuous cream belly. Keep identical character identity, bronze round glasses, friendly eyes, pink nose, warm taupe fur, cream belly, head/body shape, proportions and soft painterly shading. Whole body, feet planted flat. No soil, no wall, no tools, no effects, no props, no text, no shadow. Real transparent alpha background. Compact natural arms, readable at 40px body height. One character, not a sprite sheet.
```
