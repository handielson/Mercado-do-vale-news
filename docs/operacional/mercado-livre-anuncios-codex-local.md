# Anúncios Mercado Livre com Codex local

Implementação no checkout principal. Ainda depende da publicação da API e frontend conforme a skill publish-vps e publicar.md. Nenhum anúncio real foi criado nos testes.

## Usar

1. No computador, entrar no Codex CLI com a conta ChatGPT (`codex login`). A pesquisa verifica o tipo de login e rejeita autenticação por API key. Não utiliza OPENAI_API_KEY nem CODEX_API_KEY; utiliza os limites da conta Codex.
2. Após publicar as novas rotas na VPS, iniciar o frontend local com `npm run dev` e abrir `/admin/settings/mercado-livre/preparacao` como administrador. O Codex só é executado pelo servidor Vite local, em localhost/127.0.0.1. A versão pública não inicia processos no computador.
3. Carregar produtos. A consulta percorre todos os anúncios da conta, inclusive pausados e encerrados, e lê os vínculos persistidos. Falha parcial, mudança de total, IDs repetidos ou troca de conta bloqueiam a consulta.
4. Selecionar até cinco produtos e pesquisar. O Codex procura três a cinco anúncios do modelo exato, registra fontes e diferenças e propõe título/nome de família, descrição original, categoria, condição e atributos. Quando não consegue comparar três anúncios, precisa informar essa limitação. Não copia fotos/descrições, não propõe GTIN, preço, estoque, frete ou garantia. Pesquisa pode levar até quinze minutos.
5. Aceitar ou rejeitar diferenças, consultar exigências oficiais da categoria e conferir campos/fontes. Definir tipo de anúncio, modo de envio, frete e garantia; configurar a política de preço abaixo e calcular. Conferir demonstrativo, preço, condições comerciais e autoria/autorização de fotos.
6. Validar no Mercado Livre. O servidor consulta novamente conta, categoria, atributos, vínculos, anúncios e estoque; monta o contrato apropriado e chama `/items/validate`.
7. Publicar a prévia revisada. O servidor revalida antes de criar, salva o ID/vínculo e conclui a descrição. Um bloqueio por conta impede publicações concorrentes.

Rascunhos são salvos no navegador; podem ser exportados em arquivo e restaurados. Restaurar um arquivo remove as confirmações, exigindo nova conferência. Limpar os dados do navegador elimina o salvamento local.

### Aproveitamento do cadastro

A consulta da preparação inclui cor estruturada, modelo, condição explicitamente cadastrada, peso, medidas e prazo de garantia resolvido pela escolha do produto (marca ou categoria). Garantia personalizada permanece pendente: a tabela atual contém texto do termo, sem prazo estruturado. Ao selecionar o produto, preenche marca/modelo/cor nos atributos e o prazo da garantia nas condições comerciais, com fonte do cadastro e revisão pendente. Zero dias é preservado; prazo ausente não vira 90 dias. Peso e medidas são exibidos como dados cadastrados, sem presumir que incluem embalagem. Não exporta specs completos, IMEI, custo ou dados fiscais para a pesquisa.

A pesquisa prioriza o cadastro e procura lacunas/divergências. Atributos em formato inválido são descartados com aviso, preservando título e descrição válidos. IDs e requisitos devem vir da categoria oficial. Clássico/Premium continuam selecionáveis por anúncio. Dados de aquisição não alteram o preço de varejo; nenhuma seleção ou pesquisa publica automaticamente.

## Política de preço

A margem é o lucro estimado dividido pelo preço de venda, depois de deduzir custo de compra e despesas. A margem inicial fica vazia, para definição pelo operador. Campos configuráveis: imposto, publicidade e outras despesas em percentual da venda; embalagem, frete da loja e outras despesas fixas por unidade. Os demais campos começam em zero, que deve ser conferido como declaração de ausência da despesa. Não presumir alíquotas fiscais ou custos.

Definir categoria, tipo de anúncio e modo de envio antes do cálculo. Informar modalidade logística real da conta e peso faturável, considerando o peso volumétrico aplicável. Para produtos com logística diferente, calcular individualmente. `Aplicar política aos selecionados` usa os mesmos parâmetros nos até cinco produtos selecionados e só altera o lote se todas as cotações concluírem. Configuração salva por conta neste navegador; cada rascunho recebe uma cópia da política aplicada. Alterar os campos globais não modifica os rascunhos até recalcular. Não altera o preço de varejo do cadastro nem anúncios já publicados.

O endpoint protegido `POST /mercado-livre/preparation/pricing` lê `price_cost` em centavos diretamente no banco. Custo ausente/zero, valores inválidos, cotação incompleta ou soma de margem e despesas percentuais de 100% bloqueiam o cálculo. O custo não é enviado ao Codex. Percentuais são inteiros em pontos-base e dinheiro é inteiro em centavos; deduções e preço são arredondados para cima.

As tarifas são consultadas em `/sites/MLB/listing_prices` com categoria, BRL, tipo de anúncio, preço, modo de envio, modalidade logística e peso faturável. O algoritmo aumenta o preço e consulta novamente até alcançar a meta, inclusive após mudanças de faixa; não promete o menor preço possível. A tarifa fixa já incluída em `sale_fee_amount` não é adicionada outra vez. `listing_fee_amount` separado é provisionado conservadoramente por unidade. Ver [documentação oficial de custos por vender](https://developers.mercadolivre.com.br/pt_br/descricao-de-produtos/comissao-por-vender).

Frete da loja é uma estimativa configurada manualmente nesta versão, inclusive quando o comprador paga parte do transporte; zero exige conferência. Full, armazenagem, devoluções, descontos, promoções e outros custos que incidirem devem ser provisionados nos campos de despesas. A margem é estimada com base nos valores configurados; não garante o resultado de uma venda futura.

A prévia e o envio consultam novamente tarifas e custo para o preço confirmado. Se não atingir a meta, o servidor bloqueia e exige recalcular; não altera o preço silenciosamente. Antes do POST irreversível também confere se o custo mudou. O recibo guarda o demonstrativo usado no envio. Nenhuma cotação ou publicação real foi feita nos testes.

## Retomada e persistência

Recibos de publicação ficam em `MERCADO_LIVRE_PUBLICATION_DIR`, quando configurado, ou em `.mdv/mercado-livre-publications` no home do usuário da API. O caminho permanece fora dos releases. Todas as instâncias da API devem compartilhar esse diretório e o mesmo banco; preservar os recibos em backups e não apagá-los para liberar uma tentativa.

Antes do POST de criação, um recibo `sending` é gravado atomicamente. Se a resposta se perder, a automação bloqueia outro POST: o operador deve conferir e reconciliar o anúncio real. A retomada de um recibo com MLB conhecido conclui vínculo/descrição sem criar outro anúncio. `Retomar envio interrompido` rejeita solicitações sem recibo anterior.

O pacote da API inclui `services/mercadoLivreServer.cjs` e `services/mercadoLivrePublication.cjs`. Não executar o deploy apenas do primeiro arquivo. A implementação foi publicada na v1.2.533. A consulta do catálogo e inventário remoto agora usa `POST /preparation/snapshot-jobs` e acompanhamento autenticado por ID, para evitar timeout do proxy; reutiliza a consulta da conta enquanto estiver em andamento. Jobs ficam em memória e uma reinicialização exige iniciar nova consulta. Publicação real do anúncio ainda depende da revisão comercial.

Para custo médio com despesas de aquisição, consultar [o procedimento de importação por SKU](bling-custo-aquisicao.md). Cadastro de fornecedor não comprova custo médio.

## Limites atuais

- Produtos simples e variantes individuais. Não monta anúncios legados com várias variações nem publica pais/kits com estoque composto.
- Pesquisa depende do Codex instalado, login e disponibilidade dos sites; não há promessa de ranqueamento.
- Atributos condicionais são tratados conservadoramente como pendências. O validador oficial decide a elegibilidade final de categoria, tipo de anúncio, termos e envio.
- Publicar envolve primeiro criar o item e depois salvar descrição; uma falha pode deixar anúncio criado com descrição pendente. O recibo mantém a recuperação.
- Os testes de rede e interface usam conta e produtos simulados. O subprocesso de pesquisa real e a publicação real ainda precisam de validação após disponibilizar as rotas. O login ChatGPT local foi confirmado sem expor credenciais.
- Importações e conteúdo de anúncios são dados não confiáveis; resultados da IA nunca aprovam seus próprios campos.

## Verificar

```powershell
node --test tmp-tests/mercado-livre-publication.test.cjs
node tmp-tests/mercado-livre-publication-ui.test.mjs
npm run test:mercado-livre
node --test tmp-tests/mercado-livre-product-links.test.cjs
npm run test:money
npm run build
```

Fontes: [Codex não interativo](https://learn.chatgpt.com/docs/non-interactive-mode), [User Products](https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos/user-products), [Validador](https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/validador-de-publicacoes), [Publicação de produtos](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao/publicacao-de-produtos).
