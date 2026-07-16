# Agent Binding

本项目是一个从 0 开始建设的桌宠式提示词工作流管理工具。`.codex` 文档是需求来源，但开发 agent 必须按任务加载上下文，不得在每次任务开始时无差别重读全部历史文档和已完成计划。

## 上下文加载

每次任务默认只读：

1. `.codex/agent-context.md`
2. `.codex/development-standards.md`

随后按任务追加：

- 产品行为或范围：`.codex/product-requirements.md`。
- 数据结构、迁移或持久化：`.codex/data-model.md`。
- 交互行为：`.codex/interaction-flows.md`。
- 桌宠或面板视觉：`.codex/ui-visual-direction.md`；仅涉及内容书页时再读 `.codex/book-page-content-redesign.md`。
- 阶段验收：只读取 `.codex/development-plan.md` 中与当前任务相关的阶段。
- 继续既有计划：只读取当前仍在执行的设计和实施计划；已完成的历史计划不属于启动上下文。

## 绑定原则

- 不预设具体架构、框架、数据库或打包方式。
- 产品核心是“桌宠捕获 + 小浮窗管理 + 搜索优先 + 项目复盘”。
- 只有一个提示词库；未归入项目的提示词以“待归纳”状态筛选，不提供独立收件箱入口。
- 项目是具体工作流或复盘空间，不是提示词多重引用容器。
- 取消当前捕获项目概念；捕获后默认进入提示词库，未归入项目时标记为待归纳。
- 桌宠负责快速捕获和打开入口，小浮窗负责搜索、归纳、复制、置顶、评分和复盘。
- 桌宠视觉以 `.codex/ui-visual-direction.md` 中确认的漂浮展开古代魔法书为准。
- 开发过程不允许以“临时 MVP”心态牺牲长期结构。
- 旧代码、废弃逻辑和无用文件要及时删除。

## 常用开发 Skill

开发环境使用 `$CODEX_HOME/superpowers/skills` 中安装的 superpowers 技能集。开发 agent 应优先使用：

- `using-superpowers`：开始工作前确认适用技能。
- `brainstorming`：产品需求或交互设计变更前使用。
- `writing-plans`：把已确认需求拆成实施计划前使用。
- `test-driven-development`：实现功能或修复缺陷前使用。
- `systematic-debugging`：遇到 bug、测试失败或异常行为时使用。
- `verification-before-completion`：声称完成前必须验证。
- `requesting-code-review` / `receiving-code-review`：较大变更或评审反馈时使用。

## 工作方式

- 开始实现前，先把当前阶段需求和验收标准转成可执行任务。
- 每个阶段完成后，必须按 `.codex/development-plan.md` 逐项验收。
- 用户可见行为变更必须同步更新 `.codex/product-requirements.md`。
- 数据模型变更必须同步更新 `.codex/data-model.md`。
- 交互流程变更必须同步更新 `.codex/interaction-flows.md`。
- 不要把未确认的新功能混入当前阶段。
- 开发循环只运行与改动直接相关的测试；一个完整行为闭环完成后运行全量测试，交付前只运行一次完整质量门。
- 开发结束时优先运行 `powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1`；依赖文件没有变化且 `node_modules` 完整时使用 `-SkipInstall`。
- 提交完成且工作树干净后，可使用脚本的 `-Push` 参数；脚本不得代替 agent 检查提交范围，也不得自动暂存无关改动。
- `.codex/last-verified.local.json` 是被忽略的本机验证记录，不得提交，也不得写入凭证。
- 预期短时的命令超过 60 秒没有有效输出时，停止等待并排查进程、凭证、网络或残留服务；不得反复执行同一条阻塞命令。
- 视觉改动按已确认的验收清单成批实现和验证；除非用户要求逐步查看，不以单个像素调整为单位反复启动、截图和推送。
- CI 只在最终推送后检查一次；开发中间检查不等待远程 CI。
- 每次开发结束并验证通过后，必须自动创建 Git 提交并推送到 GitHub 远程仓库；如果远程仓库或认证不可用，必须明确说明阻塞原因并保留本地提交。
