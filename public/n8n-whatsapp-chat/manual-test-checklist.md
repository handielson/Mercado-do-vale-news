# WhatsApp Chat Manual Test Checklist

## Preconditions

- n8n service is online.
- Evolution API service is online.
- The WhatsApp test number is connected to Evolution API.
- The official production WhatsApp number is not connected to this n8n test flow.
- Existing non-chat automatic messages are unchanged.
- n8n workflow `Mercado do Vale WhatsApp Chat Test` is imported and active.

## Test Cases

| Case | Message | Expected Intent | Expected Reply |
| --- | --- | --- | --- |
| 1 | `oi` | `saudacao` | Mentions Mercado do Vale and offers product, horario, entrega, or atendente. |
| 2 | `quero comprar` | `fallback` | Says the message was received and an attendant will continue. |
| 3 | `tem iPhone?` | `produto_preco` | Asks for model or product. |
| 4 | `qual o horario?` | `horario_endereco` | Says attendance can confirm horario and endereco. |
| 5 | `faz entrega?` | `entrega` | Asks for bairro. |
| 6 | `quero falar com atendente` | `falar_atendente` | Says the chat will be marked for human attendance. |

## For Each Test

Record:

- Date and time.
- Sender phone.
- n8n execution id.
- Evolution API instance status.
- Actual reply.
- Pass or fail.
- Fix applied when it fails.

## Stop Conditions

Stop testing and fix before continuing if:

- n8n replies from the official production number.
- n8n triggers campaign, birthday, post-sale, sale-completed, or marketing messages.
- Evolution API disconnects the test number repeatedly.
- The same customer receives duplicate replies for a single message.
- n8n exposes API keys, database passwords, or customer private data in a public response.
