# Documentação Completa — Servidor de Impressão Shopee (PC Caixa Lenovo)
**Última atualização:** 26/03/2026 — Sessão de diagnóstico e reparo completo.

---

## 🖥️ Visão Geral da Arquitetura

```
[Painel Web Vercel]  ──fetch──>  [localhost:8081]  ──API Shopee──>  [Impressora ZDesigner / Comprovante]
(mercadodovale.com.br)           (Node.js no Caixa)   (PDF Térmico)
```

- O frontend React (Vercel) chama `http://localhost:8081/print-order?order_sn=XXX&type=both`
- O servidor Node local (`C:\Mercado_Impressora\shopee-auto-print.cjs`) recebe, baixa o PDF da Shopee e manda para a impressora via `pdf-to-printer`
- **Tokens OAuth** ficam no **Supabase** (renovação automática a cada 4h)
- **Config de impressoras** fica na **VPS** (`/company-settings` em `api.xiaomipetrolina.com.br`)

---

## 🖨️ Impressoras Configuradas (verificado 26/03/2026)

| Tipo | Nome no Windows | Origem da Config |
|---|---|---|
| Térmica (Etiqueta 10x15) | `ZDesigner ZD220-203dpi ZPL` | VPS |
| A4 (Comprovante/Resumo) | `Comprovante` | VPS |

---

## ✅ Bugs corrigidos nesta sessão (26/03/2026)

### Bug 1 — SyntaxError: `missing ) after argument list` (CRÍTICO)
**Arquivo:** `scripts/shopee-auto-print.cjs` linha ~184  
**Causa:** O callback do `http.createServer((req, res) => { ... })` estava sem o `});` de fechamento. O `server.listen(8081)` ficou acidentalmente *dentro* do callback, causando crash fatal na inicialização do Node.  
**Correção:** Adicionado `});` para fechar o `createServer` antes do `server.listen`.  
**Status:** ✅ Aplicado e verificado.

### Bug 2 — CORS bloqueando requisições do browser (CRÍTICO)
**Arquivo:** `scripts/shopee-auto-print.cjs`  
**Causa:** O browser (Chrome) roda o painel em HTTPS (`mercadodovale.com.br`) e tenta acessar `http://localhost:8081`. Isso ativa o protocolo CORS. O servidor não respondia ao preflight `OPTIONS` que o Chrome envia antes de qualquer `fetch`, causando o erro "Sem conexão com as impressoras".  
**Correção:** Adicionado handler global no início do `createServer`:
```js
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
```
**Status:** ✅ Testado com simulação de preflight — retorna `204 + CORS: *`.

### Bug 3 — `ShopeePrintersTab.tsx` com porta errada (8080 → 8081)
**Arquivo:** `pages/admin/settings/components/ShopeePrintersTab.tsx` linha 48  
**Causa:** O botão de "Imprimir Página de Teste" ainda chamava `http://localhost:8080` (porta antiga).  
**Correção:** Trocado para `http://localhost:8081`.  
**Status:** ✅ Corrigido localmente. ⚠️ **PENDENTE: commit + push para Vercel.**

### Bug 4 — `.bat` chamava `node` sem caminho completo
**Arquivo:** `INICIAR_IMPRESSORA_CAIXA.bat`  
**Causa:** Node.js instalado em `C:\Program Files\nodejs\` mas não estava no PATH do terminal. O `.bat` usava apenas `node` e falhava silenciosamente.  
**Correção:** Trocado para `"%NODE_EXE%"` com `set "NODE_EXE=C:\Program Files\nodejs\node.exe"`. Reescrito o `.bat` para:
- Usar launcher `.vbs` invisível (servidor Node roda em background sem janela preta)
- Não reinstalar `node_modules` se já existirem
- Verificar se o servidor subiu e mostrar status colorido
**Status:** ✅ Aplicado.

---

## 📁 Estrutura de Arquivos

```
C:\Mercado_Impressora\           ← Pasta isolada do servidor (Synology não trava)
  shopee-auto-print.cjs          ← Servidor HTTP (copiado pelo .bat a cada execução)
  node_modules\                  ← Dependências NPM (pdf-to-printer, supabase, etc.)
  shopee_printed\                ← PDFs baixados + marcadores de pedido já impresso
  package.json
  start_hidden.vbs               ← Gerado pelo .bat: inicia Node sem janela preta

scripts\shopee-auto-print.cjs    ← FONTE REAL (aqui é onde editar!)
INICIAR_IMPRESSORA_CAIXA.bat     ← Copia o .cjs e inicia o servidor
```

---

## 🚀 Como iniciar o servidor (protocolo de amanhã)

1. **Verificar se já está rodando:**
   ```powershell
   netstat -ano | findstr ":8081"
   ```
   - Se aparecer `LISTENING` → servidor já está up, não precisa fazer nada.
   - Se não aparecer → executar o próximo passo.

2. **Dar dois cliques** em `INICIAR_IMPRESSORA_CAIXA.bat` (na raiz do projeto).  
   - Ele copia o `.cjs` mais recente para `C:\Mercado_Impressora\`
   - Mata processos Node anteriores
   - Inicia o servidor em background (sem janela preta)
   - Mostra se subiu ou não (verde = ok, vermelho = erro)

3. **Testar:**  
   Abrir `http://localhost:8081/` no Chrome. Deve aparecer a página "Servidor de Impressão Ativo."

---

## ⚠️ PENDÊNCIAS PARA AMANHÃ

### 1. Configurar o remote do Git e fazer push

**Contexto:** O Git foi instalado (v2.44.0) e o repositório foi inicializado (`git init`) nesta sessão. Porém **o remote ainda não foi configurado** — precisamos da URL do GitHub.

**Passos para amanhã:**
```bash
# 1. Abrir o terminal Git Bash (ou PowerShell com Git no PATH)

# 2. Ir para a pasta do projeto
cd "C:\Users\Lenovo\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale"

# 3. Configurar o remote (substituir pela URL real do GitHub)
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git

# 4. Definir usuário Git (se necessário)
git config user.email "seu@email.com"
git config user.name "Mercado do Vale"

# 5. Commitar e enviar
git add scripts/shopee-auto-print.cjs pages/admin/settings/components/ShopeePrintersTab.tsx INICIAR_IMPRESSORA_CAIXA.bat IMPRESSORA_SHOPEE_FIX_DOCUMENTATION.md
git commit -m "fix(impressora): CORS preflight, SyntaxError createServer, porta 8080->8081"
git push origin main
```

> O Vercel faz o build e deploy automaticamente após o push. A correção do `ShopeePrintersTab.tsx` (porta 8080→8081) vai entrar em produção.

### 3. Testar impressão real
Após o Vercel fazer o re-deploy:
- Abrir o painel em `mercadodovale.com.br/admin/settings/shopee`
- Ir na aba **Pedidos**
- Clicar em **🖨️ Imprimir Resumo** em qualquer pedido com status "Enviado"
- Verificar se a etiqueta sai na `ZDesigner ZD220-203dpi ZPL` e o comprovante na impressora `Comprovante`

---

## 🔧 Diagnóstico rápido (checklist para amanhã)

```powershell
# 1. Node.js instalado?
& "C:\Program Files\nodejs\node.exe" --version

# 2. Git instalado?
& "C:\Program Files\Git\cmd\git.exe" --version

# 3. Servidor de impressão rodando?
netstat -ano | findstr ":8081"

# 4. Token Shopee válido?
# (rodar no diretório do projeto com Node no PATH)
# Verificar no painel web: aba Configurações > Shopee

# 5. Impressoras no Windows?
Get-Printer | Select-Object Name, DriverName | Format-Table -AutoSize
```

---

## 📋 Histórico de Bugs Conhecidos (documentação anterior)

### UUID Patch (já resolvido anteriormente)
O Supabase usa UUID como ID mas o código usava `.eq('id', 1)`. Corrigido para usar `settings.id` (UUID real). O ciclo de refresh de token a cada 4h funciona perfeitamente.

### WMI Parser Crash (já resolvido anteriormente)
O `pdf-to-printer` crashava ao listar impressoras via `ptp.getPrinters()` por causa de drivers PDF virtuais com metadados estranhos. Solução: removida a chamada de `getPrinters()` da rota `/`. A impressão funciona "às cegas" via `ptp.print()` direto.

### EADDRINUSE na porta 8080 (já resolvido anteriormente)
Migração para porta 8081 + `taskkill /F /IM node.exe` no `.bat`.

### "The package should print first" (já resolvido anteriormente)
A API Shopee v2 exige um `POST /api/v2/logistics/create_shipping_document` com `shipping_document_type: "THERMAL_AIR_WAYBILL"` antes de fazer o download. Adicionado delay de 2000ms para a Shopee renderizar o PDF internamente.
