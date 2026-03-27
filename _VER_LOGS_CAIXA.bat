@echo off
echo Coletando logs fisicos do PM2 do computador do CAIXA...
type "%USERPROFILE%\.pm2\logs\shopee-auto-print-error*.log" > pm2_logs_erro_caixa.txt 2>nul
type "%USERPROFILE%\.pm2\logs\shopee-auto-print-out*.log" > pm2_logs_out_caixa.txt 2>nul
echo Logs salvos com sucesso!
pause
