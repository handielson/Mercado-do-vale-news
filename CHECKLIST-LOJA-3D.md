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

As marcações acima registram requisitos confirmados, não funcionalidades completas. As fases abaixo permanecem pendentes até validação dos respectivos fluxos. O estado operacional mais recente está registrado na seção de preparação do banco, sem ativar as funções 3D.

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
- [x] Preparar e aplicar a migration `032_product_storefront_offers.sql`, validação de preços em centavos, API de ofertas por site e tela administrativa "Sites e preços" por SKU. Nome, descrição, categoria apresentada, slug, preço e visibilidade podem ser diferentes por site. O checkout 3D permanece desabilitado.
- [x] Preparar leitura por vitrine que mantém produtos legados sem oferta no Mercado do Vale e exige oferta publicada para mostrar produto 3D; oferta MDV oculta exclui o SKU dessa leitura. A rota aceita categoria, `category_id`, SKU, pesquisa textual, características do modelo e `compact=true` para a busca em lote do bot, preserva as imagens resolvidas pelo catálogo central e não usa cache para preços do Mercado do Vale. O workflow ativo ainda consulta `/products`, portanto esta proteção não está ativa no atendimento real.
- [x] Auditar o workflow ativo do bot em modo somente leitura e preparar um patch local, sem aplicação: três nós afetados, uma referência de origem em `Vendas - Contexto Produtos` e sete consultas diretas em `Vendas - Verificar Pos Lista`. A prévia rejeita novas fontes legadas não mapeadas; nenhum nó, banco, serviço ou mensagem de produção foi alterado.
- [x] Bloquear por padrão a publicação de oferta própria do Mercado do Vale na API (`MDV_STOREFRONT_MDV_READY` desligado). Só definir a flag como `1` depois que site, página do produto, checkout e bot estiverem lendo a oferta MDV e testes de preço/link/pedido com dois sites passarem. Rascunhos e ofertas ocultas permanecem configuráveis antes disso.
- [x] Leitura estrita do JSON com somente `material_gramas` e `tempo_impressao_minutos`, ambos numéricos e referentes ao lote.
- [x] Cálculo de custo de filamentos, energia, máquina, mão de obra e complementos por lote e por peça, mantendo dinheiro em centavos.
- [x] Página administrativa inicial para importar o JSON, cadastrar preços de filamentos/insumos e simular custos; os preços usam a fonte compartilhada `admin_preferences`.
- [x] Validar localmente os cálculos e o contrato JSON com 5 testes automatizados; `npm run test:money` e `npm run build` passaram em 25/09/2026.
- [x] Gerar ficha de produção em JSON como rascunho exportável por SKU/revisão, conferindo o SKU na API central e incluindo o ID do produto, resumo da impressão, alocação manual de filamentos, insumos, tarifas e custo conferido. A pasta privada do Synology é apenas sugerida; nenhum arquivo é enviado ou salvo automaticamente.
- [x] Preparar persistência privada de fichas por produto e revisão e aplicar a migration `028_print3d_recipe_revisions.sql`. A API usa revisões imutáveis/idempotentes; o módulo continua desligado por padrão.
- [x] Preparar listagem e download administrativo das fichas salvas, sem expor os custos na API pública de produtos.
- [x] Preparar upload e download privados de arquivos da revisão no Synology, com pasta por SKU/revisão, limite de 50 MB por arquivo, hash SHA-256, metadados no MySQL somente após confirmação do NAS e verificação de integridade no download. O JSON enviado deve coincidir com material/tempo da ficha; G-code exige identificação manual de impressora e perfil.
- [x] Mostrar na ordem administrativa o arquivo principal e a revisão fixados na compra, com perfil da impressora, material/tempo por lote e download privado. Consulta e criação recusam ficha/arquivo incompatíveis com produto e SKU. Falta homologar a abertura de um arquivo real no Synology antes de usar em produção.
- [x] Preparar seleção administrativa da ficha principal por SKU: migration `030_print3d_active_recipe.sql`, referência à revisão e ao arquivo de fabricação escolhido, exigência de JSON conferido e atualização transacional sem apagar revisões anteriores. A seleção ainda não dispara ordens nem altera estoque.
- [x] Mapear o estoque central existente: `products.stock_quantity` representa o total cadastrado, `product_stock_locations` registra físico e reservado por local, e `production_days` já existe no cadastro do produto/categoria. O painel 3D agora consulta os saldos e o prazo do SKU sem criar estoque paralelo.
- [x] Preparar no cadastro central por SKU a marca de produto 3D, a opção de aceitar encomendas, o limite de unidades pendentes e o prazo individual em dias úteis. A migration `031_print3d_product_offer.sql` está aplicada; o checkout continua desabilitado.
- [x] Validar localmente o novo cadastro com 32 testes focados (incluindo contagem dos parâmetros SQL nas duas versões da API), teste monetário, sintaxe da API e build do frontend em 26/09/2026. A checagem geral TypeScript ainda aponta erros em componentes de outras áreas e dois erros preexistentes no `ProductForm.tsx`.
- [x] Preparar reserva atômica no endpoint de pedidos: trava por produto e locais, atualização condicional e movimento na mesma transação. Testes locais cobrem duas compras pela última peça, múltiplos locais e rollback se o movimento falhar. Ainda falta validação com MySQL real e auditoria dos outros escritores de estoque antes de abrir a loja 3D.
- [x] Identificar caminhos que ainda podem concorrer com essa reserva: baixa por prioridade, consumo/liberação da reserva, entradas/ajustes manuais e sincronização externa do Bling atualizam `product_stock_locations` fora de uma transação única; transferência entre locais já usa transação. A nova rota de reserva não deve ser publicada isoladamente como garantia de estoque compartilhado.
- [x] Validar localmente 21 testes focados (3D e reserva), 31 testes do núcleo de garantia assinada, teste monetário, sintaxe da API e build do frontend após as mudanças; checagem geral de TypeScript ainda encontra erros preexistentes em outras áreas. A etapa estática da suíte de garantia assinada falhou em comparação de texto do bot fora deste escopo. O teste estático legado de reserva Supabase não roda porque o arquivo histórico que ele lê não existe mais.
- [ ] Validar a página com uma exportação real do programa de impressão e com cadastro real em ambiente de teste.
- [ ] Homologar o controle físico de todos os insumos. A migration 050 está aplicada e as tabelas estão vazias; faltam cadastrar/conferir saldos iniciais e executar uma operação piloto. Receitas por SKU, revisões e ordens de produção já estão preparadas; a saída aprovada fica alocada ao pedido e não entra no estoque vendável.

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
- [x] Preparar cadastro por SKU de aceitação de encomendas, prazo de produção e limite de unidades pendentes; migration 031 aplicada e validada no banco operacional com as funções desligadas.
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
- [x] Preparar cancelamento antes da confirmação financeira, vencimento de PIX e liberação transacional das peças prontas por localização. Repetição não libera duas vezes; pagamento tardio vira evento de revisão/estorno e não reativa pedido ou produção. Produção iniciada e pedido pago seguem bloqueados para análise manual.
- [x] Preparar trabalhador idempotente de varredura de vencimentos, desligado sem `MDV_PRINT3D_EXPIRY_ENABLED=1` e sem checkout completamente pronto. Cada execução trava o pedido antes de liberar a reserva.
- [ ] Configurar e homologar a varredura, cancelamento no provedor e a revisão/estorno; não há automação ou cobrança real ativa nesta etapa.
- [x] Preparar alocação das peças aprovadas ao pedido, sem entrada no estoque vendável. Migration 046 e testes locais; falta homologação MySQL e consumo da alocação na expedição.
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
- [ ] Validar cadastro real de banner por site no painel. A migration 039 e o frontend já estão publicados; a operação real ainda precisa de conferência.
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
- [ ] Ativar a proteção MDV somente após homologação: a migration 037 está aplicada; faltam widget/chaves exclusivos `VITE_MDV_TURNSTILE_SITE_KEY` e `MDV_TURNSTILE_SECRET_KEY`, habilitações coordenadas e validação de hostname, proxy/IP, login, cadastro, confirmação WhatsApp e recuperação. A proteção permanece desabilitada.
- [x] Implementar localmente login Google 3D e vínculo explícito para quem já tem conta: rotas `/print3d/auth/google/*`, biblioteca oficial `google-auth-library`, cliente OAuth distinto do MDV, PKCE, state assinado com chave derivada, nonce e cookie próprios. Validar assinatura/audiência/emissor/expiração; retorno usa código temporário de uso único ligado a uma prova guardada no navegador, sem JWT de sessão na URL. Cadastro, identidade Google (`sub`) e sessão usam somente tabelas/chaves 3D. E-mail existente não une contas automaticamente: entrar na conta e escolher Vincular Google. Contas Google com e-mail externo a Gmail/Workspace exigem confirmação local por e-mail antes do primeiro vínculo. WhatsApp não é confirmado pelo Google e continua obrigatório para encomendas.
- [x] Testes locais cobrem identidade estável mesmo após mudança do e-mail Google, callback adulterado/expirado, audiência MDV, nonce/cookie inválidos, código usado duas vezes ou em outro navegador, conta inativa, vínculo com sessão ausente e Google pertencente a outra conta. Teste Chrome confirma conclusão única do callback e sessão MDV intacta. Provedor Google e banco simulados; não houve autenticação real ou envio.
- [ ] Criar cliente OAuth Web exclusivo 3D. A migration `038_print3d_google_accounts.sql` está aplicada; faltam credenciais, URI HTTPS exata, domínio canônico, cookies, CORS/proxy/CSP, Turnstile e teste real de login/vínculo/recuperação. `MDV_PRINT3D_GOOGLE_ENABLED` permanece desligada.
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
| 4. Arquivos e revisões | Em andamento | Rascunho, migrations 028–030, API, seleção e tela privadas preparadas; a OP mostra a revisão e o arquivo fixados na compra. Faltam aplicação das migrations e teste real no NAS. |
| 5. JSON mínimo | Em andamento | Parser estrito e testes locais; falta arquivo real e vínculo à ficha. |
| 6. Insumos e calculadora | Em andamento | Tela, preços compartilhados, simulação e saldos físicos de filamentos e demais insumos com baixa por OP preparados localmente; faltam homologação MySQL e piloto. |
| 7. Estoque e encomendas | Em andamento | Reserva atômica e OP vinculada à demanda estão preparadas localmente; faltam teste no MySQL, conferência dos saldos iniciais e auditoria dos outros escritores de estoque. |
| 8. Produção | Em andamento | Plano financeiro, OP parcial, peças alocadas ao pedido e baixa de filamentos/insumos integrados localmente; faltam fila por capacidade e homologação MySQL. |
| 9. Vitrine e integrações | Em andamento | Vitrine, catálogo por site, frete, checkout, duas cobranças PIX, cancelamento/expiração e registro transacional de expedição preparados com testes simulados; faltam site/domínio independentes, homologação real e documento fiscal. |
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
- [x] Implementar localmente cancelamento/expiração/abandono e liberação rastreável de reservas, considerando pagamento tardio. O fluxo permanece desligado e ainda exige agendamento/homologação em MySQL e provedor antes de ativar pedidos reais.
- [ ] Homologar migrations e concorrência com MySQL isolado, provedor e webhook reais de teste.
- [x] Aplicar localmente as migrations 028–050 em MySQL 8.4 descartável sobre schema central mínimo; corrigir collations incompatíveis nas chaves de cliente das migrations 034/042 e verificar separação dos pedidos e saldos não negativos. Ainda faltam uma cópia estrutural fiel do banco central, demais caminhos de alteração de estoque e provedor de teste.
- [x] Executar checkout 3D real em MySQL descartável com dois compradores pela última peça, rollback após falha na criação da produção e disputa entre checkout 3D e a rota central de reserva por prioridade. Os três cenários preservaram uma única reserva ou reverteram tudo; ainda faltam os demais escritores de estoque e um schema fiel ao banco de operação.
- [x] Tornar a baixa central por prioridade transacional e compatível com a trava por produto do checkout 3D. MySQL local confirmou disputa pela última peça, sincronização de `products.stock_quantity` e rollback quando o movimento falha. Ainda faltam consumo/liberação de reservas, ajustes manuais e sincronização externa sob a mesma disciplina.
- [x] Tornar consumo/liberação de reservas MDV transacionais, com trava do pedido e produtos, repetição sem segunda baixa e bloqueio de operação oposta. MySQL local confirmou preservação de reservas de outro pedido, rollback e rejeição de pedidos 3D. Restam ajustes/entradas manuais, sincronização externa e auditoria de histórico parcialmente processado.
- [x] Tornar entradas e ajustes manuais transacionais, preservando as reservas sob trava por produto/local. MySQL local confirmou entrada concorrente com reserva, ajuste limitado pelo reservado, rollback de erro no movimento e duas entradas no mesmo local novo sem duplicar saldo. Sincronização externa e auditoria de histórico continuam pendentes.
- [ ] Integrar quitação à trava de expedição e concluir os fluxos de estoque/fiscal pendentes.

Detalhes e configuração futura: `docs/print3d-checkout.md`. Tudo permanece local e desabilitado por padrão.

### Incremento local — 27/09/2026: expedição 3D

- [x] Preparar registro único da expedição por pedido com rastreio e migration 049, sem aplicação no banco.
- [x] Exigir quitação integral no registro financeiro e status não estornado; conferir todas as quantidades prontas reservadas e produzidas antes de enviar.
- [x] Baixar estoque pronto e alocação de produção na mesma transação, com replay sem segunda baixa e separação dos pedidos MDV.
- [x] Preparar ação administrativa e exibição do rastreio na área do cliente, condicionadas à flag `MDV_PRINT3D_DISPATCH_ENABLED` desligada por padrão.
- [ ] Homologar em MySQL isolado, conferir documento fiscal e envio físico antes de ativar a ação em operação real.

### Incremento local — 27/09/2026: saldo físico dos demais insumos

- [x] Cadastrar unidade de medida dos insumos na calculadora e preservá-la na revisão imutável da ficha; receitas antigas sem unidade assumem `un`.
- [x] Preparar migration 050, entradas idempotentes, saldo e movimentos separados do estoque vendável; embalagem por peça aparece como insumo físico quando configurada.
- [x] Apontar quantidades reais por insumo da ficha e baixar saldos na mesma transação de filamentos e produção; zero explícito é permitido em lotes sem consumo.
- [x] Preparar visualização e entrada administrativa, privadas e desabilitadas com o módulo de produção.
- [ ] Testar unidade, saldo inicial, lotes parciais, falta de insumo e concorrência em MySQL isolado.

### Incremento local — 27/09/2026: operação por loja no painel

- [x] Seção Loja 3D com Clientes, Pedidos, Produção, Calculadora, Catálogo/preços e Banners.
- [x] Clientes e pedidos 3D em consultas administrativas próprias, autenticadas, paginadas e sem fontes MDV como alternativa.
- [x] Listagem de pedidos MDV exclui origens 3D/desconhecidas antes de carregar itens; pedidos antigos sem origem continuam MDV.
- [x] Banners fixos por marca nas respectivas rotas e edição comercial exclusiva 3D; publicação central por SKU preservada.
- [x] Alertas de vendas e monitoramento do bot MDV não aparecem na área 3D.
- [x] Estados desativados explícitos sem consulta a tabelas ainda não habilitadas; testes com dados simulados.
- [ ] Publicar este incremento, validar as telas autenticadas e ativar cadastros/pedidos somente após homologação das pendências anteriores.
- [ ] Concluir expedição e documentos próprios da loja 3D; definir comunicações 3D no n8n separado antes da ativação.

Compartilhados: cadastro técnico, SKU, imagens, características e estoque. Clientes, credenciais, pedidos, preços por site, banners e comunicação permanecem identificados por loja. A nova área é de consulta: ações reais de cadastro/pagamento/produção continuam nas travas de ativação existentes.

### Incremento local — reconciliação externa e reservas compartilhadas

- [x] Reconciliar total externo, locais e movimentos em uma transação com trava por produto; preservar unidades reservadas nos locais originais durante reentrada.
- [x] Recusar saldo externo menor que o reservado (`external_stock_below_reserved`) sem apagar reservas; o total central permanece igual à soma física local.
- [x] Remover gravação antecipada do total nos caminhos revisados de webhook e sincronização de preços/estoque. A resposta em lote informa falhas e o cliente não trata HTTP 200 parcial como sucesso.
- [x] Validar em MySQL 8.4 descartável: conflito com reserva, reentrada, rollback por falha do movimento e concorrência; cinco testes focados e build local passaram.
- [ ] Auditar os demais escritores de estoque (edição/importação genérica, estoque serializado e inicialização), histórico parcial e eventos externos fora de ordem antes da homologação integral.
- [ ] Atualizar a regressão legada `bling-sync-prices-vps-regression.test.mjs`: depende de `api/bling.ts`, ausente no repositório atual. Ela não pôde executar.

Sem publicação ou escrita em banco operacional nesta etapa.

### Incremento local — edição individual de produto e reservas

- [x] A rota `PUT /products/:id` deixa de gravar o total diretamente. Quando o saldo é informado, reconcilia locais/movimentos na mesma transação do cadastro; omitir saldo preserva o estoque.
- [x] Saldo abaixo do reservado recusa a edição com HTTP 409; erro posterior ao ajuste reverte saldo e cadastro juntos.
- [x] MySQL descartável validou rollback, recusa e confirmação conjunta. Dois testes do handler das APIs e 12 verificações dos grupos de preços passaram.
- [ ] A importação `/products/batch` ainda possui escrita direta de saldo no upsert: adaptar junto à identidade efetivamente resolvida pelo conflito de chave, sem criar saldo em um ID diferente do produto atualizado.

Alteração local; sem publicação, commit ou mudança no banco operacional.

### Incremento local — importação em lote e estoque compartilhado

- [x] Cada item de `/products/batch` confirma cadastro, locais, movimentos e total em uma transação. Produtos novos iniciam com zero e recebem saldo pelo reconciliador; estoque omitido preserva o saldo existente.
- [x] Saldo abaixo das reservas reverte o item e entra em `errors`. Os outros itens do lote mantêm processamento independente, conforme contrato existente.
- [x] Preservar resolução existente pelo Bling e recusar conflito de chave que aponte para outro ID. Avisos de conversão/identidade no MySQL revertem o item; aviso 1287 de sintaxe VALUES depreciada é informativo.
- [x] Cliente da API reconhece falhas por item mesmo com HTTP 200.
- [x] Handler e SQL reais testados em MySQL descartável com schema mínimo ampliado: novo saldo, omissão, rollback, conflito de SKU e disputa com reserva. Mais 16 testes focados e build passaram.
- [ ] Homologar com schema central fiel, resolução de Bling/IMEI real e demais escritores genéricos/serializados/inicialização. A pendência anterior específica do upsert `/products/batch` foi atendida neste incremento; a auditoria integral continua.

Somente local; alterações anteriores preservadas, sem commit ou publicação.

### Incremento local — distribuição de saldo ainda sem local

- [x] Reutilizar `externalStockReconciliation.cjs` para materializar somente o saldo ainda não distribuído. O total central é lido depois da trava do produto; saldo já distribuído não é somado outra vez.
- [x] Confirmar local e movimento juntos, preservando reservas; falha no movimento reverte a distribuição.
- [x] MySQL local confirmou duas distribuições simultâneas com um único saldo/movimento, repetição após reserva e rollback. Quatro verificações focadas e sintaxe das APIs passaram.
- [ ] Revisar separadamente a carga inicial legada e `syncSerializedProductStockFromUnits`: esta rotina apaga/recria locais e usa quantidade de unidades disponíveis como total, enquanto os locais incluem disponíveis e reservadas. A regra não pode ser substituída automaticamente pela contagem física dos produtos comuns.

Sem publicação ou escrita operacional.

### Incremento local — carga inicial dos locais de estoque

- [x] `backfillProductStockLocations` usa a transação canônica, relê o saldo sob trava por produto e conserva o destino Loja Principal / Estoque Geral.
- [x] Não altera produtos que ganharam distribuição depois da seleção inicial; histórico `initial_migration` impede uma segunda inicialização se os locais desaparecerem.
- [x] MySQL descartável confirmou inicialização simultânea única, preservação de reserva e recusa de recriação com histórico. Quatro regressões focadas e sintaxe passaram.
- [ ] Compatibilidade IMEI/checkout 3D: checkout reserva quantidade por local, enquanto sincronização serializada deriva reservas das unidades e apaga/recria locais. É necessário tratar a identidade das reservas/unidades antes de considerar esse caminho homologado entre lojas. Nenhuma alteração desse fluxo serializado foi publicada ou aplicada.

Alterações somente locais, sem commit ou publicação.
- Validação adicional: contrato VPS de locais passou. O teste legado `multi-deposit-stock-migration-static.test.mjs` não executou porque aponta para a migration Supabase removida `20260509000001_multi_deposit_stock.sql`; não foi tratado como validação do MySQL atual.

### Incremento local — concorrência de entradas e consumo de insumos

- [x] Testar entradas simultâneas com a mesma chave em MySQL real descartável. Foi reproduzido `ER_DUP_ENTRY`: a leitura comum do histórico mantinha snapshot anterior à espera pela trava de saldo.
- [x] Corrigir ambos os serviços para consultar o movimento anterior com `FOR UPDATE`, reconhecendo a tentativa concluída pela transação concorrente. Uma entrada efetiva e um replay, sem duplicar saldo.
- [x] Executar os serviços reais de consumo de filamento e insumos numa transação com evento real: falta de acessório reverte filamento e evento; duas transações concorrentes deixam apenas um consumo confirmado.
- [x] Quatro testes unitários e teste MySQL completo passaram; sintaxe dos módulos válida.
- [ ] Repetir pela rota completa de apontamento/receita/pagamento com schema fiel e UI autenticada. O teste de consumo deste incremento monta explicitamente a transação e evento, não substitui a homologação ponta a ponta.

Somente ambiente local, sem publicação ou mensagens externas.

### Decisão de escopo — produtos 3D sem IMEI

O usuário confirmou que produtos 3D não possuem IMEI. O checkout e a produção 3D seguem por quantidade/SKU. A integração de seleção de aparelhos individuais no checkout 3D deixa de ser requisito; as observações anteriores sobre estoque serializado ficam como diagnóstico do legado MDV, não como bloqueio para esse recurso da loja 3D.

### Incremento local — rota de apontamento e consulta do cliente

- [x] Testar rota Fastify real com MySQL descartável, plano versão 1, recibo e ficha de teste: apontamento 20/100, tentativa simultânea repetida e consulta do cliente.
- [x] Reproduzir e corrigir erro de chave duplicada na repetição: a referência imutável do pedido é lida antes de abrir a transação, evitando snapshot antigo antes da espera pela trava do pedido. Ordem das travas pedido → produção preservada.
- [x] Confirmar progresso 20/100, uma única ocorrência no histórico e 20 peças reservadas ao pedido na resposta do cliente, sem ator ou ficha privada.
- [x] Falta de acessório pela rota completa reverte consumo de filamento, evento e progresso; 31 regressões de produção passaram.
- [ ] Testar interface autenticada e schema fiel. Neste teste, principais de admin/cliente são simulados e recibo/ficha são fixtures locais; não há gateway nem NAS real.

Sem deploy ou escrita externa.

### Incremento local — navegador integrado ao MySQL descartável

- [x] Exercitar componentes reais de admin/cliente sem `demo=1`, com Playwright encaminhando somente as rotas 3D ao Fastify local e seu MySQL descartável. Demais chamadas de API/rede externa são bloqueadas.
- [x] Registrar mais 20 peças na tela administrativa e confirmar 20/100 → 40/100 na tela do cliente; nota interna não aparece para o cliente.
- [x] Informar consumo de acessórios acima do saldo, conferir mensagem de erro e manutenção de 40/100 em ambas as telas.
- [x] Simulação visual anterior também passou: 20 → 40 → 100, limite de quantidade e privacidade.
- Execução opcional: com Vite local em `127.0.0.1:3000`, definir `PRINT3D_MYSQL_BROWSER=1` e executar `npm run test:print3d:mysql`.
- Limites: páginas de preview montam os componentes sem layout/guard de login; credenciais e resolução de principal são fixtures separadas, preferências de custos são simuladas. Persistência, handlers e SQL de produção são reais no banco descartável. Isso não homologa login, NAS, gateway ou banco operacional.

Sem publicação, alteração de dados reais ou envio externo.

### Incremento local — expedição no MySQL descartável

- [x] Exercitar a rota de expedição real com pedido/ficha/recibos de teste: recusar saldo financeiro pendente e produção incompleta; concluir produção e aceitar somente após quitação.
- [x] Duas expedições simultâneas com o mesmo rastreio retornam envio/replay, com um registro e 100 peças produzidas marcadas como expedidas; rastreio diferente é recusado.
- [x] Exercitar estoque pronto no serviço real: baixa de uma reserva preserva a reserva de outro pedido; repetição não baixa novamente e o total central acompanha os locais.
- [x] Forçar falha no movimento após baixa e confirmar rollback do saldo. Quatro testes unitários e regressão MySQL passaram.
- Estrutura mínima do teste ampliada com `orders.updated_at` e `stock_location_movements.created_by`, usados pela expedição. Ainda não equivale a schema operacional fiel.
- [ ] Validar expedição pela interface, documento fiscal, integração de transporte e gateway de homologação. Recibos usados aqui são fixtures inseridas apenas no MySQL descartável.

Nada publicado ou aplicado em operação real.

### Incremento local — expedição na interface móvel

- [x] Teste Playwright em viewport 390×844 com componente administrativo real, listagem Fastify real e MySQL descartável.
- [x] Buscar o pedido, preencher rastreio, confirmar a ação, verificar rastreio atualizado e remoção do formulário de expedição.
- [x] Consulta posterior ao banco confirmou preservação da reserva de outro pedido; tentativas seguintes foram replay sem segunda baixa.
- [x] Executado junto à produção no navegador com `PRINT3D_MYSQL_BROWSER=1 npm run test:print3d:mysql`.
- Limites permanecem: página de preview sem guard/layout completo, sessão administrativa fixture, banco mínimo e ausência de transportadora/fiscal/gateway reais. Todos os pedidos usados são descartáveis e a confirmação na tela não representa envio físico real.

Nenhuma publicação nesta etapa.

### Incremento local — cancelamento e primeira expiração no MySQL

- [x] Cancelamento concorrente libera a reserva uma vez, conserva reserva de outro pedido e deixa um evento de auditoria; cliente de outro pedido e pedido com pagamento confirmado são recusados.
- [x] Falha no movimento após reduzir a reserva reverte saldo e ledger.
- [x] Reproduzir erro MySQL 3065 na seleção da expiração (`DISTINCT` + ordenação fora da projeção) e substituir por agrupamento de pedido com ordenação por menor atualização e ID.
- [x] Expiração de PIX de teste passou no MySQL; dez testes focados de cancelamento/rotas/trabalhador passaram.
- [ ] Auditar paginação/fairness do varredor: os primeiros candidatos ainda podem estar no futuro ou exigir análise de estorno e impedir avanço para outros vencidos. Não habilitar o trabalhador operacional antes dessa revisão e homologação do cancelamento no provedor.

Somente MySQL descartável e fixtures; não houve cancelamento, estorno ou mensagem externa real.

### Incremento local — avanço da expiração entre candidatos

- [x] Paginar candidatos por ID estável, sem OFFSET; cancelamentos removem linhas da consulta e não fazem pular pedidos seguintes.
- [x] Tratar `limit` como máximo de cancelamentos efetivos, continuando a leitura quando candidatos estão no futuro ou já exigem análise.
- [x] Conflitos 404/409 não interrompem os demais candidatos; seus IDs retornam em `review_order_ids` e o trabalhador registra somente a contagem, sem dados pessoais. Erros inesperados continuam visíveis como falha da execução.
- [x] MySQL local validou páginas de um item: cobrança futura preservada, pedido pago sinalizado e terceiro pedido vencido cancelado na mesma execução. Sete testes focados passaram.
- [ ] Homologar volume, acompanhamento das revisões e cancelamento/retry no provedor antes de ativar. A varredura pode percorrer muitas páginas quando houver muitos candidatos ainda não vencidos.

Trabalhador não ativado em produção; nenhuma cobrança externa cancelada.

### Incremento local — nova tentativa de cancelamento no provedor

- [x] Separar cobrança cancelada localmente (`cancelled`) da confirmação remota (`provider_cancelled`); a projeção pública continua mostrando `cancelled`, sem PIX ativo.
- [x] Trabalhador configurado reencontra até 100 pedidos 3D cancelados com cobranças ainda pendentes de confirmação remota. A fila é derivada do banco, não da memória; cobranças confirmadas/recebimentos tardios não são reenviados.
- [x] Falhas ou revisão atualizam a data da tentativa para ordenar próximas execuções. Repetição manual de cancelamento também pode retentar cobranças sem desfazer o cancelamento local.
- [x] Teste MySQL com adaptador simulado: timeout → nova instância do trabalhador → confirmação remota → execução sem chamada repetida. Pedido permaneceu cancelado; 39 regressões focadas passaram.
- [ ] Homologar comportamento do provedor real e cobranças criadas remotamente sem ID persistido durante cancelamento concorrente; acompanhar pendências na UI. O teste não fez requisições externas.

Flags operacionais continuam desligadas; nada publicado.

### Incremento local — resposta do PIX após cancelamento

- [x] Persistir o identificador remoto verificado quando a resposta de criação chega depois do cancelamento local, preservando o estado terminal da cobrança e do pedido.
- [x] Não expor código PIX, não criar recibo e não reabrir pedido; manter a cobrança local disponível para reconciliação/cancelamento remoto.
- [x] MySQL real descartável com criação suspensa no adaptador → cancelamento local → resposta remota pendente → identificação persistida → encerramento remoto simulado. 33 testes focados também passaram.
- [ ] Homologar timeout sem retorno nem webhook: recuperação da identidade remota precisa ser definida antes de ativar o fluxo real. O teste cobre resposta tardia recebida, não uma resposta permanentemente perdida.

Sem qualquer requisição ao gateway real ou publicação.


### Recuperação de PIX com resposta perdida — validação local

- Cobranças de pedidos 3D cancelados sem identificador remoto entram na reconciliação persistente.
- A busca usa `external_reference=print3d:<charge.id>` na API de pagamentos do Mercado Pago. Exige um único resultado, valida conta recebedora, moeda, método e valor, e consulta novamente o pagamento pelo ID antes de cancelar.
- Busca vazia, ambígua ou incompatível mantém a pendência para nova conferência. Nunca cria outro PIX nem reabre pedido cancelado. Pedidos ativos e de outros canais são excluídos na consulta SQL.
- Evidência: 38 testes focados passaram; MySQL 8.4 local descartável passou incluindo resposta perdida, busca inicialmente vazia, recuperação após recriar o trabalhador e ausência de recibos indevidos. Provedor simulado, sem chamadas financeiras reais.
- Limitação: homologação real permanece pendente. A documentação do provedor limita a busca aos últimos 12 meses; ausência de resultado não prova que a cobrança nunca existiu. Pendências antigas exigem conferência administrativa.
- Referência oficial: https://www.mercadopago.com.br/developers/en/reference/online-payments/subscriptions/search-payments/get


### Avisos administrativos de reconciliação PIX — local

- Pedidos 3D agora expõem contagem de cobranças cujo cancelamento remoto ainda está pendente e contagem/valor de pagamentos tardios, usando exclusivamente `print3d_payment_charges` do pedido.
- O cartão de pedido mostra avisos distintos para conferência de cancelamento e análise de estorno. Valores tardios continuam separados dos recibos confirmados; o aviso não executa estorno.
- Validação: 8 testes focados, build Vite e navegador móvel com APIs interceptadas passaram. MySQL local confirmou o aviso pendente e sua remoção após reconciliação. Nenhuma publicação ou chamada financeira real.
- Pendente: fluxo administrativo de resolução/estorno com rastreabilidade e homologação real do provedor.


### Reconciliação de estorno de pagamento tardio — local

- O trabalhador agora revisita cobranças `late_payment` de pedidos cancelados por consulta ao provedor. Não solicita estorno automaticamente.
- Uma resposta autenticada e correspondente à cobrança com status `refunded` e valor integral estornado encerra a pendência daquela cobrança. A ordem permanece cancelada e nenhum recibo de compra é criado.
- Estornos parciais continuam em revisão. Notificações antigas de cancelamento não apagam um pagamento tardio; notificações antigas de aprovação não reabrem uma cobrança já estornada.
- Painel mostra a quantidade de estornos integrais confirmados separadamente. O evento histórico de pagamento tardio permanece preservado.
- Evidência: 45 testes focados, integração MySQL descartável (incluindo parcial, integral, repetição, histórico e listagem real), navegador móvel com APIs interceptadas e build passaram.
- Pendentes: solicitação administrativa de estorno e homologação real. Nenhuma operação financeira externa ou publicação executada.


### Notificações simultâneas de pagamento — correção validada

- Teste novo com MySQL descartável bloqueia o pedido, recebe duas notificações do mesmo PIX e libera ambas. Antes da correção, havia um único recibo, porém a segunda resposta retornava cobertura financeira desatualizada.
- A referência imutável cobrança → pedido é consultada antes de iniciar a transação. A liquidação continua travando pedido e cobrança; as leituras de recibos passam a enxergar o resultado da notificação anterior.
- Após a correção, ambas retornam o valor integral confirmado e o banco contém exatamente um recibo. 35 testes focados e a suíte MySQL passaram. Nenhum banco operacional ou provedor real foi usado.


### Aplicação pública 3D independente — primeira entrada local

- `apps/print3d` contém HTML e entrada React próprios, reutilizando as telas canônicas de loja, conta, checkout, pedidos e produção. Não inicializa App/rotas/admin, analytics, favicon, cashback ou manutenção globais do Mercado do Vale.
- `npm run dev:print3d`: servidor exclusivo em `http://127.0.0.1:3002`. Prévia visual: `/?demo=1`. As APIs desse servidor respondem 503 por padrão; não há proxy para produção.
- `npm run build:print3d`: gera `dist-print3d`, separado de `dist`, sem copiar a pasta pública MDV nem ler seus arquivos `.env`. Clientes compartilhados de catálogo usam um adaptador sem sessão administrativa; as contas 3D conservam seu cliente próprio.
- Validação: build independente passou; Playwright móvel percorreu loja/conta e rejeitou `/admin/login`, com APIs interceptadas. Uma sessão MDV fictícia gravada no navegador não foi enviada, não houve chamada externa nem consultas globais MDV.
- Esta etapa não conclui a separação operacional: permanecem URLs com prefixo `/loja-3d`, gateway/proxy próprio com escopo de canal, callbacks/origens, domínio, SEO definitivo, implantação e homologação completa. O ERP e a prévia atual continuam disponíveis no build existente.


### Gateway local exclusivo da vitrine 3D

- `services/print3dPublicProxy.cjs` aplica lista explícita de rotas/métodos e parâmetros: catálogo publicado 3D, categorias compartilhadas, banners 3D, conta, frete, checkout, pedidos e produção do cliente. O servidor central continua validando sessão, preços e autorização.
- Rotas administrativas, CRUD genérico, outro canal, webhook, parâmetros duplicados e caminhos normalizados/escapados são recusados. Cookies, chaves sync e cabeçalhos de encaminhamento do navegador não são retransmitidos. Bearer só segue para rotas `/print3d/`.
- Configuração opcional de desenvolvimento: `PRINT3D_LOCAL_API_ORIGIN=http://127.0.0.1:<porta>` antes de `npm run dev:print3d`. Só aceita origem HTTP loopback explícita, sem credenciais/caminho. Sem variável, permanece 503. Nenhuma origem real foi configurada.
- Testes com dois servidores HTTP locais validaram encaminhamento, isolamento, limites de corpo e bloqueio de redirecionamento externo. Teste móvel da vitrine e build independente passaram.
- Pendente para implantação: proxy de produção com credencial própria e política de origem/IP confiável, callbacks Google e homologação ponta a ponta. O gateway local não se apresenta como proxy de produção concluído.


### Vitrine → gateway → API local: teste integrado de navegador

- Novo teste `node tmp-tests/print3d-standalone-gateway-browser.cjs` inicia API HTTP fixture e Vite em portas aleatórias, executa catálogo/conta/pedidos pelo proxy real e encerra somente seus processos. Chamadas locais não são interceptadas; rede externa é bloqueada.
- Reproduziu erro na tela do cliente: pedido cancelado ainda consultava a rota de pagamento, que corretamente recusava a operação. A tela agora limpa dados transitórios e não consulta pagamentos de pedidos cancelados, estornados ou com falha. Pedidos ativos continuam consultando normalmente.
- Verificados: catálogo não demo, sessão 3D fixture, navegação até pedidos, estados cancelado/estornado/falha/ativo, ausência de token MDV, bloqueio da rota administrativa e nenhum erro de execução.
- 11 testes focados e build independente passaram. Este teste usa respostas/credenciais fictícias de API, não autenticação real, MySQL ou gateway financeiro; essas integrações continuam exigindo homologação própria.


### Contas por e-mail com MySQL descartável

- Cenário `tmp-tests/print3d-accounts-mysql-scenario.cjs`, chamado pela suíte MySQL, registra rotas reais de conta 3D e usa hash scrypt, tokens, sessão assinada e limitador transacional reais.
- Confirmou cadastro, recusa de login antes de verificar e-mail, prova de uso único, login, recusa de assinatura no formato MDV (HMAC com segredo direto), cinco senhas erradas e bloqueio subsequente com `Retry-After: 900`.
- Recuperação por e-mail durante o bloqueio funcionou; redefine senha, limpa bloqueio da conta, incrementa versão de autenticação e invalida a sessão antiga. Token de recuperação não pode ser reutilizado.
- Suíte MySQL passou. CAPTCHA e envio de e-mail são adaptadores simulados; não houve mensagens reais. Ainda falta homologar WhatsApp/Google completos, navegador com login real e entregabilidade/configuração externa.


### Contas por WhatsApp, CPF e recuperação com MySQL descartável

- Ampliado `tmp-tests/print3d-accounts-mysql-scenario.cjs` com rotas reais e tabelas exclusivas 3D para gerar/conferir/consumir código de WhatsApp.
- Validou código errado, vínculo da prova ao telefone, uso único, cadastro sem e-mail, data de WhatsApp confirmado e login por telefone ou CPF com a mesma senha.
- Alternar telefone e CPF nas cinco falhas não contorna a trava: o sexto acesso é bloqueado pela conta. Recuperação por WhatsApp durante a trava redefine senha, invalida a sessão anterior e permite novo login por ambos os identificadores.
- O teste avança somente o relógio de reenvio do código em 61 segundos para respeitar o intervalo entre mensagens; não avança o bloqueio de login de 15 minutos.
- Suíte MySQL passou. CAPTCHA e envio WhatsApp/e-mail foram simulados e permaneceram locais. Não valida n8n, número real, entrega de mensagens nem a interface completa de cadastro.


### Google 3D com MySQL descartável

- Novo cenário `tmp-tests/print3d-google-mysql-scenario.cjs`, executado após os cenários de conta na suíte MySQL, usa rotas Google reais, migrations, transações, hash scrypt e sessão 3D assinada.
- Validou prepare → start → callback → exchange, comprovante ligado ao navegador, troca simultânea do mesmo código (um sucesso e uma recusa), retorno pelo identificador estável Google, recusa de união automática por e-mail, vínculo explícito à conta autenticada, uso único e conta desativada.
- Suíte MySQL e 9 testes de Google/sessão passaram. Identidade/token Google e CAPTCHA são simulados; não houve acesso à conta Google real. A autenticação da sessão usada no vínculo foi consultada no banco de teste.
- Pendentes: credenciais OAuth próprias, callbacks/origens reais, cookies HTTPS no navegador e teste de autenticação ponta a ponta no domínio separado. O proxy público local não encaminha start/callback OAuth; estes permanecem no host de callback configurado.


### Preservação da sessão durante falhas temporárias

- Corrigido `print3dAccountClient.me()`: erro de rede, 429 e indisponibilidade da API não apagam mais a sessão 3D. Apenas resposta 401 encerra a sessão consultada; resposta atrasada não remove um token de login posterior.
- A tela de conta trata a falha de consulta e exibe o erro, evitando rejeição não tratada. Quando o serviço volta, a sessão preservada permite consultar a conta novamente.
- Dois testes de cliente cobrem matriz de erros e corrida entre sessões. O navegador via gateway HTTP local confirmou 503 com token preservado, recuperação após 200 e remoção após 401. Build independente passou.
- Tudo local, API fixture; não altera duração de sessão, validação de senha, bloqueio de tentativas ou autenticação no servidor.


### Cadastro pela vitrine independente até MySQL local

- Teste opcional: definir `PRINT3D_MYSQL_ACCOUNT_BROWSER=1` e executar `npm run test:print3d:mysql`. O teste cria Vite/API em portas aleatórias, usa as rotas de contas reais e MySQL descartável e encerra os recursos próprios. Não usa sessão pré-fabricada para o cliente desse cenário.
- Confirmou formulário de cadastro por e-mail, conta inicialmente não verificada, confirmação pelo link capturado, login com senha real e restauração da sessão após recarregar. Nenhuma chamada externa permitida.
- Adicionada configuração explícita `PRINT3D_PUBLIC_TURNSTILE_SITE_KEY` no build separado, mapeada para a chave pública usada pelo cliente 3D. Segredo de validação continua somente no servidor; nenhum arquivo `.env` MDV é carregado.
- Teste integrado e build passaram. Widget CAPTCHA, validação no provedor e envio de e-mail são simulados; CAPTCHA/entrega reais permanecem pendentes de homologação.


### Cadastro WhatsApp pela interface até MySQL local

- Ampliado o modo `PRINT3D_MYSQL_ACCOUNT_BROWSER=1`: o navegador sai da conta de e-mail, cadastra outra conta somente com WhatsApp/CPF, recebe código pelo adaptador local, testa código incorreto e confirma o correto.
- Banco real descartável confirmou e-mail nulo, CPF correto e WhatsApp validado. A interface apresentou a confirmação após cadastro e após login separado por telefone e por CPF; sair removeu a sessão 3D.
- Teste integrado passou por vitrine independente → proxy HTTP local → rotas reais → MySQL, sem interceptar as APIs. CAPTCHA e transporte de mensagens continuam simulados; nenhum WhatsApp real ou alteração de n8n ocorreu.


### Autenticação real ligada ao checkout no MySQL local

- Novo cenário `tmp-tests/print3d-account-checkout-mysql.cjs` é instalado no mesmo Fastify das contas reais. Usa sessões emitidas por login, validação de versão, checkout, reserva, plano e criação de OP canônicos.
- Conta com e-mail confirmado e sem WhatsApp validado teve encomenda recusada (403), mesmo enviando campo de validação forjado no corpo. Estoque reservado permaneceu zero após a recusa. A mesma conta conseguiu comprar uma unidade pronta.
- Conta com WhatsApp confirmado criou encomenda de duas peças; pedido ficou exclusivamente vinculado ao cliente 3D, OP aguardando entrada, ficha/arquivo corretos fixados. Entrada de 70% com frete proporcional resultou em 1750 centavos sobre total de 2500.
- Sessão MDV inválida foi recusada e outra conta 3D recebeu 404 ao consultar o pedido alheio. Suíte MySQL passou.
- Catálogo/frete e metadados NAS são fixtures locais; não houve cotação externa, cobrança, fabricação nem acesso a arquivo real.

### Checkout pela vitrine independente até MySQL local

- Corrigida a lista de rotas do proxy local: `POST /storefronts/loja_3d/quote` era bloqueado, impedindo conferir produtos e entrega. Rotas de outros canais e parâmetros extras continuam recusados.
- O cenário opcional `PRINT3D_MYSQL_ACCOUNT_BROWSER=1` agora finaliza uma encomenda após cadastro e login reais pela interface. Todas as chamadas locais passam por HTTP até o Fastify e o MySQL descartável.
- Exercita frete no saldo, frete inteiro na entrada, entrada abaixo de 50% bloqueada e entrada de 70% com frete proporcional. Confere pedido exclusivo do cliente 3D, OP com duas peças aguardando pagamento, carrinho limpo e consulta do pagamento após a criação.
- Produtos do cenário usam SKU e quantidade, sem IMEI. A cotação do catálogo e da transportadora usa fixtures; autenticação, criação do pedido, plano financeiro e OP usam os serviços reais. Nenhuma cobrança externa é criada.

### Acompanhamento de produção na vitrine independente

- Ampliado o cenário MySQL/navegador para seguir o mesmo pedido criado na tela até a produção parcial e concluída. A conta autenticada consulta a rota real pelo proxy local; a API filtra exclusivamente suas OPs, mesmo havendo pedidos de outras contas no banco.
- Antes da entrada, o apontamento administrativo é recusado. Após liquidação pelo serviço canônico com provedor simulado, a OP é liberada; entrada física de filamento e apontamentos usam serviços reais no MySQL descartável.
- Verificações: uma de duas peças aparece como produção parcial, repetição do lançamento não duplica quantidade, peças ficam reservadas ao pedido e dados internos (observações, operador, ficha, arquivos, filamentos e perdas) não são expostos na resposta ao cliente.
- O teste aguarda a atualização automática normal de 30 segundos para mostrar a segunda peça concluída; finalizar produção não quita o saldo. Nenhuma consulta externa, cobrança real ou alteração de produção foi feita.

### Saldo e rastreamento pela vitrine independente

- O mesmo cenário com conta real e pedido criado pela interface agora gera o PIX do saldo de 750 centavos pelos endpoints reais, usando exclusivamente um provedor simulado em memória.
- Expedição recusada após finalizar a produção sem quitar o saldo. Clicar em “Já paguei” com provedor ainda pendente mantém o bloqueio. Após aprovação simulada e consulta pela interface, os dois recebimentos somam 2500 centavos e o pedido apresenta pagamento completo.
- Expedição pela rota administrativa real registra as duas peças produzidas; repetir o envio com o mesmo rastreio não duplica a saída. A consulta autenticada da conta 3D mostra o código de rastreamento e saldo zero.
- Suíte MySQL com `PRINT3D_MYSQL_ACCOUNT_BROWSER=1` passou, incluindo a jornada cadastro → checkout → produção parcial/concluída → saldo → rastreamento. Catálogo, transportadora, CAPTCHA, mensagens e provedor financeiro ainda são simulados; essa evidência não substitui homologação externa ou publicação.

### Identificação de variantes 3D na vitrine

- O seletor e a busca passaram a incluir material, cor, tamanho e acabamento dos atributos existentes do SKU. Aceitam nomes em português/inglês e diferenças de capitalização, ignoram valores vazios ou estruturados e mantêm SKU como alternativa quando não há características.
- Textos da vitrine agora dizem “variações disponíveis” e “Escolha sua variação”, sem limitar as opções a material e cor. Não houve alteração no agrupamento por modelo nem no controle de estoque/preço por SKU.
- Teste móvel pelo proxy HTTP local confirmou busca por acabamento, seleção da variante correspondente e troca entre peça pequena pronta (2500 centavos, dez unidades) e grande sob encomenda (3500 centavos, quatro dias úteis). Dados de catálogo são fixtures locais. Esta etapa melhora a apresentação de atributos já cadastrados; não cria nem homologa o cadastro administrativo de todas as combinações.

### Características 3D no formulário administrativo

- `ProductSpecifications` oferece material, tamanho e acabamento opcionais para SKU marcado como 3D, nos campos centrais `specs.material`, `specs.size` e `specs.finish`. Configuração da categoria, campos personalizados e valores do modelo têm prioridade; campos desativados não são reintroduzidos pelos padrões.
- Cor reutiliza o seletor existente, com padrão visível para 3D sem lista explícita de campos. IMEI, serial, RAM, armazenamento, versão e saúde de bateria ficam ocultos quando `is_print3d` está marcado. Dados antigos não são apagados automaticamente.
- Dois testes renderizam o componente real com dependências externas simuladas: verificam valores dos atributos, ausência de campos telefônicos em 3D, preservação desses campos em smartphone e respeito às configurações personalizadas. Cinco regressões existentes e build geral passaram.
- Esta etapa não cria combinações em massa nem verifica gravação de um produto operacional; cadastro de variantes por SKU e homologação integral do formulário ainda exigem continuidade.

### Isolamento das variantes 3D no serviço de produtos

- Teste executando `productService.create/update/getById` com transporte VPS em memória reproduziu duas falhas: atributos RAM/armazenamento herdados do modelo podiam acionar sincronização de preço em outra peça 3D, e categoria serializada permitia reutilizar SKU de peça 3D.
- Corrigido no serviço: fonte 3D não inicia sincronização de preços de aparelhos e produtos 3D são excluídos dos destinos dessa sincronização. Criação/edição 3D não usa a exceção de SKU duplicado para categorias serializadas.
- Testes confirmam preservação de material/cor/tamanho/acabamento nos payloads e releitura, preço independente entre variantes, rejeição de SKU conflitante e funcionamento legado da sincronização entre aparelhos. Seis testes focados/regressivos e build geral passaram.
- Limite da evidência: transporte de produtos simulado, sem MySQL ou operação real. A verificação de gravação integral pela API central e a auditoria de regras equivalentes do servidor continuam pendentes.

### Isolamento 3D nos grupos de preço do servidor

- Reproduzido e corrigido o mesmo risco no módulo `smartphonePriceGroups`: `is_print3d` exclui a peça da configuração de celular, da herança automática, da referência de preço e da listagem de grupos/incompletos. Consultas de produtos carregam explicitamente esse campo antes de filtrar.
- Quinze testes focados passaram, cobrindo peças 3D com atributos de telefone herdados e peças sem RAM/armazenamento. As regras de preço dos aparelhos continuam testadas.
- Novo cenário `print3d-price-isolation-mysql.cjs`, integrado à suíte MySQL descartável, executa as rotas reais de listagem e atualização de grupos: peça 3D não aparece como integrante, preço permanece após editar o grupo e transação de edição da peça mantém seu preço e características próprios. Suíte completa passou.
- Nenhum banco operacional foi acessado. Esta evidência valida o módulo de grupos/preços com SQL real; não encerra a validação integral de todos os endpoints de cadastro ou a unicidade de SKU concorrente no servidor. Publicação requer schema 3D compatível, incluindo `products.is_print3d`.

### Gravação 3D pelo handler de produtos com MySQL local

- O teste MySQL agora usa o validador real `normalizePrint3dProductOffer` ao executar o handler extraído de `/products/batch`, além do SQL real e da reconciliação de estoque.
- Confirmados: criação com material/cor/tamanho/acabamento e política de encomenda; edição parcial preservando a marca 3D/política; mudança de preço sem atingir outro SKU; prazo de encomenda inválido sem inserir produto.
- Duas inclusões concorrentes com o mesmo SKU resultaram em uma gravação e uma recusa, preservando identidade/atributos/preço do vencedor e sem estoque para o perdedor. **Essa proteção foi exercitada com o índice único `test_batch_sku`, criado exclusivamente no banco de teste.** A busca nos arquivos locais de migrations/scripts/docs não confirmou índice equivalente operacional.
- Pendente antes de garantir unicidade em produção: verificar o schema real e definir a restrição compatível com SKUs legados/serializados. Não aplicar índice global sem verificar duplicidades existentes. O teste usa autenticação e consultas de conflitos serializados simuladas; não houve gravação operacional.

### Auditoria somente leitura de SKU preparada

- `scripts/audit-print3d-sku.cjs` exporta `auditPrint3dSku(connection)`. O chamador deve fornecer uma conexão explicitamente selecionada; o módulo não carrega `.env`, não conecta automaticamente e executa somente SELECTs.
- Retorna presença de índice único global completo sobre SKU, contagem de SKUs nulos/vazios em 3D e grupos de SKU duplicados envolvendo produto 3D (inclusive conflito com produto legado). Não retorna SKUs, dados pessoais ou credenciais. Ausência das colunas necessárias encerra a auditoria com motivo explícito.
- Índices compostos, parciais e não únicos não são tratados como prova de unicidade global. A sinalização `ready` refere-se exclusivamente a essas condições de SKU; não certifica abertura da loja ou ausência de riscos em outros fluxos. Ausência de índice não autoriza criá-lo automaticamente.
- Dois testes focados e a suíte MySQL descartável passaram. O cenário remove apenas o índice do banco de teste, cria conflitos fictícios e confirma os alertas. A auditoria ainda não foi executada no banco operacional e não está ligada automaticamente à publicação.

### Identificação da variante no carrinho

- Carrinho passa a mostrar material/cor/tamanho/acabamento junto ao SKU. Os controles acessíveis de aumentar/diminuir quantidade incluem características e SKU, diferenciando produtos de mesmo nome.
- A função existente da vitrine foi extraída para `utils/print3dVariantLabel.js` e compartilhada pelo carrinho, evitando duas regras de descrição. Somente atributos comerciais previstos entram no texto; campos internos arbitrários e valores estruturados são ignorados.
- Teste móvel percorreu busca por acabamento, troca de variante, inclusão no carrinho e aumento de quantidade com recotação pelo proxy local. Teste da descrição e build separado passaram.
- Para pedidos novos, o servidor lê `products.specs` na cotação e copia somente material, cor, tamanho e acabamento para `print3d_order_item_plans.variant_snapshot` na mesma transação do checkout. O hash do plano torna o resumo imutável e o token de frete detecta alteração dessas características entre cotação e confirmação.
- Pedido e ordem de produção leem exclusivamente o snapshot do item, inclusive nas telas do cliente; não buscam a variante atual do catálogo. A migration `051_print3d_order_variant_snapshot.sql` deixa pedidos anteriores com valor nulo, pois não há como inferir suas características históricas com segurança.
- Testes locais passaram: rota real de cotação limita atributos públicos, teste de plano valida imutabilidade, build separado e jornada navegador → proxy → API → MySQL descartável verifica pedido/produção após alteração posterior do catálogo. A migration 051 está aplicada no banco operacional; a operação continua desligada.

### Categoria obrigatória por site antes da publicação

- A tela de `Sites e preços` carrega as categorias já cadastradas e apresenta uma seleção independente no cartão do Mercado do Vale e no cartão da Loja 3D. O mesmo SKU pode escolher categorias diferentes nos dois sites.
- Ao marcar uma oferta como publicada, o botão permanece bloqueado até selecionar a categoria. A API também rejeita publicação sem `category_label`, impedindo contorno da trava do painel; rascunhos e ofertas ocultas continuam podendo ser salvos sem categoria.
- A tela mantém categorias já gravadas que não estejam mais na lista e oferece acesso ao cadastro de categorias. Testes focados da regra/rotas e os builds do sistema principal e da aplicação 3D passaram. Nenhum dado operacional ou publicação foi alterado.
