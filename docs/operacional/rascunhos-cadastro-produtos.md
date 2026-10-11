# Rascunhos do cadastro de produtos

O botão **Salvar rascunho** guarda o formulário incompleto. A lista fica em `/admin/products/drafts`, com pesquisa e **Continuar cadastro**. O salvamento é manual: novas alterações precisam ser salvas novamente. O rascunho não cria produtos, unidades, estoque ou ofertas para venda.

O estado inclui dados do formulário, etapa aberta, variações incluídas e em preenchimento, lote de aparelhos, parâmetros e arquivos de produção 3D. A conclusão usa a validação e o fluxo normal de cadastro; os IDs confirmados são preservados quando uma etapa falha.

## Persistência e publicação

- API administrativa: `/admin/product-form-drafts`, autenticada com o bearer de administrador. Os rascunhos ficam compartilhados no sistema, disponíveis em outros computadores.
- JSON: tabela existente `admin_preferences`, chave `product.form-draft.v1.<UUID>`. Não exige migração de banco.
- Arquivos selecionados: `<cwd da API>/private/product-form-drafts/<UUID>/<UUID>`, fora da pasta pública, enviados em streaming e recuperados somente com autenticação. Incluir essa pasta junto do banco nos backups e preservá-la em deploys. No cadastro definitivo, os arquivos 3D continuam pelo fluxo privado existente do Synology.
- Cada atualização exige a revisão atual. Uma aba com revisão antiga recebe conflito e não sobrescreve o trabalho mais recente; o operador deve reabrir pela lista.
- Concluir ou arquivar retira o rascunho dos pendentes e preserva seu conteúdo. Não há exclusão física automática nem expiração de arquivos.
- A publicação desta funcionalidade precisa incluir frontend e API (`services/productFormDraftsServer.cjs` já consta do manifesto de deploy da API). As configurações Nginx geradas incluem a nova rota. Publicação seletiva da API: `node deploy-vps-server-only.cjs --product-drafts-check` e `--product-drafts-only`, sem alterar flags ou executar migrations. O backup integral existente da API inclui `private/product-form-drafts`; o dump MySQL inclui `admin_preferences`. Versão de entrega: `v1.2.607-rascunhos-placas-precos`, conforme registro em `docs/versoes/`.

## Validação local

`node --test tmp-tests/product-form-drafts.test.cjs` verifica persistência de cadastros incompletos, família, autenticação, revisão concorrente, arquivos privados e recuperação de `File` com conteúdo e metadados. A prévia com API de demonstração confirmou salvar e reabrir uma família incompleta em outra aba, incluindo cor, NCM e etapa aberta. O build e os testes de regressão de família, criação, produção 3D e unidades serializadas passaram.
