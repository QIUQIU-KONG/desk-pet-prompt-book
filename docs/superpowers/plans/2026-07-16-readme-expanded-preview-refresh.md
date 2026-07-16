# README 展开页截图与产品理念更新实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用隔离匿名数据生成当前 Electron 展开面板的真实 `1024x700` 截图，并让中英文 README 使用一致、准确的产品理念文案。

**Architecture:** 自动化测试锁定 README 标题、完整双语文案和 PNG 原生尺寸；一次性截图执行器通过现有 `createPromptStore` 在系统临时目录构造演示数据，再由 Playwright 启动真实 Electron 主进程并捕获展开状态。演示目录在截图后删除，应用运行时代码和用户 `userData` 均不改动。

**Tech Stack:** Node.js 24、Node Test Runner、Electron 39.8.10、Playwright Electron、PowerShell、PNG。

## Global Constraints

- 截图必须来自当前真实 Electron 展开面板，原生尺寸固定为 `1024x700`。
- 截图只允许使用隔离临时 `userData`，不得读取或展示真实提示词、路径、凭证或桌面内容。
- 匿名演示内容固定包含“Agent 开发项目”、需求分析/数据分析/Agent 搭建阶段，以及 `AGENT.md`、`README.md`、`项目复盘` 三条提示词。
- 产品理念英文固定为 `Build agents with clarity. Let prompts become systems.`。
- 中文翻译固定为 `明确地构建代理，让提示词成为系统。`。
- 中文章节标题使用“产品理念”，英文章节标题使用“Product Philosophy”。
- 直接替换 `docs/images/app-preview.png`，分发视觉文件总数保持 8 个，授权状态保持 `license-pending`。
- 串行执行，不使用并行 Agent；完成后运行统一质量门、提交、推送并核验 GitHub Actions。

---

### Task 1: 锁定 README 与截图回归契约

**Files:**
- Modify: `tests/open-source-readiness.test.mjs`
- Test: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Consumes: 现有 `README.md`、`README.en.md`、`docs/images/app-preview.png`。
- Produces: 对双语章节标题、完整理念句子、准确中文翻译和 `1024x700` PNG 的稳定断言。

- [x] **Step 1: 先写失败测试**

在 `public documentation states project status, privacy, and license boundaries` 用例中读取 `app-preview.png`，并加入以下断言：

```js
assert.match(readme, /^## 产品理念$/m);
assert.match(readme, /Build agents with clarity\. Let prompts become systems\./);
assert.match(readme, /明确地构建代理，让提示词成为系统。/);
assert.match(englishReadme, /^## Product Philosophy$/m);
assert.match(englishReadme, /Build agents with clarity\. Let prompts become systems\./);

const appScreenshot = await readFile(new URL('../docs/images/app-preview.png', import.meta.url));
assert.equal(appScreenshot.subarray(1, 4).toString('ascii'), 'PNG');
assert.equal(appScreenshot.readUInt32BE(16), 1024);
assert.equal(appScreenshot.readUInt32BE(20), 700);
```

- [x] **Step 2: 运行测试并确认 RED**

Run: `corepack pnpm exec node --test tests/open-source-readiness.test.mjs`

Expected: 测试因当前 README 仍使用“书页上的创意”与“The Idea Written On The Pages”，且没有准确中文整句而失败；失败原因不是语法或文件读取错误。

---

### Task 2: 用隔离演示数据捕获真实 Electron 展开页

**Files:**
- Modify: `docs/images/app-preview.png`
- Read: `src/core/prompt-store.cjs`
- Read: `src/electron/main.cjs`
- Read: `src/renderer/index.html`

**Interfaces:**
- Consumes: `createPromptStore({ filePath, idGenerator, clock })`、Electron 主入口和渲染层 `.pet-shell` / `.panel-shell` DOM 契约。
- Produces: 透明背景、未裁切、原生 `1024x700` 的 `docs/images/app-preview.png`。

- [x] **Step 1: 在系统临时目录构造匿名数据**

使用 `createPromptStore` 创建“Agent 开发项目”，保留前三个默认阶段并隐藏其余阶段。创建并归档以下三条提示词：

```js
const fixtures = [
  {
    title: 'AGENT.md',
    content: 'AGENT.md\n为 Agent 项目定义职责、边界、工具与协作规范。',
    note: 'Agent 搭建、开发规范',
    keywords: ['Agent 搭建', '开发规范'],
    stageName: 'Agent 搭建',
    rating: 5,
    pinned: true
  },
  {
    title: 'README.md',
    content: 'README.md\n整理项目目标、运行方式、核心流程与验收说明。',
    note: '需求分析、项目文档',
    keywords: ['需求分析', '项目文档'],
    stageName: '需求分析',
    rating: 4,
    pinned: false
  },
  {
    title: '项目复盘',
    content: '项目复盘\n复盘数据、关键决策、问题原因与下一轮改进方向。',
    note: '数据分析、复盘',
    keywords: ['数据分析', '复盘'],
    stageName: '数据分析',
    rating: 4,
    pinned: false
  }
];
```

将 `viewState` 设置为浏览并标记该项目为当前项目，`pendingOnly: false`、`sortMode: 'smart'`、`stageFilter: null`。

- [x] **Step 2: 启动隔离 Electron 并捕获面板**

通过临时 wrapper 在加载 `src/electron/main.cjs` 前执行 `app.setPath('userData', tempUserData)`。使用 Playwright `_electron.launch()` 启动 `node_modules/electron/dist/electron.exe`，单击 `.pet-shell`，等待以下条件全部成立：

```js
document.body.classList.contains('panel-open')
  && document.querySelectorAll('.prompt-entry').length === 3
  && document.querySelector('.panel-shell')?.getBoundingClientRect().width === 1024
  && document.querySelector('.panel-shell')?.getBoundingClientRect().height === 700
```

随后执行：

```js
await page.screenshot({
  path: outputPath,
  type: 'png',
  omitBackground: true
});
```

关闭 Electron 后递归删除临时 `userData` 与 wrapper。

- [x] **Step 3: 验证图片内容与尺寸**

Run: `corepack pnpm exec node -e "const fs=require('node:fs');const b=fs.readFileSync('docs/images/app-preview.png');if(b.subarray(1,4).toString('ascii')!=='PNG'||b.readUInt32BE(16)!==1024||b.readUInt32BE(20)!==700)process.exit(1);console.log('app-preview.png: 1024x700 PNG')"`

Expected: `app-preview.png: 1024x700 PNG`

人工检查：书本四周未裁切；页面、项目栏、阶段栏、三条提示词和分页完整；不存在旧英文演示数据、个人路径或真实提示词。

---

### Task 3: 更新双语产品理念与资产记录

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/asset-provenance.md`
- Modify: `CHANGELOG.md`
- Modify: `.codex/agent-context.md`
- Test: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Consumes: Task 1 的文案断言、Task 2 的新截图。
- Produces: 中英文结构一致的产品理念说明，以及准确的截图来源与本轮交付记录。

- [x] **Step 1: 更新中文 README**

将章节标题改为 `## 产品理念`，并把核心文案替换为：

```markdown
桌宠书页上的英文不是随机装饰，而是产品理念的一部分：

> **Build agents with clarity. Let prompts become systems.**
>
> 明确地构建代理，让提示词成为系统。

这句话描述了产品从“收集提示词”走向“建立工作系统”的方向：先用清晰的目标、上下文和步骤构建 Agent，再通过复用、项目和阶段归纳，让零散提示词逐渐形成稳定、可重复的工作流程。书页右侧的钢笔象征把想法写下，并继续把它转化为可执行的工作。
```

- [x] **Step 2: 更新英文 README**

将章节标题改为 `## Product Philosophy`，并把核心文案替换为：

```markdown
The calligraphy on the desktop pet is intentional product storytelling rather than random decoration:

> **Build agents with clarity. Let prompts become systems.**

This statement describes the product's direction from collecting prompts to building a working system: define an Agent with clear intent, context, and steps, then turn scattered prompts into a dependable, repeatable workflow through reuse, projects, and stages. The fountain pen on the right page symbolizes writing down an idea and continuing until it becomes executable work.
```

- [x] **Step 3: 更新来源、变更记录和 Agent 上下文**

将 `docs/images/app-preview.png` 的来源描述明确为“使用隔离匿名 Agent 开发演示数据捕获的真实 Electron 展开面板”；在 `CHANGELOG.md` 的 Added 中记录 README 双语产品理念和真实匿名面板截图；在 `.codex/agent-context.md` 记录最新截图尺寸、演示数据隔离和文案定稿。保持 8 个视觉文件及 `license-pending` 结论不变。

- [x] **Step 4: 运行目标测试并确认 GREEN**

Run: `corepack pnpm exec node --test tests/open-source-readiness.test.mjs`

Expected: 所有 `open-source-readiness` 测试通过，0 failed。

- [x] **Step 5: 检查变更并提交**

```powershell
git diff --check
git status --short
git add tests/open-source-readiness.test.mjs docs/images/app-preview.png README.md README.en.md docs/asset-provenance.md CHANGELOG.md .codex/agent-context.md docs/superpowers/plans/2026-07-16-readme-expanded-preview-refresh.md
git commit -m "docs: refresh README product preview"
```

Expected: 提交只包含本计划列出的文件，没有临时 wrapper、隔离数据或用户数据。

---

### Task 4: 完整质量门、推送与 CI 核验

**Files:**
- Update local-only record: `.codex/last-verified.local.json`

**Interfaces:**
- Consumes: 已提交的 README、截图、测试和记录。
- Produces: 本地完整验证证据、远端 `main` 同步状态与通过的 GitHub Actions 运行。

- [ ] **Step 1: 运行统一验证与推送脚本**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall -Push`

Expected: 语法检查、完整测试、严格 readiness、依赖审计、Git 检查和推送均退出 0。

- [ ] **Step 2: 核对本地与远端提交**

```powershell
$local = git rev-parse HEAD
$remote = git ls-remote origin refs/heads/main | ForEach-Object { ($_ -split "`t")[0] }
if ($local -ne $remote) { throw "Remote main does not match local HEAD" }
Write-Output $local
```

Expected: 本地 `HEAD` 与远端 `main` SHA 完全一致。

- [ ] **Step 3: 核验 GitHub Actions**

使用已登录的 GitHub CLI 或 GitHub API 查询该提交对应的工作流，等待 Windows、Ubuntu 和 dependency audit 作业全部结束。

Expected: 最新提交对应的 CI workflow 状态为 `completed`，结论为 `success`。

- [ ] **Step 4: 最终展示**

向用户展示 `docs/images/app-preview.png`，并简要报告提交 SHA、本地验证结果和 CI 结果；若 CI 尚在运行，则继续等待，不提前宣称完成。
