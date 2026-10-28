# v1.2.0 发布准备报告

日期：2026-10-29。状态：**正式发布已授权；本分支合并后创建 v1.2.0 标签与 GitHub Release。**

## 集成

- **UX2 PR**：[#4 feat: v1.2-UX2 我的家园心愿](https://github.com/zdhgg/Underground-Home/pull/4)
- **合并方式**：Create a merge commit；开发分支 `zcode/v1.2-ux2-home-wishes` 保留。
- **合并提交 / main 基线**：`60af37c9e54056c98f9f6533ed5cbd509fa26a2c`
- **集成内容**：
  1. v1.2-A 小窝暖光灯（此前 PR #2，已在 main）。
  2. v1.2-UX1 阿土的探索小本子（此前 PR #3，已在 main）。
  3. v1.2-UX2 我的家园心愿（PR #4）。
- UX2 相对 main 只有两个提交：`d58e621` 功能、`39c48b5` 窄屏紧凑化；没有重复引入 A 或 UX1，没有混入其他功能。

## 验证（合并后 main 独立工作树）

- `npm ci`：通过。
- 全量测试：**65 个测试文件、806 项全部通过**。
- `vue-tsc --noEmit`：通过。
- `vite build`：通过；仅保留原有主包超过 500 kB 的提示。
- 生产构建真实浏览器：1440×900、1280×720、390×844、360×800，0 页面错误、0 横向溢出。
- 390/360：心愿区 139px，按钮 63×44px，“去哪里？”与第一条楼层入口完整可见。
- 真实装灯：v25 存档迁移到 v26，阿灯实际寻路施工，部件 1→0，重进后灯保持。
- 真实收菜：食物 2→3、生长阶段回 0，最后一槽收完后心愿消失。
- 存档：`WORLD_VERSION = 26`，未升级；心愿不写入存档。
- 证据目录：[docs/acceptance/v1.2.0-release](acceptance/v1.2.0-release/README.md)。

## 发布候选

- 分支：`zcode/release-v1.2.0-prep`
- 版本：`package.json`、`package-lock.json`、进入页与更新记录统一为 **1.2.0**。
- 发布包：`Underground-Home-v1.2.0-web.zip`
  - 大小：**94,385,614 字节**
  - 文件数：**84**
  - SHA-256：`cef362a0904dbc0f9ea03bf79fc22ca8f12996ed9114285ce94d0b88ddeeda1b`
  - 校验：ZIP 与最终 `dist` 逐文件 SHA-256 一致；解压后独立静态服务冒烟通过。
- 发布说明草稿：[docs/releases/v1.2.0.md](releases/v1.2.0.md)。
- 更新记录：[CHANGELOG.md](../CHANGELOG.md) 首条为 1.2.0。

## 发布执行

- release 准备分支合并后，在最终 main 上重新执行测试、类型检查与生产构建。
- 使用该构建重新核验 ZIP 与 SHA-256，创建指向最终 main 的 `v1.2.0` 标签并发布 GitHub Release。
- 实体手机触摸、长时性能与儿童现场试玩不作为本次发布阻断：[手机试玩清单](V1_2_0_MOBILE_PLAYTEST.md)。

## 结论

工程条件已具备：PR 已合并、main 全量验证通过、生产页面与发布包冒烟通过、v25/v26 存档兼容、发布资料与包已准备。**等待最终授权后创建 v1.2.0 标签和 Release。**
