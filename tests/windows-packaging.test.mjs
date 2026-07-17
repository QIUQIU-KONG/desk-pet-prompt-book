import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packagePath = new URL('../package.json', import.meta.url);
const builderConfigPath = new URL('../electron-builder.yml', import.meta.url);
const iconPath = new URL('../build/icon.ico', import.meta.url);
const iconScriptPath = fileURLToPath(new URL('../scripts/generate-windows-icon.ps1', import.meta.url));
const workspacePath = new URL('../pnpm-workspace.yaml', import.meta.url);
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const builderConfig = existsSync(builderConfigPath)
  ? await readFile(builderConfigPath, 'utf8')
  : '';
const workspaceConfig = await readFile(workspacePath, 'utf8');

test('package metadata identifies the Windows beta build', () => {
  assert.equal(packageJson.version, '0.1.0-beta.1');
  assert.equal(packageJson.devDependencies.electron, '39.8.10');
  assert.equal(packageJson.devDependencies['electron-builder'], '26.15.3');
  assert.equal(packageJson.scripts['build:win'], 'electron-builder --win nsis --x64 --publish never');
});

test('electron-builder config defines the approved application identity', () => {
  assert.equal(existsSync(builderConfigPath), true);
  assert.match(builderConfig, /^appId: com\.qiuqiukong\.deskpetpromptbook$/m);
  assert.match(builderConfig, /^productName: 桌宠提示词魔法书$/m);
  assert.match(builderConfig, /^executableName: DeskPetPromptBook$/m);
  assert.match(builderConfig, /^asar: true$/m);
  assert.match(builderConfig, /^\s+buildResources: build$/m);
  assert.match(builderConfig, /^\s+output: dist$/m);
  assert.match(builderConfig, /^\s+icon: build\/icon\.ico$/m);
  assert.match(builderConfig, /^\s+artifactName: Desk-Pet-Prompt-Book-Setup-\$\{version\}\.\$\{ext\}$/m);
});

test('electron-builder config packages only the required runtime and legal files', () => {
  [
    'src/**/*',
    'package.json',
    'LICENSE',
    'ASSET-LICENSE.md',
    'PRIVACY.md'
  ].forEach((filePath) => {
    assert.match(builderConfig, new RegExp(`^\\s+- ${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  });
});

test('NSIS remains assisted per-user and preserves user data', () => {
  assert.match(builderConfig, /^\s+oneClick: false$/m);
  assert.match(builderConfig, /^\s+perMachine: false$/m);
  assert.match(builderConfig, /^\s+allowElevation: false$/m);
  assert.match(builderConfig, /^\s+allowToChangeInstallationDirectory: true$/m);
  assert.match(builderConfig, /^\s+createDesktopShortcut: always$/m);
  assert.match(builderConfig, /^\s+createStartMenuShortcut: true$/m);
  assert.match(builderConfig, /^\s+shortcutName: 桌宠提示词魔法书$/m);
  assert.match(builderConfig, /^\s+runAfterFinish: true$/m);
  assert.match(builderConfig, /^\s+deleteAppDataOnUninstall: false$/m);
  assert.doesNotMatch(builderConfig, /portable|runOnStartup|autoUpdater/i);
});

test('Windows packaging targets NSIS x64 only', () => {
  assert.match(builderConfig, /^\s+- target: nsis$/m);
  assert.match(builderConfig, /^\s+- x64$/m);
  assert.doesNotMatch(builderConfig, /^\s+- (?:ia32|arm64)$/m);
});

test('pnpm explicitly rejects the unused Squirrel installer build script', () => {
  assert.match(workspaceConfig, /^\s+electron: true$/m);
  assert.match(workspaceConfig, /^\s+electron-winstaller: false$/m);
  assert.doesNotMatch(workspaceConfig, /set this to true or false/);
});

function readIcoSizes(icon) {
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  const count = icon.readUInt16LE(4);
  const sizes = [];

  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = icon[entryOffset] || 256;
    const height = icon[entryOffset + 1] || 256;
    const byteLength = icon.readUInt32LE(entryOffset + 8);
    const imageOffset = icon.readUInt32LE(entryOffset + 12);

    assert.equal(width, height);
    assert.ok(byteLength > 8);
    assert.ok(imageOffset + byteLength <= icon.length);
    assert.deepEqual(
      [...icon.subarray(imageOffset, imageOffset + 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    );
    sizes.push(width);
  }

  return sizes;
}

test('Windows icon contains the approved multi-size transparent artwork entries', async () => {
  assert.equal(existsSync(iconPath), true);
  const icon = await readFile(iconPath);

  assert.equal(icon.readUInt16LE(4), 6);
  assert.deepEqual(readIcoSizes(icon), [16, 32, 48, 64, 128, 256]);
});

test('Windows icon generator resolves its default source path on Windows PowerShell', async () => {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'desk-pet-icon-'));
  const outputPath = path.join(tempDirectory, 'icon.ico');

  try {
    const result = spawnSync('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      iconScriptPath,
      '-OutputPath',
      outputPath
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(outputPath), true);
    assert.deepEqual(readIcoSizes(await readFile(outputPath)), [16, 32, 48, 64, 128, 256]);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
