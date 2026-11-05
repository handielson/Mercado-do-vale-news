# v1.2.790-etiqueta-pf-shopee-g

Data: 05/11/2026. Branch: `main`. Só agente de impressão (PC da loja); site/API seguem a v1.2.789-comprovante-qr-bot-seminovo.
Etiqueta da Shopee G (PF): só a 1a página vai para o recorte 10x15; o original fica salvo. Ajuste que existia só no PC da loja agora está no repositório.

---

# v1.2.789-comprovante-qr-bot-seminovo

Data: 04/11/2026. Status: **publicada** (site `/var/www/mdv-site/releases/20261104-225000-v1289-comprovante-qr`, API, n8n e PC da loja). Branch: `main`. Inclui a v1.2.788 (condição Seminovo/Usado).
Comprovante de separação com LOCAL (peças por local), ESTOQUE TOTAL (aviso de última peça) e QR do produto; robô do WhatsApp separa "Seminovos | Usados".

---

# v1.2.788-condicao-seminovo-usado

Data: 04/11/2026. Status: **pendente de publicação**. Branch: `main`.
Condição Novo / Seminovo / Usado / Caixa aberta com observação: cadastro, site (card próprio + selo + observação), admin e feed da Meta. WhatsApp (n8n) na etapa 2.

---

# v1.2.787-shopee-m-link

Data: 04/11/2026. Status: **publicada em 04/11/2026 20:51** (`/var/www/mdv-site/releases/20261104-205116-v1287-shopee-m-link`). Branch: `main`. Tag: `v1.2.787-shopee-m-link`.
Página do Produto: o badge Shopee M abre o anúncio (ID da loja principal vem dos dados da empresa).

---

# v1.2.786-financeiro-produto-custo-tiktok

Data: 04/11/2026. Status: **publicada em 04/11/2026 20:21** (`/var/www/mdv-site/releases/20261104-202145-v1286-financeiro`). Branch: `main`. Tag: `v1.2.786-financeiro-produto-custo-tiktok`. API publicada (backup `/var/www/mdv-api/backups/sales-marketplaces-1793834457138`). Pendente: escopo de Finanças no app do TikTok.
Página do Produto: custo e preço/lucro por canal no Resumo financeiro (custo pela fonte única), sem "Adicionar igual", aviso de grupo de preço e taxas reais do TikTok pelo extrato.

---

# v1.2.785-shopee-rotas-protegidas

Data: 04/11/2026. Status: **publicada em 04/11/2026 20:08** (`/var/www/mdv-site/releases/20261104-200803-v1285-shopee-auth`). Branch: `main`. Tag: `v1.2.785-shopee-rotas-protegidas`. API publicada (backup `/var/www/mdv-api/backups/sales-marketplaces-1793833709861`).
Segurança: `/api/shopee-catalog` e `/api/shopee-actions` passam a exigir login de admin ou `x-sync-key` (antes respondiam sem login, inclusive alteração de preço e estoque).

---

# v1.2.784-pagina-do-produto-canais-lucro

Data: 04/11/2026. Status: **publicada em 04/11/2026 19:56** (`/var/www/mdv-site/releases/20261104-195640-v1284-pagina-produto`). Branch: `main`. Tag: `v1.2.784-pagina-do-produto-canais-lucro`. API publicada (`--sales-marketplaces-only`, backup `/var/www/mdv-api/backups/sales-marketplaces-1793832936749`).
Página do Produto (antiga Página da família): canais de venda conectados, onde está no estoque, preço e lucro por canal com edição do valor de venda e tabela de taxas por canal. API: tabela `channel_fee_settings`, rotas `/channel-fee-settings` e preço no status do TikTok.

---

# v1.2.783-etiqueta-por-variacao

Data: 04/11/2026. Status: **publicada em 04/11/2026 11:36** (`/var/www/mdv-site/releases/20261104-113600-v1283-etiqueta`). Branch: `main`.
Etiqueta de preço em cada variação: card da família, Página da família e página do produto.

---

# v1.2.782-ml-billing-safe-log

Data: 04/11/2026. Status: publicada e validada. Branch: `main`. Tag: `v1.2.782-ml-billing-safe-log`.
Mercado Livre: falhas do GET de faturamento registram somente `scope`, status HTTP upstream e código/classe técnica allowlisted. O log não inclui ID do pedido, vendedor, mensagem livre nem payload externo.
Escopo somente leitura; preço, anúncios e estoque continuam desligados. Nenhuma captura de pedido foi realizada nesta versão.
API publicada a partir do commit `64b6b89b`; backup `/var/www/mdv-api/backups/mercado-livre-1793770726820`. Site publicado em `/var/www/mdv-site/releases/20261104-053810-ml-billing-safe-logs`. Validação pública: site e API HTTP 200, MySQL ativo, rota sem chave HTTP 401. A escrita de preço, estoque e anúncios continua desligada.

---

# v1.2.781-ml-billing-query-contract

Data: 04/11/2026. Status: publicada e validada. Branch: `main`. Tag: `v1.2.781-ml-billing-query-contract`.
Mercado Livre: remove parâmetro `seller_id` não documentado do GET de faturamento por pedido; validação de vendedor permanece antes da consulta no serviço.
Escopo somente leitura; sem vendas, lançamentos financeiros, anúncios, preço ou estoque.
API publicada em `/var/www/mdv-api/backups/mercado-livre-1793769633454` a partir do commit `e53aceef`. Site publicado em `/var/www/mdv-site/releases/20261104-052011-ml-billing-contract`. Validação pública: API e site HTTP 200; rota de faturamento sem autenticação HTTP 401.

---

# v1.2.780-ml-billing-safe-diagnostic

Data: 03/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.780-ml-billing-safe-diagnostic`.
Mercado Livre: os GETs de faturamento identificam classe de falha de transporte, JSON ou resposta inválida sem expor payloads externos; HTTP upstream e código allowlisted continuam visíveis.
ERP: nenhuma venda, lançamento financeiro ou movimentação de estoque é criada por essa consulta. Preço, publicação e estoque permanecem desligados.
API: `--mercado-livre-only`; backup `/var/www/mdv-api/backups/mercado-livre-1793753091062`.
Release do site: `/var/www/mdv-site/releases/20261104-004205-ml-billing-safe-diagnostic`.

---

# v1.2.779-ml-billing-batch

Data: 03/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.779-ml-billing-batch`.
Mercado Livre: GET de faturamento em lotes de até 60 pedidos; capturas ficam apenas no staging e não são consultadas novamente. Resposta parcial 206 não é salva.
ERP: sem criação de venda, lançamento financeiro ou movimento de estoque.
API: `--mercado-livre-only`; backup `/var/www/mdv-api/backups/mercado-livre-1793750769348`.
Release do site: `/var/www/mdv-site/releases/20261104-000924-ml-billing-batch`.
O site também inclui o desconto no PDV preparado em v1.2.770.

---

# v1.2.778-bot-celulares-baratos-acessorio

Data: 03/11/2026. Status: **pronta, publicação no n8n pendente**. Branch: `main`.
Bot WhatsApp: celulares baratos/promoções viram lista de celulares do mais barato; acessório na lista não trava em "memória e cor".

---

# v1.2.770-pdv-desconto-visivel

Data: 03/11/2026. Status: **pronta, não publicada**. Branch: `main`.
PDV: "Desconto da venda" sempre visível, em R$ ou %, para qualquer forma de pagamento.

---

# v1.2.769-ml-billing-error-diagnostic

Data: 03/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.769-ml-billing-error-diagnostic`.
Release VPS: `/var/www/mdv-site/releases/20261103-232452-ml-billing-error-diagnostic`. API: `--mercado-livre-only` (backup `/var/www/mdv-api/backups/mercado-livre-1793748394616`).
Mercado Livre: falhas no GET de faturamento mostram apenas status HTTP e código técnico allowlisted; dados do upstream não são expostos.

---

# v1.2.768-ml-billing-details-get

Data: 03/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.768-ml-billing-details-get`.
Release VPS: `/var/www/mdv-site/releases/20261103-230353-ml-billing-details-get`. API: `--mercado-livre-only` (backup `/var/www/mdv-api/backups/mercado-livre-1793747155255`).
Mercado Livre: GET autenticado de faturamento por pedido, valida vendedor OAuth e retorna apenas pagamentos, tarifas e cobranças allowlisted ao ERP. Nenhum dado é gravado no Mercado do Vale.

---

# v1.2.766-vendas-ordem-historico

Data: 03/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.766-vendas-ordem-historico`.
Release VPS: `/var/www/mdv-site/releases/20261103-113718-v1266-vendas-ordem`. API: `--sales-marketplaces-only`.
Vendas: ordem pelo instante real da venda; histórico de marketplace de 1 ano (até 3000 pedidos por canal).

---

# v1.2.765-vendas-marketplace-cache

Data: 03/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.765-vendas-marketplace-cache`.
Release VPS: `/var/www/mdv-site/releases/20261103-111731-v1265-vendas-cache`. API: `--sales-marketplaces-only` (cache MySQL de vendas de marketplace).
Vendas: pedidos de Shopee/TikTok/Mercado Livre abrem na hora (cache local + VPS) e só o que mudou é buscado.

---

# v1.2.764-modelos-tabela-salvar

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.764-modelos-tabela-salvar` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-221603-v1264-modelos-tabela`. API: sem alteração.
Modelos (parte 3): tabela sem caixa de rolagem própria; "Salvar" da linha só quando um preço muda.

---

# v1.2.763-modelos-celular-cartoes

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.763-modelos-celular-cartoes` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-215648-v1263-modelos-celular`. API: sem alteração.
Modelos (parte 2): cartões no celular, filtros num botão, "Salvar" só quando muda; "Mais usados" do menu mais leve.

---

# v1.2.762-modelos-precos-protegidos

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.762-modelos-precos-protegidos` (local; push da tag pendente).
Site: sem alteração (continua `v1.2.761`). API: `--unit-read-privacy-only`.
Segurança: proxy exige administrador em `/models/price-summary` e `/models/:id/smartphone-price-*` (respondiam sem login, com custos).

---

# v1.2.761-modelos-precos-em-lote

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.761-modelos-precos-em-lote` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-214224-v1261-modelos-lote`. API: `--photo-intake-only` (rota nova `/models/price-summary`).
Modelos (parte 1): preços da página numa consulta só (antes 46 por página).

---

# v1.2.760-menu-organizacao

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.760-menu-organizacao` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-203916-v1260-menu-organizacao`. API: sem alteração.
Menu lateral (parte 3): grupo "Sistema (técnico)", ícones distintos, nomes corrigidos.

---

# v1.2.759-menu-mais-usados

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.759-menu-mais-usados` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-203219-v1259-menu-mais-usados`. API: sem alteração.
Menu lateral (parte 2): "Mais usados" no topo, pelas visitas da própria pessoa.

---

# v1.2.758-menu-celular-espaco

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.758-menu-celular-espaco` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-201702-v1258-menu-celular`. API: sem alteração.
Menu lateral no celular (parte 1): menu inteiro rola, topo e rodapé compactos — 12 linhas visíveis (antes 1).

---

# v1.2.757-custo-variacoes

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.757-custo-variacoes` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-200918-v1257-custo-variacoes`. API: sem alteração.
"Variações cadastradas" mostra o custo em reais ("R$ 1.700,00" em vez de "170000.00"); custo zero aparece como "Sem custo".

---

# v1.2.756-contador-sem-rolagem

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.756-contador-sem-rolagem` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-195902-v1256-contador`. API: sem alteração. Site inclui as versões do Codex até a anterior.
Espaço do Contador sem barras de rolagem desnecessárias: caixas de texto que crescem, abas em 3 colunas e listas no celular, barra "Comparar" fora do contador/admin.

Validações: teste novo, testes do contador/fiscal (sem falha nova), tsc, build, Playwright com dados reais (só leitura).

---

# v1.2.755-mercado-livre-unlinked-parallel-stock-reads

Data: 02/11/2026. Status: em publicação. Branch: `main`. Tag: `v1.2.755-mercado-livre-unlinked-parallel-stock-reads`.
Release VPS: `/var/www/mdv-site/releases/20261102-182739-ml-stock-read-unlinked-parallel`. API: `--mercado-livre-stock-read-only`.

Para famílias válidas do catálogo local, consulta o perfil do vendedor em paralelo à leitura do anúncio, inclusive quando ainda não há vínculo salvo no Mercado do Vale. Em anúncios sem vínculo, o ERP continua validando SKU exato e único antes de devolver qualquer saldo. Não cria vínculo, movimento ou ajuste de estoque; gates de publicação, preço e estoque seguem desligados.

Validações: suíte Mercado Livre (119/119 aprovados e contrato estático aprovado); teste focado de leitura (17/17); build concluído com 3.893 módulos; deploy seletivo concluído; API HTTP 200 com MySQL saudável; site HTTP 200 e `VERSION.json` v1.2.755 conferido. Rechecagem real de cinco leituras concorrentes: 1/5 concluída em 45,57 s e quatro expiraram em 65 s; a latência continua inadequada. Gates de publicação, preço e estoque seguem desligados.

---

# v1.2.754-mercado-livre-parallel-stock-reads

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.754-mercado-livre-parallel-stock-reads`.
Release VPS: `/var/www/mdv-site/releases/20261102-181536-ml-stock-parallel-reads`. API: `--mercado-livre-stock-read-only`.

Para anúncios com vínculo local exato, o serviço consulta em paralelo o anúncio e o perfil do vendedor. Anúncios sem vínculo confirmado continuam esperando a validação por SKU antes de consultar o perfil. A janela de lote de 150 ms permanece para reunir itens iniciados com pequeno atraso. Todos os gates de escrita seguem desligados.

Validações: suíte Mercado Livre (118/118 aprovados e contrato estático aprovado); build de produção concluído; API pública HTTP 200 com MySQL saudável; site HTTP 200 e `VERSION.json` v1.2.754 conferido. Deploy seletivo manteve os gates de escrita desligados.

---

# v1.2.752-mercado-livre-stock-batch-read

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.752-mercado-livre-stock-batch-read`.
Release VPS: `/var/www/mdv-site/releases/20261102-162432-ml-stock-batch-read`. API: leitura de estoque do Mercado Livre publicada seletivamente.

Leituras simultâneas agrupam até 20 anúncios via `/items/bulk`; o perfil do vendedor é deduplicado somente durante a requisição em andamento. Todas as escritas de anúncio, preço e estoque seguem desligadas.

Validações: suíte Mercado Livre (117 aprovados), contratos estáticos, sintaxe, build e conferência pública.

---

# v1.2.751-erp-mercado-livre-readonly

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.751-erp-mercado-livre-readonly`.
Release VPS: `/var/www/mdv-site/releases/20261102-155832-mercado-livre-erp-readonly`. API: `--mercado-livre-only`.
Bridge Mercado Livre de leitura para o ERP; gates de preço, estoque e publicação desligados. Nenhuma escrita ou alteração no sistema Mercado do Vale.

Validações: suíte Mercado Livre (115 testes), checks de sintaxe, build e conferência pública pós-deploy.

---

# v1.2.750-cores-mapeadas-precos-familia

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.750-cores-mapeadas-precos-familia` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-153412-v1250-cores-precos`. API: `--photo-intake-only` e `--unit-read-privacy-only`.
Aba "Cores mapeadas" no cadastro por foto (trocar/apagar); card da família mostra a faixa de preço das variações (antes R$ 0,00); proxy exige administrador em /smartphone-*.

Validações: testes novos, testes da lista/card/foto/proxy (sem falha nova), tsc, build, Playwright (iPhone 13).

---

# v1.2.749-units-leitura-protegida

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.749-units-leitura-protegida` (local; push da tag pendente).
Site: sem alteração (continua `v1.2.748`). API: `--unit-read-privacy-only`.
Segurança: GET /units e /units/by-identifier exigem administrador ou chave interna; o /vps-proxy trata /units como sensível (antes respondiam sem login, com IMEI e custo).

Validações: teste novo, testes do proxy/units (sem diferença), node --check, curl anônimo antes/depois.

---

# v1.2.748-produtos-menos-consultas

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.748-produtos-menos-consultas` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-143551-v1248-produtos-consultas`. API: sem alteração.
Lista de produtos (parte 5): card consulta só o que está na tela — etiqueta ao abrir, canais/IMEIs ao expandir, vídeo/foto perto da tela. 180 → ~10 consultas na abertura (24 produtos).

Validações: teste novo, testes da lista/card (sem falha nova), tsc, build e Playwright (iPhone 13).

---

# v1.2.747-produtos-lista-compacta

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.747-produtos-lista-compacta` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-142951-v1247-produtos-lista`. API: sem alteração.
Lista de produtos (parte 4): visualização "Lista" compacta (foto pequena, preço, estoque), padrão no celular; família abre as variações; sem as consultas de cada card.

Validações: testes novos, testes da lista/card (sem falha nova), tsc, build e Playwright (iPhone 13).

---

# v1.2.746-produtos-menu-acoes

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.746-produtos-menu-acoes` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-142033-v1246-produtos-menu`. API: sem alteração.
Lista de produtos (parte 3): no celular as ações do card ficam num menu "⋯" com nome escrito; Excluir no fim, separado e com confirmação.

Validações: teste novo, testes da lista/card (sem falha nova), tsc, build e Playwright (iPhone 13 e 1366px).

---

# v1.2.745-produtos-topo-enxuto

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.745-produtos-topo-enxuto` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-141136-v1245-produtos-topo`. API: sem alteração.
Lista de produtos (parte 2): topo enxuto no celular — ícones em Selecionar/Atualizar, atalhos em "Mais ações", filtros em "Filtros (N)" com a busca sempre à mostra.

Validações: testes novos, testes da lista/filtros (sem falha nova), tsc, build e Playwright (iPhone 13).

---

# v1.2.744-produtos-card-preco-estoque

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.744-produtos-card-preco-estoque` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-135358-v1244-produtos-card`. API: sem alteração.
Lista de produtos (parte 1): card fechado mostra preço, estoque ou situação e "Sem preço"; paginação no celular só "‹ Página X de Y ›".

Validações: testes novos, testes da lista/card (falhas anteriores mantidas), tsc, build e Playwright (iPhone 13).

---

# v1.2.743-foto-mapeamento-cores

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.743-foto-mapeamento-cores` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-132547-v1243-foto-cores`. API: cadastro por foto publicado (`--photo-intake-only`). Site inclui a v1.2.742 (Codex, Mercado Livre).
Cores no cadastro por foto: a cor escolhida não some ao associar o modelo; mapeamento gravado pela cor como veio da etiqueta e aplicado na hora aos outros aparelhos da fila; cor sugerida pela palavra de cor.

Validações: testes novos e do cadastro por foto, tsc, build e Playwright (Pixel 7).

---

# v1.2.742-mercado-livre-estoque-leitura-sku

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.742-mercado-livre-estoque-leitura-sku`.
Release VPS: `/var/www/mdv-site/releases/20261102-125239-v1-2-742-mercado-livre-estoque-leitura-sku`. API: handler de leitura de estoque por SKU exato publicado seletivamente; escritas desligadas.

GET real pelo ERP preview 8818 leu `MLB7880776080` como `MNLDAACS`, saldo 3. Teste focal 13/13, suíte Mercado Livre 115/115, self-test do plano, contratos estáticos e build aprovados. Nenhuma movimentação foi criada e nenhuma escrita foi habilitada.

---# v1.2.741-imei-cadastrado-na-hora

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.741-imei-cadastrado-na-hora` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-113731-v1241-imei-na-hora`. API: sem alteração.
IMEI/serial já cadastrado aparece na hora (ao completar 15 dígitos, digitado ou lido pela câmera), com "Ver aparelho"; "Adicionar à Lista" recusa aparelho repetido; só um botão "Adicionar à Lista".

Validações: testes novos, 40 testes do formulário (0 falhas), tsc, build e Playwright (iPhone 13).

---

# v1.2.740-admin-sem-zoom-rodape

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.740-admin-sem-zoom-rodape` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-105519-v1240-admin-sem-zoom`. API: sem alteração.
Admin no celular: campos com 16px (fim do zoom do iPhone que deslocava a tela), rodapé do cadastro de produto empilhado com o botão principal em cima, características do modelo quebram texto longo. Computador inalterado.

Validações: teste estático novo, testes do formulário (falhas anteriores mantidas), build, Playwright iPhone 13 e desktop.

---

# v1.2.739-leitor-camera

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.739-leitor-camera` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-103459-v1239-leitor-camera`. API: sem alteração.
Botão 📷 ao lado de IMEI, serial e EAN (cadastro de produto, entrada de estoque e conferência do cadastro por foto): lê o código de barras ao vivo pela câmera (nativo no Android, zxing no iPhone), escolhe o valor certo para cada campo e no IMEI 1 oferece "Usar os dois". Plano B: tirar foto.

Validações: testes novos e existentes, tsc, build, Playwright com câmera simulada e iPhone 13.

---

# v1.2.738-vitrine-celular-logado

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.738-vitrine-celular-logado` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-101825-v1238-vitrine-celular`. API: sem alteração.
Vitrine no celular com login: a página ficava mais larga que a tela e dava para arrastar para o lado. Topo compacto (só o avatar; "Ver como" do admin vai para o menu da conta), "Resgatar Moedas" encolhe e Favoritos vira só o coração no celular.

Validações: teste estático novo, tsc, build e Playwright (iPhone 13) logado e sem login.

---

# v1.2.737-modelo-celular

Data: 01/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.737-modelo-celular` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-012750-v1237-modelo-celular`. API: sem alteração.
Tela Novo/Editar Modelo no celular: tela cheia (sem a margem de 24px herdada da página), abas rolando, Template em uma coluna, nome técnico dos campos só no computador, "Preencher" do Bling abaixo do campo, toques de 44px e campos com 16px. Computador inalterado.

Validações: teste estático novo, testes da tela de modelos (3 falhas anteriores mantidas), tsc, build, Playwright iPhone 13 e desktop.

---

# v1.2.736-foto-cadastrar-modelo

Data: 01/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.736-foto-cadastrar-modelo` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-011422-v1236-foto-cadastrar-modelo`. API: sem alteração.
Cadastro por foto: quando o modelo lido não existe, o botão "Cadastrar “Redmi Note 17” na Xiaomi" abre o nome já limpo (sem cor/memória), cria o modelo com a categoria do modelo irmão e o EAN da caixa (se válido) e já deixa escolhido.

Validações: testes (7), tsc, build e Playwright (Pixel 7).

---

# v1.2.735-foto-marca-modelo-sugeridos

Data: 01/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.735-foto-marca-modelo-sugeridos` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-010635-v1235-foto-sugestao`. API: sem alteração.
Cadastro por foto: marca e modelo já vêm preenchidos com o melhor palpite (REDMI → Xiaomi; "Redmi Note 17 Black" → Redmi Note 17), com aviso "Sugerido pelo que a foto leu — troque se não for". Modelo já vinculado nunca é trocado. Tags v1.2.732–v1.2.734 enviadas.

Validações: testes de palpite (5), tsc, build e conferência no Playwright (Pixel 7).

---

# v1.2.734-foto-barras-listas

Data: 01/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.734-foto-barras-listas` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-004941-v1234-foto-barras-listas`. API: cadastro por foto publicado (`--photo-intake-only`).
Cadastro por foto: o servidor lê os códigos de barras da etiqueta (IMEIs e EAN) em paralelo com a IA e confere; divergência vira aviso com o valor das barras e botão "Usar este" (não sobrescreve sozinho). O aviso de já cadastrado diz qual campo bateu, a data, a situação e o produto, com link "Ver aparelho". Marca, modelo, RAM e armazenamento agora são escolhidos de lista do cadastro.

Validações: testes novos de leitura/conferência de barras e listas; testes existentes do cadastro por foto; tsc; build; conferência visual no Playwright (Pixel 7).

---

# v1.2.733-admin-celular-cadastro-foto

Data: 01/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.733-admin-celular-cadastro-foto` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261102-002159-v1233-admin-celular`. API: sem alteração.
Admin no celular (partes 1 e 2): menu em gaveta com barra superior, atalhos inferiores (Produtos, Foto, Estoque, Etiquetas) e voltar do Android fechando o menu; grupos em sanfona e toques de 44px. Cadastro por foto: botão "Fotografar caixa" (câmera direto, resolução cheia), dica para enviar sem compressão, teclado numérico em IMEI/EAN e validação ao vivo (IMEI com Luhn, EAN com dígito verificador). O deploy do site passa a normalizar dono e permissões da release (evita 403 no nginx).

Validações: testes estáticos de navegação mobile, validadores iguais aos do servidor, testes do script de deploy, tsc, build e conferência visual no Playwright (Pixel 7 e desktop).

---

# v1.2.732-perfis-fiscais-produto

Data: 01/11/2026. Status: publicada. Branch: `main` (commit a241450d). Tag: `v1.2.732-perfis-fiscais-produto` (local; push da tag pendente).
Release VPS: `/var/www/mdv-site/releases/20261101-232648-v1232-perfis-fiscais`. API: perfis fiscais publicados (`--fiscal-tax-profiles-only`, backup `/var/www/mdv-api/backups/fiscal-tax-profiles-1793575559110`). Esta release também publica o manifesto do site das v1.2.729–v1.2.731.
Tributação por produto (pedido da contadora): perfis fiscais com abas NFC-e (65) e NF-e (55), tabelas oficiais NCM (Siscomex) e CEST (Convênio 142/2018) no sistema, vínculo e prontidão por produto, conferência de NCM/CEST no cadastro. Só cadastro: não emite nota nem altera o Bling. Inclui o manifesto pendente das v1.2.729–v1.2.731 e versiona o endurecimento de segurança aplicado na VPS em 01/11.

Validações: 34 testes novos aprovados; testes fiscais existentes 146/147 (falha anterior); build aprovado; `/status` 200 com MySQL OK; rotas novas 401 sem login; site e `/VERSION.json` 200.

---

# v1.2.731-erp-ml-price-read-seller-sku-attr

Data: 01/11/2026. Status: API publicada; manifesto do site pendente. Branch: `main`. Tag: `v1.2.731-erp-ml-price-read-seller-sku-attr`. Commit: `dbff06af`.
API Mercado Livre: a leitura de preço extrai `SELLER_SKU` do atributo oficial do anúncio, além dos campos diretos/variações, para cruzar a família do catálogo com o vínculo confirmado no ERP. Escrita continua exigindo vínculo no Mercado do Vale e gate/chave próprios; todos os gates permanecem desligados.

Validações locais aprovadas: 107 testes da suíte Mercado Livre e contrato estático, 60 testes da bridge ERP, sintaxe dos módulos, git diff --check e build de produção. API publicada; `/status` retornou MySQL OK e a leitura autenticada do anúncio MLB7880776080 retornou preço padrão/venda de 24900 centavos, sem promoção, automação ou variações.

---

# v1.2.730-erp-ml-price-read-sku-link

Data: 01/11/2026. Status: pendente de publicação. Branch de destino: `main`. Tag: `v1.2.730-erp-ml-price-read-sku-link`.
API Mercado Livre: leitura de preço pode usar o vínculo SKU/família confirmado no ERP quando o catálogo do Mercado do Vale não possui associação duplicada do anúncio. A consulta exige produto da família no catálogo e SKU remoto correspondente. Escritas ainda exigem vínculo Mercado do Vale e gate/chave próprios; todos os gates de escrita continuam desligados.

Validação local: suíte Mercado Livre, contrato estático, bridge do ERP, verificações de sintaxe e build de produção. A consulta autenticada em produção e os gates desligados serão conferidos após a publicação seletiva.

---

# v1.2.729-erp-ml-price-read-diagnostic

Data: 01/11/2026. Status: API publicada; manifesto do site pendente. Branch: `main`. Tag: `v1.2.729-erp-ml-price-read-diagnostic`.
API Mercado Livre: publicação da rota GET de preço com diagnóstico técnico sanitizado. Retorna somente etapa, status HTTP e código remoto em lista segura; não devolve corpo bruto, token ou dados comerciais. Gates de publicação, preço e estoque permanecem desligados.

Validações locais: 106 testes da integração Mercado Livre e contrato estático aprovados, além de 60 testes do bridge. O build de produção passou. Publicações e verificação autenticada do novo diagnóstico ainda pendentes.

---

# v1.2.728-erp-ml-price-capability

Data: 01/11/2026. Status: API publicada; manifesto do site pendente. Branch: `main`. Tag: `v1.2.728-erp-ml-price-capability`.
API Mercado Livre: capability de atualização de preço anunciada; gates de publicação, preço e estoque desligados. `/status` HTTP 200 com MySQL OK; configurações autenticadas confirmam a capability e os três gates em `false`.

A integração anuncia a atualização de preço padrão por solicitação somente de preço, com proteção contra preço automatizado, promoções, preço por quantidade e divergência de leitura posterior. A permissão continua exigindo flag e chave dedicada válidos. Nenhum preço, anúncio ou estoque foi alterado.

Validações: suíte Mercado Livre (104 testes), contrato estático, build de produção e validação da API publicada. Manifesto do site pendente.

---
# v1.2.727-erp-ml-publish-gate\n\nData: 31/10/2026. Status: publicada. Branch: `main`. Tag: `v1.2.727-erp-ml-publish-gate`.\nRelease VPS: `/var/www/mdv-site/releases/20261101-012920-erp-ml-publish-gate`. API Mercado Livre: publicada; publicação, preço e estoque permanecem desligados.\n\nA prévia de novos anúncios usa preço, custo e saldo do snapshot atual do ERP e valida o rascunho com o Mercado Livre sem criar anúncio. O deploy seletivo força `MDV_ERP_PUBLISH_ENABLED=0`, mesmo que exista uma chave de publicação configurada. Nenhum anúncio foi criado e nenhum estoque do Mercado do Vale foi alterado.\n\nValidações: 48 testes focados, suíte Mercado Livre completa, verificações de sintaxe, build de produção, API pública e versão pública.\n\n---\n\n# v1.2.726-ml-erp-capabilities-gates

Data: 31/10/2026. Status: publicada. Branch: `main`. Tag: `v1.2.726-ml-erp-capabilities-gates`.
Release VPS: `/var/www/mdv-site/releases/20261101-002743-ml-erp-stock-contract`. API Mercado Livre publicada; gates de escrita de preço e estoque permanecem desligados.

O contrato autenticado do ERP passa a distinguir capacidades implementadas de permissões de escrita. A rota de preço permanece indisponível, mesmo se a variável antiga for ativada, até haver suporte oficial funcional à API standard. A configuração de deploy rejeita o pedido de habilitar escrita de preço. Nenhuma escrita foi enviada ao Mercado Livre e nenhum estoque do Mercado do Vale foi alterado.

Validações executadas: suíte Mercado Livre (60 testes + contrato estático), verificações de sintaxe dos dois arquivos CJS alterados, `git diff --check`, build de produção, API pública HTTP 200 com MySQL OK e GET autenticado confirmando capacidades de estoque e os gates de preço/estoque como `false`.
Registro: `docs/versoes/2026-10-31-v1.2.726-ml-erp-capabilities-gates.md`.

---

# v1.2.725-mercado-livre-preco-gate

Data: 31/10/2026. Status: publicada. Branch: `main`. Tag: `v1.2.725-mercado-livre-preco-gate`.
Release do site: `/var/www/mdv-site/releases/20261031-234913-mercado-livre-preco-gate`. API Mercado Livre: publicada; gates de escrita de preço e estoque desligados.

As rotas de escrita do ERP no Mercado Livre validam primeiro a chave dedicada e só então respondem se a função está desabilitada. Isso evita revelar o estado interno do gate a chamadas sem autenticação. O gate de preço é independente do gate de estoque, e ambos continuam desligados na publicação. O teste completo da integração agora inclui os 11 casos da atualização de preço.

Validações: suíte Mercado Livre (60 testes + contrato estático), sintaxe dos servidores, `git diff --check`, build, API HTTP 200 com `mysql.ok=true` e GET autenticado de configurações com `erpCapabilities` vazio. As escritas de preço e estoque permaneceram desativadas.
Registro: `docs/versoes/2026-10-31-v1.2.725-mercado-livre-preco-gate.md`.

---

# v1.2.724-pdv-falta-estoque

Data: 31/10/2026. Status: publicada após validação da release. Branch: `main`. Tag: `v1.2.724-pdv-falta-estoque`.
Release do site: `/var/www/mdv-site/releases/20261031-163830-pdv-falta-estoque`.

O log da venda informa falta de estoque disponível em português, explica o efeito das reservas e identifica produto e quantidade solicitada. A resposta técnica original permanece no diagnóstico da auditoria. Sem alteração na regra de baixa de estoque ou publicação da API.

Validações: regressão do log, baixa por local, recuperação idempotente, sintaxe dos entrypoints, build e versão pública.
Registro: `docs/versoes/2026-10-31-v1.2.724-pdv-falta-estoque.md`.

---

# v1.2.723-custo-manual-produto

Data: 31/10/2026. Branch: `main`. Tag: `v1.2.723-custo-manual-produto`.
Release do site: `/var/www/mdv-site/releases/20261031-130000-v12723-custo-manual`.

No financeiro do pedido Shopee, cada item mostra a origem do custo e o botão Alterar custo. O ajuste vale para as próximas vendas, exige o custo anterior exibido, recusa aparelhos com IMEI e variações que herdam o custo do pai, e registra evidência e histórico. A evidência de custo deixa de aparecer nas leituras públicas de produtos.

Validações: testes do ajuste de custo, do financeiro, da privacidade de produtos e do modal, sintaxe da API, build e leitura pública da versão.

Registro: `docs/versoes/2026-10-31-v1.2.723-custo-manual-produto.md`.

---

# v1.2.722-financeiro-venda-shopee

Data: 31/10/2026. Branch: `main`. Tag: `v1.2.722-financeiro-venda-shopee`.
Release do site: `/var/www/mdv-site/releases/20261031-120000-v12722-financeiro-shopee`.

O detalhe do pedido Shopee (MV e G) passa a mostrar o financeiro da venda: valor da venda, comissão e demais taxas da Shopee, frete e outros ajustes conciliados com o repasse oficial, custo dos produtos pelo vínculo do anúncio ou SKU, lucro real e margem. A API consulta o repasse (escrow) somente ao abrir o detalhe de um pedido.

Validações: testes do cálculo e dos custos, contrato estático do modal, sintaxe da API, build e leitura pública da versão.

Registro: `docs/versoes/2026-10-31-v1.2.722-financeiro-venda-shopee.md`.

---

# v1.2.721-variantes-caixa-sangria

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.721-variantes-caixa-sangria`.
Release do site: `/var/www/mdv-site/releases/20261030-211139-v12721-variantes-caixa-sangria`.

As opções do produto são ordenadas por RAM e depois por armazenamento. Os detalhes de cada fechamento mostram as formas e os valores gravados naquele fechamento. O caixa destaca o registro de sangria, com destino e identificação, e a auditoria indica onde fazê-lo.

Validações: testes focados de catálogo e caixa, build, verificação do diff e leitura pública da versão.

Registro: `docs/versoes/2026-10-30-v1.2.721-variantes-caixa-sangria.md`.

---

# v1.2.720-caixa-auditoria-denominacoes

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.720-caixa-auditoria-denominacoes`.
Release do site: `/var/www/mdv-site/releases/20261030-210235-v12720-caixa-auditoria`.

A Auditoria de Caixa mostra as notas e moedas registradas na abertura e nos fechamentos, além das retiradas e dos demais movimentos manuais com valor, motivo, operador e horário. A tela do caixa explica onde essas retiradas aparecem.

Validações: contrato estático da auditoria, verificação do diff, build e verificação pública do site e da versão.

Registro: `docs/versoes/2026-10-30-v1.2.720-caixa-auditoria-denominacoes.md`.

---

# v1.2.719-caixa-arquivo-synology

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.719-caixa-arquivo-synology`.
Release do site: `/var/www/mdv-site/releases/20261030-213000-v12719-caixa-synology`.

O PDF do fechamento passa o SID do Synology tambem na URL do upload. O caixa #1 ja estava fechado; esta entrega permite arquivar o documento pendente sem reabrir ou repetir o fechamento.

Validacoes: teste estatico do contrato Synology, sintaxe dos servidores, build e verificacao publica.

Registro: `docs/versoes/2026-10-30-v1.2.719-caixa-arquivo-synology.md`.

---

# v1.2.718-caixa-relatorio-itens

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.718-caixa-relatorio-itens`.
Release do site: `/var/www/mdv-site/releases/20261030-210000-v12718-caixa-itens`.

O relatorio de fechamento le o indicador de brinde de `products`, pois a tabela `sale_items` nao possui essa coluna na producao. O fechamento que falhou foi revertido e a sessao antiga permaneceu aberta ate uma nova tentativa.

Validacoes: consulta real em leitura na producao, teste do fluxo de fechamento, verificacao de sintaxe e build.

Registro: `docs/versoes/2026-10-30-v1.2.718-caixa-relatorio-itens.md`.

---

# v1.2.717-caixa-fechamento-diario

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.717-caixa-fechamento-diario`.
Release do site: `/var/www/mdv-site/releases/20261030-203600-v12717-caixa-diario`.

Caixas abertos ficam bloqueados para novas vendas e movimentos a partir das 20h de Petrolina. O operador confere e fecha a sessao anterior antes da proxima abertura. A API corrige o resumo do fechamento usando `payment_status` real das vendas e evita deduzir duas vezes estornos da mesma sessao.

Validacoes: testes focados de caixa, sintaxe dos servidores, build, resumo em leitura contra o banco de producao, deploy da API e site e verificacao publica.

Registro: `docs/versoes/2026-10-30-v1.2.717-caixa-fechamento-diario.md`.

---

# v1.2.716-mercado-livre-erp-price-write-gate

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.716-mercado-livre-erp-price-write-gate`.
Release do site: `/var/www/mdv-site/releases/20261030-202646-mercado-livre-price-gate`.

Publica a capacidade de atualização de preço pelo ERP no Mercado Livre com um gate independente do estoque. O deploy mantém ambos desligados por padrão e só libera preço por flag explícita, chave dedicada, confirmação do operador e releitura do valor após o PUT. Promoção, automação não excluída, preço por quantidade/B2B, canal misto, seller/vínculo divergente e variações com preços diferentes permanecem bloqueados.

Validações: testes focados do serviço de preço e do helper de deploy, sintaxe Node, `git diff --check`, build do site, deploy seletivo da API e conferência pública do status e versão.

Registro: `docs/versoes/2026-10-30-v1.2.716-mercado-livre-erp-price-write-gate.md`.

---
# v1.2.715-custo-nulo-historico

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.715-custo-nulo-historico`.
Release do site: `/var/www/mdv-site/releases/20261030-171000-v12715-custo-nulo-historico`.

Ao editar preços de uma configuração de celular cujo custo de compra ainda não foi informado, a API mantém o custo do produto como ausente e grava `0` apenas no campo obrigatório do histórico de preços. Assim, os preços de todas as cores podem ser salvos na mesma transação sem erro 500.

Validações: teste que reproduziu `ER_BAD_NULL_ERROR` antes da correção e passou depois, suíte de preços por configuração, verificação de sintaxe, build e conferência pública. API publicada pelo deploy seletivo do módulo de grupos; site atualizado com a versão.

Registro: `docs/versoes/2026-10-30-v1.2.715-custo-nulo-historico.md`.

---

# v1.2.714-precos-bipe-cadastro

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.714-precos-bipe-cadastro`.
Release do site: `/var/www/mdv-site/releases/20261030-165500-v12714-precos-bipe-cadastro`.

Na conferência por foto, um bipe em número de série avança para IMEI 1, depois para IMEI 2 e EAN/GTIN; leitores com Enter, Tab ou sequência rápida sem sufixo são aceitos. Em variações do produto pai, **Editar valores** permite alterar varejo, revenda e atacado de uma configuração já cadastrada. O salvamento usa o grupo oficial para atualizar todas as cores, preservando o custo individual de compra.

Validações: testes da família, dos grupos de preço e do cadastro por foto; ensaio no navegador com cancelamento, erro e salvamento; build do site; verificação pública. Somente o site foi publicado; API e n8n não foram reiniciados.

Registro: `docs/versoes/2026-10-30-v1.2.714-precos-bipe-cadastro.md`.

---

# v1.2.713-busca-imei-admin

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.713-busca-imei-admin`.
Release do site: `/var/www/mdv-site/releases/20261030-190000-v12713-busca-imei-admin`.

A busca no catálogo administrativo encontra o produto pelo IMEI da unidade cadastrada mesmo depois de uma atualização geral da lista. Durante a consulta, a tela informa que a busca ainda está em andamento; no cartão da família, destaca a variação correspondente ao IMEI.

Validações: testes focados de busca por identificador, proteção contra perda do resultado na recarga, build do site e verificação pública da release. Publicação somente do site; API e n8n preservados.

Registro: `docs/versoes/2026-10-30-v1.2.713-busca-imei-admin.md`.

---

# v1.2.710-foto-precos-media-compra

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.710-foto-precos-media-compra`.
Release do site: `/var/www/mdv-site/releases/20261030-163154-foto-precos-media-compra`.

A conferência por foto abre o editor canônico de preços na configuração do aparelho e atualiza os valores ao voltar. Mostra a compra média somente dos aparelhos disponíveis para venda e, separadamente, a última compra registrada da configuração. Esta última é sugerida como compra da nova entrada, sem substituir valores digitados ou já confirmados.

Validações: testes de preços e cadastro por foto, fluxo em Chrome, filtros de disponibilidade/custos históricos, proteção contra drift, sintaxe e build. API publicada seletivamente antes do site, sem migration ou gravação comercial nos testes.

Registro: `docs/versoes/2026-10-30-v1.2.710-foto-precos-media-compra.md`.

---

# v1.2.709-painel-modelo-imagens

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.709-painel-modelo-imagens`.
Release do site: `/var/www/mdv-site/releases/20261030-160209-painel-modelo-imagens`.

O painel do modelo apresenta a imagem principal da variação à esquerda e cor, SKU, estoque, vendidos, custos opcionais e ações ao lado. As listas de aparelhos permanecem abaixo. No celular, o resumo fica abaixo da imagem. A imagem usa o resolvedor existente e mostra uma indicação quando não há foto.

Validações: painel real renderizado com dados sintéticos em Chrome desktop/celular, conferência visual, testes das imagens familiares, guarda de runtime, sintaxe dos servidores e build. Publicação somente do site.

Registro: `docs/versoes/2026-10-30-v1.2.709-painel-modelo-imagens.md`.

---

# v1.2.708-nome-familia-fonte-unica

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.708-nome-familia-fonte-unica`.
Release do site: `/var/www/mdv-site/releases/20261030-154534-nome-familia-fonte-unica`.

A função compartilhada getCatalogFamilyName resolve o nome público do pai para agrupamento, cards e página do produto. A limpeza do SKU deixou de existir apenas na página. Os cards também exibem Poco X8 5G, mantendo SKU e opções da variação separados. O nome gravado e os identificadores não são alterados.

Validações: nomes públicos/família, agrupamento genérico, seções de famílias, complemento de catálogo, sintaxe dos servidores e build. Publicação somente do site.

Registro: `docs/versoes/2026-10-30-v1.2.708-nome-familia-fonte-unica.md`.

---

# v1.2.707-titulo-modelo-sem-sku

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.707-titulo-modelo-sem-sku`.
Release do site: `/var/www/mdv-site/releases/20261030-153834-titulo-modelo-sem-sku`.

O título público da família remove o sufixo do SKU interno quando ele corresponde ao pai. Exemplo: Poco X8 5G - POCO0001 passa a Poco X8 5G; o SKU da variação POCO0001-03 continua na linha própria. O nome gravado, os identificadores e os complementos descritivos permanecem preservados.

Validações: nomes públicos, nomes da família, complementos de catálogo, sintaxe dos servidores e build. Publicação somente do site.

Registro: `docs/versoes/2026-10-30-v1.2.707-titulo-modelo-sem-sku.md`.

---

# v1.2.706-familia-configuracoes-individuais

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.706-familia-configuracoes-individuais`.
Release do site: `/var/www/mdv-site/releases/20261030-152411-familia-configuracoes-individuais`.

O cadastro de smartphones salva cada configuração que já tem varejo, revenda e atacado completos. Configurações sem preço permanecem no rascunho, sem bloquear as demais nem criar produtos com preço zero. O rascunho preserva os IDs confirmados para retomar depois sem duplicar a família e só é concluído quando não há pendências.

Validações: salvamento e retomada de configurações com API simulada, preços inválidos, rascunhos, famílias, fotos por cor, valores monetários e build. Publicação somente do site.

Registro: `docs/versoes/2026-10-30-v1.2.706-familia-configuracoes-individuais.md`.

---

# v1.2.705-rascunho-valores-iniciais

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.705-rascunho-valores-iniciais`.
Release do site: `/var/www/mdv-site/releases/20261030-151555-rascunho-valores-iniciais`.

O formulário de produtos usa a mesma base de valores ao iniciar e reabrir rascunhos parciais. Preços e status ausentes recebem os valores iniciais já usados no cadastro, sem apagar preços preenchidos nem liberar valores explicitamente inválidos. Corrige os erros NaN de varejo/revenda/atacado e status inválido no cadastro da família a partir do modelo.

Validações: reprodução dos quatro erros com o schema real, rascunhos e famílias, valores monetários, TypeScript do helper, sintaxe dos servidores e build. Publicação somente do site; API e dados comerciais sem alteração.

Registro: `docs/versoes/2026-10-30-v1.2.705-rascunho-valores-iniciais.md`.

---

# v1.2.704-foto-fila-concluidos

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.704-foto-fila-concluidos`.
Release do site: `/var/www/mdv-site/releases/20261030-145831-foto-fila-concluidos`.

O cadastro por foto abre na aba Pendentes. Os aparelhos concluídos ficam na aba Disponíveis para venda, com contadores e acesso pelo aviso de cadastro salvo. Ao finalizar, a tela avança para o próximo pendente ou exibe a fila vazia. A organização é visual, usando o status existente, sem alterar estoque ou registros comerciais.

Validações: suite smartphone-photo-intake, exclusão individual da fila, sintaxe dos servidores e build. Publicação somente do site.

Registro: `docs/versoes/2026-10-30-v1.2.704-foto-fila-concluidos.md`.

---

# v1.2.703-garantia-logomarca

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.703-garantia-logomarca`.
Release do site: `/var/www/mdv-site/releases/20261030-143105-garantia-logomarca`.

A impressão dos termos no PDV, vendas e histórico do cliente aguarda imagens decodificadas e fontes. Imagens quebradas ou sem resposta interrompem a impressão automática com aviso. O PDF incorpora a logomarca uma vez e reutiliza o conteúdo nas duas vias, sem buscar novamente a mesma imagem durante a captura.

Validações: teste em Chrome com imagem lenta acima de três segundos, imagem quebrada e timeout; PDF real com duas páginas e logomarca conferida visualmente; contratos de garantia/WhatsApp, TypeScript do helper e build. Publicação somente do site; API e dados comerciais sem alteração.

Registro: `docs/versoes/2026-10-30-v1.2.703-garantia-logomarca.md`.

---

# v1.2.702-mercado-livre-erp-readonly

Data: 29/10/2026. Status: publicado. Branch: `main`.
Release do site: `/var/www/mdv-site/releases/20261029-210551-v1-2-702-mercado-livre-erp-readonly`. API: `/var/www/mdv-api/backups/mercado-livre-1793307873300`.

Ponte dedicada de leitura do Mercado Livre para o ERP. A escrita de estoque permanece desativada por padrão e requer flag administrativa e chave própria; preço segue bloqueado sem endpoint oficial de atualização.

Registro: `docs/versoes/2026-10-29-v1.2.702-mercado-livre-erp-readonly.md`.

---
# v1.2.701-mercado-livre-identidade-anuncios

Data: 29/10/2026. Status: publicado. Branch: `main`. Tag: `v1.2.701-mercado-livre-identidade-anuncios`. Release VPS: `/var/www/mdv-site/releases/20261029-173330-ml-identidade-anuncios`.

A revisão manual de anúncios passa a mostrar atributos públicos de identificação do anúncio e da variação para ajudar a conferir vínculos ambíguos. Nada é vinculado automaticamente e não há alteração de preço, estoque ou anúncio remoto. Testes Mercado Livre: 42 aprovados; build aprovado; API e site publicados e validados.

Registro: `docs/versoes/2026-10-29-v1.2.701-mercado-livre-identidade-anuncios.md`.

---
# v1.2.700-payjoy-disponibilidade

Data: 29/10/2026. Status: publicado. Branch: `main`. Tag: `v1.2.700-payjoy-disponibilidade`. Release planejada do site: `/var/www/mdv-site/releases/20261029-141155-v12700-payjoy-disponibilidade`.

O fluxo de atendimento responde quando o cliente pergunta se os celulares podem ser financiados pela PayJoy. Explica que aprovação, condições e elegibilidade do aparelho dependem da análise, oferece o link e aguarda confirmação antes de enviá-lo. A pergunta não deve acionar encaminhamento humano genérico. O cliente do final 5190 recebeu a resposta corrigida em mensagem manual verificada (ID 29094); nenhum link foi enviado nessa correção.

O candidato altera somente o nó `Pagamento - Politica` do workflow `SkrkB4vyKVDnQ68t`, preservando grafo, credenciais e outros nós. O gate comercial passou em 128 testes, incluindo resposta inicial, aceite em turno separado e caso negativo. O build do site passou após regenerar o bloco Nginx derivado; não houve mudança de conteúdo nesses arquivos. O site recebe apenas o manifesto de versão; API sem alteração.

---

# v1.2.699-erp-catalogo-preco-review

Data: 29/10/2026. Status: API publicada. Branch: `main`. Commit da API: `20f26ef9`. Tag de recuperação: `v1.2.699-erp-catalogo-preco-review`.
Backup da API: `/var/www/mdv-api/backups/mercado-livre-1793282351390`. Site: sem alteração; manifesto público pendente até um build válido.

O catálogo de leitura passa a manter a paginação quando um preço armazenado com fração de centavo não pode ser representado com segurança em centavos inteiros. O endpoint retorna o produto, deixa somente o preço inválido como `null` e informa um código de revisão. A ponte do ERP mostra o valor como pendente, impede sua inclusão no CSV de migração e continua a leitura das páginas seguintes. A rota segue sem campos ou alterações de estoque.

Validação: 41 testes da API e 47 da ponte do ERP passaram. Em produção, API online, `/status` 200 com MySQL saudável, consulta sem chave 401 e consulta autenticada no cursor problemático 200. A varredura completa leu 2.797 produtos em 56 páginas, sem IDs repetidos. Há 12 grupos de SKU ativo duplicado, 614 custos ausentes, 16 preços de venda ausentes e 2 com fração de centavo. A API não expõe estoque. O prebuild do site parou na verificação de sincronização da configuração Nginx; por isso o site permaneceu na versão anterior.

---

# v1.2.698-erp-catalogo-readonly

Data: 29/10/2026. Status: publicado. Branch: `codex/erp-readonly-catalog` → `main`. Commit: `69fee468`. Tag: `v1.2.698-erp-catalogo-readonly`.
Release final do site: `/var/www/mdv-site/releases/20261029-130208-erp-catalogo-readonly-final`. A primeira release da mesma versão foi substituída para alinhar o manifesto público à validação da API. API: publicação seletiva concluída; backup em `/var/www/mdv-api/backups/mercado-livre-1793278811310`.

Adiciona GET `/api/mercado-livre/erp/products`, com chave dedicada do ERP, paginação por cursor e até 50 produtos por página. Retorna SKU, dados cadastrais, preços, peso, dimensões e URLs HTTPS de imagens. A consulta SQL e a resposta não incluem quantidade nem localização de estoque; não há rota de escrita.

Validação: 40 testes da suíte Mercado Livre, 46 testes da ponte no ERP, 5 testes de navegador e build passaram. A API reiniciou online; `/status` confirmou MySQL saudável, a rota sem chave retornou 401 e a consulta autenticada leu 10 produtos em duas páginas sem sobreposição. Os 10 tinham foto e peso; todas as imagens eram HTTPS e nenhum campo de estoque foi retornado. Homepage HTTP 200 e `/VERSION.json` confirmam a release. Nenhum saldo ou anúncio foi alterado.

---

# v1.2.696-mercado-livre-estoque-leitura

Data: 29/10/2026. Status: publicado. Branch de release: `codex/ml-orders-erp-inbox`; destino: `main`. Tag: `v1.2.696-mercado-livre-estoque-leitura`.
Release do site ativa: `/var/www/mdv-site/releases/20261029-040259-v1-2-696-estoque-manifest`. API: publicada seletivamente pelo fluxo `--mercado-livre-only`; backup em `/var/www/mdv-api/backups/mercado-livre-1793246257914`.

O ERP consegue consultar o saldo atual dos anúncios Mercado Livre vinculados ao produto e à família local. Anúncios tradicionais retornam saldo por SKU/variação; contas com `warehouse_management` retornam saldo por localização sem atribuí-lo indevidamente a um SKU. A rota usa a chave técnica somente de leitura. Nenhum saldo do Mercado do Vale ou do Mercado Livre é alterado.

O deploy seletivo agora inclui e valida o módulo da nova rota antes de reiniciar `mdv-api`, preservando cópia de recuperação do módulo anterior quando existir.

Validações concluídas: 29 testes da suíte Mercado Livre, contrato estático, `node --check` dos módulos alterados e build Vite. `mdv-api` reiniciou online; status da API e homepage responderam HTTP 200. A consulta autenticada GET de estoque do anúncio vinculado `MLB4282518399` retornou o SKU local `LJH074`. `/VERSION.json` público confirma esta versão e a release ativa. Nenhuma gravação de estoque ocorreu.

## Histórico anterior

# v1.2.695-mercado-livre-pedidos-erp

Data: 29/10/2026. Status: pronto para publicação. Branch de release: `codex/ml-orders-erp-inbox`; destino: `main`. Tag planejada: `v1.2.695-mercado-livre-pedidos-erp`.
Release do site ativa: `/var/www/mdv-site/releases/20261029-003100-ml-orders-erp`.

O ERP consulta pedidos do vendedor no Mercado Livre por data de criação ou de última atualização, com paginação e filtros por período. A resposta reduz os dados ao necessário para revisão: status, datas, valores em centavos e itens/SKUs; dados de comprador, endereço, pagador e cartão ficam fora da fila. O ERP atualiza o mesmo pedido pelo par vendedor + ID, evitando duplicação. A rota é GET; nenhuma operação de anúncio, preço ou estoque foi habilitada.

Validação: suíte Mercado Livre (24 testes), testes locais da ponte e HTTP (87), sintaxe dos módulos alterados e build. A API foi publicada; status e consulta autenticada de pedidos responderam HTTP 200. A verificação leu somente um pedido e não o importou para o ERP.

## Histórico anterior

# v1.2.694-mercado-livre-erp-read-key

Data: 28/10/2026. Status: ready. Branch: main. Tag: v1.2.694-mercado-livre-erp-read-key.
Release: /var/www/mdv-site/releases/20261028-213500-mercado-livre-erp-read-key.

O ERP usa uma credencial técnica dedicada, validada em tempo constante, nas consultas GET de status, descoberta de anúncios, leitura de preço vinculado e atributos de categoria do Mercado Livre. O status retorna somente conexão, ID do seller e apelido. Atualização de configuração, vínculo, OAuth, publicação, pedidos, preços e estoque não são autorizados por essa chave; as rotas de escrita mantêm a autenticação e as travas existentes.

Nenhuma sincronização, alteração de estoque ou anúncio é executada por essa integração de leitura. O segredo é configurado fora do Git, no ambiente do processo da API e na prévia local isolada do ERP.

Validação: teste focado de autorização por rota e sanitização do status, suíte Mercado Livre, sintaxe da API, build do site, validação GET pública e status conectado da prévia local.

## Histórico anterior

# v1.2.692-payjoy-contexto-separado

Data: 27/10/2026. Status: ready. Branch: main. Tag: v1.2.692-payjoy-contexto-separado.
Release: /var/www/mdv-site/releases/20261027-210102-payjoy-contexto-separado.

O atendimento PayJoy reconhece a grafia “Pay Joy” e a pergunta imediata “Como que faz” em mensagens separadas. Nesse caso, usa a política existente para enviar uma única URL oficial da análise. Uma dúvida geral, uma recusa ou um assunto interrompido continuam sem disparar link. O workflow mantém o grafo e altera somente Parse Classificacao, Resolver Acao de Conversacao e Pagamento - Politica.

Validação: 21 testes focados de PayJoy, 125 casos do gate comercial e dry-run contra a versão ativa. O site recebe o registro da versão; a API não muda.

## Histórico anterior

# v1.2.691-cadastro-unico-familia

Data: 27/10/2026. Status: ready. Branch: main. Tag: v1.2.691-cadastro-unico-familia.
Release: /var/www/mdv-site/releases/20261027-182329-cadastro-unico-familia.

Os atalhos da Gestão de Modelos, do agrupador de produtos e das fotos do pai abrem o mesmo cadastro da família por ID do modelo. A API reutiliza o rascunho principal sob trava do modelo, impede duplicação e protege contra gravações de abas antigas. Links de rascunhos substituídos retomam o principal. Modelos com duplicados antigos ainda não conferidos exigem revisão antes de escolher uma base.

Com autorização do operador, o Poco X8 5G foi consolidado em um rascunho com seis variações, o EAN já digitado e a foto mais recente do pai, mantendo unidade UN e produção por terceiros. Oito rascunhos anteriores permanecem arquivados com conteúdo integral e vínculo ao principal. Backup privado na VPS em backups/model-draft-consolidation/. Nenhum preço, estoque, unidade física ou venda foi alterado.

Validação: 31 testes de rascunhos, família e mídia; dois testes do deploy seletivo; sintaxe da API; teste de atalhos no navegador; build e conferência pública. Publicação seletiva do módulo de rascunhos e seu prefill compartilhado antes do site. Alterações locais de outros assuntos ficaram fora do commit.

## Histórico anterior

# v1.2.690-colecoes-whatsapp-dinamicas

Data: 27/10/2026. Status: ready. Branch: main. Tag: v1.2.690-colecoes-whatsapp-dinamicas.
Release: /var/www/mdv-site/releases/20261027-123922-colecoes-whatsapp-dinamicas.

O feed Meta inclui o caminho da categoria em product_type e a origem sistema_mdv em custom_label_0. Colecoes podem usar filtros automaticos vinculados a classificacao do sistema, em vez de selecoes manuais de IDs antigos. A hierarquia vem de categories da VPS/MySQL e acompanha novos cadastros e mudancas de categoria.

Validacao: sete testes; previa somente leitura com 1532 produtos; sintaxe do modulo. Publicacao seletiva da API e site para registro de versao. Configuracoes e processamento das colecoes na Meta/WhatsApp sao verificados separadamente.

## Historico anterior

# v1.2.689-catalogo-meta-dinamico

Data: 27/10/2026. Status: ready. Branch: main. Tag: v1.2.689-catalogo-meta-dinamico.
Release: /var/www/mdv-site/releases/20261027-121348-catalogo-meta-dinamico.

O endpoint publico `/api/meta-catalog.xml` gera o feed da Meta diretamente dos produtos atuais da VPS/MySQL, reutilizando o calculo de estoque e o resolvedor de imagens por modelo/cor. Aplica visibilidade, preco de varejo em centavos, promocao vigente e agrupamento de variacoes. Falhas de consulta ou feed vazio retornam 503 em vez de substituir o catalogo por uma lista vazia. Nao exporta custos nem dados de unidades/clientes.

Validacao: seis testes, sintaxe e previa somente leitura com 1532 produtos, XML valido e links publicos HTTP 200. Publicacao seletiva da API; site atualizado para registrar a versao. A programacao e o resultado de importacao da Meta precisam ser conferidos no Gerenciador de Comercio.

## Historico anterior

# v1.2.688-variacoes-custo-estoque

Data: 24/10/2026. Status: ready. Branch: main. Tag: v1.2.688-variacoes-custo-estoque.
Release: /var/www/mdv-site/releases/20261025-015416-variacoes-custo-estoque.

O cadastro de celulares inclui uma configuração de RAM e armazenamento em várias cores de uma vez, preserva EANs e fotos dos rascunhos e recolhe os detalhes das variações. Cada configuração mostra o custo médio de compra em estoque consultado na API, inclusive nas famílias já cadastradas. A Gestão de Modelos exibe 25 modelos por página, pesquisa em todos os cadastros e limita a espera da consulta de preços a 15 segundos.

Validação: testes de família, preços e rascunhos; testes no navegador de EAN, configurações, custo médio, paginação, pesquisa e recarga; build e validação pública. Somente site publicado; nenhuma alteração de preços, estoque ou API nesta entrega.

## Histórico anterior

# v1.2.687-ean-digitacao-rascunho

Data: 24/10/2026. Status: ready. Branch: main. Tag: v1.2.687-ean-digitacao-rascunho.
Release: /var/www/mdv-site/releases/20261024-163000-ean-digitacao-rascunho.

Corrige o campo EAN das variações, que apagava cada dígito durante a edição do rascunho. A detecção de alterações continua ativa para o salvamento automático. Teste de digitação no navegador, teste de rascunhos e build do site passaram. Somente site publicado.

## Histórico anterior

# v1.2.686-rascunho-auto-salvo

Data: 24/10/2026. Status: ready. Branch: main. Tag: v1.2.686-rascunho-auto-salvo.
Release: /var/www/mdv-site/releases/20261024-162150-rascunho-auto-salvo.

O cadastro de produtos salva automaticamente o rascunho após alterações, incluindo foto do pai, imagens e dados das variações. O formulário mostra o estado do salvamento, avisa se falhar e mantém o identificador do rascunho na URL para retomada após recarregar a página. O botão de salvar manualmente continua disponível.

Validação: teste de rascunhos, grupos de preços e cadastro por foto; build do site e verificação pública. Apenas site publicado.

## Histórico anterior

# v1.2.685-precos-variacoes-juntos

Data: 24/10/2026. Status: ready. Branch: main. Tag: v1.2.685-precos-variacoes-juntos.
Release: /var/www/mdv-site/releases/20261024-160334-precos-variacoes-juntos.

O cadastro de smartphones permite informar os precos de varejo, revenda e atacado por configuracao na mesma etapa de variacoes. Cores com a mesma memoria compartilham os valores; o pai pode ser salvo sem preco. Configuracoes ja existentes mostram seus precos protegidos e mudancas concorrentes bloqueiam o salvamento. O painel de modelos oferece atalho direto para essa etapa.

Validacao: testes de familia, precos e cadastro por foto; build do site e verificacao publica. Apenas site publicado.

## Historico anterior

# v1.2.684-restaura-rascunhos-api

Data: 24/10/2026. Status: ready. Branch: main. Tag: v1.2.684-restaura-rascunhos-api.
Release: /var/www/mdv-site/releases/20261024-154247-restaura-rascunhos-api.

A rota de rascunhos do cadastro de produtos foi restaurada na API publicada e seu registro agora consta nos tres arquivos de entrada do repositorio. Um teste falha se qualquer entrypoint perder o registro. O GET e PUT sem sessao retornam 401, comprovando que a rota existe e permanece protegida.

Validacao: teste de rascunhos, sintaxe dos entrypoints, build do site e verificacao publica. Recuperacao seletiva da API; site publicado para registrar a versao.

## Historico anterior

# v1.2.683-eans-por-variacao

Data: 24/10/2026. Status: ready. Branch: main. Tag: v1.2.683-eans-por-variacao.
Release: /var/www/mdv-site/releases/20261024-153307-eans-por-variacao.

Cada variacao aceita ate 20 EANs reais da mesma configuracao. No cadastro por imagem, um EAN novo e acrescentado ao produto existente sem substituir os anteriores nem criar outro produto; repeticoes sao ignoradas. Uma falha posterior reverte a atualizacao junto com a finalizacao. O campo da variacao nao oferece gerar um codigo aleatorio.

Validacao: testes de cadastro por foto, Bling e familia, verificacao de sintaxe da API, build do site e verificacao publica apos deploy. Site e API publicados.

## Historico anterior

# v1.2.682-menu-modelos

Data: 24/10/2026. Status: ready. Branch: main. Tag: v1.2.682-menu-modelos.
Release: /var/www/mdv-site/releases/20261024-145834-menu-modelos.

Na Gestao de Modelos, Editar fica visivel e as demais acoes ficam em um menu com nomes completos, organizado por produto, integracao Bling e exclusao. As colunas de salvar, status e acoes recebem larguras reservadas. O menu abre fora da tabela rolavel, com navegacao por teclado e ajuste aos limites da tela.

Validacao: teste de navegador do menu, guardas de precos e cadastro pai, build com travas e consulta publica apos deploy. Publicacao somente do site; sem mudancas em dados comerciais ou API.

## Historico anterior

# v1.2.681-foto-produto-pai-visivel

Data: 23/10/2026. Branch: main. Tag: v1.2.681-foto-produto-pai-visivel.
Release: /var/www/mdv-site/releases/20261023-205546-foto-produto-pai-visivel.

Na etapa Variacoes do cadastro da familia, as fotos do produto pai ficam visiveis antes dos filhos, com a primeira imagem identificada como capa. Sao as mesmas fotos da aba Fotos e descricao. Na aba de fotos do modelo, o quadro de fotos do pai inicia aberto quando a familia ja existe.

Validacao: testes focados de cadastro pai e familia, build do site e consulta publica apos deploy. Somente o site recebe deploy.

## Historico anterior

# v1.2.680-variacoes-por-fotos-modelo

Data: 23/10/2026. Branch: main. Tag: v1.2.680-variacoes-por-fotos-modelo.
Release: /var/www/mdv-site/releases/20261023-204627-variacoes-por-fotos-modelo.

As cores com fotos cadastradas no modelo preparam automaticamente rascunhos de variacoes quando o produto pai e aberto. Cada filho usa as fotos de sua cor e herda os dados comuns do pai; cores ja existentes nao sao duplicadas. Novas variacoes de celular exigem RAM e armazenamento antes de salvar. O seletor tambem destaca as cores fotografadas, inclusive se inativas no cadastro geral.

Validacao: testes focados, sintaxe dos servidores, build do site e consulta publica apos deploy. Somente o site recebe deploy.

## Historico anterior

# v1.2.679-menu-sem-barra-variacoes

Data: 23/10/2026. Branch: main. Tag: v1.2.679-menu-sem-barra-variacoes.
Release: /var/www/mdv-site/releases/20261023-202019-menu-sem-barra-variacoes.

O menu lateral administrativo continua rolavel, mas sem barra visivel. No cadastro dos filhos de uma familia, RAM e armazenamento usam as opcoes cadastradas para escolha, preservando valores ja presentes em um rascunho.

Validacao: testes focados do menu, seletores e familias, build do site e consulta publica apos deploy. Somente o site recebe deploy.

## Historico anterior

# v1.2.678-modelo-produto-pai

Data: 23/10/2026. Branch: main. Tag: v1.2.678-modelo-produto-pai.
Release: /var/www/mdv-site/releases/20261023-201140-modelo-produto-pai.

Na Gestao de Modelos, a acao de produto pai abre o cadastro ja vinculado ao modelo e sua marca. Antes de criar, confere se a familia ja existe e abre a ficha atual quando existir. A aba de fotos do modelo mostra como iniciar a familia. Ao salvar o pai, a ficha abre para adicionar as variacoes e suas fotos.

Validacao: teste focado de cadastro pai, testes de familia, build do site e consulta publica de homepage e VERSION.json. Somente o site recebe deploy.

## Historico anterior

# v1.2.677-menu-modelos-css

Data: 23/10/2026. Branch: main. Tag: v1.2.677-menu-modelos-css.
Release: /var/www/mdv-site/releases/20261023-194553-menu-modelos-css.

Corrigida a largura do menu compacto em desktop. A pasta `layouts/` agora participa da geracao do Tailwind, garantindo que a classe de 72 px realmente exista no CSS publicado. Uma regressao compila o CSS e falha se essa classe desaparecer.

Validacao: teste de CSS gerado, build com travas e medicao do menu e da area de Modelos no navegador apos a publicacao. Somente o site recebe deploy.

## Historico anterior

# v1.2.676-menu-modelos-compacto

Data: 23/10/2026. Branch: main. Tag: v1.2.676-menu-modelos-compacto.
Release: /var/www/mdv-site/releases/20261023-193701-menu-modelos-compacto.

Na Gestao de Modelos, o menu administrativo inicia compacto em desktop quando ainda nao ha preferencia salva; o operador pode expandir ou recolher e a escolha persiste. Os icones mantem nome acessivel e a tabela conserva largura minima, com rolagem horizontal apenas quando necessario.

Validacao: teste focado de responsividade, testes de navegacao do painel, build com travas e verificacao publica do site. Somente o site recebe deploy; API e n8n permanecem como estao.

## Historico anterior

# v1.2.675-catalogo-pergunta-separada

Data: 23/10/2026. Branch: main. Tag: v1.2.675-catalogo-pergunta-separada.
Release: /var/www/mdv-site/releases/20261023-190417-catalogo-pergunta-separada.

No catalogo de celulares enviado pelo WhatsApp, a pergunta "Qual modelo voce quer ver em mais detalhes? 😊" segue em uma mensagem propria, apos os blocos da lista. A mesma separacao vale para a pergunta de escolha de fotos. Os preços e as configurações permanecem nos blocos de produtos.

Validacao: teste da saida final do emissor e gate comercial completo; publicacao seletiva do workflow n8n e do site para atualizar VERSION.json.

## Historico anterior

# v1.2.674-foto-atalho-campos

Data: 23/10/2026. Branch: main. Tag: v1.2.674-foto-atalho-campos.
Release: /var/www/mdv-site/releases/20261023-142655-foto-atalho-campos.

Na fila do cadastro por foto, o card selecionado mostra o botao Ir aos campos de preenchimento. Ele desce diretamente para Dados identificados e posiciona o foco, sem parar no bloco da foto.

Validacao: teste de navegacao do cadastro por foto e build com travas. Publicacao somente do site.

## Historico anterior

# v1.2.673-foto-poco-cartao

Data: 23/10/2026. Branch: main. Tag: v1.2.673-foto-poco-cartao.
Release: /var/www/mdv-site/releases/20261023-103000-v12673-foto-poco-cartao.

Cadastro por foto exibe fila de celulares em cards que quebram linha acima dos dados, oferece exclusao por aparelho com confirmacao e avisa qual aparelho foi cadastrado antes de avancar. O orcamento copiado do carrinho inclui PIX, 12 parcelas e total verificados para cada configuracao. No bot, pedido de fotos de dois modelos POCO segue atendimento de vendas, consulta cada modelo separadamente e mostra o preco no cartao somente com taxa confirmada.

Validacao: suites de cadastro e remocao, orcamento, oito casos focados do bot, gate comercial de 117 cenarios e build com travas. Site e workflow n8n publicados com backup criptografado; versao publica, historico ativo e servicos confirmados.

## Historico anterior

# v1.2.672-custo-medio-movel

Data: 22/10/2026. Branch: main. Tag: v1.2.672-custo-medio-movel.
Release: /var/www/mdv-site/releases/20261022-223048-custo-medio-movel.

Custo medio movel por configuracao para novas vendas, mantendo compra individual do IMEI. Entradas recalculam o saldo; vendas conservam a media e congelam a base de custo. Devolucoes recuperam a base retirada. Precos de venda preservados. Custos e lucro das vendas anteriores a ativacao nao sao recalculados ao abrir o painel.

Validado em MySQL 8.0.46 isolado com estrutura real e triggers, incluindo concorrencia, retry e rollback. A API recebe somente os modulos do escopo e o hook de estoque, com backup completo e hashes dos registros originais antes/depois da migration e inicializacao.

## Historico anterior

# v1.2.671-origem-versao-global

Data: 22/10/2026. Branch: main. Tag: v1.2.671-origem-versao-global.
Release: /var/www/mdv-site/releases/20261022-205131-origem-versao-global.

Global agora e persistido na origem do cadastro por foto e na escrita de smartphones. Versoes explicitas sao preservadas. Registros antigos sem versao exigem salvar a conferencia e reconfirmar precos. Painel mostra uma configuracao por vez, separa venda e compra e avisa divergencias entre estoque e IMEIs.

Validacao: suites de foto, grupos, reparo de versoes, formulario e build. API seletiva antes do site; sem migration ou reaplicacao do reparo de dados nesta publicacao.

## Historico anterior

# v1.2.670-layout-compra-imei

Data: 22/10/2026. Branch: main. Tag: v1.2.670-layout-compra-imei.
Release: /var/www/mdv-site/releases/20261022-203119-layout-compra-imei.

Removida a barra horizontal superior dos modelos e a largura minima de 1500 px; a tabela usa colunas ajustadas ao espaco disponivel. Na lista de aparelhos, lapis ao lado do custo abre o editor no proprio campo, sem coluna de acoes vazia. Identificadores quebram linha e botoes se acomodam ao espaco.

Validacao: guarda de layout, 20 testes de grupos/rota, navegador verificando editor dentro da celula de custo e build com travas. Somente site; dados comerciais preservados.

## Historico anterior

# v1.2.669-compra-por-imei

Data: 22/10/2026. Branch: main. Tag: v1.2.669-compra-por-imei.
Release: /var/www/mdv-site/releases/20261022-201639-compra-por-imei.

Botao Editar compra por IMEI no painel de precos dos modelos e Editar compra na lista de unidades do produto. Permite pesquisar IMEI/serial, corrigir somente o custo da unidade e atualizar a media. Preserva os precos de venda e rascunhos nao salvos.

Validacao: 20 testes de grupos/rota de unidades, navegador com fixtures e build com travas. Publicacao apenas do site, usando PUT /units/:id existente, sem restart, migration ou gravacao comercial durante validacao.

## Historico anterior

# v1.2.668-custo-medio-estoque

Data: 22/10/2026. Branch: main. Tag: v1.2.668-custo-medio-estoque.
Release: /var/www/mdv-site/releases/20261022-194036-custo-medio-estoque.

Resumo dos grupos de precos exibe Custo medio em estoque, usando os custos individuais disponiveis ou o custo do produto ponderado pela quantidade para estoque sem unidades individuais. Sem estoque ou custo conhecido, mostra Nao informado. Nao altera custos, precos ou quantidades.

Validacao: 19 testes de grupos, teste de navegador, wiring, sintaxe e build. API seletiva antes do site; resultados publicos registrados na nota da entrega.

## Historico anterior

# v1.2.667-versao-cadastro-foto

Data: 22/10/2026. Branch: main. Tag: v1.2.667-versao-cadastro-foto.
Release: /var/www/mdv-site/releases/20261022-192328-versao-cadastro-foto.

Cadastro por foto permite selecionar a versao comercial cadastrada e usa esse valor na consulta de precos, confirmacao e finalizacao. Global e sem versao continuam separados. Trocar versao invalida a confirmacao anterior; o produto final conserva a versao escolhida. Dados ficam no JSON existente, sem coluna nova.

Validacao: suites de cadastro por foto, grupos de precos e finalizacao, sintaxe e build com travas. API seletiva --photo-intake-only antes do site, sem migration ou teste com gravacao comercial. Conferencias publicas e backup na nota da entrega.

## Historico anterior

# v1.2.666-pesquisa-modelo-foto

Data: 22/10/2026. Branch: main. Tag: v1.2.666-pesquisa-modelo-foto.
Release: /var/www/mdv-site/releases/20261022-185448-pesquisa-modelo-foto.

Modelo do sistema no cadastro por foto permite pesquisar pelo nome, ignorando acentos e caixa, e selecionar com mouse ou teclado. Mantem o ID do cadastro e exige Associar modelo para efetivar. Reutiliza SearchableSelect, preservando seletores existentes de cores e filamentos.

Validacao: nove testes focados e build com travas; verificacao publica registrada na nota. Somente site, sem API, migration ou gravacao comercial nesta publicacao.

## Historico anterior

# v1.2.665-painel-precos-modelo

Data: 22/10/2026. Branch: main. Tag: v1.2.665-painel-precos-modelo.
Release: /var/www/mdv-site/releases/20261022-183347-painel-precos-modelo.

O link de precos por configuracao abre o editor mesmo quando a consulta inicial falhou e o tipo do modelo ainda e desconhecido. O editor consulta novamente e permite recarregar em caso de erro; a tabela antiga vazia fica restrita a modelos confirmados como nao celulares.

Validacao: guarda de regressao do estado desconhecido, testes dos grupos de precos e build. Somente site, sem gravacao de precos ou restart de API. Validacoes publicas na nota da entrega.

## Historico anterior

# v1.2.664-selecao-campos-foto

Data: 22/10/2026. Branch: main. Tag: v1.2.664-selecao-campos-foto.
Release: /var/www/mdv-site/releases/20261022-174127-selecao-campos-foto.

Campos de texto da conferencia do cadastro por foto, incluindo IMEIs, serie, EAN e SKU opcional, selecionam todo o conteudo ao clicar ou receber foco pelo teclado.

Validacao: guarda de selecao no teste existente de navegacao, regressoes do cadastro por foto e build com travas. Publicacao somente do site; nenhum dado comercial alterado. Resultados publicos na nota da entrega.

## Historico anterior

# v1.2.663-catalogo-sem-timeout

Data: 22/10/2026. Branch: main. Tag: v1.2.663-catalogo-sem-timeout.
Release: /var/www/mdv-site/releases/20261022-135000-v12663-catalogo-sem-timeout.

Pedidos de lista completa de celulares com estoque, precos e parcelas ja confirmados seguem direto ao envio em tres mensagens, sem depender do Especialista - Vendas. Consultas que exigem interpretacao continuam na IA. A falha do cliente final 0750 foi causada por timeout de 10 minutos no modelo depois de o catalogo estar pronto; a lista foi enviada manualmente e confirmada em tres partes, com estado de escolha por numero preservado.

Validacao: quatro testes focados, reproducao da execucao 57171 ate os tres payloads de envio e 117 regressoes comerciais do candidato exato. Workflow ativo, site versionado e saude publica conferidos na nota da entrega.

## Historico anterior

# v1.2.662-payjoy-runtime-ativo

Data: 22/10/2026. Branch: main. Tag: v1.2.662-payjoy-runtime-ativo.
Release: /var/www/mdv-site/releases/20261022-111018-payjoy-runtime-ativo.

Correcao da falta de resposta sobre boleto: o workflow gerava a resposta, mas a API ativa server.js rejeitava payjoyByJid. O publicador anterior atualizava somente vps_server.js/cjs e a prova verificava cjs inativo. Agora inclui os tres entrypoints autorizados e prova consulta o pm_exec_path real do processo mdv-api.

Delta de producao restrito a uma chave na allowlist do server.js, com backup, sintaxe e restart pelo publicador existente. Sem mudar mensagem, divisao do link, workflow, memoria ou pausa manual. Testes reproduzem o falso positivo e verificam runtime, idempotencia e preservacao. Validacao HTTP usa revisao impossivel para assegurar rollback sem gravar conversa.

Publicacao concluida: commit funcional 51f0a4e7/tag enviados; somente server.js remoto alterado. Estado PayJoy aceito pelo runtime ativo, API/MySQL saudaveis, pausa manual e hash do workflow preservados. 17 testes focados, contrato de API e117 comerciais aprovados; site/build/version/navegador validados. Dez preexistentes preservados; limpeza0 removidos/35 bloqueadas detalhadas na nota.

## Historico anterior

# v1.2.661-payjoy-reutilizar-entrada

Data: 21/10/2026. Branch: main. Tag: v1.2.661-payjoy-reutilizar-entrada.
Release: /var/www/mdv-site/releases/20261021-225631-payjoy-reutilizar-entrada.

Perguntas sobre entrada usam o valor aprovado e o percentual ja lidos da PayJoy tambem no WhatsApp. O fluxo prioriza a calculadora existente antes da coleta de cor/retirada, preservando o SKU, memoria, cor e etapa. Reutilizacao exige aprovacao valida e nao ignora novos valores explicitos.

Validacao: 117 regressoes comerciais, 14 testes WhatsApp, 20 Meta, contrato da API e ensaio nativo isolado com fotografia sintetica e turnos separados. Publicacao seletiva de tres nos do workflow, com backup e verificacao do estado publicado. Nenhuma mensagem real enviada; pausa manual protegida preservada.

## Historico anterior

# v1.2.660-payjoy-foto-contexto

Data: 21/10/2026. Branch: main. Tag: v1.2.660-payjoy-foto-contexto.
Release: /var/www/mdv-site/releases/20261021-223650-payjoy-foto-contexto.

O WhatsApp preserva a nova imagem antes de hidratar o contexto da API. A decisao PayJoy ocorre depois da verificacao de pausa. O contrato existente passa a persistir PayJoy tambem para WhatsApp, com revisao e ordem do evento. Sem contexto, o bot pede esclarecimento; falhas de conversao ou leitura chegam ao fallback existente. Historico recente autoriza somente ler a nova imagem, nunca recuperar valores financeiros.

Validacao: 117 regressoes comerciais, 13 testes focados e oito ensaios nativos do modelo com dados sinteticos e sem envio de WhatsApp. Publicacao seletiva da chave de estado na API e patch guardado do workflow; pausa manual do atendimento investigado conferida sem altera-la.

## Historico anterior

# v1.2.659-entrega-observacao

Data: 20/10/2026. Branch: main. Tag: v1.2.659-entrega-observacao.
Release: /var/www/mdv-site/releases/20261021-000700-entrega-observacao.

A conclusao da entrega aceita observacao preenchida como justificativa para endereco e rota pendentes. Mantem exigencias de saida registrada, entregador, cliente, telefone, valor e pagamento. A justificativa segue registrada no lancamento do entregador.

API publicada seletivamente com backup dos entrypoints e preservacao dos demais blocos. Sem concluir entregas reais ou enviar mensagens nos testes.

## Historico anterior

# v1.2.658-compartilhar-familia-espacamento

Data: 19/10/2026. Branch: main. Tag: v1.2.658-compartilhar-familia-espacamento.
Release MDV: /var/www/mdv-site/releases/20261019-192539-compartilhar-familia-espacamento.

A area de compartilhamento oferece Variacao selecionada ou Familia completa para todos os canais existentes. Selecionar outra variacao restaura o modo individual. A mensagem inclui linhas em branco entre titulo, caracteristicas, memoria, pagamento, cores, moedas e link, e ao redor dos separadores. Mantem o formatador do catalogo e a separacao por preco, inclusive quando duas cores da mesma memoria custam valores diferentes.

Validacao: testes de comportamento e integracao do seletor; exemplo real do Note 70 com quatro blocos de preco; normalizacao monetaria e build. Publicacao apenas do site.

## Historico anterior

# v1.2.657-compartilhamento-variacao

Data: 19/10/2026. Branch: main. Tag: v1.2.657-compartilhamento-variacao.
Release MDV: /var/www/mdv-site/releases/20261019-191847-compartilhamento-variacao.

O compartilhamento da pagina do produto respeita a variacao selecionada e seu link. Sem selecao, separa a familia por memoria e preco, agrupando as cores correspondentes. Reutiliza os blocos do catalogo e o formatador monetario em reais, com parcelas e moedas vinculadas ao valor de cada configuracao.

Validacao: seis suites de compartilhamento, familia, cores, rotas e precos; normalizacao monetaria; build com travas de segredos e runtime legado. Publicacao apenas do site, sem alterar API ou dados comerciais.

## Historico anterior

# v1.2.656-meta-payjoy-contexto

Data: 19/10/2026. Branch: main. Tag: v1.2.656-meta-payjoy-contexto.
Release MDV: /var/www/mdv-site/releases/20261019-175000-v12656-meta-payjoy.

O fluxo PayJoy tem prioridade quando o bot aguarda a cor do aparelho: perguntas sobre a entrada usam a aprovacao persistida e preservam a escolha. Novos prints em conversas iniciadas antes da correcao podem seguir ao leitor por contexto recente e confiavel da loja, sem recuperar valores do historico. Imagens indisponiveis seguem ao tratamento canonico e invalidam aprovacao anterior.

## Historico anterior

# v1.2.655-meta-payjoy-prints

Data: 19/10/2026. Branch: main. Tag: v1.2.655-meta-payjoy-prints.
Release MDV: /var/www/mdv-site/releases/20261019-171500-v12655-meta-payjoy.

O Instagram e o Messenger encaminham prints PayJoy ao leitor nativo existente. O resultado persiste por conversa, com revisao e validade, para calcular a entrada sobre o valor aprovado e continuar com o aparelho escolhido. Downloads limitados a PNG/JPEG/WebP de CDNs permitidas, sem redirecionamento e ate 8 MiB. Pausas humanas e globais prevalecem; imagens ilegíveis ou indisponíveis pedem confirmacao, sem inventar valores. Sem reenvio de conversas antigas ou alteracao do estado WhatsApp.

## Historico anterior

# v1.2.654-atendimento-n8n

Data: 19/10/2026. Branch: main. Tag: v1.2.654-atendimento-n8n.
Release MDV: /var/www/mdv-site/releases/20261019-123700-v12654-atendimento-n8n.

O atendimento n8n passa a recuperar falhas do classificador com resposta segura, sem consumir confirmação de compra ou cadastro. A política de aparelhos usados, a interpretação do resultado PayJoy, a validação de cadastro e a escolha de entrega/retirada receberam correções e testes de regressão. O candidato foi composto sobre a versão ativa de 119 nós, validado com 117 testes e ensaios nativos do n8n 2.43.8 com dados sintéticos.

## Historico anterior

# v1.2.653-orcamento-familia-seo

Data: 19/10/2026. Branch: main. Tag: v1.2.653-orcamento-familia-seo.
Release MDV: /var/www/mdv-site/releases/20261019-134500-v12653-orcamento-familia-seo.

Orcar sem escolher cor preserva a familia e suas variacoes. A mensagem inclui todas as parcelas quando nenhuma foi escolhida. A previa social prioriza a imagem do pai; os dados estruturados preservam a imagem da variacao.

API publicada seletivamente pelos blocos de imagens SEO e HTML do produto, preservando integracoes remotas. Sem migracoes ou mudancas de dados comerciais.

## Historico anterior

# v1.2.652-whatsapp-webhook-ack

Data: 18/10/2026. Branch: main. Tag: v1.2.652-whatsapp-webhook-ack.
Release MDV: /var/www/mdv-site/releases/20261018-152433-v12652-whatsapp-ack.

Preserva o ACK imediato do WhatsApp ao compor o atendimento Meta e bloqueia candidatos sem o contrato de resposta.

O workflow ja recebeu a recuperacao emergencial autorizada. Esta entrega versiona a protecao no gerador e no validador; a reaplicacao deve confirmar o mesmo hash sem reiniciar n8n/runner. As nove falhas comerciais preexistentes permanecem separadas.

## Historico anterior

# v1.2.651-meta-validacao-contexto

Data: 18/10/2026. Branch: main. Tag: v1.2.651-meta-validacao-contexto.
Release MDV: /var/www/mdv-site/releases/20261018-123300-v12651-meta-contexto.

Exige prova real de continuidade e pausa humana nos dois canais antes de ativar novas respostas Meta.

## Historico anterior

# v1.2.650-meta-webhook-auth

Data: 18/10/2026. Branch: main. Tag: v1.2.650-meta-webhook-auth.
Release MDV: /var/www/mdv-site/releases/20261018-122600-v12650-meta-auth.

Valida o retorno 403 do Header Auth do n8n antes de liberar a entrada autenticada do atendimento Meta.

## Historico anterior

# v1.2.649-meta-atendimento-respostas

Data: 18/10/2026. Branch: main. Tag: v1.2.649-meta-atendimento-respostas.
Release MDV: /var/www/mdv-site/releases/20261018-122000-v12649-meta-atendimento.

Conecta novas mensagens do Direct e Messenger ao nucleo comercial do WhatsApp, com memoria por canal e fila de envio persistente.

A ativacao exclui eventos historicos. Pausa humana e global sao reavaliadas antes de cada envio. Resultado ambiguo nao e reenviado. Comentarios continuam em observacao; Marketplace depende da Pagina conectada.

## Historico anterior

# v1.2.648-meta-atendimento-piloto

Data: 17/10/2026. Branch: main. Tag: v1.2.648-meta-atendimento-piloto.
Release MDV: /var/www/mdv-site/releases/20261017-180000-v12648-meta-atendimento.

Prepara a caixa de entrada de Direct, Messenger e comentarios Meta, em observacao e com envios bloqueados. O receptor valida o corpo bruto com HMAC, grava o lote antes de confirmar e mantem os canais separados. Nao conecta o n8n nem envia mensagens. Marketplace depende de mensagens entregues a Pagina conectada; perfis pessoais nao estao incluidos.

## Historico anterior

# v1.2.647-n8n-memory-container

Data: 17/10/2026. Branch: main. Tag: v1.2.647-n8n-memory-container.
Release MDV: /var/www/mdv-site/releases/20261017-171500-v12647-n8n-memory-container.

Torna deterministica a recuperacao da memoria PostgreSQL: os containers principal e de banco agora sao localizados pelo rotulo exato do servico Docker Swarm. Isso impede que o runner seja confundido com o container principal durante uma reaplicacao idempotente.

## Histórico anterior

# v1.2.646-n8n-memory-readiness

Data: 17/10/2026. Branch: main. Tag: v1.2.646-n8n-memory-readiness.
Release MDV: /var/www/mdv-site/releases/20261017-170500-v12646-n8n-memory-readiness.

Conclui a recuperacao da memoria PostgreSQL do bot e torna a rotina operacional idempotente. Depois de alterar a credencial para `n8n-db`, health e readiness sao aguardados separadamente com timeout; um `502` transitório durante a inicializacao nao encerra a publicacao prematuramente. Se o host ja estiver correto, a verificacao preserva os servicos sem novo reinicio.

## Histórico anterior

# v1.2.645-n8n-memory-db-host

Data: 17/10/2026. Branch: main. Tag: v1.2.645-n8n-memory-db-host.
Release MDV: /var/www/mdv-site/releases/20261017-165936-v12645-n8n-memory-db-host.

As memorias `Memoria Vendas` e `Memoria de contexto postggress` passam a acessar o PostgreSQL pelo alias interno estavel `n8n-db`, evitando o endereco inacessivel da rede compartilhada apos reinicios do Docker Swarm. A rotina cria backup criptografado com permissao restrita, altera somente o host da credencial existente, remove copias temporarias descriptografadas, reinicia n8n e runner em ordem e valida health/readiness. Execucoes de clientes que falharam nao sao repetidas.

## Histórico anterior

# v1.2.644-tiktok-stock-protection

Data: 17/10/2026. Branch: main. Tag: v1.2.644-tiktok-stock-protection.
Release MDV: /var/www/mdv-site/releases/20261017-110207-v12644-tiktok-stock-protection.

Pedidos confirmados no TikTok passam a reservar imediatamente o estoque local por pedido e SKU, sem duplicar a baixa quando webhook e polling entregam o mesmo evento. O saldo absoluto posterior do Bling absorve a reserva provisoria, cancelamentos restauram apenas baixas ainda nao absorvidas e falhas ao atualizar o TikTok permanecem em fila persistente versionada. Um polling por data de atualizacao e uma reconciliacao periodica cobrem webhooks atrasados ou perdidos. O formato real do TikTok, com uma unidade por `line_item` e sem campo `quantity`, esta protegido por teste. O saldo operacional existente nao e alterado pela publicacao.

## Histórico anterior

# v1.2.643-shopee-anatel-condicional

Data: 17/10/2026. Branch: main. Tag: v1.2.643-shopee-anatel-condicional.
Release MDV: /var/www/mdv-site/releases/20261017-131315-shopee-anatel-condicional.

Na publicacao e edicao de anuncios Shopee, o painel exige a declaracao sobre Bluetooth, Wi-Fi ou RF quando a categoria retorna esse atributo. Ao selecionar Sim, exige o numero de licenca Anatel; ao selecionar Nao, nao envia uma licenca antiga. O envio aguarda os atributos da categoria e preserva esses campos mesmo em modelos estritos e tentativas de recuperacao. Nenhum numero de licenca e inventado. Somente o site sera publicado.

## Histórico anterior

# v1.2.642-unit-visibility

Data: 17/10/2026. Branch: main. Tag: v1.2.642-unit-visibility.
Release MDV: /var/www/mdv-site/releases/20261017-125000-v1642-unit-visibility.

Restaura a ação de ocultar e reativar aparelhos nas três entradas da API. O deploy seletivo altera apenas esse trecho, inclui os dois módulos de visibilidade e preserva outros ajustes da VPS. Testes impedem que uma publicação futura deixe as entradas divergentes. Nenhum aparelho é alterado pela publicação.

## Histórico anterior

# v1.2.641-shopee-filelink

Data: 17/10/2026. Branch: main. Tag: v1.2.641-shopee-filelink-verificado.
Release MDV: /var/www/mdv-site/releases/20261017-124500-v1641-shopee-filelink-verificado.

Etiquetas Shopee usam create_shipping_document_job com package_list, consulta de job_status e download_shipping_document_job. A API baixa o media_link sem expor a URL assinada, aceita PDF direto durante a transicao e preserva a impressao A4/termica. Jobs pendentes sao retomados por conta/pacote/tipo; links vencidos sao renovados com o mesmo job. 49 testes e preflight remoto seletivo aprovados. Publicacao aplica somente os blocos da integracao e o novo modulo, com backup e rejeicao de drift. O agente atual recebe o PDF pela mesma rota; o caminho legado foi atualizado no codigo-fonte sem incluir ajustes locais preexistentes de documento PF. Conferir validacao publica na nota da versao.

## Histórico anterior

# v1.2.640-precos-whatsapp

Data: 15/10/2026. Branch: main. Tag: v1.2.640-precos-whatsapp.
Release MDV: /var/www/mdv-site/releases/20261015-181600-v1640-precos-whatsapp.

O bot interpreta "6 gigas e 128 de armazenamento" como 6GB/128GB, preserva a lista durante mensagens simultaneas e somente a considera apresentada apos a confirmacao do envio pelo WhatsApp. "Valores?" e "No Pix, menor valor?" seguem para cotacao dos modelos em contexto, com caracteristicas verificadas, memoria, preco Pix, cartao 12x com total, cores e separadores. Nao promete desconto extra. Sete nos de codigo mudam, sem alterar conexoes. Doze testes focados e vinte de vendas passaram no candidato; a verificacao de producao consta na nota desta versao.

## Histórico anterior

# v1.2.639-visita-loja-maps

Data: 15/10/2026. Branch: main. Tag: v1.2.639-visita-loja-maps.
Release MDV: /var/www/mdv-site/releases/20261015-200722-v1639-visita-loja-maps.

O bot reconhece perguntas sobre visitar a loja para conferir aparelhos e usa o ramo de localizacao ja existente. A resposta informa o endereco cadastrado, link do Google Maps, horario regular do dia quando disponivel e pede o modelo para conferir estoque antes da visita. A regra nao captura perguntas de entrega, frete ou retirada de pedido. Quatro nos existentes mudaram, sem alterar conexoes; workflow e historico ativo foram verificados. Nao houve reenvio ao cliente 5234.

## Histórico anterior

# v1.2.638-catalogo-whatsapp-3-partes

Data: 15/10/2026. Branch: main. Tag: v1.2.638-catalogo-whatsapp-3-partes.
Release MDV: /var/www/mdv-site/releases/20261015-195134-v1638-catalogo-whatsapp-3-partes.

O compartilhamento do catálogo pelo site mostra modelo, características confirmadas, memória, preço à vista no Pix, cartão em 12x com total e cores na mesma linha. Cores do mesmo modelo e memória com preços diferentes ficam em blocos próprios para não atribuir o menor preço a todas. Listas longas são divididas em três mensagens completas, com numeração preservada e marca repetida quando a divisão cai dentro dela. Os botões WhatsApp e Copiar avançam uma parte por vez nos três pontos de compartilhamento. Nove testes focados e o build do site passaram. Somente o site é publicado; API e n8n não mudam nesta entrega.

## Histórico anterior

# v1.2.637-celulares-memoria

Data: 15/10/2026. Branch: main. Tag: v1.2.637-celulares-memoria.
Release MDV: /var/www/mdv-site/releases/20261015-133500-v1637-celulares-memoria.

No WhatsApp, cada numero da lista de celulares identifica um modelo com RAM e armazenamento definidos. As cores da mesma configuracao continuam juntas. A selecao por numero e cor preserva SKU, memoria e preco exatos; listas antigas agrupadas ainda exigem desambiguacao. O mutador de publicacao testa o candidato exato antes de gravar e confere o mesmo hash depois da leitura do n8n. Candidato f2e827d19bea0e8adc78469827be2a257569c996128a1c85787f83127a361a57, 87 testes aprovados antes e depois, build aprovado. Publicado: commit funcional 2f6578cd/tag enviados a main, workflow/historico alinhados, n8n/runner/banco 1/1, site/VERSION 637 e API/MySQL saudaveis. O timeout do especialista de vendas e a renovacao da chave REST sao investigacoes separadas desta correcao.

## Histórico anterior

# v1.2.636-imagens-pai-previa

Data: 15/10/2026. Branch: main. Tag: v1.2.636-imagens-pai-previa.
Release MDV: /var/www/mdv-site/releases/20261015-122600-v1636-imagens-pai-previa.

A API retorna as fotos do pai no catalogo compacto/completo e nos detalhes. O card prioriza a capa do pai inclusive ao escolher cor; quando o pai nao tem fotos, usa o filho. A pagina de detalhe aceita o mesmo endereco publico reconhecido pela previa. Open Graph usa JPEG separado e versionado sem alterar os originais. 33 testes e leitura real MySQL aprovados. Publicado: commit 5eba910e e tag enviados a main; API seletiva com backup e reinicio mdv-api concluido, MySQL saudavel e site/VERSION 636 confirmados. Card real manteve a foto do pai ao selecionar Preto; alias do suporte abriu o produto correto e previa retornou JPEG de 28.445 bytes com HTTP 200. Protecao obrigatoria no publicador das tres entradas. Alteracoes preexistentes e 35 worktrees bloqueadas preservadas. Sem alteracao do n8n.

## Histórico anterior

# v1.2.635-modelo-configuracao

Data: 15/10/2026. Branch: main. Tag: v1.2.635-modelo-configuracao.
Release MDV: /var/www/mdv-site/releases/20261015-120500-v1635-modelo-configuracao.

4G/5G deixam de virar RAM. A falta de 8GB/256GB oferece primeiro o mesmo modelo em 6GB/128GB disponivel, com aviso da diferenca. Nova mensagem sobre o modelo reavalia a memoria e preserva rede e contexto. Sem reserva ou venda automatica. 84 testes e 10 cenarios nativos reais aprovados no candidato 0099b60d7899b03cc400dcd0b3506550f93a58ae567a542a08f4b396b67d3a15. Publicado: commit 492fe22d e tag enviados a main; workflow e historico alinhados, 84 testes repetidos e leitura apos reinicio confirmou o hash nativo. Site/VERSION 635 e catalogo sem erros, n8n/banco/runner 1/1, API/MySQL saudaveis sem deploy/reinicio. Alteracoes preexistentes e 35 worktrees bloqueadas preservadas.

## Histórico anterior

# v1.2.634-payjoy-continuidade

Data: 15/10/2026. Branch: main. Tag: v1.2.634-payjoy-continuidade.
Release MDV: /var/www/mdv-site/releases/20261015-112900-v1634-payjoy-continuidade.

Pedidos como “me passa esse site” apos explicacao PayJoy seguem para o link oficial configurado. Referencia contextual recente, decisao semantica validada e preservacao de duvidas, recusas e humano. Cinco nos existentes, sem alteracao do grafo ou modelos. 71 testes locais e 20 cenarios nativos com chamadas reais aprovados no candidato 4f8af0756eb441102f300cec8d8be8eee2216f6388eab5d2ab08e6655f0e1051. Publicado: commit 9343e9e2 e tag enviados a main; fluxo ativo e historico conferidos com o mesmo hash, 71 testes repetidos apos gravacao e nova leitura apos reinicio. Site/VERSION 634 e catalogo sem erros conferidos, n8n e runner 1/1, link oficial configurado valido e API/MySQL saudaveis sem deploy/reinicio. Alteracoes preexistentes e 35 worktrees bloqueadas preservadas.

## Histórico anterior

# v1.2.633-fotos-tres-mensagens

Data: 15/10/2026. Branch: main. Tag: v1.2.633-fotos-tres-mensagens.
Release MDV: /var/www/mdv-site/releases/20261015-112153-v1633-fotos-tres-mensagens.

A resposta sobre fotos de todos os modelos passa a enviar três mensagens: explicação, link do catálogo e convite para escolher um modelo. Texto e link preservados. Apenas Vendas - Verificar Pos Lista muda no workflow; dois separadores de linha viram separadores de mensagem. 63 testes e fixtures de fotos/catálogo aprovados no candidato 31dc49a57e8a80b5f998136a87354e22a29dcbaecae86c2346bc94f118caa4db. Publicado: commit 9a1694f9/tag enviados a main; workflow e histórico conferidos com mesmo hash após reinício, 63 testes repetidos e health/readiness ok. Site e VERSION 633 confirmados, catálogo renderizado; API saudável sem deploy/reinício. Outras correções pendentes e 35 worktrees bloqueadas preservadas.

## Histórico anterior

# v1.2.632-n8n-responses-fix

Data: 15/10/2026. Branch: main. Tag: v1.2.632-n8n-responses-fix.
Release MDV: /var/www/mdv-site/releases/20261015-111233-v1632-n8n-responses-fix.

Corrige HTTP 400 do classificador após a migração: três modelos explicitam Responses e usam reasoning.effort, preservando GPT-6 Luna. O teste anterior simulava incorretamente o padrão da API; agora executa o Tools Agent V3 instalado e inspeciona o corpo efetivamente enviado. 61 testes de vendas, seis da migração e oito cenários reais passaram no candidato 1ef08bb887e985f859976d81f673002d4cc86baf790af7816b5d5b720b33c88f. Publicado: commit 1d9d5e0a/tag enviados a main; entidade/histórico com mesmo hash, n8n/runner 1/1, health/readiness aprovados e oito cenários reais repetidos sobre o readback. Site e VERSION 632 confirmados; catálogo renderiza sem erros no console. API saudável sem deploy/reinício. As sete correções de atendimento preparadas anteriormente continuam fora desta entrega; alterações preexistentes e 35 worktrees bloqueadas foram preservadas.

## Histórico anterior

# v1.2.631-n8n-gpt6-luna

Data: 14/10/2026. Branch: main. Tag: v1.2.631-n8n-gpt6-luna.
Release MDV: /var/www/mdv-site/releases/20261014-231800-v1631-n8n-gpt6-luna.

Quatro nós de IA usam gpt-6-luna: conversa, classificação, vendas e leitura PayJoy. Visão nativa 2.3 usa Responses e limite de saída compatível; parser aceita retorno novo e legado e recusa dados incompletos/erro. Sessenta e um testes do contrato, seis de migração, suíte PayJoy e oito testes reais nativos passaram antes da publicação. Candidato testado: 929ea50086ffac24cab632231dc3aece71b4774f99e95b66370ecbeb032bd116. Publicação concluída: commit 5428f86e e tag enviados, histórico ativo conferido com mesmo hash, n8n/runner 1/1 e site/VERSION 631 confirmados. Credenciais, conexões e áudio preservados. Seis arquivos preexistentes e 35 worktrees bloqueadas preservados.

## Histórico anterior

# v1.2.630-pdv-bipagem

Data: 14/10/2026. Branch: main. Tag: v1.2.630-pdv-bipagem.
Release MDV: /var/www/mdv-site/releases/20261014-225800-v1630-pdv-bipagem.

Após adicionar um produto comum ao carrinho, o PDV devolve o foco à busca e seleciona o código inteiro. A próxima bipagem substitui o anterior. Teste executa o handler existente com duas leituras, rejeição por estoque e confirmação obrigatória de IMEI. Publicação somente do site concluída: commit 9b5abaa1 e tag enviados a main; build e quatro guardas aprovados. VERSION.json e chunk atualizado confirmados em produção; PDV renderiza a busca. API saudável, sem reinício. Seis arquivos preexistentes e 35 worktrees bloqueadas preservados.

## Histórico anterior

# v1.2.629-entregas-painel

Data: 14/10/2026. Branch: main. Tag: v1.2.629-entregas-painel.
Release MDV: /var/www/mdv-site/releases/20261014-224700-v1629-entregas-painel.
Android Entregas permanece 1.1.5, versionCode 9.

Corrige ReferenceError na API do painel de entregas: o período continuava no retorno depois de sua definição ter sido removida. O aplicativo apresentava o erro como falha de conexão. Teste executa o handler completo para administrador e entregador, com cinco filtros, e reproduziu o erro antes da correção. Publicação corretiva concluída: commit 979078b4 e tag enviados, API seletiva e site publicados. 45 testes e build aprovados; painel autenticado respondeu HTTP 200 em Hoje, Todas e Mês, com resumo e responsáveis. Sem necessidade de reinstalar o APK.

## Histórico anterior

# v1.2.628-vendas-entregas

Data: 14/10/2026. Branch: main. Tag: v1.2.628-vendas-entregas.
Release MDV: /var/www/mdv-site/releases/20261014-223500-v1628-vendas-entregas.
Android Entregas: 1.1.5, versionCode 9, instalado no Realme RMX5011. Publicação concluída.

Vendas preservam produto, memória, cor e valor exatos; perguntas não consomem campos de cadastro/endereço e mensagens concorrentes exigem revisão e reprocessamento. Encaminhamento à equipe só é confirmado com evidência. Entregas usam o dia comercial de Petrolina nos filtros; conclusão exige saída prévia, preserva a data em repetições e protege avisos concorrentes/incertos. O app fecha os detalhes após a API confirmar a entrega e volta ao painel inicial. Base do painel 1.1.4 recuperada e preservada. Commit funcional 7cee11f2 e tag enviados a main. API seletiva, workflow/histórico e site publicados e conferidos; APK instalado e abertura verificada. 61 testes do bot, 39 de entregas, quatro do publicador e builds aprovados. Seis arquivos preexistentes e 35 worktrees bloqueadas preservados. Detalhes e limites na nota.

## Histórico anterior

# v1.2.627-gcode3d-domain

Data: 14/10/2026. Branch: main. Tag: v1.2.627-gcode3d-domain.
Release MDV: /var/www/mdv-site/releases/20261014-220100-gcode3d-domain-verified.
Release 3D: /var/www/print3d-site/releases/20261014-220101-gcode3d-domain-verified.

Delegação DNS liberada para carlos/jill Cloudflare. Certificado próprio emitido para gcode3d.com.br e www, com renovação automática. API seletiva e Nginx publicados; Cloudflare Completo (estrito) salvo e confirmado. Prévia administrativa passa a usar o endereço canônico retornado pelo servidor. Preserva manutenção pública, a entrega de agrupamento por modelo v1.2.626 e alterações preexistentes. Validação final registrada na nota.

## Histórico anterior

# v1.2.626-celular-modelo-unico

Data: 14/10/2026. Branch: main. Tag: v1.2.626-celular-modelo-unico.
Release MDV: /var/www/mdv-site/releases/20261014-203032-celular-modelo-unico.

WhatsApp agrupa smartphones pelo modelo vinculado, com configuracoes de memoria separadas e cores reunidas. API expoe model_name do cadastro atual. Nome Poco X8 Pro 5G padronizado no modelo, 13 produtos e textos publicos relacionados; sem alteracao de estoque, precos, SKU ou vinculos.

Replay offline da execucao 40580 passou: 107 produtos de entrada, duas entradas do mesmo Poco reduzidas a uma familia. Testes de memoria fisica, cores, preco, filtros, fallback, idempotencia, estado e guardas de publicacao aprovados. Publicacao seletiva da API altera apenas smartphoneModelSpecs.mjs; workflow muda somente Vendas - Contexto Produtos.

Site gerado isoladamente a partir da tag publicada v1.2.624-extrato-entrada-saida com a versao atual, para preservar a migracao gcode3d preparada e ainda pendente. Detalhes e evidencias na nota desta entrega.

Publicado: commit funcional 3c8d29d2/tag principal e commit de site bdbcb731/tag -site enviados. API somente modulo de nome canônico, workflow somente Contexto Produtos; readback/idempotencia, servicos e endpoints aprovados. Codigo publicado com dados reais gera um Poco X8 Pro 5G 8GB/256GB, quatro cores, R$ 2.660,00. Site isolado ativo e navegador validado. Pendencia legada de teste amplo do publicador e 35 worktrees bloqueadas detalhadas na nota; seis preexistentes preservados.

## Historico anterior e entrega pendente

# v1.2.625-gcode3d-domain — preparada, aguardando DNS

Data: 14/10/2026. Branch: main. Tag preparada: v1.2.625-gcode3d-domain-prepared.
Site principal/3D e API: corte público pendente. Produção permanece na entrega anterior até validação de DNS e HTTPS.

gcode3d.com.br registrado/pago e zona independente Free criada na Cloudflare; A raiz/www direto para VPS, sem CNAME para o domínio antigo. Nameservers carlos/jill salvos no Registro.br, em transição obrigatória de cerca de duas horas. Bootstrap ACME instalado sem alterar o site antigo. Canonical, links, prévia, ações de conta, sitemap e CORS atualizados nas fontes. Certificado próprio e novos vhosts preparados; 3dmv somente redirecionamento opcional no estado final. Onze testes, três guardas e builds principal/3D aprovados; bundles sem URLs antigas. Não cancelar o domínio antigo antes da validação final. Runbook e estado completo em docs/operacional/2026-10-14-gcode3d-domain-migration.md.

## Histórico anterior

# v1.2.624-extrato-entrada-saida

Data: 14/10/2026. Branch: main. Tag: v1.2.624-extrato-entrada-saida.
Release: /var/www/mdv-site/releases/20261014-181235-extrato-entrada-saida.

Extrato diferencia entradas em verde e saídas em vermelho, com setas e rótulos. Fotografia inicial, reservas e alterações sem movimento ficam neutras. Saldo por local não representa deslocamento físico do aparelho. Dezoito testes e build aprovados; publicação somente do site. Fechamento na nota da entrega.

## Histórico anterior

# v1.2.623-extrato-aparelhos

Data: 14/10/2026. Branch: main. Tag: v1.2.623-extrato-aparelhos.
Release: /var/www/mdv-site/releases/20261014-150101-extrato-aparelhos.

Diário passa a apresentar extrato resumido com data, aparelho, ocorrência e situação. Impressão e WhatsApp usam o resumo por padrão, com opção de incluir dados completos. Datas originais e fotografia da implantação distinguidas; saldos por local permanecem contexto do produto. Dezessete testes e build aprovados. Publicação somente do site concluída: commit ef821972 e tag em main, site/VERSION correspondentes, tabela e preparação do WhatsApp validadas no Chrome, sem erros. Seis arquivos preexistentes e 34 worktrees bloqueados preservados. Detalhes na nota da entrega.

## Histórico anterior

# v1.2.622-diario-aparelhos

Data: 14/10/2026. Branch: main. Tag: v1.2.622-diario-aparelhos.
Release: /var/www/mdv-site/releases/20261014-144155-diario-aparelhos.

Diário permanente por unidade física e atalho de histórico no card do produto, ao lado dos locais de estoque. Impressão e compartilhamento consultam todas as páginas; históricos longos geram TXT completo para anexar ao WhatsApp. Registros existentes identificados como fotografia da implantação, preservando a data original nos dados. Sem edição/exclusão na aplicação.

MySQL 8 real: eventos de cadastro, alteração, saída e remoção; rollback e proteção imutável aprovados em schema isolado. Clone do schema operacional validado, backup verificado e 20 triggers instalados com 244 registros iniciais e 162 referências existentes. Totais comerciais preservados. Publicação concluída: commit 1c8fcb2e e tag em main, API online/mysql saudável, site/VERSION correspondentes e atalho validado no Chrome autenticado. Dezenove testes, integração MySQL e build aprovados. Seis arquivos preexistentes e 34 worktrees bloqueados preservados. Detalhes na nota da entrega.

## Histórico anterior

# v1.2.621-estoque-finance-status

Data: 14/10/2026. Branch: main. Tag: v1.2.621-estoque-finance-status-r1.
Release: /var/www/mdv-site/releases/20261014-141311-estoque-finance-status.

Consultar distribuicao nao cria saldo ou movimentos. Materializacao explicita usa unidades disponiveis quando serializadas. Rota Finance registrada no runtime JS e modulo incluido no deploy. Status exige leitura operacional da sessao antes do envio; timeout apos POST fica incerto sem reenvio automatico. Recuperacao somente da sessao de Status autorizada. Sem ajuste de saldo ou instalacao do diario. Testes focados, build e sintaxe aprovados; fechamento na nota da entrega.

Publicacao concluida: commit98e0907a e tagr1 enviados a main. Site/VERSION publicos correspondentes; API online/mysql.ok=true, Finance privado200. Sessao Status recuperada apos sincronizacao e leitura funcional. 47 testes e build do checkout isolado aprovados. Cinco resultados incertos sem reenvio, saldos preservados. Limpeza removeu um checkout, arquivou um gerenciado e preservou34 bloqueados. Diario ainda local, sem migration.

## Historico anterior

# v1.2.620-catalogo-mensagem-familia

Data: 13/10/2026. Branch: main. Tag: v1.2.620-catalogo-mensagem-familia.
Release: /var/www/mdv-site/releases/20261013-201458-catalogo-mensagem-familia.

Copiar Mensagem e compartilhamento WhatsApp usam o agrupamento canonico dos cards do catalogo. Variacoes com nomes divergentes na mesma familia entram no mesmo bloco por memoria; nome do pai tem prioridade quando disponivel. Cadastros, precos e estoque preservados. Oito testes focados e build aprovados. Publicacao somente do site; API e 3DMV sem deploy.

Publicacao concluida: commit e567a782 e tag enviados a main, VERSION.json publico correspondente e homepage HTTP 200. Chrome confirmou copia com um bloco e quatro cores, sem erros no console. Auditoria removeu zero worktrees e preservou 34 bloqueadas, listadas na nota. Seis arquivos preexistentes fora do escopo.

## Historico anterior

# v1.2.619-tiktok-estoque-cancelamento

Data: 13/10/2026. Branch: main. Tag: v1.2.619-tiktok-estoque-cancelamento.
Release: /var/www/mdv-site/releases/20261013-152616-v1-2-619-tiktok-estoque-cancelamento.

Cancelamentos, devolucoes e reembolsos do TikTok agora identificam os SKUs do pedido e reaplicam no marketplace o estoque autoritativo do Mercado do Vale. Pedidos normais nao recebem reposicao. A correcao impede que uma unidade devolvida automaticamente pelo TikTok reapareca para venda quando o saldo local continua zerado.

O incidente TT370C foi confirmado sem escrita manual: estoque local e duas localizacoes em zero; pedido anterior cancelado; unidade restaurada no anuncio; nova venda em 11/10; Bling posteriormente informou saldo fisico -3. O TikTok ja esta novamente zerado. Teste focado e sintaxe dos servidores aprovados; publicacao e validacao final registradas na nota da entrega.

Publicacao concluida: commit funcional 204b0007 e tag enviados a main; API reiniciada e `online`, status HTTP 200 com MySQL saudavel. Site ativo na release registrada e `VERSION.json` publico correspondente. Auditoria removeu zero worktrees e preservou 34 bloqueadas; seis arquivos preexistentes de impressao/Shopee ficaram fora do escopo.

## Historico anterior

# v1.2.618-payjoy-conhecimento-pagamentos

Data: 12/10/2026. Branch: main. Tag: v1.2.618-payjoy-conhecimento-pagamentos.
Release: /var/www/mdv-site/releases/20261013-004529-v1-2-618-payjoy-conhecimento-pagamentos.

Conhecimento oficial PayJoy e regras do Mercado do Vale alimentam classificador e atendimento geral. Dúvidas sobre o link, incluindo como funciona, chegam à IA sem reiniciar a oferta. Lista de pagamentos com emojis inclui boleto via PayJoy e oferece o link da análise, mantendo consentimento. Prints, cálculo em centavos e pausa humana preservados.

Publicação concluída: commit funcional a2e2b6fb e tag enviados a main, workflow ativo e histórico alinhados, nove testes sobre leitura publicada e health/readiness 200. Site com release/VERSION correspondentes e catálogo real sem erro fatal. API e 3DMV sem deploy; mysql.ok=true. Limpeza: zero removidas, 34 bloqueadas preservadas e listadas na nota. Seis arquivos preexistentes fora do escopo.

## Historico anterior

# v1.2.617-n8n-segredo-removido

Data: 12/10/2026. Branch: main. Tag: v1.2.617-n8n-segredo-removido.
Release: /var/www/mdv-site/releases/20261012-234206-n8n-segredo-removido.

Configuracao sensivel MCP removida do Git, preservada localmente e ignorada. Exemplo sem chave, hook pre-commit e guarda no prebuild impedem nova inclusao de tokens n8n literais. Historico e revogacao da antiga conta Cloud permanecem pendentes.

## Historico anterior

# v1.2.616-payjoy-interpretacao-ia

Data: 12/10/2026. Branch: main. Tag: v1.2.616-payjoy-interpretacao-ia.
Release: /var/www/mdv-site/releases/20261012-222327-payjoy-interpretacao-ia.

PayJoy usa interpretacao contextual no classificador existente para aceitar respostas naturais como oi sim, sem repetir permissao. Recusas, duvidas, humano, resultados e entrada/prints preservados. Fluxo ja aplicado, historico alinhado e servicos saudaveis. Site recebe registro da versao; API e 3DMV sem deploy.

## Historico anterior

# v1.2.615-catalogo-familias-cores

Data: 12/10/2026. Branch: main. Tag: v1.2.615-catalogo-familias-cores.
Release: /var/www/mdv-site/releases/20261012-214845-catalogo-familias-cores.

Card publico usa a foto do pai sem cor selecionada e a foto da cor ao selecionar; segundo clique desmarca. Cor aparece apenas no seletor. Painel recebe resumo disponivel por memoria e lista de cores, com lapis em cada variacao. Previa local encaminha a sessao administrativa sem compartilhar autenticacao entre requisicoes.

Poco X8 e Poco C85 organizados em pais unicos; nome PC858256R corrigido para Poco C85. Historicos, precos e unidades preservados. Publicacao somente do site; sem deploy ou restart da API.

## Historico anterior

# v1.2.614-familia-note14s

Data: 12/10/2026. Branch: main. Tag: v1.2.614-familia-note14s.
Release: /var/www/mdv-site/releases/20261012-201156-familia-note14s.

Pai generico unico do Redmi Note 14S, quatro variacoes ativas e galeria coerente com a variacao selecionada.
15 unidades e historicos preservados; tres duplicados inativos. Pai com foto e video proprios, variações com mídias próprias. Sem restart da API.

## Historico anterior

# v1.2.613-modelos-midias-openai-payjoy

Data: 12/10/2026. Branch: main. Tag: v1.2.613-modelos-midias-openai-payjoy.
Release: /var/www/mdv-site/releases/20261012-193852-modelos-midias-openai-payjoy.

Midias do pai no modelo, custos oficiais OpenAI e aprovacao PayJoy com leitura de print e calculo da entrada.

API seletiva para financeiro; PayJoy ja ativo. Testes e build aprovados. Fechamento na nota da versao.

## Historico anterior

# v1.2.612-estoque-relatorio

Data: 12/10/2026. Branch: main. Tag: v1.2.612-estoque-relatorio.
Release MDV: /var/www/mdv-site/releases/20261012-163430-estoque-relatorio.

Gestao de Estoque recebe filtros responsivos, campos mais largos, resumo geral recolhivel e area de impressao com escolha explicita Sem valores / Com valores. Relatorio por categoria e subcategorias apresenta estoque disponivel, seriais, IMEI 1/2 e marcacao de conferencia; custos e venda a vista sao opcionais.

Consulta usa historico de unidades da VPS para status e quantidades serializadas, preserva legado e pagina todos os produtos. Compra usa custo da unidade com fallback ao produto; media ponderada por produto/variacao considera unidades disponiveis com custo informado. Venda usa preco efetivo de varejo com promocao ativa.

Testes focados, guardas do inventario, sintaxe e build aprovados. Layout verificado em desktop e celular sem transbordamento; filtro real Smartphones + Disponivel + estoque positivo encontra 53 produtos/variacoes. Deploy apenas do site; nenhuma gravacao de estoque, preco ou venda. Fechamento na nota da versao.

Publicacao concluida: commit funcional d0d2fc12 e tag enviados a main; release ativa e VERSION.json publico conferidos. Catalogo real renderizado sem erro fatal, login admin carregado e chunk de estoque com layout/relatorio correto. API saudavel, mysql.ok=true, sem restart. Auditoria e limpeza: 0 removidos, 34 bloqueados preservados e listados na nota; seis arquivos preexistentes fora do escopo. Evidencias em .local, logs no TEMP.

## Historico anterior

# v1.2.611-parcelamento-via-boleto

Data: 12/10/2026. Branch: main. Tag: v1.2.611-parcelamento-via-boleto.
Release MDV: /var/www/mdv-site/releases/20261012-154150-parcelamento-via-boleto.

Perguntas gerais de parcelamento apresentam cartao ate 12x e Via Boleto: financiamento de celulares PayJoy, com boleto ou Pix e condicoes conforme proposta apos analise. Oferta do link grava awaiting_link_confirmation; somente confirmacao envia o link e agenda analysis_check. Perguntas especificas sobre cartao preservam a resposta existente.

Patch restrito a Pagamento - Politica no workflow SkrkB4vyKVDnQ68t. Preserva confirmacao PayJoy, prioridade de usados, conexoes e demais nos. Publicacao reutiliza o mutador existente com --installment-options; backup, verificacao de drift, entidade/historico ativo e retomada dos servicos.

Validacoes: testes focados sobre export ativo, confirmacoes/negativas, URL oficial, limites da proposta, cartao especifico e isolamento; dry-run remoto e sintaxe dos entrypoints aprovados. Publicacao e verificacoes finais registradas na nota da entrega.

Site recebe a versao; API e site 3DMV sem deploy. Nenhuma mensagem de teste enviada ao cliente.

Publicacao concluida: commit funcional 0c0d5232 e tag enviados; workflow atualizado e alinhado, servicos 1/1 e healthz HTTP 200. Site ativo no release registrado, VERSION.json correto e catalogo real renderizado sem erro fatal. API saudavel, mysql.ok=true. Auditoria e limpeza: 0 removidos, 34 bloqueadas preservadas e detalhadas na nota; somente seis preexistentes fora do escopo.

## Historico anterior

# v1.2.610-custo-final-unidade

Data: 11/10/2026. Branch: main. Tag: v1.2.610-custo-final-unidade.
Release MDV: /var/www/mdv-site/releases/20261011-232624-custo-final-unidade.
Status: publicada e validada. Commit: 184122f1.

Resumo do cadastro 3D apresenta um unico campo destacado: Custo final por unidade. Usa minimumUnitSaleCents do calculador canonico, incluindo filamento, energia, maquina, mao de obra, insumos, custos fixos e imposto informado, rateados pelos produtos completos. Trata-se do minimo para cobrir custos e imposto, sem margem de lucro; o imposto e estimado sobre esse minimo. Nao altera preco de venda nem o custo de producao gravado no produto.

Detalhamento do calculo fica recolhido abaixo do campo. Quando existe tempo de impressao mas falta tarifa de energia ou potencia, mostra Aguardando energia, sem apresentar o parcial como custo final. Mostra a orientacao para completar o campo faltante; zero nao e substituido por tarifa inventada.

Escopo: componente do cadastro e protecao regressiva. Sem mudanca na API, dados, arquivos, formulas ou tarifas salvas.

Validacoes: 20 testes focados passaram, incluindo renderizacao real do editor com todos os custos, imposto zero/positivo e energia pendente. Previa local confirmou valor unitario R$ 0,54 para exemplo de 24 unidades, 3h48 e tarifa R$ 1,00/kWh. Build local aprovado. Build versionado e verificacao publica seguem no fechamento.

Arquivos da entrega:
- components/products/Print3dRegistrationEditor.tsx
- tmp-tests/print3d-registration.test.mjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.610-custo-final-unidade.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit de codigo: 184122f1. Tag v1.2.610-custo-final-unidade enviada ao origin; main sincronizada. Site ativo: /var/www/mdv-site/releases/20261011-232624-custo-final-unidade. API e site 3DMV nao publicados nem reiniciados.

20 testes focados aprovados antes da publicacao; build versionado e build oficial do deploy aprovados. Guardas de runtime sem Supabase e rotas aprovadas; nenhum rastro de Supabase no bundle. Home e novo cadastro HTTP 200; VERSION.json confere versao e release. API /status saudavel, mysql.ok=true.

Navegador autenticado confirmou o rascunho existente Mini Esqueleto, com tarifa R$ 1,00/kWh ja salva pelo operador: custo final R$ 0,54 por unidade para 24 produtos, incluindo imposto informado de 6%. Detalhamento confirmou R$ 11,96 de producao, R$ 0,77 de imposto e R$ 12,73 de lote. Remover a tarifa apenas no formulario temporario mostrou Aguardando energia; valor original restaurado e tela fechada sem salvar. Nao foram alterados registros, arquivos ou tarifas no banco. Evidencia: .local/publish-610-final-unit-cost.png.

Sem erro fatal de console; aviso preexistente de companyContext usa ID padrao VPS. Avisos de Browserslist e tempos de plugins nao impediram build. Helper de credenciais Git nao impediu push. Skill publish-vps seguida sem alterar seus arquivos. Logs temporarios removidos ao concluir; evidencia de producao e previa local mantidas.

Preexistentes preservados fora do commit: docs/print3d-production.md, scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria e limpeza obrigatorias: 0 candidatos, 0 removidos; 34 worktrees bloqueadas preservadas:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty

## Historico anterior

# v1.2.609-rascunhos-json

Data: 11/10/2026. Branch: main. Tag: v1.2.609-rascunhos-json.
Release MDV: /var/www/mdv-site/releases/20261011-231242-rascunhos-json.
Status: publicada e validada. Commit: e9241ac3.

Correcao da lista administrativa de rascunhos: mysql2 ja interpreta colunas do tipo JSON retornadas por JSON_EXTRACT. O endpoint tentava JSON.parse novamente sobre UUID, titulo e datas simples, causando HTTP 500. A consulta leve agora projeta os oito campos como CHAR, mantendo a serializacao JSON ate a unica decodificacao. Titulos parecidos com JSON preservam seu tipo e conteudo; revisao e flags preservam numero/booleano/null.

O teste antigo simulava somente strings JSON serializadas; o fixture agora reproduz a decodificacao automatica real do driver, e o teste novo falha antes da correcao. Inclui UUID, datas, titulos numericos, true, null, aspas, listas, Unicode e booleanos ausentes/falsos. Nao retorna snapshots na lista.

Publisher seletivo aceita a baseline revisada do modulo de rascunhos da release v1.2.607, a versao atual ou instalacao ausente. Rejeita drift desconhecido; preflight e repeticao testados. Preserva entrypoints remotos e integracoes, com backup, sintaxe, rollback e healthcheck pelo fluxo oficial.

Escopo: modulo autenticado de rascunhos e publisher; site atualizado para a versao. Nenhuma gravacao ou migration no banco, arquivo de rascunho ou flag de producao. Rascunhos existentes preservados.

Validacoes locais: 38 testes focados de rascunhos, publisher, familia e cadastro 3D; sintaxe dos servidores, modulo e publisher. Build e verificacao publica seguem no fechamento.

Arquivos da entrega:
- services/productFormDraftsServer.cjs
- scripts/deploy-product-registration.cjs
- tmp-tests/product-form-drafts.test.cjs
- tmp-tests/deploy-product-registration.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.609-rascunhos-json.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit: e9241ac3. Tag v1.2.609-rascunhos-json enviada ao origin; main sincronizada. Site ativo: /var/www/mdv-site/releases/20261011-231242-rascunhos-json. Site 3DMV preservado.

API publicada seletivamente: somente services/productFormDraftsServer.cjs mudou no runtime. mdv-api reiniciada com healthcheck aprovado. Backup: /var/www/mdv-api/backups/product-form-drafts-1791760478300. Nenhum entrypoint remoto, migration, flag, banco ou arquivo privado alterado. API /status HTTP 200 com mysql.ok=true; lista anonima HTTP 401.

Lista autenticada foi conferida antes com o erro 500 e depois com o rascunho existente disponivel para continuar. Novo reload confirmou versao 609, card Mini Esqueleto com a mesma data de atualizacao e nenhum erro ou aviso de console. Sem salvar, arquivar ou excluir registros. Evidencia: .local/publish-609-drafts.png.

38 testes focados passaram; testes novos reproduziram falha antes do ajuste. Sintaxe, preflight seletivo, build local e build do deploy aprovados. Home HTTP 200 e VERSION.json correspondente. Guardas de runtime sem Supabase e rotas aprovadas; nenhum rastro de Supabase no bundle. Avisos conhecidos: Browserslist e tempos de plugins sem falha; helper de credenciais Git nao impediu push.

Autoajuste operacional aplicado no publisher do repositorio e seu teste: baseline revisada para atualizar modulo existente sem sobrescrever drift. Skill publish-vps executada sem modificar seus arquivos. Temporarios de build/deploy/auditoria removidos ao concluir; evidencia mantida.

Preexistentes preservados: docs/print3d-production.md, scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria e limpeza obrigatorias: 0 candidatos, 0 removidos; 34 worktrees bloqueadas preservadas:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty

## Historico anterior

# v1.2.608-cadastro-3d-menus

Data: 11/10/2026. Branch: main. Tag: v1.2.608-cadastro-3d-menus.
Release MDV: /var/www/mdv-site/releases/20261011-230349-cadastro-3d-menus.
Status: publicada e validada em producao. Commit da release: de0753ee.

Cadastro 3D: impressoras sugeridas com Bambu Lab A1 preenchida, filamentos com amostras de cor e inclusao de novos IDs cadastrados, duracoes HH:MM inclusive acima de 24h, insumos editaveis por lote, custos fixos, imposto estimado e energia. A referencia editavel da A1 e 95 W medios para PLA em 220 V, conforme https://wiki.bambulab.com/en/a1/manual/faq. Consumo em kWh = W / 1000 x horas; custo usa a tarifa informada. Custos e consumos salvos continuam preservados. Copia do pai permanece independente.

Peso em kg com preenchimento de tres casas decimais ao digitar. Menus de produtos agrupados em Cadastro, Sites e vendas, Midia e impressao; abas do formulario em grade responsiva sem rolagem horizontal.

Catalogo solicita produtos compactos e invalida o cache anterior, mantendo informacoes comerciais dos cartoes. No preview local, filamentos centrais e pendentes sao combinados por ID sem alterar registros ou aprovacoes; esse servico e exclusivo do ambiente local.

Escopo: frontend/painel MDV e servico de preview local versionado. API e site 3DMV preservados; nenhum deploy de API, migration ou alteracao de flags.

Validacoes: 80 testes focados (cadastro, custos, rascunhos, familia, filamentos, medidas, menus e catalogo), suite money, sintaxe de localPrint3dFilaments.cjs e servidores existentes. Build e validacao de producao seguem no fechamento.

Arquivos da entrega:
- components/products/Print3dProductEntry.tsx
- components/products/Print3dRegistrationEditor.tsx
- components/products/ProductForm.tsx
- components/products/sections/ProductSpecifications.tsx
- pages/admin/products/ProductListPage.tsx
- services/catalogSectionsService.ts
- services/localPrint3dFilaments.cjs
- services/print3dRegistration.ts
- tmp-tests/catalog-public-image-fallback-static.test.mjs
- tmp-tests/catalog-public-regressions-static.test.mjs
- tmp-tests/catalog-sections-cache-validity.test.cjs
- tmp-tests/local-print3d-filaments.test.cjs
- tmp-tests/print3d-measurements.test.cjs
- tmp-tests/print3d-product-entry.test.cjs
- tmp-tests/print3d-product-specifications-render.test.cjs
- tmp-tests/print3d-registration.test.mjs
- tmp-tests/product-create-feedback.test.cjs
- tmp-tests/product-list-actions.test.cjs
- utils/print3dMeasurements.js
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.608-cadastro-3d-menus.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit de codigo: de0753ee. Tag v1.2.608-cadastro-3d-menus enviada ao origin; main sincronizada. Release ativa: /var/www/mdv-site/releases/20261011-230349-cadastro-3d-menus. Site 3DMV preservado.

80 testes focados e suite money aprovados; build de validacao e build oficial do deploy aprovados. Guardas de runtime sem Supabase e rotas Nginx aprovadas; bundle sem dependencia Supabase. Home, produtos e novo cadastro 3D HTTP 200; VERSION.json confere a versao e release. API nao publicada nem reiniciada; /status HTTP 200 com mysql.ok=true.

Navegador integrado autenticado confirmou catalogo com produtos reais, os tres grupos do menu, grade de abas com scrollWidth=clientWidth=927, A1 preenchida, 95 W, duracoes HH:MM, energia, imposto e insumos. Lista de filamentos de producao mostrou os sete cadastrados com cores. Sem erros de console; aviso preexistente de companyContext usa ID padrao VPS. Nao foram gravados produtos, rascunhos ou uploads de teste.

Avisos conhecidos: Browserslist desatualizado e tempos de plugins, sem falha no build. Helper local de credenciais Git nao impediu push. Skill publish-vps executada sem alteracao. Evidencias mantidas em .local/publish-608-production.png e .local/publish-608-parameters.png. Logs temporarios desta publicacao removidos ao concluir.

Preexistentes preservados fora do commit: docs/print3d-production.md, scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria e limpeza obrigatorias: 0 candidatos, 0 removidos; 34 worktrees bloqueadas preservadas:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty


## Historico anterior

# v1.2.607-rascunhos-placas-precos

Data: 11/10/2026. Branch: main. Tag: v1.2.607-rascunhos-placas-precos.
Release MDV: /var/www/mdv-site/releases/20261011-214056-rascunhos-placas-precos.
Status: publicada e validada em producao. Commit da release: 3b0d49bc.

Rascunhos compartilhados do cadastro incompleto de produtos, com lista para continuar em qualquer computador e controle de revisao contra sobrescrita concorrente. Salvar rascunho preserva formulario, variacoes, arquivos e parametros sem criar produto ou estoque. Concluir e arquivar preservam o registro privado.

Cadastro 3D com Arquivos e URL, Parametros e placas e Precos. Custo por produto completo vem do calculo canonico, em centavos. O operador informa os precos de venda. Copiar a base privada do pai cria configuracoes independentes nos filhos, preservadas inclusive na edicao detalhada da variacao. Variacoes continuam na ultima etapa e a familia e salva junta.

API seletiva: modulo de rascunhos e gancho autenticado nos entrypoints remotos, com backup, verificacao de sintaxe, rollback e healthcheck. Sem migrations nem mudancas nas flags de producao 3D. JSON usa admin_preferences existente; arquivos privados em /var/www/mdv-api/private/product-form-drafts. O backup integral existente da API inclui essa pasta e o backup MySQL inclui admin_preferences. Deploys preservam o diretorio.

Escopo: painel/site MDV e API. Site 3DMV e trabalhos preexistentes de Shopee e documentacao/fixture nao entram nesta publicacao.

Validacoes locais: 37 testes focados, suite money, sintaxe dos servidores, diff sem erros. Build e verificacao publica seguem no registro de fechamento abaixo.

Arquivos da entrega:
- components/products/Print3dRegistrationEditor.tsx
- components/products/ProductFamilyEditor.tsx
- components/products/ProductForm.tsx
- components/products/sections/ProductPricing.tsx
- deploy-vps-server-only.cjs
- docs/operacional/rascunhos-cadastro-produtos.md
- docs/print3d-production.md
- infra/nginx/mdv-site-production.conf
- infra/nginx/mdv-site-staging.conf
- layouts/AdminLayout.tsx
- pages/admin/products/ProductDraftsPage.tsx
- pages/admin/products/ProductFormPage.tsx
- pages/admin/products/ProductListPage.tsx
- routes/index.tsx
- scripts/deploy-product-registration.cjs
- services/print3dRegistration.ts
- services/productFormDrafts.ts
- services/productFormDraftsServer.cjs
- tmp-tests/deploy-product-registration.test.cjs
- tmp-tests/family-registration.test.mjs
- tmp-tests/print3d-registration.test.mjs
- tmp-tests/product-create-feedback.test.cjs
- tmp-tests/product-form-drafts.test.cjs
- tmp-tests/product-form-serialized-units-static.test.mjs
- vps_server.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.607-rascunhos-placas-precos.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit da release: 3b0d49bc. Tag v1.2.607-rascunhos-placas-precos enviada ao origin; main sincronizada.

API seletiva reiniciada; backup de recuperacao: /var/www/mdv-api/backups/product-form-drafts-1791755040721. Status HTTP 200 com mysql.ok=true; rascunhos anonimos HTTP 401. Nenhuma migration ou flag alterada. Site completo publicado na release acima; home e lista de rascunhos HTTP 200, VERSION.json confere. As rotas Nginx ativas ja abrangem /admin/products/drafts pelo padrao de produtos; nao foi necessario recarregar Nginx.

Chrome autenticado conferiu lista de rascunhos sem falhas, abas Arquivos e URL, Parametros e placas, Precos e Variacoes por ultimo, base do pai e arquivos por placa. Sem gravar produtos, rascunhos ou uploads de teste em producao. Edicao independente, custos e retomada com arquivos foram verificados localmente. Sem erro de console; aviso preexistente de companyContext usa ID padrao VPS. Build: aviso Browserslist desatualizado, sem falha; guardas de runtime/editor aprovadas. Aviso local do helper de credenciais Git nao impediu push do commit/tag. Publicacao executada pela skill publish-vps; sem atualizacao da skill.

Temporarios de build/deploy/auditoria removidos; evidencia de tela mantida em .local/publish-607-production.png. Alteracoes preexistentes preservadas: docs/print3d-production.md (somente os novos paragrafos desta entrega foram stageados), scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria obrigatoria: 0 candidatos, 0 removidos e 34 worktrees bloqueadas preservadas:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty

## Historico

# v1.2.606-variacoes-ultima-etapa

Data: 11/10/2026. Branch: main. Tag: v1.2.606-variacoes-ultima-etapa.
Release MDV: /var/www/mdv-site/releases/20261011-204442-variacoes-ultima-etapa.
Status: publicada e validada em produção. Commit da release: a922f922.

Variações como última aba, depois do cadastro completo do pai e dos dados fiscais. Fotos, descrição e canais do pai vêm antes. Os arquivos de produção dos filhos ficam junto das variações. O botão Salvar família e variações mantém o salvamento conjunto existente, sem exigir cadastro prévio do pai. Produtos simples e filhos avulsos mantêm suas abas de produção, estoque e preços.

Seletor de cores dos produtos filtrável, com amostra antes do nome tanto na lista como na seleção. RGB personalizado e quadriculado das cores translúcidas preservados. O campo continua gravando o nome cadastrado; atualização com falha mantém a lista anterior e permite nova tentativa. Clique no campo ainda focado reabre as opções.

Publicação exclusiva do painel/site MDV. API, dados comerciais e site 3DMV permanecem na release anterior. Seis arquivos preexistentes de Shopee/documentação/fixture ficam fora do escopo.

Validações: 45 testes focados aprovados, incluindo navegação do pai com/sem 3D, filhos avulsos, salvamento/retry da família, amostras de cores, teclado e atualização. 45 testes e build aprovados, com guardas de Supabase e do editor alcançável. Site e cadastro HTTP 200, VERSION.json correspondente à release, API saudável com mysql.ok=true sem reinício. Chrome autenticado confirmou a última aba e as amostras reais das cores, sem salvar produtos ou arquivos e sem erros de console. Aviso preexistente de contexto da empresa usa o ID padrão VPS. Browserslist desatualizado é aviso do build. Main sincronizada; seis alterações preexistentes fora do escopo preservadas. Auditoria: zero resíduos removidos e 34 worktrees bloqueadas preservadas, listadas na nota desta versão. Nenhuma mudança na skill foi necessária.

Arquivos da entrega:
- components/products/ProductForm.tsx
- components/products/selectors/ColorSelect.tsx
- components/ui/SearchableSelect.tsx
- tmp-tests/filament-color-select.test.mjs
- tmp-tests/product-create-feedback.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.606-variacoes-ultima-etapa.md

## Histórico

# v1.2.605-cadastro-variacoes

Data: 11/10/2026. Branch: main. Tag: v1.2.605-cadastro-variacoes.
Release MDV: /var/www/mdv-site/releases/20261011-195330-cadastro-variacoes.
Release 3DMV: /var/www/print3d-site/releases/20261011-195330-cadastro-variacoes.
Status: publicada e validada em producao. Commit da release: 9b28cdde.

Cadastro de familias e variacoes na mesma tela: atributos, SKU complementar imutavel, EAN proprio, fotos/video com envio ao Synology e campos individuais ou herdados. Capa do pai com fallback de filho para familias antigas. Descricao HTML resolvida pela API nos dois sites, preservando o valor original no editor.

Fichas privadas por SKU/revisao, lote com varias placas, consumo e tempo por placa, custos em centavos, anexos e link de origem. Ativacao autorizada apenas de MDV_PRINT3D_RECIPES_ENABLED; pedidos, pagamentos e producao automatica permanecem desligados. Schema existente, sem migration ou gravacao comercial de teste.

171 testes focados/regressivos e guardas aprovados, alem de money e filtro admin TypeScript. Builds isolados, deploy seletivo, status autenticados e Chrome de producao conferidos. Ambos VERSION.json correspondem a esta release; API com mysql.ok=true. Defesa adicional exige o editor de variacoes no bundle realmente alcancavel. Alteracoes Shopee e documento/fixture preexistentes fora do escopo.

Fichas e arquivos privados habilitados; acesso anonimo retorna 401. Editor conferido com tres placas para dez produtos, sem salvar dados de teste. Upload real ao NAS nao executado nesta validacao. Checkout temporario limpo removido, recuperavel pelo commit; 34 worktrees bloqueados preservados. Main sincronizada com origin/main, com seis arquivos preexistentes fora do escopo mantidos.

Detalhes: docs/versoes/2026-10-11-v1.2.605-cadastro-variacoes.md.

## Historico

# v1.2.604-filamentos-amostras

Data: 11/10/2026. Branch: main. Tag: v1.2.604-filamentos-amostras.
Release: /var/www/mdv-site/releases/20261011-162111-filamentos-amostras.
Status: publicada e validada em producao. Commit da release: 387811d9.

Amostras antes dos nomes no seletor filtravel de cores dos filamentos, na lista e no valor selecionado. Cor simples e degrade de duas ou tres cores usam a mesma lista cadastrada e os tons personalizados. Contratos de estoque e custos preservados.

Publicacao exclusiva do painel/site MDV, com build isolado; sem API, migration, gravacao comercial ou aprovacao de rascunhos. Detalhes: docs/versoes/2026-10-11-v1.2.604-filamentos-amostras.md.

28 testes aprovados, build isolado e Chrome de producao conferidos. Checkout temporario removido; 76 alteracoes preexistentes e 34 worktrees bloqueados preservados.

## Historico

# v1.2.603-cores-translucidas

Data: 11/10/2026. Branch: main. Tag: v1.2.603-cores-translucidas.
Release: /var/www/mdv-site/releases/20261011-160009-cores-translucidas.
Status: publicada e validada. Commit/tag da release: 8f7b8864 / v1.2.603-cores-translucidas.

13 sugestoes de cores translucidas na paleta compartilhada, com amostra quadriculada. Hexadecimal do cadastro tem prioridade; tons personalizados e registros antigos preservados. Azul e Azul Translucido continuam identidades distintas no estoque. Sugestoes exigem cadastro explicito e nao geram registros automaticamente. Atualizacao de cores ignora cache antigo sem apagar a lista em caso de falha.

Publicacao exclusiva do painel/site MDV, sem API, migration, aprovacao de rascunhos ou gravacao comercial. Build isolado para nao incluir os outros trabalhos locais. Detalhes: docs/versoes/2026-10-11-v1.2.603-cores-translucidas.md.

28 testes e build isolado aprovados. Home/painel HTTP 200, VERSION.json correspondente e API com mysql.ok=true. Chrome autenticado confirmou as 13 sugestoes, Azul Translucido e tons personalizados, sem salvar testes ou erros de console. Checkout de publicacao removido; 34 worktrees antigas bloqueadas preservadas. Main sincronizada; 76 alteracoes preexistentes fora do escopo mantidas.

## Historico

# v1.2.602-filamentos-degrade

Data: 11/10/2026. Branch: main. Tag: v1.2.602-filamentos-degrade.
Release: /var/www/mdv-site/releases/20261011-153123-filamentos-degrade.
Status: publicada e validada. Commit/tag da release: 073abe71 / v1.2.602-filamentos-degrade.

Marca digitavel/filtrante e degrade de duas ou tres cores registradas lado a lado. Custo e estoque pertencem a combinacao completa; registros antigos preservados. Deploy seletivo de dois modulos da API antes do painel. Nenhum novo schema, ativacao da producao 3D ou aprovacao de rascunhos. Alteracoes preexistentes de produtos permanecem fora do escopo.

Detalhes: docs/versoes/2026-10-11-v1.2.602-filamentos-degrade.md.

36 testes e build isolado aprovados. API seletiva reiniciada, mysql.ok=true, estoque e movimentos intactos (hash conferido), sem migration ou aprovacao de rascunhos. Home/painel HTTP 200 e VERSION.json correspondente. Chrome autenticado confirmou marca filtrante, tres cores na mesma linha e amostra degrade, sem salvar teste e sem erros. Worktree temporaria desregistrada e junction removida; exclusao dos residuos fisicos bloqueada pela politica do ambiente. 34 antigas bloqueadas preservadas. Main sincronizada; alteracoes preexistentes fora do escopo.

## Historico

# v1.2.601-filamentos-estoque

Data: 11/10/2026. Branch: main. Tag: v1.2.601-filamentos-estoque.
Release MDV: /var/www/mdv-site/releases/20261011-120000-filamentos-estoque.
Status: publicada e validada em produção. Commit/tag da release: 9307703f / v1.2.601-filamentos-estoque.

Página própria Filamentos e estoque: marca/material/cor compartilhados, custo por kg, entrada com quantidade em kg, data e canal de compra; controles compactos −/+, cores sempre visíveis, baixa Usado e Desativar retirando o saldo. Resumo agrupado por material + cor entre marcas. Ledger preservado e reenvios idempotentes. Rascunhos locais só são enviados por aprovação explícita.

Migração 054 aditiva autorizada com backup e conferência de integridade. Flag MDV_PRINT3D_FILAMENT_STOCK_ENABLED independente; módulo completo de produção 3D permanece desligado. Publicação seletiva da API e build isolado, sem incluir as mudanças preexistentes de produtos, placas e Shopee.

49 testes aprovados (26 focados e 23 de estoque/produção existente), build do commit isolado, API online/mysql.ok=true, rota sem sessão 401, homepage e painel HTTP 200 e VERSION.json correto. Chrome confirmou listas reais, amostra da cor, entrada acima de 1 kg e campos data/canal, sem salvar cadastro de teste e sem erros de console. Backup SQL/env: /var/www/mdv-api/backups/print3d-filaments-1791730518173; backup código: /var/www/mdv-api/backups/print3d-filaments-code-1791730537723. Nginx recebeu somente a rota nova, com backup e nginx -t aprovado. Rascunhos não enviados. Auditoria removeu a worktree limpa desta publicação e preservou 34 antigas bloqueadas, listadas no registro da versão. Main sincronizada; mudanças preexistentes preservadas.

## Histórico

# v1.2.600-sku-nome-automatico

Data: 10/10/2026. Branch: main. Tag: v1.2.600-sku-nome-automatico.
Release MDV: /var/www/mdv-site/releases/20261010-211100-sku-nome-automatico.
Release 3DMV: /var/www/print3d-site/releases/20261010-211100-sku-nome-automatico.
Status: publicada e validada em produção. Commit da release: da63f435.

SKU automático para novos cadastros com campo vazio: quatro letras reconhecíveis e quatro números sequenciais por prefixo. Nome persistido em texto simples, por exemplo Vaso decorativo - VASO0003. Reserva de SKU na mesma conexão da transação; SKUs existentes e manuais preservados. Preview consulta o catálogo e os rascunhos locais, sem publicar ao salvar; aprovação recusada mantém o rascunho. Deploy API seletivo com backup, preservando drift remoto. 44 testes e guardas Bling/PDV aprovados. Quatro arquivos Shopee preexistentes fora do escopo.

Ambos os sites ativos com VERSION.json correto e HTTP 200; painel de cadastro renderizado no Chrome sem erros de console. API server.js online, mysql.ok=true; hash do módulo SKU instalado igual ao local e execução isolada confirmou nome/SKU sem gravação comercial. Backup API: /var/www/mdv-api/backups/product-auto-sku-1791677437608. Manutenção pública 3DMV preservada. Auditoria final: nenhum resíduo removido; 34 worktrees bloqueados preservados e listados no registro da versão. Main sincronizada com origin/main; somente as quatro alterações Shopee preexistentes permanecem.

## Histórico

# v1.2.599-medidas-3d-mm

Data: 10/10/2026. Branch: main. Tag: v1.2.599-medidas-3d-mm.
Release MDV: /var/www/mdv-site/releases/20261010-235533-medidas-3d-mm.
Release 3DMV: /var/www/print3d-site/releases/20261010-235533-medidas-3d-mm.
Status: publicada e validada em produção. Commit da release: b4f6faaa.

Altura, largura e profundidade em mm na aba Características e nos anúncios dos dois sites. Um único conjunto de medidas: dimensions em cm no contrato interno, convertido na interface; peso em kg. API pública envia as medidas existentes, sem duplicar campos ou alterar descrição do pai. Preview conserva rascunhos locais até aprovação. 40 testes e dois builds aprovados. Releases MDV e 3DMV ativas; ambos os domínios respondem 200 com VERSION.json correto. Dois módulos da API publicados seletivamente com backup; mdv-api online e mysql.ok=true. Navegador confirmou os quatro campos e prévia 35/20/12 mm sem salvar produto. Manutenção pública 3DMV mantida. Quatro arquivos Shopee preexistentes preservados. Auditoria: zero removidos, 34 bloqueados preservados (lista no registro desta versão).

## Histórico

# v1.2.598-atalho-categoria

Data: 10/10/2026. Branch: main. Tag: v1.2.598-atalho-categoria.
Release: /var/www/mdv-site/releases/20261010-233645-atalho-categoria.
Status: publicada e validada em produção. Commit da release: 9332d9ec.

Atalho + de categoria abre a página completa Nova Categoria em outra aba, preservando o produto em preenchimento. Removido o cadastro rápido antigo com formulário aninhado. Atualizar lista ignora cache; hierarquia e IDs preservados. Sete testes e build aprovados, homepage HTTP 200 e VERSION.json correto. Navegador confirmou clique, nova aba, nome/categoria preservados e ausência de erros de console. API não reiniciada; status saudável/mysql.ok=true. Nenhum produto ou categoria salvo. Quatro arquivos Shopee preexistentes fora da release. Auditoria: zero removidos, 34 bloqueados preservados (lista no registro desta versão).

## Histórico

# v1.2.597-materiais-3d

Data: 10/10/2026. Branch: main. Tag: v1.2.597-materiais-3d.
Release: /var/www/mdv-site/releases/20261010-232931-materiais-3d.
Status: publicada e validada em produção. Commit da release: a1647a47.

Cadastro compartilhado de 15 tipos de material e novas inclusões no campo Material. Nova rota /admin/print3d/material-types separada da rota existente /admin/print3d/materials (estoque de filamentos). Teste registra ambos os módulos Fastify juntos para impedir duplicidade de rota. Nenhum produto, SKU, preço ou estoque alterado.

24 testes aprovados (17 focados + 7 de produção existente), build sem runtime Supabase, homepage HTTP 200 e VERSION.json correto. API seletiva reiniciada; /status ok=true/mysql.ok=true e rota sem sessão retorna 401. Chrome confirmou 15 opções, seleção PLA e modal Novo material sem erros de console; nenhum produto ou material de teste salvo. Backup API: /var/www/mdv-api/backups/print3d-materials-1791675025682. Main sincronizada; quatro arquivos Shopee preexistentes preservados. Auditoria: zero removidos, 34 worktrees bloqueados preservados. Skill publish-vps atualizada com a lição de conflitos entre registradores de rota e validada.

## Histórico

# v1.2.596-materiais-3d

Data: 10/10/2026. Branch: main. Tag: v1.2.596-materiais-3d.
Release: /var/www/mdv-site/releases/20261010-232309-materiais-3d.
Status: substituída pela v1.2.597; API restaurada do backup após detectar conflito de rota.

Material nos produtos 3D passa a ser selecionável, com 15 tipos conhecidos e cadastro compartilhado de novos materiais. Fonte de verdade: API/MySQL em admin_preferences; valores legados preservados. Sem migration, alteração de SKU, estoque, preços ou produtos reais. API seletiva com backup, verificações de sintaxe e preservação de código remoto.

Validações: 16 testes focados; sintaxe dos servidores e preflight seletivo aprovados. Alterações Shopee preexistentes fora da release.

## Histórico

# v1.2.595-categorias-hierarquia

Data: 10/10/2026. Branch: main. Tag: v1.2.595-categorias-hierarquia.
Release: /var/www/mdv-site/releases/20261010-231129-categorias-hierarquia.
Status: publicada e validada em produção. Commit da release: a42fd9db.

Seletor de categoria no cadastro de produtos mostra grupos de categorias e subcategorias com caminho completo. A hierarquia vem de parent_id da API, sem alterar categorias, vínculos ou SKUs. Ordem cadastrada preservada. Relações legadas inválidas não escondem opções.

Validações: cinco testes de hierarquia, seis testes da entrada Produto 3D e build. Homepage HTTP 200, VERSION.json correto e API saudável com mysql.ok=true. Navegador confirmou 17 grupos, subcategorias em múltiplos níveis e seleção por ID preservado. Deploy apenas do painel, sem reiniciar API. Mudanças Shopee preexistentes fora do escopo. Auditoria: nenhum worktree removido; 34 bloqueados preservados.

## Histórico

# v1.2.594-produto-3d-entry

Data: 10/10/2026. Branch: main. Tag: v1.2.594-produto-3d-entry.
Release: /var/www/mdv-site/releases/20261010-230200-v12594-produto-3d-entry.
Status: publicada e validada em produção. Commit da release: 81e7b318.

Botão Produto 3D na lista central abre novo cadastro já marcado ou pesquisa o SKU existente para conferência. O cadastro central continua responsável pelo SKU. Após salvar uma variante vendável, o operador segue para ficha e arquivos; produtos pai seguem para suas variações. No localhost, a edição existente mantém o rascunho local.

Validação: seis testes de fluxo; sintaxe dos servidores; build sem runtime Supabase; homepage HTTP 200 e VERSION.json correto; API saudável com mysql.ok=true. Navegador confirmou cadastro novo com impressão 3D marcada e abertura do SKU SFKU3XMVB sem mudar seu identificador. Publicação somente do painel, sem reinício da API ou alteração de produtos reais. Auditoria: zero worktrees removidos, 34 bloqueados preservados (lista no registro desta versão). Alterações Shopee preexistentes preservadas fora da release.

## Histórico

# v1.2.593-phone-brands-dynamic

Data: 09/10/2026. Branch: main. Tag: v1.2.593-phone-brands-dynamic.
Release: /var/www/mdv-site/releases/20261009-203847-phone-brands-dynamic.
Status: publicada e validada em producao.

Gerador passa a oferecer Todas as marcas (automatico) e Marcas especificas a partir dos celulares elegiveis consultados na mesma fonte de estoque/precos. Receita automatica e preservada nas futuras geracoes; receitas legadas continuam especificas ate reparo explicito. Ocultos, pais, combos, vendidos e acessorios continuam excluidos. Bot com selecao explicita e calculos de preco permanecem compativeis.

Reparo autorizado: somente 22 ocorrencias futuras ainda nao geradas/iniciadas nos dois agendamentos conferidos; altera apenas recipe, com backup restrito, transacao e releitura. Horarios, canais e itens ja enviados preservados. Dry-run executado.

Validacao: 33 testes passaram e 1 opcional ignorado; guardas do calendario e sintaxe dos tres servidores passaram. Deploy API seletivo --dynamic-price-tables-only preserva personalizacoes remotas e recusa divergencia da baseline.

Quatro arquivos Shopee preexistentes fora do escopo.

Publicacao concluida: commit b3ac4c17 e tag enviados a main. API seletiva reiniciada e online; /status HTTP 200/mysql.ok=true. Site e VERSION.json HTTP 200. Preview autenticado real: 24 configuracoes, quatro marcas e quatro tabelas, incluindo Oukitel. Chrome apos reload sem cache renderizou catalogo real, complemento e Ver todos, sem erros de console.

22 ocorrencias futuras nos dois agendamentos conferidos foram alteradas transacionalmente para Todas as marcas. Releitura validada por ocorrencia; segunda execucao em dry-run encontrou zero legadas restantes. Nenhuma publicacao reenviada. Backup receitas: /var/www/mdv-api/backups/phone-brands-recipes-1791578537569.json. Backup API: /var/www/mdv-api/backups/phone-price-list-1791578481069.

Auditoria apply: 0 removidos; 34 bloqueados preservados.

## Historico

# v1.2.592-n8n-memoria

Data: 09/10/2026. Branch: main. Tag: v1.2.592-n8n-memoria.
Release: /var/www/mdv-site/releases/20261009-201153-n8n-memoria.
Status: publicada e validada em producao.

Rotas company-settings existentes recebem modo optativo view=bot com projecao SQL de horarios, endereco e Pix; nao leem imagens/templates/credenciais de integracao nesse modo. Modo padrao continua igual e sanitizacao publica permanece obrigatoria. Quatro chamadas do workflow ativo passam ao modo enxuto; conexoes, conversas e politicas preservadas. Heap do processo principal n8n passa de aproximadamente 4 GB para 6 GB mantendo os outros argumentos e limite de concorrencia 10/pool 10.

Publicacao concluida: b2632b14, 7f9dfcd0 e 4c740f6f enviados a main, com tag da versao e tag de guardas. Site e VERSION.json HTTP 200; API seletiva reiniciada, status ok=true/mysql.ok=true. Respostas reais privadas/publicas caem de 690552/346014 bytes para 1366/1396 bytes, com valores projetados iguais e auth 401 preservada. Quatro consultas do fluxo ativo atualizadas; main/runner 1/1, health/readiness 200, heap efetivo 6240 MiB. Seis execucoes naturais bem-sucedidas e zero erros fatais de memoria no intervalo inicial de 17:25:35 a 17:27:53. Causa exata do crescimento de memoria ainda nao isolada; validacao curta nao comprova estabilidade prolongada.

Testes de rotas, patch/CAS, replicas exatas, configuracoes de retirada e estoque, sintaxe, schema real e build passaram. Backups restritos com checksums validados; nenhuma conversa reexecutada. Primeira tentativa encontrou espera falsa por nomes semelhantes de servicos; bot restaurado antes da reaplicacao, sem escrita de workflow naquela tentativa. Auditoria apply preservou 34 worktrees bloqueados e removeu zero; quatro arquivos Shopee preexistentes fora do escopo. Runbooks n8n/publicacao atualizados e validados. Detalhes e todos os caminhos em docs/versoes/2026-10-09-v1.2.592-n8n-memoria.md.

## Release anterior: v1.2.591-bling-refresh-safe

Data: 09/10/2026. Branch: main. Tag: v1.2.591-bling-refresh-safe.
Release: /var/www/mdv-site/releases/20261009-193318-bling-refresh-safe.

Renovacao da API nao devolve token antigo apos falha HTTP/configuracao ou resposta invalida. Credenciais preservadas em erro; novo token usado apenas apos salvar. Deploy seletivo altera somente refreshBlingStoredAccessTokenVps e preserva outras customizacoes remotas.

Publicacao concluida: 413a0156 e tag enviados a main. 122 testes passaram; build e sintaxe API validados. API publicada seletivamente com backup e restart; status ok=true/mysql.ok=true. Site e VERSION.json HTTP 200. Handler remoto corresponde ao local e rejeita 503 simulado. Chrome confirmou catalogo real/complemento/Ver todos; 401 limitado a auth/me sem sessao. Sem renovacao real forcada. Auditoria apply: 0 removidos, 34 bloqueados preservados, listados na nota da versao. Quatro arquivos Shopee preexistentes preservados.

## Historico

# v1.2.590-operational-failures

Data: 09/10/2026. Branch: main. Tag: v1.2.590-operational-failures.
Release: /var/www/mdv-site/releases/20261009-185649-operational-failures.

PDV propaga falhas de consulta das unidades e limpa resultados anteriores. Confirmacao por foto exige salvamento bem-sucedido. Lista de campanhas WhatsApp carrega todas as paginas de 200 registros. Somente frontend; nenhum dado comercial alterado. Testes de falha reproduzidos antes da correcao e passando depois.

Publicacao concluida: fd7240bf e tag enviados a main; 79 testes centrais, suites de familias, precos, pagamentos e estoque passaram. Build sem runtime Supabase. Site e versao HTTP 200, API saudavel sem restart. Chrome confirmou PDV/busca, cadastro por foto, marketing, complemento e Ver todos; console sem erros. Bling confirmou leitura bem-sucedida, sem renovacao forcada. Auditoria apply: 0 removidos, 34 bloqueados preservados; caminhos/reasons na nota da versao. Quatro arquivos Shopee preexistentes preservados.

## Historico

# v1.2.589-system-regressions

Data: 09/10/2026. Branch: main. Tag: v1.2.589-system-regressions.
Release ativa: /var/www/mdv-site/releases/20261009-183823-system-regressions.

Painel preserva hide_from_catalog; falhas temporarias do Bling preservam credenciais e nunca devolvem token vencido; fallback de URLs exige identificacao exata e unica; complemento salvo atualiza pai, filhos e cache administrativo, inclusive com consulta antiga em andamento. Suite npm.cmd run test:regressions centraliza as protecoes. API e dados comerciais nao fazem parte do deploy.

Publicacao concluida: commit 7c6b9140 e tag enviados a main; 68 testes da suite e 9 complementares passaram. Build sem runtime Supabase; homepage e VERSION.json HTTP 200; API ok=true e mysql.ok=true sem restart. Chrome confirmou Sabor iPhone no painel apos reload e link do pai abrindo C17P6256L com imagem e R$ 1300,00; console sem erros. Renovacao Bling validada com transporte simulado, sem renovar credenciais reais. Auditoria apply: 0 removidos e 34 bloqueados (25 dirty, 9 not_merged_into_origin_main), detalhados na nota da versao. Quatro arquivos Shopee preexistentes preservados.

## Historico

# v1.2.588-admin-title-complement

Data: 08/10/2026. Branch: main. Tag: v1.2.588-admin-title-complement.
Release: /var/www/mdv-site/releases/20261009-000947-admin-title-complement.

O hook administrativo descartava catalog_title_complement e parent_catalog_title_complement recebidos da API. Ambos agora sao preservados nos cards. Texto salvo no pai continua a fonte de verdade; nenhum dado foi regravado. API, consulta publica, precos e documentos permanecem intactos.

Testes do complemento, paginacao, busca serializada e cards de familia passaram. Build e publicacao pelo script oficial concluidos. Chrome confirmou Sabor iPhone no campo do C17 Plus apos reload e console sem erros. Commit baa22fd0 e tag enviados a main. API nao reiniciada. Auditoria: 0 removidos, 34 bloqueados (25 dirty, 9 not_merged_into_origin_main), caminhos registrados na nota da versao. Quatro arquivos preexistentes Shopee preservados.

## Historico

# v1.2.587-public-family-variation

Data: 08/10/2026. Branch: main. Tag: v1.2.587-public-family-variation.
Release: /var/www/mdv-site/releases/20261008-234548-public-family-variation.

Pagina publica usa o resolvedor publico para UUIDs e slugs; o pai e excluido antes do agrupamento de variacoes e nunca renderiza preco zero como opcao Padrao. Links antigos do pai com SKU tambem resolvem um filho publico. Filhos ocultos/inativos nao sao escolhidos. Painel continua acessando o pai por ID interno; nenhum dado comercial foi alterado.

14 testes focados, rotas publicas, SEO Fastify e estoque PDV passaram. Publicacao e validacao final concluidas; deploy seletivo preservou codigo remoto. Quatro arquivos preexistentes Shopee preservados fora do escopo.

## Publicacao validada

Commit c8eefe86 e tag v1.2.587-public-family-variation enviados a main. API publicada seletivamente com backup /var/www/mdv-api/backups/parent-public-link-1791503239385; restart mdv-api concluido; status ok=true e mysql.ok=true. Site ativo /var/www/mdv-site/releases/20261008-234548-public-family-variation; homepage HTTP 200 e VERSION.json correspondente. Build sem runtime Supabase.

Validacao sem credenciais: UUID, slug e endereco antigo com SKU do pai C17 resolvem o filho 10b2a984-c51a-45a6-8d41-5e0926dd1566, is_parent=0, preco 130000 centavos. Pais Poco X8 Pro e Redmi 17 tambem resolvem filhos com preco positivo. HTML do pai e endereco antigo retornam 200 com canonical do filho e sem oferta zero; UUID inexistente continua 410.

Chrome confirmou imagem, SKU C17P6256L e R$ 1300,00, apenas Laranja/Prata, sem opcao Padrao e sem erros no console. Troca para Prata e recarregamento mantiveram SKU C17P6256P e R$ 1300,00. Nenhum dado comercial alterado.

Worktrees: auditoria e apply concluido, 0 candidatos/0 removidos/34 bloqueados (25 dirty, 9 not_merged_into_origin_main). Quatro arquivos preexistentes Shopee preservados. Avisos CRLF, credential helper Git e timings do build nao impediram publicacao. Skill nao alterada.

Bloqueados preservados:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty


## Registro anterior

# v1.2.586-parent-public-link

Data: 08/10/2026. Branch: main. Tag: v1.2.586-parent-public-link. Release: /var/www/mdv-site/releases/20261008-224025-parent-public-link.

Correcao geral da resolucao SEO de UUID/slug do pai: busca uma variacao publica elegivel, prioriza estoque e mantem rota canonica da variacao. O pai nao aparece como item vendavel separado. Produtos comuns e variacoes conservam precedencia; familias sem filhos elegiveis continuam indisponiveis. Nenhum cadastro comercial, estoque, preco ou schema foi alterado.

Deploy seletivo --parent-public-link-only insere apenas o fallback na funcao SEO dos servidores, com backup e rollback. Preflight detectou server.js remoto com resolver SEO mais rico ja existente; patch preserva essa implementacao, aceitando apenas os baselines verificados.

Validacoes: 10 testes, rotas publicas, SEO Fastify, guarda PDV e sintaxe. Publicacao e auditoria final pendentes de verificacao.

Arquivos:
- server.js
- vps_server.js
- vps_server.cjs
- deploy-vps-server-only.cjs
- scripts/deploy-parent-public-link.cjs
- tmp-tests/seo-parent-family.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-08-v1.2.586-parent-public-link.md

Arquivos Shopee preexistentes preservados fora do escopo.

## Publicacao validada

Commit 583b13be e tag v1.2.586-parent-public-link enviados a main. API publicada seletivamente; backup /var/www/mdv-api/backups/parent-public-link-1791499527265; restart mdv-api concluido, status ok=true e mysql.ok=true. Site ativo /var/www/mdv-site/releases/20261008-224025-parent-public-link, homepage HTTP 200, VERSION.json correspondente, build sem runtime Supabase.

URLs de tres pais (C17 Plus, Poco X8 Pro e Redmi 17) retornaram HTTP 200; UUID inexistente continua HTTP 410. Chrome confirmou o link reportado abrindo C17 Plus com Laranja e Prata; titulo e complemento do pai mantidos; sem erros no console. Nenhum dado comercial alterado.

Worktrees: 0 candidatos, 0 removidos, 34 bloqueados; {"dirty":25,"not_merged_into_origin_main":9}. Quatro arquivos preexistentes Shopee preservados. Skill nao alterada; modo seletivo especifico versionado no deploy oficial. Avisos conhecidos CRLF, Browserslist antigo e credential helper Git nao impediram publicacao.

Bloqueados preservados:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty


Fechamento v1.2.613: commit 7cc7bf07 e tag em main, site/API publicados e validados. Custos oficiais autenticados, catalogo renderizado e n8n saudavel. Auditoria: zero removidos, 34 worktrees preservados; seis arquivos preexistentes fora do escopo. Detalhes na nota da versao.


Fechamento v1.2.614: commit 5b729077/tag em main, site publicado; preto validado com fotos proprias, videos em arquivos distintos e banco/MySQL saudavel. Auditoria preservou 34 worktrees e os seis preexistentes. Detalhes na nota desta versao.


Fechamento v1.2.615: commit funcional 86153590/tag enviados, site publicado e validado no catalogo e painel reais. API/MySQL saudaveis, sem restart. Auditoria: 0 removidos, 34 bloqueados preservados na nota; seis arquivos preexistentes fora do escopo.


Fechamento v1.2.616: commit 73758b95/tag enviados a main, site publicado e VERSION.json/catalogo real validados sem erro fatal. Workflow PayJoy ativo, API/MySQL e n8n saudaveis; sem novo restart. Limpeza: 0 removidos, 34 bloqueados preservados, listados na nota. Seis arquivos preexistentes fora do escopo.
# v1.2.712-meta-atendimento-paridade

Data: 30/10/2026. Branch: `main`. Tag: `v1.2.712-meta-atendimento-paridade`.
Release do site: `/var/www/mdv-site/releases/20261030-154100-meta-atendime
# v1.2.753-mercado-livre-stock-batch-window

Data: 02/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.753-mercado-livre-stock-batch-window`.
Release VPS: `/var/www/mdv-site/releases/20261102-180543-v753-release-record`. API reiniciada pelo deploy padrão.

Leituras simultâneas de estoque podem chegar escalonadas depois das consultas locais do ERP. O agrupador agora aguarda 150 ms antes de chamar `/items/bulk`, permitindo reunir até 20 anúncios numa única consulta. Todas as gravações continuam desligadas.

Validações: `npm.cmd run test:mercado-livre` (118 aprovados; contrato estático aprovado), `node --check` nos serviços alterados, trava Supabase, `npm.cmd run build`, site HTTP 200, API/MySQL saudáveis. A rechecagem ao vivo após a release ainda expirou em quatro de cinco leituras paralelas; a janela maior não resolveu a latência.

Nota operacional: o comando de inspeção `--help` não é aceito por `deploy-vps-server-only.cjs` e executou o deploy padrão da API. O script forçou os flags de escrita de estoque, preço e publicação a `0`; o log confirmou migração fiscal da empresa aplicada/validada e sincronização do ambiente remoto. Nenhum dado comercial ou estoque foi alterado.

---

# v1.2.767-ml-payment-details-get

Data: 03/11/2026. Status: publicada. Branch: `main`. Tag: `v1.2.767-ml-payment-details-get`.
Release VPS: `/var/www/mdv-site/releases/20261103-201000-payment-details-get-record`. API: publicada com `--mercado-livre-only`; escrita de anúncio, preço e estoque desabilitada.
Mercado Livre: consulta GET autenticada dos detalhes de pagamento Mercado Pago, restrita a pedidos do vendedor conectado e a campos financeiros permitidos; sem alterações em pedidos, anúncios, preço ou estoque.
Validação: `node tmp-tests/mercado-livre-erp-payment-details.test.cjs` (3/3).


