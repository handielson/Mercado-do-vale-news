# Integração local de cenários Pexels — 14/09/2026

## 1. Fluxo anterior

`MarketingPage.tsx` selecionava produtos/variantes, montava o `ProductMarketingCard` no DOM e exportava por `html-to-image`. O modo comercial desenhava um fundo geométrico; o técnico apresentava especificações. Status continuava sendo enviado ao armazenamento existente e vinculado aos campos `marketing_background_url` / `marketing_background_no_price_url`. O lote usava um único canvas sequencial. Não havia biblioteca de cenários fotográficos nem histórico próprio dessa seleção.

## 2. Fluxo integrado

O painel existente ganhou “Fundo contextual”: automático, pesquisa Pexels, biblioteca, fotografia enviada e neutro explícito. A API administrativa resolve o contexto usando o cadastro oficial, consulta/reutiliza fotos e entrega a imagem ao navegador. A composição mantém camadas separadas: fotografia, tratamento de contraste, fotografia original do produto, textos/logo/benefícios/preço/contato. O modo técnico, blueprint, figurinhas e os caminhos anteriores de armazenamento permanecem disponíveis.

Fotografias novas precisam de revisão humana. A avaliação automática usa metadados; não afirma reconhecer pessoas, marcas ou produtos na imagem. Não foi introduzido um serviço de IA para redesenhar o produto.

## 3. Arquivos desta alteração

- `services/marketingSceneCore.mjs`: contexto, pontuação, seleção determinística e preparação concorrente.
- `services/marketingScenesServer.cjs`: API Pexels, biblioteca, importação/upload, cache, seleções, histórico e execução de lotes.
- `services/marketingSceneService.ts`: cliente autenticado, cache de imagens, relatórios JSON/CSV.
- `services/marketingSceneBatch.mjs` e `.d.mts`: execução sequencial, isolamento de falhas, cancelamento e retomada.
- `services/marketingCampaignApi.cjs`: registro das novas rotas no módulo administrativo existente.
- `pages/admin/settings/marketing/MarketingScenePanel.tsx`: pesquisa/paginação/importação/revisão/créditos/seleção.
- `pages/admin/settings/MarketingPage.tsx`: integração com a prévia, exportação individual/lote e histórico.
- `pages/admin/settings/marketing/ProductMarketingCard.tsx`: fundo fotográfico separado e correção do ciclo de hooks ao alternar modelos.
- `pages/admin/settings/marketing/productCommercialCopy.ts`: chamada contextual da balança, com benefícios derivados do cadastro.
- `.env.vps.example`, `deploy-vps-server-only.cjs`: exemplo de configuração e inclusão dos módulos necessários em futura publicação. Nenhuma publicação executada.
- `migrations/20260914_marketing_scene_library.sql` e `.down.sql`: migração e reversão explícitas.
- `tmp-tests/marketing-scenes*`: testes, dados públicos de referência e evidências locais.

As alterações preexistentes em Android, catálogo, n8n, AGENTS e servidores VPS não foram incluídas como trabalho desta integração nem revertidas.

## 4. Banco e armazenamento

As tabelas de fotos de modelo/cor e aprovações comerciais existentes não representam uma biblioteca reutilizável de cenários com cache e atribuição. Foram propostas quatro tabelas específicas: `marketing_scene_backgrounds`, `marketing_scene_cache`, `marketing_scene_selections` e `marketing_scene_jobs`.

Metadados ficam em JSON; jobs possuem proprietário, chave de idempotência única e concessão temporária de execução. A hierarquia usa `categories.parent_id`: categoria pai e categoria filha, sem inventar tabela de subcategorias. Fotografias importadas ficam em `uploadsDir/marketing-scenes`, seguindo o diretório de uploads já fornecido pela API. O nome do arquivo deriva de hash; o cliente não escolhe caminhos no servidor.

A migração **não foi executada**, nem em produção nem em banco local. Não há criação automática de tabelas no startup. Antes de usar em homologação, aplicar o SQL explicitamente no banco de teste. O arquivo `.down.sql` remove somente as quatro tabelas; exportar o histórico antes de reverter. A reversão não apaga os arquivos de uploads.

## 5–6. Variáveis e chave

Criar uma chave na [área oficial da API Pexels](https://www.pexels.com/api/). Configurar `PEXELS_API_KEY` exclusivamente no ambiente do processo da API de homologação. Não usar prefixo `VITE_`, não salvar no navegador e não commitar o segredo. `BULK_IMAGE_CONCURRENCY=3` controla a preparação de contextos no backend (limite de 1 a 8). Somente o exemplo `.env.vps.example` foi alterado, com a chave vazia.

O endpoint usado é `GET https://api.pexels.com/v1/search`, com `Authorization`, `orientation=portrait`, `size=large`, `per_page=12` e idioma `en-US`; o painel permite `pt-BR`. A implementação segue a [documentação oficial](https://www.pexels.com/api/documentation/). A chave não foi configurada ou testada ao vivo nesta tarefa.

## 7. Geração individual

Selecionar um produto no painel atual. O automático procura um fundo aprovado compatível. Se não houver, pesquisar, revisar as miniaturas, importar/aprovar e clicar em Usar. Trocar cenário alterna entre candidatos; editar título ou preço mantém a escolha. A seleção manual é persistida por produto. Upload à biblioteca também é possível; o upload apenas nesta sessão mantém o comportamento local anterior. Neutro é uma escolha explícita.

A exportação contextual individual usa o mesmo histórico de jobs (um produto), valida imagem e texto, preserva as regras de centavos e usa o armazenamento atual de Status. Fotografias indisponíveis bloqueiam a exportação daquele item.

## 8. Geração em massa

Até 200 produtos por job. A preparação agrupa por contexto antes de buscar: uma consulta por contexto sem candidato elegível, com cache. Fotos novas sem revisão resultam em `review_required`; o lote não transforma fundo neutro em cenário fotográfico. A composição permanece serial porque o DOM/canvas existente é compartilhado.

Estados: pending, validating, resolving_context, selecting_background, generating_copy, composing, completed, completed_with_warning, review_required e failed. Falhas de produto/foto ficam no item. Preparação de imagem tem até três tentativas com espera crescente; composição/upload/download não são repetidos automaticamente. Cancelar encerra depois do produto atual. Retomar replaneja pendências por contexto e preserva slides já registrados. Jobs ficam no histórico por administrador, com relatórios JSON/CSV e créditos. A concessão de execução impede duas abas de processarem o mesmo job simultaneamente; expira em três minutos sem atualização.

## 9. Seleção

Contextos iniciais: cozinha/balança, patch panel, organizador de cabos, rede, carregamento, gaming, áudio, ferramentas, segurança, automotivo, celular, informática e contexto genérico final. Produto, descrição, especificações, categoria e subcategoria são evidências.

Seleção manual aprovada tem precedência. No automático: vínculo com produto, subcategoria, categoria e contexto. Pontuação considera afinidade, tags, orientação, resolução, aprovação e conflitos de metadados; máximo 100. Aprovadas com pontuação de 60–79 e mesmo contexto podem ser usadas com aviso; abaixo disso exigem revisão. Novas fotos nunca são aprovadas automaticamente. A escolha usa hash de produto + contexto em até dez candidatos; funciona com menos candidatos quando a biblioteca ainda é pequena. Não garante três candidatos quando não existem três fotos aprovadas.

## 10. Cache e limites

Pesquisa/idioma/página: 24 horas no banco. Consultas idênticas simultâneas são agrupadas no processo. Resolução de contexto: até mil entradas de memória. Seleção por produto: persistente. Imagens no navegador: até 24 promises, removidas em caso de erro. Importações: arquivo local reutilizado por ID/hash.

Registra cabeçalhos de cota e suspende novas buscas com cinco ou menos consultas restantes até o reset. Após 429, usa espera de pelo menos uma hora. Trata 401, 403, 404, 429, falhas de rede, timeout, resposta vazia/inválida e imagem inacessível. Biblioteca continua funcionando sem chave. Não há troca de chave para contornar limite.

## 11–12. Validações executadas

- `node --test tmp-tests/marketing-scenes.test.mjs`: 11 testes aprovados, incluindo API simulada, cache, cota, importação, contexto, agrupamento, falhas isoladas, retomada, autorização, propriedade de histórico, idempotência e concessão de execução.
- `node tmp-tests/product-commercial-copy.test.ts`: aprovado.
- `node tmp-tests/product-marketing-artwork-static.test.mjs`: aprovado.
- `node tmp-tests/marketing-scenes-render.test.mjs`: aprovado com Chrome headless local, componente real e exportação `html-to-image`. Assets exclusivamente locais durante a renderização; sem chamadas ao ambiente de produção.
- `npm run build`: aprovado, incluindo o prebuild de ausência de Supabase no runtime.
- `npx tsc --noEmit`: falha por diagnósticos existentes. Comparação por arquivo/código/mensagem, substituindo somente em memória os três arquivos existentes editados pela versão HEAD: 156 diagnósticos na referência, 155 na árvore atual, nenhum diagnóstico adicional. Evidência em `marketing-scenes-type-report.json`. Não foram corrigidos problemas fora do escopo.
- `node --check services/marketingScenesServer.cjs`: aprovado.

## 13. Limitações e validação ainda necessária

Não houve teste integrado contra MySQL real, Pexels autenticado, upload de arte no Synology ou exportação pelo painel autenticado de produção. Os testes de rota usam repositório/SQL simulados. A migração e a chave precisam ser preparadas em homologação antes desse teste integrado. O teste visual usa uma fotografia pública do Pexels escolhida manualmente; não comprova que a busca autenticada está configurada.

O compositor preserva a fotografia original, mas mantém o recorte convencional de fundo branco já existente. Objetos brancos podem apresentar bordas irregulares; acabamento profissional depende da qualidade/transparência da imagem cadastrada. Não existe segmentação visual por IA nesta implementação.

A retomada evita slides já registrados, mas um fechamento abrupto entre download e gravação do checkpoint pode gerar novamente o último slide. Não há garantia transacional entre download no navegador, armazenamento externo e MySQL. Contadores de uso são operacionais, não um livro de auditoria transacional. A execução depende da aba aberta; não é um worker de renderização em servidor. Histórico atual lista os 30 jobs mais recentes e biblioteca lista até mil registros.

## 14. Imagem da balança

`tmp-tests/marketing-scenes-fixture/balanca-contextual.png` é PNG 1080×1920 exportado pelo `ProductMarketingCard` real. Usa a foto original pública do SKU ON-BL700A e a cozinha de [Ron Lach / Pexels](https://www.pexels.com/photo/kitchen-accessories-and-ingredients-on-counter-8175345/). Inspeção manual do fundo: utensílios e ingredientes reconhecíveis, sem pessoas ou rótulos comerciais legíveis. A primeira opção de fundo foi rejeitada na inspeção por conter marcas/rótulos.

Preço de teste: cadastro público com 3590 centavos, exibido como R$ 35,90, sem desconto adicional. Texto: “PRATICIDADE EM CADA RECEITA”; “Facilite o preparo dos seus ingredientes”. Capacidade de 10 kg, leitura digital e função tara constam do cadastro. Dados e procedência estão em `product.json` e `sources.json` no diretório da fixture.

## 15. Relatório em massa

`tmp-tests/marketing-scenes-bulk-report.json`: 100 produtos sintéticos, oito contextos, 24 fotos simuladas. Primeira passagem: oito consultas simuladas e revisão necessária. Após aprovação simulada: 100 produtos reutilizando a biblioteca, zero novas consultas; concorrência de busca máxima três. Variação determinística conferida em repetição. Isso valida a lógica em massa, não equivale a 100 artes reais exportadas.

`tmp-tests/marketing-scenes-render-report.json`: evidência separada do teste visual real da balança, preservação do cenário ao alterar texto/preço e funcionamento do modelo técnico.

Nenhum commit, push, deploy, alteração de segredo ou escrita em produção foi realizado.
