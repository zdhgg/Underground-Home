# v1.2.0 集成与发布候选验收

日期：2026-10-29。验证基线：PR #4 合并后的 `main` `60af37c9e54056c98f9f6533ed5cbd509fa26a2c`。

## 自动化

在独立临时工作树执行，不复用 UX2 分支结果：

```bash
npm ci
node ./node_modules/vitest/vitest.mjs run --maxWorkers=1
node ./node_modules/vue-tsc/bin/vue-tsc.js --noEmit
node ./node_modules/vite/bin/vite.js build
```

- 测试：**65 个文件、806 项全部通过**。
- TypeScript：通过。
- 生产构建：通过；仅保留原有主包超过 500 kB 的提示。

## 真实生产构建浏览器

使用真实 Pixi/WebGL 2.0 页面与临时 IndexedDB 验收存档：

| 视口 | 页面错误 | 横向溢出 | 心愿按钮 | 首屏楼层 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 1440×900 | 0 | 无 | 44px | 可见 | 通过 |
| 1280×720 | 0 | 无 | 44px | 可见 | 通过 |
| 390×844 | 0 | 无 | 44px | 可见 | 通过 |
| 360×800 | 0 | 无 | 44px | 可见 | 通过 |

- `browser-results.json`：游戏初期、暖光灯心愿、缺料提示、成熟菜槽、两条心愿、伙伴工作让位、章节面板让位；真实小满收菜食物 2→3、生长阶段回 0。
- `compact-fixed-results.json`：390/360 心愿区 139px、按钮 63×44px、“去哪里？”与第一条楼层入口完整可见；无标题/按钮重叠、无文字截断、无横向溢出。
- `install-v120-results.json`：**v25 存档迁移到 v26 + 真实阿灯装灯 + 重进保留**。1440 与 390 均完成：部件 1→0，暖光灯保留，重进仍为 v26。
- `1440-v120-lamp-installed.jpg`、`390-v120-lamp-installed.jpg`：真实装灯完成截图。

## 发布候选构建

- `final-version-smoke.json`：1440/1280/390/360 进入页显示 `v1.2.0`，更新记录首条 `1.2.0 · 2026-10-29`，真实 WebGL，无横向溢出。
- `zip-smoke-results.json`：从最终 ZIP 解压目录独立提供静态页面，`v1.2.0` 版本正确；两项心愿、44px 按钮、首屏楼层、点击只定位、无页面错误全部通过。

## 存档

- `WORLD_VERSION = 26`，本轮未升级。
- v25 → v26 迁移与 v26 重进由浏览器实景和 `tests/persistence.test.ts` / `tests/nest-warm-lamp.test.ts` 覆盖。
- 心愿不写入存档；`serialize()` 结果中没有独立心愿进度字段。
- 测试使用隔离 IndexedDB，不接触玩家正式存档。

## 未完成

- 尚未在实体手机上进行触屏、长期性能、发热和儿童现场试玩；清单见 [V1_2_0_MOBILE_PLAYTEST.md](../../V1_2_0_MOBILE_PLAYTEST.md)。
- 尚未创建 v1.2.0 标签或 GitHub Release，等待最终授权。
