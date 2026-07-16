const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const REQUIRED_PUBLIC_FILES = [
  'README.md',
  'README.en.md',
  'LICENSE',
  'ASSET-LICENSE.md',
  'PRIVACY.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml',
  '.github/dependabot.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/pull_request_template.md'
];
const TEXT_EXTENSIONS = new Set([
  '',
  '.cjs',
  '.css',
  '.html',
  '.ini',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.txt',
  '.yaml',
  '.yml'
]);
const BINARY_ASSET_EXTENSIONS = new Set(['.gif', '.ico', '.jpeg', '.jpg', '.png', '.webp']);

function resolveGitBinary(rootDir) {
  const candidates = [
    process.env.DESK_PET_GIT,
    path.resolve(rootDir, '..', '.tools', 'PortableGit', 'cmd', 'git.exe')
  ].filter(Boolean);

  return candidates.find((candidate) => fsSync.existsSync(candidate)) || 'git';
}

function findSensitivePathMatches(text, filePath) {
  const pattern = /(?:(?<![A-Za-z0-9_])[A-Za-z]:\\(?=[A-Za-z0-9_.-]{2})[^\s`"']+|\/Users\/[^\s`"']+|\/home\/[^\s`"']+)/g;

  return String(text).split(/\r?\n/).flatMap((lineText, index) =>
    [...lineText.matchAll(pattern)].map((match) => ({
      filePath,
      line: index + 1,
      value: match[0]
    }))
  );
}

function validatePackageMetadata(packageJson) {
  const errors = [];

  if (packageJson.private !== true) errors.push('package.json must keep private=true');
  if (packageJson.license !== 'MIT') errors.push('package.json license must be MIT');
  if (!packageJson.repository?.url) errors.push('package.json repository.url is required');
  if (!packageJson.bugs?.url) errors.push('package.json bugs.url is required');
  if (!packageJson.homepage) errors.push('package.json homepage is required');
  if (!packageJson.packageManager?.startsWith('pnpm@')) errors.push('package.json packageManager is required');
  if (!packageJson.engines?.node) errors.push('package.json engines.node is required');

  return errors;
}

function addReadinessFindings(target, findings, strict) {
  if (findings.length === 0) {
    return;
  }

  target[strict ? 'errors' : 'warnings'].push(...findings);
}

function isTextFile(filePath) {
  const baseName = path.posix.basename(filePath);
  return baseName === '.gitignore'
    || baseName === '.gitattributes'
    || baseName === '.editorconfig'
    || TEXT_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase());
}

async function listTrackedFiles(rootDir) {
  const gitBinary = resolveGitBinary(rootDir);
  const { stdout } = await execFileAsync(gitBinary, ['ls-files', '-z'], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });

  return stdout.split('\0').filter(Boolean);
}

async function auditRepository({ rootDir = path.resolve(__dirname, '..'), strict = false } = {}) {
  const result = {
    errors: [],
    warnings: [],
    metrics: {
      trackedFiles: 0,
      trackedBinaryAssets: 0,
      requiredFilesPresent: 0,
      missingRequiredFiles: [],
      personalPathMatches: 0,
      runtimeCodexReferences: 0,
      trackedVisualDrafts: [],
      runtimeAssets: []
    }
  };

  let trackedFiles;
  try {
    trackedFiles = await listTrackedFiles(rootDir);
  } catch (error) {
    result.errors.push(`Unable to list tracked files: ${error.message}`);
    return result;
  }

  result.metrics.trackedFiles = trackedFiles.length;
  result.metrics.trackedBinaryAssets = trackedFiles.filter((filePath) =>
    BINARY_ASSET_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase())
  ).length;
  result.metrics.trackedVisualDrafts = trackedFiles
    .filter((filePath) => filePath.startsWith('.codex/visuals/'))
    .sort();
  addReadinessFindings(
    result,
    result.metrics.trackedVisualDrafts.map((filePath) => `Tracked visual draft remains: ${filePath}`),
    strict
  );

  const trackedSet = new Set(trackedFiles);
  result.metrics.missingRequiredFiles = REQUIRED_PUBLIC_FILES.filter((filePath) => !trackedSet.has(filePath));
  result.metrics.requiredFilesPresent = REQUIRED_PUBLIC_FILES.length - result.metrics.missingRequiredFiles.length;
  addReadinessFindings(
    result,
    result.metrics.missingRequiredFiles.map((filePath) => `Missing public repository file: ${filePath}`),
    strict
  );

  const sensitiveMatches = [];
  let runtimeCodexReferences = 0;

  for (const filePath of trackedFiles.filter(isTextFile)) {
    const absolutePath = path.join(rootDir, ...filePath.split('/'));
    let text;
    try {
      text = await fs.readFile(absolutePath, 'utf8');
    } catch {
      continue;
    }

    sensitiveMatches.push(...findSensitivePathMatches(text, filePath));
    if (/^(?:src\/renderer|prototype\/desktop-pet-preview)\//.test(filePath)) {
      runtimeCodexReferences += (text.match(/\.codex[\\/]/g) || []).length;
    }
  }

  result.metrics.personalPathMatches = sensitiveMatches.length;
  result.metrics.runtimeCodexReferences = runtimeCodexReferences;
  addReadinessFindings(
    result,
    sensitiveMatches.map((match) => `Absolute path in ${match.filePath}:${match.line}: ${match.value}`),
    strict
  );
  addReadinessFindings(
    result,
    runtimeCodexReferences > 0
      ? [`Runtime files contain ${runtimeCodexReferences} reference(s) to .codex assets`]
      : [],
    strict
  );

  const rendererAssetPrefix = trackedFiles.some((filePath) => filePath.startsWith('src/renderer/assets/'))
    ? 'src/renderer/assets/'
    : 'prototype/desktop-pet-preview/assets/';
  result.metrics.runtimeAssets = trackedFiles
    .filter((filePath) => filePath.startsWith(rendererAssetPrefix))
    .filter((filePath) => BINARY_ASSET_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase()))
    .map((filePath) => path.posix.basename(filePath))
    .sort();

  try {
    const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
    addReadinessFindings(result, validatePackageMetadata(packageJson), strict);
  } catch (error) {
    result.errors.push(`Unable to read package.json: ${error.message}`);
  }

  return result;
}

async function runCli() {
  const args = new Set(process.argv.slice(2));
  const strict = args.has('--strict');
  const json = args.has('--json');
  const result = await auditRepository({ strict });

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`Open-source readiness: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
    result.errors.forEach((message) => console.error(`ERROR: ${message}`));
    result.warnings.forEach((message) => console.warn(`WARN: ${message}`));
  }

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

module.exports = {
  REQUIRED_PUBLIC_FILES,
  auditRepository,
  findSensitivePathMatches,
  resolveGitBinary,
  validatePackageMetadata
};

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
