# Development Standards

## 核心原则

本项目不采用“先做临时 MVP，以后再重构”的方式。允许分阶段交付，但每个阶段都必须兼容最终产品方向，保持可扩展、可维护、可删除。

## 产品模型约束

- 只有一个提示词库。
- 待归纳是未归入项目提示词的筛选状态，不是独立容器或主导航入口。
- 每条提示词以单项目归属为主。
- 项目是具体工作流或复盘空间。
- 阶段是项目内流程结构，由默认模板复制后独立维护。
- 搜索默认全局。
- 桌宠捕获不打开小浮窗。

## 开发要求

- 不允许为了速度写明显无法承接后续方向的临时代码。
- 不允许把一次性逻辑伪装成核心架构。
- 不允许在废弃旧逻辑旁边继续叠新逻辑。
- 不允许长期保留无入口、无测试、无产品价值的旧代码。
- 用户可见行为变更必须同步更新 `.codex/product-requirements.md`。
- 数据模型变更必须同步更新 `.codex/data-model.md`。
- 交互流程变更必须同步更新 `.codex/interaction-flows.md`。

## 可扩展性要求

- 桌宠、小浮窗、数据存储、搜索排序、项目阶段管理应有清晰职责边界。
- 排序、搜索、评分、关键词应以可替换规则组织，避免散落在界面事件中。
- 阶段模板要支持后续项目模板能力。
- 关键词库要支持后续自动推荐能力，但第一版先手动维护。

## 旧代码处理

- 废弃功能应删除，不应长期注释保留。
- 被替换的实现应在新实现通过验收后移除。
- 删除旧代码时，同步删除无效测试、无效文档和无效配置。
- 暂时不能删除的旧逻辑，必须记录阻塞原因和删除条件。

## 结束验证与推送

- 统一质量门为 `scripts/verify-and-push.ps1`，默认执行冻结安装、语法检查、全量测试、严格 readiness、依赖审计和 `git diff --check`。
- 已确认依赖未变化时可使用 `-SkipInstall`；只有提交完成且工作树干净时才允许使用 `-Push`。
- Git 路径优先读取 `DESK_PET_GIT`，再读取项目相邻便携 Git，最后使用 `PATH`；Corepack 可通过 `DESK_PET_COREPACK` 覆盖。
- 验证结果写入被忽略的 `.codex/last-verified.local.json`，只记录提交、命令和同步状态，不得记录令牌或认证头。
- 每次开发结束后仍需由 agent 审核提交范围、创建聚焦提交并推送，脚本不自动暂存或提交文件。

## 分层验证与执行效率

- 启动时先读 `.codex/agent-context.md` 和本规范，再按任务读取产品、数据、交互或视觉文档；已完成实施计划不默认加载。
- RED/GREEN 开发循环运行最小相关测试。一个完整行为闭环完成后运行 `corepack pnpm test`，交付前运行一次完整质量门。
- `package.json` 和 `pnpm-lock.yaml` 均未变化、且本地依赖完整时，完整质量门使用 `-SkipInstall`；依赖变化时必须执行冻结安装。
- 一个开发任务完成后创建聚焦提交并推送一次。任务包含多个独立本地提交时，在最终验证后一次性推送；中间阶段不重复等待 GitHub Actions。
- 最终推送使用非交互 Git Credential Manager 链路，并记录各验证阶段耗时；凭证不可用时应快速失败，不弹出隐藏登录窗口。
- 预期短时的命令 60 秒内无有效输出时，先停止并定位进程、网络、凭证或锁等待，不通过重复运行碰运气。
- Agent 必须记录并关闭自己启动的 Electron、预览服务和验收进程；不得结束无法确认归属的用户进程。
- 视觉任务先冻结一组可验收指标，再完成一批改动和统一截图验证；用户未要求时，不进行“一处调整、一次启动、一次推送”的循环。

## Superpowers Skill 约定

开发环境通过 `$CODEX_HOME/superpowers/skills` 提供 superpowers 技能集。开发 agent 应优先使用：

- `using-superpowers`
- `brainstorming`
- `writing-plans`
- `test-driven-development`
- `systematic-debugging`
- `verification-before-completion`
- `requesting-code-review`
- `receiving-code-review`
