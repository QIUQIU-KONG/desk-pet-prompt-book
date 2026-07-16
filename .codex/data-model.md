# Data Model

## 模型总览

产品只维护一个提示词库。项目用于归纳具体工作流或复盘空间；未归入项目的提示词通过待归纳状态筛选，不存在独立收件箱容器或入口。

```text
Prompt -> optional Project
Prompt -> optional Stage within Project
Prompt -> many Keyword
Pending = prompts where projectId is empty
```

## Prompt

提示词本体。

```text
id
projectId        可为空；为空时标记为待归纳
stageId          可为空；为空时显示为未分阶段
title
content
note
keywordIds
rating           0-5
pinned
createdAt
updatedAt
lastUsedAt
useCount
```

规则：

- `content` 是提示词正文。
- `title` 捕获时从正文第一行生成，后续可编辑。
- `projectId` 为空表示未归纳。
- `stageId` 必须属于当前 `projectId` 对应项目；没有项目时不能选择阶段。
- 删除提示词会从提示词库中彻底移除。
- 完全重复的正文不重复保存。

## Project

项目代表一个具体工作流或复盘空间。

```text
id
name
description
pinned
createdAt
updatedAt
```

规则：

- 项目可新建、重命名、删除、置顶。
- 删除项目不删除提示词本体。
- 删除项目后，原项目内提示词的 `projectId` 和 `stageId` 清空，进入待归纳状态。

## Stage

阶段代表项目内流程位置。

```text
id
projectId
name
order
hidden
createdAt
updatedAt
```

规则：

- 系统维护默认阶段模板。
- 新建项目时，将默认阶段复制为该项目自己的阶段列表。
- 项目创建后，阶段新增、重命名、隐藏、排序只影响该项目。
- 默认阶段：需求分析、数据分析、Agent 搭建、开发计划、测试验收、项目复盘。
- 未选择阶段的提示词显示为“未分阶段”。

## Keyword

关键词是全局可复用词库。

```text
id
name
createdAt
updatedAt
lastUsedAt
useCount
```

规则：

- 关键词手动创建。
- 编辑提示词时可选择已有关键词，也可新增关键词。
- 从某条提示词移除关键词，不删除关键词库中的关键词。
- 项目第一版不做关键词。

## Pending

待归纳不是表、项目或独立容器。

规则：

- `projectId` 为空的提示词进入待归纳筛选结果。
- 存在待归纳提示词时，界面显示“记得归纳清理哟~”。
- 提示词加入项目后取消待归纳状态，但仍保留在唯一提示词库。
- 提示词从项目移出后，如果没有项目归属，自然重新进入待归纳状态。

## View State

界面状态用于恢复小浮窗体验，不应污染核心数据模型。

```text
lastViewType      library | project
lastProjectId
currentProjectId
pendingOnly
sortMode
stageFilter
```

规则：

- 小浮窗打开时恢复上次停留视图。
- 不默认恢复旧搜索词。
- 如果上次项目已删除，回到提示词库。
- `currentProjectId` 是用户显式设置的工作上下文标记，不等于当前浏览项目，也不决定捕获归属。
- 新建或选中项目不会自动修改 `currentProjectId`；删除当前项目时将其清空。
- 旧版 `all` 视图迁移为 `library + pendingOnly=false`。
- 旧版 `inbox` 视图迁移为 `library + pendingOnly=true`。

## 存储完整性

- 单个应用进程内的所有写操作按调用顺序串行执行，避免并发捕获或编辑互相覆盖。
- 主数据写入 `prompts.json`，最近一次成功快照同步写入 `prompts.json.bak`。
- 主文件损坏时先隔离为 `prompts.json.corrupt-*`，再恢复有效备份；主文件和备份都不可读时保留损坏文件并创建空白有效存储。
- 加载时将非数组集合规范为空数组；失效项目引用转为待归纳，失效或跨项目阶段引用及失效关键词引用被清除，但有效提示词本体不得丢失。
- 多个独立应用进程同时写同一个 `userData` 目录不在支持范围内。
