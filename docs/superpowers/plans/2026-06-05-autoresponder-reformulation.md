# AutoResponder Reformulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o AutoResponder em um motor de conversa previsivel, com mapa de perguntas/respostas, estados explicitos, fallbacks contextuais e fallback fora do fluxo.

**Architecture:** Criar um motor novo em paralelo ao fluxo atual, migrando primeiro observabilidade e mapa, depois estado unificado, depois fluxos de maior risco. O arquivo grande de servidor continua funcionando enquanto modulos novos assumem responsabilidades com contrato claro e testes de simulacao.

**Tech Stack:** Node/Fastify na VPS (`vps_server.js` publicado como `server.js`), MySQL, React admin em `pages/admin/AutoResponderPage.tsx`, cliente VPS em `services/autoResponderService.ts`, testes estaticos e simulacoes via `tmp-tests` e `/autoresponder/test-flow`.

---

## Regras Da Reforma

- [ ] Nunca publicar mudanca do bot sem passar por `/autoresponder/test-flow`.
- [ ] Toda mensagem que faz pergunta deve salvar o proximo estado esperado.
- [ ] Todo estado deve ter fallback contextual antes de cair no fallback geral.
- [ ] O fluxo antigo so pode ser removido depois de ter cobertura equivalente no motor novo.
- [ ] Regras manuais continuam existindo, mas nao podem criar perguntas sem estado.
- [ ] IA so responde fora de fluxo quando nao houver regra, intent ou busca de produto confiavel.
- [ ] Curadoria recebe perguntas sem resposta apenas depois de o fallback fora de fluxo falhar.
- [ ] Cada fase deve terminar com commit pequeno, deploy de API quando necessario e validacao em producao.
- [ ] Supabase e Vercel sao somente legado: nao criar dependencia nova, rota nova, variavel nova, deploy novo ou leitura/escrita operacional nova usando Supabase/Vercel.
- [ ] O runtime reformulado deve usar VPS/MySQL como fonte operacional; qualquer referencia a Supabase/Vercel deve permanecer apenas como compatibilidade historica ou guarda de regressao.
- [ ] Todas as respostas visiveis ao cliente devem ser editaveis pelo admin; nenhuma mensagem operacional nova pode ficar oculta/hardcoded apenas no servidor.
- [ ] Mensagens podem ter fallback padrao no codigo para seguranca, mas o valor efetivo exibido ao cliente deve vir de configuracao administrativa sempre que o bot estiver habilitado.

## Arquivos E Responsabilidades

- Criar: `docs/autoresponder/response-map.md`
  - Mapa operacional de perguntas, respostas esperadas, estados e fallbacks.
- Criar: `docs/autoresponder/test-scenarios.md`
  - Lista de simulacoes obrigatorias e exemplos de payload para `/autoresponder/test-flow`.
- Criar: `services/autoresponder/engine/types.js`
  - Tipos JSDoc do motor: `ConversationState`, `BotReply`, `FlowHandler`, `IntentResult`.
- Criar: `services/autoresponder/engine/state.js`
  - Normalizacao, expiracao e persistencia de estado unificado.
- Criar: `services/autoresponder/engine/router.js`
  - Ordem de roteamento entre fluxo ativo, regras, intents, busca, IA e fallback geral.
- Criar: `services/autoresponder/engine/fallbacks.js`
  - Fallback contextual por fluxo e fallback fora de fluxo.
- Criar: `services/autoresponder/engine/messages.js`
  - Resolvedor central de mensagens editaveis pelo admin com fallback padrao seguro.
- Criar: `services/autoresponder/engine/flows/delivery.js`
  - Fluxo de entrega: pergunta CEP, consulta CEP, calcula frete quando houver regra, pede produto quando estiver fora de compra.
- Criar: `services/autoresponder/engine/flows/product-search.js`
  - Busca de produto, lista de opcoes, escolha por numero/nome e "mais".
- Criar: `services/autoresponder/engine/flows/purchase.js`
  - Compra: produto, variacao, quantidade, entrega/retirada, pagamento, dados do cliente e handoff.
- Criar: `services/autoresponder/engine/flows/handoff.js`
  - Pausa para humano, motivo da pausa e resumo do atendimento.
- Criar: `tmp-tests/autoresponder-response-map-static.test.mjs`
  - Garante que o mapa cobre fluxos obrigatorios.
- Criar: `tmp-tests/autoresponder-state-contract-static.test.mjs`
  - Garante contrato do estado unificado.
- Criar: `tmp-tests/autoresponder-router-order-static.test.mjs`
  - Garante ordem de roteamento e bloqueia IA antes de fluxo ativo.
- Criar: `tmp-tests/autoresponder-core-scenarios.cjs`
  - Executa cenarios em `/autoresponder/test-flow` contra ambiente local/producao conforme env.
- Modificar: `vps_server.js`
  - Integrar o novo motor mantendo fallback para o fluxo antigo durante a migracao.
- Modificar: `vps_server.cjs`
  - Manter espelho operacional enquanto existir no repositorio.
- Modificar: `server.js`
  - Manter compatibilidade local quando aplicavel.
- Modificar: `types/autoResponder.ts`
  - Expor campos de estado e resultado de simulacao para o admin.
- Modificar: `services/autoResponderService.ts`
  - Expor endpoints de mapa, simulador e estado quando forem criados.
- Modificar: `pages/admin/AutoResponderPage.tsx`
  - Adicionar visao "Mapa do Bot", melhorar simulador e expor todas as mensagens editaveis.

---

## Fase 0: Baseline E Congelamento De Comportamento

### Task 0.1: Criar Inventario Do Bot Atual

**Files:**
- Create: `docs/autoresponder/response-map.md`
- Test: `tmp-tests/autoresponder-response-map-static.test.mjs`

- [ ] **Step 1: Criar o mapa inicial**

Criar `docs/autoresponder/response-map.md` com esta estrutura:

```markdown
# Mapa De Respostas Do AutoResponder

## Ordem Global Atual

1. Bloqueio e grupo
2. Audio sem suporte
3. Pausa de conversa
4. Fluxo de nome do contato
5. Status da loja
6. Saudacao
7. Garantia
8. Fluxo de compra em `purchase_flow`
9. Escolha numerada
10. Mais opcoes
11. Pedido humano
12. Opt-in lista de telefone
13. Regras manuais
14. Tags de produto
15. Categoria/orcamento
16. Busca generica de produto
17. IA fallback
18. Fallback geral

## Fluxo: Entrega Fora De Compra

| Entrada | Estado atual | Resposta do bot | Proximo estado | Resposta esperada | Fallback contextual |
|---|---|---|---|---|---|
| faz entrega? | none | Explica entrega e pergunta CEP | delivery.awaiting_cep | CEP de 8 digitos | Me envie apenas os 8 numeros do CEP. Ex: 56320690 |
| 56320690 | delivery.awaiting_cep | Consulta endereco e frete | none | Produto ou atendente | Quer escolher um produto agora ou falar com atendente? |

## Fluxo: Busca De Produto

| Entrada | Estado atual | Resposta do bot | Proximo estado | Resposta esperada | Fallback contextual |
|---|---|---|---|---|---|
| redmi note 15 | none | Lista opcoes | product_search.awaiting_choice | numero, nome ou mais | Me diga o numero da opcao ou o nome do modelo. |
| 1 | product_search.awaiting_choice | Detalhe do produto | purchase.awaiting_action | comprar, detalhes ou outro produto | Quer comprar, ver detalhes ou procurar outro modelo? |
| mais | product_search.awaiting_choice | Proxima pagina | product_search.awaiting_choice | numero, nome ou mais | Ja mostrei tudo dessa lista. Quer buscar outro modelo? |

## Fluxo: Compra

| Entrada | Estado atual | Resposta do bot | Proximo estado | Resposta esperada | Fallback contextual |
|---|---|---|---|---|---|
| comprar | purchase.awaiting_action | Pergunta quantidade | purchase.awaiting_quantity | numero | Me envie a quantidade em numero. Ex: 1 |
| 1 | purchase.awaiting_quantity | Adiciona item e pergunta finalizar | purchase.item_added | finalizar, adicionar, remover | Responda finalizar, adicionar ou remover. |
| finalizar | purchase.item_added | Pergunta entrega ou retirada | purchase.awaiting_fulfillment | entrega ou retirada | Voce prefere entrega ou retirada na loja? |

## Fallback Fora Do Fluxo

Mensagem padrao:

```text
Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?
```
```

- [ ] **Step 2: Criar teste estatico do mapa**

Criar `tmp-tests/autoresponder-response-map-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = readFileSync('docs/autoresponder/response-map.md', 'utf8');

[
  'Fluxo: Entrega Fora De Compra',
  'delivery.awaiting_cep',
  'Fluxo: Busca De Produto',
  'product_search.awaiting_choice',
  'Fluxo: Compra',
  'purchase.awaiting_quantity',
  'Fallback Fora Do Fluxo',
  'Nao consegui identificar certinho',
].forEach((needle) => {
  assert.ok(doc.includes(needle), `response map must include ${needle}`);
});

console.log('autoresponder response map static checks passed');
```

- [ ] **Step 3: Rodar teste**

Run:

```powershell
node tmp-tests\autoresponder-response-map-static.test.mjs
```

Expected:

```text
autoresponder response map static checks passed
```

- [ ] **Step 4: Commit**

```powershell
git add -- docs/autoresponder/response-map.md tmp-tests/autoresponder-response-map-static.test.mjs
git commit -m "docs(autoresponder): map response flows"
```

### Task 0.2: Criar Matriz De Simulacao Obrigatoria

**Files:**
- Create: `docs/autoresponder/test-scenarios.md`
- Create: `tmp-tests/autoresponder-core-scenarios.cjs`

- [ ] **Step 1: Criar documento de cenarios**

Criar `docs/autoresponder/test-scenarios.md`:

```markdown
# Cenarios Obrigatorios Do AutoResponder

Cada publicacao que altera bot deve rodar estes cenarios em `/autoresponder/test-flow`.

## Cenarios

1. Saudacao simples
   - Mensagens: `["oi"]`
   - Esperado: resposta curta de saudacao ou pergunta de nome, sem lista de produto.

2. Busca de produto
   - Mensagens: `["redmi note 15"]`
   - Esperado: lista de produtos e rodape com "vamos ficar com qual deles hoje?"

3. Escolha de produto
   - Mensagens: `["redmi note 15", "1"]`
   - Esperado: detalhe do produto e proximo passo de compra/detalhes.

4. Entrega fora de compra
   - Mensagens: `["faz entrega?", "56320690"]`
   - Esperado: consulta de endereco, sem mensagem de instabilidade.

5. Fluxo de compra com entrega
   - Mensagens: `["redmi note 15", "1", "comprar", "1", "finalizar", "entrega", "56320690"]`
   - Esperado: CEP consultado dentro da compra e pedido de numero/complemento.

6. Fallback fora do fluxo
   - Mensagens: `["xpto mensagem solta"]`
   - Esperado: fallback fora de fluxo com opcoes de caminho ou curadoria.

7. Fallback contextual de CEP
   - Mensagens: `["faz entrega?", "nao sei"]`
   - Esperado: pedir apenas os 8 numeros do CEP.

8. Pedido humano
   - Mensagens: `["falar com atendente"]`
   - Esperado: resposta de atendimento humano e pausa.
```

- [ ] **Step 2: Criar runner inicial**

Criar `tmp-tests/autoresponder-core-scenarios.cjs`:

```js
const fs = require('fs');

function readEnv(name) {
  for (const file of ['.env.vps.local', '.env.local', '.env', '.env.production']) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
      const [key, ...rest] = line.split('=');
      if (key.trim() === name) return rest.join('=').trim().replace(/^"|"$/g, '');
    }
  }
  return process.env[name] || '';
}

const apiBase = process.env.AUTORESPONDER_TEST_API || 'https://api.xiaomipetrolina.com.br';
const syncKey = process.env.SYNC_SECRET || readEnv('SYNC_SECRET');

if (!syncKey) throw new Error('Missing SYNC_SECRET for /autoresponder/test-flow');

const scenarios = [
  {
    name: 'product search footer',
    messages: ['redmi note 15'],
    assert: (result) => {
      const text = JSON.stringify(result);
      if (!text.includes('vamos ficar com qual deles hoje?')) {
        throw new Error('product footer did not include new choice prompt');
      }
    },
  },
  {
    name: 'standalone delivery cep',
    messages: ['faz entrega?', '56320690'],
    assert: (result) => {
      const text = JSON.stringify(result);
      if (!text.includes('Atendemos esse CEP') && !text.includes('Encontrei este endereco')) {
        throw new Error('delivery CEP was not consulted');
      }
      if (text.includes('instabilidade')) {
        throw new Error('delivery CEP scenario returned instability fallback');
      }
    },
  },
];

async function runScenario(scenario) {
  const response = await fetch(`${apiBase}/autoresponder/test-flow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': syncKey,
    },
    body: JSON.stringify({
      sender: `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      messages: scenario.messages,
      cleanup: true,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${scenario.name} failed HTTP ${response.status}: ${JSON.stringify(body)}`);
  scenario.assert(body);
  console.log(`PASS ${scenario.name}`);
}

(async () => {
  for (const scenario of scenarios) await runScenario(scenario);
})();
```

- [ ] **Step 3: Rodar runner contra producao**

Run:

```powershell
node tmp-tests\autoresponder-core-scenarios.cjs
```

Expected:

```text
PASS product search footer
PASS standalone delivery cep
```

- [ ] **Step 4: Commit**

```powershell
git add -- docs/autoresponder/test-scenarios.md tmp-tests/autoresponder-core-scenarios.cjs
git commit -m "test(autoresponder): add core scenario runner"
```

---

## Fase 1: Estado Unificado De Conversa

### Task 1.1: Definir Contrato De Estado

**Files:**
- Create: `services/autoresponder/engine/types.js`
- Test: `tmp-tests/autoresponder-state-contract-static.test.mjs`

- [ ] **Step 1: Escrever teste do contrato**

Criar `tmp-tests/autoresponder-state-contract-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const types = readFileSync('services/autoresponder/engine/types.js', 'utf8');

[
  '@typedef {Object} ConversationState',
  "@property {'none'|'greeting'|'product_search'|'purchase'|'delivery'|'payment'|'customer_data'|'handoff'} flow",
  '@property {string} step',
  '@property {Object} data',
  '@property {string|null} last_intent',
  '@property {string|null} expires_at',
  '@typedef {Object} BotReply',
  '@typedef {Object} FlowHandler',
].forEach((needle) => {
  assert.ok(types.includes(needle), `types.js must include ${needle}`);
});

console.log('autoresponder state contract static checks passed');
```

- [ ] **Step 2: Criar tipos JSDoc**

Criar `services/autoresponder/engine/types.js`:

```js
/**
 * @typedef {Object} ConversationState
 * @property {'none'|'greeting'|'product_search'|'purchase'|'delivery'|'payment'|'customer_data'|'handoff'} flow
 * @property {string} step
 * @property {Object} data
 * @property {string|null} last_intent
 * @property {string|null} expires_at
 */

/**
 * @typedef {Object} BotReply
 * @property {string} message
 * @property {string} intent
 * @property {ConversationState} nextState
 * @property {number} matchedCount
 * @property {Array<Object>} matchedProducts
 */

/**
 * @typedef {Object} FlowHandler
 * @property {string} name
 * @property {(args: { message: string, state: ConversationState, settings: Object }) => boolean} canHandle
 * @property {(args: { sender: string, message: string, state: ConversationState, settings: Object, context: Object }) => Promise<BotReply|null>} handle
 */

module.exports = {};
```

- [ ] **Step 3: Rodar teste**

```powershell
node tmp-tests\autoresponder-state-contract-static.test.mjs
```

Expected:

```text
autoresponder state contract static checks passed
```

- [ ] **Step 4: Commit**

```powershell
git add -- services/autoresponder/engine/types.js tmp-tests/autoresponder-state-contract-static.test.mjs
git commit -m "feat(autoresponder): define conversation state contract"
```

### Task 1.2: Criar Normalizador De Estado

**Files:**
- Create: `services/autoresponder/engine/state.js`
- Test: `tmp-tests/autoresponder-state-normalizer.test.cjs`

- [ ] **Step 1: Escrever teste unitario**

Criar `tmp-tests/autoresponder-state-normalizer.test.cjs`:

```js
const assert = require('node:assert/strict');
const {
  createEmptyConversationState,
  normalizeConversationState,
  isConversationStateExpired,
} = require('../services/autoresponder/engine/state.js');

const empty = createEmptyConversationState();
assert.equal(empty.flow, 'none');
assert.equal(empty.step, 'idle');
assert.deepEqual(empty.data, {});

const normalized = normalizeConversationState({
  flow: 'delivery',
  step: 'awaiting_cep',
  data: { asked: true },
  last_intent: 'delivery_question',
});
assert.equal(normalized.flow, 'delivery');
assert.equal(normalized.step, 'awaiting_cep');
assert.equal(normalized.data.asked, true);
assert.equal(normalized.last_intent, 'delivery_question');

const invalid = normalizeConversationState({ flow: 'weird', step: '' });
assert.equal(invalid.flow, 'none');
assert.equal(invalid.step, 'idle');

assert.equal(isConversationStateExpired({ expires_at: '2000-01-01T00:00:00.000Z' }), true);
assert.equal(isConversationStateExpired({ expires_at: '2999-01-01T00:00:00.000Z' }), false);
assert.equal(isConversationStateExpired({ expires_at: null }), false);

console.log('autoresponder state normalizer tests passed');
```

- [ ] **Step 2: Implementar normalizador**

Criar `services/autoresponder/engine/state.js`:

```js
const VALID_FLOWS = new Set([
  'none',
  'greeting',
  'product_search',
  'purchase',
  'delivery',
  'payment',
  'customer_data',
  'handoff',
]);

function createEmptyConversationState() {
  return {
    flow: 'none',
    step: 'idle',
    data: {},
    last_intent: null,
    expires_at: null,
  };
}

function normalizeConversationState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createEmptyConversationState();
  }

  const flow = VALID_FLOWS.has(String(value.flow || '')) ? String(value.flow) : 'none';
  const step = flow === 'none' ? 'idle' : String(value.step || '').trim() || 'idle';
  const data = value.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : {};
  const lastIntent = value.last_intent == null ? null : String(value.last_intent);
  const expiresAt = value.expires_at == null ? null : String(value.expires_at);

  return {
    flow,
    step,
    data,
    last_intent: lastIntent,
    expires_at: expiresAt,
  };
}

function isConversationStateExpired(state, now = new Date()) {
  const expiresAt = state?.expires_at ? new Date(state.expires_at) : null;
  return Boolean(expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime());
}

module.exports = {
  createEmptyConversationState,
  normalizeConversationState,
  isConversationStateExpired,
};
```

- [ ] **Step 3: Rodar teste**

```powershell
node tmp-tests\autoresponder-state-normalizer.test.cjs
```

Expected:

```text
autoresponder state normalizer tests passed
```

- [ ] **Step 4: Commit**

```powershell
git add -- services/autoresponder/engine/state.js tmp-tests/autoresponder-state-normalizer.test.cjs
git commit -m "feat(autoresponder): normalize conversation state"
```

---

## Fase 2: Router E Fallbacks

### Task 2.0: Criar Catalogo De Mensagens Editaveis

**Files:**
- Create: `services/autoresponder/engine/messages.js`
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `server.js`
- Modify: `pages/admin/AutoResponderPage.tsx`
- Test: `tmp-tests/autoresponder-admin-editable-messages-static.test.mjs`

- [ ] **Step 1: Criar teste anti-mensagem-oculta**

Criar `tmp-tests/autoresponder-admin-editable-messages-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const messages = readFileSync('services/autoresponder/engine/messages.js', 'utf8');
const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');

[
  'AUTORESPONDER_MESSAGE_KEYS',
  'resolveAutoresponderMessage',
  'delivery.ask_cep',
  'delivery.cep_not_found',
  'delivery.cep_found_no_rule',
  'product_search.choice_prompt',
  'fallback.global',
  'fallback.delivery_awaiting_cep',
].forEach((needle) => {
  assert.ok(messages.includes(needle), `messages catalog must include ${needle}`);
});

[
  'Mensagens do Bot',
  'delivery.ask_cep',
  'product_search.choice_prompt',
  'fallback.global',
].forEach((needle) => {
  assert.ok(page.includes(needle), `admin must expose editable message ${needle}`);
});

console.log('autoresponder admin editable messages static checks passed');
```

- [ ] **Step 2: Criar resolvedor central**

Criar `services/autoresponder/engine/messages.js`:

```js
const AUTORESPONDER_MESSAGE_KEYS = {
  'delivery.ask_cep': 'Fazemos entrega sim. Me envie seu CEP com 8 numeros para consultar rapidinho.',
  'delivery.cep_not_found': 'Nao consegui encontrar esse CEP. Confira os 8 numeros e me envie novamente.',
  'delivery.cep_found_no_rule': 'Nao encontrei uma regra automatica de frete para esse CEP. Um atendente confirma o valor certinho.',
  'delivery.choose_product_after_cep': 'Para fechar o valor com produto, responda com o numero ou nome do item que voce quer.',
  'product_search.choice_prompt': 'vamos ficar com qual deles hoje? quer ver a lista completa?',
  'product_search.more_prompt': 'Se quiser ver mais opcoes, digite "mais".',
  'fallback.global': 'Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?',
  'fallback.delivery_awaiting_cep': 'Me envie apenas os 8 numeros do CEP. Ex: 56320690',
  'fallback.product_choice': 'Me diga o numero da opcao ou o nome do modelo. Ex: 1 ou Redmi Note 15.',
  'fallback.purchase_quantity': 'Me envie a quantidade em numero. Ex: 1',
};

function parseMessageConfig(settings) {
  if (!settings?.conversation_flow_messages) return {};
  if (typeof settings.conversation_flow_messages === 'string') {
    try {
      const parsed = JSON.parse(settings.conversation_flow_messages);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof settings.conversation_flow_messages === 'object' ? settings.conversation_flow_messages : {};
}

function resolveAutoresponderMessage(settings, key, replacements = {}) {
  const configured = parseMessageConfig(settings);
  let template = String(configured[key] || AUTORESPONDER_MESSAGE_KEYS[key] || '');
  for (const [name, value] of Object.entries(replacements)) {
    template = template.split(`{${name}}`).join(String(value ?? ''));
  }
  return template;
}

module.exports = {
  AUTORESPONDER_MESSAGE_KEYS,
  resolveAutoresponderMessage,
};
```

- [ ] **Step 3: Expor todas as mensagens no admin**

Em `pages/admin/AutoResponderPage.tsx`, a aba de mensagens precisa listar todas as chaves de `AUTORESPONDER_MESSAGE_KEYS` com label claro:

```text
Mensagens do Bot
- delivery.ask_cep
- delivery.cep_not_found
- delivery.cep_found_no_rule
- delivery.choose_product_after_cep
- product_search.choice_prompt
- product_search.more_prompt
- fallback.global
- fallback.delivery_awaiting_cep
- fallback.product_choice
- fallback.purchase_quantity
```

- [ ] **Step 4: Proibir mensagem nova sem chave**

Durante revisao de qualquer fase, se uma resposta nova ao cliente for adicionada no servidor, adicionar tambem:

```js
AUTORESPONDER_MESSAGE_KEYS['nome.da.mensagem'] = 'Texto padrao seguro';
```

E expor a chave no admin.

- [ ] **Step 5: Rodar teste**

```powershell
node tmp-tests\autoresponder-admin-editable-messages-static.test.mjs
```

Expected:

```text
autoresponder admin editable messages static checks passed
```

- [ ] **Step 6: Commit**

```powershell
git add -- services/autoresponder/engine/messages.js pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-admin-editable-messages-static.test.mjs
git commit -m "feat(autoresponder): centralize editable bot messages"
```

### Task 2.1: Criar Ordem De Roteamento

**Files:**
- Create: `services/autoresponder/engine/router.js`
- Test: `tmp-tests/autoresponder-router-order-static.test.mjs`

- [ ] **Step 1: Criar teste de ordem**

Criar `tmp-tests/autoresponder-router-order-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const router = readFileSync('services/autoresponder/engine/router.js', 'utf8');

const expectedOrder = [
  'activeFlow',
  'manualRule',
  'knownIntent',
  'productSearch',
  'controlledAi',
  'globalFallback',
];

let lastIndex = -1;
for (const token of expectedOrder) {
  const index = router.indexOf(token);
  assert.ok(index > lastIndex, `router must check ${token} after previous stage`);
  lastIndex = index;
}

assert.ok(router.includes('if (state.flow !== \\'none\\')'), 'router must prioritize active flow');
assert.ok(router.includes('controlledAi'), 'router must keep AI behind deterministic handlers');

console.log('autoresponder router order static checks passed');
```

- [ ] **Step 2: Criar router inicial**

Criar `services/autoresponder/engine/router.js`:

```js
async function routeAutoresponderMessage(args) {
  const { message, state, handlers } = args;

  const activeFlow = handlers.activeFlow;
  if (state.flow !== 'none' && activeFlow?.canHandle(args)) {
    return activeFlow.handle(args);
  }

  const manualRule = handlers.manualRule;
  if (manualRule?.canHandle(args)) {
    return manualRule.handle(args);
  }

  const knownIntent = handlers.knownIntent;
  if (knownIntent?.canHandle(args)) {
    return knownIntent.handle(args);
  }

  const productSearch = handlers.productSearch;
  if (productSearch?.canHandle(args)) {
    return productSearch.handle(args);
  }

  const controlledAi = handlers.controlledAi;
  if (controlledAi?.canHandle(args)) {
    return controlledAi.handle(args);
  }

  const globalFallback = handlers.globalFallback;
  return globalFallback.handle({ ...args, message });
}

module.exports = {
  routeAutoresponderMessage,
};
```

- [ ] **Step 3: Rodar teste**

```powershell
node tmp-tests\autoresponder-router-order-static.test.mjs
```

Expected:

```text
autoresponder router order static checks passed
```

- [ ] **Step 4: Commit**

```powershell
git add -- services/autoresponder/engine/router.js tmp-tests/autoresponder-router-order-static.test.mjs
git commit -m "feat(autoresponder): add deterministic router order"
```

### Task 2.2: Criar Fallbacks Contextuais E Fora Do Fluxo

**Files:**
- Create: `services/autoresponder/engine/fallbacks.js`
- Test: `tmp-tests/autoresponder-fallbacks.test.cjs`

- [ ] **Step 1: Escrever teste**

Criar `tmp-tests/autoresponder-fallbacks.test.cjs`:

```js
const assert = require('node:assert/strict');
const {
  buildContextualFallback,
  buildGlobalFallback,
} = require('../services/autoresponder/engine/fallbacks.js');

assert.equal(
  buildContextualFallback({ flow: 'delivery', step: 'awaiting_cep' }).message,
  'Me envie apenas os 8 numeros do CEP. Ex: 56320690'
);

assert.equal(
  buildContextualFallback({ flow: 'product_search', step: 'awaiting_choice' }).message,
  'Me diga o numero da opcao ou o nome do modelo. Ex: 1 ou Redmi Note 15.'
);

assert.equal(
  buildGlobalFallback().message,
  'Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?'
);

console.log('autoresponder fallback tests passed');
```

- [ ] **Step 2: Implementar fallbacks**

Criar `services/autoresponder/engine/fallbacks.js`:

```js
function buildContextualFallback(state) {
  const key = `${state?.flow || 'none'}.${state?.step || 'idle'}`;
  const messages = {
    'delivery.awaiting_cep': 'Me envie apenas os 8 numeros do CEP. Ex: 56320690',
    'product_search.awaiting_choice': 'Me diga o numero da opcao ou o nome do modelo. Ex: 1 ou Redmi Note 15.',
    'purchase.awaiting_quantity': 'Me envie a quantidade em numero. Ex: 1',
    'purchase.awaiting_fulfillment': 'Voce prefere entrega ou retirada na loja?',
    'payment.awaiting_method': 'Voce prefere Pix, dinheiro, debito ou cartao?',
    'customer_data.awaiting_name': 'Me envie seu nome completo para finalizar.',
  };

  const message = messages[key] || buildGlobalFallback().message;
  return {
    message,
    intent: 'contextual_fallback',
    nextState: state,
    matchedCount: 0,
    matchedProducts: [],
  };
}

function buildGlobalFallback() {
  return {
    message: 'Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?',
    intent: 'global_fallback',
    nextState: {
      flow: 'none',
      step: 'idle',
      data: {},
      last_intent: 'global_fallback',
      expires_at: null,
    },
    matchedCount: 0,
    matchedProducts: [],
  };
}

module.exports = {
  buildContextualFallback,
  buildGlobalFallback,
};
```

- [ ] **Step 3: Rodar teste**

```powershell
node tmp-tests\autoresponder-fallbacks.test.cjs
```

Expected:

```text
autoresponder fallback tests passed
```

- [ ] **Step 4: Commit**

```powershell
git add -- services/autoresponder/engine/fallbacks.js tmp-tests/autoresponder-fallbacks.test.cjs
git commit -m "feat(autoresponder): add contextual fallbacks"
```

---

## Fase 3: Migrar Entrega/CEP Primeiro

### Task 3.1: Extrair Fluxo De Entrega

**Files:**
- Create: `services/autoresponder/engine/flows/delivery.js`
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `server.js`
- Test: `tmp-tests/autoresponder-delivery-flow-engine-static.test.mjs`
- Test: `tmp-tests/autoresponder-core-scenarios.cjs`

- [ ] **Step 1: Criar teste estatico do modulo**

Criar `tmp-tests/autoresponder-delivery-flow-engine-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const flow = readFileSync('services/autoresponder/engine/flows/delivery.js', 'utf8');

[
  'deliveryFlowHandler',
  "flow: 'delivery'",
  "step: 'awaiting_cep'",
  'lookupCep',
  'calculateShippingOptions',
  'buildContextualFallback',
].forEach((needle) => {
  assert.ok(flow.includes(needle), `delivery flow must include ${needle}`);
});

console.log('autoresponder delivery flow engine static checks passed');
```

- [ ] **Step 2: Criar modulo de entrega**

Criar `services/autoresponder/engine/flows/delivery.js` com funcoes puras e dependencias injetadas:

```js
const { buildContextualFallback } = require('../fallbacks.js');

function normalizeCep(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits.length === 8 ? digits : '';
}

function isDeliveryQuestion(message) {
  const text = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(entrega|entregar|delivery|frete|motoboy|enviar|mandar)\b/.test(text);
}

function buildAskCepReply() {
  return {
    message: 'Fazemos entrega sim. Me envie seu CEP com 8 numeros para consultar rapidinho.',
    intent: 'delivery_cep_prompt',
    nextState: {
      flow: 'delivery',
      step: 'awaiting_cep',
      data: {},
      last_intent: 'delivery_question',
      expires_at: null,
    },
    matchedCount: 0,
    matchedProducts: [],
  };
}

function buildCepReply(address, shippingOptions) {
  const firstOption = Array.isArray(shippingOptions) ? shippingOptions[0] : null;
  const lines = [
    'Atendemos esse CEP:',
    `Rua: ${address.street || 'nao informado'}`,
    `Bairro: ${address.neighborhood || 'nao informado'}`,
    `Cidade: ${address.city || 'nao informado'} - ${address.state || ''}`.trim(),
    `CEP: ${address.cep || 'nao informado'}`,
    '',
  ];

  if (firstOption) {
    lines.push('Frete estimado:');
    lines.push(`${firstOption.name}: ${firstOption.isFree ? 'Gratis' : firstOption.price}`);
  } else {
    lines.push('Nao encontrei uma regra automatica de frete para esse CEP. Um atendente confirma o valor certinho.');
  }

  return {
    message: lines.join('\n'),
    intent: 'delivery_cep_quote',
    nextState: {
      flow: 'none',
      step: 'idle',
      data: { address, shippingOptions: shippingOptions || [] },
      last_intent: 'delivery_cep_quote',
      expires_at: null,
    },
    matchedCount: Array.isArray(shippingOptions) ? shippingOptions.length : 0,
    matchedProducts: shippingOptions || [],
  };
}

const deliveryFlowHandler = {
  name: 'delivery',
  canHandle({ message, state }) {
    return state.flow === 'delivery' || isDeliveryQuestion(message);
  },
  async handle({ message, state, context }) {
    if (state.flow !== 'delivery' && isDeliveryQuestion(message)) {
      return buildAskCepReply();
    }

    if (state.flow === 'delivery' && state.step === 'awaiting_cep') {
      const cep = normalizeCep(message);
      if (!cep) return buildContextualFallback(state);
      const address = await context.lookupCep(cep);
      if (!address) return buildContextualFallback(state);
      const shippingOptions = await context.calculateShippingOptions(cep, [], address);
      return buildCepReply(address, shippingOptions);
    }

    return buildContextualFallback(state);
  },
};

module.exports = {
  deliveryFlowHandler,
  normalizeCep,
  isDeliveryQuestion,
  buildAskCepReply,
  buildCepReply,
};
```

- [ ] **Step 3: Integrar no servidor com feature flag**

Em `vps_server.js`, `vps_server.cjs` e `server.js`, carregar o handler sem desligar fluxo antigo:

```js
const { deliveryFlowHandler } = require('./services/autoresponder/engine/flows/delivery.js');
```

Dentro do webhook, antes do bloco antigo de regras manuais, chamar o handler apenas quando `process.env.AUTORESPONDER_ENGINE_V2 === '1'`:

```js
if (process.env.AUTORESPONDER_ENGINE_V2 === '1') {
  const state = normalizeConversationState(purchaseFlow?.conversation_state || {});
  const deliveryReply = await deliveryFlowHandler.handle({
    sender: senderKey,
    message,
    state,
    settings,
    context: {
      lookupCep: lookupAutoresponderCep,
      calculateShippingOptions: calculateAutoresponderShippingOptions,
    },
  });
  if (deliveryReply && deliveryReply.intent !== 'contextual_fallback') {
    await saveAutoresponderPurchaseFlow(senderKey, {
      ...purchaseFlow,
      conversation_state: deliveryReply.nextState,
    });
    await logAutoresponderReply({
      sender: senderKey,
      message,
      intent: deliveryReply.intent,
      replyText: deliveryReply.message,
      matchedCount: deliveryReply.matchedCount,
      matchedProducts: deliveryReply.matchedProducts,
    });
    await upsertAutoresponderSuccessConversation(senderKey);
    return { replies: [{ message: deliveryReply.message }] };
  }
}
```

- [ ] **Step 4: Rodar testes locais**

```powershell
node tmp-tests\autoresponder-delivery-flow-engine-static.test.mjs
node tmp-tests\autoresponder-core-scenarios.cjs
node --check vps_server.js
```

Expected:

```text
autoresponder delivery flow engine static checks passed
PASS product search footer
PASS standalone delivery cep
```

- [ ] **Step 5: Commit e deploy API**

```powershell
git add -- services/autoresponder/engine/flows/delivery.js vps_server.js vps_server.cjs server.js tmp-tests/autoresponder-delivery-flow-engine-static.test.mjs
git commit -m "feat(autoresponder): migrate delivery flow to engine"
git push origin HEAD:main
node deploy-vps-server-only.cjs
```

- [ ] **Step 6: Validar producao**

```powershell
node tmp-tests\autoresponder-core-scenarios.cjs
curl.exe -i -s "https://api.xiaomipetrolina.com.br/health"
```

Expected:

```text
PASS standalone delivery cep
HTTP/1.1 200 OK
```

---

## Fase 4: Migrar Busca E Escolha De Produto

### Task 4.1: Extrair Busca De Produto

**Files:**
- Create: `services/autoresponder/engine/flows/product-search.js`
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `server.js`
- Test: `tmp-tests/autoresponder-product-search-engine-static.test.mjs`
- Test: `tmp-tests/autoresponder-core-scenarios.cjs`

- [x] **Step 1: Criar teste estatico**

Criar `tmp-tests/autoresponder-product-search-engine-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/autoresponder/engine/flows/product-search.js', 'utf8');

[
  'productSearchFlowHandler',
  "flow: 'product_search'",
  "step: 'awaiting_choice'",
  'findProducts',
  'findSelectedProduct',
  'vamos ficar com qual deles hoje?',
].forEach((needle) => {
  assert.ok(source.includes(needle), `product search flow must include ${needle}`);
});

console.log('autoresponder product search engine static checks passed');
```

- [x] **Step 2: Criar modulo de busca**

Implementar `productSearchFlowHandler` com dependencias injetadas:

```js
const { buildContextualFallback } = require('../fallbacks.js');

function buildProductSearchReply(products, keyword, hasMore) {
  const lines = [`Encontrei estas opcoes para ${keyword}:`, ''];
  products.forEach((product, index) => {
    lines.push(`${index + 1}. ${product.name}`);
    if (product.price_text) lines.push(product.price_text);
    if (product.colors_text) lines.push(product.colors_text);
    lines.push('');
  });
  lines.push('vamos ficar com qual deles hoje? quer ver a lista completa?');
  if (hasMore) lines.push('Se quiser ver mais opcoes, digite "mais".');
  return lines.join('\n').trim();
}

const productSearchFlowHandler = {
  name: 'product_search',
  canHandle({ state, context }) {
    return state.flow === 'product_search' || Boolean(context.productSearchTokens?.length);
  },
  async handle({ message, state, context }) {
    if (state.flow === 'product_search' && state.step === 'awaiting_choice') {
      const selected = context.findSelectedProduct(message, state.data.options || []);
      if (!selected) return buildContextualFallback(state);
      return {
        message: await context.buildProductDetailReply(selected),
        intent: 'product_selected',
        nextState: {
          flow: 'purchase',
          step: 'awaiting_action',
          data: { selected_product: selected },
          last_intent: 'product_selected',
          expires_at: null,
        },
        matchedCount: 1,
        matchedProducts: [selected],
      };
    }

    const products = await context.findProducts(context.productSearchTokens);
    if (!products.length) return null;
    const options = context.buildProductOptions(products);
    return {
      message: buildProductSearchReply(products, context.productSearchTokens.join(' '), products.length > options.length),
      intent: 'product_search',
      nextState: {
        flow: 'product_search',
        step: 'awaiting_choice',
        data: { options, keyword: context.productSearchTokens.join(' ') },
        last_intent: 'product_search',
        expires_at: null,
      },
      matchedCount: products.length,
      matchedProducts: options,
    };
  },
};

module.exports = {
  productSearchFlowHandler,
  buildProductSearchReply,
};
```

- [x] **Step 3: Integrar com feature flag**

Seguir o mesmo padrao da entrega: habilitar por `AUTORESPONDER_ENGINE_V2 === '1'`, salvar `conversation_state`, e manter fallback antigo se o handler retornar `null`.

- [x] **Step 4: Rodar cenarios**

```powershell
node tmp-tests\autoresponder-product-search-engine-static.test.mjs
node tmp-tests\autoresponder-core-scenarios.cjs
```

- [ ] **Step 5: Commit e publicar**

Pendente nesta rodada: commit/publicacao nao executados porque `vps_server.js`, `vps_server.cjs` e `server.js` ja tinham alteracoes nao relacionadas no workspace; commitar agora misturaria escopos.

```powershell
git add -- services/autoresponder/engine/flows/product-search.js vps_server.js vps_server.cjs server.js tmp-tests/autoresponder-product-search-engine-static.test.mjs
git commit -m "feat(autoresponder): migrate product search flow to engine"
git push origin HEAD:main
node deploy-vps-server-only.cjs
```

---

## Fase 5: Migrar Compra Completa

### Task 5.1: Separar Compra Do Estado Geral

**Files:**
- Create: `services/autoresponder/engine/flows/purchase.js`
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `server.js`
- Test: `tmp-tests/autoresponder-purchase-engine-static.test.mjs`
- Test: `tmp-tests/autoresponder-core-scenarios.cjs`

- [x] **Step 1: Criar teste estatico**

Criar `tmp-tests/autoresponder-purchase-engine-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/autoresponder/engine/flows/purchase.js', 'utf8');

[
  'purchaseFlowHandler',
  "step: 'awaiting_action'",
  "step: 'awaiting_quantity'",
  "step: 'awaiting_fulfillment'",
  "step: 'awaiting_payment_method'",
  'buildContextualFallback',
].forEach((needle) => {
  assert.ok(source.includes(needle), `purchase flow must include ${needle}`);
});

console.log('autoresponder purchase engine static checks passed');
```

- [x] **Step 2: Criar esqueleto do fluxo**

Criar `purchaseFlowHandler` com passos:

```text
purchase.awaiting_action
purchase.awaiting_variation
purchase.awaiting_quantity
purchase.item_added
purchase.awaiting_fulfillment
delivery.awaiting_cep
delivery.awaiting_number
payment.awaiting_method
customer_data.awaiting_name
customer_data.awaiting_document
handoff.ready
```

- [x] **Step 3: Migrar passo por passo**

Checklist:

- [ ] Produto selecionado pergunta comprar/detalhes.
- [ ] Comprar pergunta variacao quando houver variacoes.
- [ ] Comprar pergunta quantidade quando nao houver variacao.
- [ ] Quantidade invalida usa fallback contextual.
- [ ] Produto sem estoque bloqueia compra.
- [ ] Item adicionado permite finalizar, adicionar ou remover.
- [ ] Finalizar pergunta entrega/retirada.
- [ ] Entrega reaproveita modulo `delivery.js`.
- [ ] Retirada pula CEP e vai para pagamento.
- [ ] Pagamento calcula total com frete quando houver.
- [ ] Dados do cliente criam/atualizam cadastro.
- [ ] Handoff pausa conversa e registra resumo.

- [ ] **Step 4: Rodar simulacoes**

Parcial nesta rodada: `node tmp-tests\autoresponder-purchase-engine-static.test.mjs`, `node tmp-tests\autoresponder-purchase-engine-behavior.test.mjs`, `node --check vps_server.js`, `node --check vps_server.cjs`, `node --check server.js`, `node tmp-tests\autoresponder-product-search-engine-static.test.mjs`, `node tmp-tests\autoresponder-delivery-engine-integration-static.test.mjs`, `node tmp-tests\autoresponder-router-order-static.test.mjs` e `node scripts\assert-no-supabase-runtime.cjs` passaram. `node tmp-tests\autoresponder-core-scenarios.cjs` nao foi rerodado depois da compra V2 porque a escalada foi rejeitada por risco de enviar `SYNC_SECRET` para API externa; precisa de aprovacao explicita para rodar.

```powershell
node tmp-tests\autoresponder-purchase-engine-static.test.mjs
node tmp-tests\autoresponder-core-scenarios.cjs
```

- [ ] **Step 5: Commit e publicar**

Pendente nesta rodada: commit/publicacao nao executados porque `vps_server.js`, `vps_server.cjs` e `server.js` ja tinham alteracoes nao relacionadas no workspace; commitar agora misturaria escopos.

```powershell
git add -- services/autoresponder/engine/flows/purchase.js vps_server.js vps_server.cjs server.js tmp-tests/autoresponder-purchase-engine-static.test.mjs tmp-tests/autoresponder-core-scenarios.cjs
git commit -m "feat(autoresponder): migrate purchase flow to engine"
git push origin HEAD:main
node deploy-vps-server-only.cjs
```

---

## Fase 6: Curadoria, Regras E IA Controlada

### Task 6.1: Criar Politica De Regras Que Perguntam Algo

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `server.js`
- Modify: `pages/admin/AutoResponderPage.tsx`
- Test: `tmp-tests/autoresponder-rule-next-state-static.test.mjs`

- [x] **Step 1: Criar regra de contrato**

Toda regra com pergunta precisa ter `next_state`.

Exemplo de `next_state`:

```json
{
  "flow": "delivery",
  "step": "awaiting_cep",
  "data": {},
  "last_intent": "rule_delivery_question",
  "expires_at": null
}
```

- [x] **Step 2: Criar teste estatico**

Criar `tmp-tests/autoresponder-rule-next-state-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');
const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');

assert.ok(server.includes('next_state'), 'server must persist rule next_state');
assert.ok(server.includes('applyRuleNextState'), 'server must apply next_state after rule reply');
assert.ok(page.includes('Proximo estado'), 'admin must expose next state for question rules');

console.log('autoresponder rule next state static checks passed');
```

- [x] **Step 3: Adicionar campo no admin**

No modal de regra, incluir seletor:

```text
Proximo estado:
- Nenhum
- Aguardar CEP de entrega
- Aguardar escolha de produto
- Aguardar quantidade
- Aguardar forma de pagamento
- Aguardar atendente
```

- [x] **Step 4: Persistir e aplicar**

No servidor, quando regra textual responder:

```js
if (matchedRule.next_state) {
  await saveAutoresponderPurchaseFlow(senderKey, {
    ...purchaseFlow,
    conversation_state: normalizeConversationState(matchedRule.next_state),
  });
}
```

- [ ] **Step 5: Validar**

Parcial nesta rodada: `node tmp-tests\autoresponder-rule-next-state-static.test.mjs`, `node --check vps_server.js`, `node --check vps_server.cjs`, `node --check server.js` e `npm.cmd run build` passaram. `node tmp-tests\autoresponder-core-scenarios.cjs` nao foi rerodado porque a escalada anterior foi rejeitada por risco de enviar `SYNC_SECRET` para API externa; precisa de aprovacao explicita para rodar.

```powershell
node tmp-tests\autoresponder-rule-next-state-static.test.mjs
node tmp-tests\autoresponder-core-scenarios.cjs
```

### Task 6.2: Fallback Fora Do Fluxo E Curadoria

**Files:**
- Modify: `services/autoresponder/engine/fallbacks.js`
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Test: `tmp-tests/autoresponder-global-fallback-curation-static.test.mjs`

- [x] **Step 1: Criar regra de roteamento**

Ordem final fora do fluxo:

```text
manualRule -> knownIntent -> productSearch -> controlledAi -> globalFallback -> curation
```

- [x] **Step 2: Criar teste**

Criar `tmp-tests/autoresponder-global-fallback-curation-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');

[
  'global_fallback',
  'curation_candidate',
  'consecutive_fallbacks',
  'auto_pause_fallback_minutes',
].forEach((needle) => {
  assert.ok(server.includes(needle), `server must include ${needle}`);
});

console.log('autoresponder global fallback curation static checks passed');
```

- [x] **Step 3: Implementar comportamento**

Checklist:

- [x] Primeira falha fora de fluxo responde com caminhos.
- [x] Segunda falha registra curadoria.
- [x] Terceira falha pausa para humano.
- [x] Fluxo ativo nunca cai direto em curadoria sem fallback contextual.

- [ ] **Step 4: Validar**

Parcial nesta rodada: `node tmp-tests\autoresponder-global-fallback-curation-static.test.mjs`, `node tmp-tests\autoresponder-rule-next-state-static.test.mjs`, `node tmp-tests\autoresponder-purchase-engine-static.test.mjs`, `node tmp-tests\autoresponder-purchase-engine-behavior.test.mjs`, `node --check vps_server.js`, `node --check vps_server.cjs`, `node --check server.js`, `node scripts\assert-no-supabase-runtime.cjs` e `npm.cmd run build` passaram. `node tmp-tests\autoresponder-core-scenarios.cjs` nao foi rerodado porque a escalada anterior foi rejeitada por risco de enviar `SYNC_SECRET` para API externa; precisa de aprovacao explicita para rodar.

```powershell
node tmp-tests\autoresponder-global-fallback-curation-static.test.mjs
node tmp-tests\autoresponder-core-scenarios.cjs
```

---

## Fase 7: Admin "Mapa Do Bot"

### Task 7.1: Criar Aba Operacional

**Files:**
- Modify: `pages/admin/AutoResponderPage.tsx`
- Modify: `types/autoResponder.ts`
- Modify: `services/autoResponderService.ts`
- Test: `tmp-tests/autoresponder-bot-map-admin-static.test.mjs`

- [x] **Step 1: Criar teste**

Criar `tmp-tests/autoresponder-bot-map-admin-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');

[
  "id: 'mapa'",
  'Mapa do Bot',
  'Fluxo',
  'Pergunta do bot',
  'Resposta esperada',
  'Fallback contextual',
  'Simular fluxo',
].forEach((needle) => {
  assert.ok(page.includes(needle), `AutoResponderPage must include ${needle}`);
});

console.log('autoresponder bot map admin static checks passed');
```

- [x] **Step 2: Adicionar aba**

Adicionar aba `Mapa do Bot` no admin com:

- [x] Lista de fluxos.
- [x] Estado atual de cada fluxo.
- [x] Perguntas do bot.
- [x] Respostas esperadas.
- [x] Fallback contextual.
- [x] Botao "Simular fluxo".
- [x] Resultado da ultima simulacao.

- [x] **Step 3: Validar UI por build**

```powershell
node tmp-tests\autoresponder-bot-map-admin-static.test.mjs
npm.cmd run build
```

Validado nesta rodada:

```powershell
node tmp-tests\autoresponder-bot-map-admin-static.test.mjs
npm.cmd run build
```

Observacao: a aba atual usa mapa local em `services/autoResponderService.ts`; se o "estado atual" precisar ser operacional/vivo, ainda falta endpoint do backend para o mapa.

- [ ] **Step 4: Publicar frontend**

```powershell
git add -- pages/admin/AutoResponderPage.tsx types/autoResponder.ts services/autoResponderService.ts tmp-tests/autoresponder-bot-map-admin-static.test.mjs
git commit -m "feat(autoresponder): add bot map admin view"
git push origin HEAD:main
npm.cmd run deploy:vps-site
```

---

## Fase 8: Desligar Codigo Antigo

### Task 8.1: Remover Dependencia De `purchase_flow` Fora De Compra

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `server.js`
- Test: `tmp-tests/autoresponder-no-purchase-flow-outside-purchase-static.test.mjs`

- [x] **Step 1: Criar teste**

Criar `tmp-tests/autoresponder-no-purchase-flow-outside-purchase-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('vps_server.js', 'utf8');
const forbidden = [
  "status: 'awaiting_standalone_delivery_cep'",
  'standalone_delivery_address_lookup',
  'standalone_shipping_options',
];

for (const needle of forbidden) {
  assert.ok(!source.includes(needle), `legacy standalone state must be removed: ${needle}`);
}

assert.ok(source.includes('conversation_state'), 'server must use conversation_state');

console.log('autoresponder no purchase flow outside purchase static checks passed');
```

- [x] **Step 2: Remover estados provisórios**

Remover do servidor os estados provisórios que usam `purchase_flow` para fluxo fora de compra:

- [x] `awaiting_standalone_delivery_cep`
- [x] `standalone_delivery_address_lookup`
- [x] `standalone_shipping_options`
- [x] `standalone_shipping_quote`

- [x] **Step 3: Validar**

```powershell
node tmp-tests\autoresponder-no-purchase-flow-outside-purchase-static.test.mjs
node tmp-tests\autoresponder-core-scenarios.cjs
```

Validado nesta rodada: `node tmp-tests\autoresponder-no-purchase-flow-outside-purchase-static.test.mjs`, `node --check vps_server.js`, `node --check vps_server.cjs`, `node --check server.js`, `node scripts\assert-no-supabase-runtime.cjs`, `npm.cmd run build` e `node tmp-tests\autoresponder-core-scenarios.cjs` passaram.

- [ ] **Step 4: Commit e publicar**

```powershell
git add -- vps_server.js vps_server.cjs server.js tmp-tests/autoresponder-no-purchase-flow-outside-purchase-static.test.mjs
git commit -m "refactor(autoresponder): remove legacy non-purchase states"
git push origin HEAD:main
node deploy-vps-server-only.cjs
```

---

## Fase 9: Limpeza Final De Arquivos

Esta fase so pode iniciar depois que o Checklist De Pronto estiver completo e validado em producao por pelo menos uma rodada de atendimento real. A limpeza deve remover arquivos que viraram duplicados, temporarios ou obsoletos, sem apagar evidencias operacionais ainda uteis.

### Task 9.1: Inventariar Arquivos Legados E Temporarios

**Files:**
- Create: `docs/autoresponder/cleanup-inventory.md`
- Test: `tmp-tests/autoresponder-cleanup-inventory-static.test.mjs`

- [x] **Step 1: Criar inventario de limpeza**

Criar `docs/autoresponder/cleanup-inventory.md`:

```markdown
# Inventario De Limpeza Do AutoResponder

## Regra

Nao apagar arquivo sem classificar como `remover`, `manter` ou `arquivar`.

## Candidatos A Remover

| Arquivo | Motivo | Acao |
|---|---|---|
| tmp-tests/autoresponder-standalone-delivery-cep-static.test.mjs | Substituido por fluxo `delivery.js` e cenarios centrais | remover apos Fase 8 |
| tmp-tests/autoresponder-delivery-cep-replace-static.test.mjs | Cobertura incorporada ao runner central | remover se o runner cobrir troca de CEP |
| tmp-tests/autoresponder-delivery-cep-shipping-static.test.mjs | Cobertura incorporada ao runner central | remover se o runner cobrir frete em compra |
| tmp-tests/autoresponder-choice-instructions-static.test.mjs | Cobertura incorporada ao fluxo de produto | remover se `product-search.js` testar rodape |

## Candidatos A Manter

| Arquivo | Motivo |
|---|---|
| docs/autoresponder/response-map.md | Fonte operacional do mapa do bot |
| docs/autoresponder/test-scenarios.md | Checklist obrigatorio de simulacao |
| tmp-tests/autoresponder-core-scenarios.cjs | Runner principal de regressao |

## Candidatos A Arquivar

| Arquivo | Motivo | Destino |
|---|---|---|
| Bot_Whatsapp.md | Historico operacional antigo | docs/autoresponder/archive/Bot_Whatsapp.md |
| docs/operacional/*autoresponder* | Evidencias antigas e runbooks especificos | manter se ainda forem usados; arquivar se substituidos |

## Criterios Para Remover

- O novo teste cobre o mesmo comportamento.
- O arquivo nao e chamado por `package.json`, docs, deploy ou runbook.
- `rg "nome-do-arquivo"` nao encontra referencia ativa.
- Build e cenarios centrais passam depois da remocao.
```

- [x] **Step 2: Criar teste do inventario**

Criar `tmp-tests/autoresponder-cleanup-inventory-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = readFileSync('docs/autoresponder/cleanup-inventory.md', 'utf8');

[
  'Candidatos A Remover',
  'Candidatos A Manter',
  'Candidatos A Arquivar',
  'Criterios Para Remover',
  'tmp-tests/autoresponder-core-scenarios.cjs',
].forEach((needle) => {
  assert.ok(doc.includes(needle), `cleanup inventory must include ${needle}`);
});

console.log('autoresponder cleanup inventory static checks passed');
```

- [x] **Step 3: Rodar teste**

```powershell
node tmp-tests\autoresponder-cleanup-inventory-static.test.mjs
```

Expected:

```text
autoresponder cleanup inventory static checks passed
```

- [ ] **Step 4: Commit**

```powershell
git add -- docs/autoresponder/cleanup-inventory.md tmp-tests/autoresponder-cleanup-inventory-static.test.mjs
git commit -m "docs(autoresponder): inventory cleanup candidates"
```

### Task 9.2: Remover Testes Temporarios Substituidos

**Files:**
- Delete: `tmp-tests/autoresponder-standalone-delivery-cep-static.test.mjs`
- Delete: `tmp-tests/autoresponder-delivery-cep-replace-static.test.mjs` only if covered by `tmp-tests/autoresponder-core-scenarios.cjs`
- Delete: `tmp-tests/autoresponder-delivery-cep-shipping-static.test.mjs` only if covered by `tmp-tests/autoresponder-core-scenarios.cjs`
- Delete: `tmp-tests/autoresponder-choice-instructions-static.test.mjs` only if covered by `tmp-tests/autoresponder-product-search-engine-static.test.mjs`
- Modify: `docs/autoresponder/cleanup-inventory.md`
- Test: `tmp-tests/autoresponder-core-scenarios.cjs`

- [x] **Step 1: Confirmar referencias antes de apagar**

Run:

```powershell
rg -n "autoresponder-standalone-delivery-cep-static|autoresponder-delivery-cep-replace-static|autoresponder-delivery-cep-shipping-static|autoresponder-choice-instructions-static" .
```

Expected:

```text
Somente docs/autoresponder/cleanup-inventory.md deve listar os arquivos, ou referencias historicas que tambem serao atualizadas.
```

- [x] **Step 2: Apagar somente arquivos cobertos**

Usar `Remove-Item` por arquivo, depois conferir:

```powershell
Remove-Item -LiteralPath tmp-tests\autoresponder-standalone-delivery-cep-static.test.mjs
git status --short
```

Expected:

```text
D tmp-tests/autoresponder-standalone-delivery-cep-static.test.mjs
```

- [x] **Step 3: Atualizar inventario**

Em `docs/autoresponder/cleanup-inventory.md`, mover arquivos removidos para uma secao:

```markdown
## Removidos

| Arquivo | Commit | Substituido por |
|---|---|---|
| tmp-tests/autoresponder-standalone-delivery-cep-static.test.mjs | <hash-do-commit> | tmp-tests/autoresponder-core-scenarios.cjs |
```

- [x] **Step 4: Validar**

```powershell
node tmp-tests\autoresponder-core-scenarios.cjs
npm.cmd run build
```

- [ ] **Step 5: Commit**

```powershell
git add -- docs/autoresponder/cleanup-inventory.md
git add -u -- tmp-tests
git commit -m "chore(autoresponder): remove replaced temporary tests"
```

### Task 9.3: Arquivar Documentos Operacionais Obsoletos

**Files:**
- Create: `docs/autoresponder/archive/`
- Move: docs antigos confirmados como substituidos
- Modify: `docs/autoresponder/cleanup-inventory.md`

- [x] **Step 1: Listar documentos candidatos**

Run:

```powershell
rg -n "AutoResponder|autoresponder|Bot WhatsApp|Bot_Whatsapp" docs Bot_Whatsapp.md
```

- [x] **Step 2: Classificar cada documento**

Atualizar `docs/autoresponder/cleanup-inventory.md`:

```markdown
## Documentos Revisados

| Arquivo | Decisao | Motivo |
|---|---|---|
| Bot_Whatsapp.md | arquivar | substituido por response-map e test-scenarios |
| docs/operacional/2026-05-05-autoresponder-schema-vps-dry-run.md | manter | runbook de schema ainda usado |
```

- [x] **Step 3: Mover apenas documentos obsoletos**

Executado nesta rodada: `Bot_Whatsapp.md` foi movido para `docs/autoresponder/archive/Bot_Whatsapp.md`. Testes `tmp-tests/autoresponder-*.test.mjs` e `tools/check-autoresponder-synology-readiness.cjs` continuam validando o conteudo por `tools/autoresponder-bot-doc.cjs`.

Exemplo:

```powershell
New-Item -ItemType Directory -Force docs\autoresponder\archive
Move-Item -LiteralPath Bot_Whatsapp.md -Destination docs\autoresponder\archive\Bot_Whatsapp.md
```

- [x] **Step 4: Atualizar referencias**

Run:

```powershell
rg -n "Bot_Whatsapp.md|docs/operacional/.*autoresponder" .
```

Atualizar links que apontarem para documentos movidos.

- [ ] **Step 5: Validar e commit**

```powershell
npm.cmd run build
git add -- docs/autoresponder
git add -u -- .
git commit -m "docs(autoresponder): archive obsolete operational notes"
```

### Task 9.4: Remover Codigo Legado Do Motor Antigo

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `server.js`
- Modify: `docs/autoresponder/cleanup-inventory.md`
- Test: `tmp-tests/autoresponder-core-scenarios.cjs`

- [x] **Step 1: Localizar blocos legados**

Run:

```powershell
rg -n "awaiting_standalone_delivery_cep|standalone_shipping|purchaseFlow.status ===|AUTORESPONDER_ENGINE_V2|old|legacy" vps_server.js vps_server.cjs server.js
```

- [ ] **Step 2: Remover feature flag antiga**

Bloqueado nesta rodada: `AUTORESPONDER_ENGINE_V2=1` ja esta ativo na VPS e os cenarios tecnicos passaram contra a API publicada, mas a remocao final ainda exige pelo menos uma rodada real de atendimento com busca, escolha, compra, entrega e pagamento sem queda para o fluxo antigo.

Auditoria com subagentes nesta rodada confirmou o bloqueio: `AUTORESPONDER_ENGINE_V2` ainda existe nos tres servidores, `purchaseFlow.status === ...` segue ativo apenas em blocos de compra, e o inventario/runbook registram que a flag precisa permanecer reversivel ate essa validacao real.

Quando o motor novo estiver obrigatorio em producao, remover caminhos condicionais:

```js
if (process.env.AUTORESPONDER_ENGINE_V2 === '1') {
  // novo motor
}
```

Substituir por chamada direta do novo router:

```js
const engineReply = await routeAutoresponderMessage({
  sender: senderKey,
  message,
  state: conversationState,
  settings,
  handlers,
  context,
});
```

- [ ] **Step 3: Remover funcoes antigas nao chamadas**

Depois da chamada direta do router, remover funcoes que `rg` confirmar sem uso:

- [ ] handlers de entrega provisoria fora de compra.
- [ ] fallbacks duplicados que foram movidos para `fallbacks.js`.
- [ ] blocos de roteamento antigo substituidos por `router.js`.
- [ ] helpers de estado que foram movidos para `state.js`.

- [ ] **Step 4: Validar**

```powershell
node --check vps_server.js
node --check vps_server.cjs
node --check server.js
node tmp-tests\autoresponder-core-scenarios.cjs
npm.cmd run build
```

- [ ] **Step 5: Commit e publicar**

```powershell
git add -- vps_server.js vps_server.cjs server.js docs/autoresponder/cleanup-inventory.md
git commit -m "refactor(autoresponder): remove legacy engine code"
git push origin HEAD:main
node deploy-vps-server-only.cjs
```

### Task 9.5: Fechar Checklist De Limpeza

**Files:**
- Modify: `docs/autoresponder/cleanup-inventory.md`
- Modify: `docs/autoresponder/response-map.md`

- [ ] **Step 1: Rodar auditoria final**

Nao iniciar enquanto a rodada real de atendimento da Task 9.4 nao estiver confirmada.

```powershell
rg -n "standalone_delivery|legacy autoresponder|AUTORESPONDER_ENGINE_V2|TODO autoresponder|old autoresponder" .
node tmp-tests\autoresponder-core-scenarios.cjs
npm.cmd run build
```

Expected:

```text
Depois da rodada real e da remocao final: nenhum caminho legado ativo encontrado.
Antes disso: apenas legados deliberados de produto/compra podem permanecer.
Cenarios centrais passam.
Build passa.
```

- [ ] **Step 2: Marcar limpeza como concluida**

Adicionar no final de `docs/autoresponder/cleanup-inventory.md`:

```markdown
## Fechamento

- [x] `AUTORESPONDER_ENGINE_V2=1` foi ativado e validado tecnicamente em producao.
- [ ] Rodada real de atendimento confirmou produto/compra sem queda para legado.
- [x] Testes temporarios substituidos foram removidos.
- [x] Documentos obsoletos foram arquivados ou mantidos com motivo.
- [ ] Codigo legado restante de produto/compra foi removido apos a rodada real.
- [ ] Cenarios centrais passaram depois da limpeza final.
- [ ] API foi publicada depois da limpeza final.
```

- [ ] **Step 3: Commit final da limpeza**

```powershell
git add -- docs/autoresponder/cleanup-inventory.md docs/autoresponder/response-map.md
git commit -m "docs(autoresponder): close cleanup checklist"
```

---

## Checklist De Pronto

- [ ] `docs/autoresponder/response-map.md` cobre saudacao, produto, entrega, compra, pagamento, humano, curadoria e fallback.
- [ ] Toda pergunta do bot salva `conversation_state`.
- [ ] Todo `conversation_state` tem fallback contextual.
- [ ] Toda resposta exibida ao cliente existe em `AUTORESPONDER_MESSAGE_KEYS`.
- [ ] Toda chave de `AUTORESPONDER_MESSAGE_KEYS` aparece editavel no admin.
- [ ] Fallback fora do fluxo oferece caminhos claros.
- [ ] IA nao roda antes de fluxo ativo, regra, intent ou busca.
- [ ] Curadoria recebe apenas lacunas reais.
- [ ] `/autoresponder/test-flow` cobre os cenarios obrigatorios.
- [ ] Admin mostra mapa do bot e simulador.
- [ ] `purchase_flow` volta a representar apenas compra.
- [ ] Arquivos temporarios substituidos foram removidos ou arquivados.
- [ ] Documentos operacionais obsoletos foram arquivados com rastreabilidade.
- [ ] Codigo legado do motor antigo foi removido.
- [ ] Nenhuma dependencia operacional nova de Supabase ou Vercel foi criada.
- [ ] Build continua passando pela trava `node scripts\assert-no-supabase-runtime.cjs`.
- [ ] Deploy da API validado com `/health`.
- [ ] Deploy do frontend validado com build e pagina admin.

## Ordem Recomendada De Execucao

1. Fase 0: documentar mapa e simulador.
2. Fase 1: estado unificado.
3. Fase 2: catalogo de mensagens editaveis, router e fallbacks.
4. Fase 3: entrega/CEP.
5. Fase 4: busca/escolha de produto.
6. Fase 5: compra.
7. Fase 6: regras, IA e curadoria.
8. Fase 7: admin.
9. Fase 8: limpeza do legado.
10. Fase 9: limpeza final de arquivos.

## Politica De Publicacao

Para cada fase que altera servidor:

```powershell
node --check vps_server.js
node --check vps_server.cjs
node scripts\assert-no-supabase-runtime.cjs
node tmp-tests\autoresponder-core-scenarios.cjs
git push origin HEAD:main
node deploy-vps-server-only.cjs
curl.exe -i -s "https://api.xiaomipetrolina.com.br/health"
```

Para cada fase que altera admin:

```powershell
node scripts\assert-no-supabase-runtime.cjs
npm.cmd run build
git push origin HEAD:main
npm.cmd run deploy:vps-site
curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" "https://mercadodovale.com.br/"
```

## Riscos E Controles

- Risco: quebrar atendimento real.
  - Controle: `AUTORESPONDER_ENGINE_V2=1` ativo em producao, simulador validado contra API publicada e fallback legado mantido apenas como rollback ate uma rodada real de atendimento.
- Risco: divergencia entre `vps_server.js`, `vps_server.cjs` e `server.js`.
  - Controle: testes estaticos procurando os mesmos contratos nos arquivos relevantes.
- Risco: IA responder fora do escopo.
  - Controle: router coloca IA depois de fluxo, regra, intent e busca.
- Risco: regra manual perguntar algo sem estado.
  - Controle: campo `next_state` no admin e teste `autoresponder-rule-next-state-static`.
- Risco: schema da VPS divergir do codigo.
  - Controle: cenarios reais em `/autoresponder/test-flow` e consultas defensivas.
- Risco: reintroduzir dependencia operacional de Supabase ou Vercel.
  - Controle: Supabase/Vercel ficam marcados como legado no plano, build roda `scripts\assert-no-supabase-runtime.cjs`, e novas rotas/dados devem usar VPS/MySQL.
