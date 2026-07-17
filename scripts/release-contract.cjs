const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CHECKSUM_FILE_NAME = 'SHA256SUMS.txt';
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;

function parseReleaseTag(tag) {
  if (typeof tag !== 'string' || !tag.startsWith('v')) {
    throw new Error('Release tag must have a leading v.');
  }

  const version = tag.slice(1);
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Release tag does not contain a semantic version: ${tag}`);
  }

  return version;
}

function expectedInstallerName(version) {
  if (!VERSION_PATTERN.test(String(version))) {
    throw new Error(`Invalid installer version: ${version}`);
  }

  return `Desk-Pet-Prompt-Book-Setup-${version}.exe`;
}

function assertBetaReleaseIdentity({ tag, packageVersion, isOnMain }) {
  const version = parseReleaseTag(tag);

  if (version !== packageVersion) {
    throw new Error(`Tag version ${version} does not match package version ${packageVersion}.`);
  }
  if (!version.includes('-')) {
    throw new Error(`Beta workflow requires a prerelease version: ${version}.`);
  }
  if (!isOnMain) {
    throw new Error('Tagged commit is not contained in origin/main.');
  }

  return {
    installerName: expectedInstallerName(version),
    version
  };
}

function isHeadContainedInRemoteMain({
  cwd = PROJECT_ROOT,
  gitBinary = 'git',
  spawn = spawnSync
} = {}) {
  const result = spawn(
    gitBinary,
    ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'],
    { cwd, encoding: 'utf8' }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    return true;
  }
  if (result.status === 1) {
    return false;
  }

  const detail = String(result.stderr || result.stdout || `Git exited with ${result.status}`).trim();
  throw new Error(`Unable to verify origin/main ancestry: ${detail}`);
}

function assertExpectedInstaller(distDirectory, version) {
  const expectedName = expectedInstallerName(version);
  let entries = [];

  try {
    entries = fs.readdirSync(distDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const executables = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
    .map((entry) => entry.name)
    .sort();

  if (executables.length !== 1) {
    throw new Error(`Expected exactly one setup executable named ${expectedName}; found ${executables.length}.`);
  }
  if (executables[0] !== expectedName) {
    throw new Error(`Setup executable is incorrectly named: ${executables[0]}; expected ${expectedName}.`);
  }

  return path.join(distDirectory, expectedName);
}

function hashFile(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeChecksum(installerPath, checksumPath) {
  const hash = hashFile(installerPath);
  fs.writeFileSync(checksumPath, `${hash}  ${path.basename(installerPath)}\n`, 'utf8');
  return hash;
}

function verifyChecksum(installerPath, checksumPath) {
  const lines = fs.readFileSync(checksumPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.length > 0);

  if (lines.length !== 1) {
    throw new Error(`${CHECKSUM_FILE_NAME} must contain exactly one checksum entry.`);
  }

  const match = lines[0].match(/^([0-9a-fA-F]{64}) {2}(.+)$/);
  if (!match) {
    throw new Error(`${CHECKSUM_FILE_NAME} is not in SHA-256 manifest format.`);
  }

  const [, expectedHash, expectedFileName] = match;
  if (expectedFileName !== path.basename(installerPath)) {
    throw new Error(`Checksum file name ${expectedFileName} does not match ${path.basename(installerPath)}.`);
  }

  const actualHash = hashFile(installerPath);
  if (actualHash !== expectedHash.toLowerCase()) {
    throw new Error(`Installer SHA-256 does not match ${CHECKSUM_FILE_NAME}.`);
  }

  return actualHash;
}

function readPackageVersion() {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8')).version;
}

function runCli(rawArguments = process.argv.slice(2)) {
  const argumentsWithoutSeparator = rawArguments.filter((argument) => argument !== '--');
  const [command, explicitTag] = argumentsWithoutSeparator;
  const version = readPackageVersion();
  const distDirectory = path.join(PROJECT_ROOT, 'dist');
  const checksumPath = path.join(distDirectory, CHECKSUM_FILE_NAME);

  if (command === 'verify-tag') {
    const tag = explicitTag || process.env.GITHUB_REF_NAME;
    const identity = assertBetaReleaseIdentity({
      tag,
      packageVersion: version,
      isOnMain: isHeadContainedInRemoteMain()
    });
    console.log(`Release identity verified: v${identity.version}`);
    return;
  }

  const installerPath = assertExpectedInstaller(distDirectory, version);
  if (command === 'prepare-assets') {
    const hash = writeChecksum(installerPath, checksumPath);
    verifyChecksum(installerPath, checksumPath);
    console.log(`Release assets prepared: ${path.basename(installerPath)} ${hash}`);
    return;
  }
  if (command === 'verify-assets') {
    const hash = verifyChecksum(installerPath, checksumPath);
    console.log(`Release assets verified: ${path.basename(installerPath)} ${hash}`);
    return;
  }

  throw new Error('Usage: release-contract.cjs <verify-tag|prepare-assets|verify-assets> [tag]');
}

module.exports = {
  CHECKSUM_FILE_NAME,
  assertBetaReleaseIdentity,
  assertExpectedInstaller,
  expectedInstallerName,
  isHeadContainedInRemoteMain,
  parseReleaseTag,
  runCli,
  verifyChecksum,
  writeChecksum
};

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
