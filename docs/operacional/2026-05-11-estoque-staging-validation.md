# Validacao Staging - Estoque Multi-Depositos

Data: 11/05/2026

Objetivo: validar a migration e os fluxos reais antes de ativar o estoque multi-depositos em producao.

## Preparacao

- [ ] Confirmar que o ambiente usado e staging/local, nao producao.
- [ ] Registrar URL do projeto Supabase testado.
- [ ] Registrar branch/build do app testado.
- [ ] Criar backup do banco antes da migration.
- [ ] Aplicar `supabase/migrations/20260509000001_multi_deposit_stock.sql`.
- [ ] Rodar `supabase/verify_multi_deposit_stock.sql`.
- [ ] Registrar quantidade de produtos divergentes.
- [ ] Confirmar que existe `Loja Principal / Estoque Geral`.

Dados da execucao:

- Ambiente:
- URL/projeto Supabase:
- Data/hora:
- Responsavel:
- Branch/build:
- Backup criado em:
- Resultado inicial de `stock_location_divergences`:

## Produtos Para Teste

- [ ] Produto A: saldo somente em `Loja Principal`.
- [ ] Produto B: saldo dividido entre `Loja Principal` e outro deposito.
- [ ] Produto C: produto sem controle de estoque, se existir no ambiente.
- [ ] Produto D: produto serializado/IMEI, se existir no ambiente.

## Fluxos Manuais

- [ ] Entrada de estoque soma saldo no local escolhido.
- [ ] Ajuste manual altera saldo e exige motivo.
- [ ] Transferencia move saldo entre locais e nao altera total.
- [ ] Venda PDV do Produto A baixa da `Loja Principal`.
- [ ] Venda PDV do Produto B baixa primeiro da `Loja Principal` e completa em outro deposito.
- [ ] Cancelamento/estorno da venda PDV devolve ao local original.
- [ ] Pedido online pendente cria reserva por prioridade.
- [ ] Pagamento/conclusao do pedido consome reserva.
- [ ] Cancelamento de pedido pendente libera reserva.
- [ ] Cancelamento de pedido pago devolve ao local original.
- [ ] Lista de impressao encontra produto por EAN bipado.
- [ ] Lista de impressao encontra produto por SKU/nome.
- [ ] Lista de impressao imprime `Nome | Variacao | SKU | Codigo de barras EAN | Quantidade`.
- [ ] Lista de impressao nao cria reserva, baixa, ajuste ou transferencia.

## Integracoes Externas

- [ ] Bling continua atualizando `products.stock_quantity`.
- [ ] VPS continua recebendo estoque total por `/products/stock`.
- [ ] Catalogo publico continua lendo somente estoque total.
- [ ] Shopee continua recebendo somente estoque total, sem deposito/local interno.

## Evidencias

- [ ] Print ou export do resultado de `supabase/verify_multi_deposit_stock.sql`.
- [ ] Produto antes/depois da venda PDV.
- [ ] Historico `stock_location_movements` da venda.
- [ ] Historico do cancelamento/estorno.
- [ ] Pedido online antes/depois do pagamento ou cancelamento.
- [ ] Resultado da bipagem EAN na lista de impressao.
- [ ] Resultado final da view `stock_location_divergences`.

## Criterios De Aprovacao

- [ ] Migration executou sem erro.
- [ ] `supabase/verify_multi_deposit_stock.sql` nao acusou objeto ausente.
- [ ] Nenhum produto ficou com divergencia inesperada entre total e locais.
- [ ] Baixa PDV respeitou prioridade da `Loja Principal`.
- [ ] Cancelamento/estorno devolveu ao local original.
- [ ] Pedido online reservou, consumiu e liberou estoque corretamente.
- [ ] Entrada, ajuste e transferencia registraram historico auditavel.
- [ ] Lista de impressao nao movimentou estoque.
- [ ] Bling, VPS, catalogo e Shopee continuaram usando apenas estoque total.

## Criterios De Bloqueio

- [ ] Migration falhou no meio da execucao.
- [ ] Produto ficou com divergencia nao explicada.
- [ ] Venda ou pedido baixou de deposito errado.
- [ ] Cancelamento duplicou estoque.
- [ ] Reserva ficou presa apos cancelamento.
- [ ] Integracao externa recebeu local interno.
- [ ] Catalogo publico exibiu informacao de deposito/local.

## Rollback / Contencao

Se alguma validacao critica falhar:

1. Nao aplicar em producao.
2. Registrar erro, produto, pedido/venda e print da divergencia.
3. Pausar novas vendas no ambiente testado, se necessario.
4. Restaurar backup ou reverter manualmente apenas no ambiente de teste.
5. Validar que `products.stock_quantity` voltou ao valor esperado.
6. Corrigir migration/fluxo e repetir o roteiro desde o inicio.

Tabelas novas que podem ser removidas em ambiente de teste se o rollback for total:

```sql
DROP VIEW IF EXISTS stock_location_divergences;
DROP TABLE IF EXISTS stock_location_movements;
DROP TABLE IF EXISTS product_stock_locations;
DROP TABLE IF EXISTS stock_locations;
DROP TABLE IF EXISTS stock_deposits;
```

Observacao: usar esse rollback apenas em staging/local ou depois de backup confirmado. Em producao, preferir restauracao controlada por backup.

## Resultado

- [ ] Aprovado para producao.
- [ ] Reprovado, com pendencias listadas abaixo.

Pendencias encontradas:

-
