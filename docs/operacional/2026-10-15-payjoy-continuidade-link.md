# Continuidade do pedido contextual PayJoy

Situação: publicada e validada em 15/10/2026 na versão v1.2.634-payjoy-continuidade, commit funcional 9343e9e2. Sem envio de teste a clientes.

No atendimento do final 2670, a explicação sobre a análise PayJoy foi seguida por um pedido do site para um amigo. A execução 41945 classificou o pedido como ambíguo e passou pelo atendimento geral, sem executar a configuração PayJoy nem Pagamento - Politica. A resposta alegou não ter o link. O problema foi a interpretação e continuidade da referência, não uma evidência de histórico apagado.

O patch `tmp-tests/n8n-payjoy-link-continuity.cjs` altera somente cinco nós existentes: Vendas - Preparar Contexto IA, Agente Inicial - Classificador, Parse Classificacao, Resolver Acao de Conversacao e Pagamento - Politica. Grafo, credenciais, modelos e demais nós são preservados.

A decisão semântica `request` identifica um pedido explícito do site/link da análise, inclusive para um amigo e com referência como “esse site”. Ela pode usar a menção PayJoy na mensagem atual ou a última resposta da loja que menciona PayJoy, com data válida nas últimas 24 horas. Uma oferta pendente mantém a validade já existente. Mensagens de resposta com data igual priorizam a última posição no histórico.

Uma referência disponível não transforma “sim” em autorização sem oferta pendente. Enum e confiança numérica de 0,8 a 1 são validados novamente nas camadas seguintes. Humano, resultados, dúvidas, recusas e mudança de assunto preservam suas rotas. A URL continua sendo obtida pela configuração existente e validada como HTTPS de payjoy.com ou subdomínio. Configuração ausente ou URL inválida encaminha à equipe, sem inventar endereço. O envio mantém awaiting_result e analysis_check, preservando o rascunho de venda.

Validação:

- 71 testes do gate sobre o candidato exato, incluindo dez grupos novos de continuidade; todos passaram.
- 20 cenários com chamadas reais via Responses API e módulos nativos instalados: oito cenários anteriores e 12 de continuidade. Os três pedidos explícitos produziram a URL configurada; nove cenários negativos não a produziram. Inclui a frase do atendimento original, consentimento, atendimento geral, vendas e duas imagens sintéticas PayJoy.
- Execução de teste isolada: Agent nativo e códigos reais de contexto, parse, resolução e política. Estado, imagens e URL fictícios; leitura de horário substituída por resposta indisponível. Não executa o motor completo de workflow, memória externa, Evolution/WhatsApp ou análise real de crédito.
- Dry-run do publicador consultou a produção e confirmou exatamente os cinco nós alterados, grafo preservado e entidade/histórico alinhados. Essa etapa não gravou na produção. A aplicação autorizada posterior atualizou entidade e histórico ativo; leitura após reinício confirmou o mesmo hash e 71 testes passaram novamente.

Candidato: SHA-256 de nodes/connections `4f8af0756eb441102f300cec8d8be8eee2216f6388eab5d2ab08e6655f0e1051`. Evidência privada em `.local/n8n-payjoy-continuity-native-evidence.json`, gerada em 2026-10-15T14:25:28.534Z. Não versionar snapshots privados.

O publicador existente aceita `--payjoy-continuity`. Uma futura aplicação exige evidência nativa do candidato exato, recente, com os oito cenários originais e os 12 adicionais aprovados. O gate inclui automaticamente os novos testes em candidatos com o marcador; falhas impedem a publicação. O modo mantém backup, leitura de retorno e rollback existentes. Publicação seguiu publish-vps e publicar.md; alterações de atendimento ainda pendentes no diretório ficaram fora desta entrega. Site/VERSION 634 e saúde do n8n/runner/API confirmados.
