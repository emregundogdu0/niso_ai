# NISO AI - Durdurma Scripti (PowerShell)
Write-Host "NISO AI UI Server durduruluyor..." -ForegroundColor Yellow
$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "Port 3001 UI server durduruldu." -ForegroundColor Green
} else {
    Write-Host "Port 3001 calisan bir server bulunamadi." -ForegroundColor Gray
}
