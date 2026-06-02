# Plano de Importacao em Massa por Excel

Atualizado em `02/06/2026`.

Este arquivo documenta o plano de produto, regras tecnicas e checklist de producao para o novo fluxo de importacao em massa de produtos via Excel.

## Regra Mestra de Infraestrutura

- A fonte operacional de verdade e a VPS/MySQL.
- Nada novo deve ser criado, lido, sincronizado ou vinculado ao Supabase.
- Supabase e somente fonte legada temporaria, usada apenas para compatibilidade historica enquanto ainda houver dependencia residual comprovada.
- Nao criar novas tabelas, colunas, servicos, imports, jobs, scripts, webhooks ou fluxos apontando para Supabase.
- Antes de implementar qualquer parte desta importacao, procurar por `supabase`, `SUPABASE`, `VITE_SUPABASE`, `services/supabase`, `@supabase/supabase-js` no escopo alterado.
- Se surgir dependencia do Supabase durante a implementacao, migrar para VPS/MySQL ou bloquear a tarefa ate decidir a migracao.
- O objetivo final e excluir o Supabase assim que houver certeza de que nenhum fluxo operacional ainda precisa dele.

## Objetivo

Criar um fluxo seguro de importacao em massa por Excel para cadastrar e atualizar produtos por categoria/modelo, com planilha exemplo gerada pelo sistema, validacao antes da gravacao, deteccao de conflitos, barra de progresso online, logs de debug e relatorio final.

O fluxo deve permitir:

- baixar uma planilha modelo por categoria ou modelo;
- substituir os dados de exemplo pelos dados reais;
- importar novos produtos;
- detectar produtos existentes por SKU;
- perguntar se produtos existentes devem ser atualizados;
- atualizar dados existentes sem alterar fotos;
- validar campos obrigatorios por categoria;
- validar IMEI, serial, EAN, SKU e vinculos Bling;
- sincronizar/preservar vinculo Bling;
- acompanhar progresso em tempo real;
- gerar debug e relatorio de erros.

## Estado Atual

Ja existe uma tela de cadastro em massa:

- `pages/admin/products/BulkRegistrationPage.tsx`
- `components/products/bulk/BulkUploadForm.tsx`
- `components/products/bulk/BulkPreviewTable.tsx`
- `services/bulk-products.ts`
- `utils/excel.ts`

O fluxo atual e simples: le EAN/Serial/IMEI, busca produto base por EAN e tenta clonar. O novo fluxo deve substituir essa abordagem por importacao completa por categoria/modelo e upsert controlado.

## Fluxo de Usuario

1. Usuario acessa `Admin > Produtos > Cadastro em Massa > Excel`.
2. Escolhe categoria ou modelo base.
3. Sistema gera planilha exemplo com as colunas corretas.
4. Usuario baixa a planilha.
5. Usuario substitui os exemplos pelos dados reais.
6. Usuario envia a planilha preenchida.
7. Sistema le a planilha e cria um `import_job_id`.
8. Sistema valida linhas, campos obrigatorios e conflitos.
9. Sistema mostra preview antes de gravar.
10. Se houver SKU existente, sistema pergunta:
    - atualizar existentes sem alterar fotos;
    - ignorar existentes;
    - cancelar importacao.
11. Usuario confirma.
12. Sistema processa em lotes com barra de progresso online.
13. Sistema mostra resumo final.
14. Usuario pode baixar relatorio de importacao.

## Planilha Modelo

A planilha deve ser sempre gerada pelo sistema. O usuario nao deve precisar montar cabecalhos manualmente.

### Abas Recomendadas

- `produtos`: aba principal para preenchimento.
- `instrucoes`: explicacao curta das colunas, exemplos e regras.
- `listas`: opcoes validas para status, garantia, cor, RAM, storage, versao, categorias e modelos quando possivel.
- `debug_modelo`: dados tecnicos da categoria/modelo usado para gerar a planilha.

### Colunas Base

```text
acao
sku
nome
modelo_id
modelo_nome
categoria_id
categoria_nome
marca
ean
status
estoque
controlar_estoque
preco_custo
preco_varejo
preco_revenda
preco_atacado
preco_promocional
promocao_inicio
promocao_fim
ncm
cest
origem
peso_kg
largura_cm
altura_cm
profundidade_cm
garantia_tipo
garantia_template_id
bling_id
bling_parent_id
shopee_item_id
descricao
meta_titulo
meta_descricao
palavras_chave
video_url
```

### Colunas por Categoria

As colunas de especificacao devem usar prefixo `specs.`.

Para receptores:

```text
specs.serial
```

Para smartphones:

```text
specs.imei1
specs.imei2
specs.serial
specs.color
specs.ram
specs.storage
specs.version
specs.battery_health
```

Para tablets, usar a configuracao real da categoria. Em geral:

```text
specs.imei1
specs.imei2
specs.serial
specs.color
specs.ram
specs.storage
specs.version
```

Campos que pertencem ao template do modelo nao devem reaparecer como obrigatorios no cadastro do produto. Exemplo: em receptores, `IKS` e `SKS` ficam no template do modelo, nao no upload do produto, salvo decisao futura explicita.

## Acao da Linha

A coluna `acao` pode aceitar:

- `criar`: cria produto novo; se SKU existir, vira erro ou conflito.
- `atualizar`: atualiza produto existente; se SKU nao existir, vira erro.
- `upsert`: cria se nao existir e atualiza se existir.
- vazio: sistema decide pelo SKU e pelas opcoes do preview.

Padrao recomendado: `upsert`, com confirmacao explicita no preview quando houver SKU existente.

## Regras de Validacao

### Obrigatorias

- `sku` obrigatorio.
- `nome` obrigatorio para produto novo.
- `modelo_id` ou modelo resolvivel obrigatorio para produto novo.
- `categoria_id` ou categoria resolvivel obrigatoria para produto novo.
- Precos obrigatorios:
  - `preco_custo`
  - `preco_varejo`
  - `preco_revenda`
  - `preco_atacado`
- `status` deve ser valido.
- Para categorias serializadas, os campos definidos como obrigatorios na categoria devem existir.

### Receptores

- `specs.serial` obrigatorio.
- `specs.serial` nao pode repetir no lote.
- `specs.serial` nao pode existir em outro produto ou unidade no sistema.
- `IKS` e `SKS` nao devem ser exigidos no produto quando ja pertencem ao template do modelo.

### Smartphones

- Validar conforme config real da categoria.
- Campos esperados:
  - `specs.imei1`
  - `specs.imei2`
  - `specs.serial`
  - `specs.color`
  - `specs.ram`
  - `specs.storage`
  - `specs.version`
- IMEI informado deve ter 15 digitos.
- IMEI nao pode repetir no lote.
- IMEI nao pode existir em outro produto ou unidade no sistema.
- Serial nao pode repetir no lote ou sistema.

### SKU

- SKU e a chave principal da importacao.
- SKU duplicado dentro da planilha e erro.
- SKU existente no sistema vira conflito resolvivel.
- No preview, usuario escolhe se atualiza existentes ou ignora existentes.
- Para categorias serializadas, pode haver regras especiais, mas a importacao deve deixar claro se esta criando unidade/produto separado ou atualizando um SKU existente.

### EAN

- EAN deve ser normalizado como texto.
- EAN-13 deve ter 13 digitos quando informado.
- EAN duplicado no lote deve gerar aviso ou erro conforme regra de categoria.
- EAN duplicado no sistema deve aparecer no preview.

### Bling

- `bling_id` deve ser preservado quando a planilha nao informar valor.
- `bling_id` informado deve ser salvo no produto local.
- `bling_id` duplicado em outro SKU deve bloquear.
- `bling_parent_id` pode repetir em variacoes do mesmo pai.
- Se SKU existente tem `bling_id` e a planilha traz outro `bling_id`, mostrar conflito forte antes de atualizar.
- A importacao deve atualizar/preservar o vinculo Bling local, mas reconciliacao com Bling deve ser opcional e visivel.

## Atualizacao de Existentes

Quando encontrar SKU existente:

- nunca atualizar fotos;
- nunca apagar fotos;
- preservar `id`, historico, timestamps de criacao e vinculos nao enviados;
- atualizar campos conforme opcao escolhida;
- registrar cada atualizacao no relatorio.

Opcoes recomendadas:

- `Atualizar somente colunas preenchidas`: mais seguro, padrao inicial.
- `Substituir todos os dados exceto fotos`: modo avancado.
- `Ignorar existentes`: cria somente novos.

Campos que podem ser atualizados:

- nome;
- modelo;
- categoria;
- marca;
- EANs;
- specs;
- precos;
- estoque;
- status;
- fiscal;
- garantia;
- descricao;
- SEO;
- vinculos Bling/Shopee;
- video;
- kits;
- dimensoes e peso.

Campos que nao devem ser atualizados pelo Excel:

- imagens;
- historico de preco diretamente;
- vendas;
- unidades vendidas;
- recibos;
- documentos de garantia ja emitidos.

## Barra de Progresso Online

A importacao deve mostrar progresso em tempo real, com etapas claras:

```text
Lendo planilha
Normalizando colunas
Validando dados obrigatorios
Buscando conflitos no sistema
Preparando preview
Aguardando confirmacao
Preparando criacao/atualizacao
Enviando lote 1/5
Sincronizando vinculos Bling
Gerando relatorio
Finalizado
```

Contadores esperados:

```text
Total
Validos
Invalidos
Novos
Existentes
Criados
Atualizados
Ignorados
Erros
Lote atual
SKU em processamento
```

Recomendacao inicial: processar em chunks de 25 ou 50 produtos.

## Debug e Logs

Cada importacao deve gerar um `import_job_id`.

Formato sugerido:

```text
bulk_YYYYMMDD_HHMMSS_random
```

Cada linha processada deve registrar:

```text
import_job_id
linha
sku
acao_planejada
acao_executada
status
mensagem_usuario
erro_codigo
erro_debug
payload_resumido
resposta_vps
created_product_id
updated_product_id
bling_id
timestamp_inicio
timestamp_fim
```

Na interface, mostrar mensagem simples:

```text
Linha 12 - SKU ABC123
Erro: IMEI 1 ja cadastrado no produto Redmi Note 13
```

No painel debug, mostrar dados tecnicos:

```text
duplicate_serialized_identifier
field: imei1
value: 123456789012345
conflict.sku: RN13-128-PRE
```

O usuario deve poder:

- copiar erro tecnico;
- baixar relatorio;
- filtrar por erro;
- filtrar por SKU;
- ver linhas atualizadas, criadas e ignoradas.

## Relatorio Final

Gerar Excel ou CSV com:

```text
linha
sku
acao
resultado
mensagem
id_produto
bling_id
erro_codigo
erro_debug
```

O relatorio deve ser baixavel ao final e tambem ficar associado ao `import_job_id` enquanto houver historico local/servidor.

## Arquitetura Recomendada

### Frontend

Arquivos sugeridos:

```text
components/products/bulk/BulkTemplateSelector.tsx
components/products/bulk/BulkConflictOptions.tsx
components/products/bulk/BulkProgressPanel.tsx
components/products/bulk/BulkDebugPanel.tsx
services/bulkProductTemplate.ts
services/bulkProductParser.ts
services/bulkProductValidator.ts
services/bulkProductImporter.ts
```

### Backend VPS

Endpoints sugeridos:

```text
POST /products/bulk-import/preview
POST /products/bulk-import/jobs
GET /products/bulk-import/jobs/:id
GET /products/bulk-import/jobs/:id/events
POST /products/bulk-import/jobs/:id/commit
GET /products/bulk-import/jobs/:id/report
```

Para a primeira versao, polling a cada 1 segundo e suficiente. Server-Sent Events pode vir depois se necessario.

### Upsert Protegido

O endpoint atual `/products/batch` pode atualizar imagens. Para esta importacao, criar protecao explicita:

```text
preserve_images: true
update_existing: true
update_mode: filled_only | replace_except_images
```

Regra critica: importacao por Excel nunca substitui fotos.

## Checklist de Implementacao

- [ ] Criar gerador de template por categoria/modelo.
- [ ] Incluir aba `produtos`.
- [ ] Incluir aba `instrucoes`.
- [ ] Incluir aba `listas`.
- [ ] Incluir exemplos reais por categoria.
- [ ] Normalizar cabecalhos do Excel.
- [ ] Normalizar valores monetarios para centavos.
- [ ] Normalizar EAN, SKU, IMEI e serial como texto.
- [ ] Validar campos obrigatorios por categoria.
- [ ] Validar duplicados no lote.
- [ ] Validar duplicados no sistema.
- [ ] Detectar SKU existente.
- [ ] Mostrar preview antes de gravar.
- [ ] Criar opcoes para atualizar ou ignorar existentes.
- [ ] Garantir preservacao de imagens.
- [ ] Criar barra de progresso online.
- [ ] Criar debug por linha.
- [ ] Criar relatorio final baixavel.
- [ ] Integrar vinculo Bling.
- [ ] Bloquear conflito de `bling_id`.
- [ ] Adicionar testes estaticos e unitarios.
- [ ] Rodar build.
- [ ] Publicar conforme `publicar.md`.

## Checklist de Producao

Antes de liberar em producao:

- [ ] Confirmar que nenhum arquivo novo importa `services/supabase`.
- [ ] Confirmar que nenhum arquivo novo usa `@supabase/supabase-js`.
- [ ] Confirmar que nenhum arquivo novo depende de `SUPABASE_*` ou `VITE_SUPABASE_*`.
- [ ] Confirmar que todas as leituras/escritas usam VPS/MySQL.
- [ ] Confirmar que upload de Excel nao altera fotos.
- [ ] Confirmar que SKU existente exige decisao visivel do usuario.
- [ ] Confirmar que `bling_id` duplicado bloqueia importacao.
- [ ] Confirmar que IMEI/serial duplicado bloqueia importacao.
- [ ] Confirmar que importacao parcial gera relatorio.
- [ ] Confirmar que erro tecnico pode ser copiado.
- [ ] Confirmar que progresso aparece durante todo o processamento.
- [ ] Confirmar que lotes grandes nao travam a interface.
- [ ] Confirmar que build passa.
- [ ] Confirmar que dominio publicado renderiza sem erro fatal no console.
- [ ] Confirmar que API foi publicada/reiniciada se endpoints novos forem criados.

## Testes Sugeridos

```text
tmp-tests/bulk-product-template.test.mjs
tmp-tests/bulk-product-validation.test.mjs
tmp-tests/bulk-product-upsert-plan.test.mjs
tmp-tests/bulk-product-no-supabase-static.test.mjs
tmp-tests/vps-bulk-product-import-static.test.mjs
```

Cenarios minimos:

- receptor gera template com `specs.serial` e sem `specs.iks`/`specs.sks`;
- smartphone gera template com IMEI, serial, cor, RAM e storage;
- SKU duplicado no lote gera erro;
- SKU existente gera conflito resolvivel;
- atualizar existente preserva fotos;
- `bling_id` duplicado bloqueia;
- IMEI duplicado no sistema bloqueia;
- erro por linha aparece no relatorio;
- importacao em chunks atualiza progresso.

## Decisao Inicial Recomendada

Implementar primeiro a versao por categoria/modelo com:

- planilha exemplo gerada pelo sistema;
- SKU como chave principal;
- preview obrigatorio;
- modo padrao `Atualizar somente colunas preenchidas`;
- preservacao obrigatoria de fotos;
- progresso por polling;
- debug e relatorio final.

Depois evoluir para:

- historico persistente de jobs;
- Server-Sent Events;
- reconciliacao Bling ao final;
- importacao de unidades separada quando necessario;
- templates salvos por categoria.
