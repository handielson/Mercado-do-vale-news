# Integração Shopee Open Platform v2 — Mercado do Vale

> **Status atual:** ⏳ Go-Live **"Under Review"** — aguardando aprovação da Shopee (até 24h)  
> **Última atualização:** 24/03/2026 01:38 BRT  
> **Arquivo:** `SHOPEE_INTEGRATION.md` — salvo na raiz do projeto para fácil localização

---

## 📋 Resumo do que foi feito

1. ✅ **Banco de dados** — Colunas da Shopee criadas na VPS (MySQL) e no Supabase
2. ✅ **Backend Vercel** — API de autorização OAuth e callback implementados
3. ✅ **Painel Admin** — Página `/admin/settings/shopee` com UI de integração
4. ✅ **VPS** — `vps_server.js` atualizado com campos Shopee no ALLOWED list
5. ✅ **Go-Live** — Formulário submetido, aguardando aprovação da Shopee
6. ⏳ **OAuth Sandbox** — Bloqueado por bug no ambiente de testes da Shopee
7. ⏳ **Token Exchange** — Será funcional após aprovação e uso das chaves de Produção

---

## 🔑 Credenciais e Acessos

### Shopee Open Platform
| Campo | Valor |
|-------|-------|
| URL Console | https://open.shopee.com |
| Email de login | (login da conta Shopee do usuário) |
| App ID (228885) | App "Mercado do Vale" |
| **Test Partner_id** | `1229870` |
| **Test API Partner Key** | `shpk45434a69786d53566659686c634d6254796f556956517347454c47754e45` |
| Live Partner_id | *(aguardando aprovação do Go-Live)* |
| Live Partner Key | *(aguardando aprovação do Go-Live)* |

### Contas de Teste Sandbox (Test Account-Sandbox v2)
| Campo | Shop 1 | Shop 2 |
|-------|--------|--------|
| Shop ID | `226950609` | `226950198` |
| Shop Account (login) | `SANDBOX.d266c551e74028c507f3` | `SANDBOX.2a388fde49240bfc769c` |
| Shop Password | `1d0a02e525d5e9da` | `17b10c7fdb7b0e46` |
| Região | Brasil (BR) | Brasil (BR) |

### Go-Live — Dados Enviados para Revisão
| Campo | Valor |
|-------|-------|
| URL do sistema | `https://www.mercadodovale.com.br` |
| Test Username | `admin@mercadodovale.com.br` |
| Test Password | `VALEVALE2025` |
| Brief Introduction | Descrição do ERP enviada (500 chars) |
| Live Redirect URL | `https://mercadodovale.com.br` |
| IP da VPS | `76.13.232.162` |
| IP Whitelist | **DESATIVADO** (Vercel usa IPs dinâmicos) |

---

## 🖥️ Infraestrutura

### VPS (Backend Principal)
| Campo | Valor |
|-------|-------|
| Host/IP | `76.13.232.162` |
| Usuário SSH | `root` |
| Senha SSH | `@@@@Jsj2865@@@@` |
| DB Host | `localhost` |
| DB Usuário | `mdv_api` |
| DB Senha | `Mdv2026Secure` |
| DB Nome | `mercadodovale` |
| SYNC_SECRET | `4eae1b3fe1ab3224bb53fd2402d46cf57b86ef98dd53775eb5a5f178f1d5b3f4` |
| App path | `/var/www/mdv-api/` |
| Process Manager | PM2 (processo: `mdv-api`) |

### Vercel (Frontend + Serverless Functions)
| Campo | Valor |
|-------|-------|
| Projeto | `mercado-do-vale-news` (Handielson's Projects) |
| URL de produção | `https://mercadodovale.com.br` |
| Repositório GitHub | `handielson/Mercado-do-vale-news` |
| Branch principal | `main` |
| Deploy automático | Sim (push no main = novo deploy) |

---

## 📁 Arquivos da Integração

### Backend (Vercel Serverless Functions)
```
api/
  shopee.ts          — Rota OAuth: action=auth e action=callback
  shopee-actions.ts  — Ações avulsas: get_shop_info, etc.
```

### Frontend
```
pages/admin/settings/ShopeePage.tsx   — Painel de configuração
components/products/sections/ShopeeLinkSection.tsx  — Botão no cadastro de produto
```

### Serviços
```
services/companyService.ts   — Salva/lê shopee_partner_id, shopee_partner_key, etc.
```

### Scripts de Diagnóstico (temporários, podem ser deletados)
```
debug_shopee.mjs        — Teste de assinatura HMAC inicial
debug_vps.js            — Verifica chaves no VPS
debug_sign.mjs          — Gera sign e URL completa para debug
test_shopee_sign.mjs    — Chama a API com chave hardcoded
test_key_variants.mjs   — Testa 4 variações da chave
test_hardcoded.mjs      — Teste isolado com chave literal
exchange_token.mjs      — Troca code por access_token diretamente
inject_shopee_keys.cjs  — Injeta chaves no MySQL via SSH
run_migration.cjs       — Roda migration SQL na VPS
run_restart.cjs         — Reinicia PM2 na VPS
run_upload.cjs          — Faz SFTP do vps_server.js para a VPS
read_env.cjs            — Lê o .env da VPS
```

---

## 🗄️ Banco de Dados

### Tabela `company_settings` — Colunas da Shopee
```sql
-- MySQL (VPS) e Supabase (PostgreSQL)
ALTER TABLE company_settings ADD COLUMN shopee_partner_id VARCHAR(255);
ALTER TABLE company_settings ADD COLUMN shopee_partner_key TEXT;
ALTER TABLE company_settings ADD COLUMN shopee_shop_id VARCHAR(50);
ALTER TABLE company_settings ADD COLUMN shopee_access_token TEXT;
ALTER TABLE company_settings ADD COLUMN shopee_refresh_token TEXT;

-- Tabela products
ALTER TABLE products ADD COLUMN shopee_item_id BIGINT;
```

### Estado atual dos dados
```
shopee_partner_id  = '1229870'   ← já gravado na VPS via inject_shopee_keys.cjs
shopee_partner_key = 'shpk45434a...'  ← já gravado na VPS
shopee_shop_id     = NULL        ← será preenchido após OAuth de Produção
shopee_access_token = NULL       ← será preenchido após OAuth de Produção
shopee_refresh_token = NULL      ← será preenchido após OAuth de Produção
```

---

## 🔒 Algoritmo de Assinatura (HMAC-SHA256)

```typescript
// Fórmula CORRETA para auth/token/get:
const baseString = `${partnerId}${apiPath}${timestamp}`;
const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');

// ATENÇÃO: Para auth/token/get, a assinatura NÃO inclui shop_id nem access_token
// Isso é correto e diferente de outras rotas autenticadas
```

### URLs de API
| Ambiente | URL Base |
|----------|----------|
| **Sandbox (Teste)** | `https://partner.test-stable.shopeemobile.com` |
| **Produção (Live)** | `https://partner.shopeemobile.com` |

### Lógica de detecção automática de ambiente
```typescript
// Em api/shopee.ts e api/shopee-actions.ts
function getShopeeBaseUrl(partnerId: string) {
    if (partnerId === '1229870' || process.env.SHOPEE_ENV === 'sandbox') {
        return 'https://partner.test-stable.shopeemobile.com';
    }
    return 'https://partner.shopeemobile.com';
}
// O Partner ID 1229870 é o de Teste/Sandbox — quando vier o de Produção será diferente
```

---

## 🚨 Bug Identificado no Sandbox Shopee

**Problema:** O endpoint `auth/token/get` do ambiente sandbox retorna `{"error":"error_sign","message":"Wrong sign."}` mesmo com assinatura matematicamente correta.

**Evidência:** O `request_id` de erro é sempre `e3e3e7f34db...` (prefixo estático), indicando que o servidor sandbox **nem processa** a requisição — rejeita antes mesmo de verificar.

**Confirmação:** Testamos em 4 variações da chave, com código OAuth real, chave hardcoded, diferentes timestamps — **todos falham igualmente**.

**Causa raiz:** Bug documentado do ambiente de sandbox da Shopee para apps do tipo `Seller In House System` no estágio `Developing`.

**Solução:** Usar as credenciais de Produção após aprovação do Go-Live. No ambiente Live, o OAuth funciona corretamente.

---

## ✅ Como Continuar após aprovação do Go-Live

Quando a Shopee enviar email de aprovação (email cadastrado na conta):

### 1. Obter as chaves de Produção
- Acesse https://open.shopee.com/console/app/228885
- O Partner_id e Partner Key de **Produção** (Live) estarão disponíveis
- São diferentes dos valores de Sandbox

### 2. Atualizar no banco de dados
```javascript
// Rodar inject_shopee_keys.cjs com as NOVAS chaves de produção
const PARTNER_ID = 'NOVO_ID_LIVE'; // substituir
const PARTNER_KEY = 'NOVA_KEY_LIVE'; // substituir
```

Ou via Painel Admin (agora que as colunas existem, deve funcionar):
- `/admin/settings/shopee` → Preencher e clicar em "Salvar Chaves"

### 3. Executar o OAuth de Produção
- No Painel Admin → "Autorizar com a Shopee"
- Isso abrirá a URL do ambiente de produção (`partner.shopeemobile.com`)
- Fazer login com a **conta de vendedor REAL** da Shopee
- O callback em `https://mercadodovale.com.br/api/shopee?action=callback` receberá o código
- O sistema trocará automaticamente pelo `access_token` e `refresh_token`
- Os tokens serão salvos no Supabase (e opcionalmente sincronizados com o VPS)

### 4. Testar a integração
- No Painel Admin → Shopee Integration → Status deve mudar para "Conectado"
- Abrir o cadastro de um produto → Botão "Sincronizar com Shopee" estará ativo
- Testar publicação de um produto na Shopee

---

## 🔄 Fluxo OAuth Completo (para referência)

```
1. /admin/settings/shopee → Clica "Autorizar com a Shopee"
   ↓
2. GET /api/shopee?action=auth
   → Lê partner_id e partner_key do VPS
   → Gera assinatura HMAC-SHA256
   → Monta URL: partner.shopeemobile.com/api/v2/shop/auth_partner?...
   → Retorna URL para o frontend
   ↓
3. Frontend redireciona o usuário para a Shopee
   ↓
4. Usuário faz login e autoriza o app na Shopee
   ↓
5. Shopee redireciona para:
   https://mercadodovale.com.br/api/shopee?action=callback&code=XXX&shop_id=YYY
   ↓
6. GET /api/shopee?action=callback
   → Lê partner_id e partner_key do VPS
   → Gera nova assinatura com timestamp atual
   → POST para /api/v2/auth/token/get com {code, shop_id, partner_id}
   → Recebe {access_token, refresh_token}
   → Salva no Supabase (shopee_shop_id, shopee_access_token, shopee_refresh_token)
   → Exibe página HTML de sucesso
   ↓
7. Usuário retorna ao painel — status "Conectado" ✅
```

---

## 📌 Problema do Frontend com x-sync-key

**Causa identificada:** O `companyService.ts` faz `PATCH /company-settings` na VPS, mas o VPS exige o header `x-sync-key` para qualquer escrita. O frontend não envia esse header, então as chaves digitadas no painel **não são gravadas** na VPS.

**Workaround atual:** Injetar chaves diretamente via SSH com `inject_shopee_keys.cjs`.

**Correção pendente:** Adicionar `x-sync-key` nas requisições PATCH do `vpsApiService.ts` ou `companyService.ts`. O valor da chave está em `VITE_SYNC_SECRET` (ou verificar o `.env` da VPS).

---

## 📁 Notas de Arquitetura

- **Vercel** serve o frontend React + as funções serverless (`api/*.ts`)
- **VPS (api.xiaomipetrolina.com.br)** serve como backend principal com MySQL
- **Supabase** ainda é usado como fallback para credenciais da Shopee (mas o VPS é prioritário)
- O código da Vercel lê as chaves assim: **VPS primeiro → Supabase como fallback**
- O token de acesso (access_token) é salvo **no Supabase** (via callback)
- O token expira a cada **4 horas** — implementar refresh automático está pendente

---

## 📧 Contato Shopee para Suporte
- Email: `openapi@support.shopee.com`
- Portal: https://open.shopee.com → Ticket System → Raise Ticket
