# Checklist de implementação — Loja 3D integrada ao Mercado do Vale

Data: 25/09/2026.
Status: implementação local iniciada; domínio 3D pendente de janela de baixo movimento.

## Objetivo e decisões confirmadas

Criar uma loja de impressão 3D e derivados com identidade visual própria, aproveitando recursos comerciais já construídos, incluindo fotos e vídeos. O sistema de gestão atual será a central operacional, como um ERP que publica produtos para dois sites independentes. Cada site terá seu próprio domínio, aplicação pública, cadastro/login, carrinho, checkout, preços, políticas, frete, pagamentos e comunicação. Produtos/SKU, fotos/vídeos, características e estoque serão compartilhados pela API central; pedidos dos dois sites voltarão à central com a origem identificada. Os canais disputarão o mesmo estoque dos mesmos produtos.

- [x] Definir estoque compartilhado entre as vitrines.
- [x] Prever pronta entrega e encomenda com prazo de fabricação.
- [x] Definir pagamento: entrada escolhida pelo cliente de 50% a 100% de TODOS os produtos, independentemente do estoque. Frete escolhido entre posterior, inteiro na entrada ou dividido proporcionalmente. Saldo quitado antes do envio.
- [x] Prever variantes específicas de produtos 3D.
- [x] Armazenar arquivos de impressão no Synology e vinculá-los ao produto comprado.
- [x] Definir que o JSON do programa de impressão fornecerá somente consumo de material e tempo de impressão.
- [x] Definir os nomes `material_gramas` e `tempo_impressao_minutos` como contrato de saída do programa de impressão.
- [x] Definir que filamento, cor, impressora, quantidade de peças, acessórios e demais informações serão preenchidos no painel.
- [x] Definir produto/SKU, fotos, vídeo, características e estoque como dados centrais compartilhados; cada site terá oferta comercial própria (publicação, preço, título, descrição e endereço).
- [x] Definir os dois sites como canais operacionais independentes ligados à central, no modelo ERP → sites → pedidos/estoque. A rota local `/loja-3d` é somente uma prévia; não representa a arquitetura final de publicação.
- [x] Definir que a Val e o número/fluxo de WhatsApp atuais atendem exclusivamente o Mercado do Vale. Ela continua atendendo todo o catálogo desse site, inclusive um item de impressão 3D quando houver oferta publicada para o Mercado do Vale. Deve ignorar a identidade, links, políticas e preços da loja 3D. A loja 3D terá outro bot, configurado depois, sem compartilhar origem de preços ou memória de conversa.
- [x] Prever calculadora com custos de filamentos, energia e demais insumos.
- [x] Criar este checklist de execução.

As marcações acima registram requisitos confirmados, não funcionalidades completas. As fases abaixo permanecem pendentes até validação dos respectivos fluxos. Este documento não executa migrations, publicação nem alterações em produção.

## Arquitetura de canais confirmada

```text
Sistema de gestão central (ERP)
  ├─ produto/SKU, mídia, características, estoque e produção 3D
  ├─ ofertas, pedidos e documentos identificados por canal
  ├─ API de catálogo/publicação e reserva atômica do estoque
  ├─ site Mercado do Vale: domínio, conta, checkout, preço, frete e bot próprios
  └─ site 3D: domínio, conta, checkout, preço, frete e futuro bot próprios
```

O ERP distribui a ficha compartilhada e a oferta específica para cada canal. A venda retorna ao ERP com site, SKU, preço fechado, cliente daquele site e condições de pagamento. A reserva da última unidade acontece somente na central, em transação; o site não mantém estoque autoritativo. As integrações de mensagem recebem um identificador de canal confiável e não consultam clientes, preços, pedidos ou memória da outra marca.

- [ ] Extrair a vitrine 3D da rota de prévia `/loja-3d` para uma aplicação pública/deploy e domínio próprios antes da abertura comercial. Código compartilhado pode permanecer no mesmo repositório, desde que build, configuração, sessão, cookies, cache e publicação sejam independentes.
- [ ] Definir contrato da API central de publicação e pedido por canal, com autenticação entre site e ERP e validação do canal no servidor. Preço, visibilidade e política de cada site não podem ser inferidos do produto central nem escolhidos livremente pelo navegador.
- [ ] Isolar os fluxos de cadastro, checkout, pagamento, frete, notificações, SEO e análise de cada site. O ERP recebe os eventos e oferece visão administrativa consolidada, sem misturar a experiência dos clientes.
- [ ] Definir reconciliação e retentativas idempotentes para publicação de catálogo e retorno de pedidos; estoque é consultado/reservado na central em tempo real no fechamento.
- [ ] Testar preço e visibilidade diferentes para o mesmo SKU, duas contas independentes para a mesma pessoa, e compras simultâneas da última peça nos dois sites.

## Pendência operacional — domínio da loja 3D

- [ ] Em uma janela de baixo movimento, concluir o registro do domínio 3D adquirido na Hostinger. A etapa no Registro.br exige alterar o provedor do titular para `HSTDOMAINS (127)` e pode afetar outros domínios do mesmo titular.
- [ ] Antes da alteração, conferir novamente os DNS e o funcionamento de `mercadodovale.com.br`, `xiaomipetrolina.com.br`, `atacadoxiaomi.com.br` e `vaiencurta.com.br`, além de site, painel, API, n8n, bot e gestão patrimonial.
- [ ] Após a alteração, comparar DNS e serviços com a linha de base, corrigir eventuais falhas e confirmar o registro do novo domínio na Hostinger.
- [ ] Configurar Cloudflare e apontamento do novo domínio somente após o registro estar ativo.

Em 25/09/2026, a verificação prévia mostrou HTTP 200 e HTTPS válido no site, painel, API, n8n, bot, API WhatsApp e gestão patrimonial. A varredura de código, bancos, serviços da VPS, n8n e Evolution não encontrou dependência operacional ativa de `atacadoxiaomi.com.br` ou `vaiencurta.com.br`. Permanecem um apontamento DNS antigo para `bot.atacadoxiaomi.com.br`, arquivos legados referentes a `gestao.vaiencurta.com.br` e o uso dos servidores DNS do Registro.br pelos dois domínios. Nenhum provedor ou DNS foi alterado nessa verificação. Esta pendência não bloqueia o trabalho local nas demais funções da loja 3D.

## Implementação local iniciada

- [x] Criar prévia navegável da vitrine 3D em `/loja-3d`, com identidade visual provisória, layout responsivo, busca, filtro por categoria, detalhes e fotos/vídeo. A vitrine passou a ler apenas ofertas publicadas da loja 3D, de produtos centrais marcados `is_print3d`. Na ausência de ofertas, exibir amostras visuais identificadas, sem compra. A vitrine não altera estoque ou pedidos e não foi publicada.
- [x] Preparar migration `032_product_storefront_offers.sql`, validação de preços em centavos, API de ofertas por site e tela administrativa "Sites e preços" por SKU. Nome, descrição, categoria apresentada, slug, preço e visibilidade podem ser diferentes por site. A loja 3D local passou a consultar somente ofertas publicadas para seu site; o catálogo legado do Mercado do Vale ainda requer migração controlada. A migration não foi aplicada e o checkout não usa preços por site.
- [x] Preparar leitura por vitrine que mantém produtos legados sem oferta no Mercado do Vale e exige oferta publicada para mostrar produto 3D; oferta MDV oculta exclui o SKU dessa leitura. A rota aceita categoria, `category_id`, SKU, pesquisa textual, características do modelo e `compact=true` para a busca em lote do bot, preserva as imagens resolvidas pelo catálogo central e não usa cache para preços do Mercado do Vale. O workflow ativo ainda consulta `/products`, portanto esta proteção não está ativa no atendimento real.
- [x] Auditar o workflow ativo do bot em modo somente leitura e preparar um patch local, sem aplicação: três nós afetados, uma referência de origem em `Vendas - Contexto Produtos` e sete consultas diretas em `Vendas - Verificar Pos Lista`. A prévia rejeita novas fontes legadas não mapeadas; nenhum nó, banco, serviço ou mensagem de produção foi alterado.
- [x] Bloquear por padrão a publicação de oferta própria do Mercado do Vale na API (`MDV_STOREFRONT_MDV_READY` desligado). Só definir a flag como `1` depois que site, página do produto, checkout e bot estiverem lendo a oferta MDV e testes de preço/link/pedido com dois sites passarem. Rascunhos e ofertas ocultas permanecem configuráveis antes disso.
- [x] Leitura estrita do JSON com somente `material_gramas` e `tempo_impressao_minutos`, ambos numéricos e referentes ao lote.
- [x] Cálculo de custo de filamentos, energia, máquina, mão de obra e complementos por lote e por peça, mantendo dinheiro em centavos.
- [x] Página administrativa inicial para importar o JSON, cadastrar preços de filamentos/insumos e simular custos; os preços usam a fonte compartilhada `admin_preferences`.
- [x] Validar localmente os cálculos e o contrato JSON com 5 testes automatizados; `npm run test:money` e `npm run build` passaram em 25/09/2026.
- [x] Gerar ficha de produção em JSON como rascunho exportável por SKU/revisão, conferindo o SKU na API central e incluindo o ID do produto, resumo da impressão, alocação manual de filamentos, insumos, tarifas e custo conferido. A pasta privada do Synology é apenas sugerida; nenhum arquivo é enviado ou salvo automaticamente.
- [x] Preparar persistência privada de fichas por produto e revisão: migration `028_print3d_recipe_revisions.sql`, API administrativa com revisões imutáveis/idempotentes e botão de salvamento condicionado à ativação do módulo. A migration não foi aplicada e o módulo continua desligado por padrão.
- [x] Preparar listagem e download administrativo das fichas salvas, sem expor os custos na API pública de produtos.
- [x] Preparar upload e download privados de arquivos da revisão no Synology, com pasta por SKU/revisão, limite de 50 MB por arquivo, hash SHA-256, metadados no MySQL somente após confirmação do NAS e verificação de integridade no download. O JSON enviado deve coincidir com material/tempo da ficha; G-code exige identificação manual de impressora e perfil.
- [x] Preparar seleção administrativa da ficha principal por SKU: migration `030_print3d_active_recipe.sql`, referência à revisão e ao arquivo de fabricação escolhido, exigência de JSON conferido e atualização transacional sem apagar revisões anteriores. A seleção ainda não dispara ordens nem altera estoque.
- [x] Mapear o estoque central existente: `products.stock_quantity` representa o total cadastrado, `product_stock_locations` registra físico e reservado por local, e `production_days` já existe no cadastro do produto/categoria. O painel 3D agora consulta os saldos e o prazo do SKU sem criar estoque paralelo.
- [x] Preparar no cadastro central por SKU a marca de produto 3D, a opção de aceitar encomendas, o limite de unidades pendentes e o prazo individual em dias úteis. A migration `031_print3d_product_offer.sql` adiciona os campos comerciais; não foi aplicada. O checkout continua sem aceitar encomendas.
- [x] Validar localmente o novo cadastro com 32 testes focados (incluindo contagem dos parâmetros SQL nas duas versões da API), teste monetário, sintaxe da API e build do frontend em 26/09/2026. A checagem geral TypeScript ainda aponta erros em componentes de outras áreas e dois erros preexistentes no `ProductForm.tsx`.
- [x] Preparar reserva atômica no endpoint de pedidos: trava por produto e locais, atualização condicional e movimento na mesma transação. Testes locais cobrem duas compras pela última peça, múltiplos locais e rollback se o movimento falhar. Ainda falta validação com MySQL real e auditoria dos outros escritores de estoque antes de abrir a loja 3D.
- [x] Identificar caminhos que ainda podem concorrer com essa reserva: baixa por prioridade, consumo/liberação da reserva, entradas/ajustes manuais e sincronização externa do Bling atualizam `product_stock_locations` fora de uma transação única; transferência entre locais já usa transação. A nova rota de reserva não deve ser publicada isoladamente como garantia de estoque compartilhado.
- [x] Validar localmente 21 testes focados (3D e reserva), 31 testes do núcleo de garantia assinada, teste monetário, sintaxe da API e build do frontend após as mudanças; checagem geral de TypeScript ainda encontra erros preexistentes em outras áreas. A etapa estática da suíte de garantia assinada falhou em comparação de texto do bot fora deste escopo. O teste estático legado de reserva Supabase não roda porque o arquivo histórico que ele lê não existe mais.
- [ ] Validar a página com uma exportação real do programa de impressão e com cadastro real em ambiente de teste.
- [ ] Evoluir do cadastro de preços para controle físico de saldos, receitas por SKU, revisões e ordens de produção.

Arquivos locais: `utils/print3dImport.mjs`, `utils/print3dCost.mjs`, `utils/print3dRecipeDraft.mjs`, `services/print3dCostSettings.ts`, `services/print3dRecipes.ts`, `services/print3dRecipesServer.cjs`, `services/print3dRecipeFiles.ts`, `services/print3dRecipeFilesServer.cjs`, `services/print3dActiveRecipeServer.cjs`, `pages/admin/products/Print3dCostPage.tsx`, migrations `028` a `030`, rota e menu do painel. A página ainda não gera pedido ou movimenta estoque. A seleção de ficha é referência administrativa para futuras produções; só deve ser considerada operacional após migrations, configuração privada e teste real no NAS.

Ativação futura, em janela aprovada: fazer backup, aplicar as migrations 028, 029 e 030 em ambiente de teste, validar salvamento/leitura, upload/download e seleção com um produto de teste, configurar `MDV_PRINT3D_SYNOLOGY_FOLDER` para uma pasta privada terminada em `/producao-3d` fora de `/web`, preparar o deploy dos arquivos de API e só então definir `MDV_PRINT3D_RECIPES_ENABLED=1`. A flag desligada mantém as rotas sem acesso às tabelas ou ao NAS. Nenhuma dessas etapas externas foi executada aqui.

## Base observada e fontes de verdade

Inspeção do código local, sem comprovação de funcionamento em produção:

- `types/product.ts`: SKU, variantes pai/filho, especificações, estoque, vídeo e `production_days`.
- `types/category.ts` e `services/categories.ts`: prazo de produção por categoria.
- `components/products/ProductForm.tsx`: cadastro do prazo por produto.
- `pages/store/PublicProductPage.tsx`: exibição de prazo de fabricação.
- `types/stock-location.ts`: contratos de estoque e reservas; validar execução e concorrência antes de reutilizar.
- `services/productVariants.ts`: parte das variantes está orientada a RAM, armazenamento e cor; localizar também os demais consumidores antes de generalizar.

Fontes propostas: banco/API central para dados operacionais; Synology para arquivos binários; JSON como entrada dos dois valores da impressão. Após importação, a ficha aprovada e versionada no sistema será a referência operacional. Cada ordem guardará sua revisão, parâmetros e custos históricos.

Antes de criar estrutura, pesquisar equivalentes no projeto inteiro. Reaproveitar serviços existentes e ampliar contratos; não criar estoques, pedidos ou regras concorrentes por vitrine.

## 1. Fechar regras e escopo inicial

- [ ] Definir nome, domínio e identidade visual da loja 3D.
- [ ] Confirmar empresa/CNPJ responsável e vínculo com o fluxo fiscal central.
- [ ] Listar impressoras e programa que gera o JSON; obter um exemplo real da saída.
- [ ] Definir variantes iniciais: tamanho, material, cor, acabamento e acessórios.
- [ ] Separar variantes que geram SKU de personalizações específicas do pedido.
- [ ] Definir se personalizações entram na primeira versão.
- [ ] Confirmar unidade do material e do tempo do JSON, precisão e se representam uma peça ou o lote completo. Proposta: gramas e minutos totais da impressão.
- [ ] Validar com um arquivo real do programa que gramas e minutos são totais do lote/impressão e que a precisão adotada preserva o consumo e o tempo originais.
- [ ] Definir como informar impressões com vários filamentos se o JSON trouxer apenas o consumo total: distribuição manual por filamento, sem estimativa automática por cor.
- [ ] Definir início do prazo de fabricação: pagamento aprovado e, quando aplicável, aprovação da personalização.
- [ ] Definir dias úteis, calendário, limite de encomendas e critério de capacidade disponível.
- [ ] Definir envio de pedidos mistos: proposta inicial de envio conjunto; registrar exceções.
- [ ] Definir momento da reserva, vencimento de pedidos não pagos e tratamento de cancelamentos antes e após produção.
- [x] Definir preços e publicação independentes por vitrine; compartilhar SKU, fotos/vídeo, características e estoque. Nome, descrição, slug e SEO podem variar por site. Frete, pagamento e políticas ficam como configurações do próprio site quando forem implementadas.

**Conclusão:** decisões registradas e exemplos de compra simples, encomenda e pedido misto definidos.

## 2. Mapear integração e preparar dados

- [ ] Seguir o fluxo atual de catálogo, carrinho, pedido, pagamento, estoque, frete e documentos até a API/banco.
- [ ] Verificar como os canais e integrações atuais leem e alteram estoque; identificar riscos de sobrescrita do saldo central.
- [ ] Auditar os demais caminhos de alteração de `product_stock_locations` e garantir que não sobrescrevam uma reserva concorrente; a correção local cobre apenas `/stock-locations/priority-reservations`.
- [ ] Tornar baixa, consumo/liberação, entradas/ajustes e sincronização externa compatíveis com a mesma disciplina de travas e idempotência; testar concorrência entre canais, não apenas entre dois checkouts.
- [ ] Validar o schema real e a implementação das reservas existentes.
- [x] Definir seleção de vitrines por oferta ligada ao produto central, com estados rascunho/publicado/oculto; a identificação da origem no pedido ainda não foi implementada.
- [ ] Migrar o catálogo do Mercado do Vale para consultar sua oferta própria sem alterar produtos legados e sem exibir ofertas exclusivas da loja 3D.
- [ ] Depois de aplicar a migration e validar a rota em teste, trocar a consulta `Vendas - Buscar Produtos` do workflow ativo (`/products`) por `/storefronts/mercado_do_vale/products`, mantendo categoria, limite e `include_model_specs`. O nó `Vendas - Verificar Pos Lista` também faz consultas diretas a `/products/:id`, `/products?search=` e `/products?sku=`; migrar esses caminhos na mesma mudança. Atualizar a referência de fonte em `Vendas - Contexto Produtos`. Auditar as demais rotas de produto antes de publicar. Não permitir que buscas amplas do bot apresentem produto publicado apenas em `loja_3d`.
- [ ] Cobrir no bot todas as fontes de preço e produto: busca por texto, categoria, etiqueta, variações, lista de celulares, detalhes, links e respostas de vendas do n8n. O preço anunciado deve ser sempre o da oferta `mercado_do_vale`, validado na API, e nunca o preço da oferta `loja_3d` nem um valor inventado pela IA.
- [ ] Manter identidade, prompt e memória da Val sem referência à loja 3D. A separação deve ser feita na fonte de dados por site, sem ensinar à Val detalhes ou preços da outra loja. A auditoria somente leitura de 26/09/2026 não encontrou referências textuais à loja 3D nos nós do workflow ativo.
- [ ] Garantir que o `slug` e o preço da oferta MDV usados pelo bot resolvam na página pública e no checkout do próprio Mercado do Vale; testar links do pós-lista quando título ou endereço diferir do produto central.
- [ ] Testar o mesmo SKU 3D com preços e visibilidade diferentes nos dois sites: se houver oferta MDV publicada, a Val pode atender sobre o produto usando apenas nome, preço e link MDV; se ela estiver oculta ou inexistente, deve encaminhar para conferência sem revelar preço, link ou existência da loja 3D.
- [ ] Ao criar o futuro bot da loja 3D, usar identidade, entrada/webhook e contexto de atendimento próprios; sua consulta de catálogo deve ser fixada em `loja_3d`. Manter o estoque central compartilhado.
- [ ] Fazer o checkout e os pedidos validarem o preço da oferta do site no servidor e registrarem o site, SKU e preço fechado no item; impedir manipulação de preço pelo navegador.
- [ ] Reutilizar produto/variante por identificador permanente e SKU; evitar duplicação por loja.
- [ ] Planejar extensões necessárias para ficha de fabricação, revisões, insumos, consumo e ordens de produção.
- [ ] Separar produto acabado, matéria-prima, item em produção e quantidade reservada.
- [ ] Preparar migrations, compatibilidade com registros existentes, índices e plano de reversão.
- [ ] Definir permissões para cadastro, custos, arquivos e operação da produção.

**Conclusão:** modelo de dados e contratos revisados, com uma fonte central por responsabilidade e plano de migração.

## 3. Cadastro de produtos 3D

- [ ] Criar configuração de categoria 3D reutilizando o cadastro atual.
- [ ] Ampliar seleção, agrupamento e busca de variantes para atributos próprios de 3D, preservando smartphones e demais categorias.
- [ ] Atribuir SKU e estoque a cada combinação vendável.
- [ ] Preservar fotos, vídeo, descrição, dimensões e peso de envio.
- [x] Preparar cadastro por SKU de aceitação de encomendas, prazo de produção e limite de unidades pendentes; falta aplicar a migration 031 e validar no banco de teste.
- [ ] Distinguir peças prontas de demanda a fabricar.
- [ ] Vincular ficha de fabricação aprovada à variante.
- [ ] Validar dados obrigatórios antes de liberar venda sob encomenda.

**Conclusão:** uma variante pode ser cadastrada com preço, mídia, disponibilidade e receita de produção inequívoca.

## 4. Arquivos e revisões no Synology

- [x] Ler `Synology.md` e identificar o serviço de upload privado existente antes de ampliar a integração.
- [ ] Definir organização por SKU e revisão, com vínculo interno por identificador permanente.
- [ ] Prever referência compartilhada para arquivos usados por várias variantes, evitando duplicações desnecessárias.
- [ ] Implementar upload de modelo, projeto, prévia, instruções opcionais e JSON.
- [ ] Definir formatos e limites de tamanho; validar caminhos e impedir acesso fora da pasta autorizada.
- [ ] Manter arquivos de fabricação privados e separar sua autorização das mídias públicas do catálogo.
- [ ] Registrar versão, nome, tamanho e hash dos arquivos.
- [ ] Exigir associação de arquivos de máquina a impressora/perfil compatíveis quando houver G-code.
- [ ] Permitir selecionar uma revisão aprovada para novas produções sem sobrescrever revisões antigas.
- [ ] Preservar arquivos e revisões usados em pedidos; bloquear exclusão que quebre o histórico.
- [ ] Tratar upload parcial e NAS indisponível sem marcar arquivos ausentes como prontos.
- [ ] Definir backup e verificar restauração de uma ficha com seus arquivos.

Estrutura sugerida, a ajustar ao armazenamento existente:

```text
producao-3d/
  produtos/<SKU>/revisoes/<REVISAO>/
    modelo.stl
    projeto.3mf
    previa.png
    impressao.json
    instrucoes.txt
  pedidos/<PEDIDO>/<ITEM>/personalizacao/
```

**Conclusão:** o operador abre a revisão correta pelo painel, inclusive para pedidos antigos, sem expor os arquivos ao público.

## 5. Importação do JSON mínimo

Contrato solicitado ao programa de impressão, a validar com uma exportação real:

```json
{
  "material_gramas": 180,
  "tempo_impressao_minutos": 360
}
```

- [ ] Confirmar ou adaptar nomes dos campos ao formato produzido pelo programa.
- [ ] Validar JSON, campos obrigatórios, unidades, valores numéricos finitos e limites coerentes.
- [ ] Mostrar erro claro para formato inválido ou unidades ambíguas, sem preencher valores silenciosamente.
- [ ] Importar somente consumo e tempo; preservar os demais campos preenchidos manualmente.
- [ ] Vincular a importação à variante e revisão selecionadas, sem exigir SKU no JSON.
- [ ] Cadastrar manualmente quantidade de peças do lote, filamentos/cores, impressora, perfil, insumos e trabalho manual.
- [ ] Indicar se o material informado já inclui suportes e purga para evitar dupla contagem.
- [ ] Conferir soma das quantidades manuais por filamento quando houver vários materiais.
- [ ] Exibir resumo da importação e do custo antes de aprovar a ficha.
- [ ] Guardar o JSON original e registrar reimportações como alteração de revisão quando afetarem ficha aprovada.

**Conclusão:** importar o mesmo arquivo não duplica materiais nem apaga cadastros; tempos e consumos permanecem interpretados corretamente por lote/peça.

## 6. Insumos e calculadora

- [ ] Cadastrar filamentos por código, material, marca e cor, com quantidade, unidade e custo de aquisição.
- [ ] Cadastrar acessórios, cola, embalagens e demais insumos com unidade de consumo.
- [ ] Definir política de custo de estoque, precisão dos cálculos e arredondamento final em centavos.
- [ ] Cadastrar tarifa de energia por kWh e potência média por impressora.
- [ ] Cadastrar manutenção/depreciação por hora e valor da mão de obra.
- [ ] Informar preparação, montagem e acabamento separadamente do tempo de máquina.
- [ ] Definir provisão de perdas sem contar novamente perdas já incluídas no consumo informado.
- [ ] Calcular custo do lote e unitário considerando rendimento real e lotes incompletos.
- [ ] Separar custo de fabricação de preço sugerido, taxas comerciais e margem desejada.
- [ ] Exibir memória de cálculo por componente e avisar sobre custos não cadastrados.
- [ ] Salvar custos e parâmetros históricos na ordem; permitir simulações atuais sem alterar pedidos antigos.
- [ ] Registrar consumo real e perdas para comparar previsto e realizado.

**Conclusão:** uma impressão de referência possui custo reproduzível, conferido manualmente, por lote e por peça.

## 7. Estoque compartilhado e venda sob encomenda

- [ ] Centralizar disponibilidade para todas as vitrines e canais participantes.
- [ ] Reservar peças prontas de forma transacional, sem vender duas vezes a última unidade.
- [x] Extrair a reserva por prioridade para uso dentro da transação do futuro pedido. A rota atual mantém sua própria transação; o checkout poderá confirmar pedido e reserva juntos. Teste de rollback local incluído; falta integrar ao pedido e validar no MySQL real.
- [ ] Dividir pedido misto entre quantidade pronta reservada e quantidade a produzir.
- [ ] Criar demanda de produção para encomenda, sem estoque negativo ou disponibilidade ilimitada.
- [ ] Considerar reservas de materiais, capacidade e fila ao aceitar novas encomendas.
- [ ] Fixar o prazo prometido no pedido, separando fabricação e transporte.
- [ ] Tornar confirmação de pagamento, reserva e geração de ordem idempotentes.
- [ ] Após pagamento confirmado da entrada, iniciar a demanda de produção da encomenda; registrar separadamente valor total, entrada recebida, saldo pendente e cobranças, sem marcar o pedido como integralmente pago.
- [ ] Bloquear expedição enquanto houver saldo pendente da encomenda e liberar somente após a confirmação idempotente da segunda cobrança.
- [ ] Não reutilizar as rotas atuais de Mercado Pago para uma encomenda 3D: PIX, cartão, preferência e webhook trabalham com `orders.total` como cobrança integral e marcam `payment_status='paid'` após uma aprovação. Criar parcelas/cobranças vinculadas ao pedido antes de cobrar a entrada.
- [ ] Definir vencimento, cancelamento e eventual devolução da entrada, inclusive quando a produção já tiver começado, antes de ativar cobrança real.
- [ ] Liberar reservas em vencimento/cancelamento conforme regra; tratar produção já iniciada sem devolver material consumido ficticiamente.
- [ ] Impedir que a conclusão da fabricação disponibilize a outros compradores peças já reservadas.
- [ ] Manter trilha de movimentações e reconciliação de divergências.

**Conclusão:** compras simultâneas e repetição de eventos não duplicam vendas, reservas, consumo ou ordens.

## 8. Ordens e fila de produção

- [x] Implementar localmente apontamentos parciais por lote: 100 solicitadas e 20 aprovadas mostram 20%, faltando 80. Novos lançamentos somam unidades aprovadas; rejeitadas e notas ficam somente no painel administrativo.
- [x] Criar páginas Produção 3D no painel e Minhas encomendas na conta 3D, com histórico e atualização. A prévia demo é fictícia e não consulta a API de produção.
- [x] Preparar plano imutável por pedido/item (quantidade pronta versus encomendada, entrada e saldo) e registro interno idempotente de confirmações verificadas. O registro da entrada não marca quitação integral.
- [x] Preparar criação interna da OP vinculada ao plano, pedido e revisão/arquivo, liberação condicionada à entrada registrada, trava transacional por pedido/OP e lançamento idempotente com limite da quantidade. Cancelamento/estorno bloqueiam apontamentos. Nenhum estoque ou envio é gerado pelo progresso.
- [ ] Integrar o futuro checkout transacional e o adaptador de pagamento autenticado às funções internas de plano/OP. Ainda não existe rota de compra/cobrança real que gere essas ordens automaticamente.
- [ ] Homologar migrations 040/041 e transações em MySQL local de teste, conectar consumo de materiais/reservas e expedição, antes de qualquer ativação em produção. Referência: docs/print3d-production.md.

- [ ] Gerar ordem para a quantidade efetivamente encomendada após o gatilho definido.
- [ ] Guardar pedido/item, SKU, opções do cliente, revisão, arquivos, receita, custos e prazo prometido.
- [ ] Exibir prévia, quantidade, filamentos, instruções, impressora/perfil e botão para abrir os arquivos corretos.
- [ ] Implementar estados: aguardando, em produção, conferência, concluído e cancelado; prever falha/reimpressão.
- [ ] Organizar fila por prazo e capacidade, com atribuição de impressora e operador.
- [ ] Permitir produção parcial e registrar peças aprovadas, rejeitadas e material consumido.
- [ ] Dar entrada nas peças aprovadas e baixar materiais com rastreabilidade e sem duplicação.
- [ ] Preservar vínculo entre peças produzidas e reserva do pedido.
- [ ] Encaminhar para embalagem/expedição quando todas as quantidades necessárias estiverem prontas.

**Conclusão:** uma compra gera instruções suficientes para imprimir a variante correta e acompanhar sua entrega.

## 9. Nova vitrine e integração comercial/fiscal

- [ ] Implementar identidade visual e domínio próprios reutilizando componentes e regras comerciais existentes.
- [ ] Filtrar catálogo por vitrine também na API e nas rotas diretas de produto.
- [ ] Implementar seleção de variantes 3D com preço, fotos e vídeo correspondentes.
- [x] Preparar a seleção na vitrine: agrupar SKUs pelo `model_id`, buscar também por cor/material/SKU e trocar preço, mídia e disponibilidade ao escolher a variante. A prévia local cobre duas cores do mesmo vaso; falta validar com SKUs e mídias reais após as migrations.
- [ ] Exibir quantidade pronta e prazo das quantidades sob encomenda na página, carrinho e finalização.
- [x] Preparar saldo vendável da vitrine 3D separado do saldo físico: a API limita pela quantidade central e pelas reservas por local, e o catálogo e carrinho de prévia usam esse saldo; falta validar com reservas reais no banco de teste.
- [x] Preparar carrinho de teste da loja 3D com cotação informativa no servidor: preço da oferta `loja_3d`, saldo por local descontando reservas, divisão entre pronta entrega e encomenda, prazo e limite por pedido. Não cria pedido nem reserva; falta validar saldo/prazo no banco de teste e integrar checkout transacional.
- [x] Mostrar na cotação entrada mínima de 50% de todos os produtos; checkout permite aumentar o percentual até 100% e escolher o pagamento do frete. Arredondamento global em centavos no servidor; cotação não gera cobrança.
- [ ] Confirmar prazo de fabricação mais frete antes da compra.
- [x] Calculadora de frete no produto e carrinho 3D, implementada localmente reutilizando as integrações Melhor Envio/Frenet do MDV. Preços da oferta 3D e peso/medidas são lidos no servidor; falta de medidas bloqueia cotação. Produção, preparação e transporte aparecem separados.
- [x] Usar o mesmo CEP de origem principal e transportadoras do MDV, lendo o cadastro central no servidor, com habilitação, sandbox e filtro de serviços existentes.
- [x] Banners por loja implementados localmente: seletor no painel e formulário, ordem/estatísticas por loja, carrossel 3D e links internos de produto/categoria. Banners antigos permanecem no Mercado do Vale.
- [ ] Aplicar migration 039_banner_storefront.sql antes de publicar API e frontend de banners; validar cadastro real no painel. Implementação testada com banco e rede simulados, sem alteração em produção.
- [ ] Ativar frete 3D: configurar embalagem e preparação próprias conforme docs/print3d-shipping.md; conferir embalagem física e testar cotação real antes de publicar. Entrega local, subsídios, múltiplas origens e etiquetas não foram copiados automaticamente do MDV.
- [ ] Integrar pedido, pagamento, cliente, frete e expedição aos serviços centrais existentes.
- [x] Preparar no painel de pedidos o filtro e identificador visual da loja de origem. Pedidos legados sem campo de origem aparecem como Mercado do Vale; um futuro pedido 3D fica somente para consulta até que suas ações de produção, cobrança, comunicação e expedição sejam implementadas. As mensagens de criação/status e as rotas legadas de cobrança, estorno e webhook do Mercado do Vale passam a recusar origem 3D ou desconhecida no servidor. Após consulta somente leitura ao schema real, a migration local `033_order_storefront.sql` foi preparada com padrão Mercado do Vale, sem aplicação. A rota genérica de pedidos recusa criação com origem 3D e mudança de origem; falta o checkout 3D gravar a origem na rota própria e validar com dados de teste.
- [ ] Substituir no fechamento da loja 3D a criação atual em três chamadas separadas (pedido, itens e reserva) por uma operação transacional no servidor que recalcule a oferta `loja_3d`, registre a origem e grave o preço por SKU. O checkout atual monta valores no navegador; não reutilizá-lo diretamente para este canal.
- [ ] Configurar identificação da loja nos documentos e comunicações pertinentes.
- [ ] Verificar prontidão do módulo fiscal, empresa emitente e dados fiscais dos produtos antes de prometer emissão.
- [ ] Validar o fluxo fiscal aplicável à venda/expedição, sem pressupor que a emissão está pronta por haver campos no cadastro.
- [ ] Validar experiência em celular, filtros, URLs e acesso a pedidos pela loja de origem.

### Cadastro e comunicações por loja

Decisão do operador em 26/09/2026: **contas e senhas independentes** para Mercado do Vale e loja 3D. Compartilhar produtos, SKU, mídia e estoque no núcleo operacional não significa compartilhar login, perfil, consentimento, carrinho, histórico visível ou identidade do atendimento. A mesma pessoa pode ter contas nas duas lojas sem que uma conta autentique na outra.

Risco confirmado no código atual: `/auth/register` pesquisa `customers` e `customer_auth` globalmente por e-mail/CPF/telefone, sincroniza Google Contacts e dispara a mensagem `customer_registered_site` do Mercado do Vale. O agendador de aniversário consulta todos os registros ativos de `customers` com data de nascimento, sem origem de loja, e registra a saudação no contexto do bot. **Não apontar o cadastro 3D para essas rotas/tabelas sem isolamento completo.** A vitrine 3D ainda não possui checkout operacional.

- [x] Inspecionar somente os metadados reais de `customers`, `customer_auth`, `orders` e `order_items` na VPS via SSH em 26/09/2026; nenhuma linha de cliente ou pedido foi lida e nenhuma migration foi aplicada. `customer_auth` usa e-mail e CPF/CNPJ únicos globalmente, portanto não comporta duas contas independentes com as mesmas credenciais. O cadastro 3D precisará de autenticação própria. Falta mapear contatos e logs antes de ativar comunicações.
- [x] Preparar o schema local de contas 3D independentes na migration `034_print3d_customer_accounts.sql`: perfil, credenciais, versão de sessão e tokens de confirmação/recuperação em tabelas próprias, consentimentos inicialmente vazios e vínculo `orders.print3d_customer_id`, sem usar `customers/customer_auth` do Mercado do Vale. Não aplicada; nenhum cadastro público foi liberado.
- [x] Preparar assinatura/verificação de sessão exclusiva da loja 3D com chave derivada por finalidade e audiência `loja_3d`; o token não é aceito pela assinatura do login Mercado do Vale. Rotas próprias estão preparadas e desligadas por padrão.
- [x] Preparar rotas próprias de cadastro, login, recuperação de senha e sessão da loja 3D, sem consultar `customers/customer_auth` do Mercado do Vale. O cadastro inicial aceita **e-mail confirmado ou WhatsApp confirmado**; CPF é opcional e pode ser usado no login se cadastrado. Login por telefone/CPF + senha e recuperação por código WhatsApp ficam isolados. A troca de senha revoga sessões anteriores. A origem vem da rota, há limite de tentativas e links de e-mail usam apenas URL configurada da loja. O módulo fica desligado por padrão (`MDV_PRINT3D_CUSTOMERS_ENABLED`); ainda não ativar sem migrations, domínio, páginas de confirmação/recuperação e homologação.
- [x] Preparar cliente HTTP 3D separado (`print3dAccountClient.ts`): requisições de conta não carregam sessão, cookie ou chave de sincronização do Mercado do Vale; token 3D tem armazenamento próprio.
- [x] Preparar validação WhatsApp 3D reutilizando o protocolo de segurança já testado no Mercado do Vale (código de seis dígitos, validade de 10 minutos, cinco tentativas, intervalo de reenvio, limites por IP/telefone e prova consumida em transação), mas com tabelas, segredo, rotas, marca e transporte de envio próprios. Migration local `035_print3d_phone_verification.sql` não aplicada. O cadastro MDV envia o código pela API diretamente à Evolution; não existe um fluxo n8n de OTP para simplesmente duplicar.
- [x] Preparar adaptador de envio para webhook autenticado do n8n 3D, que exige resposta de sucesso da instância Evolution 3D, número remetente 3D e identificador da mensagem, sem usar a chave ou instância MDV. Exige `MDV_PRINT3D_N8N_VERIFY_URL`, `MDV_PRINT3D_N8N_VERIFY_TOKEN`, `MDV_PRINT3D_EVOLUTION_INSTANCE`, `MDV_PRINT3D_WHATSAPP_NUMBER` e `MDV_MARKET_WHATSAPP_NUMBER` distintos; permanece desligado (`MDV_PRINT3D_PHONE_ENABLED`). Nenhum código real foi enviado.
- [ ] Criar no n8n 3D o workflow de envio: Webhook POST com Header Auth `x-print3d-verification-key` → validar `phone`, `text` e finalidade fixa `print3d_phone_verification` → HTTP Request com credencial Evolution 3D → Respond to Webhook **após** o envio com `{ok:true, instance, sender_phone, message_id}`. Responder 4xx para entrada inválida e 5xx para falha de envio, reduzir retenção de execuções que contenham OTP e não criar atendimento/bot nesse workflow. A URL de teste do n8n não deve ser usada em produção.
- [ ] Provisionar número e instância Evolution exclusivos da marca 3D, além de uma instância n8n separada. Configurar no n8n 3D somente o envio do código solicitado pela API 3D, com credenciais próprias, autenticação do webhook e resposta de sucesso/falha verificável. Não copiar credenciais, webhook de entrada, memória, Google Contacts ou bot Val do Mercado do Vale.
- [x] Vincular a prova WhatsApp à conta 3D e ao telefone confirmado, sem consultar nem atualizar `customers`, `customer_auth` ou as tabelas de confirmação MDV. Decisão atual: o cliente escolhe e-mail ou WhatsApp no cadastro; para encomendar, WhatsApp confirmado é obrigatório, podendo ser validado depois. A prévia da tela de conta mostra os dois caminhos. O checkout ainda não existe e deverá impor a regra pelo banco, não pelo estado do navegador.
- [ ] Testar em homologação a mesma pessoa/número nas duas lojas, expiração, reenvio, falha do n8n e número errado; validar as páginas de confirmação de e-mail e recuperação de senha no domínio 3D, além do fluxo de encomenda que exige `phone_verified_at` no servidor.
- [x] Preparar as páginas 3D de cadastro por e-mail/WhatsApp, confirmação de e-mail, login por e-mail/telefone/CPF, recuperação de senha e área da conta com restauração da sessão e saída. Prévia local sem envio de mensagens.
- [x] Bloquear credenciais, tokens e desafios 3D nas rotas genéricas de tabelas; recuperação por WhatsApp invalida também links de recuperação anteriores.
- [ ] Testar envio SMTP e os fluxos completos em homologação antes de ativar o módulo.

- [x] Implementar localmente trava de senha 3D: 5 falhas em janela de 15 minutos bloqueiam a conta por 15 minutos; 30 falhas por IP em 15 minutos também bloqueiam esse IP por 15 minutos. CPF/telefone/e-mail da conta usam o mesmo contador. Transação e locks serializam tentativas concorrentes; contadores persistem no MySQL, separados do MDV, com chaves HMAC sem identificadores em texto. Login correto limpa falhas da conta; recuperação confirmada limpa a trava da conta na mesma transação, sem remover proteção do IP. Limite geral do login ajustado para 60 requisições/hora por IP. Migration `036_print3d_login_limits.sql` preparada, não aplicada.
- [x] Integrar Turnstile em todos os POSTs de autenticação 3D, incluindo cadastro, login, códigos, confirmação e recuperação. Cada envio gera token novo; cancelar a verificação impede a requisição. Servidor valida token via Siteverify, hostname exato de `MDV_PRINT3D_PUBLIC_URL` e ação `print3d_auth`; ausência, erro, expiração/reutilização rejeitada pelo provedor ou indisponibilidade não liberam a operação. GETs de sessão/status não exigem desafio. Prévia `demo=1` continua sem chamadas de cadastro/envio. CAPTCHA não substitui confirmação de contato ou limites de tentativa.
- [x] Testar localmente política de bloqueio, concorrência, recriação do serviço com mesmo armazenamento, troca de identificador/IP, recuperação, rollback, expiração, falha do provedor e CAPTCHA obrigatório em todas as rotas POST. Teste em Chrome isolado com provedor simulado comprova cancelamento, token novo por envio e GET sem desafio.
- [ ] Configurar widget Turnstile exclusivo 3D (modo Managed), domínio canônico permitido e chaves: `VITE_PRINT3D_TURNSTILE_SITE_KEY` no build do frontend e `MDV_PRINT3D_TURNSTILE_SECRET_KEY` somente no servidor. Não colocar segredo em variável VITE. Garantir redirecionamento de domínio alternativo para o hostname canônico e, se houver CSP, liberar script/frame da Cloudflare conforme documentação. Sem as chaves, operações de autenticação falham fechadas. Não requer alterar DNS.
- [ ] Aplicar 036 no ambiente autorizado antes da ativação; homologar locks/concorrência em MySQL real, reinício, IP via Nginx/proxy, desafios reais no celular/teclado, recuperação durante bloqueio, falha do provedor e isolamento MDV. Validar limpeza periódica de contadores expirados antes de crescimento do tráfego. Nenhuma migration, chave real ou publicação foi executada nesta etapa.
- [x] Preparar a mesma proteção para o Mercado do Vale: módulo comum `storefrontAuthSecurity.cjs`, tabela exclusiva `customer_login_limits` (migration 037), HMAC/ação CAPTCHA separados, 5 falhas por conta/15 minutos e 30 por IP/15 minutos. Recuperação MDV por e-mail ou WhatsApp continua fora da trava de login; confirmação do link troca senha, invalida links pendentes e limpa a trava em uma transação. Testes locais validam proteção HTTP, recuperação, isolamento de lojas e preservação dos callbacks Google.
- [ ] Ativar a proteção MDV somente após homologação: aplicar 037, configurar widget/chaves exclusivos `VITE_MDV_TURNSTILE_SITE_KEY` e `MDV_TURNSTILE_SECRET_KEY`, habilitar `VITE_MDV_AUTH_SECURITY_ENABLED=1` no build e `MDV_CUSTOMER_AUTH_SECURITY_ENABLED=1` na API. Validar o hostname canônico retornado por `getPublicAppUrl()`, proxy/IP, login de clientes e administradores que usam `/auth/login`, cadastro, confirmação WhatsApp e recuperação. A proteção permanece desabilitada por padrão no MDV até essa ativação coordenada; não houve deploy ou alteração de credenciais.
- [x] Implementar localmente login Google 3D e vínculo explícito para quem já tem conta: rotas `/print3d/auth/google/*`, biblioteca oficial `google-auth-library`, cliente OAuth distinto do MDV, PKCE, state assinado com chave derivada, nonce e cookie próprios. Validar assinatura/audiência/emissor/expiração; retorno usa código temporário de uso único ligado a uma prova guardada no navegador, sem JWT de sessão na URL. Cadastro, identidade Google (`sub`) e sessão usam somente tabelas/chaves 3D. E-mail existente não une contas automaticamente: entrar na conta e escolher Vincular Google. Contas Google com e-mail externo a Gmail/Workspace exigem confirmação local por e-mail antes do primeiro vínculo. WhatsApp não é confirmado pelo Google e continua obrigatório para encomendas.
- [x] Testes locais cobrem identidade estável mesmo após mudança do e-mail Google, callback adulterado/expirado, audiência MDV, nonce/cookie inválidos, código usado duas vezes ou em outro navegador, conta inativa, vínculo com sessão ausente e Google pertencente a outra conta. Teste Chrome confirma conclusão única do callback e sessão MDV intacta. Provedor Google e banco simulados; não houve autenticação real ou envio.
- [ ] Aplicar migration `038_print3d_google_accounts.sql` em homologação (após 034-036) e criar cliente OAuth Web exclusivo 3D. Configurar somente no servidor `MDV_PRINT3D_GOOGLE_CLIENT_ID`, `MDV_PRINT3D_GOOGLE_CLIENT_SECRET`, `MDV_PRINT3D_GOOGLE_REDIRECT_URI` com URI HTTPS exata terminada em `/print3d/auth/google/callback`, e `MDV_PRINT3D_GOOGLE_ENABLED=1`. A origem da API usada no redirect precisa servir também `/print3d/auth/google/start` diretamente, preservando cookies. `MDV_PRINT3D_PUBLIC_URL` deve ser a origem canônica da loja; o retorno web é `/loja-3d/conta/google/callback`. Não reutilizar o cliente OAuth do MDV. Validar dependências Node do release, CORS/proxy/CSP, Turnstile, MySQL real, contas de teste e login/vínculo/recuperação antes de publicar. Configuração ausente deixa o botão oculto fora da prévia e as rotas desativadas.
- [ ] Manter perfis, endereços, carrinhos, favoritos, pedidos visíveis, redefinição de senha e confirmação de telefone restritos à conta da loja correspondente. Compartilhar somente dados operacionais centrais exigidos por estoque, faturamento e auditoria.
- [ ] Registrar a origem em cada pedido e manter o vínculo com a conta da loja; equipe administrativa pode consultar os dois canais com identificação clara, sem expor pedidos da outra loja ao cliente.
- [ ] Criar consentimentos e preferências de comunicação separados por loja e canal. Cadastro, compra ou opt-in na loja 3D não autorizam automações do Mercado do Vale.
- [ ] Restringir a seleção do aniversário, boas-vindas, campanhas/listas e sincronização de contatos do Mercado do Vale a seus próprios clientes elegíveis. Preservar clientes legados do Mercado do Vale na migração, sem incluir clientes exclusivos da loja 3D por padrão.
- [ ] Manter Val, sua entrada WhatsApp/n8n, memória e Google Contacts vinculados apenas ao Mercado do Vale. Futuro bot 3D deve ter entrada, identidade, catálogo, memória e modelos de mensagem próprios; o mesmo número de telefone não pode juntar contextos entre marcas.
- [ ] Testar cadastro com o mesmo e-mail/telefone nas duas lojas, login e recuperação de senha independentes, cliente exclusivo 3D fora do aniversário/listas MDV e cliente das duas lojas recebendo somente comunicações autorizadas de cada marca.

**Conclusão:** cliente compra na loja 3D e a operação inteira aparece na central, usando o mesmo estoque.

## 10. Validação integrada

- [ ] Testar JSON válido, inválido, campos ausentes, unidades incorretas e reimportação.
- [ ] Testar peça única, lote, lote incompleto e impressão com vários filamentos.
- [ ] Testar cálculo com mudança de custo do insumo preservando histórico.
- [ ] Testar pronta entrega, somente encomenda e pedido misto.
- [ ] Testar dois canais tentando reservar simultaneamente a última unidade.
- [ ] Testar pagamento repetido, atraso na confirmação, expiração e cancelamento.
- [ ] Testar alteração do arquivo após a compra preservando a revisão do pedido.
- [ ] Testar falta de material, limite da fila e indisponibilidade do NAS.
- [ ] Testar falha, reimpressão, produção parcial e conclusão repetida.
- [ ] Testar acesso negado aos arquivos privados e aos custos por usuários sem permissão.
- [ ] Testar pedido completo até expedição e fluxo fiscal aplicável em ambiente apropriado.
- [ ] Executar regressões pertinentes de dinheiro, catálogo, variantes, PDV, estoque e integrações afetadas.
- [ ] Executar build e validações dos módulos de API alterados.
- [ ] Registrar evidências dos cenários e pendências; só marcar itens efetivamente comprovados.

**Conclusão:** fluxo completo demonstrado e nenhuma regressão conhecida bloqueando a operação existente.

## 11. Piloto e publicação

- [ ] Selecionar poucos produtos representativos e cadastrar arquivos, receitas e insumos reais.
- [ ] Conferir saldo inicial de produtos e insumos antes da abertura do canal.
- [ ] Validar uma impressão física e comparar tempo, consumo e custo previstos com os realizados.
- [ ] Preparar backup, sequência de migrations, reversão e ativação gradual.
- [ ] Após pedido explícito de publicação, seguir a skill `publish-vps` e o `publicar.md` vigentes.
- [ ] Publicar e verificar domínio, catálogo, pedido, estoque e acesso aos arquivos.
- [ ] Conferir funcionamento dos demais canais após ativar a loja 3D.
- [ ] Registrar versão, evidências, limitações e instruções para cadastro/operação.

**Conclusão:** piloto aprovado e operação publicada com integridade de estoque e rastreabilidade dos arquivos.

## Ordem de execução e acompanhamento

Sequência sugerida: decisões → integração/dados → cadastro → arquivos/JSON → insumos/calculadora → estoque/encomendas → produção → vitrine/integrações → validação → piloto/publicação.

Ao concluir cada fase, registrar data, arquivos alterados, testes e evidências. Pendências que mudem preço, quantidade, prazo ou arquivo de fabricação devem ser resolvidas antes de liberar o fluxo correspondente.

| Fase | Estado | Evidências |
|---|---|---|
| 1. Regras e escopo | Pendente | — |
| 2. Integração e dados | Pendente | — |
| 3. Cadastro 3D | Em andamento | Campos por SKU, validação e migration 031 preparados localmente; faltam variantes 3D, teste no banco e publicação. |
| 4. Arquivos e revisões | Em andamento | Rascunho, migrations 028–030, API, seleção e tela privadas preparadas; faltam aplicação, teste real no NAS e ligação às ordens. |
| 5. JSON mínimo | Em andamento | Parser estrito e testes locais; falta arquivo real e vínculo à ficha. |
| 6. Insumos e calculadora | Em andamento | Tela, preços compartilhados e simulação local; falta estoque físico, ficha histórica e piloto. |
| 7. Estoque e encomendas | Em andamento | Consulta de saldos/prazo e reserva atômica preparadas localmente; falta testar no MySQL, auditar outros canais e implementar demanda de produção sem estoque negativo. |
| 8. Produção | Em andamento | Plano financeiro e OP parcial integrados localmente ao checkout/PIX; faltam consumo de insumos, estoque produzido, fila por capacidade e homologação MySQL. |
| 9. Vitrine e integrações | Em andamento | Vitrine, catálogo por site, frete, checkout e duas cobranças PIX preparados e testados com simulações locais; faltam cancelamento/expiração, ativação e homologação real, expedição e documento fiscal. |
| 10. Validação | Pendente | — |
| 11. Piloto e publicação | Pendente | — |

### Incremento local — 27/09/2026: checkout e pagamentos

- [x] Registrar decisão corrigida: entrada mínima de 50% de todos os produtos (prontos ou encomendados), com escolha de percentual até 100% e frete posterior, integral na entrada ou proporcional.
- [x] Checkout transacional com sessão 3D revalidada, WhatsApp obrigatório para encomenda, valores canônicos e cotação de frete assinada.
- [x] Reservar peças prontas e preservar localizações de origem; pedido, plano financeiro e OP criados juntos.
- [x] Implementar telas de endereço/frete, pedidos e PIX, com retentativas identificadas e carrinho isolado.
- [x] Adaptador PIX exclusivo, confirmação canônica, webhook assinado e cobrança do saldo condicionada à produção concluída.
- [x] Preparar migrations 042/043/044 e proteger tabelas no CRUD; não aplicar ou ativar nesta etapa. Condição financeira versionada preserva histórico.
- [x] Testar com banco/provedor simulados e navegador local: retry do checkout, entrada, saldo com frete, credencial de outro canal e cobrança repetida.
- [ ] Implementar cancelamento/expiração/abandono e liberação de reservas, considerando pagamento tardio, antes de ativar pedidos reais.
- [ ] Homologar migrations e concorrência com MySQL isolado, provedor e webhook reais de teste.
- [ ] Integrar quitação à trava de expedição e concluir os fluxos de estoque/fiscal pendentes.

Detalhes e configuração futura: `docs/print3d-checkout.md`. Tudo permanece local e desabilitado por padrão.
