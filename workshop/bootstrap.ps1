# snshah bootstrap for Windows 11+ (Windows PowerShell 5.1 or PowerShell 7).
#
#   irm https://raw.githubusercontent.com/shah/shah/main/workshop/bootstrap.ps1 | iex
#   .\workshop\bootstrap.ps1             # from a checkout of github.com/shah/shah
#
# Safe to re-run. It needs git (it stops with the winget command when git is
# missing), makes sure Bun 1.4+ is present (a pinned release, checked by
# SHA-256, installed under ~\.bun without admin rights), adds ~\.bun\bin and
# ~\.local\bin to your user PATH once, clones shah/shah to
# $env:WORKSPACES_HOME\github.com\shah\shah (default ~\workspaces), or
# fast-forwards it, and runs `snshah apply` from that checkout. A second run
# reports "No changes needed." Set $env:SNSHAH_REF to a branch, tag or commit
# to try something other than main. Arguments are passed to `snshah apply`.
#
# Everything runs inside one script block, so `irm | iex` never changes your
# session's strict mode or error preference, and never exits your shell.

& {
  Set-StrictMode -Version Latest
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'

  $BunVersion = '1.4.4'
  $Owner = 'shah'; $Repo = 'shah'; $Directory = 'workshop'
  # Pinned checksums from the Bun v1.4.4 release SHASUMS256.txt.
  $Checksums = @{
    'windows-x64'           = 'cd2c0fccc78f3ede1f50ca827a15f063eda13d4d150a3d0674f4f6e323d864a5'
    'windows-x64-baseline'  = '0f20ce6674d4f2dbcc8c5d59fdf99f7ba45f8c3b367e0f5781cbfa30a1c78d99'
    'windows-aarch64'       = '2d57a0eec0cb44d95c918c3f9734f60455a1306ae5085d76fc68f44e3ee30d09'
    'linux-x64'             = 'bf8ccbfb2b0b80159e0f9a6d15c55317add8077534dbc6130a3edb52fccb395c'
    'linux-x64-baseline'    = 'e0446eb55995772eb9894bebae9a6be368d985a8b9271ee124486f9946eedd76'
    'linux-aarch64'         = 'baa6bb36f51d6e58561e02bbea825038a9df454f673d6d776e8bbf86f8c7850e'
    'darwin-x64'            = '50a3491f73abc2fe81673171a85762d3bc2cc1680ccecadd983de99adf77977e'
    'darwin-x64-baseline'   = 'd4a155adfbfd09155eb3ba05c9e3a544f39297d7a68616d3c7759f67ab5c47dc'
    'darwin-aarch64'        = 'c240d7f0ccb90c263a849fcdb09b7ee62630d921348ed6aafda86b9d577bc510'
  }

  function Say([string]$Message) { Write-Host "snshah bootstrap: $Message" }

  $OnWindows = ($PSVersionTable.PSEdition -eq 'Desktop') -or ((Test-Path variable:IsWindows) -and $IsWindows)
  # Same rule as snshah.ts: HOME when set, otherwise the Windows profile folder.
  $HomeDir = if ($env:HOME) { $env:HOME } elseif ($env:USERPROFILE) { $env:USERPROFILE } else { [Environment]::GetFolderPath('UserProfile') }

  function Get-XdgBase([string]$Name, [string]$Fallback) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    # The XDG spec says relative values are invalid and must be ignored.
    if ($value -and [IO.Path]::IsPathRooted($value)) { return $value }
    return (Join-Path $HomeDir $Fallback)
  }

  $CacheDir = Join-Path (Get-XdgBase 'XDG_CACHE_HOME' '.cache') 'snshah'
  $BunDir = if ($env:BUN_INSTALL) { $env:BUN_INSTALL } else { Join-Path $HomeDir '.bun' }
  $BunExe = Join-Path (Join-Path $BunDir 'bin') ($(if ($OnWindows) { 'bun.exe' } else { 'bun' }))
  $BinDir = Split-Path -Parent (Join-Path (Get-XdgBase 'XDG_BIN_HOME' '.local/bin') 'snshah')

  function Test-BunVersion([string]$Path) {
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return $false }
    try { $v = (& $Path --version 2>$null | Out-String).Trim() } catch { return $false }
    $parts = $v.Split('.')
    if ($parts.Count -lt 2) { return $false }
    $major = 0; $minor = 0
    if (-not [int]::TryParse($parts[0], [ref]$major) -or -not [int]::TryParse($parts[1], [ref]$minor)) { return $false }
    return ($major -gt 1) -or ($major -eq 1 -and $minor -ge 4)
  }

  function Get-BunTarget {
    $arch = if ($OnWindows) { $env:PROCESSOR_ARCHITECTURE } else { [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() }
    $cpu = switch -Regex ($arch) { '^(AMD64|X64)$' { 'x64' } '^(ARM64|Arm64)$' { 'aarch64' } default { throw "Unsupported CPU: $arch" } }
    $os = if ($OnWindows) { 'windows' } elseif ($IsMacOS) { 'darwin' } else { 'linux' }
    $target = "$os-$cpu"
    if ($cpu -eq 'x64') {
      # .NET Core can tell whether the CPU has AVX2; Windows PowerShell 5.1 cannot, so it uses the baseline build.
      $avx2 = $false
      try { $avx2 = [bool]([type]'System.Runtime.Intrinsics.X86.Avx2')::IsSupported } catch { $avx2 = $false }
      if (-not $avx2) { $target = "$target-baseline" }
    }
    return $target
  }

  function Get-Sha256([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }

  function Install-Bun {
    $found = Get-Command bun -ErrorAction SilentlyContinue
    foreach ($candidate in @($(if ($found) { $found.Source }), $BunExe)) {
      if (Test-BunVersion $candidate) { return $candidate }
    }
    $target = Get-BunTarget
    $expected = $Checksums[$target]
    if (-not $expected) { throw "No pinned checksum for bun-$target." }
    New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
    $zip = Join-Path $CacheDir "bun-v$BunVersion-$target.zip"
    if (-not (Test-Path -LiteralPath $zip) -or (Get-Sha256 $zip) -ne $expected) {
      Say "downloading Bun $BunVersion ($target)"
      $part = "$zip.part"
      Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/oven-sh/bun/releases/download/bun-v$BunVersion/bun-$target.zip" -OutFile $part
      if ((Get-Sha256 $part) -ne $expected) { Remove-Item -Force $part; throw 'Bun checksum mismatch; nothing was installed.' }
      Move-Item -Force $part $zip
    }
    $unpack = Join-Path ([IO.Path]::GetTempPath()) ("snshah-bun-" + [guid]::NewGuid())
    try {
      Expand-Archive -LiteralPath $zip -DestinationPath $unpack -Force
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $BunExe) | Out-Null
      Copy-Item -Force (Join-Path (Join-Path $unpack "bun-$target") (Split-Path -Leaf $BunExe)) $BunExe
      if (-not $OnWindows) { & chmod 755 $BunExe }
    } finally {
      Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $unpack
    }
    Say "installed Bun $((& $BunExe --version | Out-String).Trim()) at $BunExe"
    return $BunExe
  }

  function Add-UserPath([string]$Directory) {
    $sep = [IO.Path]::PathSeparator
    if (($env:PATH -split [regex]::Escape($sep)) -notcontains $Directory) { $env:PATH = "$Directory$sep$env:PATH" }
    if (-not $OnWindows) { return } # on Linux and macOS, `snshah shell` handles PATH
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = if ($user) { $user -split ';' } else { @() }
    if ($entries -notcontains $Directory) {
      [Environment]::SetEnvironmentVariable('Path', (@($Directory) + $entries | Where-Object { $_ }) -join ';', 'User')
      Say "added $Directory to your user PATH (new terminals pick it up)"
    }
  }

  function Invoke-Git {
    # Native stderr must not become a terminating error under -Stop (Windows PowerShell 5.1).
    $saved = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & git @args 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $saved }
    $script:GitOutput = ($out | Out-String).Trim()
    return ($LASTEXITCODE -eq 0)
  }

  function Get-WorkspacesRoot {
    if ($env:WORKSPACES_HOME) { return $env:WORKSPACES_HOME }
    $omarchy = Join-Path (Get-XdgBase 'XDG_DATA_HOME' '.local/share') 'omarchy'
    if (-not $OnWindows -and ((Get-Command omarchy -ErrorAction SilentlyContinue) -or (Test-Path -LiteralPath $omarchy))) { return (Join-Path $HomeDir 'Work') }
    return (Join-Path $HomeDir 'workspaces')
  }

  # Clone shah/shah into the workspaces root, or fast-forward it; returns its path.
  function Update-Checkout {
    $url = if ($env:SNSHAH_URL) { $env:SNSHAH_URL } else { "https://github.com/$Owner/$Repo.git" }
    $ref = $env:SNSHAH_REF
    $checkout = Join-Path (Join-Path (Join-Path (Get-WorkspacesRoot) 'github.com') $Owner) $Repo
    if (-not (Test-Path -LiteralPath $checkout)) {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $checkout) | Out-Null
      Say "cloning $Owner/$Repo into $checkout"
      if (-not (Invoke-Git clone --quiet $url $checkout)) { throw "Could not clone ${url}: $GitOutput" }
    } else {
      if (-not (Test-Path -LiteralPath (Join-Path $checkout '.git'))) { throw "$checkout exists but is not a git checkout; move it away and re-run." }
      $null = Invoke-Git -C $checkout remote get-url origin
      $origin = $GitOutput
      if ($origin -ne $url -and $origin -notmatch "[/:]$Owner/$Repo(\.git)?$") { throw "$checkout is a checkout of something other than $Owner/$Repo; move it away and re-run." }
    }
    if ($ref) {
      if (-not (Invoke-Git -C $checkout fetch --quiet origin $ref)) { throw "Could not fetch $ref from ${url}: $GitOutput" }
      if (-not (Invoke-Git -C $checkout checkout --quiet --detach FETCH_HEAD)) { throw "Could not check out ${ref}: $GitOutput" }
      return $checkout
    }
    # No ref asked for: follow main, but never disturb work in progress.
    $null = Invoke-Git -C $checkout symbolic-ref --quiet --short HEAD
    $branch = $GitOutput
    $null = Invoke-Git -C $checkout status --porcelain
    $dirty = $GitOutput
    if ($branch -ne 'main') { Say "$checkout is not on main ($(if ($branch) { $branch } else { 'detached' })); using it as it is" }
    elseif ($dirty) { Say "$checkout has local changes; using it as it is" }
    else {
      if (-not (Invoke-Git -C $checkout fetch --quiet origin main)) { throw "Could not fetch main from ${url}: $GitOutput" }
      if (-not (Invoke-Git -C $checkout merge --quiet --ff-only FETCH_HEAD)) { Say "$checkout has diverged from origin/main; using it as it is" }
    }
    return $checkout
  }

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $hint = if ($OnWindows) { 'winget install --id Git.Git -e' } elseif ($IsMacOS) { 'xcode-select --install' } else { 'your package manager (package git)' }
    throw "snshah bootstrap needs git. Install it with: $hint, then re-run."
  }

  $bun = Install-Bun
  Add-UserPath (Split-Path -Parent $BunExe)
  Add-UserPath $BinDir

  $here = if ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { $null }
  if ($here -and (Test-Path -LiteralPath (Join-Path $here 'snshah.ts'))) {
    $script = Join-Path $here 'snshah.ts'
  } else {
    $script = Join-Path (Update-Checkout) "$Directory/snshah.ts"
  }
  & $bun --no-env-file $script apply --yes @args
  if ($LASTEXITCODE -ne 0) { throw "snshah apply failed (exit $LASTEXITCODE)." }
} @args
