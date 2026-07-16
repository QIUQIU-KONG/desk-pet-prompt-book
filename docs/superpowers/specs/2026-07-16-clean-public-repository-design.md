# Desk Pet Prompt Book 干净公开仓库设计

## 目标

在不公开现有历史的前提下，将当前通过验证的源码树发布为新的公开仓库 `QIUQIU-KONG/desk-pet-prompt-book`。现有仓库改名为 `QIUQIU-KONG/desk-pet-prompt-book-private-archive` 并继续保持私有，用作完整开发历史档案。

## 名称与定位

- 英文产品名：`Desk Pet Prompt Book`。
- 仓库名：`desk-pet-prompt-book`。
- 中文名：桌宠提示词魔法书。
- 产品定位：以提示词为核心、兼容普通笔记和灵感片段的桌宠式可复用文本库。

## 仓库边界

### 私有档案仓库

- 名称改为 `desk-pet-prompt-book-private-archive`。
- 可见性保持 `private`。
- 保留全部 50 个历史提交、旧视觉草稿、现有 Dependabot PR 和开发记录。
- 不执行 `git filter-repo`、强制推送或历史删除。
- 在改名前创建所有引用的 Git bundle 备份，并验证 bundle 可读取。

### 公开仓库

- 使用原名称 `desk-pet-prompt-book`，保持 README、克隆命令和 package metadata 中的公开 URL 不变。
- 从私有档案的最终已验证 `HEAD` 导出当前跟踪树，不复制 `.git`、忽略文件、用户数据、临时截图或本地验证记录。
- 初始化全新 Git 历史，公开仓库初始发布只包含一个根提交。
- 不复制私有档案中的 issue、PR、Actions 日志、分支、标签或不可达对象。
- 公开开发使用独立本地目录，禁止把旧仓库的 `.git` 或远端引用带入公开仓库。

## 混合许可

### 程序代码

程序代码和普通项目文档继续使用 MIT License，`package.json` 继续声明 `MIT`。

### 视觉资产

`ASSET-LICENSE.md` 列出的 8 个视觉文件改为自定义非商业许可。许可只覆盖项目所有者依法能够授予的权利，并明确：

- 允许为个人学习、教育、研究、评估以及非商业贡献而下载、运行、展示、修改和 Fork；
- 允许在保留许可与来源说明的非商业仓库副本中再分发；
- 禁止在商业产品、付费服务、广告、商业素材包或收费交付物中使用；
- 禁止出售视觉文件、进行商业再授权，或将其作为独立素材商业分发；
- 商业许可必须另行取得书面授权；
- AI 生成内容在不同司法辖区的可版权性可能不同，许可仅授予项目所有者实际持有的权利，不提供权利完整性保证。

README 必须使用“MIT-licensed code with noncommercial visual assets / MIT 代码与非商业视觉资产”的准确表述，不能声称整个仓库均为 MIT、CC BY、OSI 开源或可自由商用。蒙版和截图属于视觉资产范围，因为它们包含或衍生自书本原图。

## 发布前源码调整

- 将 `ASSET-LICENSE.md` 从 `license-pending` 更新为正式非商业许可文本。
- 同步更新中英文 README、`docs/asset-provenance.md`、`CONTRIBUTING.md`、`CHANGELOG.md` 和 Agent 上下文。
- 更新公开准备测试，锁定混合许可文案、8 个文件范围和非商业限制。
- 保留项目的 Alpha 状态，不把公开源码描述为正式发行版。
- 审查并处理 Electron 依赖升级 PR；它可以留在私有档案，由公开仓库中的 Dependabot 重新创建。

## GitHub 安全设置

公开仓库首次推送并通过 CI 后配置：

- `main` 为默认分支；
- 启用分支保护，要求 Windows、Ubuntu 和 Dependency audit 三个状态检查；
- 禁止强制推送和分支删除，要求分支保持最新并解决对话；
- 启用 Vulnerability Alerts、Dependabot Alerts 和 Dependabot Security Updates；
- 启用 Secret Scanning、Push Protection 和 Private Vulnerability Reporting；
- 保持 GitHub Actions 默认权限为只读，并维持工作流显式 `contents: read`；
- 后续增加 GitHub Actions 依赖更新，降低浮动 Action 版本风险。

Code Scanning 如果不能通过仓库设置直接启用，则增加单独的 CodeQL 工作流并在首次分析通过后纳入分支保护。配置失败必须作为公开发布阻塞项报告，不能静默跳过。

## 执行顺序

1. 更新混合许可和公开配置，在当前私有仓库运行完整质量门并提交推送。
2. 创建并验证私有仓库 Git bundle 备份。
3. 通过 GitHub API 将当前仓库改名为 `desk-pet-prompt-book-private-archive`，确认仍为私有。
4. 将旧本地仓库的 `origin` 更新为私有档案地址。
5. 从最终 `HEAD` 导出跟踪树到新的空目录，删除只服务于私有历史的清理报告。
6. 初始化一个根提交，并在 GitHub 创建公开仓库 `desk-pet-prompt-book`。
7. 推送 `main`，等待首次 CI 通过，然后配置安全功能和分支保护。
8. 从公开 URL 匿名克隆到第三个临时目录，运行安装、测试、readiness、依赖审计和历史扫描。
9. 验证公开仓库只有一个根提交、没有旧视觉对象、个人路径、凭据或私有 issue/PR。

## 失败与回滚

- Git bundle 和私有档案共同保存完整原始历史。
- 如果新仓库创建失败，私有档案不受影响；在确认没有新公开仓库内容后，可将档案仓库名称改回原名称。
- 如果公开仓库验证失败，先将新仓库改为私有或删除新仓库，再修复导出树；不修改私有档案历史。
- 不在任何日志、文档或最终回复中输出 GitHub 凭据。
- 不删除私有档案，除非用户以后单独明确批准。

## 验收标准

- 私有档案仓库存在、名称正确、可见性为 private，bundle 备份验证通过。
- 新 `QIUQIU-KONG/desk-pet-prompt-book` 为 public，默认分支为 `main`，只有干净根历史。
- 公开仓库当前树的测试、readiness、依赖审计和 CI 全部通过。
- 匿名克隆不需要凭据，且不包含旧 Git 对象或历史个人路径。
- 代码 MIT 与视觉资产非商业许可边界在中英文 README 和许可文件中一致。
- 分支保护、安全提醒、秘密扫描、私密漏洞报告和可用的代码扫描均已启用并验证。
