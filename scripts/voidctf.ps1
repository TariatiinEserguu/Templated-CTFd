<#
.SYNOPSIS
  VOID//CTF management script for Windows (PowerShell 5.1+ / PowerShell 7).

.DESCRIPTION
  Usage: .\voidctf.cmd <command> [args]      (from the project folder)
     or: powershell -ExecutionPolicy Bypass -File scripts\voidctf.ps1 <command>

  Commands
    init           Create .env with freshly generated secrets (never overwrites)
    up             Start the platform (runs init first if needed)  -> http://localhost:8000
    down           Stop all containers. Data is kept.
    restart        Restart the CTFd container (e.g. after editing templates)
    status         Show container status
    logs           Follow CTFd logs (Ctrl+C to stop following)
    backup         Export the whole event to backups\voidctf-<timestamp>.zip
    restore <zip>  Import a CTFd export zip (replaces current event data)
    reset          Delete ALL event data (database, uploads) after confirmation
    build-theme    Rebuild theme assets after editing theme\void\assets
    load-pack      Import the starter challenge pack through the CTFd API
    training-up    Start the local web-training target (127.0.0.1:8081)
    training-down  Stop the web-training target
    native         Run CTFd without Docker (Python 3.11, SQLite) for theme development
#>
param(
  [Parameter(Position = 0)] [string] $Command = "help",
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)] [string[]] $Rest
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Step($msg) { Write-Host "[void] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[void] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[void] $msg" -ForegroundColor Red; exit 1 }

function New-Secret([int] $bytes = 32) {
  $buf = New-Object byte[] $bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($buf)
  $rng.Dispose()
  return (($buf | ForEach-Object { $_.ToString("x2") }) -join "")
}

function Get-EnvValue([string] $key, [string] $default) {
  if (Test-Path .env) {
    $line = Get-Content .env | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if ($line) { return ($line -split "=", 2)[1].Trim() }
  }
  return $default
}

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail "Docker was not found. Install Docker Desktop (https://docs.docker.com/desktop/setup/install/windows-install/) and start it."
  }
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { Fail "Docker is installed but not running. Start Docker Desktop and wait until it says 'Engine running'." }
}

function Invoke-Init {
  if (Test-Path .env) { Write-Step ".env already exists - leaving it untouched."; return }
  $content = Get-Content .env.example -Raw
  $content = $content -replace "(?m)^SECRET_KEY=.*$", "SECRET_KEY=$(New-Secret 32)"
  $content = $content -replace "(?m)^DB_PASSWORD=.*$", "DB_PASSWORD=$(New-Secret 18)"
  $content = $content -replace "(?m)^DB_ROOT_PASSWORD=.*$", "DB_ROOT_PASSWORD=$(New-Secret 18)"
  # UTF-8 without BOM so docker compose parses the first line correctly
  [System.IO.File]::WriteAllText((Join-Path $Root ".env"), $content, (New-Object System.Text.UTF8Encoding $false))
  Write-Step "Created .env with new random secrets."
}

function Wait-Healthy {
  $port = Get-EnvValue "CTFD_PORT" "8000"
  $url = "http://localhost:$port/healthcheck"
  Write-Step "Waiting for CTFd at $url (first start can take a minute)..."
  for ($i = 0; $i -lt 90; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { return $true }
    } catch { }
    Start-Sleep -Seconds 2
  }
  return $false
}

switch ($Command.ToLower()) {
  "init" { Invoke-Init }

  "up" {
    Assert-Docker
    Invoke-Init
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { Fail "docker compose up failed. Run '.\voidctf.cmd logs' for details." }
    $port = Get-EnvValue "CTFD_PORT" "8000"
    if (Wait-Healthy) {
      Write-Step "VOID//CTF is running: http://localhost:$port"
      Write-Step "First run? Open the URL, complete the setup wizard and pick the 'void' theme."
    } else {
      Write-Warn "CTFd did not report healthy yet. Check '.\voidctf.cmd logs'."
    }
  }

  "down" { Assert-Docker; docker compose --profile training down; Write-Step "Stopped. Your data is preserved in Docker volumes." }
  "restart" { Assert-Docker; docker compose restart ctfd; [void](Wait-Healthy); Write-Step "CTFd restarted." }
  "status" { Assert-Docker; docker compose --profile training ps }
  "logs" { Assert-Docker; docker compose logs -f --tail 200 ctfd }

  "backup" {
    Assert-Docker
    New-Item -ItemType Directory -Force backups | Out-Null
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $name = "voidctf-$stamp.zip"
    docker compose exec -T ctfd python manage.py export_ctf "/tmp/$name"
    if ($LASTEXITCODE -ne 0) { Fail "Export failed. Is the platform running?" }
    docker compose cp "ctfd:/tmp/$name" "backups/$name"
    docker compose exec -T ctfd rm -f "/tmp/$name" | Out-Null
    Write-Step "Backup written to backups\$name"
  }

  "restore" {
    Assert-Docker
    if (-not $Rest -or -not (Test-Path $Rest[0])) { Fail "Usage: .\voidctf.cmd restore backups\voidctf-YYYYMMDD-HHMMSS.zip" }
    $answer = Read-Host "Importing replaces ALL current event data. Type RESTORE to continue"
    if ($answer -ne "RESTORE") { Write-Warn "Cancelled."; exit 0 }
    docker compose cp $Rest[0] "ctfd:/tmp/restore.zip"
    docker compose exec -T ctfd python manage.py import_ctf /tmp/restore.zip --delete_import_on_finish
    docker compose restart ctfd
    Write-Step "Import finished. Log in with an admin account from the imported event."
  }

  "reset" {
    Assert-Docker
    Write-Warn "This permanently deletes the database, uploaded files and logs of this local event."
    Write-Warn "Tip: run '.\voidctf.cmd backup' first if you might want this data again."
    $answer = Read-Host "Type RESET to delete all VOID//CTF data"
    if ($answer -ne "RESET") { Write-Warn "Cancelled."; exit 0 }
    docker compose --profile training down -v
    Write-Step "All event data removed. Run '.\voidctf.cmd up' for a fresh setup wizard (.env is kept)."
  }

  "build-theme" {
    Push-Location theme\void
    try {
      if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm ci --no-audit --no-fund
        npm run build
      } else {
        Assert-Docker
        Write-Step "Node.js not found - building inside a node:20 container instead."
        docker run --rm -v "${PWD}:/theme" -w /theme node:20-alpine sh -c "npm ci --no-audit --no-fund && npm run build"
      }
      if ($LASTEXITCODE -ne 0) { Fail "Theme build failed." }
    } finally { Pop-Location }
    Write-Step "Theme rebuilt into theme\void\static. Refresh the browser (Ctrl+F5)."
  }

  "load-pack" {
    $py = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } elseif (Get-Command python -ErrorAction SilentlyContinue) { "python" } else { $null }
    if (-not $py) { Fail "Python 3 is required for the pack loader (https://www.python.org/downloads/)." }
    $port = Get-EnvValue "CTFD_PORT" "8000"
    if (-not $env:CTFD_TOKEN) {
      Write-Host "Create an admin token: log in as admin -> Settings -> Access Tokens -> Generate."
      $secure = Read-Host "Paste the admin access token" -AsSecureString
      $env:CTFD_TOKEN = [System.Net.NetworkCredential]::new("", $secure).Password
    }
    & $py tools\load_pack.py --url "http://localhost:$port" @Rest
  }

  "training-up" {
    Assert-Docker
    docker compose --profile training up -d web-training
    $p = Get-EnvValue "TRAINING_WEB_PORT" "8081"
    Write-Step "Web training target: http://localhost:$p (local only)"
  }
  "training-down" { Assert-Docker; docker compose --profile training stop web-training; Write-Step "Web training target stopped." }

  "native" {
    $version = Get-EnvValue "CTFD_VERSION" "3.8.9"
    if (-not (Test-Path .ctfd)) {
      Write-Step "Downloading CTFd $version source into .ctfd ..."
      git -c core.longpaths=true clone --depth 1 --branch $version https://github.com/CTFd/CTFd.git .ctfd
      if ($LASTEXITCODE -ne 0) { Fail "git clone failed. Install Git for Windows and retry." }
    }
    if (-not (Test-Path .ctfd\.venv)) {
      Write-Step "Creating Python 3.11 virtual environment..."
      if (Get-Command uv -ErrorAction SilentlyContinue) {
        uv venv --python 3.11 .ctfd\.venv
        uv pip install --python .ctfd\.venv\Scripts\python.exe -r .ctfd\requirements.txt
      } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        py -3.11 -m venv .ctfd\.venv
        .ctfd\.venv\Scripts\python.exe -m pip install -r .ctfd\requirements.txt
      } else { Fail "Python 3.11 is required (install it from python.org, or install uv)." }
      if ($LASTEXITCODE -ne 0) { Fail "Dependency installation failed." }
    }
    foreach ($link in @(@(".ctfd\CTFd\themes\void", "theme\void"), @(".ctfd\CTFd\plugins\void_ctf", "plugins\void_ctf"))) {
      if (-not (Test-Path $link[0])) {
        cmd /c mklink /J "$Root\$($link[0])" "$Root\$($link[1])" | Out-Null
        Write-Step "Linked $($link[1]) into CTFd"
      }
    }
    New-Item -ItemType Directory -Force data\native\uploads, data\native\logs | Out-Null
    $keyFile = "data\native\secret_key"
    if (-not (Test-Path $keyFile)) { Set-Content -NoNewline -Encoding ascii $keyFile (New-Secret 32) }
    $env:SECRET_KEY = Get-Content $keyFile -Raw
    $dataDir = (Resolve-Path data\native).Path -replace "\\", "/"
    $env:DATABASE_URL = "sqlite:///$dataDir/ctfd.db"
    $env:UPLOAD_FOLDER = "$dataDir/uploads"
    $env:LOG_FOLDER = "$dataDir/logs"
    $port = Get-EnvValue "CTFD_PORT" "8000"
    Write-Step "Starting CTFd (development server) on http://localhost:$port - Ctrl+C to stop."
    .ctfd\.venv\Scripts\python.exe .ctfd\serve.py --port $port --disable-gevent
  }

  default { Get-Help $PSCommandPath -Detailed | Out-String | Write-Host }
}
