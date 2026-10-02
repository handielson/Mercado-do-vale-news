# v1.2.540-ml-atributos

Data: 2026-10-02. Status: pronta para publicação. Branch: main.
Tag: v1.2.540-ml-atributos.
Release: /var/www/mdv-site/releases/20261002-184215-ml-atributos.

A seleção da categoria carrega todos os atributos oficiais automaticamente. A tela distingue obrigatórios, condicionais, opcionais e campos gerenciados pelo Mercado Livre; conserva os dados existentes e protege contra respostas atrasadas de outra categoria.

Opções oficiais, booleanos, unidades, limite de texto e “Não se aplica” explícito. GTIN, SKU, condição e medidas usam os campos canônicos do rascunho/cadastro. Pesquisa local recebe os atributos editáveis da categoria, inclusive opcionais, e mantém lacunas sem comprovação como pendências. API serializa IDs oficiais e rejeita valores inválidos ou campos internos.

Validações: 28 testes de publicação/preparação; UI simulada com carregamento automático, troca de categoria durante consulta, edição de campos opcionais e envio da família; suíte Mercado Livre; sintaxe dos servidores e módulos; build com trava Supabase.

Publicação do frontend e API pelo fluxo oficial. Esta entrega não altera os atributos dos anúncios já publicados; os materiais físicos ainda dependem de confirmação do operador.

Fonte: https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/atributos

Arquivos: pages/admin/settings/MercadoLivrePreparationPage.tsx, scripts/mercado-livre-local-codex.cjs, services/mercadoLivrePublication.cjs, tmp-tests/mercado-livre-publication-ui.test.mjs, tmp-tests/mercado-livre-publication.test.cjs e registros de versão.
