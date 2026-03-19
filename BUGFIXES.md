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

*Última atualização: 2026-03-19*
