# Regras de negocio

Fonte canonica das regras comerciais e de operacao: `regras.md`, complementada pelos runbooks especificos da integracao. Este arquivo indica onde confirmar a regra; nao cria politica concorrente.

- Regras de integracao com Bling: `bling.md` e `docs/operacional/bling-webhook-precos.md`.
- Regras de Shopee: `Shopee.md`, `SHOPEE_INTEGRATION.md` e seus testes de regressao.
- PDV, venda, desconto, garantia, estoque e exibicao de preco: `regras.md` e os services atualmente importados pela UI/API.
- Mercado Livre: contrato e capacidades devem ser conferidos em `services/mercadoLivreServer.cjs`, `services/mercadoLivreListingPrice.cjs`, `services/mercadoLivreListingStock.cjs` e na documentacao oficial atual.
- Representacao monetaria interna: valores de preco no app/VPS/MySQL usam centavos inteiros; conversoes para o contrato externo precisam ser explicitas e cobertas por regressao.
- Instrucao temporaria do projeto ERP: o ERP e a origem pretendida para preco e estoque enviados ao Mercado Livre; nao alterar o estoque no sistema Mercado do Vale nesta etapa.

Quando codigo, dados ou runtime divergirem de documentacao antiga, registrar a divergencia e confirmar com a fonte carregada antes de alterar consumidores.
