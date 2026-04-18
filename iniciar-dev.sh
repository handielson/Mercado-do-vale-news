#!/bin/bash

# Mercado do Vale - Dev Server (WSL)
# Use este script para rodar o ambiente de desenvolvimento diretamente de dentro do WSL.

# Entra na pasta do projeto relativa a este script
cd "$(dirname "$0")/mercado-do-vale" || exit 1

clear
echo "========================================="
echo " Mercado do Vale New - Servidor Local (WSL)"
echo "========================================="
echo ""
echo " Iniciando o servidor Vite..."
echo " Você poderá acessar em: http://localhost:5173"
echo ""

# Executa o node no WSL
npm run dev
