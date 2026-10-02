# Custo de aquisição por SKU

Decisão do operador em 02/10/2026: usar média ponderada do custo com despesas de aquisição no Mercado do Vale, mantendo a configuração de cálculo do Bling.

`products.price_cost` é o resultado em centavos. `products.specs._acquisition_cost` guarda os movimentos conferidos, depósito, data, URL de origem, base e resultado. Custo de compra, cadastro do fornecedor e preço do pai não comprovam essa média. Importação/reimportação de produtos e webhook deixam esse campo de custo intacto; produtos novos sem histórico permanecem sem custo e não podem ser precificados pela automação.

O cálculo canônico está em `services/blingAcquisitionCost.cjs`. Aceita histórico completo revisado de um depósito proprietário de estoque; começa no último balanço e pondera balanço e entradas pelo custo unitário com despesas. Saídas conferem o saldo, mas não são novas aquisições. Quantidades usam milésimos e valores usam centavos. Transferências ou composição entre depósitos exigem conciliação antes da importação; não somar duas vezes a mesma aquisição. Históricos incompletos, duplicados, sem custo positivo ou divergentes são bloqueados.

A configuração observada da conta Bling calcula a média pelo preço de compra. Para as cinco variações CSRC855G, os balanços de 04/09/2026 exibem compra R$5 e custo R$7; logo o sistema próprio usa R$7. O pai não recebe média arbitrária das cores. Essa conferência não prova que o restante do catálogo tenha o mesmo custo.

A referência oficial consultada foi [custo médio em relatórios](https://ajuda.bling.com.br/hc/pt-br/articles/360056093354-Como-visualizar-o-Custo-M%C3%A9dio-dos-produtos-em-relat%C3%B3rios-). A API v3 oficial consultada em 02/10/2026 expõe consulta de saldos, mas não leitura do histórico de movimentos de estoque: `/estoques` cria e `/estoques/{idEstoque}` atualiza. Portanto este importador não inventa uma consulta de histórico nem promete coleta automática pelo endpoint de produto. Os lançamentos precisam ser conferidos na interface ou obtidos por uma exportação validada.

## Importar históricos conferidos

Guardar os arquivos comerciais fora do repositório. Cada histórico JSON usa schema `mdv.bling.acquisition.v1`, SKU, ID Bling, ID local, custo anterior esperado, depósito, URL, data de observação, `complete:true`, saldo atual em milésimos e movimentos com ID, data ISO, tipo `balance/entry/exit`, quantidade em milésimos e `costCents` para aquisições. `purchaseCents` é só evidência; não entra no cálculo.

```powershell
node scripts/import-bling-acquisition-costs.cjs CAMINHO.json
node scripts/import-bling-acquisition-costs.cjs CAMINHO.json --apply
```

A prévia não altera produtos. A aplicação trava e verifica cada identidade, saldo e custo anterior em transação; grava apenas custo, evidência e data de atualização. Preserva estoque, preços de venda e demais características. Recibo com custos/evidências anteriores fica no home da API em `.mdv/cost-imports`, antes da gravação. Em interrupção, conferir os produtos e o recibo antes de repetir. Rollback comercial deve restaurar somente os custos/evidências registrados, após conferir que não houve nova alteração.

Publicação da proteção do webhook: `node deploy-vps-server-only.cjs --bling-acquisition-cost-only`. O patch seletivo preserva outras rotas e aborta se a seção em produção divergir da versão anterior do commit. Testes: `node --test tmp-tests/bling-acquisition-cost.test.cjs`.
