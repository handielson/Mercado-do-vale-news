# Teste de familia Poco X8 Pro

Data: 2026-10-05. Estado: configurado em producao; aguardando aprovacao do operador antes de ampliar para outros modelos.

Pai: Poco X8 Pro 5G, SKU PX8PRO-PAI, ID 62ef9491-a373-4fbd-83ed-4965234c2c12. Modelo: 438dc426-f126-4577-984b-1fab0d4c616c. Pai sem estoque proprio, sem heranca de custo ativada e sem vinculo externo criado.

Filhos vinculados pelo endpoint transacional existente PATCH /products/variation-group:

- PX8P8256P
- PX85G8256A
- PX85G8256V
- PX85G8512P
- PX85G12512P
- PX85G12512V
- PX85G12512A
- PX85G12512B

Leitura antes/depois confirmou preservacao de nome, SKU, specs, precos, custo, estoque, status, visibilidade, controle de estoque e vinculos Bling de cada filho. Mudanca nos filhos limitada a parent_id/is_parent e updated_at pelo endpoint. Backup local para reversao dos vinculos: C:/Users/Nitro/AppData/Local/Temp/mdv-poco-x8-family-before.json (nao versionar dados brutos).

Validacao publica: busca Poco X8 mostrou um unico card de smartphone, com 8GB/256GB nas cores amarelo/preto/verde e 12GB/512GB nas cores amarelo/branco. A opcao 8GB/512GB continua cadastrada, mas nao aparece na vitrine por estoque zero. Acessorios permanecem separados.

Nao houve alteracao de codigo, deploy, ajuste de estoque ou publicacao em marketplaces. A regra existente nas secoes Mais Recentes/novidades/mais vendidos ainda apresenta variacoes individuais; o teste de card unico foi na busca/catalogo agrupado.

Pendencias:

- [x] Trava de nome implementada localmente: titulo, breadcrumb e nome dos cards usam parent_name vindo do cadastro do pai. Trocar variacao preserva esse nome; pagina busca o pai quando a API anterior ainda nao envia parent_name. Cadastro sem nome do pai disponivel nao e exibido como familia valida.
- [x] Testes de nome da familia, nomes publicos existentes, agrupamento generico, sintaxe CJS e build passaram. Navegador local confirmou verde 8/256 -> branco 12/512 sem mudar o titulo, com SKU/preco da opcao atualizados.
- [ ] Publicar frontend e API da trava de nome e conferir cards em producao; nenhuma publicacao realizada nesta etapa.

- [ ] Operador aprovar a familia e a escolha de memoria/cor.
- [ ] Decidir se as secoes Mais Recentes/novidades/mais vendidos tambem devem exibir somente um card por familia.
- [ ] Apos aprovacao, aplicar o mesmo processo a outros modelos.
- [ ] Revisar os pais antigos 8af5d185-63a2-41f9-b827-d4059620b4d2 e e22ea842-20dc-4604-b503-bfe48a67a62c, agora sem estes filhos. Preservados sem exclusao.
