# Evolution API: presença “digitando” nas respostas automáticas do bot

## Contexto

O bot de WhatsApp recebe mensagens pelo webhook `/autoresponder-webhook`. Quando a origem é Evolution API, o hook `onSend` intercepta as respostas geradas pelo autoresponder e envia cada item por `sendAutoresponderEvolutionReplies()`, que hoje chama `sendAutoresponderEvolutionTextMessage()` diretamente.

Também existe envio manual por atendente em `/autoresponder/conversations/:sender/manual-message`, usando a mesma função de envio de texto. Esse fluxo não deve simular “digitando”, para não confundir mensagem humana com resposta automática.

## Comportamento desejado

Quando o bot automático for responder a uma mensagem recebida pela Evolution API, o cliente deve ver o WhatsApp da loja como “digitando” antes do texto chegar. Se a chamada de presença falhar, a resposta deve continuar sendo enviada normalmente.

## Design

Adicionar uma função pequena para enviar presença de digitação via Evolution API usando o número já normalizado do destinatário. Essa função será chamada apenas dentro de `sendAutoresponderEvolutionReplies()`, antes de cada `sendAutoresponderEvolutionTextMessage()`.

O tempo de digitação será curto e proporcional ao tamanho da mensagem, com limites mínimos e máximos para evitar atraso exagerado. A pausa será feita no servidor antes do envio do texto. Falhas de presença serão tratadas como não críticas: registram aviso em log, mas não bloqueiam a resposta.

## Escopo

Incluído:

- Respostas automáticas do bot enviadas pelo webhook Evolution.
- Uma simulação de digitação por mensagem enviada.
- Teste estático garantindo que a presença está no fluxo automático e não no envio manual.

Fora do escopo:

- Mensagens manuais de atendentes.
- Notificações automáticas que usam WhatsApp fora do autoresponder.
- Interface administrativa para configurar tempo de digitação.

## Testes

Criar um teste estático em `tmp-tests/` que valide:

- existência de uma função de presença/typing para Evolution;
- uso dessa função em `sendAutoresponderEvolutionReplies()`;
- chamada de presença antes de `sendAutoresponderEvolutionTextMessage()`;
- ausência de chamada direta de typing no endpoint de mensagem manual.
