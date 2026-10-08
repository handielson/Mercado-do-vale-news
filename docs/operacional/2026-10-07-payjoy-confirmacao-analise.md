# PayJoy: confirmação de análise

Correção aplicada no workflow ativo `SkrkB4vyKVDnQ68t` em 07/10/2026.

O cliente respondeu “Fazer o análise” depois da oferta do link. O reconhecedor aceitou apenas afirmações curtas ou pedidos contendo a palavra link; a resposta caiu no atendimento geral, que prometeu enviar sem executar a rota de envio. Execuções 28670 e 28677 terminaram com sucesso técnico, mas o estado permaneceu `awaiting_link_confirmation`.

O patch existente `tmp-tests/n8n-fix-payjoy-link-confirmation.cjs` agora amplia a confirmação nos nós Resolver Acao de Conversacao e Pagamento - Politica. A condição de contexto e de confirmação pendente continua obrigatória. Reconhece fazer a/o análise, quero fazer a análise, iniciar análise e variantes; negativas, perguntas, pedido de atendente e respostas sem contexto não ativam esse atalho. Nenhuma conexão ou outro nó foi modificado.

Dry-run com código real passou; aplicação atualizou entidade e histórico ativo. Backup anterior: `C:/Users/Nitro/AppData/Local/Temp/n8n-SkrkB4vyKVDnQ68t-before-payjoy-link-confirmation-v1-1791423085640.json`. O backup permite restaurar os dois nós anteriores na entidade/histórico ativo e reiniciar n8n/runner pelo mesmo procedimento.

Validações após aplicação: patch idempotente, confirmação produz URL oficial PayJoy, estado muda para awaiting_result e agenda analysis_check; negativas e confirmação sem contexto preservadas. Regressão de usados aprovada. n8n, runner e banco 1/1, healthz HTTP 200, entidade/histórico alinhados, exatamente dois nós com marcador payjoy-analysis-confirmation-v2 e zero execuções com erro desde o reinício.

Nenhuma mensagem enviada, conversa reexecutada ou estado de cliente alterado manualmente. A conversa original aguarda nova mensagem. Teste de envio real não foi realizado. Site e API Mercado do Vale sem deploy. Arquivos preexistentes da impressão Shopee preservados.
