# 魔法书桌宠提示词库

> 状态：**Windows Beta v0.1.0-beta.1**。提供可安装的未签名 Windows 测试版和可运行源码，不承诺生产稳定性。

**桌宠模式：漂浮的提示词魔法书**

<p align="center">
  <img src="docs/images/desktop-pet-preview.png" alt="漂浮的魔法书桌宠，带有书脊光效、星尘和发光蝴蝶" width="900" />
</p>

**展开模式：书页式提示词工作台**

<p align="center">
  <img src="docs/images/app-preview.png" alt="展开后的魔法书提示词管理面板" width="900" />
</p>

这是一个面向 Windows 桌面工作流的提示词管理工具。桌宠负责快速捕获剪贴板文字和轻量反馈；展开的魔法书面板负责搜索、复用、项目归纳和项目流程复盘。

[English](README.en.md) | [隐私说明](PRIVACY.md) | [架构](docs/architecture.md) | [贡献指南](CONTRIBUTING.md)

## 产品理念

桌宠书页上的英文不是随机装饰，而是产品理念的一部分：

> **Build agents with clarity. Let prompts become systems.**
>
> 明确地构建代理，让提示词成为系统。

这句话描述了产品从“收集提示词”走向“建立工作系统”的方向：先用清晰的目标、上下文和步骤构建 Agent，再通过复用、项目和阶段归纳，让零散提示词逐渐形成稳定、可重复的工作流程。书页右侧的钢笔象征把想法写下，并继续把它转化为可执行的工作。

## 核心流程

1. 复制一段提示词。
2. 双击桌宠，应用读取当前剪贴板文本。
3. 系统从第一条非空行生成标题，并把内容保存到唯一提示词库。
4. 单击桌宠展开面板，通过全局搜索、待归纳筛选或项目目录找到内容。
5. 复制、评分、置顶、编辑、归入项目或删除提示词。

完全相同的正文不会重复保存。未归入项目的内容以“待归纳”状态存在，而不是进入另一个收件箱。

## 已实现能力

- 单击展开面板，双击捕获剪贴板文本，并显示轻量状态反馈。
- 全局搜索标题、正文、备注和关键词；可限制在当前视图内搜索。
- 单一提示词库与待归纳筛选。
- 项目新建、重命名、置顶和删除；项目浏览状态与显式“当前项目”相互独立。
- 每个项目拥有独立阶段列表，支持新增、重命名、隐藏和排序。
- 提示词支持项目/阶段归纳、可复用关键词、0-5 星评分、置顶、编辑和永久删除。
- 复制提示词后记录使用次数与最近使用时间。
- 综合、高评分、最近使用和最近更新排序。
- 本地 JSON 持久化与上次视图恢复。

## 下载 Windows Beta

在 [GitHub Releases](https://github.com/QIUQIU-KONG/desk-pet-prompt-book/releases/tag/v0.1.0-beta.1) 下载 `Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe`。安装版只要求 Windows 10 或 Windows 11，不需要另外安装 Node.js、pnpm 或 Git。

1. 双击安装包，按向导选择当前用户的安装目录。
2. 安装完成后可通过桌面或开始菜单快捷方式启动。
3. 应用不会自动开机启动。
4. 右键桌宠或展开面板，选择“退出桌宠”可正常退出。

这是未签名 Beta。Windows SmartScreen 可能显示“Windows 已保护你的电脑”；确认文件来自本仓库 Release 后，可选择 `更多信息 -> 仍要运行`。无法接受未签名程序风险时，请不要运行安装包，可先审查源码和 `SHA256SUMS.txt`。

卸载会移除应用文件和快捷方式，但会保留 `%APPDATA%\desk-pet-prompt-book` 中的提示词数据，避免误删。完整说明见 [Beta 发布说明](docs/releases/v0.1.0-beta.1.md)。

## 开发环境要求

- Windows 10 或 Windows 11。
- Node.js 24 或更高版本。
- 随 Node.js 提供的 Corepack。
- Git。

以下依赖只用于从源码开发。项目固定使用 `pnpm@11.13.0`，命令均通过 Corepack 运行，避免全局 pnpm 版本漂移。

## 从源码运行

```powershell
git clone https://github.com/QIUQIU-KONG/desk-pet-prompt-book.git
cd desk-pet-prompt-book
corepack pnpm install
corepack pnpm start
```

常用命令：

| 命令 | 用途 |
| --- | --- |
| `corepack pnpm start` | 启动 Electron 桌宠 |
| `corepack pnpm preview` | 启动本地浏览器预览服务 |
| `corepack pnpm test` | 运行完整自动化测试 |
| `corepack pnpm run check:syntax` | 检查运行时 JavaScript 语法 |
| `corepack pnpm run audit:high` | 检查高危依赖漏洞 |
| `corepack pnpm run readiness:report` | 输出仓库公开准备报告 |
| `corepack pnpm run build:win` | 构建未签名 NSIS x64 安装包 |
| `corepack pnpm run release:verify-assets` | 校验安装包名称与 SHA-256 清单 |
| `powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1` | 运行统一的本地完整质量门 |

浏览器预览主要用于布局和交互开发。浏览器能否读写剪贴板取决于浏览器权限与安全上下文，它不等同于 Electron 桌面行为。

## 数据与隐私

提示词、项目、阶段、关键词和视图状态固定保存在 `%APPDATA%\desk-pet-prompt-book\data\prompts.json`。

- 应用只在用户执行捕获手势后读取剪贴板文本。
- 提示词库没有设计任何远程上传、遥测或云同步。
- JSON 文件**没有静态加密**；能够访问当前系统账户文件的人可能读取其内容。
- 删除提示词会从本地提示词库永久移除该条记录。

处理敏感提示词前，请阅读完整的 [隐私说明](PRIVACY.md) 和 [数据说明](docs/data-and-privacy.md)。

## 项目结构

```text
src/
  core/       本地数据模型与 JSON 存储
  electron/   主进程、窗口管理、剪贴板与 IPC
  renderer/   魔法书界面与运行时视觉资源
scripts/      预览、审计和资源生成脚本
tests/        Node.js 自动化测试
docs/         架构、隐私、资产来源和截图
.codex/       产品决策、开发上下文与实施计划
```

运行时代码不依赖 `.codex` 中的内部开发材料。

## 当前限制

- 当前安装包没有代码签名，Windows 可能显示 SmartScreen 警告。
- 目前没有自动更新或便携版，需要手动安装后续版本。
- 本地数据未加密，也没有账户、云同步、团队协作或遥测。
- 桌面剪贴板自动化可能受 Windows 会话权限影响，需要在真实交互会话中复核。
- 9 个分发视觉文件采用单独的非商业许可，不属于 MIT 或 Creative Commons 资产；商业使用需要项目所有者书面授权。

## 路线

- 持续完善桌宠与面板交互的自动化和真实桌面验收。
- 继续补充视觉资源的生成来源与底层模型条款证据，必要时替换权利链更清晰的资产。
- 公开仓库使用经验证当前代码树的干净根历史；完整旧开发历史继续保留在私有档案中。
- 完成代码签名、升级迁移和自动更新设计后再评估正式稳定版。

## 许可

本仓库采用 **MIT 代码与非商业视觉资产** 的混合许可。程序代码和普通项目文档使用 [MIT License](LICENSE)，允许商业使用和闭源衍生，但必须保留版权与许可声明。

仓库中的 9 个分发视觉文件不在 MIT 范围内。它们允许个人学习、教育、研究、评估和非商业贡献或 Fork，但禁止未经书面授权的商业使用、出售和商业再授权。详见 [非商业视觉资产许可](ASSET-LICENSE.md) 与 [来源记录](docs/asset-provenance.md)。
