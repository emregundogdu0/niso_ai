# NISO AI - Hizli Baslatma Scripti (PowerShell)
$ErrorActionPreference = "SilentlyContinue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   NISO AI Yonetim Asistani Baslatiliyor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Ollama Kontrolu & Baslatma
Write-Host "`n[1/4] Ollama kontrol ediliyor..." -ForegroundColor Yellow
$ollamaProc = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if (-not $ollamaProc) {
    Write-Host "Ollama baslatiliyor..." -ForegroundColor Gray
    $ollamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
    if (Test-Path $ollamaExe) {
        Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Hidden
    } else {
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    }
    Start-Sleep -Seconds 2
}
Write-Host "Ollama devrede (http://127.0.0.1:11434)" -ForegroundColor Green

# 2. Docker Kontrolu & Konteynerlar
Write-Host "`n[2/4] Docker ve veritabani konteynerlari kontrol ediliyor..." -ForegroundColor Yellow
$dockerOk = $false
try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch {}

if (-not $dockerOk) {
    Write-Host "Docker Desktop baslatiliyor, lutfen bekleyin..." -ForegroundColor Gray
    $dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerDesktop) {
        Start-Process -FilePath $dockerDesktop
    }
    
    $retries = 30
    while ($retries -gt 0 -and -not $dockerOk) {
        Start-Sleep -Seconds 2
        try {
            $null = docker ps 2>&1
            if ($LASTEXITCODE -eq 0) { $dockerOk = $true; break }
        } catch {}
        $retries--
    }
}

if ($dockerOk) {
    docker start management-postgres n8n 2>&1 | Out-Null
    Write-Host "PostgreSQL ve n8n konteynerlari calisiyor." -ForegroundColor Green
} else {
    Write-Host "UYARI: Docker zamaninda yanit vermedi. Konteynerlar manuel kontrol edilmeli." -ForegroundColor Red
}

# 3. Node.js UI Server Kontrolu & Baslatma
Write-Host "`n[3/4] Web UI & API Server kontrol ediliyor..." -ForegroundColor Yellow
$portCheck = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if (-not $portCheck) {
    Write-Host "Web UI server baslatiliyor..." -ForegroundColor Gray
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
    $uiDir = Join-Path $scriptDir "ui"
    
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $uiDir -WindowStyle Hidden
    Start-Sleep -Seconds 2
}
Write-Host "Web UI hazir (http://127.0.0.1:3001)" -ForegroundColor Green

# 4. Tarayiciyi Ac
Write-Host "`n[4/4] Tarayici aciliyor..." -ForegroundColor Yellow
Start-Process "http://127.0.0.1:3001"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "   NISO AI Tum Servisler Hazir!        " -ForegroundColor Green
Write-Host "   Web UI : http://127.0.0.1:3001       " -ForegroundColor White
Write-Host "   n8n    : http://127.0.0.1:5678       " -ForegroundColor White
Write-Host "   Ollama : http://127.0.0.1:11434      " -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
