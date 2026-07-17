import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packagePath = new URL('../package.json', import.meta.url);
const builderConfigPath = new URL('../electron-builder.yml', import.meta.url);
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
