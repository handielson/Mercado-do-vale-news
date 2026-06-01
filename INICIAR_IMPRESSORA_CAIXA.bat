@echo off
color 0B
title MERCADO DO VALE - SERVIDOR DE IMPRESSAO SHOPEE

set "TARGET_DIR=C:\Mercado_Impressora"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "VBS_LAUNCHER=%TARGET_DIR%\start_hidden.vbs"

echo ==============================================================
echo   MERCADO DO VALE - Servidor de Impressao Shopee
echo   Porta: 8081
echo ==============================================================
echo.

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo [1/4] Copiando arquivos atualizados...
copy /Y "%~dp0scripts\shopee-auto-print.cjs" "%TARGET_DIR%\shopee-auto-print.cjs" >nul 2>&1
copy /Y "%~dp0.env" "%TARGET_DIR%\.env" >nul 2>&1
copy /Y "%~dp0.env.local" "%TARGET_DIR%\.env.local" >nul 2>&1

cd /d "%TARGET_DIR%"

echo [2/4] Verificando dependencias...
if not exist "%TARGET_DIR%\node_modules" (
    echo     Instalando pacotes (primeira vez, aguarde)...
    call npm init -y >nul 2>&1
    call npm install pdf-to-printer dotenv node-fetch@2 --no-fund --no-audit
) else (
    echo     OK - pacotes ja instalados.
)

echo [3/4] Encerrando instancias anteriores...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [4/4] Iniciando servidor em background (sem janela preta)...
echo Set oShell = CreateObject("WScript.Shell") > "%VBS_LAUNCHER%"
echo oShell.Run """%NODE_EXE%"" shopee-auto-print.cjs", 0, False >> "%VBS_LAUNCHER%"
cscript //nologo "%VBS_LAUNCHER%"

timeout /t 3 /nobreak >nul

echo.
echo ==============================================================
echo  Verificando se o servidor subiu...
set "ONLINE=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do set "ONLINE=1"

if "%ONLINE%"=="1" (
    color 0A
    echo  [OK] Servidor rodando na porta 8081!
    echo  Voce pode fechar esta janela - o servidor continua rodando.
) else (
    color 0C
    echo  [ERRO] Servidor nao subiu! Tente rodar o BAT como Administrador.
)
echo ==============================================================
echo.
pause
