import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const {
  REQUIRED_PUBLIC_FILES,
  auditRepository,
  findSensitivePathMatches,
  validatePackageMetadata
} = require('../scripts/open-source-readiness.cjs');
const rootDir = fileURLToPath(new URL('../', import.meta.url));

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  if (upDistance <= upLeftDistance) {
    return up;
  }

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

      if (filter === 1) {
        predictor = left;
      } else if (filter === 2) {
        predictor = up;
      } else if (filter === 3) {
        predictor = Math.floor((left + up) / 2);
      } else if (filter === 4) {
        predictor = paethPredictor(left, up, upLeft);
      } else {
        assert.equal(filter, 0);
      }

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

test('readiness audit detects absolute paths but accepts environment paths', () => {
  const userPath = ['C:', 'Users', 'person', 'Desktop', 'file.png'].join('\\');
  const workspacePath = ['D:', 'workspace', 'asset.png'].join('\\');

  assert.equal(findSensitivePathMatches(userPath, 'a.md').length, 1);
  assert.equal(findSensitivePathMatches(workspacePath, 'a.md').length, 1);
  assert.equal(findSensitivePathMatches('%APPDATA%\\desk-pet-prompt-book', 'a.md').length, 0);
  assert.equal(findSensitivePathMatches('$CODEX_HOME/superpowers/skills', 'a.md').length, 0);
  assert.equal(findSensitivePathMatches('assert.match(css, /width:\\s*100%/);', 'a.mjs').length, 0);
  assert.equal(findSensitivePathMatches('assert.match(css, /--left-page-x:\\s*168px/);', 'a.mjs').length, 0);
});

test('readiness audit reports line numbers for every absolute path', () => {
  const firstPath = ['C:', 'work', 'one.png'].join('\\');
  const secondPath = ['/home', 'person', 'two.png'].join('/');
  const matches = findSensitivePathMatches(`safe\n${firstPath}\n${secondPath}`, 'paths.md');

  assert.deepEqual(matches, [
    { filePath: 'paths.md', line: 2, value: firstPath },
    { filePath: 'paths.md', line: 3, value: secondPath }
  ]);
});

test('package metadata requires public repository fields while keeping npm private', () => {
  const errors = validatePackageMetadata({
    name: 'desk-pet-prompt-book',
    version: '0.1.0',
    private: true
  });

  assert.ok(errors.some((message) => message.includes('license')));
  assert.ok(errors.some((message) => message.includes('repository')));
  assert.ok(errors.some((message) => message.includes('packageManager')));
});

test('package metadata accepts the planned public repository contract', () => {
  const errors = validatePackageMetadata({
    private: true,
    license: 'MIT',
    repository: { url: 'git+https://github.com/QIUQIU-KONG/desk-pet-prompt-book.git' },
    bugs: { url: 'https://github.com/QIUQIU-KONG/desk-pet-prompt-book/issues' },
    homepage: 'https://github.com/QIUQIU-KONG/desk-pet-prompt-book#readme',
    packageManager: 'pnpm@11.13.0',
    engines: { node: '>=24' }
  });

  assert.deepEqual(errors, []);
});

test('repository package metadata matches the public source contract', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.license, 'MIT');
  assert.equal(packageJson.packageManager, 'pnpm@11.13.0');
  assert.equal(packageJson.engines.node, '>=24');
  assert.match(packageJson.repository.url, /QIUQIU-KONG\/desk-pet-prompt-book/);
  assert.equal(packageJson.scripts.start, 'electron .');
  assert.equal(packageJson.scripts.pet, 'pnpm start');
  assert.match(packageJson.scripts.preview, /scripts\/preview-server\.cjs/);
  assert.match(packageJson.scripts['check:syntax'], /node --check/);
  assert.match(packageJson.scripts['audit:high'], /pnpm audit --audit-level high/);
  assert.match(packageJson.scripts['audit:high'], /--registry https:\/\/registry\.npmjs\.org/);
  assert.match(packageJson.scripts.readiness, /--strict/);
});

test('repository does not force an Electron download mirror', () => {
  assert.equal(existsSync(new URL('../.npmrc', import.meta.url)), false);
});

test('public documentation states project status, privacy, and license boundaries', async () => {
  const petScreenshotUrl = new URL('../docs/images/desktop-pet-preview.png', import.meta.url);
  const appScreenshotUrl = new URL('../docs/images/app-preview.png', import.meta.url);
  const [
    license,
    assetLicense,
    readme,
    englishReadme,
    privacy,
    security,
    contributing,
    codeOfConduct,
    changelog,
    architecture,
    dataAndPrivacy,
    assetProvenance
  ] = await Promise.all([
    'LICENSE',
    'ASSET-LICENSE.md',
    'README.md',
    'README.en.md',
    'PRIVACY.md',
    'SECURITY.md',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'CHANGELOG.md',
    'docs/architecture.md',
    'docs/data-and-privacy.md',
    'docs/asset-provenance.md'
  ].map((filePath) => readFile(new URL(`../${filePath}`, import.meta.url), 'utf8')));

  assert.match(license, /MIT License/);
  assert.match(assetLicense, /not licensed under the MIT License/i);
  assert.match(assetLicense, /Desk Pet Prompt Book Noncommercial Visual Asset License, Version 1\.0/);
  assert.match(assetLicense, /personal, educational, research, evaluation/i);
  assert.match(assetLicense, /commercial use/i);
  assert.match(assetLicense, /written permission/i);
  assert.match(assetLicense, /rights the project owner actually (?:owns|holds)/i);
  assert.match(assetLicense, /AI-generated content/i);
  assert.doesNotMatch(assetLicense, /license-pending/i);
  assert.match(assetLicense, /docs\/images\/desktop-pet-preview\.png/);
  assert.match(readme, /源码开发阶段（Alpha）/);
  assert.match(readme, /docs\/images\/desktop-pet-preview\.png[\s\S]*docs\/images\/app-preview\.png/);
  assert.match(readme, /docs\/images\/app-preview\.png/);
  assert.match(readme, /^## 产品理念$/m);
  assert.match(readme, /Build agents with clarity\. Let prompts become systems\./);
  assert.match(readme, /明确地构建代理，让提示词成为系统。/);
  assert.match(readme, /9 个分发视觉文件/);
  assert.match(readme, /MIT 代码与非商业视觉资产/);
  assert.match(englishReadme, /source-stage alpha/i);
  assert.match(englishReadme, /docs\/images\/desktop-pet-preview\.png[\s\S]*docs\/images\/app-preview\.png/);
  assert.match(englishReadme, /^## Product Philosophy$/m);
  assert.match(englishReadme, /Build agents with clarity\. Let prompts become systems\./);
  assert.match(englishReadme, /Nine distributed visual files/);
  assert.match(englishReadme, /MIT-licensed code with noncommercial visual assets/i);
  assert.match(privacy, /clipboard/i);
  assert.match(privacy, /not encrypted/i);
  assert.match(security, /privately/i);
  assert.match(contributing, /asset provenance/i);
  assert.match(contributing, /nine distributed visual files/i);
  assert.match(codeOfConduct, /Contributor Covenant Code of Conduct/);
  assert.match(codeOfConduct, /version 2\.1/i);
  assert.match(changelog, /0\.1\.0.*Unreleased/is);
  assert.match(architecture, /Electron main process/i);
  assert.match(dataAndPrivacy, /prompts\.json/);
  assert.match(assetProvenance, /Noncommercial Visual Asset License/i);
  assert.match(assetProvenance, /nine distributed visual files/i);
  assert.doesNotMatch(
    [assetLicense, readme, englishReadme, contributing, changelog, assetProvenance].join('\n'),
    /license-pending/i
  );
  assert.match(assetProvenance, /docs\/images\/desktop-pet-preview\.png/);
  assert.match(assetLicense, /pet-safe-glow-v1\.png/);
  assert.match(assetLicense, /pet-safe-butterfly-v1\.png/);
  assert.match(assetLicense, /build\/icon\.ico/);
  assert.match(assetProvenance, /pet-safe-glow-v1\.png/);
  assert.match(assetProvenance, /pet-safe-butterfly-v1\.png/);
  assert.match(assetProvenance, /build\/icon\.ico/);
  assert.ok(existsSync(petScreenshotUrl));
  assert.ok(existsSync(appScreenshotUrl));

  const petScreenshot = await readFile(petScreenshotUrl);
  assert.equal(petScreenshot.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(petScreenshot.readUInt32BE(16), 1280);
  assert.equal(petScreenshot.readUInt32BE(20), 900);

  const whiteBackgroundPoints = [
    [0, 0], [640, 0], [1279, 0],
    [0, 450], [1279, 450],
    [0, 899], [640, 899], [1279, 899],
    [100, 100], [1180, 100], [100, 800], [1180, 800]
  ];

  whiteBackgroundPoints.forEach(([x, y]) => {
    assert.deepEqual(readPngPixel(petScreenshot, x, y), [255, 255, 255, 255]);
  });

  const appScreenshot = await readFile(appScreenshotUrl);
  assert.equal(appScreenshot.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(appScreenshot.readUInt32BE(16), 1024);
  assert.equal(appScreenshot.readUInt32BE(20), 700);
});

test('repository automation enforces verification and structured contributions', async () => {
  const [
    ci,
    codeql,
    dependabot,
    bugReport,
    featureRequest,
    issueConfig,
    pullRequestTemplate
  ] = await Promise.all([
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/dependabot.yml',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/pull_request_template.md'
  ].map((filePath) => readFile(new URL(`../${filePath}`, import.meta.url), 'utf8')));

  assert.match(ci, /pull_request:/);
  assert.match(ci, /push:/);
  assert.match(ci, /permissions:\s*\n\s+contents: read/);
  assert.match(ci, /windows-latest/);
  assert.match(ci, /ubuntu-latest/);
  assert.match(ci, /pnpm install --frozen-lockfile/);
  assert.match(ci, /pnpm run check:syntax/);
  assert.match(ci, /pnpm test/);
  assert.match(ci, /pnpm run readiness/);
  assert.match(ci, /pnpm audit --audit-level high/);
  assert.match(codeql, /permissions:[\s\S]*security-events: write/);
  assert.match(codeql, /github\/codeql-action\/init@v3/);
  assert.match(codeql, /github\/codeql-action\/analyze@v3/);
  assert.match(dependabot, /package-ecosystem:\s*["']npm["']/);
  assert.match(dependabot, /package-ecosystem:\s*["']github-actions["']/);
  assert.match(dependabot, /interval:\s*["']weekly["']/);
  assert.match(bugReport, /sensitive/i);
  assert.match(featureRequest, /acceptance/i);
  assert.match(issueConfig, /blank_issues_enabled:\s*false/);
  assert.match(pullRequestTemplate, /Asset provenance/i);
  assert.match(pullRequestTemplate, /Privacy impact/i);
});

test('strict readiness requires GitHub automation files', () => {
  const expectedAutomationFiles = [
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/dependabot.yml',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/pull_request_template.md'
  ];

  expectedAutomationFiles.forEach((filePath) => {
    assert.ok(REQUIRED_PUBLIC_FILES.includes(filePath), `${filePath} must be required`);
  });

  assert.ok(REQUIRED_PUBLIC_FILES.includes('build/icon.ico'), 'build/icon.ico must be required');
});

test('Windows verification helper uses the pinned toolchain and local verification record', async () => {
  const script = await readFile(new URL('../scripts/verify-and-push.ps1', import.meta.url), 'utf8');

  assert.match(script, /DESK_PET_GIT/);
  assert.match(script, /DESK_PET_COREPACK/);
  assert.match(script, /pnpm', 'install', '--frozen-lockfile/);
  assert.match(script, /pnpm', 'run', 'check:syntax/);
  assert.match(script, /pnpm', 'test/);
  assert.match(script, /pnpm', 'run', 'readiness/);
  assert.match(script, /pnpm', 'audit', '--audit-level', 'high/);
  assert.match(script, /--registry', 'https:\/\/registry\.npmjs\.org/);
  assert.match(script, /git diff --check/);
  assert.match(script, /git diff --cached --check/);
  assert.match(script, /\.codex[\\/]last-verified\.local\.json/);
  assert.match(script, /git push/);
  assert.match(script, /credential\.helper=/);
  assert.match(script, /credential\.helper=manager/);
  assert.match(script, /http\.lowSpeedTime=120/);
  assert.match(script, /GCM_INTERACTIVE/);
  assert.match(script, /stageTimings/);
  assert.match(script, /totalSeconds/);
  assert.doesNotMatch(script, /github_pat_|ghp_|Authorization:\s*(?:Basic|Bearer)/);
});

test('current tracked tree uses only production renderer assets and portable paths', async () => {
  const result = await auditRepository({ rootDir, strict: false });

  assert.equal(result.errors.length, 0);
  assert.equal(result.metrics.runtimeCodexReferences, 0);
  assert.deepEqual(result.metrics.trackedVisualDrafts, []);
  assert.deepEqual(result.metrics.runtimeAssets, [
    'page-mask-left.png',
    'page-mask-right.png',
    'panel-book-ui-v3b-alpha.png',
    'pet-book-body-v5-alpha.png',
    'pet-safe-butterfly-v1.png',
    'pet-safe-glow-v1.png'
  ]);
  assert.equal(result.metrics.personalPathMatches, 0);
});
