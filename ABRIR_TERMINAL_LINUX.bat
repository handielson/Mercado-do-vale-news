@echo off
color 0A
echo ============================================================
echo   Terminal Linux (WSL/Ubuntu) — Mercado do Vale
echo ============================================================
echo.
echo   Diretorio: /mnt/c/.../Mercado do Vale New/mercado-do-vale
echo   Ambiente : Ubuntu (WSL2)
echo.
echo   Comandos uteis:
echo     npm run dev       - Inicia o servidor Vite (localhost:3000)
echo     npm run build     - Build de producao
echo     npx tsc --noEmit  - Checa erros TypeScript
echo.
echo ============================================================
echo.

wsl --cd "C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale" -e bash --login
