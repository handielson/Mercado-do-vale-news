---
name: conversational-design
description: Super-especialista em design de conversas para bots de atendimento. Fluxos de conversa, persona do bot, NLP, intenções, fallbacks, handoff humano, scripts de resposta e experiência conversacional no WhatsApp. Ativar ao projetar ou revisar os fluxos e textos do bot.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Conversational Design — Bots que Parecem Humanos

> **Missão:** Um bot de atendimento excelente não é aquele que parece humano — é aquele que resolve o problema do usuário de forma rápida e sem frustração.
> **Princípio:** Projete para o erro, não para o sucesso.

---

## 1. PRINCÍPIOS FUNDAMENTAIS

### As 4 Máximas de Grice (Cooperação Conversacional)

```
1. QUANTIDADE:  Diga o suficiente — nem mais, nem menos
2. QUALIDADE:   Diga apenas o que você sabe ser verdade
3. RELAÇÃO:     Seja relevante para o contexto
4. MODO:        Seja claro, evite ambiguidade

Aplicação no bot:
→ Respostas curtas e objetivas (WhatsApp não é email)
→ Nunca invente informações — diga "não sei" com graça
→ Sempre responda o que foi perguntado antes de oferecer extras
→ Linguagem simples, frases curtas
```

### Regras de Ouro para WhatsApp

```
✅ Máximo 3-4 frases por mensagem
✅ Use emojis com moderação (1-2, contextuais)
✅ Quebre textos longos em 2-3 mensagens separadas
✅ Evite markdown (* bold *, _italic_) — nem todos rendeirizam
✅ Listas: use • ou - ao invés de markdown
✅ Sempre termine com uma ação clara ("Deseja continuar?")
✅ Use o nome do usuário quando souber (personalização)

❌ Nunca: mensagens com 10+ linhas
❌ Nunca: responder com apenas "Ok" ou "Certo"
❌ Nunca: usar jargões técnicos ou corporativos
❌ Nunca: pedir informações que você não vai usar
```

---

## 2. PERSONA DO BOT

### Template de Definição de Persona

```
NOME: [Nome amigável — ex: Val, Max, Bia]
EMPRESA: Mercado do Vale
TOM: Amigável, direto, prestativo
ESTILO: Casual profissional (nem formal demais, nem muito informal)
MISSÃO: Ajudar o cliente a resolver seu problema o mais rápido possível

PODE DIZER:
  ✅ "Oi, [Nome]! 😊"
  ✅ "Claro, deixa eu verificar isso pra você!"
  ✅ "Encontrei aqui! O iPhone 13 está por R$1.899. Quer saber mais?"

NÃO DEVE DIZER:
  ❌ "Prezado cliente" (muito formal)
  ❌ "De nada!" como resposta isolada
  ❌ "Infelizmente não posso ajudar com isso" sem alternativa
  ❌ Responder em outra língua se o cliente escreveu em português

QUANDO ERRAR:
  ✅ "Não entendi bem. Pode reformular de outra forma?"
  ✅ "Hmm, isso está além do que consigo responder. Posso te conectar com nossa equipe?"
```

### Ajustar Tom por Situação

| Situação | Tom | Exemplo |
|----------|-----|---------|
| Boas-vindas | Caloroso | "Oi! Bem-vindo ao Mercado do Vale 😊" |
| Dúvida técnica | Preciso + empático | "Entendo! Esse modelo vem com..." |
| Reclamação | Empático primeiro | "Que situação chata! Vou resolver isso agora." |
| Fechamento de venda | Motivador | "Ótima escolha! Vamos finalizar?" |
| Handoff humano | Tranquilizador | "Vou te conectar com nossa equipe. Aguarde só um momento!" |

---

## 3. ARQUITETURA DE FLUXO CONVERSACIONAL

### Diagrama de Fluxo Padrão (Bot E-commerce)

```
[ENTRADA]
    ↓
[BOAS-VINDAS + MENU PRINCIPAL]
    → "Olá! Sou o Val do Mercado do Vale 😊
       Como posso ajudar?
       1️⃣ Ver produtos
       2️⃣ Status do pedido
       3️⃣ Falar com atendente"
    ↓
[INTENÇÃO DO USUÁRIO]
    ├─ VER PRODUTOS
    │    → "Qual categoria te interessa?"
    │       [LISTA: Smartphones, Notebooks, Acessórios]
    │    → Apresenta 3-5 produtos com preço
    │    → "Quer saber mais sobre algum? Manda o número 😊"
    │
    ├─ STATUS DO PEDIDO
    │    → "Qual o número do seu pedido ou CPF?"
    │    → [Busca no sistema]
    │    → Apresenta status: "Seu pedido #1234 está a caminho!
    │       Previsão: amanhã até as 18h 📦"
    │
    ├─ FALAR COM ATENDENTE
    │    → "Sem problema! Vou te conectar agora.
    │       Nossa equipe responde em até 5 minutos. ⏰"
    │    → [Notifica equipe + ativa modo humano]
    │
    └─ NÃO RECONHECIDO (fallback)
         → "Não entendi bem 😅 Pode escolher uma opção:"
           [Reapresenta menu]
```

### Estados da Conversa (State Machine)

```
ESTADOS POSSÍVEIS:
  new            → Novo usuário, nunca interagiu
  menu           → Aguardando escolha do menu
  browsing       → Navegando produtos
  asking_order   → Aguardando número do pedido
  in_support     → Atendimento humano ativo
  resolved       → Problema resolvido, conversa encerrada
  waiting        → Bot aguardando resposta do usuário

TRANSIÇÕES:
  new       → menu (ao receber primeira mensagem)
  menu      → browsing (escolheu ver produtos)
  menu      → asking_order (escolheu status pedido)
  menu      → in_support (pediu atendente)
  browsing  → menu (digita "0" ou "voltar")
  in_support → menu (atendente libera o chat)

PERSISTÊNCIA: Salvar estado no Redis por número de telefone
```

---

## 4. INTENÇÕES E UTTERANCES

### Mapeamento de Intenções

```
INTENÇÃO: ver_produtos
Utterances: "quero ver produtos", "o que vocês vendem", 
            "tem iphone?", "ver catálogo", "products", "1"

INTENÇÃO: status_pedido
Utterances: "meu pedido", "onde está meu pedido", "rastreio", 
            "entrega", "status", "código de rastreamento", "2"

INTENÇÃO: falar_humano
Utterances: "falar com humano", "atendente", "pessoa real",
            "quero falar com alguém", "suporte", "3", "help"

INTENÇÃO: saudacao
Utterances: "oi", "olá", "bom dia", "boa tarde", "boa noite",
            "hey", "ola", "tudo bem", "oie"

INTENÇÃO: agradecimento
Utterances: "obrigado", "valeu", "brigado", "obg", "thanks"

INTENÇÃO: encerrar
Utterances: "tchau", "até logo", "obrigado por enquanto",
            "não preciso mais", "bye"

INTENÇÃO: negacao
Utterances: "não", "nao", "n", "não quero", "não preciso"

INTENÇÃO: confirmacao
Utterances: "sim", "s", "yes", "claro", "pode ser", "ok", "certo"
```

### Detecção de Intenção no n8n (Code Node)

```javascript
function detectIntent(text) {
  const t = text.toLowerCase().trim();
  
  // Saudações
  if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|oie)/.test(t)) 
    return 'saudacao';
  
  // Pedidos  
  if (/pedido|rastreio|entrega|status|onde está|rastrear/.test(t))
    return 'status_pedido';
  
  // Produtos
  if (/produto|catálogo|catalogo|comprar|preço|valor|iphone|samsung|notebook/.test(t))
    return 'ver_produtos';
  
  // Humano
  if (/humano|atendente|pessoa|suporte|falar com/.test(t))
    return 'falar_humano';
  
  // Confirmação
  if (/^(sim|s|yes|claro|ok|certo|pode|tudo bem|beleza)$/.test(t))
    return 'confirmacao';
  
  // Negação
  if (/^(não|nao|n|no|nope|neg)$/.test(t))
    return 'negacao';
  
  // Encerramento
  if (/tchau|até logo|bye|encerrar|não preciso/.test(t))
    return 'encerrar';
  
  return 'desconhecido'; // → AI Agent para resposta livre
}
```

---

## 5. FALLBACK STRATEGY

### Hierarquia de Fallbacks

```
NÍVEL 1 — Não entendeu a mensagem:
  "Hmm, não entendi bem 😅 Pode tentar de outra forma?"
  → Segunda tentativa

NÍVEL 2 — Ainda não entendeu:
  "Parece que estou tendo dificuldade em ajudar com isso.
   Posso te mostrar o menu ou conectar com nossa equipe:"
  [Botões: Ver Menu | Falar com Atendente]

NÍVEL 3 — Terceira falha seguida:
  → Transferência automática para humano
  "Vou te conectar com nossa equipe para te ajudar melhor! ✨"
```

### Contador de Falhas no Redis

```javascript
// Incrementar contador de fallback:
// Redis INCR fallback:[phone]
// Redis EXPIRE fallback:[phone] 600 (resetar em 10min)

// Verificar limite:
const failures = await redis.incr(`fallback:${phone}`);
if (failures === 1) await redis.expire(`fallback:${phone}`, 600);

if (failures >= 3) {
  // Transferir para humano
  return 'human_handoff';
}
```

---

## 6. SCRIPTS DE RESPOSTA PRONTOS

### Boas-Vindas (Primeira Interação)

```
Oi, [Nome]! 👋 Bem-vindo ao Mercado do Vale!

Sou o Val, seu assistente virtual. Posso te ajudar com:

🛒 Ver nossos produtos
📦 Status do seu pedido  
💬 Falar com nossa equipe

O que você precisa hoje?
```

### Boas-Vindas (Usuário Retornando)

```
Oi, [Nome]! Que bom te ver de novo 😊

Como posso ajudar hoje?
1️⃣ Ver produtos
2️⃣ Status do pedido
3️⃣ Falar com atendente
```

### Apresentação de Produto

```
📱 *iPhone 13 128GB*

• Tela: 6.1" Super Retina XDR
• Câmera: Sistema duplo de 12MP
• Bateria: Até 19 horas de vídeo
• Chip: A15 Bionic

💰 De ~~R$2.499~~ por *R$1.899*
• 12x de R$158 sem juros no cartão
• Ou R$1.804 no Pix (5% off)

Disponibilidade: Em estoque ✅

Quer mais informações ou já quer garantir o seu? 😊
```

### Status do Pedido

```
Encontrei seu pedido! 📦

Pedido #[ID]
Produto: [Nome do produto]
Status: *Em trânsito*

🚚 Previsão de entrega: [DATA]
Rastreio: [CÓDIGO] ([TRANSPORTADORA])

Posso ajudar com mais alguma coisa?
```

### Handoff para Humano

```
Sem problema! Vou te conectar com nossa equipe agora. 🤝

⏱ Tempo médio de espera: 3-5 minutos

Por enquanto, pode me contar mais sobre o que precisa. Isso vai agilizar o atendimento!
```

### Agradecimento e Encerramento

```
Que ótimo que consegui ajudar, [Nome]! 😊

Se precisar de mais alguma coisa, é só mandar mensagem.

Boas compras no Mercado do Vale! 🛒✨
```

### Fora do Horário Comercial

```
Oi, [Nome]! 👋

Nosso atendimento humano funciona:
📅 Seg a Sex: 8h às 18h
📅 Sábado: 9h às 13h

Mas posso te ajudar com produtos e pedidos agora mesmo!

O que você precisa? 😊
```

### Produto Não Encontrado

```
Hmm, não encontrei esse produto no momento 🤔

Pode ser que:
• O produto esteja fora de estoque
• O nome esteja diferente

Posso te mostrar produtos similares ou você quer falar com nossa equipe?
```

---

## 7. COLETA DE INFORMAÇÕES (SLOT FILLING)

### Padrão para Coletar Dados em Sequência

```
EXEMPLO: Rastrear Pedido

PASSO 1 — Bot pede o dado:
  "Qual o número do seu pedido?
   (Você encontra no email de confirmação 📧)"

PASSO 2 — Usuário responde:
  → Salvar na sessão: session.waitingFor = 'order_id'
  → Validar formato: /^\d+$/ ou /^MV\d+$/

PASSO 3 — Se inválido:
  "Hmm, esse número não parece certo 🤔 
   O número do pedido tem apenas dígitos, tipo: 1234
   Pode tentar de novo?"

PASSO 4 — Se válido:
  → Buscar no sistema
  → Apresentar resultado
  → Limpar waitingFor da sessão
```

### Campos Comuns para Coletar

```javascript
// No início de cada mensagem, verificar:
if (session.waitingFor) {
  switch(session.waitingFor) {
    case 'order_id':
      // Tratar a mensagem como order_id
      validateAndProcessOrderId(message);
      break;
    case 'cpf':
      validateAndProcessCPF(message);
      break;
    case 'cep':
      validateAndProcessCEP(message);
      break;
    default:
      // Processar normalmente
  }
} else {
  // Fluxo normal de intenção
}
```

---

## 8. MÉTRICAS DE QUALIDADE DO BOT

### KPIs Essenciais

| Métrica | O que mede | Meta |
|---------|-----------|------|
| **Containment Rate** | % resoluções sem humano | > 70% |
| **Fallback Rate** | % de mensagens não entendidas | < 10% |
| **Handoff Rate** | % que pede atendente | < 30% |
| **CSAT** | Satisfação pós-atendimento | > 4.0/5.0 |
| **Tempo de resposta** | Latência do bot | < 3 segundos |
| **Resolution Rate** | % de problemas resolvidos | > 80% |

### Pesquisa de Satisfação Automática

```
TRIGGER: 30 minutos após conversa encerrada (se não reaberta)

MENSAGEM:
  "[Nome], como foi seu atendimento hoje?
   
   ⭐ 1 — Péssimo
   ⭐⭐ 2 — Ruim
   ⭐⭐⭐ 3 — Regular
   ⭐⭐⭐⭐ 4 — Bom
   ⭐⭐⭐⭐⭐ 5 — Excelente"

SE NOTA < 3:
  "Que pena 😔 Pode me contar o que aconteceu?
   Seu feedback é muito importante para melhorarmos!"
  → Notificar gestor

SE NOTA >= 4:
  "Que ótimo! Fico feliz em ter ajudado 😊
   Até a próxima!"
```

---

## 9. ANTI-PADRÕES CONVERSACIONAIS

### ❌ O que NUNCA fazer

```
BOT RÍGIDO:
❌ "Por favor, escolha uma das opções: 1, 2 ou 3"
   (e rejeitar qualquer outra resposta)
✅ Aceitar variações e sinonimos

BOT VERBOSO:
❌ Mensagem com 15 linhas de texto
✅ Máximo 4 linhas, quebrar em mais mensagens se necessário

BOT SEM EMPATIA:
❌ "Sua solicitação foi processada."
✅ "Prontinho! Já registrei aqui 😊"

BOT QUE MENTE:
❌ "Seu pedido chegará em 2 dias" (sem verificar)
✅ "Deixa eu verificar o prazo exato pra você..."

BOT QUE ESQUECE:
❌ Perguntar o mesmo dado 2x na mesma conversa
✅ Usar sessão para lembrar nome, pedido, preferências

BOT IRRITANTE:
❌ Enviar 5 mensagens em 2 segundos
✅ Delay de 1-2s entre mensagens, presence: composing
```

---

## 10. CHECKLIST DE LANÇAMENTO

```
PRÉ-LANÇAMENTO:
[ ] Testar todos os fluxos principais com número de teste
[ ] Testar fallbacks (mandar mensagens aleatórias)
[ ] Testar em horário fora do comercial
[ ] Verificar filtro de mensagens próprias (fromMe)
[ ] Confirmar que grupos são ignorados
[ ] Testar handoff humano end-to-end
[ ] Verificar notificações para equipe funcionando
[ ] Testar com conexão de internet lenta (simular delay)

PÓS-LANÇAMENTO (1ª semana):
[ ] Monitorar fallback rate diariamente
[ ] Ler as primeiras 50 conversas manualmente
[ ] Ajustar utterances não reconhecidas
[ ] Calibrar tom baseado no feedback real
[ ] Verificar se handoff está funcionando em produção
```

---

## Related Skills

| Skill | Quando Usar |
|-------|------------|
| `n8n-workflows` | Implementar os fluxos no n8n |
| `whatsapp-bot-evolution` | Configurar Evolution API e enviar mensagens |
| `product-copywriting` | Escrever os textos das mensagens do bot |
| `sales-psychology` | Gatilhos nas mensagens de produto |
