[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$Push,
  [string]$Remote = 'origin',
  [string]$Branch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$recordPath = Join-Path $root '.codex\last-verified.local.json'
$completedCommands = [Collections.Generic.List[string]]::new()
$stageTimings = [Collections.Generic.List[object]]::new()
$workflowWatch = [Diagnostics.Stopwatch]::StartNew()

function Resolve-Tool {
  param(
    [string]$Override,
    [string[]]$Candidates,
    [string]$CommandName
  )

  if (-not [string]::IsNullOrWhiteSpace($Override)) {
    if (Test-Path -LiteralPath $Override -PathType Leaf) {
      return (Resolve-Path -LiteralPath $Override).Path
    }

    $overrideCommand = Get-Command $Override -ErrorAction SilentlyContinue
    if ($overrideCommand) {
      return $overrideCommand.Source
    }

    throw "Configured tool was not found: $Override"
  }

  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Required command was not found: $CommandName"
  }

  return $command.Source
}

function Invoke-Checked {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$Arguments
  )

  Write-Host "==> $Name"
  $stageWatch = [Diagnostics.Stopwatch]::StartNew()
  & $FilePath @Arguments
  $exitCode = $LASTEXITCODE
  $stageWatch.Stop()
  $seconds = [Math]::Round($stageWatch.Elapsed.TotalSeconds, 3)
  $stageTimings.Add([ordered]@{
    name = $Name
    seconds = $seconds
    exitCode = $exitCode
  })
  Write-Host ("<== {0} ({1:N3}s)" -f $Name, $seconds)

  if ($exitCode -ne 0) {
    throw "$Name failed with exit code $exitCode"
  }
  $completedCommands.Add($Name)
}

function Invoke-Captured {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [switch]$AllowFailure
  )

  $output = & $FilePath @Arguments 2>$null
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "$FilePath $($Arguments -join ' ') failed with exit code $exitCode"
  }
  return [pscustomobject]@{
    ExitCode = $exitCode
    Text = ($output -join [Environment]::NewLine).Trim()
  }
}

$git = Resolve-Tool `
  -Override $env:DESK_PET_GIT `
  -Candidates @((Join-Path $root '..\.tools\PortableGit\cmd\git.exe')) `
  -CommandName 'git'
$corepack = Resolve-Tool `
  -Override $env:DESK_PET_COREPACK `
  -Candidates @() `
  -CommandName 'corepack'

Push-Location $root
try {
  if (-not $SkipInstall) {
    Invoke-Checked 'pnpm install --frozen-lockfile' $corepack @(
      'pnpm', 'install', '--frozen-lockfile'
    )
  }

  Invoke-Checked 'pnpm run check:syntax' $corepack @(
    'pnpm', 'run', 'check:syntax'
  )
  Invoke-Checked 'pnpm test' $corepack @(
    'pnpm', 'test'
  )
  Invoke-Checked 'pnpm run readiness' $corepack @(
    'pnpm', 'run', 'readiness'
  )
  Invoke-Checked 'pnpm audit --audit-level high' $corepack @(
    'pnpm', 'audit', '--audit-level', 'high',
    '--registry', 'https://registry.npmjs.org'
  )
  Invoke-Checked 'git diff --check' $git @(
    'diff', '--check'
  )
  Invoke-Checked 'git diff --cached --check' $git @(
    'diff', '--cached', '--check'
  )

  $commit = (Invoke-Captured $git @('rev-parse', 'HEAD')).Text
  $currentBranch = (Invoke-Captured $git @('branch', '--show-current')).Text
  $targetBranch = if ($Branch) { $Branch } else { $currentBranch }
  $statusBeforeRecord = (Invoke-Captured $git @('status', '--porcelain')).Text
  $workingTreeClean = [string]::IsNullOrWhiteSpace($statusBeforeRecord)
  $pushStatus = 'not_requested'
  $pushFailed = $false

  if ($Push) {
    if ([string]::IsNullOrWhiteSpace($targetBranch)) {
      throw 'Cannot push from a detached HEAD without -Branch.'
    }
    if (-not $workingTreeClean) {
      throw 'Refusing to push because the working tree is not clean.'
    }

    $previousGcmInteractive = $env:GCM_INTERACTIVE
    $env:GCM_INTERACTIVE = 'Never'
    try {
      Invoke-Checked 'git push' $git @(
        '-c', 'credential.interactive=never',
        '-c', 'credential.helper=',
        '-c', 'credential.helper=manager',
        '-c', 'http.lowSpeedLimit=1',
        '-c', 'http.lowSpeedTime=120',
        'push', $Remote, $targetBranch
      )
      $pushStatus = 'pushed'
    } catch {
      $pushStatus = 'failed'
      $pushFailed = $true
    } finally {
      $env:GCM_INTERACTIVE = $previousGcmInteractive
    }
  }

  $remoteSynchronized = $false
  if (-not [string]::IsNullOrWhiteSpace($targetBranch)) {
    $remoteResult = Invoke-Captured $git @('rev-parse', '--verify', "$Remote/$targetBranch") -AllowFailure
    $remoteSynchronized = $remoteResult.ExitCode -eq 0 -and $remoteResult.Text -eq $commit
  }

  $pnpmVersion = (Invoke-Captured $corepack @('pnpm', '--version')).Text
  $workflowWatch.Stop()
  $record = [ordered]@{
    schemaVersion = 2
    verifiedAt = (Get-Date).ToUniversalTime().ToString('o')
    status = 'passed'
    commit = $commit
    branch = $currentBranch
    packageManager = "pnpm@$pnpmVersion"
    commands = $completedCommands.ToArray()
    stageTimings = $stageTimings.ToArray()
    totalSeconds = [Math]::Round($workflowWatch.Elapsed.TotalSeconds, 3)
    workingTreeClean = $workingTreeClean
    pushRequested = [bool]$Push
    pushStatus = $pushStatus
    remote = $Remote
    remoteSynchronized = $remoteSynchronized
  }

  $json = $record | ConvertTo-Json -Depth 4
  [IO.File]::WriteAllText(
    $recordPath,
    "$json$([Environment]::NewLine)",
    [Text.UTF8Encoding]::new($false)
  )

  if ($pushFailed) {
    throw 'Verification passed, but git push failed. See the Git output above.'
  }

  Write-Host "Verification passed for $commit"
  Write-Host "Local record: $recordPath"
} finally {
  Pop-Location
}
