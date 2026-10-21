# 两人小窝美术样板 v1

日期：2026-10-20。使用内置 image_gen 生成，两张原始透明PNG直接复制入仓库，保留alpha。未使用CLI或外部API密钥。风格为手绘岩洞、木梁和暖灯，与现有岩层和能源核心协调。

## 素材与分层

- `src/assets/art/rooms/nest-shell-v1.png`：1254×1254，石拱、后墙、木梁、书架、灯具和地板。
- `src/assets/art/rooms/nest-bunks-v1.png`：1536×1024，双层木床，绿色/陶土色被褥、右侧枕头，左侧床梯。按舱门方向水平镜像。
- `src/render/nestArt.ts`统一加载纹理和线性缩小；`RoomScene`绘制3×3洞室外壳，`sleepPods`单独绘制床铺，角色仍在前层。小灯只有轻微程序化呼吸，无碰撞变化。
- `SiteTools.vue`使用同两张素材组合预览。已建成时不叠加绿色选址色块或重复状态句。
- 新预设小窝与相同尺寸的完整旧房间应用外壳；其他旧尺寸保留旧边框。旧床也使用新床铺素材，床位和通路规则不变。扩建为6格时使用两个3格外壳，避免拉长素材。
- 本阶段只升级小窝，客厅、菜园美术暂沿用现有造型。存档结构与版本不变。两张PNG约4.7MB，尚未转为压缩纹理。

## 最终提示词：洞室外壳

```text
Use case: stylized-concept. Asset type: production 2D game background sprite, square, transparent outside. Create ONE cozy underground sleeping alcove shell for a children's side-view underground shelter game. Orthographic straight-on front cutaway view, no isometric view, no perspective sides, no roof, no exterior house. Entire structure fits a square with only 3% transparent margin. Rough cool slate stone arch inset into excavated rock, restrained chunky weathered oak support beams on left and right, a softly lit muted dark teal stone back wall, a low straight wooden plank floor at the bottom. Small brass warm amber lamp at top center, a few small books on a narrow upper-left wall shelf. Lower 65% interior deliberately empty for separately composited bunk beds; no beds or chairs, no characters. Wooden floor is horizontal, no protruding stairs or front wall. Thick hand-painted storybook textures, polished 2.5D game illustration with soft dimensional shading matching detailed gray-blue rocky terrain, sage and ochre palette, warm inviting light, crisp readable silhouette at 96x96 game pixels. Keep arch slender so interior remains roomy. No text, no labels, no UI, no surrounding environment. Genuine alpha transparency outside the rock/wood silhouette, opaque dark teal back wall inside.
```

## 最终提示词：双层床

```text
Use case: stylized-concept. Asset type: single production game furniture sprite, transparent background. ONE lovingly detailed rustic wooden double bunk bed for a cozy children's underground shelter game, straight-on side elevation, orthographic 2D platformer view, absolutely no isometric angle, no visible side walls, no room background. Wide 3:2 overall canvas, furniture nearly fills canvas with 4% transparent margin. Two single beds vertically stacked inside a sturdy warm oak frame, top mattress centered at 30% canvas height and lower mattress at 69%. Both white soft pillows at the RIGHT end, sage green quilt on upper bunk, muted terracotta quilt on lower bunk; visible fabric folds and stitched seams, softly rounded wooden beams, tiny brass joinery details. Small attached climbing rungs at the LEFT end kept thin. Empty beds, no characters, no toys, no letters. The bed is compact and front-facing, evenly lit by a small warm lamp above (lamp itself NOT shown). Storybook hand-painted texture with refined dimensional shading, clear charming shapes at 90x60px, same palette as slate gray underground rocks and warm brass machinery. No ground shadow extending outside object, no floor, no labels, no UI, no watermark. Genuine transparent alpha background.
```

