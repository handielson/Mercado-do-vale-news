# v1.2.489-loja-3d-operacao

Data: 2026-09-27. Status: pronta para publicação. Branch: main.
Tag: v1.2.489-loja-3d-operacao
Release: /var/www/mdv-site/releases/20260927-223800-v12489-loja-3d-operacao

Base operacional da Loja 3D com contas de clientes independentes, catálogo e preços por site, carrinho, frete, checkout com entrada flexível a partir de 50%, pagamentos, pedidos, produção parcial, consumo de materiais, custos, cancelamento e expedição. O cadastro de produtos passou a escolher a categoria de cada site antes da publicação e mantém estoque físico compartilhado com separação comercial entre Mercado do Vale e Loja 3D.

O backend inclui reservas transacionais, prioridade por local de estoque, reconciliação externa, histórico de produção e snapshot das variantes vendidas. As rotas administrativas da Loja 3D permanecem separadas das rotas de clientes e pedidos do Mercado do Vale.

Validação: builds do site principal e da aplicação 3D; testes de catálogo, categorias, preços, estoque, custos, pagamentos e produção; jornada completa em MySQL descartável com checkout concorrente, rollback, contas, expedição, auditoria de SKU e isolamento comercial.

Publicação segura: as funções operacionais sensíveis da Loja 3D continuam desabilitadas em produção. As migrações operacionais 028–030, 033–038 e 040–051 não são aplicadas por esta publicação. O código e a interface ficam disponíveis para conferência sem liberar pagamentos, produção ou contas reais.
