# 伙伴互动与阿土工具升级首版

日期：2026-10-18。范围依据：[伙伴、主线与能力成长](../../PARTNER_PROGRESSION_DESIGN.md)第8节。

## 可以体验什么

点击场景里的伙伴，打开当前情境的短对话；角色上方同时出现短回应。也可以从向导面板点击“和阿土聊聊”。关闭对话、点地图或拖图后继续探索，不领取任务、不新增愿望待办。

阿土按点亮、安床、裂纹、水声和泉水等已有进度说话。开局只谈眼前的光，建床后才展示工具改进；听到裂纹处水声后，可以主动“换上小铁镐”。换镐后显示“已装备”，探索中的阿土拿着镐，玩家仍须亲自选择裂纹岩才施工。工具不能挖穿普通坚硬基岩。

阿灯回应家园和下层亮起的变化；小满回应供水、菜槽、成熟和食物；小泉回应泉水和水路。三位暂时只有专业对话，不显示尚未实现的升级按钮。

## 操作与兼容

- 角色身体提供最小44屏幕像素点击容错；相邻睡眠床位按距离区分，不把名字标签算进点击范围。
- 实心泥土、裂纹岩保留原挖掘与施工优先级；拖动不算聊天，建造选址和全景模式不触发聊天。
- 对话关闭按钮至少44px，可按Escape关闭；对话不锁定地图。900×620窗口中换镐按钮可以实际点击。
- 伙伴使用稳定ID、独立加入条件、能力ID和显式床位优先位；调整名单顺序不会让角色换身份或床位。未知ID返回空结果。
- 工具状态只复用原`pickaxeUpgraded`，继续使用现有v7存档。旧档保留已装备工具，无需重复升级；聊天状态不写入存档。

## 验证

- `npm test`：20个测试文件、213项测试通过。
- `npm run build`：类型检查及生产构建通过。
- 生产预览`http://127.0.0.1:5191/`：独立Chromium上下文加载由真实规则生成并序列化的阶段存档，完成角色点击、拖图、聊天不改世界、换镐、指定一块岩石施工、旧工具存档、相邻睡眠伙伴、建造选址、小满与小泉对话、窄窗口按钮等检查；运行时异常为空。详细结果见[browser-report.json](browser-report.json)。
- 自动化使用独立测试存档，没有修改用户浏览器中的存档。阶段存档检查不是从开局连续玩到通关，也未进行真实儿童可用性测试。

可手动复现：点阿土交流 → 保留原玩法点亮并建床 → 点裂纹听水声 → 和阿土聊聊新工具 → 换上小铁镐 → 查看裂纹 → 自己点选岩块施工。拖图或关闭对话可随时继续建设。

## 实景

| 场景 | 截图 |
| --- | --- |
| 开局直接点阿土 | [01-tap-atu.png](01-tap-atu.png) |
| 水声之后查看工具 | [02-ready-upgrade.png](02-ready-upgrade.png) |
| 换镐与装备反馈 | [03-equipped-pickaxe.png](03-equipped-pickaxe.png) |
| 玩家指定岩块施工 | [04-chosen-rock.png](04-chosen-rock.png) |
| 分别点睡眠床位上的伙伴 | [05-sleeping-adeng.png](05-sleeping-adeng.png) |
| 小满谈种菜 | [06-xiaoman.png](06-xiaoman.png) |
| 小泉谈水路 | [07-xiaoquan.png](07-xiaoquan.png) |
| 900×620窗口换镐入口 | [08-narrow-upgrade.png](08-narrow-upgrade.png) |

## 本阶段变更文件

| 层 | 文件及责任 |
| --- | --- |
| 规则 | `src/core/partners.ts`稳定身份与床位映射；`partnerAbilities.ts`工具升级规则；`partnerInteractions.ts`从世界推导对话和主要操作 |
| 会话 | `src/app/session.ts`组合点击、升级、保存、镜头引导与短反馈 |
| 渲染 | `src/render/partnerHitTest.ts`点击容错；`partnerFeedback.ts`短回应；`PixiRenderer.ts`角色身份与命中；`explorationScene.ts`持镐和探索角色锚点 |
| 界面 | `src/components/PartnerConversation.vue`单伙伴对话；`src/App.vue`入口、会话切换与操作说明 |
| 测试 | `tests/partner-interactions.test.ts`、`tests/partners.test.ts`、`tests/session-exploration.test.ts` |
| 文档 | 根`README.md`、`docs/CHARACTERS.md`、`docs/PARTNER_PROGRESSION_DESIGN.md`及本验收目录；设计讨论期间也更新了`GAME_DEFINITION.md`与`GROWTH_DESIGN.md`的决策引用 |

## 尚未实施

只有阿土小铁镐这一项真实能力升级。阿灯照明、小满种植、小泉水路的能力升级、新伙伴、技能树与自主工作仍待后续单独设计实施。本轮未添加等级、经验、材料、照料惩罚或重复任务。

新伙伴仍需明确配置加入条件、美术和实际能力，并非任意数据自动生成。当前床位沿用原布局和固定优先位；自由分配床位、持久化伙伴加入记录要在实际需要时另做版本化迁移。
