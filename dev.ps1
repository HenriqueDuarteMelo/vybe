param(
    [switch]$Seed
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Test-Port([int]$Port) {
    $targets = @(
        @{ Addr = '127.0.0.1'; Family = [Net.Sockets.AddressFamily]::InterNetwork },
        @{ Addr = '::1';       Family = [Net.Sockets.AddressFamily]::InterNetworkV6 }
    )
    foreach ($t in $targets) {
        $client = New-Object Net.Sockets.TcpClient($t.Family)
        try {
            $async = $client.BeginConnect($t.Addr, $Port, $null, $null)
            if ($async.AsyncWaitHandle.WaitOne(500)) {
                $client.EndConnect($async)
                $client.Close()
                return $true
            }
            $client.Close()
        }
        catch {
            $client.Close()
        }
    }
    return $false
}

function Wait-Docker([int]$TimeoutSeconds = 90) {
    for ($i = 0; $i -lt $TimeoutSeconds; $i += 2) {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

Write-Host "=== VYBE Dev Launcher ===" -ForegroundColor Cyan
Write-Host "Diretorio: $Root"

# 1) Docker + Postgres
if (Test-Port 5433) {
    Write-Host "[OK] Postgres ja responde na 5433" -ForegroundColor Green
}
else {
    if (-not (Wait-Docker)) {
        $dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
        if (Test-Path $dockerDesktop) {
            Write-Host "Docker Desktop fechado. Abrindo..." -ForegroundColor Yellow
            Start-Process $dockerDesktop | Out-Null
            Write-Host "Aguardando o Docker iniciar (ate 90s)..." -ForegroundColor Yellow
            if (-not (Wait-Docker)) {
                Write-Host "ERRO: Docker Desktop nao ficou pronto a tempo." -ForegroundColor Red
                exit 1
            }
        }
        else {
            Write-Host "ERRO: Docker Desktop nao encontrado." -ForegroundColor Red
            exit 1
        }
    }
    Write-Host "[OK] Docker em execucao" -ForegroundColor Green

    Write-Host "Subindo o container Postgres..." -ForegroundColor Yellow
    docker compose up -d postgres
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: falha ao subir o Postgres." -ForegroundColor Red
        exit 1
    }

    $healthy = $false
    for ($i = 0; $i -lt 30; $i++) {
        $status = docker inspect --format "{{.State.Health.Status}}" vybe-postgres 2>$null
        if ($status -eq 'healthy') { $healthy = $true; break }
        Start-Sleep -Seconds 2
    }
    if ($healthy) {
        Write-Host "[OK] Postgres saudavel" -ForegroundColor Green
        Write-Host "AVISO: primeira vez? rode com -Seed para criar as tabelas e o catalogo." -ForegroundColor DarkGray
    }
    else {
        Write-Host "AVISO: Postgres subiu mas o healthcheck ainda nao confirmou." -ForegroundColor Yellow
    }
}

# 2) Seed (opcional, apenas com -Seed): cria tabelas + catalogo local
if ($Seed) {
    Write-Host "Seedando o banco (db:push + db:seed)..." -ForegroundColor Yellow
    npm run db:push --workspace=apps/api
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: db:push falhou." -ForegroundColor Red
        exit 1
    }
    npm run db:seed --workspace=apps/api
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: db:seed falhou." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Banco populado (catalogo + usuarios de teste)" -ForegroundColor Green
}

# 3) API (porta 3001)
if (Test-Port 3001) {
    Write-Host "[OK] API ja esta no ar (porta 3001)" -ForegroundColor Green
}
else {
    $apiCmd = '$Host.UI.RawUI.WindowTitle = "VYBE API"; npm run dev --workspace=apps/api'
    Start-Process powershell -WorkingDirectory $Root -ArgumentList ("-NoExit -Command & { " + $apiCmd + " }")
    Write-Host "[OK] API iniciada em nova janela (porta 3001)" -ForegroundColor Green
}

# 4) Web (porta 5173)
if (Test-Port 5173) {
    Write-Host "[OK] Web ja esta no ar (porta 5173)" -ForegroundColor Green
}
else {
    $webCmd = '$Host.UI.RawUI.WindowTitle = "VYBE WEB"; npm run dev --workspace=apps/web'
    Start-Process powershell -WorkingDirectory $Root -ArgumentList ("-NoExit -Command & { " + $webCmd + " }")
    Write-Host "[OK] Web iniciada em nova janela (porta 5173)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Tudo pronto:" -ForegroundColor Cyan
Write-Host "  Web : http://localhost:5173"
Write-Host "  API : http://localhost:3001"
Write-Host "  Postgres : localhost:5433 (vybe/vybe, banco vybe)"
if ($Seed) {
    Write-Host "  Contas de teste: 'adm' / 'adm1' | 'dev@vybe.com' / 'password123'"
}
Write-Host ""
Write-Host "Dica: para (re)criar as tabelas e o catalogo local, rode: .\dev.ps1 -Seed"
Write-Host ""
Write-Host "Para parar: feche as janelas 'VYBE API' e 'VYBE WEB' (Ctrl+C) e rode: docker compose down"