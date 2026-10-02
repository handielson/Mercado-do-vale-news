# v1.2.539-ml-familias

Data: 2026-10-02. Status: pronta para publicação. Branch: main.
Tag: v1.2.539-ml-familias.
Release: /var/www/mdv-site/releases/20261002-175110-ml-familias.

Preparação agrupada por família; selecionar o pai inclui os filhos disponíveis e ainda não anunciados. Validação e envio conjunto para contas User Products.

Cinco famílias/produtos por seleção; pesquisa em lotes de cinco variantes. Cada filho preserva SKU, fotos, saldo e preço. Salvar rascunho preserva todos os membros. Falha de envio interrompe o lote e registra os vínculos já concluídos. Sem alteração de estoque ou anúncio real nesta entrega.

Validações: 26 testes de publicação/preparação; UI simulada com seleção do pai, três envios, exclusão de já anunciado e estoque zero, bloqueio de repetição; suíte Mercado Livre; build com trava Supabase. Deploy somente do frontend, sem reinício da API.

Fonte: https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos/user-products

Arquivos: services/mercadoLivrePreparation.ts, pages/admin/settings/MercadoLivrePreparationPage.tsx, tmp-tests/mercado-livre-publication.test.cjs, tmp-tests/mercado-livre-publication-ui.test.mjs e os três registros de versão.
