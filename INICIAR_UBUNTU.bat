@echo off
color 0B
echo ========================================================
echo Iniciando o Servidor Mercado do Vale no Ubuntu (WSL)...
echo ========================================================
echo.
echo Por favor, aguarde enquanto o servidor Node.js e o Vite sao carregados...
echo.

wsl --cd "C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale" -e bash -c "npm run dev"

echo.
echo O servidor foi encerrado. Pressione qualquer tecla para sair.
pause >nul
