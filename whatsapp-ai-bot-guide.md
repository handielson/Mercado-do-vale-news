# Estrutura Avançada: Bot Vendedor de Alta Conversão (n8n + Evolution)

Este guia prático descreve exatamente a estrutura que você deve desenhar no seu **n8n** para obter a inteligência máxima (Visão Computacional, Áudio Whisper, Ferramentas de Estoque e Memória Perpétua).

---

## Passo 1: O Ouvido (Webhook Evolution)
No n8n, crie um nó **Webhook**.
- **Method:** `POST`
- **Path:** `whatsapp-inbox`
- Quando receber o URL gerado (ex: `https://seu-n8n/webhook/whatsapp-inbox`), vá no seu **Easypanel** > Evolution API (ou painel de instâncias se tiver), ou acesse o Swagger da Evolution e registre o Webhook para o evento `MESSAGES_UPSERT`.

---

## Passo 2: O Filtro e Tratamento (Switch Node)
Todo webhook receberá não apenas os textos do cliente, mas também os status de envio (lido, entregue), e mensagens do próprio robô. Adicione um **Switch** após o Webhook.

**Regras do Switch:**
1. `{{ $json.body.data.fromMe }}` igual a `false`.
2. `{{ $json.body.data.remoteJid }}` NÃO contêm `@g.us` (Impede o bot de responder Sozinho em Grupos).

---

## Passo 3: O Roteador de Mídia (Code Node + Whisper/Vision)
O cliente não manda só texto. Ele manda Áudio e Foto. Adicione um nó **Code** após o Switch para mapear o tipo de entrada:

```javascript
const msgData = $input.item.json.body.data;
let finalMessage = "";
let hasMedia = false;
let mediaType = "none";
let base64Media = "";

if (msgData.messageType === "audioMessage") {
    // A cliente mandou áudio
    hasMedia = true;
    mediaType = "audio";
    base64Media = msgData.message.base64; // Dependendo da config da Evolution, vem em base64.
} 
else if (msgData.messageType === "imageMessage") {
    // O cliente mandou foto
    hasMedia = true;
    mediaType = "image";
    base64Media = msgData.message.base64; 
} 
else {
    // Texto comum
    finalMessage = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || "";
}

return {
    remoteId: msgData.remoteJid,
    pushName: msgData.pushName,
    message: finalMessage,
    hasMedia: hasMedia,
    mediaType: mediaType,
    base64Media: base64Media
};
```

**Opcional - Transcrição de Áudio (Whisper):** 
Se o nó anterior disser que `mediaType === "audio"`, crie um nó da **OpenAI (Audio)** configurado para *Transcriptions*. Ele converterá o áudio choroso do cliente em texto puro antes de passar pro cérebro!

---

## Passo 4: O Cérebro (AI Agent - Advanced AI)
Conecte o fluxo (Texto Limpo ou Áudio Transcrito) em um nó chamado **AI Agent**. Lembre-se, o AI Agent do n8n exige conexões por "cabos verticais" abaixo dele.

### 4.1 O Modelo (Chat Model)
Conecte ao nó AI Agent um nó **Google Gemini Chat Model**.
- **Model:** `gemini-2.5-flash` (Altamente recomendado para ler fotos e tomar boas decisões financeiras em tempo real e de graça).

### 4.2 A Memória (Window Buffer Memory)
Conecte um nó **Window Buffer Memory**.
- **Session ID:** `{{ $json.remoteId }}` (Isso garante que o robô não misture a conversa do João com a conversa da Maria! Ele lembra de tudo enquanto a compra está acontecendo).

### 4.3 A Ferramenta (Tool: Ler Estoque)
Este é o pulo do gato. Conecte um nó **HTTP Request Tool** (cabo verde). Essa ferramenta faz a ponte entre a IA e o banco de dados que criamos agorinha.

- **Tool Name:** `checar_estoque_celulares`
- **Description:** `USE SEMPRE ESTA FERRAMENTA quando o cliente perguntar o preço de algo, se tem no estoque ou pedir os celulares baratos, caros, iPhones, Xiaomis. Esta ferramenta possui o catálogo oficial atualizado.`
- **Method:** `GET`
- **URL:** `https://[SUBSTITUA_PELA_SUA_URL_DO_SUPABASE].supabase.co/rest/v1/ai_product_catalog_view?select=*`
- **Header:** 
  - `apikey`: `[A_SUA_ANON_KEY_DO_SUPABASE_NO_ARQUIVO_ENV]`

---

## Passo 5: O Comportamento (System Prompt)
Clique no nó **AI Agent** e no campo "System Message", cole o Prompt de Alta Conversão abaixo:

> "Você é o atendente de vendas de alta performance do *Mercado do Vale*, loja focada em iPhones e Xiaomis. Seu objetivo é realizar vendas, criar senso de urgência respeitoso e humanizar o atendimento (use humor leve e 1-2 emojis por frase).
> 
> **MANDAMENTOS:**
> 1. CHAME A FERRAMENTA 'checar_estoque_celulares' obrigatóriamente se a pessoa pedir os produtos, preços, ou perguntar se "tem iphone 13", etc.
> 2. Quando listar, divida o valor retornado do banco de dados (que está em centavos) por 100 para dar o valor em Reais (R$).
> 3. Nunca invente preços, promoções falsas ou garanta entregas inexistentes.
> 4. Se o usuário enviou uma Foto Pessoal: Fale algo bacana e profissional sobre a imagem, depois puxe para a venda ("Que foto bacana! Imagina tirar ela num iPhone novo... Aliás, temos oferta nesse!").
> 5. Se ele quiser Fechar, diga que enviará a requisição para um humano de faturamento (Pix/Cartão) para segurança dele."

---

## Passo 6: O Retorno (HTTP Request - Evolution SendText)
O pino de saída do **AI Agent** terá a mensagem perfeita e montada. Agora só falta devolver pro WhatsApp do cliente.

Adicione um nó final comum HTTP Request:
- **Method:** `POST`
- **URL:** `https://whatsapp-bot-evolution-api.7am0gd.easypanel.host/message/sendText`
- **Header:**
  - `apikey`: `429683C4C977415CAAFCCE10F7D557E11`
- **Body JSON:**
```json
{
  "instance": "nome_da_sua_instancia",
  "remoteJid": "={{ $json.remoteId }}",
  "msg": "={{ $json.output }}"
}
```

> **🔥 Bônus (Vision):** Com o modelo `gemini-2.5-flash` no nó do Gemini, se no Passo 3 você detectar que enviaram uma imagem, você pode apenas passar o Base64 na entrada do Agente e ele magicamente entenderá a foto como se tivesse olhos!
