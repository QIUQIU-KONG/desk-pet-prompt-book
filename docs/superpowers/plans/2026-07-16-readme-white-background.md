# README 桌宠白底截图实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 README 桌宠实机图更新为纯白背景，同时保持当前真实 Electron 桌宠的构图、内容和 `1280x900` 尺寸。

**Architecture:** 回归测试使用 Node 内置 `zlib` 解码 PNG 扫描行，锁定尺寸与外框纯白像素。截图过程通过隔离临时 `userData` 启动真实 `220x220` Electron 桌宠，将设备缩放固定为 2 并捕获 `440x440` 透明 PNG，再缩放到 `704x704`，居中合成到纯白 `1280x900` 文档画布；不改运行时 CSS 或用户数据。

**Tech Stack:** Node.js 24、Node Test Runner、Electron 39.8.10、Playwright Electron、Pillow 12、PowerShell、PNG。

## Global Constraints

- 最终文件路径固定为 `docs/images/desktop-pet-preview.png`。
- 输出尺寸固定为 `1280x900` PNG，背景固定为纯白 `#FFFFFF`。
- 原始输入必须来自真实 `220x220` Electron 桌宠窗口和隔离临时 `userData`，设备缩放固定为 2，捕获尺寸为 `440x440`。
- 完整设备像素视口等比缩放为 `704x704`，放置位置固定为 `(288, 98)`，保持现有居中构图。
- 魔法书、花体英文、钢笔、蝴蝶、光点、书脊光效和底部交互提示不得重绘或裁切。
- 不修改桌宠透明窗口、运行时 CSS、README 图片路径或视觉文件总数。
- 8 个视觉文件继续保持 `license-pending`。
- 完成后提交并推送 `main`，核验 Windows、Ubuntu 和 Dependency audit 三个 CI 作业。

---

### Task 1: 锁定纯白背景像素契约

**Files:**
- Modify: `tests/open-source-readiness.test.mjs`
- Test: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Consumes: `docs/images/desktop-pet-preview.png` 的 PNG 字节。
- Produces: `readPngPixel(buffer, x, y): [red, green, blue, alpha]` 测试辅助函数与白色外框断言。

- [x] **Step 1: 在测试文件中加入 PNG 像素解码辅助函数**

增加 `inflateSync` 导入，并实现仅用于仓库截图契约的 8-bit、非隔行、RGB/RGBA PNG 解码：

```js
import { inflateSync } from 'node:zlib';

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function readPngPixel(buffer, targetX, targetY) {
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  assert.equal(bitDepth, 8);
  assert.ok(colorType === 2 || colorType === 6);
  assert.equal(interlace, 0);
  assert.ok(targetX >= 0 && targetX < width);
  assert.ok(targetY >= 0 && targetY < height);

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  let sourceOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const current = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + stride));
    sourceOffset += stride;

    for (let index = 0; index < stride; index += 1) {
      const left = index >= bytesPerPixel ? current[index - bytesPerPixel] : 0;
      const up = previous[index];
      const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      let predictor = 0;

      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paethPredictor(left, up, upLeft);
      else assert.equal(filter, 0);

      current[index] = (current[index] + predictor) & 0xff;
    }

    if (y === targetY) {
      const pixelOffset = targetX * bytesPerPixel;
      return [
        current[pixelOffset],
        current[pixelOffset + 1],
        current[pixelOffset + 2],
        bytesPerPixel === 4 ? current[pixelOffset + 3] : 255
      ];
    }

    previous = current;
  }

  throw new Error('PNG pixel was outside the decoded image.');
}
```

- [x] **Step 2: 增加白色外框断言**

在桌宠截图尺寸断言之后加入：

```js
const whiteBackgroundPoints = [
  [0, 0], [640, 0], [1279, 0],
  [0, 450], [1279, 450],
  [0, 899], [640, 899], [1279, 899],
  [100, 100], [1180, 100], [100, 800], [1180, 800]
];

whiteBackgroundPoints.forEach(([x, y]) => {
  assert.deepEqual(readPngPixel(petScreenshot, x, y), [255, 255, 255, 255]);
});
```

- [x] **Step 3: 运行测试并确认 RED**

Run: `corepack pnpm exec node --test tests/open-source-readiness.test.mjs`

Expected: `public documentation states project status, privacy, and license boundaries` 因旧图外框像素为深色而失败，失败值不是 `[255,255,255,255]`。

---

### Task 2: 捕获真实 Electron 桌宠并合成白底文档图

**Files:**
- Modify: `docs/images/desktop-pet-preview.png`
- Modify: `docs/asset-provenance.md`
- Modify: `CHANGELOG.md`
- Modify: `.codex/agent-context.md`
- Test: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Consumes: `src/electron/main.cjs` 创建的真实 `220x220` 透明桌宠窗口。
- Produces: 居中白底 `1280x900` README PNG，以及准确的来源记录。

- [x] **Step 1: 用隔离 `userData` 捕获透明桌宠**

通过临时 Electron wrapper 在加载主进程前调用 `app.commandLine.appendSwitch('force-device-scale-factor', '2')` 和 `app.setPath('userData', tempUserData)`。使用 Playwright `_electron.launch()` 启动项目 Electron，等待首个窗口的 `innerWidth === 220 && innerHeight === 220 && devicePixelRatio === 2`，然后执行：

```js
await page.screenshot({
  path: transparentPetPath,
  type: 'png',
  omitBackground: true,
  animations: 'disabled',
  scale: 'device'
});
```

关闭 Electron 并删除临时 `userData` 与 wrapper，不读取正式用户目录。

- [x] **Step 2: 合成纯白 `1280x900` 文档画布**

使用工作区依赖中的 Python 与 Pillow：

```python
from PIL import Image

pet = Image.open(transparent_pet_path).convert('RGBA')
native_white = Image.new('RGBA', (440, 440), (255, 255, 255, 255))
native_white.alpha_composite(pet)
scaled = native_white.convert('RGB').resize((704, 704), Image.Resampling.LANCZOS)
canvas = Image.new('RGB', (1280, 900), (255, 255, 255))
canvas.paste(scaled, (288, 98))
canvas.save(output_path, format='PNG', optimize=True)
```

先在 `440x440` 设备像素尺寸上合成白色，再缩放 RGB 图，避免透明边缘产生黑边，并保留原 README 图的清晰度。

- [x] **Step 3: 更新来源与上下文记录**

- `docs/asset-provenance.md`：说明该图来自隔离真实 Electron `220x220` 捕获，并居中合成到纯白 `1280x900` 文档画布。
- `CHANGELOG.md`：在当前 Unreleased 的 Added/Changed 记录 README 桌宠图切换为纯白背景。
- `.codex/agent-context.md`：记录白底截图尺寸、几何参数和不修改透明运行窗口的决定。

- [x] **Step 4: 运行目标测试并确认 GREEN**

Run: `corepack pnpm exec node --test tests/open-source-readiness.test.mjs`

Expected: 11 个 readiness 测试全部通过，白色像素、PNG 签名和 `1280x900` 尺寸契约均通过。

- [x] **Step 5: 视觉检查**

以原始尺寸打开 `docs/images/desktop-pet-preview.png`，确认：

- 外部背景完全为白色，没有深色残留；
- 书本、三只蝴蝶、光点、书脊与底部光效完整；
- 花体英文与“单击展开 · 双击捕获”可读；
- 没有黑边、裁切或元素位置漂移。

---

### Task 3: 完整验证、提交、推送与 CI

**Files:**
- Create: `docs/superpowers/plans/2026-07-16-readme-white-background.md`
- Update local-only record: `.codex/last-verified.local.json`

**Interfaces:**
- Consumes: 白底截图、回归测试和文档记录。
- Produces: 干净提交、同步远端 `main` 和通过的 GitHub Actions。

- [x] **Step 1: 运行提交前完整质量门**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall`

Expected: 语法检查、完整测试、严格 readiness、依赖审计与 Git 检查全部退出 0。

- [x] **Step 2: 提交变更**

```powershell
git add tests/open-source-readiness.test.mjs docs/images/desktop-pet-preview.png docs/asset-provenance.md CHANGELOG.md .codex/agent-context.md docs/superpowers/plans/2026-07-16-readme-white-background.md
git diff --cached --check
git commit -m "docs: use white README pet background"
```

Expected: 提交中没有临时透明截图、wrapper、用户数据或其他无关文件。

- [ ] **Step 3: 验证新提交并推送**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall -Push`

Expected: 完整质量门再次通过，`main` 推送成功。

- [ ] **Step 4: 核验远端 SHA 与 CI**

确认本地 `HEAD` 等于远端 `main`，并通过 GitHub API等待该 SHA 的 CI workflow 完成。

Expected: `Verify (windows-latest)`、`Verify (ubuntu-latest)` 和 `Dependency audit` 均为 `success`。

- [ ] **Step 5: 展示最终图片**

向用户展示新的 `docs/images/desktop-pet-preview.png`，并报告提交 SHA、测试和 CI 结果。
