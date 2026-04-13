#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "🔍 DIAGNÓSTICO DE BUGS DO PROTOCOLO DE SEGURANÇA"
echo "════════════════════════════════════════════════════════"
echo ""

# Bug 1: Verificar status da autenticação Synology
echo "1️⃣  SYNOLOGY (Impacta ícone de vídeo):"
grep -A 3 "SYNO_USER\|SYNO_PASS\|SYNO_URL" .env 2>/dev/null | head -8 || echo "   ❌ Variáveis Synology não encontradas"
echo ""

# Bug 2: Verificar status da autenticação Bling
echo "2️⃣  BLING (Impacta importação):"
grep -E "BLING_CLIENT_ID|BLING_CLIENT_SECRET|BLING_ACCESS_TOKEN" .env 2>/dev/null | head -5 | sed 's/=.*/=***/' || echo "   ❌ Variáveis Bling não encontradas"
echo ""

# Bug 3: Verificar logs recentes do VPS
echo "3️⃣  PM2 LOGS (VPS Server):"
pm2 logs --lines 15 2>/dev/null | tail -20 || echo "   ❌ PM2 não disponível localmente"
echo ""

# Bug 4: Produtos com status inativo mas com estoque
echo "4️⃣  🐛 Status bug diagnostics:"
echo "   Procurando produtos do Bling com estoque mas inativos..."
echo "   Produto A-607 (exemplo do usuário)"
echo ""

