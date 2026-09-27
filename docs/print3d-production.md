# Produção parcial 3D — incremento local

Implementação local, desligada por padrão. Não houve aplicação de migrations, publicação, cobrança, envio de mensagem nem alteração em banco externo.

## Uso das telas

- Painel: Produtos → Produção 3D (`/admin/products/print3d-production`).
- Cliente: Minha conta → Acompanhar produção dos meus pedidos (`/loja-3d/conta/producao`).
- Somente `?demo=1` usa exemplo fictício de 100 unidades com 20 já aprovadas. Os registros demonstrativos são salvos no navegador e podem ser vistos nas duas telas demo na mesma origem. Não são pedidos reais.
- Informar **novas** unidades aprovadas e reprovadas do lote, não o acumulado. Exemplo: havia 20, lançar 20 resulta em 40/100. Reprovadas não contam no percentual.
- Cliente vê somente a própria produção, unidades aprovadas, restante e histórico público. Reprovações, nota interna, operador, ficha e arquivo não entram na resposta pública.
- Progresso não significa pagamento integral, estoque livre, postagem ou entrega.

## Sequência canônica preparada

1. Checkout local abre transação, revalida sessão, preço/estoque e cotação assinada de frete e grava pedido/itens/reserva na central. Cada reserva mantém as localizações de origem. Retentativas usam a mesma chave.
2. Dentro dessa mesma transação, chamar `savePrint3dOrderPlanOnConnection` com cotação do servidor e depois `createProductionJobsOnConnection`. O plano fixa quantidades prontas/encomendadas e valores. A OP usa somente unidades a produzir e fixa a revisão/arquivo selecionados nesse momento.
3. Adaptador PIX local verifica assinatura do webhook, consulta o pagamento canônico e confere recebedor, BRL, valor, liquidação e vínculo payment→order antes de chamar `recordVerifiedPrint3dPaymentOnConnection` e `releaseProductionJobsOnConnection`, na mesma transação. Não existe endpoint que aceite confirmação financeira enviada pelo cliente ou simples booleano do administrador.
4. Com entrada suficiente no registro financeiro, OP vai à fila. Apontamentos exigem novamente essa cobertura e bloqueiam pedido cancelado/estornado. Não basta `orders.payment_status='paid'`.
5. Apontamentos positivos ficam em histórico imutável com chave de idempotência. Repetir chave/corpo não soma duas vezes; reutilizar a chave com valores diferentes falha. Pedido e OP são travados antes de conferir quantidade.
6. Cliente consulta apenas ordens do seu `print3d_customer_id`, com sessão 3D válida/ativa e versão de autenticação vigente. Token MDV não autentica essa consulta.

O plano novo permite entrada de 50% a 100% de todos os produtos, inclusive os prontos. O cliente escolhe frete posterior, inteiro na entrada ou dividido no mesmo percentual. O saldo inclui apenas o que falta e, nas encomendas, só pode gerar cobrança após conclusão da produção. Quitação integral exige o total dos produtos e do frete. A migration 044 preserva condições antigas como versão 0 e fixa escolhas novas na versão 1. Integração PIX ainda não homologada com banco/provedor reais; estornos parciais, taxas e conciliação bancária permanecem pendentes.

## Arquivos e ativação futura

- `services/print3dOrderPlan.cjs`: plano e confirmações internas.
- `services/print3dProduction.cjs`: criação/liberação/apontamento e projeções.
- `services/print3dProductionServer.cjs`: rotas admin e consulta cliente.
- Migrations preparadas: 040 (jobs/events) e 041 (plans/item_plans/payment_receipts). Dependem do schema central e migrations 028–035 relevantes. Nenhuma foi aplicada aqui.
- Tabelas novas bloqueadas no CRUD genérico das duas entradas VPS. Nenhuma rota pública cria, libera ou altera financeiramente OPs.
- `MDV_PRINT3D_PRODUCTION_ENABLED` continua desligada. Não ativar antes de homologar checkout/gateway em MySQL de teste e resolver cancelamento/expiração de reservas.

## Pendências após este incremento

Homologação do checkout transacional e gateway de duas cobranças, cancelamento/expiração/liberação de reservas, estorno/retificação de apontamento, entrada e reserva das peças aprovadas, baixa real dos insumos, seleção de impressora/capacidade, abertura do arquivo pela OP, trava de expedição após quitação e dados fiscais. Detalhes do incremento em `docs/print3d-checkout.md`.

Os testes atuais usam banco/provedor simulados e navegador local com rede externa bloqueada. Eles não comprovam migrations ou concorrência em MySQL real.
