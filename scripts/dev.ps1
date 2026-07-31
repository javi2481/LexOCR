# Arranca backend :8100 y frontend :5173 (requiere venv + npm install previos).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Py = Join-Path $Backend ".venv\Scripts\python.exe"

if (-not (Test-Path $Py)) {
  Write-Error "No existe $Py. Creá el venv e instalá requirements (ver README)."
}
if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
  Write-Error "Falta frontend/node_modules. Ejecutá npm install en frontend/."
}

Write-Host "Backend -> http://localhost:8100"
Start-Process -FilePath $Py -ArgumentList @(
  "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8100"
) -WorkingDirectory $Backend

Write-Host "Frontend -> http://localhost:5173"
Set-Location $Frontend
npm run dev
