# Dominios e dados

Este e um indice de fontes atuais, nao uma especificacao de schema. Confirmar nomes, tipos, chaves e indices no banco MySQL conectado e nas migrations aplicadas antes de desenhar alteracoes.

- Produtos e estoque comercial: tabelas/campos MySQL consultados pelos services de produto e inventario. `regras.md` exige protecao regressiva para mudancas nesta area.
- Movimentacoes: identificar no schema e no caminho de venda/entrada/ajuste em execucao antes de atribuir saldo ou criar evento.
- Mercado Livre: vinculos locais em `mercado_livre_products`; API de leitura/escrita e normalizacao em `services/mercadoLivreServer.cjs`, `services/mercadoLivreListingPrice.cjs` e `services/mercadoLivreListingStock.cjs`.
- Modelo de estoque de anuncio tradicional, User Products, estoque multi-origem e estoque Full sao distintos. Nao usar `available_quantity` para uma conta/produto que exija estoque por localizacao; consultar o modelo e seguir a documentacao oficial.
- Credenciais OAuth e segredos ficam na configuracao do servidor. Nao duplicar tokens no ERP, logs, banco de staging ou navegador.
- O trabalho atual nao deve gravar estoque do Mercado do Vale. Qualquer fluxo de sincronizacao de estoque externo precisa de habilitacao administrativa separada e conciliacao posterior antes de uso operacional.

Uma migration nova requer plano, justificativa, revisao do schema conectado, teste em ambiente isolado, procedimento de rollback e pedido explicito; a fonte de verdade nao e uma captura ou documento antigo.
