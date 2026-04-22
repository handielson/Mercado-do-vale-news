# 🐛 BUGFIXES — Registro de Correções

> Pesquise aqui antes de investigar um bug. Problemas resolvidos documentados com causa raiz e correção.

---

## BUG-001 — Dados não salvam na VPS (endpoints PATCH/POST/DELETE retornam 401 ou 404)

**Data:** 2026-03-19  
**Sintoma:** Alterações em configurações (company settings, badge labels, etc.) não persistem. Ao dar F5 os dados somem. Nenhum toast de erro visível.  
**Área afetada:** `companySettingsService`, `vpsClient`, todos os endpoints protegidos da VPS.

### Causas raízes (encadeadas)

#### 1. Rota PATCH inexistente no servidor VPS
- `PATCH /company-settings` simplesmente não existia no `server.js`
- O `GET` existia, mas o `PATCH` nunca foi criado
- Resultado: `404 Not Found` em qualquer tentativa de save

**Correção:** Adicionada rota `PATCH /company-settings` ao `server.js` com whitelist de campos permitidos:
```js
fastify.patch('/company-settings', { preHandler: requireSyncKey }, async (req, reply) => {
  const ALLOWED = ['store_label_open', 'store_label_closed', 'business_hours', ...];
  // UPDATE dinâmico via pool.query
});
```

---

#### 2. Header de autenticação errado no `vpsClient.ts`
- O frontend enviava `X-API-Key: <chave>`
- O middleware `requireSyncKey` no servidor verificava `x-sync-key`
- Resultado: `401 Unauthorized` em **TODOS** os endpoints protegidos (POST, PUT, PATCH, DELETE)

**Arquivo:** `services/vpsClient.ts`  
**Correção:**
```ts
// ❌ Errado
'X-API-Key': VPS_KEY ?? '',

// ✅ Correto
'x-sync-key': VPS_KEY ?? '', // nome exato esperado pelo requireSyncKey da VPS
```
> **Atenção:** O nome do header no servidor é `x-sync-key` (minúsculo com hífen). Qualquer novo serviço deve usar exatamente esse nome.

**Solução de retrocompatibilidade:** O servidor foi atualizado para aceitar **ambos** os headers:
```js
const key = request.headers['x-sync-key'] || request.headers['x-api-key'];
```

---

#### 3. Cache agressivo no GET /company-settings bloqueava ver os dados salvos
- O servidor enviava `Cache-Control: public, max-age=1800, s-maxage=3600`
- CDN (Cloudflare etc.) cacheava a resposta por até **1 hora**
- Resultado: após salvar via PATCH, o F5 devolvia os dados **antigos** do cache

**Correção no `server.js`:**
```js
// ❌ Antes
reply.header('Cache-Control', 'public, max-age=1800, s-maxage=3600');

// ✅ Depois
reply.header('Cache-Control', 'no-store');
```

---

#### 4. PATCH não estava na lista de métodos CORS permitidos
- `@fastify/cors` configurado com `methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']`
- **PATCH estava ausente**
- O browser enviava um preflight `OPTIONS` perguntando se podia fazer PATCH
- O servidor respondia sem incluir PATCH no `Access-Control-Allow-Methods`
- Resultado: browser bloqueava a requisição PATCH **antes mesmo de ela sair** (erro CORS)
- O stack trace mostrava o erro em `update @ index-xxx.js` sem mensagem clara

**Correção no `server.js`:**
```js
// ❌ Antes
methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

// ✅ Depois
methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
```

> ⚠️ **Regra:** Sempre que adicionar um novo método HTTP ao servidor, verificar se ele está na lista de CORS. O CORS preflight falha silenciosamente no console como erro de rede, não como 403/401.

---

### Checklist para diagnosticar "datos não salvam na VPS"

1. **Endpoint existe?** → `grep -n 'patch\|post\|put' /var/www/mdv-api/server.js`
2. **Header correto?** → `vpsClient.ts` usa `x-sync-key` (não `X-API-Key`)
3. **CORS libera o método?** → Teste OPTIONS com `Access-Control-Request-Method: PATCH`
4. **Cache impedindo?** → Verificar `Cache-Control` no endpoint GET correspondente
5. **Colunas existem?** → `SHOW COLUMNS FROM tabela` no MySQL

---

## BUG-002 — Badge "Loja Aberta" não usa label customizado quando mostra horário de abertura

**Data:** 2026-03-19  
**Sintoma:** O badge no header mostra "Abre às 08:00" em vez do label customizado "Loja física fechada" configurado no admin.  
**Área afetada:** `StoreStatusBadge.tsx`

### Causa

O `getDisplayMessage()` em `StoreStatusBadge.tsx` só substitui o label customizado em casos específicos:

```ts
if (msg === 'Fechado' || msg === 'Fechado Hoje') return labels.closed;   // ← usa label
if (msg.startsWith('Retorna às')) return msg.replace('Retorna às', labels.lunch); // ← usa prefixo
return msg; // ← "Abre às 08:00" cai aqui — retorna mensagem dinâmica
```

**Este comportamento é intencional:** quando a loja está fechada e o sistema sabe o próximo horário de abertura, mantém a mensagem dinâmica com o horário (informação mais útil para o cliente).

### Mapa de labels customizáveis

| Status | Mensagem do sistema | Label customizável? |
|---|---|---|
| `open` | — | ✅ `store_label_open` |
| `closing_soon` | — | ✅ `store_label_closing_soon` |
| `closed` (genérico) | "Fechado" | ✅ `store_label_closed` |
| `closed` (feriado) | "Fechado Hoje" | ✅ `store_label_closed` |
| `closed` (almoço) | "Retorna às HH:MM" | ✅ prefixo `store_label_lunch` |
| `closed` (sabe quando abre) | "Abre às HH:MM" | ❌ dinâmico (by design) |

---

## BUG-003 — `saveTimeout` com stale closure em `BusinessHoursTextPanel`

**Data:** 2026-03-19  
**Sintoma:** Debounce pode disparar múltiplas vezes causando saves duplicados ou o clearTimeout não cancelar o timeout anterior.  
**Área afetada:** `components/settings/BusinessHoursTextPanel.tsx`

### Causa

```tsx
// ❌ Errado — saveTimeout via useState cria stale closure
const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
const save = (patch) => {
    if (saveTimeout) clearTimeout(saveTimeout); // lê valor do render anterior
    const t = setTimeout(...);
    setSaveTimeout(t);
};
```

### Correção

```tsx
// ✅ Correto — useRef acessa sempre o valor atual
const saveTimeout = useRef<NodeJS.Timeout | null>(null);
const save = (patch) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(...);
};
```

> **Regra geral:** Para timers de debounce/throttle em componentes React, **sempre use `useRef`** em vez de `useState`. O `useState` é assíncrono e pode retornar o valor do render anterior dentro da closure.

---

---

## BUG-004 — Webhook de estoque do Bling para de dar baixa automaticamente (problema recorrente)

**Data:** 2026-05-28  
**Sintoma:** Ao processar pedidos no Bling, o estoque deixa de ser atualizado automaticamente na loja. O webhook recebe os eventos, mas a baixa não é aplicada.  
**Área afetada:** `api/bling-webhook.ts` (Vercel serverless), `vps_server.js`

---

### Causas raízes (encadeadas e recorrentes)

#### 1. Token OAuth expirado sem conseguir auto-renovar ← causa principal da recorrência

- O `access_token` do Bling expira em ~1h. O webhook tenta renovar via `refresh_token` automaticamente.
- **Problema:** O `refresh_token` do Bling também expira (~30–90 dias), ou é invalidado quando o usuário re-autentica.
- Quando o refresh falha (HTTP 400/401), o webhook continuava com o token antigo → chamada à API Bling retorna 401 → `fetchBlingStock` retorna `null` → proteção contra zero entra em ação → **estoque não atualizado**.
- O sistema ficava silenciosamente quebrado sem nenhum alerta visível no painel.

**Correção aplicada** (2026-05-28):
- Quando refresh retorna 400/401 → `bling_access_token` é **limpo no Supabase** → painel admin exibe banner vermelho "Bling desconectado — webhook de estoque parado".
- Antes: erro era apenas logado no console da Vercel (invisível para o admin).

```ts
// api/bling-webhook.ts — novo comportamento ao falhar refresh
if (tokenRes.status === 400 || tokenRes.status === 401) {
    await supabase.from('company_settings').update({ bling_access_token: null }).eq('id', settings.id);
    console.warn('[bling-webhook] ⚠️ Token inválido — bling_access_token limpo. Admin deve reconectar.');
}
accessToken = null;
```

---

#### 2. VPS não suportava `?bling_id=` como filtro no GET /products

- O webhook usa `bling_id` para localizar o produto quando o payload Bling não inclui o `codigo` (SKU).
- O endpoint `GET /products?bling_id=X&limit=1` **ignorava o parâmetro** e retornava o primeiro produto ativo alfabeticamente → SKU errado → estoque atualizado no produto errado!

**Correção aplicada** (2026-05-28) em `vps_server.js`:
```js
// Adicionado filtro bling_id ao GET /products
if (req.query.bling_id) { sql += ' AND bling_id = ?'; params.push(req.query.bling_id); }
```

---

#### 3. PATCH /products/stock exigia SKU (SKU nem sempre está no payload)

- O endpoint `PATCH /products/stock` só aceitava `sku` como identificador.
- Quando o evento Bling de estoque não inclui o `codigo`, o webhook precisava de um lookup extra para resolver o SKU. Como esse lookup estava quebrado (causa 2), o update falhava.

**Correção aplicada** (2026-05-28) em `vps_server.js`:
```js
// PATCH /products/stock agora aceita bling_id OU sku
const { sku, bling_id, stock_quantity } = req.body || {};
if (!sku && !bling_id) return reply.code(400).send({ error: 'sku or bling_id required' });
// Atualiza por bling_id se disponível (mais direto)
if (sku) {
    await pool.query('UPDATE products SET stock_quantity=? WHERE sku=?', [qty, sku]);
} else {
    await pool.query('UPDATE products SET stock_quantity=? WHERE bling_id=?', [qty, String(bling_id)]);
}
```

O webhook agora passa `bling_id` diretamente para a VPS — sem roundtrip extra para resolver o SKU:
```ts
// api/bling-webhook.ts — stock update prefere bling_id
const vpsPayload = blingId
    ? { bling_id: blingId, stock_quantity: stockQty }
    : { sku: resolvedSku, stock_quantity: stockQty };
await patchVps('/products/stock', vpsPayload);
```

---

#### 4. Webhook não estava cadastrado (ou foi removido) no painel do Bling

- Ao reconectar o OAuth, o Bling **não** mantém os webhooks cadastrados — eles são configurados separadamente.
- Se o webhook não estiver registrado no Bling, nenhum evento chega ao Vercel.

**Verificar/Resolver:** No painel do Bling → Configurações → Integrações → Webhooks → verificar se as URLs/eventos estão cadastrados:
```
Webhook de estoque/nome (novo): https://mercadodovale.com.br/api/bling-webhook
    Eventos: stock.created, stock.updated, virtual_stock.updated, movimentacaoEstoque, produto/product.updated

Webhook legado (valor e logs do painel): https://mercadodovale.com.br/api/bling?resource=webhook
    Eventos: product.updated (preço/nome) e stock.updated/virtual_stock.updated
```

> Observação: hoje existem 3 fluxos lógicos de webhook no negócio (nome, estoque, valor). Eles podem ser atendidos por uma ou mais URLs, desde que todos os eventos necessários estejam habilitados.

---

### Fallback automático de reconciliação

Além do webhook, o sistema agora possui uma reconciliação automática server-side:

- Endpoint: `https://www.mercadodovale.com.br/api/bling?resource=reconcile`
- Agenda: cron horária na **VPS** chamando o endpoint com `x-sync-key`
- Script versionado: `scripts/bling-reconcile-cron.sh`
- Escopo: compara Bling × sistema por `bling_id` e corrige **nome** e **estoque** no Supabase + VPS

Importante:

- Esse fallback **não substitui** o webhook em tempo real; ele cobre divergências quando o webhook do Bling para ou é desativado.
- A Vercel deste projeto está em plano Hobby, então o agendamento horário não pode ficar no `vercel.json`.
- Se a tela de logs mostrar só `healthcheck` antigo e nenhum evento novo de `stock.updated`/`product.updated`, o webhook ainda precisa ser reativado no painel do Bling.

---

### Procedimento completo de recuperação (quando o webhook parar)

1. **Identificar o problema:** Acesse Admin → Configurações → Bling. Se aparecer o banner vermelho "Bling desconectado", o token expirou.

2. **Reconectar o OAuth:**
   - Aba "Configuração" → botão **"Conectar com Bling"**
   - Será redirecionado para o Bling para autenticação
   - Ao voltar, o banner deve sumir e aparecer "✔ Conectado"

3. **Verificar os webhooks no Bling:**
   - Acesse [bling.com.br](https://www.bling.com.br) → Configurações → Integrações → Webhooks
    - Confirmar que existem entradas cobrindo os 3 fluxos: `estoque`, `nome` e `valor`
    - Confirmar URL do webhook novo: `https://mercadodovale.com.br/api/bling-webhook`
    - Confirmar URL do webhook legado (compatibilidade): `https://mercadodovale.com.br/api/bling?resource=webhook`
    - Se faltar algum: criar e associar eventos de `product.updated` e `stock.updated/virtual_stock.updated`
   - Se estiver desativado: ativar

4. **Testar o webhook:**
   - Admin → Configurações → Bling → aba "Webhook" → botão "Testar Webhook"
   - Deve retornar `ok: true`

5. **Sincronizar estoque manualmente** (para corrigir diferenças acumuladas durante o período sem webhook):
   - Admin → Configurações → Bling → aba "Produtos" → buscar produto → usar sincronização individual
   - OU: executar o sync completo de estoque se disponível

---

### Proteção anti-zero (comportamento esperado)

O webhook possui proteção que **aborta** a atualização de estoque quando a API Bling falha E o payload retorna 0. Isso é intencional para evitar zerar o estoque incorretamente por falha temporária.

> Quando ver no log: `🛑 ABORTADO: API falhou e payload=0` — isso é correto. O estoque real deve ser sincronizado manualmente ou aguardar o próximo evento válido.

---

### Checklist de diagnóstico

1. **Banner no painel?** → Admin → Configurações → Bling → verificar status (vermelho = desconectado)
2. **Webhooks cadastrados no Bling?** → Configurações → Integrações → Webhooks (nome, estoque e valor)
3. **Logs da Vercel** → [vercel.com/dashboard](https://vercel.com) → Projeto → Functions → `api/bling-webhook` e `api/bling` → ver logs recentes
4. **Token válido no Supabase?** → Tabela `company_settings` → campo `bling_access_token` (null = desconectado)
5. **VPS respondendo?** → `curl https://api.xiaomipetrolina.com.br/health`

---

*Última atualização: 2026-05-28*
