import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  CHECKSUM_FILE_NAME,
  assertBetaReleaseIdentity,
  assertExpectedInstaller,
  expectedInstallerName,
  isHeadContainedInRemoteMain,
  parseReleaseTag,
  verifyChecksum,
  writeChecksum
} = require('../scripts/release-contract.cjs');

test('release tags require a leading v and expose the package version', () => {
  assert.equal(parseReleaseTag('v0.1.0-beta.1'), '0.1.0-beta.1');
  assert.throws(() => parseReleaseTag('0.1.0-beta.1'), /leading v/i);
  assert.throws(() => parseReleaseTag('vbeta'), /semantic version/i);
});

test('beta release identity requires matching prerelease package and protected-main ancestry', () => {
  assert.deepEqual(assertBetaReleaseIdentity({
    tag: 'v0.1.0-beta.1',
    packageVersion: '0.1.0-beta.1',
    isOnMain: true
  }), {
    installerName: 'Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe',
    version: '0.1.0-beta.1'
  });

  assert.throws(() => assertBetaReleaseIdentity({
    tag: 'v0.1.0-beta.2',
    packageVersion: '0.1.0-beta.1',
    isOnMain: true
  }), /does not match/i);
  assert.throws(() => assertBetaReleaseIdentity({
    tag: 'v0.1.0',
    packageVersion: '0.1.0',
    isOnMain: true
  }), /prerelease/i);
  assert.throws(() => assertBetaReleaseIdentity({
    tag: 'v0.1.0-beta.1',
    packageVersion: '0.1.0-beta.1',
    isOnMain: false
  }), /origin\/main/i);
});

test('installer naming is derived from the package version', () => {
  assert.equal(
    expectedInstallerName('0.1.0-beta.1'),
    'Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe'
  );
});

test('protected-main ancestry maps Git merge-base exit codes without guessing', () => {
  assert.equal(isHeadContainedInRemoteMain({ spawn: () => ({ status: 0 }) }), true);
  assert.equal(isHeadContainedInRemoteMain({ spawn: () => ({ status: 1 }) }), false);
  assert.throws(
    () => isHeadContainedInRemoteMain({ spawn: () => ({ status: 128, stderr: 'missing ref' }) }),
    /missing ref/
  );
});

test('artifact contract requires exactly one correctly named setup executable', async () => {
  const distDirectory = await mkdtemp(path.join(tmpdir(), 'desk-pet-release-'));
  const installerName = expectedInstallerName('0.1.0-beta.1');

  try {
    assert.throws(
      () => assertExpectedInstaller(distDirectory, '0.1.0-beta.1'),
      /exactly one setup executable/i
    );

    await writeFile(path.join(distDirectory, installerName), 'installer-one');
    assert.equal(
      assertExpectedInstaller(distDirectory, '0.1.0-beta.1'),
      path.join(distDirectory, installerName)
    );

    await writeFile(path.join(distDirectory, 'Desk-Pet-Prompt-Book-Setup-0.1.0-beta.2.exe'), 'installer-two');
    assert.throws(
      () => assertExpectedInstaller(distDirectory, '0.1.0-beta.1'),
      /exactly one setup executable/i
    );
  } finally {
    await rm(distDirectory, { recursive: true, force: true });
  }
});

test('checksum manifest verifies the exact installer and detects tampering', async () => {
  const distDirectory = await mkdtemp(path.join(tmpdir(), 'desk-pet-checksum-'));
  const installerPath = path.join(distDirectory, expectedInstallerName('0.1.0-beta.1'));
  const checksumPath = path.join(distDirectory, CHECKSUM_FILE_NAME);

  try {
    await writeFile(installerPath, 'accepted installer bytes');
    const hash = writeChecksum(installerPath, checksumPath);

    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(verifyChecksum(installerPath, checksumPath), hash);

    await writeFile(installerPath, 'tampered installer bytes');
    assert.throws(() => verifyChecksum(installerPath, checksumPath), /does not match/i);

    await writeFile(checksumPath, `${hash}  wrong-name.exe\n`);
    assert.throws(() => verifyChecksum(installerPath, checksumPath), /file name/i);
  } finally {
    await rm(distDirectory, { recursive: true, force: true });
  }
});
