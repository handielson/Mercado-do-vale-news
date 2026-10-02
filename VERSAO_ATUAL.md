# v1.2.541-ml-cadastro

Data: 2026-10-02. Status: pronta para publicação. Branch: main.
Tag: v1.2.541-ml-cadastro.
Release: /var/www/mdv-site/releases/20261002-190012-ml-cadastro.

A categoria local guarda a ficha oficial Mercado Livre. O cadastro do produto permite preencher e salvar seus atributos, compartilhar os dados comuns com a família e guardá-los no modelo para novos produtos iguais. Cor, SKU, GTIN e dados específicos não são copiados como padrão.

A API grava somente o namespace mercado_livre nos JSONs existentes, com transação e validação da ficha oficial. Novos rascunhos recebem os valores do produto, pai e modelo da categoria correspondente. Informações não comprovadas continuam pendentes; anúncios existentes não são alterados por este salvamento.

Validações: 31 testes de publicação/preparação/cadastro; UI simulada de preenchimento, persistência e reutilização; suíte Mercado Livre; sintaxe de servidores e módulos; build com trava Supabase.

Publicação seletiva da API e frontend pelo fluxo oficial. Arquivos e detalhes: docs/versoes/2026-10-02-v1.2.541-ml-cadastro.md.
