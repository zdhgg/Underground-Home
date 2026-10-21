# 暖暖客厅基础美术 v1

日期：2026-10-20。用户批准升级客厅，并提出先小一些、留待后续升级。此次保持已建存档与现有5×3格占地（小窝为3×3），先提供一张双人长椅和小茶桌。空间与家具密度按基础客厅控制；本阶段不新增升级按钮、等级或扩建规则。

## 素材与表现

使用内置image_gen生成，参考已入库的小窝石拱和木床。两张生成原图直接复制到项目，保留alpha，未用CLI或外部API密钥。

- `src/assets/art/rooms/lounge-shell-v1.png`：1619×971，石拱、木梁、后墙、木地板、顶灯与挂杯架。
- `src/assets/art/rooms/lounge-furniture-v1.png`：2172×724，双人木长椅、两只靠垫、小圆茶桌、茶壶与杯子。
- 两图约4.38MB，暂未制作压缩纹理。透明区与家具腿之间保持透明；灯光为现有程序中的轻微呼吸，不增加闪烁动画。
- `src/render/loungeArt.ts`独立加载和组合图片，家具位于后侧，前侧保留画面空间；不创建碰撞体。相同素材用于建造卡片。
- 较窄的旧客厅与第二层休息角按比例缩小。较宽旧客厅居中放基础单元，家具不横向拉长；原房间范围和通行仍由原规则决定。尚不提供“豪华客厅”等新升级形态。

## 验证结果与边界

- `npm test`：32个文件、353项测试全部通过。新增回归验证窄客厅素材保持5:3和3:1比例、靠地放置、刷新不修改世界和不销毁共享纹理。
- `npm run build`：Vue/TypeScript检查和Vite生产构建通过；仍有主包超过500kB的现有提示。
- PNG模式RGBA，两张图片alpha范围均为0–255；已分别查看原图。
- 浏览器尝试返回“Local browser use is disabled in Work settings”。本轮尚未完成实际页面、窄屏卡片和角色遮挡的视觉验收；不把自动测试视为实景验收。未通过其他方式绕过此设置。
- 建造费用、物品栏、地形、设施判定、任务和存档版本均沿用现有规则。未清空或改写用户存档。

## 变更文件

新增两张`src/assets/art/rooms/lounge-*-v1.png`与`src/render/loungeArt.ts`；修改`src/render/roomScene.ts`、`PixiRenderer.ts`、`src/components/SiteTools.vue`、`tests/rooms.test.ts`、`tests/terrain-renderer.test.ts`、README与CHANGELOG。后续待办是浏览器视觉复核、压缩纹理，以及另行确定的客厅扩建/添家具阶段。

## 最终提示词：洞室外壳

```text
Use case: stylized-concept. Asset type: production 2D side-view game background sprite, wide 5:3 proportions, transparent outside. Input image 1 is ONLY a style/material reference, not an edit target. Create a NEW wider underground sitting alcove shell in the SAME hand-painted storybook rendering style: cool slate stone arch inset into excavated rock, weathered warm oak support beams, brass joinery, softly lit muted dark teal stone back wall and a straight low wooden plank floor. Broad shallow curved arch, single amber brass lamp at horizontal center, a tiny upper-right wooden shelf with two hanging mugs. Furniture area is deliberately empty for a separate bench and tea table layer. Keep lower 65% interior clear, keep lateral posts slender and the interior spacious. This is a modest starter living room for a children's underground shelter game, not a grand hall. Straight-on orthographic cutaway, no isometric view, no exterior house, no roof, no windows, no front wall, no steps. Entire shell nearly fills the wide canvas with 3% transparent margin; crisp readable shapes at 160x96 game pixels, matching the reference's slate/ochre/sage palette, tactile painted rock and wood textures. No sofa, no table, no people, no text, no labels, no UI. Genuine alpha transparency outside the outline, opaque teal-gray back wall inside.
```

参考输入：`src/assets/art/rooms/nest-shell-v1.png`。

## 最终提示词：长椅与茶桌

```text
Use case: stylized-concept. Asset type: ONE production game furniture group sprite with genuine transparent alpha background, very wide 3:1 proportions. Input image 1 is ONLY a style and material reference, not an edit target; match its warm wooden texture, sage and terracotta textiles and hand-painted dimensional shading. Make a SMALL starter underground living room furniture group: ONE compact rustic oak two-seat bench with sage green upholstered seat/back and exactly two soft cushions (one sage, one muted terracotta) on the LEFT, and ONE small low round wooden tea table on the RIGHT bearing a tiny clay teapot and two mugs. Same ground baseline, a little transparent gap between bench and table. Straight-on side elevation for a 2D platformer, orthographic with only a subtle top surface visible, no isometric camera. Whole group centered, nearly fills the wide canvas, only a 4% transparent margin, clear chunky silhouette and restrained details that read at 120x40 game pixels. Cozy and humble, lightly worn carved wood, brass nail details, stitched cushion seams. No huge sofa, no additional chairs, no rug, no bookshelves, no room background, no lamp, no floor, no external shadows, no characters, no text, no UI, no watermark. Genuinely transparent all around and between furniture legs; the furniture is separately composited in front of the stone wall.
```

参考输入：`src/assets/art/rooms/nest-bunks-v1.png`。
