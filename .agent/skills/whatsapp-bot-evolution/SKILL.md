---
name: whatsapp-bot-evolution
description: Super-especialista em WhatsApp Business via Evolution API. Instalação, instâncias, webhooks, tipos de mensagem, limites, anti-ban, QR Code, mídia, botões, listas e integração com n8n. Ativar ao trabalhar com WhatsApp automation via Evolution API.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# WhatsApp Bot via Evolution API

> **Evolution API v2** — Bridge entre WhatsApp e automações externas
> **Repositório:** https://github.com/EvolutionAPI/evolution-api
> **Docs:** https://doc.evolution-api.com

---

## 1. O QUE É A EVOLUTION API

```
Evolution API é uma API REST self-hosted que permite controlar
o WhatsApp via Baileys (protocolo não-oficial WhatsApp Web) ou 
via WhatsApp Business Cloud API (oficial Meta).

MODO BAILEYS (padrão para automação):
  ✅ Gratuito
  ✅ Conexão via QR Code (igual WhatsApp Web)
  ✅ Suporte a botões, listas, mídia
  ⚠️ Risco de ban em uso abusivo (spam, automação agressiva)
  ⚠️ Não tem SLA do Meta

MODO CLOUD API (oficial Meta):
  ✅ Suportado oficialmente pelo Meta
  ✅ Templates para mensagens outbound
  ❌ Mais caro (paga por conversa)
  ❌ Não suporta botões nativos no mesmo formato
```

---

## 2. INSTALAÇÃO COM DOCKER

### docker-compose.yml mínimo

```yaml
version: '3'
services:
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution_api
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=http://localhost:8080
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=SUA_API_KEY_AQUI
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      - QRCODE_LIMIT=30
      - WEBHOOK_GLOBAL_ENABLED=true
      - WEBHOOK_GLOBAL_URL=http://SEU_N8N:5678/webhook/whatsapp
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
      - STORE_MESSAGES=true
      - STORE_MESSAGE_UP=true
      - STORE_CONTACTS=true
      - STORE_CHATS=true
      - DATABASE_ENABLED=false  # true para persistência completa
    volumes:
      - evolution_data:/evolution/instances
volumes:
  evolution_data:
```

### Após subir o container

```bash
# Acessar o Manager (interface web):
http://localhost:8080/manager

# Testar API:
curl -X GET http://localhost:8080/instance/fetchInstances \
  -H "apikey: SUA_API_KEY_AQUI"
```

---

## 3. GERENCIAR INSTÂNCIAS

### Criar Instância (uma instância = um número WhatsApp)

```bash
POST http://localhost:8080/instance/create
Headers: { "apikey": "SUA_API_KEY" }
Body:
{
  "instanceName": "mercado-do-vale",
  "integration": "WHATSAPP-BAILEYS",
  "qrcode": true,
  "webhook": {
    "url": "http://SEU_N8N:5678/webhook/whatsapp",
    "byEvents": false,
    "base64": false,
    "events": [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE",
      "CALL"
    ]
  }
}
```

### Conectar via QR Code

```bash
# Obter QR Code:
GET http://localhost:8080/instance/connect/mercado-do-vale
Headers: { "apikey": "SUA_API_KEY" }

# Resposta: { "code": "DATA:IMAGE/PNG;BASE64,..." }
# Escanear com o WhatsApp (igual WhatsApp Web)

# Verificar status de conexão:
GET http://localhost:8080/instance/connectionState/mercado-do-vale
# Resposta: { "instance": { "state": "open" } }
# Estados: "open" | "connecting" | "close"
```

### Reconexão Automática

```javascript
// No n8n — verificar estado da conexão periodicamente:
// Schedule Trigger → a cada 5 minutos
// GET /instance/connectionState/[INSTANCE]
// IF state !== 'open' → alertar equipe via Telegram
```

---

## 4. CONFIGURAÇÃO DE WEBHOOKS

### Eventos Disponíveis

| Evento | Trigger |
|--------|---------|
| `MESSAGES_UPSERT` | Nova mensagem recebida (mais importante) |
| `MESSAGES_UPDATE` | Mensagem atualizada (lida, deletada, etc.) |
| `MESSAGES_DELETE` | Mensagem deletada |
| `CONNECTION_UPDATE` | Estado da conexão mudou |
| `CALL` | Chamada recebida |
| `CHATS_UPSERT` | Chat novo ou atualizado |
| `CONTACTS_UPSERT` | Contato criado ou atualizado |
| `PRESENCE_UPDATE` | Status online/digitando de contato |
| `GROUPS_UPSERT` | Grupo criado ou atualizado |

### Estrutura do Payload MESSAGES_UPSERT

```json
{
  "event": "messages.upsert",
  "instance": "mercado-do-vale",
  "data": {
    "key": {
      "remoteJid": "5511999990000@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB04B4F12345ABCDE"
    },
    "message": {
      "conversation": "Texto da mensagem aqui"
    },
    "messageType": "conversation",
    "messageTimestamp": 1704067200,
    "pushName": "João Silva",
    "participant": null
  },
  "destination": "http://meu-n8n.com/webhook/whatsapp",
  "date_time": "2024-01-01T12:00:00.000Z",
  "server_url": "http://localhost:8080",
  "apikey": "SUA_API_KEY"
}
```

### Identificar Tipo de Mensagem

```javascript
// messageType / chave dentro de message:
"conversation"           → Texto simples
"extendedTextMessage"    → Texto com link/preview
"imageMessage"           → Imagem (.jpg/.png)
"videoMessage"           → Vídeo (.mp4)
"audioMessage"           → Áudio (ptt = voice note)
"documentMessage"        → Arquivo (PDF, DOCX, etc.)
"stickerMessage"         → Sticker
"locationMessage"        → Localização
"contactMessage"         → Contato compartilhado
"reactionMessage"        → Reação a mensagem
"buttonsResponseMessage" → Resposta de botão
"listResponseMessage"    → Resposta de lista
"templateButtonReplyMessage" → Resposta de template button

// Extrair texto independente do tipo (Code node n8n):
const msg = $json.data.message;
const text = 
  msg.conversation ||
  msg.extendedTextMessage?.text ||
  msg.buttonsResponseMessage?.selectedButtonId ||
  msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
  '';
```

---

## 5. TIPOS DE MENSAGEM PARA ENVIAR

### Texto Simples

```bash
POST /message/sendText/mercado-do-vale
{
  "number": "5511999990000",
  "options": {
    "delay": 1200,          # delay em ms antes de enviar
    "presence": "composing" # mostra "digitando..."
  },
  "textMessage": {
    "text": "Olá! Tudo bem? 😊"
  }
}
```

### Imagem

```json
{
  "number": "5511999990000",
  "mediaMessage": {
    "mediatype": "image",
    "caption": "Legenda da imagem",
    "media": "https://url.com/imagem.jpg"
    // OU "media": "BASE64_STRING"
  }
}
```

### Áudio (Voice Note)

```json
{
  "number": "5511999990000",
  "audioMessage": {
    "audio": "https://url.com/audio.mp3",
    "encoding": true  // true = aparece como voice note
  }
}
```

### Botões Interativos

```json
{
  "number": "5511999990000",
  "buttonMessage": {
    "title": "Título da mensagem",
    "description": "Descrição ou corpo",
    "footer": "Rodapé da mensagem",
    "buttons": [
      { "buttonId": "id1", "buttonText": { "displayText": "Opção 1" } },
      { "buttonId": "id2", "buttonText": { "displayText": "Opção 2" } },
      { "buttonId": "id3", "buttonText": { "displayText": "Opção 3" } }
    ]
  }
}
```

> ⚠️ Botões funcionam apenas com Baileys. Máx 3 botões por mensagem.

### Lista (List Message)

```json
{
  "number": "5511999990000",
  "listMessage": {
    "title": "Título",
    "description": "Descrição",
    "buttonText": "Abrir lista",
    "footerText": "Rodapé",
    "sections": [
      {
        "title": "Seção 1",
        "rows": [
          { "rowId": "row1", "title": "Item 1", "description": "desc" },
          { "rowId": "row2", "title": "Item 2", "description": "desc" }
        ]
      }
    ]
  }
}
```

### Marcar Mensagem como Lida

```bash
POST /chat/markMessageAsRead/mercado-do-vale
{
  "readMessages": [
    {
      "id": "MSG_ID",
      "fromMe": false,
      "remoteJid": "5511999990000@s.whatsapp.net"
    }
  ]
}
```

---

## 6. ANTI-BAN: BOAS PRÁTICAS

### Limites Seguros (Baileys)

```
VOLUME DIÁRIO POR NÚMERO:
  ✅ < 200 mensagens únicas/dia = baixo risco
  ⚠️ 200-500 = risco moderado
  🔴 > 500 = alto risco de bloqueio

INTERVALOS ENTRE MENSAGENS:
  ✅ Mínimo 1-2 segundos entre mensagens diferentes
  ✅ Use delay: 1000-3000 nas options ao enviar
  ❌ NUNCA enviar mensagens em burst (< 500ms)

COMPORTAMENTO HUMANO:
  ✅ Varie o tamanho das mensagens
  ✅ Use "presence: composing" antes de enviar (parece humano)
  ✅ Evite mensagens idênticas em sequência
  ✅ Responda apenas após receber (não proativamente em massa)
```

### Rate Limiting no n8n

```javascript
// No Code node, antes de enviar:
// Verificar última mensagem enviada para o número
// Redis: GETSET last_msg:[phone] timestamp
// Se diferença < 1000ms → esperar

// Wait node: usar delay aleatório
// Min: 800ms, Max: 2500ms (humano-like)
```

---

## 7. GRUPOS vs. DIRECT

### Identificar se é Grupo

```javascript
// remoteJid termina com:
// @s.whatsapp.net → Direct (individual)
// @g.us           → Grupo
// @broadcast      → Lista de transmissão

const isGroup = $json.data.key.remoteJid.includes('@g.us');
const isDirect = $json.data.key.remoteJid.includes('@s.whatsapp.net');

// Para grupos, o "sender" real é o participant:
const realSender = isGroup 
  ? $json.data.participant  // quem enviou no grupo
  : $json.data.key.remoteJid; // remetente direto
```

---

## 8. GERENCIAR CONTATOS E CHATS

### Verificar se Número Tem WhatsApp

```bash
POST /chat/whatsappNumbers/mercado-do-vale
{
  "numbers": ["5511999990000", "5511888880000"]
}
# Resposta: lista com exists: true/false para cada número
```

### Buscar Foto de Perfil

```bash
GET /chat/fetchProfilePictureUrl/mercado-do-vale?number=5511999990000
# Retorna URL da foto ou null
```

---

## 9. TROUBLESHOOTING COMUM

| Problema | Causa | Solução |
|---------|-------|---------|
| QR Code expira | Timeout de scan | Gerar novo QR via `/instance/connect` |
| Conexão cai | Número desconectado | Verificar `/connectionState` + reconectar |
| Webhook não chega | URL errada ou firewall | Testar com ngrok em dev |
| Mensagem não entrega | Número inválido | Usar `/chat/whatsappNumbers` para validar |
| Bot envia para si mesmo | `fromMe: true` não filtrado | Filtrar `fromMe === false` no início |
| Duplicação de msgs | Webhook chamado 2x | Deduplicar por `message.id` no Redis |
| Ban do número | Volume alto ou spam | Reduzir volume, usar delays maiores |

---

## Related Skills

| Skill | Quando Usar |
|-------|------------|
| `n8n-workflows` | Construir o workflow n8n completo |
| `conversational-design` | Design dos fluxos de conversa |
