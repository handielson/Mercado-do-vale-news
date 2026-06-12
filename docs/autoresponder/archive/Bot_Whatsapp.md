# Bot WhatsApp — Atendimento Automático

Webhook integrado com o app **AutoResponder for WA Pro** (TK Studio / autoresponder.ai) para responder clientes automaticamente com produtos, preços, parcelamento e estoque sempre atualizados a partir do banco do Mercado do Vale.

---

## Sumário

- [Objetivo](#objetivo)
- [Stack e infraestrutura](#stack-e-infraestrutura)
- [Decisões consolidadas](#decisões-consolidadas)
- [Decisões atuais para IA e atendimento](#decisões-atuais-para-ia-e-atendimento)
- [Arquitetura](#arquitetura)
- [Fluxo do webhook (16 passos)](#fluxo-do-webhook-16-passos)
- [Schema do banco (6 tabelas)](#schema-do-banco-6-tabelas)
- [Mensagens e formatos](#mensagens-e-formatos)
- [Página admin](#página-admin)
- [Configuração do app AutoResponder Pro](#configuração-do-app-autoresponder-pro)
- [Endpoints na VPS](#endpoints-na-vps)
- [Storage Synology](#storage-synology)
- [Plano de implementação em fases](#plano-de-implementação-em-fases)
- [Checklist de implementação](#checklist-de-implementação)
- [Checklist de implantação das novas decisões](#checklist-de-implantação-das-novas-decisões)
- [Diário de implantação](#diário-de-implantação)
- [Pendências abertas](#pendências-abertas)

---

## Objetivo

Quando cliente perguntar algo no WhatsApp da loja (ex.: *"tem capa para note 14"*), o bot:

1. Consulta o estoque, preço e parcelamento em tempo real direto do banco da VPS
2. Responde com produtos encontrados, agrupando variações (cores) por modelo
3. Envia foto do top 1 resultado, demais com link
4. Se não souber, oferece transferência para atendente humano (com aviso de horário se for fora do expediente)
5. Bot fica em silêncio para grupos, números bloqueados, conversas pausadas

---

## Stack e infraestrutura

| Componente | Detalhes |
|---|---|
| App de WhatsApp | AutoResponder for WA Pro (Android, TK Studio) |
| Backend webhook | VPS Hostinger Fastify — `https://api.xiaomipetrolina.com.br` |
| Banco principal | MySQL local na VPS (mesma do `mdv-api` PM2) |
| Banco auxiliar | Supabase (`company_settings`, dados do app) |
| Storage de anexos de regras | Synology — `https://dsm-api.xiaomipetrolina.com.br` (Cloudflare Tunnel) |
| Storage de imagens dos produtos | Supabase Storage (sem mudança) |
| Histórico longo de logs | Synology — `/volume1/backups/autoresponder/YYYY/MM/DD.json.gz` |
| URL do webhook | `https://api.xiaomipetrolina.com.br/autoresponder-webhook` |
| Cron diário | 03:00 BRT (archive de logs > 7 dias para Synology) |

**Reuso de código existente:**
- `services/installmentCalculator.ts` → cálculo de parcelas até 12x via `payment_fees`
- `utils/storeStatus.ts` → portado para CommonJS na VPS, com cache 60s
- `utils/whatsappMessageGenerator.ts` → padrão visual das mensagens (espelha orçamento)
- `pages/admin/settings/CompanyDataPage.tsx` → horários de funcionamento já gerenciáveis em `/admin/settings/company`
- `vps_server.cjs` → padrão Fastify estabelecido (~80 rotas existentes)

---

## Decisões consolidadas

| Tema | Decisão |
|---|---|
| **Hosting** | VPS Fastify (sem cold start, baixa latência) |
| **App** | AutoResponder Pro confirmado |
| **URL pública** | `https://api.xiaomipetrolina.com.br/autoresponder-webhook` |
| **Autenticação** | Header `X-Autoresponder-Token: <AUTORESPONDER_TOKEN>` |
| **Grupos** | Bot ignora — filtro no app + validação no webhook |
| **Saudações** | Resposta padrão prefixa o resultado, configurada pelo admin |
| **Preço com variação** | `de R$ X a R$ Y (PIX)` se variar; `R$ X (PIX)` se único |
| **Parcelamento** | Até 12x sem juros, mostrando "12x de R$ Y" |
| **Imagens** | Desativadas na integração inicial com celular; resposta mantém texto/link e pode reativar depois |
| **Compressão de imagem** | Desnecessária (já comprimidas no banco) |
| **Botões nativos** | Não — AutoResponder não suporta. Lista numerada como substituto. |
| **Bloqueio de números** | Tabela `autoresponder_blocklist` (exact / prefix / regex) |
| **Tags** | Sistema unificado com escopo (regra / conversa / produto) |
| **Mapeamento palavra → tag** | Seed inicial + admin pode editar (ex.: "promoção" → tag `Promoção`) |
| **Atendimento humano** | Sempre que pede, transfere com mensagem variando por horário |
| **Horário de funcionamento** | Reuso de `company_settings.business_hours` do Supabase |
| **Bot fora do horário** | **Bot responde sempre, 24/7**. Horário só afeta a mensagem de transferência humana. |
| **Auto-pausa por fallbacks** | Configurável (default: 3 fallbacks → 30 min) |
| **Pausa por solicitação humana** | Configurável (default: 60 min) |
| **Histórico de logs** | 7 dias na VPS, depois Synology em arquivos diários `.json.gz` |
| **Página admin** | `/admin/atendimento-automatico` com 8 abas |
| **Permissão** | Todo admin vê |
| **Multi-canal futuro** | Mesmo webhook serve Instagram/Messenger se quiser depois |

---

## Decisões atuais para IA e atendimento

Estas decisões guiam a próxima evolução do atendimento automático. O objetivo é crescer sem transformar o AutoResponder em uma tela única difícil de manter.

| Tema | Decisão |
|---|---|
| **Papel do AutoResponder** | Continua sendo o motor principal: recebe mensagem, identifica intenção, busca dados oficiais, aplica regras, pausa/retoma conversa e envia resposta. |
| **Papel do ChatGPT** | Atua como camada inteligente apenas quando o sistema enviar contexto oficial. Não substitui regras, catálogo, preços, estoque, garantia ou parcelamento calculado pelo backend. |
| **Fonte de verdade** | Produtos, preços, estoque, variações, cores, parcelamento, garantia e links vêm do sistema/VPS. O ChatGPT fica proibido de inventar dados. |
| **Infraestrutura nova** | Tudo que for criado para IA, treinamento e central de atendimento deve ficar na VPS ou Synology. Nada novo deve depender de Supabase ou Vercel. |
| **Migração de dependências antigas** | Ao encontrar algo do AutoResponder/WhatsApp/IA ligado a Supabase ou Vercel, registrar no checklist e migrar para VPS/Synology como parte do trabalho, sem deixar para depois. |
| **Chave OpenAI** | `OPENAI_API_KEY` pode ser alterada pelo painel do sistema, fica salva na VPS, não é exibida novamente e aparece apenas como status/máscara. |
| **Treinamento IA** | Criar área para ensinar tom, regras, políticas, exemplos de respostas e limites do ChatGPT. Treinamento é configuração do robô, não atendimento diário. |
| **Central de Atendimento** | Criar página separada no menu, idealmente `WhatsApp > Central de Atendimento`, para operação diária da equipe. |
| **Pausa do bot** | Quando um atendente assumir ou responder manualmente, o bot deve pausar a conversa. Deve existir botão para `Pausar bot` e `Retomar bot`. |
| **Escalabilidade de telas** | AutoResponder fica para automação/configuração. Central de Atendimento fica para mensagens e operação. Treinamento IA pode começar dentro do AutoResponder e virar página própria se crescer. |

### Fluxo alvo com IA

```text
Cliente no WhatsApp
  -> AutoResponder Pro
  -> Webhook VPS
  -> AutoResponder identifica intenção
  -> Busca dados oficiais na VPS/Sistema
  -> Se necessário, chama ChatGPT com contexto restrito
  -> AutoResponder formata e envia resposta
```

Regras importantes:

1. ChatGPT não consulta livremente a internet nem inventa produtos.
2. ChatGPT só responde usando o contexto enviado pelo backend.
3. Se não houver dados suficientes, deve fazer pergunta curta para entender a necessidade do cliente ou encaminhar para humano.
4. Respostas de produto devem manter o padrão com variações, cores disponíveis, preço à vista, parcelamento máximo em 12x, garantia e link quando aplicável.

---

## Arquitetura

```
┌──────────────────────┐
│  Cliente WhatsApp    │
└────────┬─────────────┘
         │ "tem capa note 14?"
         ▼
┌──────────────────────┐
│ App AutoResponder    │ (Android, no celular da loja)
│ (TK Studio Pro)      │
└────────┬─────────────┘
         │ POST com JSON
         │ + X-Autoresponder-Token
         ▼
┌──────────────────────────────────────────┐
│   VPS Fastify (api.xiaomipetrolina.com.br)│
│   POST /autoresponder-webhook            │
│   ┌──────────────────────────────────┐   │
│   │ 16 passos do fluxo               │   │
│   └──────┬─────────────────┬─────────┘   │
└──────────┼─────────────────┼─────────────┘
           │                 │
           ▼                 ▼
┌──────────────────┐  ┌────────────────┐
│  MySQL local VPS │  │   Supabase     │
│  - autoresponder │  │   - company    │
│    _settings     │  │     _settings  │
│  - rules         │  │     (horários) │
│  - tags          │  │   - storage    │
│  - logs (7d)     │  │     (imagens)  │
│  - conversations │  └────────────────┘
│  - blocklist     │
│  - products      │ (com nova coluna tag_ids)
│  - payment_fees  │
└──────────────────┘
           │
           │ cron diário 03:00 BRT
           ▼
┌──────────────────────────────────────────┐
│ Synology NAS                             │
│ /volume1/backups/autoresponder/          │
│   YYYY/MM/DD.json.gz                     │
│ /volume1/web/autoresponder/              │
│   anexos-de-regras.jpg (públicos)        │
└──────────────────────────────────────────┘
```

---

## Fluxo do webhook (16 passos)

```
[1]  Token X-Autoresponder-Token válido?              → 401 se não
[2]  Bot habilitado em settings.enabled?              → silêncio se desabilitado
[3]  Sender em autoresponder_blocklist?               → silêncio absoluto (não loga)
[4]  É grupo (isGroup=true do payload)?               → silêncio
[5]  Conversa pausada (paused_until > NOW)?           → silêncio + atualiza last_message_at
[6]  Atingiu max_replies_per_conversation?            → silêncio
[7]  Detecta "atendente humano"?
       ├─ getCachedStoreStatus() in {open, closing_soon}
       │    → settings.human_message_in_hours
       └─ status in {closed, holiday}
            → settings.human_message_out_of_hours
       → pausa human_pause_minutes
       → tag "Aguardando resposta"
       → retorna
[8]  Detecta saudação (oi/bom dia/...)?               → flag para prefixar resposta
[9]  Match em autoresponder_rules ativas (priority desc):
       ├─ reply_type='text'              → resposta + attachment opcional
       ├─ reply_type='product_by_tag'    → produtos com a tag configurada
       └─ reply_type='product_search'    → busca configurada na regra
       → incrementa rules.hits
       → aplica auto_apply_tag_id na conversa (se tiver)
       → retorna
[10] Detecta palavra-chave de tag de produto (promoção/novidade/etc)?
       → query produtos com aquela tag
       → retorna
[11] Cliente respondeu apenas "1", "2", "3" e tem last_options_offered válido?
       → recupera produto da posição escolhida
       → resposta com detalhe + imagem + link
       → retorna
[12] Busca de produtos por tokens (AND, removendo stopwords)
       → agrupa por model_id, coleta cores únicas
       → calcula parcelamento até 12x via payment_fees
       → top 1 com imagem + caption, demais em lista compacta
       → se >2 produtos, salva last_options_offered (lista numerada)
[13] Sem produtos encontrados → fallback educado
       → incrementa consecutive_fallbacks
       → se >= settings.auto_pause_fallback_threshold:
           pausa por settings.auto_pause_fallback_minutes + msg "vou chamar atendente"
[14] Monta replies[] final (prefixa saudação se flag do passo 8)
[15] Loga em autoresponder_logs (com matched_rule_id, matched_products, intent)
[16] Upsert autoresponder_conversations (last_bot_reply_at, total_messages, reset/incrementa fallback_count)
       → retorna { replies: [...] }
```

---

## Schema do banco (6 tabelas)

### 1. `autoresponder_settings` (singleton — 1 linha)

```sql
CREATE TABLE autoresponder_settings (
  id INT PRIMARY KEY DEFAULT 1,
  enabled TINYINT(1) DEFAULT 1,

  -- Atendimento humano (2 mensagens, varia por horário)
  human_message_in_hours TEXT,
  human_message_out_of_hours TEXT,
  human_pause_minutes INT DEFAULT 60,

  -- Auto-pausa por fallbacks
  auto_pause_fallback_threshold INT DEFAULT 3,
  auto_pause_fallback_minutes INT DEFAULT 30,
  auto_pause_fallback_message TEXT,

  -- Limites
  max_replies_per_conversation INT DEFAULT 20,
  max_replies_window_hours INT DEFAULT 24,

  -- Saudação
  greeting_prefix TEXT DEFAULT 'Olá! 👋',

  -- Fallback
  fallback_message TEXT,

  -- Assinatura virtual
  signature_enabled TINYINT(1) DEFAULT 1,
  signature_message TEXT,

  -- Imagens
  send_product_images TINYINT(1) DEFAULT 1,
  max_images_per_response INT DEFAULT 1,

  -- Listas numeradas
  use_numbered_lists TINYINT(1) DEFAULT 1,
  numbered_list_threshold INT DEFAULT 2,
  numbered_list_validity_minutes INT DEFAULT 30,

  -- Mapeamento palavra → tag de produto (JSON)
  product_tag_keywords JSON DEFAULT '{}',

  -- Storage
  archive_to_synology TINYINT(1) DEFAULT 1,
  archive_after_days INT DEFAULT 7,

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT singleton CHECK (id = 1)
);
```

### 2. `autoresponder_rules`

```sql
CREATE TABLE autoresponder_rules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  match_type ENUM('any_keyword','all_keywords','regex','exact') DEFAULT 'any_keyword',
  pattern TEXT NOT NULL,
  reply_type ENUM('text','product_by_tag','product_search') DEFAULT 'text',
  reply_text TEXT,
  reply_tag_id INT NULL,
  reply_search_query VARCHAR(255) NULL,
  attachment_url VARCHAR(500) NULL,
  attachment_caption TEXT NULL,
  auto_apply_tag_id INT NULL,
  tag_ids JSON DEFAULT '[]',
  priority INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  hits INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active_priority (active, priority DESC)
);
```

### 3. `autoresponder_tags`

```sql
CREATE TABLE autoresponder_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6b7280',
  description VARCHAR(200),
  scopes SET('rule','conversation','product') NOT NULL,
  show_on_bot TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. `autoresponder_logs`

```sql
CREATE TABLE autoresponder_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sender VARCHAR(30),
  question TEXT,
  intent VARCHAR(20),
  matched_rule_id BIGINT NULL,
  matched_products JSON NULL,
  matched_count INT DEFAULT 0,
  reply_text TEXT,
  response_time_ms INT,
  is_group TINYINT(1) DEFAULT 0,
  INDEX idx_created (created_at),
  INDEX idx_unmatched (matched_count, created_at)
);
```

### 5. `autoresponder_conversations`

```sql
CREATE TABLE autoresponder_conversations (
  sender VARCHAR(30) PRIMARY KEY,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_bot_reply_at DATETIME NULL,
  paused_until DATETIME NULL,
  pause_reason VARCHAR(50) NULL,
  paused_by_user_id INT NULL,
  consecutive_fallbacks INT DEFAULT 0,
  total_messages INT DEFAULT 0,
  tag_ids JSON DEFAULT '[]',
  last_options_offered JSON NULL,
  last_options_at DATETIME NULL,
  INDEX idx_paused (paused_until)
);
```

### 6. `autoresponder_blocklist`

```sql
CREATE TABLE autoresponder_blocklist (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pattern VARCHAR(100) NOT NULL,
  pattern_type ENUM('exact','prefix','regex') DEFAULT 'exact',
  contact_name VARCHAR(255),
  reason TEXT,
  active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id INT,
  INDEX idx_active (active)
);
```

### ALTER em `products`

```sql
ALTER TABLE products ADD COLUMN tag_ids JSON DEFAULT '[]';
ALTER TABLE products ADD INDEX idx_tag_ids ((CAST(tag_ids AS UNSIGNED ARRAY)));
```

---

## Mensagens e formatos

### Resposta do bot — busca de produto encontrado

```
Olá! 👋

*📱 Encontrei para você!*

[FOTO + caption do top 1]
 *Capa Anti-Impacto Redmi Note 14*  🔴 PROMOÇÃO
Cores disponíveis: Preto, Azul, Transparente
💰 De R$ 39,90 por R$ 29,90 (PIX)
💳 Em até 12x de R$ 2,89
🔗 https://mercadodovale.com.br/produto/capa-antiimpacto-redmi-note-14

*Outras opções:*
2️⃣ Capa Silicone Redmi Note 14 — de R$ 19,90 a R$ 24,90 (PIX)
   🔗 https://mercadodovale.com.br/produto/capa-silicone-redmi-note-14
3️⃣ Capa Transparente Redmi Note 14 — R$ 14,90 (PIX)
   🔗 https://mercadodovale.com.br/produto/capa-transparente-redmi-note-14

Responda com o número (2 ou 3) para mais detalhes.

---
_Mercado do Vale_
```

### Resposta do bot — fallback

```
😕 Não encontrei "X" no nosso estoque agora.

Pode me dizer o modelo exato? Ex: Redmi Note 14, Galaxy A14...
Ou veja todo nosso catálogo: https://mercadodovale.com.br
```

### Atendente humano — dentro do horário (default editável)

```
🙋 Transferindo para um especialista, por favor aguarde.
```

### Atendente humano — fora do horário (default editável)

```
🙋 Transferindo para um especialista.

⚠️ Mas atenção: no momento estamos *fora do horário de atendimento humanizado*, então a resposta pode demorar mais. Sua mensagem foi registrada e te respondemos assim que possível! 😊
```

---

## Página admin

**Rota:** `/admin/atendimento-automatico`
**Arquivo:** `pages/admin/AutoResponderPage.tsx`
**Acesso:** Todo admin (mesmo padrão de Cashback, Coupons, Promotions)
**Item no menu:** adicionado em [layouts/AdminLayout.tsx](layouts/AdminLayout.tsx)

### 8 Abas

| Aba | Função |
|---|---|
| **Respostas** | CRUD de `autoresponder_rules` + filtro por tag + upload de imagem (anexo Synology) + templates pré-cadastrados |
| **Conversas** | Lista ativas/pausadas, filtro por tag, ações: pausar (1h/4h/24h/indefinido), liberar, atribuir tag, bloquear |
| **Bloqueados** | CRUD de `autoresponder_blocklist` + import em massa (cole lista de números) |
| **Curadoria** | Perguntas sem resposta agrupadas por frequência, botão "Criar resposta" (auto-aprendizado supervisionado) |
| **Tags** | CRUD de `autoresponder_tags` por escopo (rule / conversation / product) |
| **Estatísticas** | KPIs (msgs hoje/semana/mês, taxa resposta, top produtos, top regras), `?source=synology` para histórico antigo |
| **Testes** | Simula respostas pela API da VPS sem enviar WhatsApp real, permite editar o retorno e salvar como regra |
| **Configurações** | Settings completas: mensagens, durações, limites, mapeamento palavra→tag, link para `/admin/settings/company` (horários) |

### Template de regras pré-cadastradas (~22 itens, palavras-chave prontas, resposta vazia)

| Template | Palavras-chave |
|---|---|
| Saudação manhã | bom dia, oi bom dia, dia |
| Saudação tarde | boa tarde, tarde |
| Saudação noite | boa noite, noite |
| Saudação genérica | oi, olá, ola, e aí, eai, opa, eae |
| Despedida | tchau, obrigado, obrigada, valeu, vlw, agradecido, brigado |
| Endereço/localização | onde, endereço, endereco, localização, localizacao, fica, ficam, lugar, mapa, maps |
| Horário de funcionamento | horário, horario, abre, fecha, funcionamento, hora, aberto, fechado |
| Estacionamento | estacionamento, vaga, estacionar, carro |
| Entrega/frete | entrega, frete, delivery, mandar, enviar, entregar, motoboy |
| Formas de pagamento | pagamento, pago, pix, cartão, cartao, parcela, parcelar, dinheiro, boleto, débito, debito |
| Desconto à vista / PIX | desconto, à vista, avista, pix, dinheiro, abate |
| Nota fiscal | nota fiscal, nf, cupom, fiscal, sefaz, recibo |
| Garantia | garantia, prazo, defeito, problema, queimou, parou |
| Troca/devolução | troca, trocar, devolução, devolucao, devolver, arrependimento |
| Assistência técnica | assistência, assistencia, conserto, consertar, técnico, tecnico, reparo, manutenção |
| Troca de tela / película | tela, película, pelicula, trocar tela, quebrou, rachou |
| Desbloqueio | desbloqueio, desbloquear, conta google, mi account, icloud, frp |
| Aceita usado/seminovo | usado, seminovo, semi novo, troca por outro, dou de entrada, valor do meu |
| Catálogo / produtos | catálogo, catalogo, produtos, lista, vocês têm, voces tem, o que vendem |
| Promoções/ofertas | promoção, promocao, oferta, ofertinha, desconto, barato, baratinho |
| **Falar com humano** ⭐ | humano, atendente, pessoa, real, falar com alguém, especialista, vendedor, gerente |
| Fallback (auto) | sistema usa quando nada bate |

⭐ Única que vem com **resposta pré-preenchida e ativa**.

### Tags pré-cadastradas (seed)

**Compartilhadas (rule + conversation + product):**
- Promoção (#ef4444)
- Novidade (#10b981)

**Só regras:**
- Saudação (#3b82f6)
- Informações (#10b981)
- Venda (#a855f7)
- Pós-venda (#f97316)
- Atendimento (#dc2626)

**Só conversas:**
- Lead quente (#22c55e)
- Aguardando resposta (#eab308)
- VIP (#a855f7)
- Reclamação (#f97316)
- Fornecedor (#3b82f6)
- Sem interesse (#71717a)

**Só produtos:**
- Queima de estoque (#dc2626)
- Destaque (#facc15)
- Outlet (#a855f7)
- Lançamento (#3b82f6)
- Mais vendido (#22c55e)

---

## Configuração do app AutoResponder Pro

No celular onde o WhatsApp da loja roda:

| Campo | Valor |
|---|---|
| Tipo de regra | Web request (Pro) |
| URL | `https://api.xiaomipetrolina.com.br/autoresponder-webhook` |
| Method | POST |
| Headers | `X-Autoresponder-Token: <AUTORESPONDER_TOKEN>` |
| Content-Type | `application/json` |
| Body | `{"message":"%message%","sender":"%sender%","senderName":"%senderName%","isGroup":"%isGroup%","group":"%group%"}` |
| Use response as reply | ✅ Marcar |
| Reply in groups | ❌ Desmarcar |
| Don't reply if I have answered manually | ✅ Marcar |
| Reply only X times per conversation | ✅ Configurar (sugerido: 5 em 60min) |
| Don't reply within X seconds of sending | ✅ 30s |
| Pattern | `*` (responde tudo, roteamento é no webhook) |

---

## Endpoints na VPS

Todos em [vps_server.cjs](vps_server.cjs), seguindo padrão das ~80 rotas existentes.

```
# Webhook público (token-protected)
POST   /autoresponder-webhook                          token

# Settings
GET    /autoresponder/settings                         requireSyncKey
PATCH  /autoresponder/settings                         requireSyncKey

# Rules + upload de anexo
GET    /autoresponder/rules                            requireSyncKey
POST   /autoresponder/rules                            requireSyncKey
PATCH  /autoresponder/rules/:id                        requireSyncKey
DELETE /autoresponder/rules/:id                        requireSyncKey
POST   /autoresponder/rules/from-question              requireSyncKey
POST   /autoresponder/upload-attachment                requireSyncKey  (Fase 3N: tenta Synology e faz fallback local)
POST   /autoresponder/test-reply                       requireSyncKey  (simula resposta sem enviar WhatsApp real)

# Tags
GET    /autoresponder/tags                             requireSyncKey
POST   /autoresponder/tags                             requireSyncKey
PATCH  /autoresponder/tags/:id                         requireSyncKey
DELETE /autoresponder/tags/:id                         requireSyncKey

# Conversations
GET    /autoresponder/conversations                    requireSyncKey
POST   /autoresponder/conversations/:sender/pause      requireSyncKey
POST   /autoresponder/conversations/:sender/resume     requireSyncKey
POST   /autoresponder/conversations/:sender/tags       requireSyncKey

# Blocklist
GET    /autoresponder/blocklist                        requireSyncKey
POST   /autoresponder/blocklist                        requireSyncKey
POST   /autoresponder/blocklist/bulk                   requireSyncKey
DELETE /autoresponder/blocklist/:id                    requireSyncKey

# Curadoria + Stats
GET    /autoresponder/unanswered                       requireSyncKey
DELETE /autoresponder/unanswered?question=...          requireSyncKey
GET    /autoresponder/stats?source=mysql|synology      requireSyncKey

# Status atual da loja (preview live na UI)
GET    /autoresponder/store-status                     requireSyncKey

# Tags em produtos (extensão)
PATCH  /products/:id/tags                              requireSyncKey
```

---

## Storage Synology

### Histórico de logs (cold storage)

Cron diário às 03:00 BRT na VPS:

```
1. Exporta autoresponder_logs do dia anterior como JSON
2. gzip → /tmp/autoresponder-YYYY-MM-DD.json.gz
3. SCP para Synology: /volume1/backups/autoresponder/YYYY/MM/DD.json.gz
4. Verifica checksum
5. Se OK, DELETE FROM autoresponder_logs WHERE created_at < (NOW() - INTERVAL settings.archive_after_days DAY)
```

Reaproveita o pattern de [backup-synology.cjs](backup-synology.cjs).

### Anexos de regras (servidos publicamente)

```
/volume1/web/autoresponder/
  endereco-fachada.jpg
  catalogo-maio-2026.jpg
  promocao-dia-das-maes.jpg
```

URL pública via Cloudflare Tunnel:
`https://dsm-api.xiaomipetrolina.com.br/autoresponder/<arquivo>`

Upload pela aba Respostas → endpoint `POST /autoresponder/upload-attachment` tenta enviar para o Synology na pasta pública de imagens. Se credenciais/túnel falharem, mantém fallback local em `uploads/autoresponder/attachments` para não quebrar o admin.

---

## Plano de implementação em fases

### Fase 1 — Backend webhook + DB (entregável standalone)

Backend funcional rodando na VPS. Já dá pra testar mandando mensagem real no WhatsApp e receber resposta com produto + imagem. Sem UI ainda — gerenciamento de regras é via SQL direto no MySQL.

### Fase 2 — Endpoints admin

Todos os endpoints CRUD prontos. Service `services/autoResponderService.ts` para o frontend consumir.

### Fase 3 — Página admin (8 abas)

`pages/admin/AutoResponderPage.tsx` completa com 8 abas. Componentes: TagPicker, ConversationCard, BlockNumberModal, AttachmentUpload. Integração TagPicker na edição de produtos.

### Fase 4 — Refinamentos

WebSocket em tempo real na aba Conversas, sugestão automática de keywords ao curar perguntas, suporte a Instagram/Messenger no mesmo webhook.

---

## Checklist de implementação

### Pré-requisitos

- [x] Confirmar estratégia do token secreto: gerar valor fora do código e configurar como `AUTORESPONDER_TOKEN` no `.env` da VPS.
- [x] Confirmar `company_id` do MDV: AutoResponder segue single-tenant/hardcoded para Mercado do Vale nesta fase; multi-tenant fica como evolução futura.
- [x] Confirmar comportamento default da auto-pausa (3 fallbacks → 30 min)
- [x] Confirmar pausa default por solicitação humana (60 min)
- [x] Validar texto da mensagem `human_message_in_hours` e `human_message_out_of_hours`
- [x] Confirmar mensagem default de fallback
- [x] Confirmar prefixo de saudação (`Olá! 👋`)

### Fase 1 — Backend webhook + DB

#### Banco MySQL na VPS

- [x] Criar tabela `autoresponder_settings` + INSERT da linha singleton com defaults
- [x] Criar tabela `autoresponder_rules`
- [x] Criar tabela `autoresponder_tags`
- [x] Criar tabela `autoresponder_logs` (com índices)
- [x] Criar tabela `autoresponder_conversations`
- [x] Criar tabela `autoresponder_blocklist`
- [x] ALTER `products` adicionando `tag_ids JSON DEFAULT '[]'` + índice
- [x] Seed: 22 templates de regras (21 inativas + 1 "Falar com humano" ativa)
- [x] Seed: tags pré-cadastradas (compartilhadas + por escopo)
- [x] Seed: mapeamento palavra→tag de produto em `autoresponder_settings.product_tag_keywords`

#### Helper de horário

- [x] Portar lógica de horário para o webhook da VPS usando [utils/storeStatus.ts](utils/storeStatus.ts) como referência
- [x] Implementar `getCachedStoreStatus()` com cache em memória de 60s
- [x] Ler `company_settings.business_hours` e `local_holidays` na VPS/MySQL para mensagem humana
- [x] Portar `holidayService` (feriados nacionais) sem API externa em tempo real, com cálculo local de feriados nacionais brasileiros e suporte a `holiday_overrides`

#### Helpers de produto

- [x] Implementar `getProductMainImage(product)` com fallback (NOVO via `model_color_images` / USADO via `products.images[]` / fallback `product_images`)
- [x] Implementar `groupProductsByModel(products)` (agrupa variações por `model_id`)
- [x] Implementar `formatPriceRange(products)` (de R$ X a R$ Y se variar)
- [x] Implementar `calculateMaxInstallment(priceCents)` reaproveitando `payment_fees`
- [x] Implementar `extractTokens(message)` com remoção de stopwords PT-BR
- [x] Implementar `detectIntent(message)` completo (greeting / human_request / numbered_choice)
- [x] Detectar saudação simples no webhook (`oi`, `ola`, `bom dia`, `boa tarde`, `boa noite`, `opa`)

#### Rota POST /autoresponder-webhook

- [x] Implementar em [vps_server.cjs](vps_server.cjs) com rate limit `{ max: 60, timeWindow: '1 minute' }`
- [x] Passo 1: validação de header `X-Autoresponder-Token`
- [x] Passo 2: check `settings.enabled`
- [x] Passo 3: lookup em `autoresponder_blocklist` (exact / prefix / regex)
- [x] Passo 4: detecção de grupo (campo `isGroup` do payload)
- [x] Passo 5: check de pausa em `autoresponder_conversations.paused_until`
- [x] Passo 6: check de limite `max_replies_per_conversation` na janela
- [x] Passo 7: detecção de "atendente humano" + pausa da conversa
- [x] Passo 7.1: escolha de mensagem por horário da loja (`getStoreStatus`)
- [x] Passo 8: detecção de saudação
- [x] Passo 9: match em `autoresponder_rules` por prioridade + tipos de reply
- [x] Passo 9.1: match inicial em `autoresponder_rules` com `reply_type='text'`
- [x] Passo 10: detecção de palavra-chave de tag de produto
- [x] Passo 11: detecção de resposta numerada (1, 2, 3)
- [x] Passo 12: busca de produtos por tokens (AND, sem agrupamento por model_id nesta etapa)
- [x] Passo 12.1: paginação simples com resposta `mais`
- [x] Passo 13: fallback + auto-pausa por fallbacks consecutivos
- [x] Passo 14: montagem do `replies[]` (top 1 com link/caption textual; imagem desativada por configuração)
- [x] Passo 15: log em `autoresponder_logs`
- [x] Passo 16: upsert em `autoresponder_conversations`
- [x] Tratamento de erro: sempre retornar 200 + mensagem genérica

#### Configuração da VPS

- [x] Adicionar `AUTORESPONDER_TOKEN=<valor-gerado-fora-do-repo>` no `.env` da VPS
- [x] `pm2 restart mdv-api` após editar `vps_server.cjs`
- [x] Verificar log: `pm2 logs mdv-api`
- [x] Healthcheck: `curl -X POST https://api.xiaomipetrolina.com.br/autoresponder-webhook` deve retornar 401

#### Cron diário Synology

- [x] Criar script `cron/archive-autoresponder-logs.sh` na VPS (base local criada; ainda falta instalar/validar na VPS)
- [x] Reduzir uso de RAM do archive com escrita em lotes (`AUTORESPONDER_ARCHIVE_BATCH_SIZE`, default 500) e gzip incremental
- [x] Instalar pacote do archive na VPS e validar dry-run remoto (`2026-05-05`, 38 logs exportáveis)
- [x] Validar escrita controlada na VPS em `/tmp/mdv-autoresponder-archive-write-test` (`2026-05-05`, 38 logs, gzip/checksum/JSON ok)
- [ ] Configurar SSH key da VPS para Synology (autenticação automática)
- [ ] Criar diretório `/volume1/backups/autoresponder/` no Synology
- [ ] Adicionar entrada no crontab da VPS: `0 3 * * * /var/www/mdv-api/cron/archive-autoresponder-logs.sh`
- [ ] Testar execução manual + verificar arquivo no Synology
- [ ] Validar checksum + DELETE de logs antigos

#### App AutoResponder Pro

- [x] Confirmar versão Pro instalada no celular da loja
- [x] Criar regra "Web request" com URL, headers, body do template
- [x] Marcar "Use response from web server as reply"
- [x] Desmarcar "Reply in groups"
- [x] Marcar "Don't reply if I have answered manually"
- [x] Configurar "Reply only 5 times per conversation in 60min"
- [x] Configurar "Don't reply within 30 seconds of sending"
- [x] Pattern `*`
- [x] Validar que o bot está respondendo normalmente em conversa real pelo WhatsApp da loja

#### Testes da Fase 1

- [x] Mensagem "tem capa para note 14" → resposta com produtos
- [x] Mensagem "qual o endereço?" → fallback (regra inativa) ou resposta se admin já cadastrou
- [x] Mensagem "humano" → mensagem de transferência (variando por horário)
- [x] Mensagem em grupo → bot ignora
- [x] Mensagem de número bloqueado → bot ignora
- [x] Mensagem dentro de pausa → bot ignora
- [x] Resposta "1" após lista numerada → bot detalha item escolhido
- [x] 3 fallbacks seguidos → auto-pausa
- [x] Mensagem "promoção" → busca produtos com tag `Promoção`
- [x] Verificar log em `autoresponder_logs` após cada mensagem
- [ ] Verificar arquivo no Synology após cron rodar (esperar 24h ou rodar manual)

### Fase 2 — Endpoints admin

#### Settings

- [x] `GET /autoresponder/settings`
- [x] `PATCH /autoresponder/settings` (validação dos campos)

#### Rules

- [x] `GET /autoresponder/rules` (com filtro por tag e status)
- [x] `POST /autoresponder/rules`
- [x] `PATCH /autoresponder/rules/:id`
- [x] `DELETE /autoresponder/rules/:id`
- [x] `POST /autoresponder/rules/from-question` (cria a partir de log da curadoria)
- [x] `POST /autoresponder/upload-attachment` (recebe multipart, salva localmente e retorna URL pública)

#### Tags

- [x] `GET /autoresponder/tags` (filtro por escopo)
- [x] `GET /autoresponder/category-tags` (categorias dinâmicas usadas como tags de categoria)
- [x] `POST /autoresponder/tags`
- [x] `PATCH /autoresponder/tags/:id`
- [x] `DELETE /autoresponder/tags/:id`

#### Conversations

- [x] `GET /autoresponder/conversations` (paginado, com filtro por tag e status)
- [x] `POST /autoresponder/conversations/:sender/pause` (body: duração em minutos)
- [x] `POST /autoresponder/conversations/:sender/resume`
- [x] `POST /autoresponder/conversations/:sender/tags` (substitui lista de tags)

#### Blocklist

- [x] `GET /autoresponder/blocklist`
- [x] `POST /autoresponder/blocklist` (1 número)
- [x] `POST /autoresponder/blocklist/bulk` (lista de números)
- [x] `PATCH /autoresponder/blocklist/:id`
- [x] `DELETE /autoresponder/blocklist/:id`

#### Stats e curadoria

- [x] `GET /autoresponder/unanswered` (perguntas sem resposta agrupadas por frequência)
- [x] `GET /autoresponder/stats?source=mysql` (logs últimos 7d)
- [x] `GET /autoresponder/stats?source=synology&from=YYYY-MM-DD` (resposta segura enquanto archive real fica pendente)
- [x] `GET /autoresponder/store-status` (live preview)

#### Tags em produtos

- [x] `PATCH /products/:id/tags` (substitui array completo de tag_ids)

#### Service frontend

- [x] Criar `services/autoResponderService.ts` com métodos para todos os endpoints
- [x] Tipos TypeScript em `types/autoResponder.ts`

### Fase 3 — Página admin (8 abas)

#### Estrutura base

- [x] Criar `pages/admin/AutoResponderPage.tsx`
- [x] Adicionar rota no router
- [x] Adicionar item no menu de [layouts/AdminLayout.tsx](layouts/AdminLayout.tsx)
- [x] Componente de tabs reutilizando padrão da app

#### Componentes reutilizáveis

- [x] `components/autoresponder/TagPicker.tsx` (multiselect colorido, filtra por escopo)
- [x] `components/autoresponder/ConversationCard.tsx` (card de conversa com ações)
- [x] `components/autoresponder/BlockNumberModal.tsx` (form de bloqueio com tipos)
- [x] `components/autoresponder/AttachmentUpload.tsx` (drag-drop + preview)
- [x] `components/autoresponder/RuleEditor.tsx` (modal CRUD de regra)
- [x] `components/autoresponder/MessagePreview.tsx` (renderiza mensagem como WhatsApp)

#### Aba Respostas

- [x] Tabela com nome / palavras-chave / acertos / status / ações
- [x] Filtro por tag + busca
- [x] Botão "+ Nova resposta" + dropdown "Usar template"
- [x] Modal de edição com preview ao vivo
- [x] Upload de anexo dentro do modal
- [x] Criar, editar e excluir respostas com recarregamento da lista

#### Aba Conversas

- [x] Lista com cards (sender, última msg, status, tags)
- [x] Filtro por tag e status (ativo/pausado)
- [x] Ações por conversa: pausar (1h/4h/24h/indefinido), liberar, atribuir tag, bloquear
- [x] Polling a cada 5s

#### Aba Bloqueados

- [x] Tabela com padrão / tipo / nome / motivo / ações
- [x] Botão "+ Adicionar"
- [x] Botão "Importar em massa" (textarea)
- [x] Editar bloqueio existente pelo modal

#### Aba Curadoria

- [x] Tabela com pergunta / frequência / última vez / ações
- [x] Botão "Criar resposta" (abre modal da Aba Respostas pré-preenchido)
- [x] Botão "Excluir" remove mensagem da curadoria
- [x] Curadoria abre modal de resposta pré-preenchido

#### Aba Tags

- [x] Tabela com nome / cor / escopo / descrição / ações
- [x] CRUD com seletor de cores + multi-select de escopos
- [x] Tags de categoria visíveis no admin como categorias dinâmicas

#### Aba Estatísticas

- [x] KPIs (cards no topo)
- [x] Pizza por intent
- [x] Top produtos perguntados
- [x] Top regras
- [x] Tempo médio de resposta
- [x] Switch para histórico Synology (?source=synology)

#### Aba Testes

- [x] Simular mensagem pela API da VPS sem enviar WhatsApp real
- [x] Mostrar resposta retornada pelo mesmo motor do bot
- [x] Editar o texto retornado antes de salvar
- [x] Salvar alteração em regra textual existente ou criar nova regra exata

#### Aba Configurações

- [x] Bloco "Atendimento humano" (2 textareas + pausa)
- [x] Bloco "Saudação"
- [x] Bloco "Assinatura virtual" editavel
- [x] Bloco "Auto-pausa"
- [x] Bloco "Limites"
- [x] Bloco "Imagens"
- [x] Bloco "Listas numeradas"
- [x] Bloco "Mapeamento palavra → tag"
- [x] Bloco "Horário de funcionamento" com link para `/admin/settings/company`

#### Integração TagPicker em produtos

- [x] Localizar página de edição de produto
- [x] Adicionar campo TagPicker (escopo `product`)
- [x] Conectar ao endpoint `PATCH /products/:id/tags`

#### Testes da Fase 3

- [x] CRUD completo em cada aba
- [x] Upload de imagem indo para Synology
- [x] Polling em tempo real na aba Conversas
- [x] Filtros funcionando em todas as listagens
- [x] Templates pré-cadastrados aparecem no dropdown
- [x] Curadoria → criar resposta funciona end-to-end

### Fase 4 — Compra pelo WhatsApp

Objetivo: permitir que o cliente avance da consulta de produto para um pedido assistido no WhatsApp, com resumo pronto para o atendente fechar pagamento/entrega.

#### Base ja pronta

- [x] Buscar produtos reais no banco da VPS
- [x] Enviar listas de produtos em lotes de 5 por mensagem
- [x] Manter opcoes numeradas para o cliente responder com numero
- [x] Responder produto individual quando o cliente escolhe uma opcao numerada
- [x] Mostrar preco, parcelamento e link do produto
- [x] Produto individual mostra garantia quando houver contexto de produto
- [x] Pergunta generica de garantia pede marca/produto quando nao houver contexto
- [x] Ocultar SKU na lista e mostrar SKU apenas no produto individual
- [x] Captar nome do cliente quando nao vier no payload
- [x] Confirmar/salvar nome do cliente no Google Contacts
- [x] Usar apenas o primeiro nome nas respostas do atendimento, mesmo quando o contato salvo tiver nome completo.
- [x] Pausar conversa quando o cliente pedir atendimento humano
- [x] Saudacao inicial mostra lista numerada de categorias disponiveis
- [x] Cliente pode responder com numero ou nome da categoria

#### Fluxo de carrinho/pedido

- [x] Criar estado `purchase_flow` em `autoresponder_conversations` ou tabela propria para carrinho temporario
- [x] Quando cliente responder numero/nome do produto, perguntar se deseja comprar ou ver detalhes
- [x] Perguntar quantidade desejada
- [x] Validar estoque antes de adicionar ao carrinho
- [x] Permitir adicionar mais produtos ao mesmo carrinho
- [x] Permitir remover item/cancelar carrinho
- [x] Calcular subtotal, total e resumo do pedido
- [x] Carrinho calcula parcelamento/juros da maquina de cartao pela tabela `payment_fees`
- [x] Confirmar se sera retirada na loja ou entrega
- [x] Se entrega, coletar endereco completo
- [x] Entrega pede CEP, consulta endereco e pede somente numero/complemento
- [x] Frete dinamico entra no resumo/confirmacao antes de chamar atendente
- [x] Confirmar nome/telefone/endereco antes de fechar

#### Cadastro do cliente

- [x] Antes de finalizar venda, captar dados minimos para cadastro do cliente
- [x] Definir campos obrigatorios do cadastro via WhatsApp: nome completo, telefone, CPF/CNPJ quando necessario, endereco quando houver entrega
- [x] Nome completo obrigatorio antes de finalizar pedido assistido
- [x] CPF/CNPJ remove pontuacao e valida digitos verificadores antes de salvar
- [x] Consultar cliente existente pelo telefone do WhatsApp, CPF/CNPJ ou e-mail antes de pedir dados novamente
- [x] Se cliente ja existir, confirmar dados cadastrados antes de atualizar
- [x] Criar/atualizar cliente no sistema a partir das respostas do WhatsApp quando possivel
- [x] Vincular cliente cadastrado ao pedido/carrinho do WhatsApp

#### Fechamento assistido por atendente

- [x] Gerar mensagem-resumo para atendente com cliente, telefone, itens, total, entrega/retirada e observacoes
- [x] Pausar o bot automaticamente apos gerar resumo de pedido
- [x] Criar tag/conversa com status `pedido_em_andamento`
- [x] Salvar evento em `autoresponder_logs` com intent `purchase_request`
- [x] Criar mensagem para o cliente: "Seu pedido foi separado para um atendente finalizar"

#### Pedido no sistema

- [ ] Criar tabela `whatsapp_orders` ou reaproveitar estrutura de pedidos existente
- [ ] Criar tabela/JSON de itens do pedido
- [ ] Status inicial: `draft`, `waiting_payment`, `paid`, `cancelled`, `completed`
- [ ] Endpoint admin para listar pedidos vindos do WhatsApp
- [ ] Vincular pedido ao `sender` da conversa e ao contato Google quando houver
- [ ] Decidir quando baixa estoque: ao pagamento confirmado ou ao atendente aprovar

#### Pagamento

- [ ] Fase inicial: PIX/manual com chave da loja e pedido aguardando comprovante
- [x] Responder pergunta de parcela especifica com destaque e tabela completa: `Em 5x fica R$ X = xxxx`
- [x] Captar escolha de parcelamento do cliente e salvar no carrinho do WhatsApp
- [ ] Mensagem para cliente enviar comprovante no WhatsApp
- [ ] Opcional: link de pagamento Mercado Pago/Asaas/Stripe
- [ ] Opcional: Pix copia-e-cola automatico com expiracao
- [ ] Validar comprovante/pagamento antes de baixar estoque automaticamente

#### Admin e operacao

- [ ] Aba/visao de pedidos do WhatsApp no admin
- [ ] Filtro por status e periodo
- [ ] Botao para copiar resumo do pedido
- [ ] Botao para marcar como pago/concluido/cancelado
- [ ] Historico da conversa junto do pedido
- [ ] Relatorio simples de conversao: produto perguntado -> pedido gerado

#### Consulta pelo cliente

- [ ] Cliente pode consultar cadastro pelo WhatsApp com confirmacao segura de identidade
- [ ] Cliente pode consultar compras/pedidos pelo WhatsApp
- [ ] Resposta de consulta mostra resumo simples: data, itens principais, status e proximo passo
- [ ] Se houver dados sensiveis ou duvida de identidade, encaminhar para atendente

#### Testes da Fase 4

- [x] Cliente escolhe produto por numero e bot pergunta quantidade
- [x] Produto sem estoque bloqueia compra e sugere atendimento/alternativa
- [x] Carrinho com 1 item gera resumo correto
- [x] Carrinho com varios itens soma total corretamente
- [x] Entrega coleta endereco antes de fechar
- [x] Entrega consulta CEP e calcula frete dinamico antes de pedir numero
- [x] Retirada nao pede endereco
- [x] Cliente novo informa dados e cadastro e criado/atualizado antes do pedido
- [x] Cliente existente e localizado pelo telefone e confirma dados antes do pedido
- [x] Cliente pergunta parcela especifica e recebe destaque + tabela completa
- [x] Cliente escolhe parcelamento e o bot salva a forma de pagamento no carrinho
- [ ] Cliente consulta compras e recebe resumo seguro
- [ ] Pedido assistido pausa o bot e chama atendente
- [ ] Pedido fica visivel no admin
- [x] Fluxo de cancelamento limpa carrinho temporario

### Fase 5 — Refinamentos (opcional)

- [ ] WebSocket para Conversas em tempo real (substitui polling)
- [ ] Sugestão automática de keywords ao curar perguntas (NLP simples com extração de tokens relevantes)
- [ ] Suporte a Instagram (criar regra paralela no app, mesmo webhook detecta `messenger` no payload)
- [ ] Suporte a Messenger
- [ ] Análise de sentimento das mensagens (opcional, MVP sem)
- [ ] Auto-tag de conversas por NLP (ex.: "lead quente" se mencionar valor + interesse)

---

## Checklist de implantação das novas decisões

Este checklist registra as decisões tomadas para a próxima evolução: ChatGPT treinável, Central de Atendimento e operação humana organizada. Todas as novas entregas devem ser implantadas na VPS/Synology, sem criar dependência nova de Supabase ou Vercel.

### Fase 6 — ChatGPT controlado pelo AutoResponder

- [x] Manter AutoResponder como motor principal do fluxo.
- [x] Adicionar campos `ai_enabled`, `ai_model` e `openai_api_key` em `autoresponder_settings` na VPS.
- [x] Criar campo no painel para trocar `OPENAI_API_KEY`.
- [x] Não devolver `openai_api_key` crua na API; retornar somente `has_openai_api_key` e `openai_api_key_masked`.
- [x] Ignorar chave vazia no PATCH para preservar a chave atual.
- [x] Aplicar prompt de segurança: proibido inventar produtos, preços, estoque, prazos, garantias, promoções ou condições fora do contexto oficial.
- [x] Fazer a saudação/resposta 2 perguntar o que o cliente procura, em vez de listar categorias automaticamente.
- [x] Enviar a pergunta comercial da saudação somente depois que o nome do cliente estiver captado/salvo.
- [x] Ao listar celulares/produtos, mostrar variação, preço à vista, parcelamento máximo em 12x e cores disponíveis.
- [x] Remover SKU das respostas para cliente.
- [x] Criar log específico quando a resposta usar IA (`intent`/metadado `ai_assisted`) para medir custo e qualidade.
- [x] Registrar consumo aproximado de tokens por resposta quando a OpenAI devolver uso.
- [x] Criar limite diário/mensal opcional para respostas com IA.
- [x] Criar controle financeiro estimado de tokens/créditos da IA.
- [x] Consultar gasto oficial da OpenAI via Admin API Key quando configurada.
- [ ] Criar fallback seguro se a OpenAI falhar: pergunta curta ou atendimento humano, nunca resposta inventada.

### Fase 7 — Página de Treinamento IA

Objetivo: permitir ensinar o ChatGPT sem editar código, mantendo tudo salvo na VPS.

- [x] Criar aba **Treinamento IA** dentro de `/admin/atendimento-automatico`.
- [x] Salvar treinamento em tabela nova na VPS, por exemplo `autoresponder_ai_training`.
- [x] Separar treinamento por tipos:
  - [x] Instruções da loja: tom, regras, limites e estilo.
  - [x] Perguntas e respostas prontas.
  - [x] Conhecimento por categoria/produto, sempre vinculado a dados oficiais.
  - [x] Políticas: pagamento, garantia, entrega, troca, assistência e atendimento humano.
- [x] Permitir ativar/desativar cada item de treinamento.
- [x] Permitir prioridade/ordem de aplicação.
- [ ] Criar campo de busca/filtro por tipo e status.
- [x] Criar botão **Testar resposta** usando o mesmo motor de teste do AutoResponder.
- [ ] Criar preview do contexto que será enviado para o ChatGPT, sem expor a chave OpenAI.
- [ ] Impedir instruções perigosas, como "ignore o sistema", "invente preço" ou "responda qualquer coisa".
- [ ] Versionar alterações do treinamento com `updated_at` e, se possível, usuário responsável.
- [x] Criar testes estáticos garantindo que a página usa VPS e não Supabase/Vercel.

### Fase 8 — Central de Atendimento

Objetivo: separar operação diária da configuração do robô.

- [ ] Criar página separada no menu: **WhatsApp > Central de Atendimento**.
- [ ] Criar rota frontend dedicada, por exemplo `/admin/whatsapp/atendimento`.
- [ ] Reaproveitar `autoresponder_conversations` como base inicial da lista.
- [ ] Mostrar lista de conversas com status:
  - [ ] Bot ativo
  - [ ] Humano atendendo
  - [ ] Pausado
  - [ ] Aguardando cliente
  - [ ] Pedido em andamento
- [ ] Criar botão **Assumir atendimento**.
- [ ] Criar botão **Pausar bot**.
- [ ] Criar botão **Retomar bot**.
- [ ] Criar controle operacional para **desligar o bot por completo** e **ligar novamente**, usando `autoresponder_settings.enabled`.
- [ ] Remover dependencia operacional do AutoResponder WA: entrada e saida oficiais devem passar pela Evolution conectada na VPS.
- [ ] Mostrar histórico de mensagens da conversa.
- [ ] Criar campo para resposta manual quando houver integração de envio disponível.
- [ ] Criar WhatsApp interno/laboratorio do bot para testar conversas completas sem envio real, sem limite curto de mensagens e com estado preservado por sender de teste.
- [ ] Criar Centro de Respostas no Centro WhatsApp para editar mensagens padrao e respostas por gatilho salvas na VPS, sem mensagens automaticas escondidas.
- [ ] Validar se a integração atual permite exibir "digitando..." no WhatsApp; se permitir, acionar antes de respostas geradas pelo bot/IA.
- [ ] Criar espaço de atendentes salvo na VPS, sem `localStorage`, com lista visível no Centro WhatsApp.
- [ ] Permitir filtrar atendimentos por atendente atual.
- [ ] Permitir trocar atendente durante a conversa, registrando a troca em log de auditoria append-only.
- [ ] Permitir bloquear número direto pelo atendimento, gravando em `autoresponder_blocklist` e mantendo o bot em silêncio para aquele sender.
- [ ] Permitir aplicar tags de conversa.
- [ ] Filtros: não respondidas, pausadas, pedido em andamento, por tag e por período.
- [ ] Mostrar resumo interno do pedido quando `purchase_flow.attendant_summary` existir.
- [ ] Preparar estrutura para múltiplos atendentes no futuro, mesmo que o MVP seja single-user.

### Fase 9 — Pausa automática por atendimento humano

Objetivo: impedir que bot e humano respondam ao mesmo tempo.

- [x] No AutoResponder Pro, manter opção "Don't reply if I have answered manually" ativada no celular.
- [x] Manter endpoint de pausa e retomada por conversa.
- [ ] Criar ação **Assumir atendimento** que pause a conversa por padrão por 60 minutos ou até retomada manual.
- [ ] Criar `pause_reason = human_takeover` quando um atendente assumir.
- [ ] Criar `pause_reason = manual_pause` quando usar apenas Pausar bot.
- [ ] Criar indicador visual de tempo restante da pausa.
- [ ] Criar botão **Retomar bot agora** na Central de Atendimento.
- [ ] Criar regra: se atendente responder manualmente pelo painel, pausar bot automaticamente.
- [ ] Decidir se mensagem manual enviada pelo WhatsApp fora do painel deve ser detectada pela integração atual ou se continuará dependente do AutoResponder Pro.

### Fase 10 — Organização e crescimento

- [ ] AutoResponder fica focado em automação, regras, treinamento, testes e configurações.
- [ ] Central de Atendimento fica focada em mensagens, fila, pausa/retomada e operação humana.
- [ ] Criar lista de transmissao do WhatsApp somente com opt-in explicito: perguntar ao cliente se ele quer fazer parte antes de incluir o contato.
- [ ] Registrar o aceite da lista de transmissao no historico/contato para evitar inclusao manual sem consentimento.
- [ ] Respostas automaticas devem parecer atendimento humano: enviar indicador de "digitando" quando a Evolution permitir, aplicar pequenos intervalos e evitar despejar texto grande de uma vez.
- [ ] Quebrar respostas longas em blocos curtos e naturais. Exemplo: se o cliente disser "bom dia" junto com uma pergunta, responder a saudacao em uma mensagem e a pergunta em outra.
- [ ] Quando a API do WhatsApp permitir, responder citando/selecionando a mensagem do cliente que originou a resposta.
- [ ] Se Treinamento IA crescer demais, mover para página própria no menu `IA > Treinamento`.
- [ ] Criar documentação curta para equipe: quando usar AutoResponder, Central de Atendimento e Treinamento IA.
- [ ] Criar métricas: conversas com IA, conversas assumidas por humano, pedidos gerados e taxa de fallback.
- [ ] Revisar segurança: nunca expor chaves, tokens, dados sensíveis de cliente ou prompt interno para o navegador sem necessidade.

### Fase 11 — Auditoria e migração para VPS/Synology

Objetivo: eliminar dependências novas e antigas de Vercel/Supabase no fluxo de WhatsApp, AutoResponder, IA e atendimento.

- [x] Regra permanente documentada: nenhuma nova tabela, rota, storage, função, cron ou configuração do AutoResponder/WhatsApp/IA deve nascer em Vercel ou Supabase.
- [ ] Antes de implementar cada nova função, procurar por uso de `supabase`, `vercel`, `VITE_SUPABASE`, `SUPABASE`, `vercel.json`, `npx vercel` e rotas serverless relacionadas ao escopo.
- [ ] Se encontrar dependência ligada ao AutoResponder/WhatsApp/IA, registrar no checklist desta fase antes de continuar.
- [ ] Migrar dados/configurações encontrados para MySQL na VPS, arquivos na Synology ou storage público controlado na VPS/Synology.
- [ ] Criar endpoints Fastify na VPS para substituir qualquer leitura/escrita antiga feita direto no Supabase.
- [ ] Atualizar frontend para usar `vpsClient` ou serviço VPS equivalente, nunca cliente Supabase direto nas telas novas.
- [ ] Remover ou isolar código antigo que ainda aponte para Vercel/Supabase depois da migração.
- [ ] Criar testes estáticos para impedir regressão, verificando que arquivos novos do escopo não usam Supabase/Vercel.
- [ ] Validar deploy somente por scripts VPS/Synology: `npm.cmd run deploy:vps-site` e `node deploy-vps-server-only.cjs`.
- [ ] Não usar `npx vercel`, Vercel dashboard, Supabase migrations, Supabase Edge Functions ou Supabase Storage para novas entregas do AutoResponder/WhatsApp/IA.

#### Itens conhecidos para auditar/migrar quando tocados

- [ ] `company_settings.business_hours`: hoje ainda aparece documentado como origem Supabase em partes antigas; migrar leitura usada pelo AutoResponder para fonte VPS quando a tela/rotina for alterada.
- [ ] Imagens de produtos em Supabase Storage: manter até plano próprio de mídia; quando mexer em mensagens com imagens, avaliar migração para Synology/VPS.
- [ ] Qualquer rota antiga de webhook/API em Vercel relacionada a WhatsApp/IA: substituir por Fastify na VPS.
- [ ] Qualquer configuração pública ou privada consumida por tela nova via Supabase: criar endpoint VPS antes de usar.

---

## Diário de implantação

### 2026-05-29 - Fase 6 controle financeiro da IA

**Objetivo da etapa:** mostrar no painel uma estimativa de gasto de tokens/créditos do ChatGPT para orientar quando comprar novos créditos.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `types/autoResponder.ts`
- `pages/admin/AutoResponderPage.tsx`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-ai-finance-static.test.mjs`

**Entregue nesta etapa:**
- `autoresponder_settings` ganhou saldo manual, alerta e preços por 1M tokens: `ai_credit_balance_usd`, `ai_credit_alert_usd`, `ai_input_cost_per_1m_usd` e `ai_output_cost_per_1m_usd`.
- `autoresponder_logs` ganhou `ai_estimated_cost_usd`.
- O backend calcula custo estimado por resposta usando tokens de entrada/saida e preços configurados.
- `GET /autoresponder/stats` agora retorna `summary.ai_finance` com gasto de hoje, gasto do mes, tokens do mes, saldo manual e saldo restante estimado.
- A seção ChatGPT do painel ganhou o bloco `Controle financeiro da IA`, com link para o painel oficial da OpenAI.
- Checklist da Fase 6 atualizado no item de controle financeiro estimado.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-ai-finance-static.test.mjs`
- `node tmp-tests\autoresponder-ai-logging-static.test.mjs`
- `node tmp-tests\autoresponder-ai-limits-static.test.mjs`
- `node --check vps_server.cjs`
- `node --check vps_server.js`

---

### 2026-05-29 - Fase 6 custo oficial OpenAI

**Objetivo da etapa:** complementar o controle financeiro com o custo oficial retornado pela API de custos da OpenAI, usando uma chave admin separada.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `types/autoResponder.ts`
- `pages/admin/AutoResponderPage.tsx`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-ai-finance-static.test.mjs`

**Entregue nesta etapa:**
- `autoresponder_settings` ganhou `openai_admin_api_key`, mascarada na API como status/chave parcial.
- O PATCH preserva a chave admin atual quando o campo vier vazio.
- `GET /autoresponder/stats` consulta `https://api.openai.com/v1/organization/costs` quando existir chave admin.
- `summary.ai_finance` agora expõe gasto oficial do mês, status da consulta e saldo restante estimado pelo custo oficial.
- O painel ganhou campo `Chave Admin OpenAI` e indicadores `Gasto oficial OpenAI` e `Saldo oficial estimado`.
- Checklist da Fase 6 atualizado no item de custo oficial OpenAI.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-ai-finance-static.test.mjs`

---

### 2026-05-29 - Fase 6 resumo financeiro visivel

**Objetivo da etapa:** reduzir o caminho para acompanhar saldo e gasto da IA no dia a dia.

**Arquivos criados/alterados:**
- `pages/admin/AutoResponderPage.tsx`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-ai-finance-static.test.mjs`

**Entregue nesta etapa:**
- A pagina do AutoResponder ganhou o bloco `Resumo financeiro da IA` logo abaixo dos indicadores principais.
- O resumo mostra saldo oficial estimado, gasto oficial OpenAI, credito informado, gasto interno estimado e status da chave admin.
- O botao `Ajustar financeiro` leva direto para `Configurações > Controle financeiro da IA`.
- Valores em USD passaram a usar formato de moeda mais limpo, com duas casas.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-ai-finance-static.test.mjs`

---

### 2026-05-29 - Busca ampla com resposta curta

**Objetivo da etapa:** evitar listas cansativas no WhatsApp quando o cliente faz uma pergunta ampla, como `tem tablet?`.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-catalog-request-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- A primeira resposta de produto passou a usar uma pagina curta com `AUTORESPONDER_PRODUCT_PAGE_SIZE`, hoje 5 itens.
- O bot deixa de enviar ate 50 produtos na primeira resposta.
- Quando houver mais resultados, o rodape pede filtro por faixa de preco, marca ou uso antes de sugerir `mais`.
- A paginacao por `mais` continua disponivel para o cliente que realmente quiser ver outras opcoes.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-catalog-request-static.test.mjs`
- `node tmp-tests\autoresponder-choice-instructions-static.test.mjs`
- `node tmp-tests\autoresponder-pagination-count-static.test.mjs`

---

### 2026-05-29 - Saudacao aguarda nome salvo

**Objetivo da etapa:** evitar que o bot pergunte o nome e a necessidade de compra na mesma resposta inicial.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-greeting-name-gate-static.test.mjs`

**Entregue nesta etapa:**
- Saudacao sem nome salvo agora responde somente com a captura/confirmacao do nome.
- A pergunta de captura manual de nome ficou: `Qual seu nome para seguirmos com o atendimento?`
- A pergunta comercial so aparece depois que `contact_name_status` esta como `saved_to_google` ou `google_pending`.
- A pergunta comercial padrao mudou para: `Voce esta atras de celular novo? Quer que eu mande a lista do que temos? Ou deseja alguma outra coisa?`
- O fluxo de contato manteve suporte a multiplas respostas separadas no AutoResponder Pro.
- Checklist da Fase 6 atualizado no item de saudacao condicionada ao nome salvo.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-greeting-name-gate-static.test.mjs`
- `node tmp-tests\autoresponder-google-contact-flow-static.test.mjs`
- `node tmp-tests\autoresponder-catalog-request-static.test.mjs`
- `node tmp-tests\autoresponder-ai-logging-static.test.mjs`
- `node --check vps_server.cjs`
- `node --check vps_server.js`

---

### 2026-05-28 - Fase 6 limites de uso da IA

**Objetivo da etapa:** permitir limite diario e mensal opcional para respostas com ChatGPT, usando logs da VPS como fonte de contagem.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `types/autoResponder.ts`
- `pages/admin/AutoResponderPage.tsx`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-ai-limits-static.test.mjs`

**Entregue nesta etapa:**
- `autoresponder_settings` ganhou `ai_daily_limit` e `ai_monthly_limit`, ambos com `0` como limite desativado.
- PATCH de configurações aceita os dois limites e normaliza valores negativos/vazios para `0`.
- Antes de chamar a OpenAI, o backend conta logs `ai_assisted = 1` do dia e do mes atual.
- Quando um limite é atingido, a chamada de IA e pulada e o bot usa o fallback seguro ja existente.
- Painel do AutoResponder ganhou campos de limite diario e mensal na secao ChatGPT.
- Checklist da Fase 6 atualizado no item de limites de IA.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-ai-limits-static.test.mjs`

---

### 2026-05-28 - Fase 6 logs de IA

**Objetivo da etapa:** registrar quando uma resposta do AutoResponder usa IA e guardar o consumo aproximado de tokens retornado pela OpenAI.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-ai-logging-static.test.mjs`

**Entregue nesta etapa:**
- `autoresponder_logs` ganhou os campos `ai_assisted`, `ai_model`, `ai_input_tokens` e `ai_output_tokens`.
- Migracao idempotente com `addColumnIfMissing()` para VPS existente.
- Helper `normalizeAutoresponderOpenAiUsage()` normaliza `usage.input_tokens` e `usage.output_tokens` quando a OpenAI devolver esses dados.
- O fluxo de saudacao/pergunta curta passa a salvar metadados de IA no log quando a resposta usar ChatGPT.
- Checklist da Fase 6 atualizado nos itens de log de IA e consumo aproximado de tokens.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-ai-logging-static.test.mjs`

---

### 2026-05-07 — Saudacao com categorias numeradas

**Objetivo da etapa:** quando o cliente entrar em contato sem pedido especifico, mostrar uma lista numerada de categorias disponiveis e aceitar resposta por numero ou nome.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-greeting-category-list-static.test.mjs`

**Entregue nesta etapa:**
- Helper `findAutoresponderAvailableCategories()` busca categorias reais com produtos ativos e estoque.
- Helper `buildAutoresponderCategoryOptions()` prepara opcoes numeradas de categoria.
- Helper `formatAutoresponderGreetingCategoryListReply()` monta a mensagem `Categorias disponiveis:`.
- Helper `findAutoresponderSelectedCategoryFromMessage()` aceita numero ou nome exato da categoria.
- Helper `findAutoresponderProductsByCategory()` busca produtos da categoria escolhida.
- Helper `countAutoresponderProductsByCategory()` mantém paginacao e total da categoria.
- Saudacao simples salva `last_options_offered` com `source = 'category_list'`.
- Ao responder numero ou nome da categoria, o bot envia a lista de produtos dessa categoria e salva novo contexto de produtos.
- Checklist atualizado para marcar saudacao com categorias e selecao por numero/nome.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-greeting-category-list-static.test.mjs`

**Resultado esperado:**
- Cliente envia `oi` e recebe categorias numeradas.
- Cliente responde `1` ou `Smartphones` e recebe produtos ativos daquela categoria.
- Como a lista vem do banco, novas categorias/produtos ativos passam a aparecer automaticamente.

---

### 2026-05-07 — Garantia no produto individual

**Objetivo da etapa:** quando o bot ja tem um produto especifico em contexto, responder a garantia junto do detalhe do produto sem fazer nova pergunta ao cliente.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-product-warranty-line-static.test.mjs`
- `tmp-tests/autoresponder-warranty-refinement-static.test.mjs`

**Entregue nesta etapa:**
- Helper `formatAutoresponderWarrantyPeriod()` para transformar dias de garantia em texto simples.
- Helper `formatAutoresponderProductWarrantyLine()` para montar a linha `Garantia:` conforme o produto.
- Queries do AutoResponder agora carregam `brand`, `category_id`, `warranty_type`, `warranty_template_id`, `brand_warranty_days` e `category_warranty_days`.
- A resposta de produto individual inclui garantia quando houver dados suficientes.
- A garantia oficial vem da configuracao do produto (`warranty_type` e `warranty_template_id`). Marca e categoria entram apenas como origem herdada quando o proprio produto estiver configurado para usar marca ou categoria.
- Perguntas genericas de garantia agora entram em fluxo de refinamento: se houver produto em contexto, responde esse produto; se houver produto no texto, busca e responde; se nao houver contexto suficiente, pede marca/produto.
- O checklist passou a marcar `Produto individual mostra garantia quando houver contexto de produto`.
- O checklist passou a marcar `Pergunta generica de garantia pede marca/produto quando nao houver contexto`.

**Resultado esperado:**
- Quando o cliente escolhe um item da lista ou pede detalhes de um produto em contexto, o bot mostra preço, parcelamento, garantia e link.
- Quando o cliente pergunta "qual a garantia do Redmi Note 14?", o bot tenta localizar esse produto e responder a garantia configurada nele.
- Quando o cliente pergunta apenas "qual a garantia?", o bot pede a marca ou produto antes de responder.

---

### 2026-05-07 — Fase 4E adicionar mais produtos

**Objetivo da etapa:** permitir que o cliente continue montando o carrinho pelo WhatsApp depois de adicionar o primeiro item.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-purchase-add-more-static.test.mjs`

**Entregue nesta etapa:**
- Helper `isAutoresponderPurchaseAddMoreRequest()` para reconhecer respostas como `adicionar mais`, `mais produtos`, `comprar mais` e `continuar comprando`.
- Helper `buildAutoresponderAddMorePrompt()` para pedir o proximo produto.
- Quando `purchase_flow.status = 'item_added'` e o cliente pede mais produtos, o bot muda para `adding_more`, limpa o produto selecionado e preserva `purchase_flow.items`.
- Ao selecionar outro produto por numero/nome, o bot passa para `awaiting_product_action` sem zerar os itens ja adicionados.
- Log novo com `intent = 'purchase_add_more_prompt'`.
- Checklist atualizado para marcar `Permitir adicionar mais produtos ao mesmo carrinho`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-add-more-static.test.mjs`

**Resultado esperado:**
- Cliente adiciona um item, responde `adicionar mais`, escolhe outro produto e o carrinho temporario continua com os itens anteriores.
- A proxima etapa ainda precisa remover/cancelar item e depois calcular subtotal/total do carrinho.

---

### 2026-05-07 — Fase 4F remover item/cancelar carrinho

**Objetivo da etapa:** permitir que o cliente corrija ou cancele o carrinho temporario pelo WhatsApp antes de finalizar.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-purchase-cancel-remove-static.test.mjs`

**Entregue nesta etapa:**
- Helper `isAutoresponderPurchaseCancelRequest()` para reconhecer `cancelar`, `cancelar carrinho`, `limpar carrinho`, `desistir` e equivalentes.
- Helper `getAutoresponderPurchaseRemoveItemIndex()` para comandos como `remover 1`, `tirar item 2` e `excluir 3`.
- Helper `hasAutoresponderCartItems()` para proteger comandos de carrinho quando nao ha itens.
- Helper `buildAutoresponderCartCancelledReply()` para confirmar cancelamento.
- Helper `buildAutoresponderItemRemovedReply()` para confirmar item removido e avisar se o carrinho ficou vazio.
- Cancelamento chama `clearAutoresponderPurchaseFlow(senderKey)` e registra `intent = 'purchase_cancelled'`.
- Remocao atualiza `purchase_flow.items`; se remover o ultimo item, limpa o carrinho temporario.
- Checklist atualizado para marcar `Permitir remover item/cancelar carrinho` e `Fluxo de cancelamento limpa carrinho temporario`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-cancel-remove-static.test.mjs`

**Resultado esperado:**
- Cliente pode responder `cancelar carrinho` para limpar o fluxo de compra.
- Cliente pode responder `remover 1` para tirar o primeiro item do carrinho.
- A proxima etapa pode calcular subtotal/total e montar resumo do pedido.

---

### 2026-05-07 — Fase 4G resumo e total do carrinho

**Objetivo da etapa:** permitir que o cliente finalize a montagem do carrinho temporario e receba um resumo com subtotais e total antes de escolher retirada/entrega.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-purchase-summary-static.test.mjs`

**Entregue nesta etapa:**
- Helper `isAutoresponderPurchaseFinalizeRequest()` para reconhecer `finalizar`, `fechar pedido`, `concluir` e `resumo`.
- Helper `calculateAutoresponderCartTotals()` para somar `subtotal_cents` dos itens.
- Helper `formatAutoresponderCartSummaryReply()` para montar `Resumo do pedido`, lista de itens, `Subtotal:` e `Total:`.
- Quando ha itens no carrinho e o cliente pede para finalizar, o bot salva `purchase_flow.status = 'summary_ready'`.
- O `purchase_flow.totals` passa a guardar `itemCount`, `subtotal_cents` e `total_cents`.
- Log novo com `intent = 'purchase_summary'`.
- Checklist atualizado para marcar resumo/total e os testes de carrinho com 1 ou varios itens.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-summary-static.test.mjs`

**Resultado esperado:**
- Cliente responde `finalizar` e recebe o resumo do carrinho.
- A proxima etapa deve confirmar se sera retirada na loja ou entrega.

---

### 2026-05-07 — Fase 4H retirada/entrega e endereco

**Objetivo da etapa:** depois do resumo, confirmar se o pedido sera retirado na loja ou entregue e coletar endereco quando houver entrega.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-purchase-fulfillment-static.test.mjs`

**Entregue nesta etapa:**
- Helper `getAutoresponderPurchaseFulfillmentChoice()` para reconhecer retirada ou entrega.
- Helper `normalizeAutoresponderDeliveryAddress()` para limpar e limitar o endereco informado.
- Helper `buildAutoresponderPickupConfirmationReply()` para confirmar retirada sem pedir endereco.
- Helper `buildAutoresponderDeliveryAddressPrompt()` para pedir endereco completo quando for entrega.
- Helper `buildAutoresponderDeliveryAddressSavedReply()` para confirmar endereco recebido.
- Quando `purchase_flow.status = 'summary_ready'` e o cliente escolhe retirada, o bot salva `fulfillment = 'pickup'` e avanca para `customer_data_pending`.
- Quando o cliente escolhe entrega, o bot salva `fulfillment = 'delivery'` e avanca para `awaiting_delivery_address`.
- Quando o cliente envia o endereco, o bot salva `delivery_address` e avanca para `customer_data_pending`.
- Logs novos: `purchase_fulfillment_pickup`, `purchase_fulfillment_delivery` e `purchase_delivery_address`.
- Checklist atualizado para marcar retirada/entrega, coleta de endereco, teste de entrega e teste de retirada.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-fulfillment-static.test.mjs`

**Resultado esperado:**
- Retirada na loja nao pede endereco.
- Entrega pede endereco completo antes de seguir para confirmacao dos dados do cliente.

---

### 2026-05-07 — Fase 4I confirmacao dos dados do cliente

**Objetivo da etapa:** antes de fechar o pedido assistido, confirmar com o cliente os dados principais do pedido: nome, telefone e endereco/retirada.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-purchase-customer-confirmation-static.test.mjs`

**Entregue nesta etapa:**
- Helper `getAutoresponderCustomerDataSnapshot()` para montar nome, telefone, forma de recebimento e endereco/retirada.
- Helper `buildAutoresponderCustomerDataConfirmationReply()` para pedir confirmacao dos dados.
- Helper `buildAutoresponderCustomerDataConfirmedReply()` para confirmar dados corretos.
- Helper `buildAutoresponderCustomerDataNeedsUpdateReply()` para marcar necessidade de ajuste com atendente.
- Quando `purchase_flow.status = 'customer_data_pending'`, o bot salva `customer_data` e muda para `awaiting_customer_confirmation`.
- Se o cliente responde `sim`, o bot muda para `customer_data_confirmed`.
- Se o cliente responde `nao`, o bot muda para `customer_data_update_needed`.
- Logs novos: `purchase_customer_data_confirmation`, `purchase_customer_data_confirmed` e `purchase_customer_data_needs_update`.
- Checklist atualizado para marcar `Confirmar nome/telefone/endereco antes de fechar`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-customer-confirmation-static.test.mjs`

**Resultado esperado:**
- Antes de fechar, o cliente ve nome, telefone e endereco/retirada.
- A proxima etapa pode captar dados minimos faltantes e consultar cliente existente.

---

### 2026-05-07 — Fase 4J dados minimos do cadastro

**Objetivo da etapa:** antes de finalizar a venda assistida, garantir que o carrinho tenha dados minimos para cadastro do cliente.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-purchase-customer-document-static.test.mjs`

**Entregue nesta etapa:**
- Helper `normalizeAutoresponderCustomerDocument()` para aceitar CPF/CNPJ com 11 ou 14 digitos.
- Helper `buildAutoresponderCustomerDocumentPrompt()` para pedir CPF/CNPJ quando ainda faltar.
- Helper `buildAutoresponderCustomerDocumentSavedReply()` para confirmar dados minimos anotados.
- `getAutoresponderCustomerDataSnapshot()` passa a carregar `cpf_cnpj` quando vier do payload ou do proprio `purchase_flow`.
- Quando o cliente confirma os dados e ainda falta CPF/CNPJ, o bot muda para `awaiting_customer_document`.
- Quando o cliente informa CPF/CNPJ valido, o bot salva em `purchase_flow.customer_data.cpf_cnpj` e muda para `customer_registration_ready`.
- Logs novos: `purchase_customer_document_prompt` e `purchase_customer_document_saved`.
- Checklist atualizado para marcar dados minimos e campos obrigatorios via WhatsApp.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-customer-document-static.test.mjs`

**Resultado esperado:**
- Nome, telefone, endereco/retirada e CPF/CNPJ ficam reunidos no `purchase_flow` antes da etapa de consulta/criacao do cliente.
- A proxima etapa deve consultar cliente existente por telefone, CPF/CNPJ ou e-mail antes de pedir dados novamente.

---

### 2026-05-07 — Requisitos de cadastro e consulta do cliente

**Objetivo da anotação:** ampliar o escopo da compra pelo WhatsApp para cobrir cadastro do cliente e consultas futuras.

**Itens adicionados ao checklist:**
- Captar dados mínimos antes de finalizar venda: nome completo, telefone, CPF/CNPJ quando necessário e endereço quando houver entrega.
- Consultar cliente existente pelo telefone do WhatsApp, CPF/CNPJ ou e-mail antes de pedir dados novamente.
- Confirmar dados cadastrados quando o cliente já existir.
- Criar ou atualizar cliente no sistema a partir das respostas do WhatsApp quando possível.
- Vincular o cliente ao pedido/carrinho do WhatsApp.
- Permitir consulta segura de cadastro pelo WhatsApp.
- Permitir consulta de compras/pedidos pelo WhatsApp com resumo simples.

**Decisão de segurança:**
- Consulta de cadastro/compras deve confirmar identidade antes de mostrar dados.
- Se houver dado sensível ou dúvida de identidade, o bot deve encaminhar para atendente.

---

### 2026-05-05 — Fase 1W cores disponíveis

**Objetivo da implantação:** substituir `Variacoes: N opcoes` por uma lista de cores disponíveis, usando apenas variações com estoque positivo.

# Comandos locais do safety gate

O procedimento documentado em `docs/operacional/2026-05-05-autoresponder-synology-gate-env.md` e somente leitura: nÃ£o altera Synology, nÃ£o define variÃ¡veis automaticamente e apenas imprime comandos PowerShell para revisÃ£o manual antes de qualquer liberaÃ§Ã£o do safety gate.

Resumo UTF-8 do gate: somente leitura; não altera Synology; não define variáveis automaticamente; PowerShell; safety gate.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `getAutoresponderProductColor()` lendo `specs.color`, `specs.cor`, `custom_fields.color` e equivalentes.
- Helper `getAutoresponderAvailableColors()` coletando cores únicas apenas de produtos com `stock_quantity > 0`.
- `groupAutoresponderProductsByModel()` passa a carregar `colors`.
- Caption principal agora usa `Cores disponiveis: ...`.
- Outras opções/lista compacta também exibem cores quando disponíveis, em vez de contagem genérica de variações.
- Queries do AutoResponder agora trazem `specs` e `custom_fields` nas buscas por tag, por tokens e detalhe por ID.
- Deploy do servidor na VPS com backup remoto e restart do PM2.

**Verificações executadas nesta etapa:**
- Consulta na VPS confirmou cores em `specs.color` para o modelo do SKU `CSRN144GRO`.
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node tmp-tests\autoresponder-product-grouping-static.test.mjs`
- Teste autenticado em `GET /autoresponder-webhook` retornou `Cores disponiveis: Roxo, Vinho, Vermelho, Rosa Chiclete, Marrom` e não retornou `Variacoes:`.

**Importante:**
- A lista mostra somente cores com estoque positivo.
- O preço do SKU `CSRN144GRO` continua pendente de revisão.

**Próximo passo sugerido:** criar a mensagem própria para casos sem item disponível em estoque.

---

### 2026-05-05 — Fase 1V produto sem linha de estoque

**Objetivo da implantação:** remover a linha `Estoque: Em estoque` das respostas de produto, porque o bot deve enviar link apenas do que estiver disponível; mensagem específica para indisponibilidade fica para uma etapa posterior.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `formatAutoresponderProductCaption()` não inclui mais `Estoque:`.
- `formatAutoresponderProductDetailReply()` não inclui mais `Estoque:`.
- Lista compacta deixou de exibir `(em estoque)` / `(consultar estoque)`.
- Deploy do servidor na VPS com backup remoto e restart do PM2.

**Verificações executadas nesta etapa:**
- `rg -n "Estoque:|Consultar estoque|Em estoque|consultar estoque|em estoque" vps_server.cjs Bot_Whatsapp.md tmp-tests` sem ocorrências.
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- Teste autenticado em `GET /autoresponder-webhook` confirmou resposta sem `Estoque:`.

**Próximo passo sugerido:** criar a mensagem própria para quando a busca encontrar produto relacionado sem disponibilidade ou quando não houver item em estoque para enviar link.

---

### 2026-05-05 — Fase 1U celular sem imagem

**Objetivo da implantação:** remover a linha de imagem das respostas enviadas ao AutoResponder no celular, mantendo produto, preço, parcelamento e link.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `shouldAutoresponderSendProductImages(settings)` para respeitar `send_product_images` e `max_images_per_response`.
- `formatAutoresponderProductSearchReply()` e `formatAutoresponderProductDetailReply()` agora só adicionam `Imagem:` quando a configuração permitir.
- Configuração da VPS atualizada para `send_product_images = 0` e `max_images_per_response = 0`.
- Deploy do servidor na VPS com backup remoto e restart do PM2.

**Verificações executadas nesta etapa:**
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `PATCH /autoresponder/settings` confirmou `send_product_images: 0`.
- Teste autenticado em `GET /autoresponder-webhook` confirmou resposta sem linha `Imagem:`.

**Próximo passo sugerido:** manter a regra do celular sem `format=text`, em JSON, e testar novamente a mensagem real depois de salvar a URL/token corretos.

---

### 2026-05-05 — Fase 1T VPS/checklist Fase 1

**Objetivo da implantação:** avançar a checklist operacional da Fase 1 na VPS com testes reais controlados e seeds mínimos de tags/mapeamento, sem depender ainda do app AutoResponder Pro no celular.

**Arquivos alterados/criados:**
- `tmp-tests/autoresponder-vps-checklist-runner.cjs`
- `tmp-tests/autoresponder-vps-seed-tags.cjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Runner de checklist usando token local e endpoints reais da VPS.
- Verificação remota do schema confirmou as 6 tabelas `autoresponder_*` e a coluna `products.tag_ids`.
- `pm2 logs mdv-api --lines 80 --nostream` executado após deploy; startup/migrations do AutoResponder aparecem OK.
- Configurações default confirmadas na VPS: auto-pausa 3 fallbacks → 30 min, pausa humana 60 min, mensagens de humano/fallback e prefixo de saudação.
- Teste de fallback com mensagem sem match retornou `fallback_message`.
- Teste de pausa manual com remetente numérico ficou em silêncio.
- Teste de blocklist com remetente numérico ficou em silêncio e removeu o bloqueio temporário em seguida.
- Teste de 3 fallbacks consecutivos retornou mensagem de auto-pausa na terceira tentativa e silêncio depois.
- Seed das 13 tags pré-cadastradas do plano; `Promoção` já existia e as outras 12 foram criadas.
- Seed de `product_tag_keywords` com palavras de promoção e novidade.
- Teste de `promoção` validado com tag temporária no SKU `CSRN144GRO`, depois restaurando `products.tag_ids` original para não deixar promoção falsa ativa.
- Estatísticas confirmaram intents `fallback`, `product_search`, `numbered_choice`, `human_request` e `product_tag`.

**Verificações executadas nesta etapa:**
- `node --check tmp-tests\autoresponder-vps-checklist-runner.cjs`
- `node tmp-tests\autoresponder-vps-checklist-runner.cjs`
- `node --check tmp-tests\autoresponder-vps-seed-tags.cjs`
- `node tmp-tests\autoresponder-vps-seed-tags.cjs`

**Importante:**
- Os logs PM2 ainda mostram erros antigos/recorrentes do Synology (`error code: 1033`) em rotas de vídeo/check-video; isso não bloqueou o AutoResponder, mas deve continuar no radar da frente Synology.
- O teste inicial de pausa com remetente textual mostrou que o webhook normaliza remetentes removendo não-dígitos. O teste válido foi refeito com remetente numérico, compatível com payload real do WhatsApp.
- O produto `CSRN144GRO` segue com `price_retail = 1999.00`; não corrigido nesta etapa por faltar confirmação do preço correto.
- O bot permanece habilitado na VPS (`enabled = 1`), mas ainda falta configurar e validar o app AutoResponder Pro no celular da loja.

**Próximo passo sugerido:** configurar a regra "Web request" no AutoResponder Pro do celular usando URL/token atuais, testar uma conversa real controlada, e revisar o cadastro/preço do SKU `CSRN144GRO` antes de liberar para atendimento real.

---

### 2026-05-05 — Fase 1S VPS/teste controlado

**Objetivo da implantação:** publicar a rota do AutoResponder na VPS e validar o webhook real com chamadas HTTP autenticadas, antes de configurar o app AutoResponder Pro no celular.

**Arquivos alterados/criados:**
- `vps_server.js`
- `tmp-tests/autoresponder-vps-route-diagnostic.cjs`
- `tmp-tests/autoresponder-vps-server-deploy.cjs`
- `tmp-tests/autoresponder-vps-env-diagnostic.cjs`
- `tmp-tests/autoresponder-vps-token-set.cjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `vps_server.js` sincronizado com `vps_server.cjs`, porque o deploy atual envia `vps_server.js` para `/var/www/mdv-api/server.js`.
- Diagnóstico SSH read-only confirmou que a VPS rodava `/var/www/mdv-api/server.js` sem `autoresponder-webhook`.
- Deploy controlado com backup remoto em `/var/www/mdv-api/.codex-backups/`, upload de `server.js`, `vps_server.js` e services auxiliares, `node --check server.js` e `pm2 restart mdv-api --update-env`.
- Healthcheck público mudou de `404` para `401` em `POST /autoresponder-webhook` sem token.
- `AUTORESPONDER_TOKEN` gerado fora do código, salvo no `.env` da VPS e também em `.env.local` local para configurar o app AutoResponder.
- `autoresponder_settings.enabled` ligado via endpoint admin para teste controlado.
- Teste real autenticado com `tem capa para note 14` retornou produto, link, imagem e parcelamento.
- Teste real com resposta `1` retornou detalhe do item escolhido.
- Teste real com pedido de humano retornou mensagem de fora do horário.
- Teste real com `isGroup=true` retornou silêncio (`replies: []`).
- Endpoint de estatísticas confirmou logs com intents `product_search`, `numbered_choice` e `human_request`.

**Verificações executadas nesta etapa:**
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node tmp-tests\autoresponder-product-main-image-fallback-static.test.mjs`
- `node tmp-tests\autoresponder-installment-helper-static.test.mjs`
- `node --check tmp-tests\autoresponder-vps-route-diagnostic.cjs`
- `node tmp-tests\autoresponder-vps-route-diagnostic.cjs`
- `node --check tmp-tests\autoresponder-vps-server-deploy.cjs`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- `curl -X POST https://api.xiaomipetrolina.com.br/autoresponder-webhook` sem token → `401`.
- `curl -X POST https://api.xiaomipetrolina.com.br/autoresponder-webhook` com token e payload de produto → `200` com `replies[]`.
- `GET /autoresponder/stats?source=mysql` confirmou 3 logs de teste.

**Importante:**
- O bot ficou habilitado na VPS (`enabled = 1`), mas o app AutoResponder Pro do celular ainda não foi configurado.
- O produto retornado para `tem capa para note 14` foi `Capa de Silicone para Redmi Note 14 4G`, SKU `CSRN144GRO`, com preço `R$ 1.999,00`; revisar esse cadastro antes de liberar no celular para clientes reais.
- `product_tag_keywords` ainda está `{}`, então o teste de `promoção` segue pendente até configurar o mapeamento palavra → tag.
- O primeiro `curl` com JSON manual falhou por escape do PowerShell; os testes válidos passaram usando payload em arquivo temporário.

**Próximo passo sugerido:** revisar/corrigir o preço do SKU `CSRN144GRO`, configurar o app AutoResponder Pro no celular com o token de `.env.local`, e testar uma conversa real controlada antes de divulgar para clientes.

---

### 2026-05-05 — Fase 1R local

**Objetivo da implantação:** reforçar o helper de imagem principal do AutoResponder com fallbacks seguros para campos já presentes no objeto de produto.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-product-main-image-fallback-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `pickFirstAutoresponderProductImage()` para escolher a primeira imagem válida entre payloads diferentes.
- Helper `isAutoresponderUsedProduct()` para priorizar `products.images[]` em produtos usados/seminovos.
- `getAutoresponderProductMainImage()` agora suporta `imageUrl`, `image_url`, `main_image_url`, `model_color_images`, `modelColorImages`, `images`, `custom_images`, `customImages`, `product_images` e `productImages`.
- Para produtos novos/sem condição usada, a prioridade passa por `model_color_images` antes dos arrays genéricos.
- Para produtos usados, a prioridade passa por `products.images[]` e imagens customizadas antes do fallback.
- Checklist atualizado para marcar `getProductMainImage(product)` como concluído.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-product-main-image-fallback-static.test.mjs` falhou porque os fallbacks ainda não existiam.
- `node tmp-tests\autoresponder-product-main-image-fallback-static.test.mjs`
- `node --check vps_server.cjs`

**Ponto de parada seguro:**
- Nenhuma query nova foi adicionada em tabelas não confirmadas na VPS.
- Nenhuma ação remota foi executada contra Synology, Cloudflare, DSM, VPS, crontab ou PM2.

**Próximo passo sugerido:** fechar os helpers restantes de intenção/tokens ou partir para testes controlados do webhook local.

---

### 2026-05-05 — Fase 1Q local

**Objetivo da implantação:** adicionar cálculo de parcelamento máximo no AutoResponder usando a tabela `payment_fees`, mantendo o fluxo local e sem acionar infraestrutura remota.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-installment-helper-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `calculateAutoresponderMaxInstallment(priceCents)` lendo `payment_fees` no canal `presencial`.
- Aplicação de `applied_fee_pct` antes de dividir o total pela quantidade máxima de parcelas.
- Formatter `formatAutoresponderInstallmentLine()` com linha `Parcelamento: ate Nx de R$ X`.
- Caption e detalhe de produto passaram a incluir parcelamento quando houver configuração válida.
- Falha de consulta em `payment_fees` não derruba o webhook: o parcelamento é omitido e o atendimento continua.
- Checklist atualizado para marcar `calculateMaxInstallment(priceCents)` como concluído.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-installment-helper-static.test.mjs` falhou porque o helper ainda não existia.
- `node tmp-tests\autoresponder-installment-helper-static.test.mjs`
- `node --check vps_server.cjs`

**Ponto de parada seguro:**
- Nenhuma ação remota foi executada contra Synology, Cloudflare, DSM, VPS, crontab ou PM2.
- Esta fase ficou restrita ao backend local, teste estático e documentação.

**Próximo passo sugerido:** revisar o helper de imagem principal (`getProductMainImage`) com fallback seguro, sem adicionar queries arriscadas em tabelas que ainda não confirmamos na VPS.

---

### 2026-05-05 — Fase 1P local

**Objetivo da implantação:** concluir os helpers de agrupamento por modelo e faixa de preço no fluxo de produtos do AutoResponder, sem tocar em integrações externas.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-product-grouping-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `groupAutoresponderProductsByModel()` agrupando variações pelo `model_id`, com fallback seguro para `id`.
- Helper `formatAutoresponderPriceRange()` exibindo preço único ou faixa `de R$ X a R$ Y` quando houver variação.
- Helper `buildAutoresponderProductOptions()` para manter a lista numerada coerente com os grupos exibidos ao cliente.
- Respostas de busca/lista agora usam grupos por modelo e mostram quantidade de variações quando aplicável.
- Queries do AutoResponder passaram a selecionar `model_id`, coluna já usada no filtro de busca por produtos.
- Checklist atualizado para marcar `groupProductsByModel(products)` e `formatPriceRange(products)` como concluídos.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-product-grouping-static.test.mjs` falhou porque os helpers ainda não existiam.
- `node tmp-tests\autoresponder-product-grouping-static.test.mjs`
- `node --check vps_server.cjs`

**Ponto de parada seguro:**
- Nenhuma ação remota foi executada contra Synology, Cloudflare, DSM, VPS, crontab ou PM2.
- Esta fase ficou restrita ao backend local, teste estático e documentação.

**Próximo passo sugerido:** seguir para `calculateMaxInstallment(priceCents)` reaproveitando `payment_fees`, ainda local e sem mexer em Synology.

---

### 2026-05-05 — Fase 1O local

**Objetivo da implantação:** implementar o cache em memória de 60s para o status de funcionamento usado pelo AutoResponder, retomando um item pendente do checklist principal.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-store-status-cache-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `getCachedAutoresponderStoreStatus()` com TTL de 60s.
- Cache compartilhado pelo endpoint `GET /autoresponder/store-status` e pelo fluxo de pedido de atendimento humano no webhook.
- Invalidação do cache quando `PATCH /company-settings` altera as configurações da empresa.
- Checklist atualizado para marcar `getCachedStoreStatus()` como concluído.
- Reparo mínimo no fechamento do `fastify.listen`, que estava truncado no final de `vps_server.cjs` e impedia `node --check`.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-store-status-cache-static.test.mjs` falhou porque o cache ainda não existia.
- `node tmp-tests\autoresponder-store-status-cache-static.test.mjs`
- `node --check vps_server.cjs`
- `git diff --check -- vps_server.cjs tmp-tests/autoresponder-store-status-cache-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Nenhuma ação remota foi executada contra Synology, Cloudflare, DSM, VPS, crontab ou PM2.
- Esta fase ficou restrita ao backend local e documentação.

**Próximo passo sugerido:** seguir para outro item pendente do checklist principal que não dependa de Synology, como helpers de produto/parcelamento ou testes controlados do webhook.

---

### 2026-05-05 — Fase 3AG local

**Objetivo da implantação:** preparar um gerador somente leitura dos comandos locais necessários para liberar o safety gate depois que as evidências manuais forem preenchidas e validadas.

**Arquivos alterados/criados:**
- `tools/print-autoresponder-synology-gate-env.cjs`
- `docs/operacional/2026-05-05-autoresponder-synology-gate-env.md`
- `tmp-tests/autoresponder-synology-gate-env-printer-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Script que lê um arquivo local de evidências manuais e valida os 4 checks exigidos.
- Saída em JSON com comandos PowerShell apenas quando todos os checks estiverem confirmados.
- Bloqueio por padrão para o template de exemplo incompleto.
- Garantia explícita de que o script apenas imprime comandos: não define variáveis, não conecta no Synology, não altera crontab, não reinicia processos e não habilita limpeza de logs.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-synology-gate-env-printer-static.test.mjs` falhou porque o gerador ainda não existia.
- `node tmp-tests\autoresponder-synology-gate-env-printer-static.test.mjs`
- `node --check tools\print-autoresponder-synology-gate-env.cjs`
- `node tools\print-autoresponder-synology-gate-env.cjs docs\operacional\autoresponder-synology-manual-evidence.example.json`
- Resultado esperado com template incompleto: `"ok": false`, `"print_only": true`, `"read_only": true`, `"does_not_set_env": true`, `"does_not_touch_synology": true`, `commands: []`.
- `npm.cmd run build`

**Ponto de parada seguro:**
- Nenhuma ação remota foi executada contra Synology, Cloudflare, DSM ou VPS.
- O safety gate continua bloqueado enquanto a evidência manual não for preenchida.

**Próximo passo sugerido:** quando as evidências manuais existirem, rodar o gerador apontando para o arquivo preenchido, revisar os comandos impressos e só então executar o safety gate local.

---

### 2026-05-05 — Fase 3AF local

**Objetivo da implantação:** criar um template local de evidências manuais e um validador somente leitura antes de qualquer liberação do safety gate do Synology.

**Arquivos alterados/criados:**
- `tools/validate-autoresponder-synology-manual-evidence.cjs`
- `docs/operacional/autoresponder-synology-manual-evidence.example.json`
- `docs/operacional/2026-05-05-autoresponder-synology-evidence-template.md`
- `tmp-tests/autoresponder-synology-evidence-template-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Template JSON com os 4 checks manuais exigidos pelo safety gate.
- Validador local que aceita um arquivo de evidência preenchido e falha se algum check estiver sem `confirmed: true` ou sem texto de evidência.
- Validação do túnel canônico `mdv-videos`, UUID `7680ed44-a7a9-4700-a37e-2026b3653360`, e da fonte de verdade `Synology.md`.
- Bloqueios explícitos: o validador não conecta no Synology, não reinicia túnel, não altera crontab, não reinicia processos e não habilita limpeza de logs.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-synology-evidence-template-static.test.mjs` falhou porque o validador/template ainda não existiam.
- `node tmp-tests\autoresponder-synology-evidence-template-static.test.mjs`
- `node --check tools\validate-autoresponder-synology-manual-evidence.cjs`
- `node tools\validate-autoresponder-synology-manual-evidence.cjs docs\operacional\autoresponder-synology-manual-evidence.example.json`
- Resultado esperado do template sem preenchimento manual: `"ok": false`, `"read_only": true`, `"does_not_touch_synology": true`, `missing_confirmations: 4`.
- `npm.cmd run build`

**Ponto de parada seguro:**
- Nenhuma ação remota foi executada contra Synology, Cloudflare, DSM ou VPS.
- O arquivo de exemplo continua propositalmente com `confirmed: false`, mantendo o gate bloqueado por padrão.

**Próximo passo sugerido:** copiar o template para uma evidência local preenchida manualmente, validar o arquivo e só depois usar as confirmações no safety gate.

---

### 2026-05-05 — Fase 3AE local

**Objetivo da implantação:** preparar uma checklist manual/read-only para coletar as confirmações exigidas pelo safety gate, sem executar ações remotas automáticas.

**Arquivos alterados/criados:**
- `tools/print-autoresponder-synology-manual-checklist.cjs`
- `docs/operacional/2026-05-05-autoresponder-synology-manual-checklist.md`
- `tmp-tests/autoresponder-synology-manual-checklist-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Script local que apenas imprime a checklist em JSON.
- Checklist obrigatória para RAM/swap, túnel canônico, DSM API e ausência de processo legado por `--token`.
- Mapeamento direto das evidências manuais para as variáveis exigidas pelo safety gate.
- Reforço de que esta etapa não altera Synology, não reinicia túnel, não altera DNS, não altera crontab, não reinicia processos e não habilita limpeza de logs.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-synology-manual-checklist-static.test.mjs` falhou porque a checklist ainda não existia.
- `node tmp-tests\autoresponder-synology-manual-checklist-static.test.mjs`
- `node --check tools\print-autoresponder-synology-manual-checklist.cjs`
- `node tools\print-autoresponder-synology-manual-checklist.cjs`
- Resultado da checklist local: `"ok": true`, `"manual_only": true`, `"read_only": true`, `"does_not_execute_remote_checks": true`.
- `npm.cmd run build`

**Ponto de parada seguro:**
- Nenhuma ação remota foi executada contra Synology, Cloudflare, DSM ou VPS.
- O avanço para escrita real continua bloqueado até a checklist manual ser conferida.

**Próximo passo sugerido:** imprimir a checklist local, coletar evidências manuais e só então rodar o safety gate com as confirmações preenchidas.

---

### 2026-05-05 — Fase 3AD local

**Objetivo da implantação:** adicionar uma trava local de segurança para impedir avanço automático para escrita real no Synology sem confirmação manual dos pontos críticos do `Synology.md`.

**Arquivos alterados/criados:**
# Safety gate Synology

Resumo UTF-8 do safety gate Synology: falha fechado; RAM/swap; túnel; DSM API; --token; não altera Synology.

- `tools/check-autoresponder-synology-safety-gate.cjs`
- `docs/operacional/2026-05-05-autoresponder-synology-safety-gate.md`
- `tmp-tests/autoresponder-synology-safety-gate-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Gate local somente leitura que falha fechado por padrão.
- Exigência explícita das confirmações `AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK`, `AUTORESPONDER_SYNOLOGY_TUNNEL_OK`, `AUTORESPONDER_SYNOLOGY_DSM_API_OK` e `AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT`.
- Reforço documental de que o túnel canônico é `mdv-videos`, UUID `7680ed44-a7a9-4700-a37e-2026b3653360`.
- Bloqueios explícitos contra reiniciar túnel, alterar DNS, alterar tarefas agendadas, reiniciar processos ou habilitar limpeza de logs.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-synology-safety-gate-static.test.mjs` falhou porque o gate ainda não existia.
- `node tmp-tests\autoresponder-synology-safety-gate-static.test.mjs`
- `node --check tools\check-autoresponder-synology-safety-gate.cjs`
- `node tools\check-autoresponder-synology-safety-gate.cjs`
- Resultado esperado do gate sem confirmações manuais: `"ok": false`, `"blocked": true`, `"read_only": true`, `missing_confirmations: 4`.
- `npm.cmd run build`

**Ponto de parada seguro:**
- Nenhuma ação remota foi executada contra Synology, Cloudflare, DSM ou VPS.
- O gate foi desenhado para bloquear por padrão enquanto os checks manuais não forem confirmados.

**Próximo passo sugerido:** executar o gate local e manter o avanço bloqueado até RAM/swap, túnel, DSM API e ausência de processo legado por `--token` serem conferidos manualmente.

---

### 2026-05-05 — Fase 3AC local

**Objetivo da implantação:** criar um preflight read-only do Synology para garantir que o próximo passo do archive respeite o runbook `Synology.md` e não derrube a configuração atual.

**Arquivos alterados/criados:**
- `tools/check-autoresponder-synology-readiness.cjs`
- `docs/operacional/2026-05-05-autoresponder-synology-readiness.md`
- `tmp-tests/autoresponder-synology-readiness-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Script local somente leitura que usa `Synology.md` como fonte de verdade.
- Validação documental do túnel canônico `mdv-videos` e UUID `7680ed44-a7a9-4700-a37e-2026b3653360`.
- Validação dos hostnames `dsm-api.xiaomipetrolina.com.br`, `imagens.xiaomipetrolina.com.br` e `videos.mercadodovale.com.br`.
- Confirmação documental do destino `/volume1/backups/autoresponder` e da variável `AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR`.
- Lista explícita de próximos checks manuais, começando por RAM e swap.
- Bloqueios explícitos contra reiniciar túnel, alterar DNS, mexer em `config.yml`, ativar crontab ou habilitar limpeza de logs.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-synology-readiness-static.test.mjs` falhou porque o preflight ainda não existia.
- `node tmp-tests\autoresponder-synology-readiness-static.test.mjs`
- `node --check tools\check-autoresponder-synology-readiness.cjs`
- `node tools\check-autoresponder-synology-readiness.cjs`
- `git diff --check -- tools/check-autoresponder-synology-readiness.cjs docs/operacional/2026-05-05-autoresponder-synology-readiness.md tmp-tests/autoresponder-synology-readiness-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`
- Resultado do preflight: `"ok": true`, `"read_only": true`, `failed: []`.

**Ponto de parada seguro:**
- Nenhuma ação remota foi executada contra Synology, Cloudflare, DSM ou VPS.
- A configuração atual do túnel/Synology não foi alterada.

**Próximo passo sugerido:** rodar o preflight local e, só depois, fazer checks manuais de RAM/swap e saúde do túnel antes de qualquer escrita real no Synology.

---

### 2026-05-05 — Fase 3AB local

**Objetivo da implantação:** preparar validação de escrita real do archive na VPS em destino temporário seguro, antes de usar o caminho definitivo do Synology.

**Arquivos alterados/criados:**
# Teste de escrita controlada na VPS â€” Archive AutoResponder

Resumo do teste controlado: `AUTORESPONDER_ARCHIVE_WRITE_APPLY=1`, `VPS_ROOT_PASSWORD`, `/tmp/mdv-autoresponder-archive-write-test`; nÃ£o usa o caminho definitivo do Synology, nÃ£o ativa crontab, nÃ£o apaga logs. ExecuÃ§Ã£o local: `node tools/test-autoresponder-archive-vps-write.cjs`.

# Teste de escrita controlada na VPS — Archive AutoResponder

Resumo UTF-8 do teste controlado: `AUTORESPONDER_ARCHIVE_WRITE_APPLY=1`, `VPS_ROOT_PASSWORD`, `/tmp/mdv-autoresponder-archive-write-test`; não usa o caminho definitivo do Synology, não ativa crontab, não apaga logs. Execução local: `node tools/test-autoresponder-archive-vps-write.cjs`.

- `tools/test-autoresponder-archive-vps-write.cjs`
- `docs/operacional/2026-05-05-autoresponder-archive-vps-write-test.md`
- `tmp-tests/autoresponder-vps-archive-write-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Executor SSH que, por padrão, só imprime o plano local.
- Aplicação remota condicionada a `AUTORESPONDER_ARCHIVE_WRITE_APPLY=1` e `VPS_ROOT_PASSWORD`.
- Escrita real com `AUTORESPONDER_ARCHIVE_DRY_RUN=0`, mas em `/tmp/mdv-autoresponder-archive-write-test`.
- Execução remota com `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`.
- Validação de arquivo `.json.gz`, `.sha256`, `gzip -t`, `sha256sum`, `JSON.parse` e `archive_date`.
- Bloqueios explícitos: não ativa crontab, não reinicia PM2, não apaga logs e não usa o caminho definitivo do Synology.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-vps-archive-write-static.test.mjs` falhou porque o executor ainda não existia.
- `node tmp-tests\autoresponder-vps-archive-write-static.test.mjs`
- `node --check tools\test-autoresponder-archive-vps-write.cjs`
- `node tools\test-autoresponder-archive-vps-write.cjs`
- `git diff --check -- tools/test-autoresponder-archive-vps-write.cjs docs/operacional/2026-05-05-autoresponder-archive-vps-write-test.md tmp-tests/autoresponder-vps-archive-write-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`
- Execução remota informada pelo usuário: `node tools\test-autoresponder-archive-vps-write.cjs` retornou `"ok": true`, `"dry_run": false`, escreveu em `/tmp/mdv-autoresponder-archive-write-test/2026/05/04.json.gz`, gerou `.sha256`, validou `gzip -t`, checksum, `JSON.parse` e `archive_date: 2026-05-04`.
- Resultado do payload validado: `source: mysql`, `rows: 0`, `sha256: 3e8afdd87a48bc2b619d414e8e09224aeb0437d0c0e27e0e5165ccbec8f5522f`.

**Ponto de parada seguro:**
- A escrita real foi validada apenas em `/tmp/mdv-autoresponder-archive-write-test`.
- Crontab e limpeza de logs continuam bloqueados.

**Próximo passo sugerido:** Fase 3AC — validar o destino real do Synology ou montagem antes de qualquer crontab/limpeza.

---

### 2026-05-05 — Fase 3AA local

**Objetivo da implantação:** preparar correção idempotente do schema do AutoResponder na VPS após o dry-run do archive indicar ausência de `autoresponder_logs`.

**Erro observado na VPS:**
- `Table 'mercadodovale.autoresponder_logs' doesn't exist`

**Arquivos alterados/criados:**
# Schema dry-run na VPS â€” AutoResponder

Contrato do schema: `Table 'mercadodovale.autoresponder_logs' doesn't exist`, `AUTORESPONDER_SCHEMA_INSTALL_APPLY=1`, `VPS_ROOT_PASSWORD`, `node tools/install-autoresponder-schema-vps-dry-run.cjs`; nÃ£o ativa crontab, nÃ£o reinicia PM2, nÃ£o apaga dados.

# Schema dry-run na VPS — AutoResponder

Contrato UTF-8 do schema: `Table 'mercadodovale.autoresponder_logs' doesn't exist`, `AUTORESPONDER_SCHEMA_INSTALL_APPLY=1`, `VPS_ROOT_PASSWORD`, `node tools/install-autoresponder-schema-vps-dry-run.cjs`; não ativa crontab, não reinicia PM2, não apaga dados.

- `tools/install-autoresponder-schema-vps-dry-run.cjs`
- `docs/operacional/2026-05-05-autoresponder-schema-vps-dry-run.md`
- `tmp-tests/autoresponder-vps-schema-install-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Instalador SSH que, por padrão, só imprime o plano local.
- Aplicação remota condicionada a `AUTORESPONDER_SCHEMA_INSTALL_APPLY=1` e `VPS_ROOT_PASSWORD`.
- Criação idempotente das 6 tabelas `autoresponder_*`.
- Seed idempotente da linha singleton `autoresponder_settings id=1`.
- Inclusão idempotente de `products.tag_ids` quando a tabela `products` existir.
- Bloqueios explícitos: não ativa crontab, não reinicia PM2, não apaga dados e não configura token.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-vps-schema-install-static.test.mjs` falhou porque o instalador ainda não existia.
- `node tmp-tests\autoresponder-vps-schema-install-static.test.mjs`
- `node --check tools\install-autoresponder-schema-vps-dry-run.cjs`
- `node tools\install-autoresponder-schema-vps-dry-run.cjs`
- `git diff --check -- tools/install-autoresponder-schema-vps-dry-run.cjs docs/operacional/2026-05-05-autoresponder-schema-vps-dry-run.md tmp-tests/autoresponder-vps-schema-install-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`
- Execução remota informada pelo usuário: `node tools\install-autoresponder-schema-vps-dry-run.cjs` retornou `"ok": true`, banco `mercadodovale`, `tables_before: []`, as 6 tabelas `autoresponder_*` em `tables_after` e `products.tag_ids changed: true`.
- Pendente: repetir o dry-run do archive agora que `autoresponder_logs` existe.

**Ponto de parada seguro:**
- O schema já foi aplicado na VPS em modo idempotente.
- Depois de aplicar o schema, repetir o instalador do archive em `AUTORESPONDER_ARCHIVE_INSTALL_APPLY=1`.

**Próximo passo sugerido:** executar `AUTORESPONDER_SCHEMA_INSTALL_APPLY=1` na VPS e, em seguida, repetir o dry-run do archive.

---

### 2026-05-05 — Fase 3Z local

**Objetivo da implantação:** preparar a instalação controlada do pacote do archive na VPS, mantendo a execução remota em dry-run e bloqueando crontab/limpeza.

# InstalaÃ§Ã£o dry-run na VPS â€” Archive AutoResponder

Contrato da instalaÃ§Ã£o: `VPS_ROOT_PASSWORD`, `AUTORESPONDER_ARCHIVE_INSTALL_APPLY=1`, `node tools/install-autoresponder-archive-vps-dry-run.cjs`; nÃ£o ativa crontab, nÃ£o reinicia PM2, nÃ£o apaga logs, mantem `AUTORESPONDER_ARCHIVE_DRY_RUN=1` e `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`.

# Instalação dry-run na VPS — Archive AutoResponder

Contrato UTF-8 da instalação: `VPS_ROOT_PASSWORD`, `AUTORESPONDER_ARCHIVE_INSTALL_APPLY=1`, `node tools/install-autoresponder-archive-vps-dry-run.cjs`; não ativa crontab, não reinicia PM2, não apaga logs, mantem `AUTORESPONDER_ARCHIVE_DRY_RUN=1` e `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`.

**Arquivos alterados/criados:**
- `tools/install-autoresponder-archive-vps-dry-run.cjs`
- `docs/operacional/2026-05-05-autoresponder-archive-vps-install-dry-run.md`
- `tmp-tests/autoresponder-vps-install-dry-run-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Instalador SSH/SFTP que lê o pacote local em `reports/autoresponder-archive-vps-package/`.
- Modo padrão de plano local, sem conectar na VPS, até definir `AUTORESPONDER_ARCHIVE_INSTALL_APPLY=1`.
- Exigência de `VPS_ROOT_PASSWORD` em variável de ambiente, sem senha hardcoded.
- Cópia remota somente dos arquivos do pacote para `/var/www/mdv-api`.
- Validação remota por `sha256sum`, `chmod +x`, `node --check` e execução com `AUTORESPONDER_ARCHIVE_DRY_RUN=1 AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`.
- Documento operacional com critérios de sucesso e bloqueios explícitos.

**Verificações executadas nesta etapa:**
- Teste vermelho inicial: `node tmp-tests\autoresponder-vps-install-dry-run-static.test.mjs` falhou porque o instalador ainda não existia.
- `node tmp-tests\autoresponder-vps-install-dry-run-static.test.mjs`
- `node --check tools\install-autoresponder-archive-vps-dry-run.cjs`
- `node tools\prepare-autoresponder-archive-vps-package.cjs`
- `git diff --check -- tools/install-autoresponder-archive-vps-dry-run.cjs docs/operacional/2026-05-05-autoresponder-archive-vps-install-dry-run.md tmp-tests/autoresponder-vps-install-dry-run-static.test.mjs Bot_Whatsapp.md`
- `node tools\install-autoresponder-archive-vps-dry-run.cjs`
- `npm.cmd run build`
- Bloqueio confirmado: com `AUTORESPONDER_ARCHIVE_INSTALL_APPLY=1` e sem `VPS_ROOT_PASSWORD`, o instalador aborta antes de conectar na VPS com a mensagem `Missing VPS_ROOT_PASSWORD`.
- Primeira execução remota informou erro esperado de schema ausente: `Table 'mercadodovale.autoresponder_logs' doesn't exist`.
- Após Fase 3AA, execução remota informada pelo usuário: `node tools\install-autoresponder-archive-vps-dry-run.cjs` retornou `"ok": true`, copiou 3 arquivos para `/var/www/mdv-api`, validou `sha256`, aplicou `chmod`, passou `node_check` e executou o archive com `"dry_run": true`, data `2026-05-04`, `rows: 0`, `bytes: 106`, `sha256: 45bdec72c4e1a1d3e2aab82b00fdfa156fef0869d772c13bfa8a379394dc3874`.

**Ponto de parada seguro:**
- Os arquivos do archive já foram copiados e validados na VPS.
- A execução validada ainda foi dry-run: não escreveu arquivo real no Synology e não limpou logs.
- O instalador não ativa crontab, não reinicia PM2 e não habilita limpeza de logs.

**Próximo passo sugerido:** Fase 3AB — preparar validação de escrita real do archive em destino seguro antes de qualquer crontab ou limpeza de logs.

---

### 2026-05-05 — Fase 3Y local

**Objetivo da implantação:** preparar um pacote local de instalação para levar os arquivos de cron à VPS com manifesto e checksums.

**Arquivos alterados/criados:**
- `.gitignore`
# Pacote VPS â€” Archive AutoResponder

Contrato do pacote: `tools/prepare-autoresponder-archive-vps-package.cjs`, `reports/autoresponder-archive-vps-package/manifest.json`, `scp`, `sha256`, `/var/www/mdv-api/cron/archive-autoresponder-logs.cjs`, `/var/www/mdv-api/cron/archive-autoresponder-logs.sh`, `chmod +x /var/www/mdv-api/cron/archive-autoresponder-logs.sh`, `AUTORESPONDER_ARCHIVE_DRY_RUN=1`, NÃƒO ativar crontab nesta fase.

# Pacote VPS — Archive AutoResponder

Contrato UTF-8 do pacote: `tools/prepare-autoresponder-archive-vps-package.cjs`, `reports/autoresponder-archive-vps-package/manifest.json`, `scp`, `sha256`, `/var/www/mdv-api/cron/archive-autoresponder-logs.cjs`, `/var/www/mdv-api/cron/archive-autoresponder-logs.sh`, `chmod +x /var/www/mdv-api/cron/archive-autoresponder-logs.sh`, `AUTORESPONDER_ARCHIVE_DRY_RUN=1`, NÃƒO ativar crontab nesta fase.

- `tools/prepare-autoresponder-archive-vps-package.cjs`
- `docs/operacional/2026-05-05-autoresponder-archive-vps-package.md`
- `tmp-tests/autoresponder-vps-package-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Gerador `tools/prepare-autoresponder-archive-vps-package.cjs`.
- Pacote local em `reports/autoresponder-archive-vps-package/`.
- `manifest.json` com `sha256`, tamanho e caminho de cada arquivo.
- Documento operacional com comandos de `scp`, `chmod +x`, `node --check` e dry-run.
- Pasta do pacote ignorada no Git.
- Reforço explícito para NÃO ativar crontab nesta fase.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-vps-package-static.test.mjs`
- `node --check tools\prepare-autoresponder-archive-vps-package.cjs`
- `node tools\prepare-autoresponder-archive-vps-package.cjs`
- `Get-Content reports\autoresponder-archive-vps-package\manifest.json`
- `git diff --check -- .gitignore tools/prepare-autoresponder-archive-vps-package.cjs docs/operacional/2026-05-05-autoresponder-archive-vps-package.md tmp-tests/autoresponder-vps-package-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- A implantação remota ainda não foi feita.
- O pacote local permite revisar exatamente o que será copiado antes de qualquer acesso à VPS.

**Próximo passo sugerido:** Fase 3Z — executar a cópia/validação na VPS quando autorizado, ainda com `AUTORESPONDER_ARCHIVE_DRY_RUN=1`.

---

### 2026-05-05 — Fase 3X local

**Objetivo da implantação:** preparar a validação operacional do archive na VPS em modo dry-run, sem ativar cron e sem limpar logs.

# ValidaÃ§Ã£o VPS â€” Archive AutoResponder em dry-run

Contrato do dry-run: `AUTORESPONDER_ARCHIVE_DRY_RUN=1`, `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`, `node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs --self-test`, `AUTORESPONDER_ARCHIVE_DRY_RUN=1 node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs YYYY-MM-DD`, `node --check /var/www/mdv-api/cron/archive-autoresponder-logs.cjs`, `crontab -l`, NÃƒO adicionar ainda crontab, destino `/volume1/backups/autoresponder/YYYY/MM/DD.json.gz`, limpeza `cleanup skipped`.

# Validação VPS — Archive AutoResponder em dry-run

Contrato UTF-8 do dry-run: `AUTORESPONDER_ARCHIVE_DRY_RUN=1`, `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`, `node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs --self-test`, `AUTORESPONDER_ARCHIVE_DRY_RUN=1 node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs YYYY-MM-DD`, `node --check /var/www/mdv-api/cron/archive-autoresponder-logs.cjs`, `crontab -l`, NÃƒO adicionar ainda crontab, destino `/volume1/backups/autoresponder/YYYY/MM/DD.json.gz`, limpeza `cleanup skipped`.

**Arquivos alterados/criados:**
- `docs/operacional/2026-05-05-autoresponder-archive-vps-dry-run.md`
- `tmp-tests/autoresponder-vps-dry-run-doc-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Documento operacional com passo a passo para validar `cron/archive-autoresponder-logs.cjs` na VPS.
- Comandos seguros para `node --check`, `--self-test` e dry-run contra o banco.
- Variáveis recomendadas `AUTORESPONDER_ARCHIVE_DRY_RUN=1` e `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`.
- Aviso explícito para NÃO adicionar ainda a linha do crontab.
- Critérios objetivos para só depois avançar à execução real e ao crontab.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-vps-dry-run-doc-static.test.mjs`
- `git diff --check -- docs/operacional/2026-05-05-autoresponder-archive-vps-dry-run.md tmp-tests/autoresponder-vps-dry-run-doc-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Já temos o roteiro para testar na VPS sem risco operacional.
- Ainda falta executar os comandos na VPS, validar escrita real no Synology e só então configurar crontab.

**Próximo passo sugerido:** Fase 3Y — preparar deploy/instalação controlada dos arquivos de cron na VPS ou executar a validação manual quando autorizado.

---

### 2026-05-05 — Fase 3W local

**Objetivo da implantação:** permitir validação local do archive sem conectar no banco, sem escrever no Synology real e sem depender da VPS.

**Arquivos alterados/criados:**
- `.gitignore`
- `cron/archive-autoresponder-logs.cjs`
- `tmp-tests/autoresponder-archive-self-test-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Modo `node cron/archive-autoresponder-logs.cjs --self-test` para gerar um archive de amostra.
- Escrita do self-test em `AUTORESPONDER_ARCHIVE_SELF_TEST_DIR` ou pasta temporária do sistema.
- Reaproveitamento da mesma rotina de gzip/checksum usada pelo archive real.
- Verificação do checksum e leitura via `zlib.gunzipSync` logo após gerar o arquivo.
- Saída JSON com `self_test: true`, `archive_date` e quantidade de linhas verificadas.
- Pasta `tmp-tests/archive-self-test-output/` ignorada no Git para guardar saídas locais do self-test.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-archive-self-test-static.test.mjs`
- `node tmp-tests\autoresponder-archive-cron-static.test.mjs`
- `node --check cron\archive-autoresponder-logs.cjs`
- `node cron\archive-autoresponder-logs.cjs --self-test` com `AUTORESPONDER_ARCHIVE_SELF_TEST_DIR=tmp-tests/archive-self-test-output`
- `git diff --check -- .gitignore cron/archive-autoresponder-logs.cjs tmp-tests/autoresponder-archive-self-test-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Já é possível provar localmente que o formato `.json.gz` e o checksum funcionam antes de levar para a VPS.
- Ainda falta rodar contra banco real da VPS e instalar no crontab.

**Próximo passo sugerido:** Fase 3X — preparar instalação/validação na VPS com `AUTORESPONDER_ARCHIVE_DRY_RUN=1`.

---

### 2026-05-05 — Fase 3V local

**Objetivo da implantação:** criar a base segura do archive diário de logs do AutoResponder sem ativar limpeza automática.

**Arquivos alterados/criados:**
- `cron/archive-autoresponder-logs.cjs`
- `cron/archive-autoresponder-logs.sh`
- `tmp-tests/autoresponder-archive-cron-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Script Node `cron/archive-autoresponder-logs.cjs` para exportar `autoresponder_logs` de um dia em JSON compactado.
- Wrapper shell `cron/archive-autoresponder-logs.sh` para uso futuro no crontab da VPS.
- Geração de arquivo `.json.gz` no padrão `AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR/YYYY/MM/DD.json.gz`.
- Geração de checksum `.sha256` ao lado do archive.
- Suporte a data manual por argumento (`YYYY-MM-DD`) ou dia anterior em BRT por padrão.
- Variável `AUTORESPONDER_ARCHIVE_DRY_RUN=1` para simular sem escrever arquivo.
- Limpeza de logs antigos propositalmente não implementada nesta fase, mesmo com `AUTORESPONDER_ARCHIVE_DELETE_ENABLED`.
- Checklist do script de cron atualizado como base local criada, ainda pendente de instalação/validação na VPS.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-archive-cron-static.test.mjs`
- `node --check cron\archive-autoresponder-logs.cjs`
- `node tmp-tests\autoresponder-synology-archive-static.test.mjs`
- `git diff --check -- cron/archive-autoresponder-logs.cjs cron/archive-autoresponder-logs.sh tmp-tests/autoresponder-archive-cron-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- O projeto já tem o script que gera o archive esperado pelo endpoint `source=synology`.
- Ainda faltam SSH key/SCP ou montagem Synology real, crontab na VPS, teste manual na VPS e só depois a etapa de limpeza segura dos logs antigos.

**Próximo passo sugerido:** Fase 3W — validar o script em modo dry-run/local e preparar instruções de instalação na VPS.

---

### 2026-05-05 — Fase 3U local

**Objetivo da implantação:** permitir que a aba Estatísticas consulte um dia específico do histórico Synology.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-stats-date-filter-static.test.mjs`
- `tmp-tests/autoresponder-stats-synology-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Seletor de data na aba Estatísticas quando a fonte selecionada é Synology.
- Estado `statsFrom` inicializado com o dia anterior.
- `autoResponderService.getStats()` agora recebe `from` somente quando `statsSource === 'synology'`.
- Recarregamento automático dos KPIs ao trocar a data do archive.
- Teste estático antigo ajustado para cobrir o novo filtro `from`.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-stats-date-filter-static.test.mjs`
- `node tmp-tests\autoresponder-stats-synology-static.test.mjs`
- `node tmp-tests\autoresponder-stats-tab-static.test.mjs`
- `git diff --check -- pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-stats-date-filter-static.test.mjs tmp-tests/autoresponder-stats-synology-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- A UI já envia `from=YYYY-MM-DD` para o endpoint Synology.
- Ainda falta criar o script/cron que gera o arquivo diário no caminho esperado.

**Próximo passo sugerido:** Fase 3V — criar script local/VPS de archive diário sem ativar limpeza automática ainda.

---

### 2026-05-05 — Fase 3T local

**Objetivo da implantação:** iniciar a leitura real do histórico Synology para estatísticas, de forma segura e limitada a arquivos `.json.gz` existentes por data.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `types/autoResponder.ts`
- `tmp-tests/autoresponder-synology-archive-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `GET /autoresponder/stats?source=synology&from=YYYY-MM-DD` agora valida a data antes de montar o caminho.
- Leitura segura de `.json.gz` em `AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR/YYYY/MM/DD.json.gz`.
- Suporte a payload arquivado como array direto, `{ logs: [] }` ou `{ rows: [] }`.
- Agregação local do archive para `summary`, `byIntent`, `topRules` e `topProducts`.
- Resposta segura com `warning` quando `from` não vem, a data é inválida, o arquivo não existe ou a leitura falha.
- Tipo `AutoResponderStats` ganhou `archive_date`.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-synology-archive-static.test.mjs`
- `node tmp-tests\autoresponder-stats-synology-static.test.mjs`
- `node tmp-tests\autoresponder-stats-tab-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `node --check vps_server.cjs`
- `git diff --check -- vps_server.cjs types/autoResponder.ts tmp-tests/autoresponder-synology-archive-static.test.mjs tmp-tests/autoresponder-stats-synology-static.test.mjs tmp-tests/autoresponder-stats-tab-static.test.mjs services/autoResponderService.ts pages/admin/AutoResponderPage.tsx Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- A API já consegue ler um archive Synology existente sem depender do MySQL.
- A criação diária do `.json.gz`, envio para o Synology e limpeza automática dos logs antigos ainda ficam pendentes para uma fase própria.

**Próximo passo sugerido:** Fase 3U — criar script/cron de archive ou adicionar seletor de data na aba Estatísticas.

---

### 2026-05-05 — Fase 3S local

**Objetivo da implantação:** preparar o caminho do histórico Synology nas estatísticas sem quebrar a tela enquanto o archive real ainda não existe.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `services/autoResponderService.ts`
- `types/autoResponder.ts`
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-stats-synology-static.test.mjs`
- `tmp-tests/autoresponder-stats-tab-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `GET /autoresponder/stats` agora reconhece `source=mysql|synology`.
- Fonte `mysql` segue retornando os dados dos últimos 7 dias com `source: 'mysql'`.
- Fonte `synology` retorna estrutura vazia segura com `source: 'synology'` e aviso operacional enquanto os arquivos históricos não existem.
- `autoResponderService.getStats()` passou a aceitar filtros `source` e `from`.
- Tipo `AutoResponderStats` ganhou `source` e `warning`.
- Aba Estatísticas ganhou switch MySQL/Synology e exibe o aviso retornado pela API.
- Checklist do endpoint e do switch Synology atualizado.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-stats-synology-static.test.mjs`
- `node tmp-tests\autoresponder-stats-tab-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `node --check vps_server.cjs`
- `git diff --check -- vps_server.cjs services/autoResponderService.ts types/autoResponder.ts pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-stats-synology-static.test.mjs tmp-tests/autoresponder-stats-tab-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Front e API já suportam a seleção da fonte histórica sem erro.
- Leitura real dos arquivos `.json.gz` do Synology ainda depende do cron/archive e fica pendente.

**Próximo passo sugerido:** Fase 3T — implementar archive real de logs ou preparar deploy/validação na VPS.

---

### 2026-05-05 — Fase 3R local

**Objetivo da implantação:** consolidar a documentação e a cobertura estática do contrato de edição de Bloqueados após a Fase 3P.

**Arquivos alterados/criados:**
- `tmp-tests/autoresponder-service-static.test.mjs`
- `tmp-tests/autoresponder-blocklist-edit-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Teste geral do `autoResponderService` passou a exigir `updateBlocklistEntry`.
- Teste da edição de Bloqueados passou a exigir documentação do endpoint `PATCH /autoresponder/blocklist/:id`.
- Checklist de endpoints da Blocklist atualizado com o `PATCH` que já foi implementado.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-blocklist-edit-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `git diff --check -- tmp-tests/autoresponder-service-static.test.mjs tmp-tests/autoresponder-blocklist-edit-static.test.mjs Bot_Whatsapp.md`

**Ponto de parada seguro:**
- Código, testes estáticos e documentação ficaram alinhados para edição de bloqueios.

**Próximo passo sugerido:** Fase 3S — preparar validação real em VPS/celular ou avançar no histórico Synology das estatísticas.

---

### 2026-05-05 — Fase 3Q local

**Objetivo da implantação:** alinhar a Curadoria ao fluxo esperado do admin, abrindo o modal de resposta pré-preenchido antes de criar a regra.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-curation-modal-flow-static.test.mjs`
- `tmp-tests/autoresponder-curation-tab-static.test.mjs`
- `tmp-tests/autoresponder-phase3-admin-coverage-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Botão "Criar resposta" da Curadoria deixa de criar regra direto sem revisão.
- A pergunta sem resposta agora abre o modal de Respostas com nome, padrão, tipo textual e status inativo preenchidos.
- Aviso "Revise e salve a resposta sugerida" orienta o operador antes do salvamento.
- Ao salvar uma nova regra a partir do modal, a pergunta correspondente sai da lista local de curadoria.
- Testes estáticos atualizados para proteger o novo fluxo de revisão antes de salvar.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-curation-modal-flow-static.test.mjs`
- `node tmp-tests\autoresponder-curation-tab-static.test.mjs`
- `node tmp-tests\autoresponder-phase3-admin-coverage-static.test.mjs`
- `node tmp-tests\autoresponder-rules-crud-static.test.mjs`
- `git diff --check -- pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-curation-modal-flow-static.test.mjs tmp-tests/autoresponder-curation-tab-static.test.mjs tmp-tests/autoresponder-phase3-admin-coverage-static.test.mjs tmp-tests/autoresponder-rules-crud-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Fluxo local da Curadoria ficou coerente com o checklist da tela.
- Curadoria end-to-end com servidor, banco e clique real ainda fica pendente.

**Próximo passo sugerido:** Fase 3R — executar teste real UI/API da Curadoria ou avançar para preparação de deploy/VPS.

---

### 2026-05-05 — Fase 3P local

**Objetivo da implantação:** completar a edição de Bloqueados no admin para deixar a aba mais próxima de CRUD real.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `services/autoResponderService.ts`
- `types/autoResponder.ts`
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-blocklist-edit-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Endpoint `PATCH /autoresponder/blocklist/:id` criado na VPS.
- `autoResponderService.updateBlocklistEntry()` adicionado.
- Tipo `AutoResponderBlocklistUpdate` criado.
- Tabela de Bloqueados ganhou botão "Editar".
- Modal de bloqueio agora alterna entre "Adicionar bloqueio" e "Editar bloqueio".
- Ao salvar edição, a lista de bloqueios recarrega pelo fluxo existente.
- Checklist da aba Bloqueados atualizado no item de edição.

**Verificações executadas nesta etapa:**
- `node --check vps_server.cjs`
- `node tmp-tests\autoresponder-blocklist-edit-static.test.mjs`
- `node tmp-tests\autoresponder-blocklist-tab-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `git diff --check -- vps_server.cjs services/autoResponderService.ts types/autoResponder.ts pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-blocklist-edit-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Edição de bloqueio implementada localmente com cobertura estática.
- Teste real HTTP/UI com banco ainda fica pendente para etapa end-to-end.

**Próximo passo sugerido:** Fase 3Q — revisar checklist global de CRUD/admin ou avançar para curadoria end-to-end.

---

### 2026-05-05 — Fase 3O local

**Objetivo da implantação:** completar o CRUD visual da aba Respostas no admin, adicionando a exclusão de regras com recarregamento seguro.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-rules-crud-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- A tabela de Respostas ganhou ação "Excluir" ao lado de "Editar".
- Exclusão pede confirmação via `window.confirm` antes de chamar a VPS.
- Estado `deletingRuleId` bloqueia apenas o item em remoção e mostra "Excluindo...".
- Após excluir, a tela recarrega regras e estatísticas.
- Checklist da aba Respostas atualizado para criar, editar e excluir com recarregamento da lista.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-rules-crud-static.test.mjs`
- `node tmp-tests\autoresponder-rules-tab-static.test.mjs`
- `node tmp-tests\autoresponder-phase3-admin-coverage-static.test.mjs`
- `npm.cmd run build`

**Ponto de parada seguro:**
- CRUD visual da aba Respostas completo em cobertura estática/local.
- Teste real com servidor e banco ainda fica para a fase end-to-end.

**Próximo passo sugerido:** Fase 3P — cobrir CRUD completo das demais abas ou executar teste HTTP/UI real quando o ambiente estiver pronto.

---

### 2026-05-05 — Fase 3N local

**Objetivo da implantação:** ligar o endpoint de anexo do AutoResponder ao fluxo Synology já existente na VPS, preservando fallback local para não quebrar o admin se credenciais, túnel ou NAS falharem.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `types/autoResponder.ts`
- `tmp-tests/autoresponder-attachment-synology-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Endpoint `POST /autoresponder/upload-attachment` agora tenta enviar o arquivo para o Synology quando `SYNOLOGY_USER` e `SYNOLOGY_PASS` existem.
- Nome do anexo padronizado com prefixo `autoresponder-` e extensão sanitizada.
- Resposta do upload informa `storage: 'synology'` quando o envio ao NAS conclui.
- Se Synology falhar ou não estiver configurado, o endpoint mantém o fallback local em `uploads/autoresponder/attachments` e retorna `storage: 'local'`.
- Tipo `AutoResponderAttachmentUpload` atualizado para expor a origem do armazenamento.
- Checklist e seção de storage atualizados com a cautela do fallback.

**Verificações executadas nesta etapa:**
- `node --check vps_server.cjs`
- `node tmp-tests\autoresponder-attachment-synology-static.test.mjs`
- `node tmp-tests\autoresponder-rule-attachment-upload-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `git diff --check -- vps_server.cjs types/autoResponder.ts pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-rule-attachment-upload-static.test.mjs tmp-tests/autoresponder-attachment-synology-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Integração local preparada com fallback seguro.
- Ainda falta teste real em VPS/NAS para confirmar publicação no domínio `imagens.xiaomipetrolina.com.br`.

**Próximo passo sugerido:** Fase 3O — validar upload real na VPS ou avançar para CRUD end-to-end da tela admin se o ambiente Synology não estiver disponível.

---

### 2026-05-05 — Fase 3M local

**Objetivo da implantação:** habilitar upload de imagem dentro do modal de respostas usando o endpoint local já existente na VPS, sem declarar a integração Synology como concluída antes de validação real.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-rule-attachment-upload-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Campos `attachment_url` e `attachment_caption` entram no formulário de regra e no payload de criação/edição.
- Botão "Enviar imagem" no modal chama `autoResponderService.uploadAttachment`.
- Modal mostra URL do anexo enviado, legenda editável e ação "Remover anexo".
- Teste estático novo garante que o fluxo do modal continue conectado ao serviço de upload.
- Checklist atualizado somente no item de upload dentro do modal.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-rule-attachment-upload-static.test.mjs`
- `node tmp-tests\autoresponder-rules-tab-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `node tmp-tests\autoresponder-phase3-admin-coverage-static.test.mjs`
- `git diff --check -- pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-rule-attachment-upload-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Upload visual/administrativo do modal implementado localmente.
- Upload real indo para Synology segue pendente, porque o endpoint atual ainda grava em `uploads/autoresponder/attachments` e precisa de integração/validação externa antes de marcar como feito.

**Próximo passo sugerido:** Fase 3N — decidir e validar o caminho real de armazenamento dos anexos no Synology.

---

### 2026-05-04 — Fase 3L local

**Objetivo da implantação:** transformar em verificação rastreável os fluxos já existentes no admin e separar o que é cobertura estática do que ainda precisa de teste real.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-phase3-admin-coverage-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Teste estático cobrindo filtros das listagens de Respostas, Conversas, Bloqueados, Curadoria e Tags.
- Teste estático cobrindo os templates rápidos: Saudação, Produto por tag e Busca livre.
- Teste estático cobrindo o fluxo de Curadoria criando regra como rascunho inativo.
- Rótulo do seletor de templates ajustado de "Usar template" para "Aplicar template".
- Checklist da Fase 3 atualizado apenas nos itens comprovados por tela/código.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-phase3-admin-coverage-static.test.mjs`
- `node tmp-tests\autoresponder-rules-tab-static.test.mjs`
- `node tmp-tests\autoresponder-curation-tab-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `git diff --check -- pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-phase3-admin-coverage-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Fase 3L concluída localmente e documentada.
- Curadoria end-to-end, CRUD completo e upload Synology continuam pendentes por dependerem de fluxo real ou integração externa.

**Próximo passo sugerido:** Fase 3M — revisar upload de anexos e decidir o caminho Synology com teste antes de tocar na integração.

---

### 2026-05-04 — Fase 3K local

**Objetivo da implantação:** adicionar atualização automática da aba Conversas para aproximar o admin de um acompanhamento em tempo real.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-conversation-polling-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Estado local `activeAutoResponderTab` sincronizado pelo `Tabs onChange`.
- Polling de conversas a cada 5 segundos somente quando a aba Conversas está ativa.
- Limpeza do intervalo ao sair da aba ou desmontar a página.
- Checklist da aba Conversas e dos testes da Fase 3 atualizado.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-conversation-polling-static.test.mjs`
- `node tmp-tests\autoresponder-conversations-tab-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `git diff --check -- pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-conversation-polling-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Fase 3K concluída localmente e documentada.

**Próximo passo sugerido:** Fase 3L — ampliar testes estáticos dos fluxos esperados da Fase 3 e revisar upload/Synology.

---

### 2026-05-04 — Fase 3J local

**Objetivo da implantação:** iniciar a integração das tags de produto do AutoResponder na tela de edição de produto.

**Arquivos alterados/criados:**
- `pages/admin/products/ProductDetailPage.tsx`
- `types/product.ts`
- `services/products.ts`
- `tmp-tests/autoresponder-product-tagpicker-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Página de edição de produto localizada: `ProductDetailPage`.
- Painel `ProductTagPicker` adicionado fora do submit principal do `ProductForm`.
- Tags carregadas via `autoResponderService.listTags({ scope: 'product' })`.
- Salvamento conectado ao endpoint `PATCH /products/:id/tags` por `autoResponderService.updateProductTags`.
- `Product.tag_ids` exposto no tipo e normalizado em `productService`.
- Checklist da integração TagPicker em produtos atualizado.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-product-tagpicker-static.test.mjs`
- `git diff --check -- pages/admin/products/ProductDetailPage.tsx types/product.ts services/products.ts tmp-tests/autoresponder-product-tagpicker-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Observação de revisão visual:**
- A tentativa de revisar a tela no Browser Use foi bloqueada pela política do navegador embutido antes de carregar a página. Não foi feito contorno por outro caminho.

**Ponto de parada seguro:**
- Fase 3J concluída localmente e documentada.
- A edição de tags do produto ficou isolada do formulário principal para reduzir risco de regressão.

**Próximo passo sugerido:** Fase 3K — validar o fluxo real de tags de produto com dados locais e preparar testes end-to-end do AutoResponder.

---

### 2026-05-04 — Fase 3I local

**Objetivo da implantação:** finalizar os acabamentos da aba Configurações do AutoResponder com edição segura do mapeamento palavra → tag e acesso direto aos horários da empresa.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-settings-polish-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Editor visual para `product_tag_keywords`, evitando edição manual de JSON.
- Conversão das linhas do admin para mapa `{ tagId: [palavras] }`, compatível com o backend já implantado.
- Leitura segura de mapas antigos por tag ou por palavra-chave.
- Seletor usando somente tags com escopo `product`.
- Link da aba Configurações para `/admin/settings/company`.
- Checklist da aba Configurações atualizado.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-settings-polish-static.test.mjs`
- `node tmp-tests\autoresponder-settings-tab-static.test.mjs`
- `node tmp-tests\autoresponder-stats-tab-static.test.mjs`
- `node tmp-tests\autoresponder-tags-tab-static.test.mjs`
- `node tmp-tests\autoresponder-curation-tab-static.test.mjs`
- `node tmp-tests\autoresponder-blocklist-tab-static.test.mjs`
- `node tmp-tests\autoresponder-conversations-tab-static.test.mjs`
- `node tmp-tests\autoresponder-rules-tab-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node --check vps_server.cjs`
- `git diff --check -- pages/admin/AutoResponderPage.tsx tmp-tests/autoresponder-settings-polish-static.test.mjs Bot_Whatsapp.md`
- `npm.cmd run build`

**Ponto de parada seguro:**
- Fase 3I concluída localmente e documentada.
- A aba Configurações agora cobre todos os blocos planejados no escopo atual.

**Próximo passo sugerido:** Fase 3J — revisar visualmente a tela no navegador e iniciar a integração TagPicker em produtos.

---

### 2026-05-04 — Fase 3H local

**Objetivo da implantação:** tornar a aba Configurações editável para ajustar os principais parâmetros do AutoResponder direto pelo admin.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-settings-tab-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Formulário local `SettingsFormState` derivado de `AutoResponderSettings`.
- Salvamento via `autoResponderService.updateSettings()`.
- Bloco "Atendimento humano" com mensagens em horário/fora do horário e pausa.
- Bloco "Saudação" com prefixo e fallback.
- Bloco "Auto-pausa" com limite, duração e mensagem.
- Bloco "Limites" com máximo de respostas por conversa e janela em horas.
- Bloco "Imagens" com toggle e máximo de imagens por resposta.
- Blocos de listas numeradas e arquivamento Synology, usando campos já existentes no backend.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-settings-tab-static.test.mjs`
- `node tmp-tests\autoresponder-stats-tab-static.test.mjs`
- `node tmp-tests\autoresponder-tags-tab-static.test.mjs`
- `node tmp-tests\autoresponder-curation-tab-static.test.mjs`
- `node tmp-tests\autoresponder-blocklist-tab-static.test.mjs`
- `node tmp-tests\autoresponder-conversations-tab-static.test.mjs`
- `node tmp-tests\autoresponder-rules-tab-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `npm.cmd run build`
- `git diff --check`

**Ponto de parada seguro:**
- Fase 3H concluída localmente e documentada.
- O mapeamento palavra → tag ainda não foi colocado na UI para evitar edição acidental de JSON complexo.
- O link para horários da empresa continua pendente para uma etapa pequena de acabamento.

**Próximo passo sugerido:** Fase 3I — acabamentos da página admin: mapeamento palavra → tag, link de horários e revisão visual.

---

### 2026-05-04 — Fase 3G local

**Objetivo da implantação:** enriquecer a aba Estatísticas com leitura operacional dos últimos 7 dias, incluindo KPIs, distribuição por intenção e rankings.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `types/autoResponder.ts`
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-stats-tab-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `GET /autoresponder/stats` agora retorna `topProducts`.
- Agregação segura de produtos perguntados a partir de `autoresponder_logs.matched_products`.
- `summary.avg_response_time_ms` incluído no contrato de estatísticas.
- Cards de KPIs na aba: mensagens, contatos únicos, taxa de resposta, fallbacks e tempo médio.
- Gráfico visual por intent em barras horizontais.
- Ranking de produtos perguntados.
- Ranking de regras por acertos.
- Sinalização visual de que o histórico Synology fica para fase futura.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-stats-tab-static.test.mjs`
- `node tmp-tests\autoresponder-tags-tab-static.test.mjs`
- `node tmp-tests\autoresponder-curation-tab-static.test.mjs`
- `node tmp-tests\autoresponder-blocklist-tab-static.test.mjs`
- `node tmp-tests\autoresponder-conversations-tab-static.test.mjs`
- `node tmp-tests\autoresponder-rules-tab-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node --check vps_server.cjs`
- `npm.cmd run build`
- `git diff --check`

**Ponto de parada seguro:**
- Fase 3G concluída localmente e documentada.
- O gráfico é em barras horizontais, representando a distribuição por intent sem adicionar biblioteca de gráficos.
- `?source=synology` ainda não foi implementado; permanece como item pendente.

**Próximo passo sugerido:** Fase 3H — Configurações do AutoResponder.

---

### 2026-05-04 — Fase 3F local

**Objetivo da implantação:** tornar a aba Tags funcional para organizar etiquetas usadas por regras, conversas e produtos.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-tags-tab-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Tabela de tags com nome, cor, escopos, descrição, visibilidade no bot e ações.
- Busca local por nome, descrição, cor e escopos.
- Modal de criação e edição com seletor de cor.
- Multi-select de escopos: Conversas, Produtos e Regras.
- Salvamento via `createTag()` e `updateTag()`.
- Exclusão com confirmação via `deleteTag()`.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-tags-tab-static.test.mjs`
- `node tmp-tests\autoresponder-curation-tab-static.test.mjs`
- `node tmp-tests\autoresponder-blocklist-tab-static.test.mjs`
- `node tmp-tests\autoresponder-conversations-tab-static.test.mjs`
- `node tmp-tests\autoresponder-rules-tab-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `npm.cmd run build`
- `git diff --check`

**Ponto de parada seguro:**
- Fase 3F concluída localmente e documentada.
- Exclusão de tag é direta no backend; o admin deve usar com cuidado quando a tag já estiver vinculada a regras, conversas ou produtos.
- A gestão de tags de produtos na tela de produtos fica para fase própria.

**Próximo passo sugerido:** Fase 3G — enriquecer Estatísticas com KPIs, gráficos simples e rankings.

---

### 2026-05-04 — Fase 3E local

**Objetivo da implantação:** tornar a aba Curadoria funcional para revisar perguntas sem resposta e transformar dúvidas recorrentes em respostas automáticas revisáveis.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-curation-tab-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Carregamento de perguntas sem resposta com `autoResponderService.listUnanswered({ limit: 100 })`.
- Tabela com pergunta, frequência, última ocorrência e ações.
- Busca local por texto da pergunta.
- Botão "Criar resposta" usando `createRuleFromQuestion()` para gerar regra como rascunho inativo.
- Atualização local da lista de regras e remoção da pergunta curada da tela.
- Botão "Ignorar" para ocultar uma pergunta apenas na sessão atual.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-curation-tab-static.test.mjs`
- `node tmp-tests\autoresponder-blocklist-tab-static.test.mjs`
- `node tmp-tests\autoresponder-conversations-tab-static.test.mjs`
- `node tmp-tests\autoresponder-rules-tab-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `npm.cmd run build`
- `git diff --check`

**Ponto de parada seguro:**
- Fase 3E concluída localmente e documentada.
- A criação por curadoria ainda não abre o modal de edição automaticamente; ela cria a regra inativa para revisão na aba Respostas.
- Ignorar é local da sessão; não persiste uma lista de perguntas ignoradas no banco.

**Próximo passo sugerido:** Fase 3F — implementar Tags com CRUD básico, seletor de cor e escopos.

---

### 2026-05-04 — Fase 3D local

**Objetivo da implantação:** tornar a aba Bloqueados funcional para consultar, cadastrar, importar e remover bloqueios do AutoResponder.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-blocklist-tab-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Carregamento de bloqueados com `autoResponderService.listBlocklist()`.
- Tabela com padrão, tipo, nome, motivo, status e ação de exclusão.
- Busca local por número/padrão, tipo, nome e motivo.
- Cadastro manual via modal usando `createBlocklistEntry()`.
- Importação em massa via textarea usando `bulkCreateBlocklist()`.
- Exclusão com confirmação usando `deleteBlocklistEntry()`.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-blocklist-tab-static.test.mjs`
- `node tmp-tests\autoresponder-conversations-tab-static.test.mjs`
- `node tmp-tests\autoresponder-rules-tab-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `node tmp-tests\autoresponder-service-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `npm.cmd run build`
- `git diff --check`

**Ponto de parada seguro:**
- Fase 3D concluída localmente e documentada.
- Ainda não há edição de bloqueio existente; para alterar, remover e criar novamente.
- Importação em massa aceita uma entrada por linha no formato simples do backend.

**Próximo passo sugerido:** Fase 3E — implementar Curadoria com perguntas sem resposta e criação de regra a partir da pergunta.

---

### 2026-05-04 — Fase 3C local

**Objetivo da implantação:** tornar a aba Conversas funcional para acompanhar contatos e executar ações rápidas de atendimento.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `types/autoResponder.ts`
- `tmp-tests/autoresponder-conversations-tab-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Carregamento de conversas com `autoResponderService.listConversations({ limit: 100 })`.
- Cards com sender, nome, última mensagem, status ativo/pausado, métricas e tags.
- Busca local por número, nome, última mensagem e motivo de pausa.
- Filtros por status e tag de escopo `conversation`.
- Ações de pausa por 1h, 4h e 24h.
- Ação de liberar conversa com `resumeConversation()`.
- Atribuição de tags com rascunho local e salvamento via `setConversationTags()`.
- Ação de bloquear conversa via `createBlocklistEntry()` e pausa longa.

**Verificações executadas nesta etapa:**

```bash
node tmp-tests/autoresponder-conversations-tab-static.test.mjs
```

**Resultado esperado atual:**
- O admin já consegue ver conversas recentes e controlar temporariamente o atendimento automático por contato.
- Tags de conversa podem ser atribuídas sem acessar o banco direto.

**Importante:**
- "Indefinido" ainda está representado como bloqueio + pausa longa, porque o endpoint atual de pausa exige minutos.
- Polling a cada 5s ainda não entrou.
- Bloquear ainda não abre modal de motivo; usa motivo padrão "Bloqueado pela aba Conversas".

**Próximo passo sugerido:** Fase 3D — implementar aba Bloqueados com tabela, cadastro manual e importação em massa.

---

### 2026-05-04 — Fase 3B local

**Objetivo da implantação:** tornar a aba Respostas funcional para listar, filtrar, criar e editar regras do AutoResponder.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `tmp-tests/autoresponder-rules-tab-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Carregamento de regras com `autoResponderService.listRules()`.
- Carregamento de tags com `autoResponderService.listTags()`.
- Tabela com nome, palavras-chave, tipo de resposta, acertos, status e ação de edição.
- Busca local por nome, palavras-chave, resposta e consulta fixa.
- Filtros por status e tag.
- Modal inicial para nova resposta e edição de resposta existente.
- Templates rápidos para Saudação, Produto por tag e Busca livre.
- Preview ao vivo do texto de resposta.
- Salvamento via `createRule()` e `updateRule()`, recarregando regras e estatísticas depois.

**Verificações executadas nesta etapa:**

```bash
node tmp-tests/autoresponder-rules-tab-static.test.mjs
```

**Resultado esperado atual:**
- O admin já consegue administrar regras básicas sem mexer direto no banco.
- Regras de texto, busca por tag e busca por produto já têm campos iniciais no modal.

**Importante:**
- Upload de anexo dentro do modal ainda não entrou.
- Exclusão/duplicação de regras ainda não entrou.
- Validação é mínima: exige nome e palavras-chave antes de salvar.

**Próximo passo sugerido:** Fase 3C — implementar a aba Conversas com listagem, filtros por status/tag e ações de pausar/liberar/atribuir tags.

---

### 2026-05-04 — Fase 3A local

**Objetivo da implantação:** iniciar a página admin do AutoResponder com rota, menu e estrutura visual de abas.

**Arquivos alterados/criados:**
- `pages/admin/AutoResponderPage.tsx`
- `routes/index.tsx`
- `layouts/AdminLayout.tsx`
- `tmp-tests/autoresponder-admin-page-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Página `/admin/atendimento-automatico` criada e protegida pelo fluxo admin existente.
- Item "Atendimento Auto" adicionado no menu em Marketing & Loja.
- Shell com as 7 abas planejadas: Respostas, Conversas, Bloqueados, Curadoria, Tags, Estatísticas e Configurações.
- Carregamento inicial via `autoResponderService.getSettings()`, `getStats()` e `getStoreStatus()`.
- KPIs iniciais de mensagens, contatos únicos, fallbacks e status da loja.
- Botão de atualização manual usando o mesmo carregamento inicial.

**Verificações executadas nesta etapa:**

```bash
node tmp-tests/autoresponder-admin-page-static.test.mjs
npm.cmd run build
```

Verificação visual local: `http://127.0.0.1:5181/admin/atendimento-automatico` abriu com menu, título, KPIs e abas.

**Resultado esperado atual:**
- O admin já consegue abrir a base da página e confirmar se a API responde.
- As abas profundas ainda aparecem como marcadores de fase, aguardando os CRUDs visuais.

**Importante:**
- A Fase 3A não implementa edição de regras/tags/conversas; apenas a estrutura segura para evoluir.
- Se a VPS ou o `x-sync-key` falhar, a página mostra alerta de erro no topo.

**Próximo passo sugerido:** Fase 3B — implementar a aba Respostas com listagem de regras, filtro por tag/status e modal inicial de criação/edição.

---

### 2026-05-04 — Fase 2D local

**Objetivo da implantação:** preparar a camada frontend para consumir os endpoints administrativos do AutoResponder sem ainda criar a tela.

**Arquivos alterados/criados:**
- `services/autoResponderService.ts`
- `types/autoResponder.ts`
- `tmp-tests/autoresponder-service-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Service frontend `autoResponderService` usando o `vpsClient` compartilhado da aplicação.
- Tipos TypeScript para configurações, regras, tags, conversas, bloqueados, curadoria, estatísticas, status da loja e upload.
- Métodos para settings, regras, `rules/from-question`, upload de anexo, tags, conversas, blocklist, unanswered, stats, store-status e tags de produto.
- Filtros de listagem montados com `URLSearchParams`.
- Upload de anexo feito com `vpsClient.upload` e `FormData`.

**Verificações executadas:**

```bash
node tmp-tests/autoresponder-service-static.test.mjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
npm.cmd run build
```

**Resultado esperado atual:**
- A próxima etapa de UI já consegue importar um service único para alimentar todas as abas da página admin.
- A tela não precisa conhecer `x-sync-key`, URL base, auth, proxy ou detalhes de multipart.

**Importante:**
- Ainda não há teste HTTP end-to-end dos endpoints administrativos com servidor rodando.
- Ainda não foi criada a página `/admin/atendimento-automatico`.
- Upload segue apontando para o endpoint local da VPS; envio/arquivo definitivo no Synology continua pendente.

**Próximo passo sugerido:** Fase 3A — criar a estrutura base da página admin com rota, menu e shell de abas, consumindo inicialmente status/configurações pelo service.

---

### 2026-05-04 — Fase 2C local

**Objetivo da implantação:** completar os endpoints de curadoria para criar regras a partir de perguntas e permitir upload básico de anexos.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `POST /autoresponder/rules/from-question` cria uma regra textual a partir de `question` ou de `log_id`.
- Regra criada por curadoria nasce inativa por padrão, salvo se `active` for enviado.
- `POST /autoresponder/upload-attachment` recebe multipart e salva em `uploads/autoresponder/attachments`.
- Upload retorna URL pública em `/images/autoresponder/attachments/{arquivo}` usando `API_BASE_URL`.
- Ambos os endpoints usam `requireSyncKey`.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- A aba Curadoria poderá transformar uma pergunta sem resposta em rascunho de regra.
- A aba Respostas poderá anexar um arquivo público a uma regra via URL.

**Importante:**
- O upload ainda não envia para Synology; por cautela, ficou no storage local público já servido pela VPS.
- Ainda não há teste HTTP end-to-end com multipart real.
- `stats?source=synology` segue pendente.

**Próximo passo sugerido:** Fase 2D — criar testes HTTP controlados para endpoints admin ou iniciar o service frontend `autoResponderService.ts`.

---

### 2026-05-04 — Fase 2B local

**Objetivo da implantação:** completar endpoints administrativos auxiliares para curadoria, estatísticas, status da loja e tags em produtos.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `GET /autoresponder/unanswered` agrupando perguntas com intent `fallback` por frequência.
- `GET /autoresponder/stats` com resumo dos últimos 7 dias, contagem por intent e top regras.
- `GET /autoresponder/store-status` usando o helper local de horário já portado.
- `PATCH /products/:id/tags` substituindo `products.tag_ids`.
- Todos os endpoints usam `requireSyncKey`.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- A futura UI admin já consegue mostrar curadoria básica, KPIs iniciais, preview de horário e editar tags de produto.
- Tags de produto editadas por endpoint já alimentam o webhook de busca por tag.

**Importante:**
- `stats?source=synology` ainda não foi implementado.
- `POST /autoresponder/rules/from-question` e `POST /autoresponder/upload-attachment` entraram na Fase 2C local.
- Ainda não há teste HTTP end-to-end contra servidor rodando.

**Próximo passo sugerido:** Fase 2C — implementar `rules/from-question`, upload de anexo, ou criar testes HTTP controlados dos endpoints antes da UI. Concluído em endpoints básicos na Fase 2C local.

---

### 2026-05-04 — Fase 2A local

**Objetivo da implantação:** iniciar os endpoints administrativos necessários para a futura página `/admin/atendimento-automatico`.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- CRUD inicial de regras: `GET/POST/PATCH/DELETE /autoresponder/rules`.
- Filtros de regras por `active` e `tag_id`.
- CRUD inicial de tags: `GET/POST/PATCH/DELETE /autoresponder/tags`.
- Filtro de tags por `scope`.
- CRUD inicial de bloqueados: `GET/POST/POST bulk/DELETE /autoresponder/blocklist`.
- Listagem de conversas: `GET /autoresponder/conversations` com paginação e filtros por status/tag.
- Ações de conversa: pausar, liberar e substituir tags.
- Todos os endpoints desta etapa usam `requireSyncKey`.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- A futura UI admin já tem rotas básicas para configurar regras, tags, bloqueios e conversas.
- O webhook continua desligado por padrão se `autoresponder_settings.enabled = 0`.

**Importante:**
- Ainda não foram implementados `rules/from-question`, upload de anexo, curadoria, stats, store-status preview e tags em produtos.
- Os endpoints ainda não têm testes HTTP end-to-end, só verificação estática/sintaxe nesta etapa.
- Pausa admin usa duração em minutos; pausa indefinida ainda não entrou.

**Próximo passo sugerido:** Fase 2B — implementar curadoria/stats/store-status e `PATCH /products/:id/tags`, ou criar testes HTTP controlados para os endpoints admin antes da UI. Concluído em endpoints básicos na Fase 2B local.

---

### 2026-05-04 — Fase 1N local

**Objetivo da implantação:** aplicar tags automáticas e anexos/captions definidos nas regras do AutoResponder.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Query de regras agora carrega `auto_apply_tag_id`.
- Helper `appendAutoresponderRuleAttachment()` adiciona `attachment_caption` e `attachment_url` ao texto da resposta como `Anexo: ...`.
- Helper `applyAutoresponderRuleConversationTag()` adiciona `auto_apply_tag_id` em `autoresponder_conversations.tag_ids`, preservando tags existentes e evitando duplicata.
- Regras `text`, `product_by_tag` e `product_search` aplicam tag automática quando configurada.
- Anexos de regra funcionam em formato textual, sem envio de mídia separada.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Uma regra com `auto_apply_tag_id` marca a conversa com a tag configurada.
- Uma regra com `attachment_url` acrescenta o link do anexo na resposta.
- Uma regra com `attachment_caption` acrescenta a legenda antes do link do anexo.

**Importante:**
- O anexo ainda não é enviado como mídia nativa pelo AutoResponder; por enquanto é link textual.
- A tag automática só roda depois do upsert da conversa nos caminhos de regra.

**Próximo passo sugerido:** Fase 2A — iniciar endpoints admin para gerenciar regras, tags, bloqueados e conversas, ou fazer uma rodada de testes manuais controlados do webhook antes. Concluído para endpoints básicos na Fase 2A local.

---

### 2026-05-04 — Fase 1M local

**Objetivo da implantação:** completar o match de `autoresponder_rules` para regras que retornam produtos, não só texto.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Query de regras agora carrega `reply_tag_id` e `reply_search_query`.
- `findAutoresponderRuleMatch()` aceita regras `text`, `product_by_tag` e `product_search`.
- Regras `product_by_tag` usam `matchedRule.reply_tag_id` para buscar produtos ativos por tag.
- Regras `product_search` usam `matchedRule.reply_search_query` para buscar produtos por tokens.
- Logs usam intents específicas: `rule_product_tag` e `rule_product_search`.
- Resultados de regras de produto salvam `last_options_offered` com paginação, mantendo suporte a `1`, `2`, `3` e `mais`.
- Checklist marcou o Passo 9 como concluído para os tipos principais de reply.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Uma regra ativa `reply_type='product_by_tag'` pode responder com produtos de uma tag configurada.
- Uma regra ativa `reply_type='product_search'` pode responder com produtos de uma busca configurada.
- Regras textuais continuam funcionando como antes.

**Importante:**
- `attachment_url`, `attachment_caption` e `auto_apply_tag_id` entraram na Fase 1N local em formato textual/tag de conversa.
- A busca segue textual/SQL simples; agrupamento por `model_id` e parcelamento seguem pendentes.

**Próximo passo sugerido:** Fase 1N — aplicar `auto_apply_tag_id` e anexos de regra, ou iniciar os endpoints admin da Fase 2. Concluído na Fase 1N local.

---

### 2026-05-04 — Fase 1L local

**Objetivo da implantação:** permitir que o cliente peça mais resultados depois de uma lista de produtos, sem aumentar demais a primeira resposta.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `isAutoresponderMoreRequest()` reconhecendo `mais`, `ver mais`, `proximos`, `proximo` e variações.
- Helper `buildAutoresponderOptionsContext()` para salvar itens e metadados de paginação juntos.
- Helper `normalizeAutoresponderOptionsContext()` mantendo compatibilidade com o formato antigo de `last_options_offered`.
- Helper `getAutoresponderOptionsContext()` lendo contexto válido dentro de `numbered_list_validity_minutes`.
- Busca por tag e busca por tokens agora aceitam `offset`.
- Listas iniciais buscam `limit + 1` para saber se há mais resultados.
- Quando houver mais resultados, a resposta orienta: `Responda "mais" para ver outras opcoes.`
- Comando `mais` busca a próxima página, loga intent `more_products` e atualiza `last_options_offered`.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Primeira lista continua curta, com até 5 produtos.
- Se houver mais produtos, o cliente pode responder `mais` para receber a próxima página.
- A resposta numerada continua funcionando para a página atual.

**Importante:**
- O contexto de paginação fica em `last_options_offered` junto dos itens atuais.
- Ainda não há envio real de mídia separada pelo AutoResponder.
- Ainda não há agrupamento por `model_id` ou parcelamento.

**Próximo passo sugerido:** Fase 1M — revisar regra `product_by_tag`/`product_search` dentro de `autoresponder_rules` ou iniciar endpoints admin da Fase 2. Concluído para regras de produto na Fase 1M local.

---

### 2026-05-04 — Fase 1K local

**Objetivo da implantação:** melhorar a montagem das respostas de produto, destacando o top 1 e preparando o caminho para envio de imagem.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `parseAutoresponderProductImages()` para lidar com `images` em JSON/string.
- Helper `getAutoresponderProductMainImage()` priorizando `imageUrl` e caindo para `products.images`.
- Helper `getAutoresponderProductUrl()` padronizando link público do produto.
- Helper `formatAutoresponderProductCaption()` com nome, SKU, preço, estoque e link.
- Helper `formatAutoresponderProductSearchReply()` destacando o top 1 e listando as demais opções.
- Queries de busca por tag, busca por tokens e detalhe por ID agora trazem `imageUrl` via `JSON_EXTRACT(images, '$[0]')`.
- `last_options_offered` agora também salva `imageUrl` quando disponível.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Respostas de produto mostram o top 1 com detalhes mais completos.
- Se houver imagem, a URL aparece como texto `Imagem: ...`, preparando validação com AutoResponder.
- Demais produtos aparecem como opções compactas para manter a resposta curta.

**Importante:**
- Ainda não foi ativado envio real de mídia separada no array `replies[]`; precisamos validar o formato exato aceito pelo AutoResponder antes de fazer isso.
- Paginação com `mais` entrou na Fase 1L local. Ainda não há parcelamento ou agrupamento por `model_id`.

**Próximo passo sugerido:** Fase 1L — validar/implementar formato de envio de imagem do AutoResponder ou, se preferirmos evitar mídia agora, seguir para paginação com `mais`. Concluído com paginação textual na Fase 1L local.

---

### 2026-05-04 — Fase 1J local

**Objetivo da implantação:** consolidar log e upsert de conversa para reduzir duplicação no webhook antes de avançar para respostas com imagem, parcelamento e paginação.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `logAutoresponderReply()` centralizando inserts em `autoresponder_logs`.
- Helper `upsertAutoresponderSuccessConversation()` centralizando upsert de conversa com reset de `consecutive_fallbacks`.
- Helper `upsertAutoresponderOptionsConversation()` centralizando upsert com `last_options_offered` e `last_options_at`.
- Caminhos `numbered_choice`, `rule_text`, `product_tag` e `product_search` passaram a usar os helpers.
- Checklist marcou logs e upserts como implementados no backend atual.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- O comportamento externo do webhook permanece igual ao da Fase 1I.
- A implementação ficou menos repetida, facilitando adicionar imagem, parcelas e paginação sem copiar blocos SQL grandes.

**Importante:**
- Caminhos de pausa humana e auto-pausa continuam com SQL próprio porque atualizam `paused_until` e `pause_reason`.
- O Passo 14 entrou na Fase 1K local como imagem/link/caption textual; envio real de mídia ainda precisa ser validado com o AutoResponder.

**Próximo passo sugerido:** Fase 1K — melhorar montagem de resposta de produto: top 1 mais destacado, link/caption e preparação para imagem. Concluído em formato textual na Fase 1K local.

---

### 2026-05-04 — Fase 1I local

**Objetivo da implantação:** transformar o fallback simples em fallback controlado, com contagem consecutiva e auto-pausa quando o bot não consegue ajudar.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `getAutoresponderFallbackState()` lendo `consecutive_fallbacks` da conversa.
- Helper `getAutoresponderFallbackReply()` decidindo entre `fallback_message` e `auto_pause_fallback_message`.
- Fallback agora grava log com intent `fallback`.
- Fallback incrementa `consecutive_fallbacks` a cada mensagem sem match.
- Quando `consecutive_fallbacks` atinge `auto_pause_fallback_threshold`, o webhook pausa a conversa por `auto_pause_fallback_minutes`.
- A pausa automática usa `pause_reason = 'auto_fallback'`.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Primeiros fallbacks respondem com `fallback_message` e aumentam a contagem.
- Ao atingir o limite configurado, responde com `auto_pause_fallback_message` e pausa a conversa.
- Depois da pausa, mensagens do mesmo contato ficam silenciosas até `paused_until`.

**Importante:**
- Caminhos com sucesso já resetavam `consecutive_fallbacks` para `0` nas etapas anteriores.
- O texto default de `auto_pause_fallback_message` ainda deve ser validado antes de ativar em produção.
- Log/upsert foram consolidados na Fase 1J local. Ainda não há imagem do top 1, parcelamento, agrupamento por modelo ou paginação com `mais`.

**Próximo passo sugerido:** Fase 1J — consolidar montagem final de replies/log/upsert e revisar duplicações antes de avançar para imagens/parcelamento/paginação. Concluído na Fase 1J local.

---

### 2026-05-04 — Fase 1H local

**Objetivo da implantação:** permitir busca geral de produtos por termos da mensagem quando não houver humano, regra textual, tag de produto ou escolha numerada.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `extractAutoresponderProductSearchTokens()` com normalização e stopwords básicas PT-BR.
- Helper `findAutoresponderProductsByTokens()` buscando produtos ativos por AND dos tokens.
- Busca em `products.name`, `products.sku`, `products.model_id` e `products.brand`.
- Novo caminho no webhook depois de tag de produto e antes do fallback.
- Resposta reaproveitando a lista compacta de produtos.
- Log com intent `product_search`, `matched_products`, `matched_count` e `reply_text`.
- Upsert em `autoresponder_conversations` salvando `last_options_offered` e `last_options_at`, mantendo compatibilidade com resposta numerada.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Mensagens como `tem capa note 14` buscam produtos ativos que contenham todos os tokens relevantes.
- Quando houver resultados, o bot retorna até 5 itens e permite resposta numerada depois.
- Quando não houver resultados, o fluxo segue para fallback com contagem consecutiva e auto-pausa conforme Fase 1I local.

**Importante:**
- Ainda não há agrupamento por `model_id`, paginação com `mais`, imagem do top 1 ou cálculo de parcelamento.
- A busca é AND simples e conservadora para reduzir falso positivo.
- O limite de 5 resultados segue provisório até implementarmos paginação/mais resultados.

**Próximo passo sugerido:** Fase 1I — implementar fallback com `consecutive_fallbacks` e auto-pausa antes de pensar em paginação/imagens. Concluído na Fase 1I local.

---

### 2026-05-04 — Fase 1G local

**Objetivo da implantação:** permitir que o cliente responda com um número da lista anterior para receber detalhes do produto escolhido.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `getAutoresponderNumberedChoice()` para reconhecer mensagens com número puro, como `1`, `2`, `3`.
- Helper `getAutoresponderNumberedChoiceContext()` lendo `last_options_offered` apenas se `last_options_at` ainda estiver dentro de `numbered_list_validity_minutes`.
- Helper `findAutoresponderProductById()` para buscar o produto escolhido.
- Helper `formatAutoresponderProductDetailReply()` com nome, SKU, preço, estoque básico e link do produto quando houver `slug`.
- Novo caminho no webhook depois do limite de respostas e antes de humano/regras/tags.
- Log com intent `numbered_choice`, `matched_products`, `matched_count` e `reply_text`.
- Upsert da conversa resetando `consecutive_fallbacks` para `0` quando a escolha numerada é válida.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Depois de uma lista salva em `last_options_offered`, o cliente pode responder `1`, `2`, `3` etc. para receber detalhes do item correspondente.
- Se a lista estiver vencida, se `use_numbered_lists` estiver desligado, ou se o número não existir na lista, o webhook segue para o fluxo normal.
- O detalhe ainda é textual; imagem do produto fica para uma etapa posterior.

**Importante:**
- Esta etapa não implementa paginação com `mais`.
- A busca geral por tokens entrou na Fase 1H local.
- O link usa `https://www.mercadodovale.com.br/produto/{slug}` quando existe `slug`; validar domínio/rota antes do deploy público.

**Próximo passo sugerido:** Fase 1H — implementar busca geral de produtos por tokens e preparar a evolução para paginação/mais resultados. Concluído com busca AND simples na Fase 1H local.

---

### 2026-05-04 — Fase 1F local

**Objetivo da implantação:** detectar palavras-chave de tags de produto e responder com uma lista compacta de produtos ativos vinculados a essa tag.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `normalizeAutoresponderTagKeywordMap()` para aceitar `product_tag_keywords` em formato palavra→tag e também tag→lista de palavras.
- Helper `findAutoresponderProductTagKeyword()` para detectar a primeira palavra-chave de tag presente na mensagem.
- Helper `findAutoresponderProductsByTag()` buscando produtos ativos com `products.tag_ids` via `JSON_CONTAINS`.
- Helper `formatAutoresponderProductListReply()` para montar uma lista compacta com nome, preço e status básico de estoque.
- Novo caminho no webhook depois das regras textuais e antes do fallback.
- Log com intent `product_tag`, `matched_products`, `matched_count` e `reply_text`.
- Upsert em `autoresponder_conversations` salvando `last_options_offered` e `last_options_at`, preparando a próxima etapa de resposta numerada.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Se `autoresponder_settings.product_tag_keywords` mapear uma palavra como `promocao` para uma tag, mensagens com essa palavra retornam até 5 produtos ativos daquela tag.
- A resposta ainda é textual/lista compacta; imagens e detalhamento por item ficam para etapas seguintes.
- Se não houver produtos ativos para a tag, o bot informa que não encontrou produtos ativos para aquela palavra.

**Importante:**
- A busca geral por tokens ainda não foi implementada.
- A resposta numerada entrou na Fase 1G local usando `last_options_offered`.
- O cadastro das tags nos produtos depende da futura tela/admin ou de inserção manual em `products.tag_ids`.

**Próximo passo sugerido:** Fase 1G — implementar resposta numerada usando `last_options_offered` para detalhar o item escolhido. Concluído na Fase 1G local.

---

### 2026-05-04 — Fase 1E local

**Objetivo da implantação:** iniciar a camada de intenção simples antes da busca de produtos, com saudação e regras textuais ativas por prioridade.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `isAutoresponderGreeting()` para detectar saudações simples como `oi`, `ola`, `bom dia`, `boa tarde`, `boa noite` e `opa`.
- Helper `formatAutoresponderReply()` para prefixar `settings.greeting_prefix` quando a mensagem do cliente começa com saudação.
- Helpers de regra: `splitAutoresponderRulePattern()`, `doesAutoresponderRuleMatch()` e `findAutoresponderRuleMatch()`.
- Match em `autoresponder_rules` ativas, ordenadas por `priority DESC, id ASC`.
- Suporte inicial aos `match_type`: `any_keyword`, `all_keywords`, `regex` e `exact`.
- Nesta etapa o webhook responde apenas regras com `reply_type='text'` e `reply_text` preenchido.
- Ao casar regra textual, incrementa `autoresponder_rules.hits`, grava log com intent `rule_text` e `matched_rule_id`, e reseta `consecutive_fallbacks` da conversa para `0`.
- Fallback e mensagem de humano também passam pelo prefixo de saudação quando aplicável.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Mensagem com saudação + resposta do bot recebe o prefixo configurado em `greeting_prefix`.
- Se uma regra textual ativa casar com a mensagem, ela responde antes do fallback.
- Regras de produto (`product_by_tag` e `product_search`) ainda são ignoradas nesta etapa. Palavra-chave de tag de produto entrou separadamente na Fase 1F local.

**Importante:**
- O Passo 9 completo segue pendente porque ainda faltam tipos de regra ligados a produtos, anexo opcional e aplicação de `auto_apply_tag_id`.
- Ainda não há detecção de resposta numerada, busca geral de produtos ou auto-pausa por excesso de fallback.

**Próximo passo sugerido:** Fase 1F — implementar palavra-chave de tag de produto e preparar o caminho para busca/lista de produtos. Concluído para tags de produto na Fase 1F local.

---

### 2026-05-04 — Fase 1D local

**Objetivo da implantação:** reduzir risco de loop/spam e garantir que falhas internas do webhook não quebrem a resposta para o app AutoResponder.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `getAutoresponderReplyCount()` contando respostas do bot na janela configurada por `max_replies_window_hours`.
- Check de limite `max_replies_per_conversation` antes de gerar nova resposta automática.
- Quando o limite é atingido, o webhook fica silencioso (`replies: []`) e apenas atualiza `last_message_at`/`total_messages`.
- Helper `touchAutoresponderConversation()` para atualizar conversa sem registrar resposta do bot.
- `try/catch` no corpo do webhook para capturar erro interno, registrar no log do servidor e retornar mensagem genérica em `replies[]`.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Se o número já recebeu `max_replies_per_conversation` respostas na janela configurada, o bot não responde mais naquela janela.
- Se acontecer erro de banco/lógica durante o webhook, o AutoResponder recebe uma resposta 200 com mensagem genérica de instabilidade.
- A validação do token continua antes do `try/catch`; token inválido ainda retorna `401`.

**Importante:**
- O limite também se aplica antes do pedido de humano, seguindo a ordem do checklist atual. Se quisermos que pedido de humano sempre fure esse limite, isso deve virar uma decisão explícita antes da próxima implantação.
- Saudação e regra textual por prioridade entraram na Fase 1E local. Ainda não há regras de produto, busca de produtos ou auto-pausa por excesso de fallback.

**Próximo passo sugerido:** Fase 1E — implementar saudação e match inicial em `autoresponder_rules` por prioridade, ainda antes da busca de produtos. Concluído para regras textuais na Fase 1E local.

---

### 2026-05-04 — Fase 1C local

**Objetivo da implantação:** usar o horário da loja para decidir a mensagem enviada quando o cliente pede atendimento humano.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper local no `vps_server.cjs` para interpretar `company_settings.business_hours` no fuso `America/Sao_Paulo`.
- Mesmos horários padrão usados pelo frontend: segunda a sexta 08:00-18:00 com almoço, sábado 08:00-12:00, domingo fechado.
- Leitura de `company_settings.local_holidays`; se houver feriado local no dia, o atendimento humano é tratado como fora do horário.
- Tratamento de intervalo de almoço como fora do horário.
- Status `closing_soon` conta como dentro do horário, mantendo o comportamento previsto nas pendências.
- Pedido de humano agora escolhe `human_message_in_hours` quando a loja está aberta/fechando em breve, e `human_message_out_of_hours` quando está fechada, em almoço ou feriado local.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Cliente pedindo humano dentro do horário: recebe a mensagem configurada em `human_message_in_hours`.
- Cliente pedindo humano fora do horário, almoço ou feriado local: recebe `human_message_out_of_hours`.
- Em ambos os casos, a conversa é pausada por `human_pause_minutes` e o log fica como `human_request`.

**Importante:**
- Esta etapa não implementa consulta de feriados nacionais via `holidayService`, porque esse helper está em TypeScript/frontend. Por enquanto foram portados horários semanais e feriados locais salvos em `company_settings`.
- Ainda não há saudação, regras por prioridade, busca de produtos, limite por janela ou auto-pausa por excesso de fallback.

**Próximo passo sugerido:** Fase 1D — implementar limite de respostas por janela e tratamento de erro do webhook antes de avançar para regras e produtos.

---

### 2026-05-04 — Fase 1B local

**Objetivo da implantação:** endurecer o webhook antes de qualquer busca de produto ou regra automática, mantendo o bot desligado por padrão.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Normalização do remetente para usar uma chave consistente em `autoresponder_conversations`.
- Lookup em `autoresponder_blocklist` com suporte a `exact`, `prefix` e `regex`, considerando apenas registros `active = 1`.
- Webhook continua silencioso para grupos, números bloqueados, bot desativado ou conversa pausada.
- Check de `paused_until` em `autoresponder_conversations`; se ainda estiver no futuro, o bot não responde e apenas atualiza `last_message_at`/`total_messages`.
- Detecção inicial de pedido de humano por termos como `humano`, `atendente`, `vendedor`, `gerente`, `especialista`, `falar com alguem` e `pessoa real`.
- Ao pedir humano, o webhook grava log com intent `human_request`, pausa a conversa por `human_pause_minutes` e responde com `human_message_in_hours` ou fallback seguro.
- O fallback bootstrap agora também grava `last_bot_reply_at`.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Sem `X-Autoresponder-Token` válido: `401`.
- Com token válido e `enabled = 0`: `{ "replies": [] }`.
- Com token válido, `enabled = 1` e remetente bloqueado: `{ "replies": [] }`.
- Com token válido, `enabled = 1` e conversa pausada: `{ "replies": [] }`.
- Com pedido de humano: resposta de transferência, log `human_request` e pausa da conversa.
- Sem match especial: resposta bootstrap/fallback, log e upsert da conversa.

**Importante:**
- A regra de horário da loja entrou na Fase 1C local para escolher entre `human_message_in_hours` e `human_message_out_of_hours`.
- Ainda não há busca de produtos, regras por prioridade, limite por janela ou auto-pausa por excesso de fallback.

**Próximo passo sugerido:** Fase 1C — portar a leitura de horário da loja e iniciar a ordem de regras/fallback antes da busca de produtos. Concluído parcialmente na Fase 1C local para mensagens humanas.

---

### 2026-05-04 — Fase 1A iniciada

**Objetivo da implantação:** dar o ponta pé inicial sem ativar respostas automáticas em produção antes de validar o app AutoResponder no celular.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Middleware `requireAutoresponderToken` lendo exclusivamente `process.env.AUTORESPONDER_TOKEN`.
- Endpoint público `POST /autoresponder-webhook`, protegido pelo header `X-Autoresponder-Token`.
- Endpoints administrativos mínimos `GET /autoresponder/settings` e `PATCH /autoresponder/settings`.
- Migrations idempotentes no startup da VPS para as 6 tabelas `autoresponder_*` e a coluna `products.tag_ids`.
- Linha singleton `autoresponder_settings.id = 1` criada com `enabled = 0` por padrão.
- Webhook já ignora grupos e só responde se `settings.enabled = 1`.
- Quando habilitado, a resposta ainda é propositalmente simples: mensagem de fallback configurada, log em `autoresponder_logs` e upsert em `autoresponder_conversations`.

**Verificações executadas:**

```bash
node --check vps_server.cjs
node tmp-tests/autoresponder-phase1a-static.test.mjs
```

**Resultado esperado atual:**
- Sem `X-Autoresponder-Token` válido: `401`.
- Com token válido e `enabled = 0`: `{ "replies": [] }`.
- Com token válido e `enabled = 1`: resposta bootstrap/fallback e gravação de log/conversa.

**Importante:**
- O token real não deve ficar hardcoded no código. Configurar `AUTORESPONDER_TOKEN` no `.env` da VPS.
- Esta etapa ainda não implementava busca de produtos, regras, blocklist, pausa, humano ou UI admin completa. Blocklist, pausa e humano entraram na Fase 1B local.

**Próximo passo sugerido:** Fase 1B — implementar blocklist, pausa de conversa e detecção de pedido de humano antes da busca de produtos.

---

### 2026-05-05 — Fase 1X preço em centavos no webhook

**Objetivo da implantação:** corrigir o valor exibido pelo AutoResponder após confirmar que a VPS armazena `price_retail`/`price_promo` em centavos.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-price-cents-static.test.mjs`
- `tmp-tests/autoresponder-vps-inspect-sku-colors.cjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Confirmado na VPS que o SKU `CSRN144GRO` e variações do mesmo modelo têm `price_retail = 1999.00`, representando R$ 19,99.
- Adicionado `normalizeAutoresponderPriceValue()` para converter centavos em BRL antes de formatar mensagens.
- `getAutoresponderProductPrice()` passou a usar a normalização para preço promocional e varejo.
- Adicionado `getAutoresponderProductPriceCents()` para manter o cálculo de parcelas em centavos.
- Resposta de detalhe de produto deixou de formatar `price_retail` bruto como reais.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-vps-inspect-sku-colors.cjs`
- `node tmp-tests\autoresponder-price-cents-static.test.mjs` falhou antes da correção e passou depois.
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-product-grouping-static.test.mjs`
- `node tmp-tests\autoresponder-installment-helper-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node --check tmp-tests\autoresponder-vps-server-deploy.cjs`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- Teste público do webhook retornou `Preco: R$ 19,99` e `Parcelamento: ate 12x de R$ 1,86`.

**Importante:**
- O primeiro teste público retornou `401` porque o token local estava entre aspas no `.env.local`; a chamada validada removeu as aspas antes de montar a URL.
- No app AutoResponder, o valor do token na URL deve ir sem aspas.

---

### 2026-05-05 — Fase 1Y resposta sem SKU

**Objetivo da implantação:** remover o SKU das mensagens enviadas ao cliente final, mantendo o SKU apenas como dado interno de busca/log.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-hide-sku-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Removida a linha `SKU:` da resposta principal de produto.
- Removida a linha `SKU:` da resposta de detalhe por escolha numerada.
- A busca por SKU continua ativa internamente em `findAutoresponderProductsByTokens()`.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-hide-sku-static.test.mjs` falhou antes da correção e passou depois.
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-price-cents-static.test.mjs`
- `node tmp-tests\autoresponder-product-grouping-static.test.mjs`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- Teste público do webhook retornou nome, preço, parcelamento, cores e link, sem `SKU:`.

---

### 2026-05-05 — Fase 1Z mensagem para produto sem estoque

**Objetivo da implantação:** impedir que o bot envie link de produto indisponível e responder com uma mensagem própria quando a busca encontrar itens relacionados, mas todos sem estoque.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-out-of-stock-reply-static.test.mjs`
- `tmp-tests/autoresponder-product-grouping-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Adicionado `isAutoresponderProductAvailable()` com regra `stock_quantity > 0`.
- Adicionado `filterAutoresponderAvailableProducts()` antes de montar opções, grupos, cores, detalhe e links.
- Adicionada mensagem específica: `No momento nao encontrei esse produto disponivel em estoque.`
- A mensagem de indisponibilidade não repete o termo digitado, para evitar reexibir SKU interno quando o cliente digitar um código.
- Busca interna por SKU continua funcionando para identificar produto relacionado.

**Verificações executadas nesta etapa:**
- `node tmp-tests\autoresponder-out-of-stock-reply-static.test.mjs` falhou antes da correção e passou depois.
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-hide-sku-static.test.mjs`
- `node tmp-tests\autoresponder-price-cents-static.test.mjs`
- `node tmp-tests\autoresponder-product-grouping-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node tmp-tests\autoresponder-installment-helper-static.test.mjs`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- Teste público com `CSRN144GAE` retornou a mensagem sem estoque, sem link e sem repetir o SKU.
- Teste público com `tem capa para note 14` continuou retornando produto em estoque com preço, parcelamento, cores e link.

---

### 2026-05-05 — Fase 1AA textos default de produção

**Objetivo da implantação:** trocar mensagens técnicas/default por textos prontos para cliente final e aplicar esses textos na configuração já ativa da VPS.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-production-default-messages-static.test.mjs`
- `tmp-tests/autoresponder-vps-update-production-messages.cjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `fallback_message`: pede modelo do aparelho ou tipo de produto, sem dizer que o bot está em configuração.
- `auto_pause_fallback_message`: informa que um atendente será chamado para conferir melhor.
- `human_message_in_hours`: chama especialista durante horário de atendimento.
- `human_message_out_of_hours`: registra que está fora do horário humano e que a equipe responderá assim que possível.
- Defaults novos ficam no código para instalações futuras e também foram aplicados na linha `autoresponder_settings.id = 1` da VPS.

**Verificações executadas nesta etapa:**
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-production-default-messages-static.test.mjs`
- `node tmp-tests\autoresponder-out-of-stock-reply-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node --check tmp-tests\autoresponder-vps-update-production-messages.cjs`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- `node tmp-tests\autoresponder-vps-update-production-messages.cjs`
- Teste público de fallback retornou a nova mensagem de orientação.
- Teste público de pedido de atendente retornou a mensagem fora do horário humano.
- Teste público de auto-pausa: 1º e 2º fallback responderam orientação, 3º chamou atendente, 4º ficou em silêncio por pausa.

---

### 2026-05-06 — Fase 1AB relevância da busca

**Objetivo da implantação:** melhorar a ordenação da busca de produtos do AutoResponder para priorizar resultados mais próximos da pergunta do cliente.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-search-relevance-static.test.mjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Adicionado `search_score` na busca textual de produtos.
- SKU exato recebe o maior peso, mas continua sem aparecer na mensagem ao cliente.
- Nome do produto tem peso maior que marca/specs/custom fields.
- `specs` e `custom_fields` entram na busca para cobrir cores cadastradas em JSON.
- `model_id` saiu da busca do cliente, porque UUID podia fazer token numérico como `14` casar com produto errado.

**Verificações executadas nesta etapa:**
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-search-relevance-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node tmp-tests\autoresponder-out-of-stock-reply-static.test.mjs`
- `node tmp-tests\autoresponder-product-grouping-static.test.mjs`
- `node tmp-tests\autoresponder-hide-sku-static.test.mjs`
- `node tmp-tests\autoresponder-price-cents-static.test.mjs`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- Teste público `tem capa para note 14 roxo` passou a trazer `Redmi Note 14 4G` como primeira opção.
- Teste público por SKU exato `CSRN144GRO` continuou encontrando o produto e sem exibir SKU.

---

### 2026-05-06 — Fase 1AC paginação clara e link de busca

**Objetivo da implantação:** manter 5 produtos por resposta, mas deixar claro quando o cliente pede `mais`, exibindo a página atual e o total de produtos relacionados.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-pagination-count-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `AUTORESPONDER_PRODUCT_PAGE_SIZE` mantido em 5.
- Adicionado contador real para busca por tokens e por tag.
- Respostas com múltiplos resultados agora incluem `Ver busca no site: https://www.mercadodovale.com.br/catalog?search=...`.
- Respostas paginadas agora incluem `Pagina N - encontramos X produtos relacionados.`
- O contexto salvo em `autoresponder_conversations.last_options_offered` agora carrega `total` para manter a mesma contagem ao pedir `mais`.

**Verificações executadas nesta etapa:**
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-pagination-count-static.test.mjs`
- `node tmp-tests\autoresponder-search-relevance-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node tmp-tests\autoresponder-out-of-stock-reply-static.test.mjs`
- `node tmp-tests\autoresponder-product-grouping-static.test.mjs`
- `node tmp-tests\autoresponder-hide-sku-static.test.mjs`
- `node tmp-tests\autoresponder-price-cents-static.test.mjs`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- Teste público sequencial: `tem capa silicone` retornou `Pagina 1 - encontramos 540 produtos relacionados.`
- Teste público sequencial: `mais` retornou `Pagina 2 - encontramos 540 produtos relacionados.`

**Importante:**
- Como o bot agrupa variações por modelo/cor, uma página de 5 produtos brutos pode virar menos de 5 opções visíveis quando há muitas variações do mesmo modelo.

---

### 2026-05-06 — Fase 1AD instrução de escolha na lista

**Objetivo da implantação:** deixar claro para o cliente como escolher um item da lista ou refinar a busca.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-choice-instructions-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Adicionado `formatAutoresponderProductReplyInstructions(hasMore)`.
- Toda lista de produtos agora termina com `Responda com o numero da opcao ou com o nome/modelo do produto.`
- Quando há próxima página, o rodapé também informa `Se quiser ver mais opcoes, digite "mais".`
- Removido o rodapé antigo que só dizia `Responda "mais"`, pois deixava a escolha por número pouco clara.

**Verificações executadas nesta etapa:**
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-choice-instructions-static.test.mjs`
- `node tmp-tests\autoresponder-pagination-count-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node tmp-tests\autoresponder-out-of-stock-reply-static.test.mjs`
- `node tmp-tests\autoresponder-product-grouping-static.test.mjs`
- `node tmp-tests\autoresponder-search-relevance-static.test.mjs`
- `node tmp-tests\autoresponder-hide-sku-static.test.mjs`
- `node tmp-tests\autoresponder-price-cents-static.test.mjs`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- Teste público confirmou o novo rodapé com número/nome/modelo e `mais`.

---

### 2026-05-06 — App AutoResponder Pro configurado

**Objetivo da implantação:** registrar que a etapa operacional do app no celular da loja já foi concluída e que o bot está respondendo normalmente pelo WhatsApp real.

**Entregue nesta etapa:**
- Confirmada a versão Pro instalada no celular da loja.
- Criada a regra "Web request" apontando para `https://api.xiaomipetrolina.com.br/autoresponder-webhook`.
- Configurado o uso da resposta do servidor como resposta do WhatsApp.
- Mantido o bloqueio de respostas em grupos.
- Configurado para não responder quando houver resposta manual.
- Configurados os limites do app: até 5 respostas por conversa em 60 minutos e intervalo mínimo de 30 segundos após envio.
- Pattern configurado como `*`.
- Confirmado pelo usuário que o bot já está configurado e respondendo normalmente nas conversas reais do WhatsApp da loja.

**Próximo cuidado:**
- O archive diário para Synology ainda fica pendente. O script agora usa modo de baixa memória: busca logs em lotes (`AUTORESPONDER_ARCHIVE_BATCH_SIZE`, default 500) e escreve gzip incremental. Mesmo assim, manter/agendar a execução de madrugada, preferencialmente `03:00`, e validar depois da chegada da RAM maior.

---

### 2026-05-06 — Archive Synology em baixa memória

**Objetivo da implantação:** reduzir o pico de RAM do archive diário antes de instalar o cron na VPS.

**Arquivos alterados/criados:**
- `cron/archive-autoresponder-logs.cjs`
- `tmp-tests/autoresponder-archive-memory-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Adicionada variável `AUTORESPONDER_ARCHIVE_BATCH_SIZE` com default 500.
- Exportação dos logs passou a buscar `autoresponder_logs` em lotes por `id`, sem carregar o dia inteiro em uma consulta única.
- Escrita do JSON compactado passou a usar `zlib.createGzip()` e `fs.createWriteStream()`, evitando montar o payload inteiro em memória antes de comprimir.
- `dry-run` continua sem escrever no destino final; quando necessário, usa arquivo temporário e remove ao terminar.

**Operação recomendada:**
- Agendar o cron para madrugada: `0 3 * * * /var/www/mdv-api/cron/archive-autoresponder-logs.sh`.
- Manter `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0` até validar checksum e arquivo no Synology com segurança.
- Se a VPS ainda estiver com RAM limitada, reduzir `AUTORESPONDER_ARCHIVE_BATCH_SIZE` para 100 ou 200 no ambiente do cron.

---

### 2026-05-06 — Preflight local do pacote de archive VPS

**Objetivo da implantação:** deixar o pacote de instalação da VPS pronto para cópia remota controlada, sem tocar ainda em crontab, PM2 ou limpeza de logs.

**Arquivos/artefatos envolvidos:**
- `reports/autoresponder-archive-vps-package/manifest.json`
- `reports/autoresponder-archive-vps-package/cron/archive-autoresponder-logs.cjs`
- `reports/autoresponder-archive-vps-package/cron/archive-autoresponder-logs.sh`
- `reports/autoresponder-archive-vps-package/docs/operacional/2026-05-05-autoresponder-archive-vps-dry-run.md`
- `tools/install-autoresponder-archive-vps-dry-run.cjs`
- `tools/check-autoresponder-synology-readiness.cjs`

**Entregue nesta etapa:**
- Pacote de deploy regenerado com o script de archive em baixa memória.
- Plano local do instalador validado, apontando para `/var/www/mdv-api`.
- Preflight read-only do Synology passou com túnel canônico `mdv-videos`, root `/volume1/backups/autoresponder` e ações proibidas preservadas.
- Confirmado que o instalador não altera crontab, não reinicia PM2 e não ativa delete.

**Bloqueio atual:**
- Resolvido: a cópia/validação remota foi executada depois com `AUTORESPONDER_ARCHIVE_INSTALL_APPLY=1`.

**Comando usado para execução remota:**

```powershell
$env:VPS_ROOT_PASSWORD="<senha-da-vps>"
$env:AUTORESPONDER_ARCHIVE_INSTALL_APPLY="1"
$env:AUTORESPONDER_ARCHIVE_DATE="2026-05-05"
node tools\install-autoresponder-archive-vps-dry-run.cjs
```

---

### 2026-05-06 — Archive VPS instalado e dry-run remoto validado

**Objetivo da implantação:** copiar o pacote do archive para a VPS e validar execução remota sem escrever no Synology, sem alterar crontab, sem reiniciar PM2 e sem apagar logs.

**Resultado reportado da VPS:**
- Arquivo remoto `/var/www/mdv-api/cron/archive-autoresponder-logs.cjs` enviado e validado com SHA256 `c6fe48046ab3ebdfbb3cb9c9f9228cd514e63075b668fb5e6d0299de45f50c95`.
- Arquivo remoto `/var/www/mdv-api/cron/archive-autoresponder-logs.sh` enviado e validado com SHA256 `e796f8f6525830ce4eccd85763704c6a21a0fa98c7550cd4a169133645e05757`.
- Documento operacional remoto enviado e validado com SHA256 `215c2770fc8749c7dd93c53d59b2e43cd31c27d518cf1e3508826e155c7f4508`.
- `chmod +x` aplicado no wrapper shell.
- `node --check` remoto passou.
- Dry-run remoto em `2026-05-05` retornou `ok: true`, `dry_run: true`, `rows: 38`, `rows_written: 38`, `bytes: 2384`.
- SHA256 do arquivo que seria gerado no dry-run: `c0364663c37495ff1ca0670155847c2484adcbae626e874a88c0c2f6a2ab30cc`.
- Limpeza permaneceu desligada: `AUTORESPONDER_ARCHIVE_DELETE_ENABLED is not enabled`.

**Ações proibidas confirmadas pelo instalador:**
- Crontab não foi alterado.
- PM2 não foi reiniciado.
- Delete de logs não foi habilitado.

**Próximo passo sugerido:**
- Fazer a etapa de Synology real: configurar SSH key/diretório ou confirmar caminho montado, rodar uma escrita manual controlada em `AUTORESPONDER_ARCHIVE_DRY_RUN=0`, validar `.json.gz` e `.sha256`, e só depois ativar o crontab das 03:00.

---

### 2026-05-06 — Escrita controlada do archive em `/tmp` na VPS

**Objetivo da implantação:** validar escrita real de arquivo compactado e checksum na VPS, sem usar ainda o caminho final do Synology.

**Comando usado:**

```powershell
$env:AUTORESPONDER_ARCHIVE_WRITE_APPLY="1"
$env:AUTORESPONDER_ARCHIVE_WRITE_DATE="2026-05-05"
node tools\test-autoresponder-archive-vps-write.cjs
```

**Resultado reportado da VPS:**
- Archive gerado em `/tmp/mdv-autoresponder-archive-write-test/2026/05/05.json.gz`.
- Checksum gerado em `/tmp/mdv-autoresponder-archive-write-test/2026/05/05.json.gz.sha256`.
- SHA256 validado: `147e34befb284cb0380b2df63961af6bd761b29170859577fa4b54b8fbb1b366`.
- Payload descompactado: `archive_date: 2026-05-05`, `source: mysql`, `rows: 38`.
- Saída do archive: `dry_run: false`, `rows_written: 38`, `bytes: 2383`.
- Validações passaram: arquivo existe, checksum existe, `gzip -t`, checksum bate e `JSON.parse`.
- Limpeza permaneceu desligada: `AUTORESPONDER_ARCHIVE_DELETE_ENABLED is not enabled`.

**Ações proibidas confirmadas pelo script:**
- Crontab não foi alterado.
- PM2 não foi reiniciado.
- Delete de logs não foi habilitado.
- Caminho final do Synology não foi usado.

**Próximo passo sugerido:**
- Validar/usar o destino real `/volume1/backups/autoresponder` no Synology com uma escrita manual controlada. Se a RAM do NAS ainda for preocupação, aguardar a RAM maior antes de ativar crontab automático.

---

### 2026-05-06 — Gate Synology parcialmente validado

**Objetivo da implantação:** iniciar as confirmações manuais/read-only exigidas antes de qualquer escrita no destino real `/volume1/backups/autoresponder`.

**Entregue nesta etapa:**
- Checklist manual do Synology impresso com os 4 gates obrigatórios: RAM/swap, túnel canônico, DSM API e ausência de `cloudflared --token`.
- Consulta read-only da DSM API executada com sucesso:
  - URL: `https://dsm-api.xiaomipetrolina.com.br/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=SYNO.API.Auth,SYNO.FileStation.List`
  - Resultado: HTTP 200 e JSON `success: true`
  - APIs retornadas: `SYNO.API.Auth` e `SYNO.FileStation.List`
- Criado arquivo de evidência parcial: `docs/operacional/autoresponder-synology-manual-evidence-2026-05-06.json`.

**Gate atual:**
- `AUTORESPONDER_SYNOLOGY_DSM_API_OK` tem evidência validada.
- Ainda faltam evidências manuais para:
  - `AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK`
  - `AUTORESPONDER_SYNOLOGY_TUNNEL_OK`
  - `AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT`

**Importante:**
- Nenhuma escrita foi feita no Synology.
- Crontab não foi alterado.
- PM2 não foi reiniciado.
- Delete de logs não foi habilitado.

**Próximo passo sugerido:**
- Conferir no DSM/painel:
  1. RAM e swap do NAS em estado seguro.
  2. Túnel canônico `mdv-videos` com UUID `7680ed44-a7a9-4700-a37e-2026b3653360`.
  3. Ausência de processo legado `cloudflared` usando `--token`.
- Depois disso, completar o arquivo de evidência e liberar o safety gate local antes da escrita final.

---

### 2026-05-06 — Seed dos templates de regras aplicado na VPS

**Objetivo da implantação:** concluir o seed dos 22 templates pré-cadastrados de `autoresponder_rules`.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-rule-templates-seed-static.test.mjs`
- `tmp-tests/autoresponder-vps-rule-template-count.cjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Adicionada constante `AUTORESPONDER_RULE_TEMPLATES` com 22 templates:
  - 21 templates inativos para respostas comuns.
  - 1 template ativo: `Falar com humano`.
- Adicionada função `seedAutoresponderRuleTemplates()` nas migrations do servidor.
- Seed idempotente usando `WHERE NOT EXISTS`, evitando duplicar templates por nome.
- Deploy da VPS executado com backup remoto e restart do PM2 `mdv-api`.

**Verificações executadas:**
- `node tmp-tests\autoresponder-rule-templates-seed-static.test.mjs`
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node tmp-tests\autoresponder-rules-crud-static.test.mjs`
- `node tmp-tests\autoresponder-admin-page-static.test.mjs`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- `node tmp-tests\autoresponder-vps-rule-template-count.cjs`

**Resultado confirmado na VPS:**
- `total: 22` templates encontrados por nome em `autoresponder_rules`.
- `active_count: 1`.
- Template ativo: `Falar com humano`, `active: 1`, `priority: 1000`.

**Importante:**
- O fluxo de pedido humano continua sendo tratado primeiro pelo webhook, com pausa e mensagem por horário. O template ativo fica disponível no admin como regra pré-cadastrada, mas não substitui o fluxo especial de atendimento humano.

---

### 2026-05-06 — `detectIntent(message)` consolidado

**Objetivo da implantação:** concluir o helper central de intenção do AutoResponder sem alterar a ordem do webhook já em produção.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-detect-intent-static.test.mjs`
- `tmp-tests/autoresponder-greeting-message-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Adicionado `detectAutoresponderIntent(message)`.
- O helper centraliza:
  - `greeting`
  - `greetingOnly`
  - `humanRequest`
  - `numberedChoice`
  - `moreRequest`
- Webhook passou a usar `detectedIntent` nos ramos de saudação pura, escolha numerada, paginação `mais` e pedido de humano.
- A ordem de decisão foi preservada: saudação/contato, escolha numerada, `mais`, humano, regras, tags, busca e fallback.
- Deploy da VPS executado com backup remoto e restart do PM2 `mdv-api`.

**Verificações executadas:**
- `node tmp-tests\autoresponder-detect-intent-static.test.mjs`
- `node tmp-tests\autoresponder-greeting-message-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node tmp-tests\autoresponder-pagination-count-static.test.mjs`
- `node tmp-tests\autoresponder-choice-instructions-static.test.mjs`
- `node tmp-tests\autoresponder-rule-templates-seed-static.test.mjs`
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- Healthcheck público sem token retornou `401 Unauthorized`, mantendo o webhook protegido.

---

### 2026-05-06 — Feriados nacionais no AutoResponder

**Objetivo da implantação:** concluir o item de feriados nacionais usado pela mensagem de transferência humana, sem depender de API externa em tempo real no webhook da VPS.

**Arquivos alterados/criados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-national-holidays-static.test.mjs`
- `tmp-tests/autoresponder-store-status-cache-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Portado o comportamento do `holidayService` para a VPS com cálculo local de feriados nacionais brasileiros.
- Adicionado `getBrazilianEasterDate(year)` para calcular feriados móveis.
- Adicionado `getAutoresponderBrazilNationalHoliday(dateString)` para detectar:
  - Confraternizacao Universal
  - Carnaval
  - Sexta-feira Santa
  - Tiradentes
  - Dia do Trabalhador
  - Corpus Christi
  - Independencia do Brasil
  - Nossa Senhora Aparecida
  - Finados
  - Proclamacao da Republica
  - Natal
- `getAutoresponderStoreStatus()` agora considera feriado nacional como `status: 'holiday'`.
- `company_settings.holiday_overrides` continua podendo liberar uma data nacional específica para atendimento normal.
- Feriados locais (`company_settings.local_holidays`) seguem com prioridade máxima.

**Verificações executadas:**
- `node tmp-tests\autoresponder-national-holidays-static.test.mjs`
- `node tmp-tests\autoresponder-store-status-cache-static.test.mjs`
- `node tmp-tests\autoresponder-phase1a-static.test.mjs`
- `node tmp-tests\autoresponder-detect-intent-static.test.mjs`
- `node tmp-tests\autoresponder-greeting-message-static.test.mjs`
- `node --check vps_server.cjs`
- `node --check vps_server.js`
- `node tmp-tests\autoresponder-vps-server-deploy.cjs`
- Healthcheck público sem token retornou `401 Unauthorized`.

**Resultado esperado:**
- Em feriado nacional, pedido de atendimento humano usa mensagem fora do horário.
- Se a data estiver em `holiday_overrides`, o horário semanal volta a valer normalmente.
- O bot continua respondendo 24/7; feriado só muda a mensagem de transferência humana.

---

### 2026-05-06 — Componentes reutilizaveis do AutoResponder

**Objetivo da etapa:** materializar os componentes da Fase 3 em arquivos dedicados para reutilizacao no painel admin e futuras telas do AutoResponder.

**Arquivos criados:**
- `components/autoresponder/TagPicker.tsx`
- `components/autoresponder/ConversationCard.tsx`
- `components/autoresponder/BlockNumberModal.tsx`
- `components/autoresponder/AttachmentUpload.tsx`
- `components/autoresponder/RuleEditor.tsx`
- `components/autoresponder/MessagePreview.tsx`
- `tmp-tests/autoresponder-components-static.test.mjs`

**Entregue nesta etapa:**
- `TagPicker` com multiselect, bolinha de cor e filtro por escopo (`conversation`, `product`, `rule`).
- `ConversationCard` com status, resumo, metricas, tags e acoes de pausar/liberar/salvar/bloquear.
- `BlockNumberModal` com formulario de bloqueio por numero, prefixo ou regex.
- `AttachmentUpload` com upload por input, suporte a drag-drop, legenda e remocao.
- `RuleEditor` como modal de CRUD de regra reutilizando `TagPicker`, `AttachmentUpload` e `MessagePreview`.
- `MessagePreview` renderizando texto/anexo em formato de bolha tipo WhatsApp.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-components-static.test.mjs`
- `npm.cmd run build`

**Observacao:**
- A pagina `pages/admin/AutoResponderPage.tsx` segue funcional com a implementacao atual; os componentes agora existem em arquivos proprios para a proxima rodada de integracao/refatoracao visual sem mexer no bot em producao.

---

### 2026-05-06 — Teste de CRUD completo da Fase 3

**Objetivo da etapa:** fechar a verificacao de CRUD completo das abas administrativas do AutoResponder sem depender de Synology.

**Arquivos criados/alterados:**
- `tmp-tests/autoresponder-phase3-crud-complete-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Teste estatico confirmando que `autoResponderService.ts` expoe os metodos de criacao, edicao, exclusao e acoes administrativas.
- Teste estatico confirmando que `pages/admin/AutoResponderPage.tsx` liga:
  - respostas: criar, editar, excluir e recarregar lista/estatisticas;
  - conversas: pausar, liberar, salvar tags e bloquear;
  - bloqueados: criar, editar, excluir e importar em massa;
  - tags: criar, editar e excluir;
  - configuracoes: salvar settings.
- Checklist da Fase 3 atualizado em `CRUD completo em cada aba`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-phase3-crud-complete-static.test.mjs`

**Observacao:**
- `Curadoria -> criar resposta funciona end-to-end` continua aberto porque ainda pede validacao real UI/API, nao apenas cobertura estatica.

---

### 2026-05-06 — Curadoria end-to-end na VPS

**Objetivo da etapa:** validar que uma pergunta de curadoria consegue virar uma regra real pela API administrativa da VPS, sem tocar em Synology.

**Arquivos criados/alterados:**
- `tmp-tests/autoresponder-vps-curation-end-to-end.cjs`
- `tmp-tests/autoresponder-curation-end-to-end-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Runner controlado que chama `POST /autoresponder/rules/from-question` com uma pergunta unica.
- Confirmacao de que a regra criada retorna `id`, `pattern`, `reply_text` e permanece inativa para revisao.
- Confirmacao de que a regra aparece em `GET /autoresponder/rules`.
- Limpeza automatica com `DELETE /autoresponder/rules/:id` para nao deixar regra de teste na producao.
- Checklist da Fase 3 atualizado em `Curadoria -> criar resposta funciona end-to-end`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-curation-end-to-end-static.test.mjs`
- `node tmp-tests\autoresponder-vps-curation-end-to-end.cjs`

**Resultado esperado:**
- O fluxo de Curadoria esta validado ponta a ponta no backend real da VPS.
- A tela admin continua usando o modal de revisao antes de salvar, conforme a validacao estatica anterior.

---

### 2026-05-06 — Fase 4A estado `purchase_flow`

**Objetivo da etapa:** iniciar a base da compra pelo WhatsApp com estado persistente de carrinho/conversa, sem depender de Synology.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `types/autoResponder.ts`
- `tmp-tests/autoresponder-purchase-flow-state-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `autoresponder_conversations` ganhou `purchase_flow JSON NULL`.
- `autoresponder_conversations` ganhou `purchase_flow_updated_at TIMESTAMP NULL`.
- Migracao idempotente com `addColumnIfMissing()` para aplicar as colunas em VPS ja existente.
- Tipo `AutoResponderConversation` agora expoe `purchase_flow` e `purchase_flow_updated_at`.
- Helpers preparados:
  - `normalizeAutoresponderPurchaseFlow()`
  - `getAutoresponderPurchaseFlow()`
  - `saveAutoresponderPurchaseFlow()`
  - `clearAutoresponderPurchaseFlow()`
- Checklist da Fase 4 atualizado no item `purchase_flow`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-flow-state-static.test.mjs`

**Resultado esperado:**
- A proxima etapa pode usar esse estado para transformar escolha de produto em fluxo de compra assistida.
- O bot ainda nao inicia carrinho automaticamente nesta etapa; isso fica para o proximo item da Fase 4.

---

### 2026-05-06 — Fase 4B seleção de produto para compra

**Objetivo da etapa:** quando o cliente escolher um produto da lista, iniciar a intenção de compra assistida sem fechar pedido automaticamente.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-purchase-selection-static.test.mjs`
- `tmp-tests/autoresponder-phase1a-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- Helper `findAutoresponderSelectedOptionFromMessage()` para aceitar escolha por numero ou por nome/modelo dentro das opcoes recentes.
- Helper `buildAutoresponderPurchaseActionPrompt()` para responder com o produto escolhido e perguntar se o cliente quer comprar ou ver detalhes.
- Ao selecionar uma opcao valida, o bot salva `purchase_flow.status = 'awaiting_product_action'`.
- O `purchase_flow.selected_product` guarda id, nome, SKU, slug, preco em centavos e estoque atual quando disponiveis.
- O log passa a registrar `intent = 'purchase_product_selected'` para essa entrada do fluxo de compra.
- Checklist da Fase 4 atualizado no item de escolha por numero/nome.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-selection-static.test.mjs`

**Resultado esperado:**
- Cliente que responder `1` ou o nome/modelo de uma opcao recente recebe: comprar ou detalhes.
- O bot ainda nao pergunta quantidade nesta etapa; isso fica para o proximo item da Fase 4.

---

### 2026-05-29 — Fase 4B ajuste do card apos selecao

**Objetivo da etapa:** padronizar a resposta depois que o cliente escolhe um produto, usando o mesmo card comercial da lista e opcoes numericas para continuar.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `tmp-tests/autoresponder-purchase-selection-static.test.mjs`
- `Bot_Whatsapp.md`

**Entregue nesta etapa:**
- `buildAutoresponderPurchaseActionPrompt()` passou a montar o card com nome, memoria/versao, preco a vista, parcelamento e cores quando disponiveis.
- A resposta agora encerra com `Responda:`, `*1* Para comprar` e `*2* Para detalhes`.
- A escolha numerica preserva `option_number` para manter o numero original do item no card.
- O fluxo `awaiting_product_action` agora aceita `1` como comprar e `2` como detalhes, alem dos textos anteriores.
- Removido o texto antigo `Responda "comprar" ou "detalhes".`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-selection-static.test.mjs`

**Resultado esperado:**
- Cliente que escolhe um produto recebe o card no padrao de venda e responde `1` para comprar ou `2` para ver detalhes.

---

### 2026-05-06 — Fase 4C pergunta de quantidade

**Objetivo da etapa:** depois que o cliente escolhe um produto e confirma que quer comprar, pedir a quantidade desejada antes de montar o carrinho.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-purchase-quantity-prompt-static.test.mjs`

**Entregue nesta etapa:**
- Helper `isAutoresponderPurchaseBuyRequest()` para reconhecer respostas como `comprar`, `quero comprar` e `fechar`.
- Helper `isAutoresponderPurchaseDetailsRequest()` para permitir que o cliente veja detalhes antes de comprar.
- Helper `buildAutoresponderQuantityPrompt()` com pergunta direta de quantidade e estoque atual quando disponivel.
- O webhook agora trata `purchase_flow.status = 'awaiting_product_action'` antes de novas escolhas numeradas.
- Ao responder `comprar`, o bot salva `purchase_flow.status = 'awaiting_quantity'`, mantem o produto selecionado e registra log com intent `purchase_quantity_prompt`.
- Ao responder `detalhes`, o bot mostra o detalhe do produto e mantem a conversa pronta para o cliente responder `comprar`.
- Checklist atualizado para marcar `Perguntar quantidade desejada` e o teste `Cliente escolhe produto por numero e bot pergunta quantidade`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-quantity-prompt-static.test.mjs`

**Resultado esperado:**
- Cliente que escolheu produto e respondeu `comprar` recebe `Quantas unidades voce deseja?`.
- A validacao de estoque antes de adicionar ao carrinho ainda fica para o proximo item da Fase 4.

---

### 2026-05-07 — Fase 4D validacao de estoque

**Objetivo da etapa:** validar a quantidade solicitada contra o estoque atual antes de adicionar o item ao carrinho temporario.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-purchase-stock-validation-static.test.mjs`

**Entregue nesta etapa:**
- Helper `parseAutoresponderRequestedQuantity()` para aceitar quantidade numerica simples, como `1`, `2 unidades` ou `3 un`.
- Helper `buildAutoresponderOutOfStockReply()` para bloquear produto sem estoque e sugerir alternativa/atendimento.
- Helper `buildAutoresponderInsufficientStockReply()` para avisar quando a quantidade pedida passa do estoque disponivel.
- Helper `buildAutoresponderItemAddedPrompt()` para confirmar o item adicionado ao carrinho temporario.
- O webhook agora trata `purchase_flow.status = 'awaiting_quantity'` antes de novas escolhas numeradas.
- Se o estoque atual for `0`, o bot salva `purchase_flow.status = 'stock_blocked'`, nao adiciona item e registra log `purchase_stock_blocked`.
- Se a quantidade passar do estoque, o bot mantem `awaiting_quantity` e pede uma quantidade valida.
- Se houver estoque suficiente, o bot salva item em `purchase_flow.items`, muda para `item_added` e registra log `purchase_item_added`.
- Checklist atualizado para marcar validacao de estoque e teste de produto sem estoque.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-purchase-stock-validation-static.test.mjs`

**Resultado esperado:**
- Produto sem estoque nao entra no carrinho.
- Produto com estoque insuficiente pede uma quantidade menor.
- Produto com estoque suficiente entra no carrinho temporario; a etapa seguinte decide adicionar mais produtos ou finalizar.

---

### 2026-05-07 - Ajuste tags de categoria e link de horários

**Objetivo da etapa:** corrigir o 404 do botão de horários e deixar as categorias dinâmicas mais claras para uso em outras respostas do bot.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `types/autoResponder.ts`
- `services/autoResponderService.ts`
- `pages/admin/AutoResponderPage.tsx`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-category-tags-visible-static.test.mjs`

**Entregue nesta etapa:**
- Endpoint `GET /autoresponder/category-tags` para expor categorias como tags dinâmicas, com produtos ativos, produtos em estoque e garantia da categoria.
- Aba Tags agora mostra a seção "Tags de categoria" separada das tags manuais.
- Informativos no admin para usar `{categorias_disponiveis}` e `{categoria:Nome da categoria}` em respostas automáticas.
- Link de horário corrigido de `/admin/settings/empresa` para `/admin/settings/company`.

**Verificações executadas:**
- `node tmp-tests\autoresponder-category-tags-visible-static.test.mjs`
- `node tmp-tests\autoresponder-settings-polish-static.test.mjs`

---

### 2026-05-07 - Fase 4K consulta de cliente existente

**Objetivo da etapa:** antes de pedir dados novamente, consultar cliente existente pelo telefone do WhatsApp, CPF/CNPJ ou e-mail.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-existing-customer-lookup-static.test.mjs`

**Entregue nesta etapa:**
- Helper `buildAutoresponderCustomerLookupCandidates()` normaliza telefone, CPF/CNPJ e e-mail para consulta.
- Helper `findAutoresponderExistingCustomer()` consulta `customers` no Supabase pela REST API com service role já configurada na VPS.
- Quando o fluxo chega em `customer_data_pending`, o bot procura cliente existente antes de pedir confirmação dos dados.
- Se encontrar cliente, o `purchase_flow` salva `existing_customer` e complementa `customer_data` com nome, telefone, e-mail e CPF/CNPJ disponíveis.
- Quando o cliente informa CPF/CNPJ, o bot consulta novamente por documento antes de avançar para `customer_registration_ready`.
- Logs novos: `purchase_existing_customer_found` e `purchase_existing_customer_not_found`.

**Verificações executadas:**
- `node tmp-tests\autoresponder-existing-customer-lookup-static.test.mjs`

---

### 2026-05-07 - Fase 4L criar/atualizar cliente

**Objetivo da etapa:** depois que o cliente confirma os dados do pedido, criar ou atualizar o cadastro em `customers` antes de entregar o pedido para o atendente.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-customer-upsert-static.test.mjs`

**Entregue nesta etapa:**
- Helper `getAutoresponderCompanyId()` consulta e cacheia o `company_id` do Mercado do Vale pelo slug `mercado-do-vale`.
- Helper `buildAutoresponderCustomerPayload()` monta o payload seguro com nome, telefone, CPF/CNPJ, tipo `retail`, endereco de entrega quando houver e `custom_data.source = whatsapp_autoresponder`.
- Helper `createOrUpdateAutoresponderCustomer()` cria cliente novo via Supabase REST ou atualiza cliente existente somente depois da confirmacao do cliente.
- O fluxo que chega em `customer_registration_ready` agora grava `customer_record` no `purchase_flow` e muda para `customer_record_ready`.
- Log novo: `purchase_customer_upserted`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-customer-upsert-static.test.mjs`

---

### 2026-05-07 - Fase 4M nome completo, CEP e frete dinamico

**Objetivo da etapa:** deixar o fechamento assistido mais confiavel, exigindo nome completo e calculando frete dinamico por CEP antes de pedir numero/complemento.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-delivery-cep-shipping-static.test.mjs`

**Entregue nesta etapa:**
- Nome completo agora e obrigatorio antes de confirmar cadastro/pedido.
- Entrega deixou de pedir endereco livre e passou a pedir primeiro o CEP.
- Helper `lookupAutoresponderCep()` consulta BrasilAPI CEP e usa ViaCEP como fallback.
- Helper `calculateAutoresponderShippingOptions()` reaproveita a regra dinamica de frete local da VPS com `shipping_settings`, `shipping_zones` e `shipping_price_ranges`.
- O bot confirma rua, bairro, cidade, CEP, frete e prazo antes de pedir numero/complemento.
- O endereco final e salvo estruturado em `purchase_flow.delivery_address`.
- A confirmacao de dados mostra frete e `Total com frete`.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-delivery-cep-shipping-static.test.mjs`

---

### 2026-05-07 - Fase 4N validacao real de CPF/CNPJ

**Objetivo da etapa:** impedir que CPF/CNPJ com pontuacao ou caracteres extras seja salvo sem validar os digitos verificadores.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-customer-document-checkdigits-static.test.mjs`

**Entregue nesta etapa:**
- CPF/CNPJ continua aceitando entrada com ponto, traco, barra e espacos, mas o bot aproveita somente os numeros.
- CPF agora precisa ter 11 digitos, nao pode ser sequencia repetida e precisa passar nos dois digitos verificadores.
- CNPJ agora precisa ter 14 digitos, nao pode ser sequencia repetida e precisa passar nos dois digitos verificadores.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-customer-document-checkdigits-static.test.mjs`

---

### 2026-05-07 - Fase 4O parcelamento do carrinho

**Objetivo da etapa:** usar a mesma regra de juros/parcelamento da maquina de cartao no resumo do carrinho do WhatsApp.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-cart-card-fees-static.test.mjs`

**Entregue nesta etapa:**
- O resumo do carrinho consulta `payment_fees` pelo helper `calculateAutoresponderMaxInstallment()`.
- A mensagem do carrinho passa a mostrar `Parcelamento no cartao`.
- A confirmacao final do cliente calcula o parcelamento sobre o total com frete quando houver entrega.

**Verificacoes executadas:**
- `node tmp-tests\autoresponder-cart-card-fees-static.test.mjs`

**Proxima etapa documentada:**
- Quando o cliente perguntar uma parcela especifica, por exemplo `em 5x fica quanto?`, responder destacando a parcela solicitada no formato `Em 5x fica R$ X = xxxx` e enviar tambem a tabela completa de 1x ate 12x com base em `payment_fees`.
- Se houver carrinho ativo, calcular sobre o total atual do carrinho; se ja houver frete confirmado, calcular sobre o total com frete.

---

### 2026-05-07 - Fase 4P pergunta de parcela especifica

**Objetivo da etapa:** responder diretamente quando o cliente perguntar uma parcela especifica do carrinho, como `em 5x fica quanto?`.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-specific-installment-reply-static.test.mjs`

**Entregue nesta etapa:**
- Helper `getAutoresponderRequestedInstallments()` para detectar mensagens como `5x`, `em 5x`, `5 vezes`, `parcelar em 5` e perguntas genericas de parcelamento.
- Helper `calculateAutoresponderInstallmentOptions()` para montar opcoes de 1x ate 12x usando `payment_fees` do canal presencial.
- Helper `formatAutoresponderSpecificInstallmentReply()` destacando a parcela solicitada e enviando a tabela completa.
- O webhook responde a pergunta de parcelamento antes de tratar categorias/listas numeradas.
- Se houver frete confirmado, o calculo usa o total do carrinho com frete.
- Log novo: `purchase_specific_installment_quote`.

**Verificacoes executadas:**
- `node tmp-tests/autoresponder-specific-installment-reply-static.test.mjs`

---

### 2026-05-07 - Fase 4Q escolha de parcelamento

**Objetivo da etapa:** permitir que o cliente escolha uma opcao de parcelamento do carrinho e deixar essa forma de pagamento salva para o fechamento assistido.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-installment-choice-static.test.mjs`

**Entregue nesta etapa:**
- Helper `isAutoresponderInstallmentChoiceRequest()` para diferenciar pergunta de parcelamento de escolha do cliente.
- Helper `buildAutoresponderSelectedInstallmentPayment()` para montar `selected_payment` com metodo, parcelas, valor da parcela, total no cartao e taxa aplicada.
- Helper `buildAutoresponderSelectedInstallmentReply()` para confirmar a escolha ao cliente.
- O webhook salva `selected_payment` no `purchase_flow` quando o cliente responder frases como `quero 5x`, `pode ser 3x` ou `fecha em 10x`.
- O snapshot de dados do pedido passa a priorizar `selected_payment` quando existir.
- Log novo: `purchase_installment_selected`.

**Verificacoes executadas:**
- `node tmp-tests/autoresponder-installment-choice-static.test.mjs`

---

### 2026-05-07 - Fase 4R vinculo do cliente ao carrinho

**Objetivo da etapa:** deixar o cliente criado ou encontrado vinculado explicitamente ao carrinho/pedido temporario do WhatsApp.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-customer-cart-link-static.test.mjs`

**Entregue nesta etapa:**
- Helper `buildAutoresponderCustomerLinkedPurchaseFlow()` para centralizar o vinculo do cliente ao `purchase_flow`.
- Ao finalizar cadastro/atualizacao, o carrinho salva `customer_id`, `customer_record` e `customer_linked_at`.
- O status segue como `customer_record_ready`, agora com dados suficientes para o fechamento assistido gerar resumo do pedido sem buscar o cliente de novo.

**Verificacoes executadas:**
- `node tmp-tests/autoresponder-customer-cart-link-static.test.mjs`

---

### 2026-05-07 - Fase 4S fechamento assistido

**Objetivo da etapa:** quando o cliente ja estiver vinculado ao carrinho, gerar o resumo para atendente, pausar o bot e avisar o cliente que a equipe vai finalizar.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-attendant-handoff-static.test.mjs`

**Entregue nesta etapa:**
- Helper `formatAutoresponderAttendantOrderSummary()` para montar resumo interno com cliente, telefone, CPF/CNPJ, itens, subtotal, frete, total, pagamento escolhido, entrega/retirada e observacoes.
- Helper `buildAutoresponderCustomerOrderHandoffReply()` com a mensagem para o cliente: "Seu pedido foi separado para um atendente finalizar...".
- Helper `pauseAutoresponderConversationForPurchase()` para pausar automaticamente a conversa com `pause_reason = pedido_em_andamento`.
- Ao finalizar o cadastro, o `purchase_flow` passa para `pedido_em_andamento`, salva `attendant_summary` e `handoff_created_at`.
- Log novo: `purchase_request`.

**Verificacoes executadas:**
- `node tmp-tests/autoresponder-attendant-handoff-static.test.mjs`

---

### 2026-05-29 - Busca generica de celulares com refinamento

**Objetivo da etapa:** evitar que palavras amplas como "celular", "celulares", "smartphone", "smartphones", "tablet", "tablets", "receptor" ou "receptores" disparem uma lista grande de produtos sem confirmar a intencao do cliente.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-catalog-request-static.test.mjs`

**Entregue nesta etapa:**
- Helper `detectAutoresponderGenericDeviceCatalogFamily()` para identificar pedidos genericos de celulares/smartphones, tablets e receptores.
- Helper `isAutoresponderGenericPhoneCatalogRequest()` mantido para compatibilidade com a regra de celulares.
- Helper `buildAutoresponderDeviceCatalogRefinementPrompt()` com pergunta de refinamento antes da listagem.
- Novo intent `catalog_phone_refinement` para celulares e `catalog_device_refinement` para tablets/receptores.
- Pedidos especificos continuam seguindo a busca normal; exemplo: "iPhone", "Xiaomi ate R$ 1.000", "Redmi Pad", "BTV" ou "lista de celulares".

**Verificacoes executadas:**
- `node tmp-tests/autoresponder-catalog-request-static.test.mjs`

---

### 2026-05-29 - Busca de modelo com acessorios relacionados

**Objetivo da etapa:** quando o cliente perguntar no vazio por um modelo de smartphone, tablet ou receptor, contextualizar a resposta antes da lista e indicar quando os itens encontrados forem acessorios relacionados.

**Arquivos criados/alterados:**
- `vps_server.cjs`
- `vps_server.js`
- `Bot_Whatsapp.md`
- `tmp-tests/autoresponder-model-accessory-context-static.test.mjs`

**Entregue nesta etapa:**
- Helper `detectAutoresponderDeviceFamilyFromSearch()` para reconhecer familias smartphone, tablet e receptor.
- Helper `isAutoresponderAccessoryProduct()` para identificar acessorios por nome/categoria/dados do produto.
- Helper `buildAutoresponderModelAccessorySearchTitle()` para montar o texto antes da lista.
- A lista passa a abrir com contexto como "Para iPhone 11..." e, quando fizer sentido, "Encontramos alguns acessorios para esse smartphone/tablet/receptor:".
- Buscas diretas por acessorios, como "capinha iPhone 11", continuam como lista objetiva de produtos.

**Verificacoes executadas:**
- `node tmp-tests/autoresponder-model-accessory-context-static.test.mjs`

---

## Pendências abertas

1. **Token secreto:** `AUTORESPONDER_TOKEN` gerado/configurado fora do código e app AutoResponder liberado. Concluído; manter sem hardcode no repositório.
2. **Texto das mensagens default** (`human_message_in_hours`, `human_message_out_of_hours`, `fallback_message`, `auto_pause_fallback_message`): confirmado e aplicado na VPS. Concluído.
3. **Granularidade do bot fora do horário:** confirmar que bot responde sempre 24/7 (apenas a mensagem de transferência humana muda por horário). ✅ Confirmado.
4. **Multi-tenant:** decisão atual confirmada: AutoResponder é single-tenant para Mercado do Vale. Se algum dia virar produto vendido para outras lojas, todas as queries precisarão filtrar por `company_id`.
5. **`getStoreStatus` para `closing_soon`:** decidir se trata como "dentro do horário" (default) ou avisa que está fechando.
6. **Pesos da busca:** relevância básica aplicada com prioridade para SKU exato, nome, marca e specs/custom fields. Concluído.

---

## Anexos / Referências

- App: [autoresponder.ai](https://www.autoresponder.ai/) (TK Studio, Alemanha)
- Webhook URL: `https://api.xiaomipetrolina.com.br/autoresponder-webhook`
- Página admin: `/admin/atendimento-automatico`
- Página de horários da loja: `/admin/settings/company`
- Helper de horário: [utils/storeStatus.ts](utils/storeStatus.ts)
- Helper de parcelas: [services/installmentCalculator.ts](services/installmentCalculator.ts)
- Padrão de mensagem: [utils/whatsappMessageGenerator.ts](utils/whatsappMessageGenerator.ts)
- Bot Telegram referência: [api/telegram-webhook.ts](api/telegram-webhook.ts)
- Servidor VPS: [vps_server.cjs](vps_server.cjs)

---

_Última atualização: 2026-05-29_
_Versão do plano: v14_
