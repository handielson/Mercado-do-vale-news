# PayJoy: interpretacao contextual do aceite

Em 12/10/2026, execucoes 36588 e 36601 mostraram oferta de link seguida de resposta "oi sim". O estado awaiting_link_confirmation estava valido, mas o reconhecedor literal nao aceitava saudacao com consentimento. O atendimento geral repetiu a oferta.

Correcao autorizada aplicada ao workflow ativo SkrkB4vyKVDnQ68t, sem mensagens de teste ao cliente: Vendas - Preparar Contexto IA fornece contexto pendente e pergunta anterior; Agente Inicial - Classificador interpreta accept, decline, question ou other. Parse Classificacao valida enum, contexto e confianca numerica de pelo menos 0.8. Resolver encaminha aceite/recusa ao ramo existente; duvida vai para a IA geral com orientacao de manter contexto e nao se apresentar novamente. Politica usa a mesma decisao para enviar o link oficial e passa a awaiting_result.

Removidos os reconhecedores literais de aceite pendente. Pedidos humanos e resultados da analise mantem prioridade; imagem/print, calculo deterministico da entrada, estado de venda e conexoes permanecem. Saida ausente/invalida ou baixa confianca nao autoriza envio automatico. Pedidos explicitos de reenvio apos o link ja enviado preservam o comportamento existente.

Aplicacao pelo mutador canonico: node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --contextual-intent --apply. Backup privado anterior, guardas de revisao/execucoes ativas, alinhamento entidade/historico e retomada n8n antes do runner. Sem deploy de site/API, sem alteracao de credenciais ou lista de persistencia da API.

Validacao: tres testes focados, cenarios adicionais no validate, conservacao do grafo/prints/calculo e revisao independente. Onze mensagens sinteticas foram classificadas corretamente pelo gpt-4.1-mini real, incluindo oi sim, pois mande, vamos nessa, recusa, duvida, entrega, pedido humano e reprovacao. Nenhum dado de cliente ou imagem real usado no teste do provedor.

Leitura posterior confirmou workflow ativo, entidade/historico alinhados e dry-run idempotente sem alteracoes pendentes. Evidencias privadas em .local/payjoy-contextual-*, backup no TEMP identificado pelo deploy. O consentimento nao deve ser reduzido novamente a uma lista de palavras exatas.
