# 阿土角色素材 v1

日期：2026-10-18。由内置 image_gen 生成，非 CLI/API 模式。只升级阿土，不扩展玩法。

## 文件和规格

- `atu-idle-v1.png`：409×512 RGBA，睁眼、全身、朝右。
- `atu-blink-v1.png`：409×512 RGBA，闭眼、同姿态、同画布；用于眨眼和睡眠。
- `atu-portrait-v1.png`：160×160 RGBA，从同一睁眼原图提取头部，用于向导面板。

两张原始生成图都是1254×1254、带实际透明通道。统一裁切框为 `left=184, top=73, width=897, height=1123`，等比缩至512px高；头像裁切框为 `left=320, top=75, width=760, height=760`。只做对齐裁切、缩放和PNG压缩，保留原始alpha，没有抠图或重新绘制造型。

## 运行约定

- 全身显示40世界像素高；脚底中心位于原身体中心下方13px，保留原落点和路径。
- 睡眠复用闭眼纹理的头部区域（从宽度12%处至右边，高度53%），显示28px高，再应用既有0.65倍入床缩放；被子程序绘制。
- 朝向由水平移动决定，垂直移动保持上一次朝向。挖掘工具跟着方向翻转。
- 呼吸、短暂眨眼、步行摆动和挥镐保持程序化；当前不是完整逐帧肢体动画。
- 大厅里的阿土在黑暗遮罩上方按环境亮度轻微压暗，保留面部辨识度；阿灯继续沿用原来的躲藏和点亮演出。
- 大厅与探索共用 `moleVisual.ts`；探索时隐藏大厅分身，取消未落盘移动后恢复。
- 新角色PNG加载失败时，画布退回原程序造型，面板显示“阿土”文字；游戏继续运行。
- 素材只影响渲染与头像，不进入世界数据或存档。

## 最终生成提示词

内置工具：`image_gen.imagegen`，`transparent_background=true`。

### 睁眼主体（新图）

```text
Use case: illustration-story.
Asset type: production transparent PNG full-body character sprite for a side-view 2D underground home-building game for 7-year-old children.
Primary request: Design Atu, one adorable friendly mole, standing alone. Warm storybook cartoon with gentle hand-painted volume, clean bold silhouette, large simple shapes, restrained details so readable at only 40 pixels tall. Three-quarter view facing slightly RIGHT; see both eyes. Short squat pear-shaped warm taupe grey-brown body, cream muzzle and belly, prominent two digging paws with three short rounded ivory claws each, small round dark bronze eyeglasses with clearly visible friendly eyes, tiny dusty-pink nose, tiny ears, sturdy little feet. Warm eager helpful expression. The paws are held naturally by the belly, ready to dig; character leans slightly forward. Recognizably a mole rather than hamster or bear.
Composition/framing: ONE full-body character, feet visible and flat on a shared ground line, centered, fills about 85% of square canvas. Strict orthographic game asset, no perspective floor.
Lighting: soft warm upper-left key light, gentle cool edge separation for dark cave, natural internal shading. Muted earth palette with light face, paws and belly. Soft dark brown contour, no white sticker border.
Scene/backdrop: actual completely transparent alpha background. No scenery, no floor, no cast shadow, no platform.
Constraints: no clothing, no hat, no tool, no lettering, no symbols, no watermark, no extra characters, no sprite sheet, no gradients outside body, no photorealistic fur, no fine hairs. Make face and paws visibly distinct at small size.
```

### 闭眼帧（编辑上一张图，num_last_images_to_include=1）

```text
Use case: identity-preserve. Edit the one mole game sprite just generated. This is the closed-eye blink/rest animation frame of the SAME sprite. Change ONLY the two open eyes to gently closed happy eyelids and close the mouth into a small peaceful smile. Keep the exact SAME full-body standing silhouette, same pose of both paws, same feet, same proportions, same eyeglasses, nose, ears, fur shading and lighting, identical character location and scale in the square canvas. Absolutely no other changes. Do not recline, do not curl up, do not add a blanket or scenery. Keep actual transparent background and all existing transparency. The result will be aligned on top of the original as a matching animation frame. One character, no text.
```

