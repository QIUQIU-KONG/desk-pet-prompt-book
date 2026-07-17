import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const workflowPath = new URL('../.github/workflows/release.yml', import.meta.url);

function extractPublishScript(workflow) {
  const stepMarker = '      - name: Create and publish owned draft\n';
  const stepStart = workflow.indexOf(stepMarker);
  assert.notEqual(stepStart, -1, 'publish step is missing');

  const runMarker = '        run: |\n';
  const runStart = workflow.indexOf(runMarker, stepStart);
  assert.notEqual(runStart, -1, 'publish step run block is missing');

  return workflow
    .slice(runStart + runMarker.length)
    .split('\n')
    .map((line) => line.startsWith('          ') ? line.slice(10) : line)
    .join('\n');
}

async function createGhStub(binDirectory) {
  const stubPath = path.join(binDirectory, 'gh-stub.cjs');
  await writeFile(stubPath, `
const fs = require('node:fs');
const args = process.argv.slice(2);
const scenario = process.env.GH_STUB_SCENARIO;
fs.appendFileSync(process.env.GH_STUB_LOG, JSON.stringify(args) + '\\n');

if (args[0] === 'release' && args[1] === 'view') {
  if (scenario === 'preexisting') {
    process.stdout.write('{"id":999}');
    process.exit(0);
  }
  process.exit(1);
}

if (args[0] === 'release' && args[1] === 'upload') {
  process.exit(scenario === 'upload-failure' ? 1 : 0);
}

if (args[0] === 'api' && args.includes('POST')) {
  process.stdout.write('{"id":123}');
  process.exit(0);
}

if (args[0] === 'api' && args.includes('PATCH')) {
  process.exit(scenario === 'patch-ambiguous' ? 1 : 0);
}

if (args[0] === 'api' && args.includes('DELETE')) {
  process.exit(0);
}

const jqIndex = args.indexOf('--jq');
const jq = jqIndex === -1 ? '' : args[jqIndex + 1];
if (jq === '.assets[].name') {
  if (scenario === 'asset-mismatch') {
    process.stdout.write('Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe\\nextra.exe\\n');
  } else {
    process.stdout.write('Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe\\nSHA256SUMS.txt\\n');
  }
  process.exit(0);
}

if (jq === '.draft') {
  process.stdout.write('true\\n');
  process.exit(0);
}

process.exit(0);
`, 'utf8');

  if (process.platform === 'win32') {
    await writeFile(
      path.join(binDirectory, 'gh.cmd'),
      '@echo off\r\nnode "%~dp0gh-stub.cjs" %*\r\n',
      'utf8'
    );
    return;
  }

  const launcherPath = path.join(binDirectory, 'gh');
  await writeFile(
    launcherPath,
    '#!/usr/bin/env sh\nexec node "$(dirname "$0")/gh-stub.cjs" "$@"\n',
    'utf8'
  );
  await chmod(launcherPath, 0o755);
}

async function runPublishScenario(script, scenario, tag = 'v0.1.0-beta.1') {
  const root = await mkdtemp(path.join(tmpdir(), 'desk-pet-release-workflow-'));
  const binDirectory = path.join(root, 'bin');
  const notesDirectory = path.join(root, 'release-artifacts', 'docs', 'releases');
  const distDirectory = path.join(root, 'release-artifacts', 'dist');
  const scriptPath = path.join(root, 'publish.ps1');
  const logPath = path.join(root, 'gh-calls.jsonl');

  await mkdir(binDirectory, { recursive: true });
  await mkdir(notesDirectory, { recursive: true });
  await mkdir(distDirectory, { recursive: true });
  await createGhStub(binDirectory);
  await writeFile(path.join(notesDirectory, 'v0.1.0-beta.1.md'), 'Release notes', 'utf8');
  await writeFile(path.join(distDirectory, 'Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe'), 'installer', 'utf8');
  await writeFile(path.join(distDirectory, 'SHA256SUMS.txt'), 'checksum', 'utf8');
  await writeFile(scriptPath, script, 'utf8');
  await writeFile(logPath, '', 'utf8');

  const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const result = spawnSync(shell, [
    '-NoProfile',
    ...(process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : []),
    '-File',
    scriptPath
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH}`,
      GH_STUB_LOG: logPath,
      GH_STUB_SCENARIO: scenario,
      GH_TOKEN: 'test-token',
      GITHUB_REF_NAME: tag,
      GITHUB_REPOSITORY: 'QIUQIU-KONG/desk-pet-prompt-book',
      GITHUB_SHA: '0123456789abcdef'
    }
  });
  const calls = (await readFile(logPath, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  return { calls, result };
}

function hasCall(calls, command, method) {
  return calls.some((args) => args[0] === command && (!method || args.includes(method)));
}

test('release workflow publish script preserves existing and ambiguously published releases', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const script = extractPublishScript(workflow);

  const malicious = await runPublishScenario(script, 'success', "v0.1.0-beta.1'; injected");
  assert.notEqual(malicious.result.status, 0);
  assert.equal(malicious.calls.length, 0);

  const preexisting = await runPublishScenario(script, 'preexisting');
  assert.notEqual(preexisting.result.status, 0);
  assert.equal(hasCall(preexisting.calls, 'api', 'POST'), false);
  assert.equal(hasCall(preexisting.calls, 'api', 'DELETE'), false);

  const assetMismatch = await runPublishScenario(script, 'asset-mismatch');
  assert.notEqual(assetMismatch.result.status, 0);
  const draftQueryIndex = assetMismatch.calls.findIndex((args) => args.includes('.draft'));
  const deleteIndex = assetMismatch.calls.findIndex((args) => args.includes('DELETE'));
  assert.ok(draftQueryIndex >= 0);
  assert.ok(deleteIndex > draftQueryIndex);

  const ambiguousPublish = await runPublishScenario(script, 'patch-ambiguous');
  assert.notEqual(ambiguousPublish.result.status, 0);
  assert.equal(hasCall(ambiguousPublish.calls, 'api', 'PATCH'), true);
  assert.equal(hasCall(ambiguousPublish.calls, 'api', 'DELETE'), false);

  const success = await runPublishScenario(script, 'success');
  assert.equal(success.result.status, 0, success.result.stderr || success.result.stdout);
  assert.equal(hasCall(success.calls, 'api', 'POST'), true);
  assert.equal(hasCall(success.calls, 'release'), true);
  assert.equal(hasCall(success.calls, 'api', 'PATCH'), true);
  assert.equal(hasCall(success.calls, 'api', 'DELETE'), false);
});
