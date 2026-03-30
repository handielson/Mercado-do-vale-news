---
name: n8n-workflows
description: Super-especialista em automação n8n para bots de atendimento. Nodes, triggers, AI agents, lógica condicional, error handling, credenciais, sessão/contexto e integração com APIs externas. Ativar quando construir ou modificar qualquer workflow n8n, especialmente para bots de WhatsApp.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# n8n Workflows — Automação e Bots de Atendimento

> **Versão de referência:** n8n 1.x (self-hosted ou cloud)
> **Stack alvo:** Evolution API + n8n + AI (OpenAI/Gemini) + WhatsApp

---

## 1. ARQUITETURA BÁSICA DE UM BOT n8n

### Fluxo Fundamental

```
[Webhook Trigger]           ← Recebe mensagem do WhatsApp via Evolution API
      ↓
[Normalizar Dados]          ← Extrai: sender, mensagem, mídia, timestamp
      ↓
[Verificar Sessão]          ← Carrega histórico do usuário (memória)
      ↓
[Lógica de Roteamento]      ← IF: bot ativo? horário comercial? keyword human?
      ↓
[AI Agent / Switch]         ← Processa com LLM ou roteamento por keyword
      ↓
[Salvar Sessão]             ← Persiste histórico atualizado
      ↓
[HTTP Request → Evolution]  ← Envia resposta de volta ao WhatsApp
```

### Tipos de Trigger para WhatsApp + Evolution API

```
OPÇÃO A — Webhook Trigger (mais comum com Evolution API):
  Node: "Webhook"
  Method: POST
  Path: /whatsapp-webhook
  Authentication: Header Auth (apikey do Evolution)

OPÇÃO B — n8n Community Node (n8n-nodes-evolution-api):
  Instalar via: Settings → Community Nodes → n8n-nodes-evolution-api
  Node: "Evolution API Trigger"
  Eventos disponíveis: messages.upsert, messages.update, chats.update, etc.

OPÇÃO C — WhatsApp Trigger nativo n8n (exige Meta/Cloud API):
  Eventos: Messages, Account Update, Message Template Status, etc.
  ⚠️ NÃO usar com Evolution API (requer Meta Business)
```

---

## 2. NODE TYPES ESSENCIAIS

### Core Nodes para Bot

| Node | Função | Quando usar |
|------|--------|-------------|
| **Webhook** | Recebe chamadas HTTP | Entry point do bot |
| **HTTP Request** | Chama APIs externas | Enviar msg via Evolution API |
| **IF** | Condicional simples | Branch de lógica |
| **Switch** | Multi-branch | Menu de opções |
| **Code** | JavaScript customizado | Lógica complexa |
| **Set** | Define variáveis | Normalizar dados |
| **Merge** | Une branches | Após decisões paralelas |
| **Wait** | Delay | Simular digitação |
| **Redis** | Cache rápido | Gerenciar sessão |
| **Postgres/MySQL** | DB persistente | Histórico longo prazo |

### AI/LLM Nodes (Cluster Nodes)

```
ESTRUTURA DE AI AGENT (obrigatória):
  Root Node: "AI Agent" ← coordena tudo
  Sub-nodes:
    - Chat Model: OpenAI / Google Gemini / Anthropic
    - Memory: Window Buffer / Redis / Postgres
    - Tools: HTTP Request tool, Code tool, etc.

CONFIGURAÇÃO DO AI AGENT:
  System Message: persona e regras do bot
  Chat Model: GPT-4o / Gemini 1.5 Pro (configurar temperatura 0.3-0.7)
  Memory: últimas N mensagens por usuário (chave = número do telefone)
  Tools: busca de produto, status de pedido, etc.
```

### Memory Nodes (contexto entre mensagens)

```
WINDOW BUFFER MEMORY:
  Node: "Window Buffer Memory"
  Session Key: {{ $json.sender }} ← chave única por usuário
  Context Window Length: 10 ← últimas 10 mensagens

POSTGRES CHAT MEMORY (persistente):
  Node: "Postgres Chat Memory"
  Session Key: {{ $json.sender }}
  Table Name: n8n_chat_histories

REDIS CHAT MEMORY (mais rápido):
  Node: "Redis Chat Memory"
  Session Key: {{ $json.sender }}
  TTL: 86400 (24h)
```

---

## 3. EXTRAÇÃO DE DADOS DO WEBHOOK (Evolution API)

### Payload típico do Evolution API (messages.upsert)

```javascript
// O que chega no Webhook Trigger do n8n:
{
  "event": "messages.upsert",
  "instance": "minha-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "MSG_ID_AQUI"
    },
    "message": {
      "conversation": "Olá, quero ver os produtos"
      // OU para outros tipos:
      // "audioMessage": {...}
      // "imageMessage": {...}
      // "documentMessage": {...}
      // "buttonsResponseMessage": { "selectedButtonId": "btn_1" }
      // "listResponseMessage": { "singleSelectReply": { "selectedRowId": "item_1" } }
    },
    "messageTimestamp": 1704067200,
    "pushName": "Nome do Cliente"
  }
}
```

### Node "Set" para normalizar dados

```javascript
// No node Set ou Code, extrair campos úteis:
{
  "sender": "={{ $json.data.key.remoteJid }}",
  "phone": "={{ $json.data.key.remoteJid.split('@')[0] }}",
  "fromMe": "={{ $json.data.key.fromMe }}",
  "messageText": "={{ $json.data.message.conversation || $json.data.message.extendedTextMessage?.text || '' }}",
  "messageType": "={{ Object.keys($json.data.message)[0] }}",
  "pushName": "={{ $json.data.pushName }}",
  "instanceName": "={{ $json.instance }}"
}
```

### Filtros Essenciais (evitar loops)

```javascript
// Node IF — filtrar mensagens próprias e grupos:
Condition 1: $json.data.key.fromMe === false  ← só mensagens recebidas
Condition 2: !$json.data.key.remoteJid.includes('@g.us')  ← só direct (não grupos)
Condition 3: $json.data.message !== undefined  ← tem mensagem válida
```

---

## 4. ENVIAR MENSAGENS VIA EVOLUTION API

### HTTP Request — Mensagem de Texto

```
URL: POST http://[SEU_EVOLUTION_HOST]:8080/message/sendText/[INSTANCE_NAME]
Headers:
  apikey: [SUA_API_KEY]
  Content-Type: application/json

Body (JSON):
{
  "number": "{{ $('Normalizar').item.json.phone }}",
  "options": {
    "delay": 1200,
    "presence": "composing"
  },
  "textMessage": {
    "text": "{{ $('AI Agent').item.json.output }}"
  }
}
```

### HTTP Request — Botões (Buttons)

```json
{
  "number": "5511999999999",
  "buttonMessage": {
    "title": "Olá! Como posso ajudar?",
    "description": "Escolha uma opção:",
    "buttons": [
      { "buttonId": "btn_produtos", "buttonText": { "displayText": "🛒 Ver Produtos" } },
      { "buttonId": "btn_pedido",   "buttonText": { "displayText": "📦 Meu Pedido" } },
      { "buttonId": "btn_humano",   "buttonText": { "displayText": "💬 Falar com Atendente" } }
    ],
    "footerText": "Mercado do Vale"
  }
}
```

### HTTP Request — Lista (List Message)

```json
{
  "number": "5511999999999",
  "listMessage": {
    "title": "Categorias de Produtos",
    "description": "Selecione o que procura:",
    "buttonText": "Ver Categorias",
    "footerText": "Mercado do Vale",
    "sections": [
      {
        "title": "📱 Eletrônicos",
        "rows": [
          { "rowId": "smart_iphone", "title": "iPhone", "description": "Apple iPhone" },
          { "rowId": "smart_samsung", "title": "Samsung", "description": "Galaxy Series" }
        ]
      },
      {
        "title": "💻 Notebooks",
        "rows": [
          { "rowId": "note_mac", "title": "MacBook", "description": "Apple MacBook" },
          { "rowId": "note_dell", "title": "Dell", "description": "Dell Notebooks" }
        ]
      }
    ]
  }
}
```

### HTTP Request — Imagem com Legenda

```json
{
  "number": "5511999999999",
  "mediaMessage": {
    "mediatype": "image",
    "caption": "📱 iPhone 13 128GB — R$1.899\nParcelamos em 12x sem juros!",
    "media": "https://url-da-imagem.com/iphone13.jpg"
  }
}
```

### Simular Digitação (Typing Indicator)

```
Antes de enviar a resposta, fazer:
POST /chat/presence/[INSTANCE]
Body: { "number": "5511999999999", "options": { "presence": "composing", "delay": 2000 } }

Depois: Wait node → 2000ms → então enviar mensagem
```

---

## 5. GERENCIAMENTO DE SESSÃO / CONTEXTO

### Estratégia com Redis (Recomendada)

```javascript
// LEITURA da sessão (no início do workflow):
// Node: Redis → GET
// Key: session:{{ $json.phone }}
// Parse JSON: true

// Estrutura do objeto de sessão:
{
  "state": "menu_principal",        // estado atual do fluxo
  "history": [...],                  // histórico de mensagens
  "name": "João",                    // nome coletado
  "lastActivity": 1704067200,        // timestamp último contato
  "humanMode": false,               // se está com agente humano
  "waitingFor": null                 // campo esperando resposta
}

// ESCRITA da sessão (no final do workflow):
// Node: Redis → SET
// Key: session:{{ $json.phone }}
// Value: {{ JSON.stringify($json.session) }}
// EX: 86400 (TTL 24h)
```

### Estratégia com Postgres (Para histórico longo)

```sql
-- Tabela de sessões:
CREATE TABLE whatsapp_sessions (
  phone VARCHAR(20) PRIMARY KEY,
  state VARCHAR(50) DEFAULT 'menu',
  name VARCHAR(100),
  human_mode BOOLEAN DEFAULT false,
  last_activity TIMESTAMP DEFAULT NOW(),
  context JSONB DEFAULT '{}'
);

-- Tabela de histórico de mensagens:
CREATE TABLE whatsapp_messages (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20),
  role VARCHAR(10), -- 'user' ou 'assistant'
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index para performance:
CREATE INDEX idx_messages_phone ON whatsapp_messages(phone);
CREATE INDEX idx_messages_created ON whatsapp_messages(created_at);
```

---

## 6. LÓGICA DE ROTEAMENTO (Switch / IF)

### Padrão de Menu por Keyword

```javascript
// Node: Switch → baseado em $json.messageText.toLowerCase()

Regra 1: $json.messageText.toLowerCase().includes('pedido')    → Branch: Status Pedido
Regra 2: $json.messageText.toLowerCase().includes('produto')   → Branch: Ver Produtos
Regra 3: $json.messageText.toLowerCase().includes('humano') || 
          $json.messageText.toLowerCase().includes('atendente') → Branch: Human Handoff
Regra 4: $json.messageText === '0' || 
          $json.messageText.toLowerCase() === 'menu'           → Branch: Menu Principal
Default: → Branch: AI Agent (resposta livre)
```

### Human Handoff Pattern

```javascript
// Ativar modo humano:
// 1. Usuário digita "atendente" ou "humano"
// 2. Bot responde "Transferindo para atendente..."
// 3. Salvar humanMode: true na sessão
// 4. Notificar equipe (Telegram, email, ou painel interno)

// Enquanto humanMode = true:
// - Não processar com AI
// - Repassar mensagem para painel do atendente
// - Só reativar bot quando atendente digitar /bot ou /bot_on

// Notificação para equipe (Telegram):
POST https://api.telegram.org/bot[TOKEN]/sendMessage
{
  "chat_id": "[CHAT_ID_EQUIPE]",
  "text": "🔔 Cliente aguardando atendimento!\nNome: {{ $json.pushName }}\nTelefone: {{ $json.phone }}\nÚltima mensagem: {{ $json.messageText }}"
}
```

---

## 7. AI AGENT — CONFIGURAÇÃO COMPLETA

### System Prompt para Bot de E-commerce

```
Você é [NOME_DO_BOT], assistente virtual do [NOME_DA_LOJA].

PERSONALIDADE:
- Tom: amigável, objetivo e profissional
- Resposta: curta (máx 3 parágrafos no WhatsApp)
- Emoji: usar com moderação (1-2 por mensagem)
- Sempre em português brasileiro

VOCÊ PODE:
- Informar sobre produtos e preços
- Consultar status de pedidos
- Tirar dúvidas sobre pagamento e entrega
- Apresentar promoções ativas

VOCÊ NÃO PODE:
- Alterar pedidos (encaminhar para humano)
- Processar devoluções sem aprovação humana
- Confirmar informações que não tem certeza

QUANDO TRANSFERIR PARA HUMANO:
- Cliente pede atendente/humano
- Reclamação ou problema crítico
- Pedido de reembolso/cancelamento
- Dúvida que você não consegue resolver

FORMATO DE RESPOSTA:
- Sem markdown (WhatsApp não renderiza)
- Use *negrito* apenas para destacar preços
- Linhas curtas, mensagem escaneável
```

### Tools para o AI Agent

```javascript
// Tool 1: buscar_produto
// Descrição: "Busca produtos por nome, categoria ou modelo"
// Input: { query: string }
// Action: HTTP Request → GET /api/products?search={query}

// Tool 2: status_pedido
// Descrição: "Verifica status de um pedido pelo número ou CPF"
// Input: { orderIdOrCpf: string }
// Action: HTTP Request → GET /api/orders/{id}

// Tool 3: listar_categorias
// Descrição: "Lista todas as categorias disponíveis"
// Action: HTTP Request → GET /api/categories

// Tool 4: transferir_humano
// Descrição: "Transfere o atendimento para um agente humano"
// Action: Set humanMode = true + notificar equipe
```

---

## 8. ERROR HANDLING

### Node de Erro Global

```javascript
// Em todo workflow, ativar: Settings → Error Workflow
// Criar workflow separado "Error Handler":

// Recebe: $json.workflow + $json.execution + $json.error

// Ações:
1. Log no banco (tabela: n8n_errors)
2. Notificar equipe (Telegram/email)
3. Enviar mensagem fallback ao usuário:
   "Desculpe, ocorreu um erro. Nossa equipe foi notificada. 
    Digite *menu* para recomeçar ou aguarde nosso retorno."
```

### Try/Catch em Code Node

```javascript
try {
  const session = JSON.parse($input.item.json.sessionData || '{}');
  // lógica principal
  return [{ json: { success: true, session } }];
} catch(error) {
  return [{ json: { 
    success: false, 
    error: error.message,
    fallback: true 
  }}];
}
```

### Retry em HTTP Request

```
HTTP Request Node Settings:
  Retry On Fail: true
  Max Tries: 3
  Wait Between Tries: 1000ms
```

---

## 9. BOAS PRÁTICAS n8n

### Performance

```
✅ Ativar "Execute Once" nos nodes Set/Code quando possível
✅ Usar "Split in Batches" para processar múltiplas msgs
✅ Limitar context window do AI (máx 20 msgs para não estourar tokens)
✅ Cache de produtos no Redis (TTL 5 min) — não chamar API a cada msg
✅ Usar "Respond to Webhook" node para responder IMEDIATAMENTE (< 5s)
   e processar o AI em background
```

### Segurança

```
✅ Validar apikey do Evolution no header de cada webhook
✅ Whitelist de IPs do servidor Evolution no webhook
✅ Não logar dados sensíveis (CPF, cartão) em execuções
✅ Usar n8n Credentials para apikeys (nunca hardcode)
✅ Rate limiting: ignorar msgs < 1s de diferença (anti-flood)
```

### Debug

```
✅ Ativar "Save Manual Executions" durante desenvolvimento
✅ Usar "Pin Data" para testar com payload real sem enviar no WhatsApp
✅ Sempre testar com número de teste antes de produção
✅ Usar webhook.site para inspecionar payloads
```

---

## 10. WORKFLOW TEMPLATES COMUNS

### Template: Bot Simples com AI

```
[Webhook] → [Filtrar fromMe/grupos] → [Normalizar] → 
[Redis GET sessão] → [AI Agent + Memory] → 
[Redis SET sessão] → [HTTP POST Evolution sendText]
```

### Template: Menu + AI Fallback

```
[Webhook] → [Normalizar] → [Switch: keywords] →
  ├─ "menu" → [Enviar Menu Botões]
  ├─ "pedido" → [HTTP: buscar pedido] → [Formatar] → [Enviar]
  ├─ "humano" → [Set humanMode] → [Notificar equipe] → [Enviar confirmação]
  └─ default → [AI Agent] → [Enviar resposta]
```

### Template: Horário Comercial

```
[Webhook] → [Normalizar] → [Code: verificar horário] →
  ├─ Dentro do horário (8h-18h seg-sex) → [Workflow Bot Normal]
  └─ Fora do horário → [Enviar mensagem horário] → [Encerrar]
```

---

## Related Skills

| Skill | Quando Usar |
|-------|------------|
| `whatsapp-bot-evolution` | Detalhes específicos da Evolution API |
| `conversational-design` | Design dos fluxos de conversa |
| `nodejs-best-practices` | Código JavaScript nos Code nodes |
