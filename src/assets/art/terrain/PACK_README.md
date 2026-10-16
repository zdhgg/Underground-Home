# 《地下小家园》地形素材包 v1.0

**目标：首批可接入的地下地形素材，不是整张固定场景图。**

## 内容
- `assets/art/terrain/soil*.png`：可挖泥土，3张 **64×64 RGBA/RGB** 可重复贴图。
- `assets/art/terrain/rock*.png`：不可挖岩石，3张 **64×64** 可重复贴图。
- `assets/art/terrain/cave-bg.png`：洞穴内部 **512×512** 可重复背景。
- `assets/art/terrain/edges/{soil|rock}-{top|right|bottom|left}.png`：**64×64 透明边缘叠图**，在贴图所在的“实心格”上叠加。
- `edges/surface-grass-top.png`：**64×64** 地表草边示例。
- `previews/terrain-in-game.png`：拼成岩层、空洞的场景示意。
- `previews/seamless-repeat.png`：连续重复贴图检查。
- `previews/asset-contact-sheet.png`：素材一览。
- `manifest.json`：文件清单、逻辑尺寸、技术约定和重复边界检查结果。

## 规格与接入
- 世界坐标沿用 TILE_SIZE=32；源图为64px，显示尺寸32px，不改变地图、存档和建造判定。
- PixiJS 使用 linear 过滤。贴图以左上角对齐。
- `soil*.png` / `rock*.png` 均为可单张重复的纹理（边界做过无缝处理）；**按确定性坐标hash选变体**。
- 边缘叠图定位在岩/土实体块上：若实体块北边为空洞，在该实体块上叠加 `soil-top.png` 或 `rock-top.png`；其他三个方向同理，多个方向可合成。
- 地下挖空格显示`cave-bg.png`，不要把泥土或岩石烘焙到固定背景。
- 本次提供的是**基础贴图 + 四向洞壁叠图**，不是完整的16组合自动拼接图集；转角细节可以后续增加。
- 图中没有真实可供 PixiJS 加载的能量机器/人物PNG，它们是下一批。

## 交付与验证
建议让WorkBuddy按顺序先接入洞穴背景，再接泥土/岩石，最后加洞壁叠图。只修改渲染层和素材加载路径，严格不要改 `core` / `input` / 存档。

验收至少包括：①泥土/岩石没有明显接缝；②泥土被挖之后新暴露的4向边缘正确更新；③撤销时边缘恢复；④相机缩放0.6—2.2下没有明显闪线；⑤现有测试和构建全部通过。

**注意：** 这是v1美术样板，地形边缘为后叠近似方案。机器、人物、灯光素材应下一批独立生成。
