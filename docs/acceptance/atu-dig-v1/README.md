# 阿土挖土动作修复

日期：2026-10-20。

## 问题与修复

站姿PNG本身已经包含两条手臂和两只爪子，旧施工层又绘制了一条由身体伸向目标的程序手臂，因此出现第三只手和长距离伸缩的观感。

现改为侧挖、抬手两张完整双爪姿势，直接替换角色纹理；围绕脚底播放蓄力、接触、收招。高处复用短踏台，正上方用抬手姿势。泥屑只在原落爪结算时刻出现。取消时立即恢复站姿和地面高度。

## 变更文件

| 文件 | 修改内容 |
| --- | --- |
| [moleVisual.ts](../../../src/render/moleVisual.ts) | 加载双爪姿势、整帧替换、脚底对齐、蓄力与收招、资源失败时的身体动作回退 |
| [atuConstruction.ts](../../../src/render/atuConstruction.ts) | 移除额外手臂，输出单次挖掘姿态时序，命中后播放泥屑 |
| [explorationScene.ts](../../../src/render/explorationScene.ts) | 同步姿势与朝向，取消立即还原，完成当帧清除踏台高度 |
| [atu-dig-side-v1.png](../../../src/assets/art/characters/atu-dig-side-v1.png)、[atu-dig-up-v1.png](../../../src/assets/art/characters/atu-dig-up-v1.png) | 512×640透明双爪施工帧；新增资源合计约858kB |
| [素材说明与完整提示词](../../../src/assets/art/characters/ATU_DIG_V1.md) | 内置ImageGen模式、原图来源、对齐裁切和最终提示词 |
| [mole-dig-visual.test.ts](../../../tests/mole-dig-visual.test.ts) | 6项视觉时序回归：左右、低处、上部、踏台、正上方、落爪前取消 |
| [verify.cjs](verify.cjs)、[browser-report.json](browser-report.json) | 隔离生产浏览器的真实指针检查和结果 |

## 验证

- `npm test`：**31个文件，342项全部通过**。
- `npm run build`：类型检查和生产构建通过。主JS包575.55kB，仍有默认500kB体积提示。
- 浏览器：生产预览 `http://127.0.0.1:5195/`；独立Chromium上下文，不使用玩家的浏览器数据。以真实指针点击泥土，50ms固定步长播放真实ticker，截图检查双手与土面的位置。
- 左右侧挖、上部挖土和踏台完成后均检查目标实际变为空地且只挖一格；正上方落爪前Escape取消后，目标仍为泥土，先前完成的四格保留。
- 检查桌面1440×960和横屏900×620；运行时异常为空。

## 实景

| 场景 | 截图 |
| --- | --- |
| 朝左侧挖 | [01-left-side.png](01-left-side.png) |
| 朝左向上挖 | [02-left-raised.png](02-left-raised.png) |
| 短踏台处理顶部 | [03-left-stool.png](03-left-stool.png) |
| 朝右侧挖 | [04-right-side.png](04-right-side.png) |
| 矮凳正上方挖掘 | [05-overhead.png](05-overhead.png) |
| 取消立即恢复站姿 | [06-cancel-overhead.png](06-cancel-overhead.png) |
| 900×620横屏踏台 | [07-narrow-stool.png](07-narrow-stool.png) |

## 当前限制

使用两张施工姿势配合身体动作，尚不是完整骨骼或多帧肢体动画；未做真实儿童试玩。本次验收覆盖泥土施工修复，不代表重新完成整个首章流程的浏览器验收。
