# Inventario De Limpeza Do AutoResponder

## Regra

Nao apagar arquivo sem classificar como `remover`, `manter` ou `arquivar`.

## Candidatos A Remover

| Arquivo | Motivo | Acao |
|---|---|---|
| Nenhum nesta auditoria | Os testes temporarios ja ausentes foram registrados em `Removidos` | aguardar rodada real de atendimento antes da remocao final do legado de produto/compra |

## Removidos

| Arquivo | Commit | Substituido por |
|---|---|---|
| tmp-tests/autoresponder-standalone-delivery-cep-static.test.mjs | ja ausente antes desta rodada | tmp-tests/autoresponder-core-scenarios.cjs; tmp-tests/autoresponder-no-purchase-flow-outside-purchase-static.test.mjs |
| tmp-tests/autoresponder-delivery-cep-replace-static.test.mjs | ja ausente antes desta auditoria | tmp-tests/autoresponder-core-scenarios.cjs (`purchase delivery cep replacement`) |
| tmp-tests/autoresponder-delivery-cep-shipping-static.test.mjs | ja ausente antes desta auditoria | tmp-tests/autoresponder-core-scenarios.cjs (`purchase delivery shipping`) |
| tmp-tests/autoresponder-choice-instructions-static.test.mjs | ja ausente antes desta auditoria | tmp-tests/autoresponder-product-search-engine-static.test.mjs |

## Candidatos A Manter

| Arquivo | Motivo |
|---|---|
| docs/autoresponder/response-map.md | Fonte operacional do mapa do bot |
| docs/autoresponder/test-scenarios.md | Checklist obrigatorio de simulacao |
| docs/autoresponder/engine-v2-rollout-audit.md | Auditoria das flags restantes antes de remover legado de produto/compra |
| docs/autoresponder/engine-v2-rollout-runbook.md | Runbook de rollback/revalidacao da flag `AUTORESPONDER_ENGINE_V2` ja ativa na VPS |
| tmp-tests/autoresponder-core-scenarios.cjs | Runner principal de regressao |
| tmp-tests/autoresponder-bot-map-admin-static.test.mjs | Trava da aba Mapa do Bot e sender seguro `mapa-*` |
| tmp-tests/autoresponder-no-purchase-flow-outside-purchase-static.test.mjs | Trava contra retorno de estados legados fora de compra |
| tmp-tests/autoresponder-ai-first-delivery-cep-static.test.mjs | Trava de ordem para entrega pelo engine antes de IA/regras |
| tmp-tests/autoresponder-priority-product-router-static.test.mjs | Trava para produto prioritario antes do engine de entrega |
| tmp-tests/autoresponder-delivery-engine-integration-static.test.mjs | Garante integracao do motor de entrega nos servidores |
| tmp-tests/autoresponder-bot-doc-helper-static.test.mjs | Trava para centralizar a leitura de `Bot_Whatsapp.md` antes do arquivamento |
| tmp-tests/autoresponder-product-search-engine-static.test.mjs | Cobertura do motor novo de busca de produto |
| tmp-tests/autoresponder-purchase-engine-static.test.mjs | Cobertura do motor novo de compra |
| tmp-tests/autoresponder-engine-v2-rollout-static.test.mjs | Trava para nao remover flags de produto/compra antes da validacao de producao |
| tmp-tests/autoresponder-engine-v2-rollout-runbook-static.test.mjs | Trava do runbook e da ferramenta dry-run de rollout |

## Observacoes De Deploy

| Arquivo | Situacao |
|---|---|
| vps_server.cjs | Fonte usada por `deploy-vps-server-only.cjs` para publicar `server.js` e `vps_server.js` na VPS |
| vps_server.js | Fonte usada por scripts legados de deploy e por testes estaticos de paridade |
| server.js | Copia local de compatibilidade; manter checagens de sintaxe, mas nao tratar como fonte primaria sem reconciliar paridade com `vps_server.cjs` |
| AUTORESPONDER_ENGINE_V2 | Ativo em producao na VPS em 2026-06-07; manter runbook de rollback ate concluir uma rodada real de atendimento |

## Candidatos A Arquivar

| Arquivo | Motivo | Destino |
|---|---|---|
| docs/operacional/*autoresponder* | Evidencias antigas e runbooks especificos | manter se ainda forem usados; arquivar se substituidos |

## Documentos Revisados

| Arquivo | Decisao | Motivo |
|---|---|---|
| docs/autoresponder/archive/Bot_Whatsapp.md | arquivado | Historico operacional preservado; testes `tmp-tests/autoresponder-*.test.mjs` e `tools/check-autoresponder-synology-readiness.cjs` validam conteudo via `tools/autoresponder-bot-doc.cjs` |
| docs/autoresponder/response-map.md | manter | Fonte operacional atual do mapa do bot |
| docs/autoresponder/test-scenarios.md | manter | Checklist atual dos cenarios centrais |
| docs/autoresponder/engine-v2-rollout-audit.md | manter | Registro das pre-condicoes para remover o legado restante |
| docs/autoresponder/engine-v2-rollout-runbook.md | manter | Procedimento operacional para ativar, validar e reverter `AUTORESPONDER_ENGINE_V2` |
| docs/superpowers/plans/2026-05-28-autoresponder-ia-training.md | manter | Plano historico ainda referenciado para regras de infraestrutura e treinamento de IA |
| docs/superpowers/plans/2026-06-05-autoresponder-reformulation.md | manter | Plano ativo desta reformulacao |

## Referencias Encontradas

| Referencia | Situacao |
|---|---|
| docs/autoresponder/archive/Bot_Whatsapp.md cita `autoresponder-choice-instructions-static.test.mjs` | referencia historica preservada no arquivo arquivado |
| docs/autoresponder/archive/Bot_Whatsapp.md cita `autoresponder-delivery-cep-shipping-static.test.mjs` | referencia historica preservada no arquivo arquivado |
| Testes `tmp-tests/autoresponder-*.test.mjs` leem o documento via `tools/autoresponder-bot-doc.cjs` | dependencia ativa de conteudo; caminho arquivado suportado pelo helper |
| `tools/check-autoresponder-synology-readiness.cjs` le o documento via `tools/autoresponder-bot-doc.cjs` | dependencia operacional ativa de conteudo; caminho arquivado suportado pelo helper |
| docs/superpowers/plans/2026-06-05-autoresponder-reformulation.md cita candidatos de limpeza | plano ativo; manter ate concluir checklist |

## Criterios Para Remover

- O novo teste cobre o mesmo comportamento.
- O arquivo nao e chamado por `package.json`, docs, deploy ou runbook ativo.
- `rg "nome-do-arquivo"` nao encontra referencia ativa fora deste inventario, do plano ou de arquivo arquivado.
- Build e cenarios centrais passam depois da remocao.
- Estados fora de compra continuam usando `conversation_state`, nao `purchase_flow.status`.
- Documentos so podem ser movidos depois que testes, ferramentas e links ativos deixarem de depender do caminho antigo.

## Pendencias Para Fechamento

- [x] Ativar `AUTORESPONDER_ENGINE_V2=1` no ambiente de producao de forma controlada.
- [ ] Validar produto e compra pelo motor novo em pelo menos uma rodada real de atendimento.
- [x] Expandir `tmp-tests/autoresponder-core-scenarios.cjs` para troca de CEP e compra com entrega/frete.
- [x] Migrar a ponte de `awaiting_customer_document` para o motor novo antes de remover o fallback de compra.
- [ ] Remover as flags e os caminhos legados de produto/compra somente depois dessas validacoes.
- [x] Centralizar a leitura de `Bot_Whatsapp.md` em `tools/autoresponder-bot-doc.cjs` antes de arquivar ou renomear o documento.
- [x] Arquivar `Bot_Whatsapp.md` em `docs/autoresponder/archive/Bot_Whatsapp.md` mantendo as validacoes antigas pelo helper.
- [ ] Publicar a API depois da limpeza final.

## Validacoes Recentes

| Data | Escopo | Resultado |
|---|---|---|
| 2026-06-07 | Revalidacao tecnica antes da rodada real: `/health` 200, dry-run confirmou `AUTORESPONDER_ENGINE_V2=1`, `tmp-tests/autoresponder-core-scenarios.cjs` passou contra a API publicada | passou |
| 2026-06-07 | `AUTORESPONDER_ENGINE_V2=1` ativado na VPS, `/health`, `tmp-tests/autoresponder-core-scenarios.cjs` e dump controlado de compra com entrega/frete | passou |
| 2026-06-07 | Hotfix cirurgico: delivery V2 nao intercepta carrinho ativo; product-search V2 nao intercepta `purchase_flow.status` ativo | publicado na VPS com backups em `/var/www/mdv-api/.codex-backups` |
| 2026-06-05 | `tmp-tests/autoresponder-core-scenarios.cjs` cobrindo busca, entrega avulsa, compra com entrega/frete, troca de CEP, retirada com Pix ate pedido de nome, fallback contextual de CEP | passou |
| 2026-06-05 | `npm.cmd run build` com `scripts/assert-no-supabase-runtime.cjs` | passou |
