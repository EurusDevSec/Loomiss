# Loomiss Setup & Installer Script for Windows (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   🌀 Loomiss Dynamic Visualizer Installer   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Check Prerequisites
Write-Host "Checking prerequisites..."
if (-not (Get-Command "go" -ErrorAction SilentlyContinue)) {
    Write-Error "Go is not installed. Please install Go (1.22+) and try again."
    Exit 1
}
$goVersion = go version
Write-Host "✅ Go is installed: $goVersion" -ForegroundColor Green

if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed. Please install Node.js (v18+) and try again."
    Exit 1
}
$nodeVersion = node -v
Write-Host "✅ Node.js is installed: $nodeVersion" -ForegroundColor Green

if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed. Please install npm and try again."
    Exit 1
}
$npmVersion = npm -v
Write-Host "✅ npm is installed: $npmVersion" -ForegroundColor Green

# 2. Build Frontend
Write-Host "`nBuilding Frontend assets..." -ForegroundColor Cyan
Push-Location frontend
npm install
npm run build
Pop-Location
Write-Host "✅ Frontend built successfully." -ForegroundColor Green

# 3. Build Go Daemon
Write-Host "`nBuilding Backend Go binary..." -ForegroundColor Cyan

# Stop any running loomiss processes to release the file lock
Write-Host "Stopping any running Loomiss daemon processes..." -ForegroundColor Yellow
$processes = Get-Process -Name "loomiss" -ErrorAction SilentlyContinue
if ($processes) {
    Stop-Process -Name "loomiss" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "✅ Stopped existing Loomiss processes." -ForegroundColor Green
}

Push-Location backend
go build -o ../loomiss.exe main.go
Pop-Location
Write-Host "✅ Backend binary compiled: .\loomiss.exe" -ForegroundColor Green

# 4. Set global User PATH Environment Variable
Write-Host "`nSetting up global Windows PATH environment variable..." -ForegroundColor Cyan
$workspaceDir = Get-Location | Select-Object -ExpandProperty Path
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($userPath -notlike "*$workspaceDir*") {
    $newUserPath = "$userPath;$workspaceDir"
    # Clean up duplicate semicolons if any
    $newUserPath = $newUserPath -replace ';+', ';'
    [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
    Write-Host "✅ Successfully added Loomiss folder ($workspaceDir) to User PATH environment variable." -ForegroundColor Green
    Write-Host "⚠️  Please RESTART your terminal/IDE for the PATH changes to take effect." -ForegroundColor Yellow
} else {
    Write-Host "ℹ️  Loomiss folder ($workspaceDir) is already present in User PATH." -ForegroundColor Yellow
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "🎉 Setup complete! You can now start Loomiss:" -ForegroundColor Green
Write-Host "   Command: .\loomiss.exe start" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
