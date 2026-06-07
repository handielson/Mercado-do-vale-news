# Auditoria De Rollout Do Engine V2

## Estado Atual

| Fluxo | Situacao | Motivo |
|---|---|---|
| Entrega | obrigatorio | `handleAutoresponderEngineDeliveryFlowV2` nao depende mais de `AUTORESPONDER_ENGINE_V2` |
| Produto | validacao tecnica OK | `AUTORESPONDER_ENGINE_V2=1` ativo na VPS em 2026-06-07; cenarios centrais passaram contra a API publicada |
| Compra | validacao tecnica OK | `AUTORESPONDER_ENGINE_V2=1` ativo na VPS em 2026-06-07; compra com entrega, troca de CEP e retirada com Pix passaram no runner |

## Pre-condicoes Para Remover O Legado

- [x] Publicar `AUTORESPONDER_ENGINE_V2=1` no ambiente da VPS.
- [x] Rodar `node tmp-tests\autoresponder-core-scenarios.cjs` contra a API publicada.
- [ ] Confirmar uma rodada real de atendimento com busca de produto, escolha, compra, entrega e pagamento sem queda para o fluxo antigo.
- [x] Migrar a ponte de `awaiting_customer_document` para o retorno `purchase_handoff_ready` do motor novo, preservando criacao/atualizacao de cliente, resumo de atendente e pausa da conversa.
- [x] Registrar a data da validacao tecnica em `docs/autoresponder/cleanup-inventory.md`.
- [ ] So entao remover os `return null` condicionados pela flag em produto e compra.

## Dependencias Legadas Deliberadas

| Dependencia | Situacao | Risco se remover agora |
|---|---|---|
| `purchaseReply.intent === 'purchase_handoff_ready'` nos servidores | executa `createOrUpdateAutoresponderCustomer`, `buildAutoresponderCustomerLinkedPurchaseFlow`, `pauseAutoresponderConversationForPurchase` pelo motor novo | precisa permanecer ate a remocao final do legado |
| Bloco `purchaseFlow.status === 'awaiting_customer_document'` nos servidores | fallback legado ainda disponivel como rollback enquanto a remocao final aguarda uma rodada real de atendimento, embora `AUTORESPONDER_ENGINE_V2=1` ja esteja ativo e validado tecnicamente em producao | pedido deixaria de chegar ao atendente se a flag estiver desligada |
| Bloco `purchaseFlow.status === 'awaiting_customer_confirmation'` nos servidores | confirma dados de cliente existente antes do handoff | cliente existente poderia perder confirmacao e vinculo |

## Travas Ativas

- `isAutoresponderEngineV2Enabled()` centraliza a semantica atual da flag: somente `AUTORESPONDER_ENGINE_V2=1` ativa produto e compra no motor novo.
- `tmp-tests/autoresponder-core-scenarios.cjs` cobre produto, entrega fora de compra, compra com entrega/frete, troca de CEP e fallback contextual de CEP.
- `tmp-tests/autoresponder-product-search-engine-static.test.mjs` cobre o motor novo de produto e o helper legado enquanto ele ainda existir.
- `tmp-tests/autoresponder-purchase-engine-static.test.mjs` cobre o motor novo de compra e handoff.
- `tmp-tests/autoresponder-engine-v2-rollout-static.test.mjs` impede marcar a limpeza como finalizada enquanto produto e compra ainda dependerem da flag.
- `docs/autoresponder/engine-v2-rollout-runbook.md` documenta dry-run, ativacao, validacao e rollback da flag na VPS.
- `tmp-tests/autoresponder-engine-v2-rollout-runbook-static.test.mjs` garante que o runbook e a ferramenta `tools/set-autoresponder-engine-v2-vps.cjs` continuem reversiveis.
