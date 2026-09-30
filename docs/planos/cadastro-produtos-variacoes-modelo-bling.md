# Plano: cadastro de produtos com variaÃ§Ãµes no modelo do Bling

Data: 30/09/2026

## Objetivo

Permitir criar e manter uma famÃ­lia completa em uma Ãºnica tela: produto pai, atributos de variaÃ§Ã£o e SKUs filhos. O resultado deve preservar a estrutura canÃ´nica jÃ¡ existente no Mercado do Vale (`is_parent` + `parent_id`) e evitar agrupamentos inferidos apenas por nome.

## O que foi observado no Bling

- O campo `Formato` separa produto simples, produto com variaÃ§Ãµes e produto com composiÃ§Ã£o.
- Uma famÃ­lia aparece como uma linha pai, com a quantidade de variaÃ§Ãµes visÃ­vel.
- Cada opÃ§Ã£o aparece como uma linha filha com SKU e estoque prÃ³prios.
- O nome do filho recebe a variaÃ§Ã£o de forma explÃ­cita, por exemplo `Cor:Branco` e `Cor:Preto`.
- O preÃ§o pode ser herdado do pai; na listagem observada, o preÃ§o dos filhos estava bloqueado com a informaÃ§Ã£o de que era herdado.
- O pai organiza a famÃ­lia e nÃ£o precisa representar estoque vendÃ¡vel; o saldo fica nos filhos.

Exemplo real observado, sem qualquer alteraÃ§Ã£o salva no Bling:

- Pai: `Suporte MagnÃ©tico 360Â° DobrÃ¡vel para Celular Divida OIS063`, SKU `OIS063`, duas variaÃ§Ãµes.
- Filho: `... Cor:Branco`, SKU `OIS063B`, estoque 2.
- Filho: `... Cor:Preto`, SKU `OIS063P`, estoque 2.

## Estado atual do Mercado do Vale

O modelo de dados principal jÃ¡ estÃ¡ alinhado ao Bling:

- pai: `products.is_parent = 1` e `products.parent_id = null`;
- filho: `products.is_parent = 0` e `products.parent_id = <id local do pai>`;
- vÃ­nculo externo: `bling_id` no pai/filho e `bling_parent_id` no filho;
- o formulÃ¡rio jÃ¡ oferece `Produto simples`, `FamÃ­lia de variaÃ§Ãµes` e `VariaÃ§Ã£o vendÃ¡vel`;
- a API jÃ¡ possui fechamento idempotente de `bling_parent_id` para `parent_id` e rota de agrupamento manual.

O principal desvio de experiÃªncia Ã© operacional: hoje o pai e cada variaÃ§Ã£o sÃ£o cadastrados/editados separadamente. TambÃ©m existem consumidores legados que ainda inferem famÃ­lia por modelo e nome quando deveriam priorizar `parent_id`.

## Fonte de verdade proposta

1. `parent_id` define a famÃ­lia local e sempre vence heurÃ­sticas de nome/modelo.
2. `bling_parent_id` serve para importar e reconciliar o relacionamento externo, mas deve ser convertido para o `parent_id` local.
3. Nome, descriÃ§Ã£o, categoria, marca e configuraÃ§Ãµes comuns pertencem ao pai, com possibilidade de substituiÃ§Ã£o explÃ­cita no filho.
4. SKU, EAN/GTIN, atributos de variaÃ§Ã£o, imagens especÃ­ficas e estoque pertencem ao filho.
5. PreÃ§o deve ter uma polÃ­tica declarada por famÃ­lia: `herdar do pai` ou `preÃ§o por variaÃ§Ã£o`; nunca inferir silenciosamente.

## Entregas planejadas

### Fase 1 — Consolidar o contrato de famÃ­lia

- Fazer todos os agrupadores de catÃ¡logo, painel, PDP e publicaÃ§Ã£o priorizarem `parent_id`.
- Manter a assinatura por nome/modelo somente como fallback para registros legados sem pai.
- Criar auditoria somente leitura que liste filhos Ã³rfÃ£os, pais sem filhos, SKUs duplicados e grupos inferidos que ainda nÃ£o possuem `parent_id`.
- Cobrir com testes: mesma famÃ­lia, famÃ­lias distintas, pai sem estoque, filho Ã³rfÃ£o e nomes com `Cor:<valor>`.

### Fase 2 — Editor de famÃ­lia em uma Ãºnica tela

- Ao escolher `FamÃ­lia de variaÃ§Ãµes`, exibir uma seÃ§Ã£o `Grade de variaÃ§Ãµes`.
- Permitir escolher e ordenar eixos como Cor, RAM, Armazenamento e Tamanho.
- Permitir inserir os valores de cada eixo e gerar as combinaÃ§Ãµes.
- Mostrar uma tabela editÃ¡vel por combinaÃ§Ã£o com nome, SKU, EAN, estoque, preÃ§o, imagem, status e local de estoque.
- Gerar sugestÃµes de nome (`Nome do pai + Cor:<valor>`) e SKU, mas exigir confirmaÃ§Ã£o e unicidade.
- Permitir adicionar, desativar ou remover uma combinaÃ§Ã£o antes de salvar.

### Fase 3 — Salvamento atÃ´mico e heranÃ§a

- Criar um endpoint transacional para salvar pai e filhos juntos.
- Validar todos os itens antes da gravaÃ§Ã£o; se uma variaÃ§Ã£o falhar, nenhuma parte da famÃ­lia deve ficar parcialmente criada.
- Registrar a polÃ­tica de heranÃ§a de preÃ§o e quais campos podem ser sobrescritos no filho.
- Proibir estoque no pai e consolidar a disponibilidade como soma dos filhos vendÃ¡veis.
- Preservar IDs e SKUs existentes ao editar a grade, evitando recriar variaÃ§Ãµes e romper vÃ­nculos com marketplaces.

### Fase 4 — ImportaÃ§Ã£o e sincronizaÃ§Ã£o com o Bling

- Importar o pai uma Ãºnica vez e ligar os filhos pelo `bling_parent_id`.
- Tornar a importaÃ§Ã£o idempotente por `bling_id`, com fallback controlado por SKU.
- Mapear atributos estruturados da variaÃ§Ã£o do Bling para `specs` sem depender do sufixo do nome.
- Sincronizar preÃ§o herdado do pai somente quando a famÃ­lia estiver configurada dessa forma.
- Sincronizar estoque exclusivamente no filho correspondente.
- Exibir uma prÃ©via do plano de inclusÃµes, atualizaÃ§Ãµes e conflitos antes de aplicar qualquer reconciliaÃ§Ã£o em massa.

### Fase 5 — MigraÃ§Ã£o assistida e publicaÃ§Ã£o

- Gerar relatÃ³rio dos grupos legados candidatos a famÃ­lia por `model_id`, `bling_parent_id` e nome normalizado.
- Exigir confirmaÃ§Ã£o do operador para casos ambÃ­guos; nunca unir famÃ­lias apenas porque compartilham um modelo genÃ©rico.
- Aplicar backfill em lotes pequenos, com log e reversÃ£o do relacionamento.
- Validar catÃ¡logo, PDP, estoque, Shopee, Mercado Livre e Loja 3D antes de ampliar o lote.

## CritÃ©rios de aceite

- Uma famÃ­lia com duas cores aparece como um Ãºnico card no catÃ¡logo e como duas opÃ§Ãµes vendÃ¡veis.
- O pai nÃ£o reduz nem aumenta estoque; o saldo exibido Ã© a soma dos filhos elegÃ­veis.
- Alterar estoque de um filho nÃ£o altera outro filho.
- O preÃ§o herdado muda nos filhos somente quando essa polÃ­tica estiver ativa.
- Duas famÃ­lias diferentes nunca sÃ£o unidas apenas por nome parecido ou `model_id` genÃ©rico.
- Importar ou sincronizar novamente nÃ£o duplica pai nem variaÃ§Ãµes.
- Uma falha durante o salvamento nÃ£o deixa uma famÃ­lia incompleta.

## Ordem recomendada

Implementar primeiro as fases 1 e 2. A fase 1 estabiliza a estrutura existente; a fase 2 entrega o ganho operacional percebido no Bling. As fases 3 e 4 atravessam API, banco e integraÃ§Ã£o protegida e devem ser executadas em uma publicaÃ§Ã£o prÃ³pria, com plano de rollback e autorizaÃ§Ã£o antes de qualquer migraÃ§Ã£o ou reconciliaÃ§Ã£o real.
