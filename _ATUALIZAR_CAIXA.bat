@echo off
color 0A
title ================= MERCADO DO VALE - ATUALIZADOR DO CAIXA =================

echo ***************************************************************
echo * ATUALIZADOR AUTOMATICO DA IMPRESSORA SHOPEE (CAIXA LENOVO) *
echo ***************************************************************
echo.
echo Lendo pasta do projeto atual:
cd /d "%~dp0"
echo %CD%

echo.
echo [1/3] Parando a impressao antiga do PM2...
call npx pm2 stop shopee-auto-print
call npx pm2 delete shopee-auto-print
echo.

echo [2/3] Instalando os ultimos pacotes caso estejam faltando...
call npm install pdf-to-printer dotenv node-fetch@2 --no-fund --no-audit

echo.
echo [3/3] Iniciando o script atualizado na porta 8080...
:: Entrando na pasta scripts (o PM2 tem q rodar a partir do dir certo ou a partir da raiz?)
:: O script shopee-auto-print.js le o .env da raiz. 
call npx pm2 start scripts/shopee-auto-print.cjs --name "shopee-auto-print" --watch
call npx pm2 save

echo.
echo ***************************************************************
echo * SUCESSO! A NOVA VERSAO ESTA RODANDO E LENDO A NUVEM.        *
echo * PODE FECHAR ESTA TELA E TESTAR A IMPRESSAO LA NO SISTEMA!  *
echo ***************************************************************
pause
