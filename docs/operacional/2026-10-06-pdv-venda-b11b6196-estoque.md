# Conferencia da venda B11B6196 — 2026-10-06

Diagnostico somente leitura no banco e runtime da VPS. Venda b11b6196-0c86-47a1-8b95-49ffc90f9ae2, total R$ 100,00, registrada em 2026-10-05 11:10:42 UTC (08:10:42 em Sao Paulo). Permanece finalization_status=needs_review, por ER_LOCK_WAIT_TIMEOUT na baixa por prioridade.

| SKU | Evidencia | Saldo atual |
| --- | --- | --- |
| Cx-Transp-Cel | Nenhum movimento sale vinculado a esta venda. Sync bling_stock_sync as 13:12:08 UTC reduziu o local de 25 para 24; outro local manteve 5. | 29 |
| LY-13 | Movimento sale vinculado a esta venda as 11:12:03 UTC: 4 para 3. Sync bling_stock_sync as 20:14:39 UTC: 3 para 2. | 2 |

A falha da baixa desta venda corresponde a pelicula. A sincronizacao posterior nao possui reference_id da venda; a correspondencia com sua quantidade nao prova a origem. Nao reaplicar a baixa automaticamente: ha risco de descontar novamente quantidade ja refletida pelo Bling.

No runtime, o servico abre transacao, bloqueia produto e consulta locais com JOIN em depositos/locais e FOR UPDATE. Em erro, executa rollback. Nao ha retry limitado de lock timeout, nem consulta de movimento existente por venda/produto antes de baixar. Isso e um ponto de melhoria, nao prova qual transacao provocou o bloqueio historico.

O frontend registra a venda, captura falha na baixa e continua o envio separado ao Bling. O marcador needs_review nao e reconciliado automaticamente quando um sync posterior muda o saldo.

Limitacoes: logs atuais nao forneceram o lock historico no horario da venda; inbox de webhooks nao retornou os dois produtos nesse dia. Usuario de banco nao possui PROCESS para consultar INNODB_TRX. Nenhuma permissao alterada.

Pendencias:
- [x] Conferir historico do LY-13: saldo inicial 4, venda 10805 em 22/05/2026 de 1 unidade, venda B11B6196 em 05/10/2026 de 1 unidade. Saldo Bling 2, igual ao sistema; nenhuma duplicacao desta venda no historico visivel.
- [x] Confirmar saida da pelicula no Bling em 05/10/2026 08:12:06, 1 unidade, observacao Venda #B11B6196 — PDV Mercado do Vale, saldo 29 igual ao sistema.
- [x] Implementar localmente concorrencia e idempotencia por venda/produto, com testes de rollback/retry e ausencia de baixa duplicada.
- [x] Incluir SKU, produto e quantidade no erro da baixa; resposta de bloqueio informa esgotamento de tres tentativas.
- [ ] Adicionar instrumentacao detalhada por tentativa/etapa SQL para identificar futuros bloqueios historicos.
- [x] Publicar v1.2.554-pdv-baixa-segura e validar consulta da interface em producao; API/MySQL saudaveis, pelicula sem movimento local e fone com uma baixa. Registro da conferencia nao executado.
- [ ] Registrar a conferencia desta venda apos publicacao. O marcador de producao permanece needs_review.

Nenhum saldo, venda ou configuracao foi alterado; nenhuma publicacao ou restart feito neste diagnostico.

## Conferencia no Bling autenticado

Em 2026-10-06, consulta visual somente leitura no Controle de Estoques, deposito 01 (Loja). Pelicula: saida unica da venda B11B6196 as 08:12:06 de 05/10, saldo geral 29. Fone: saida unica desta venda as 08:12:08, saldo geral 2. No fone, as duas saidas totais sao a venda 10805 de 22/05 e B11B6196 de 05/10, sobre saldo inicial 4 de 28/04. A quantidade 4 no local do nosso sistema antes da baixa estava acima do saldo historico do Bling (3 antes desta venda); o sync posterior alinhou ambos a 2. Nao existe nova saida no Bling no horario do sync local das 17:14 de 05/10.

Conclusao: saldos atuais alinhados, sem evidencia de baixa duplicada desta venda no Bling. Nao repetir a baixa. O timeout local e a falta de reconciliacao automatica da auditoria continuam pendentes. Nao houve gravacao no Bling nem alteracao de estoque/venda.

Evidencias: C:/Users/Nitro/AppData/Local/Temp/mdv-bling-pelicula-venda-b11b6196.png e C:/Users/Nitro/AppData/Local/Temp/mdv-bling-fone-venda-b11b6196.png.

## Correcao local implementada em 2026-10-06

A baixa numerica bloqueia primeiro a venda, depois o produto e seus saldos. O JOIN usado para ordenar depositos/locais nao aplica FOR UPDATE sobre os cadastros compartilhados. Timeout/deadlock permite ate tres tentativas, sempre com rollback antes de repetir; conexao cujo rollback falhar e descartada. A consulta por venda/produto reconhece a quantidade ja baixada e rejeita quantidade divergente. Itens repetidos do carrinho sao agrupados por produto. Repeticao reconhecida nao reenvia a sincronizacao aos canais.

Nos detalhes da venda, a conferencia administrativa compara quantidades com movimentos locais. Movimentos parciais ou excedentes bloqueiam a reconciliacao. Quando nao existe movimento local, exige confirmacao explicita por SKU, quantidade, referencia da venda e anotacao do historico do Bling. A operacao altera somente a auditoria da venda: preserva o erro original e o responsavel, remove apenas a pendencia de baixa e mantem outras falhas. A evidencia registrada tambem impede uma baixa posterior repetida desse item. Nenhum saldo e modificado pela conferencia.

Validacao local: testes de rollback, bloqueios, concorrencia, repeticao e reconciliacao; regressoes de prioridade, finalizacao e unidades; verificacao de sintaxe e build de producao passaram. O compilador TypeScript nao esta instalado no projeto, portanto nao houve verificacao completa de tipos. A interface ainda precisa ser validada com a API publicada. Sem migracao de schema, alteracao de dados, publicacao ou restart neste trabalho.

Publicacao posterior autorizada: commit a7996863, tag v1.2.554-pdv-baixa-segura, site /var/www/mdv-site/releases/20261006-140147-pdv-baixa-segura. API reiniciada com backup /var/www/mdv-api/backups/pdv-stock-recovery-1791295525420. Interface autenticada e consulta de movimentos validadas sem registrar conferencia. Nenhum saldo ou marcador da venda alterado.
