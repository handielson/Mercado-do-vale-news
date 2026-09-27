# Produção parcial 3D — incremento local

Implementação local, desligada por padrão. Não houve aplicação de migrations, publicação, cobrança, envio de mensagem nem alteração em banco externo.

## Uso das telas

- Painel: Produtos → Produção 3D (`/admin/products/print3d-production`).
- Cliente: Minha conta → Acompanhar produção dos meus pedidos (`/loja-3d/conta/producao`).
- Somente `?demo=1` usa exemplo fictício de 100 unidades com 20 já aprovadas. Os registros demonstrativos são salvos no navegador e podem ser vistos nas duas telas demo na mesma origem. Não são pedidos reais.
- Informar **novas** unidades aprovadas e reprovadas do lote, não o acumulado. Exemplo: havia 20, lançar 20 resulta em 40/100. Reprovadas não contam no percentual.
- Cliente vê somente a própria produção, unidades aprovadas, restante e histórico público. Reprovações, nota interna, operador, ficha e arquivo não entram na resposta pública.
- A ordem administrativa mostra o arquivo principal fixado no momento da compra, revisão, perfil da impressora quando for G-code e resumo de material/tempo por lote. O download usa a rota privada existente, que confere tamanho e SHA-256 com o arquivo do Synology. Se produto, SKU, revisão e arquivo não corresponderem, a tela alerta o operador e não oferece o download. A criação de nova ordem também rejeita uma seleção incompatível.
- Progresso não significa pagamento integral, estoque livre, postagem ou entrega.

## Sequência canônica preparada

1. Checkout local abre transação, revalida sessão, preço/estoque e cotação assinada de frete e grava pedido/itens/reserva na central. Cada reserva mantém as localizações de origem. Retentativas usam a mesma chave.
2. Dentro dessa mesma transação, chamar `savePrint3dOrderPlanOnConnection` com cotação do servidor e depois `createProductionJobsOnConnection`. O plano fixa quantidades prontas/encomendadas e valores. A OP usa somente unidades a produzir e fixa a revisão/arquivo selecionados nesse momento.
3. Adaptador PIX local verifica assinatura do webhook, consulta o pagamento canônico e confere recebedor, BRL, valor, liquidação e vínculo payment→order antes de chamar `recordVerifiedPrint3dPaymentOnConnection` e `releaseProductionJobsOnConnection`, na mesma transação. Não existe endpoint que aceite confirmação financeira enviada pelo cliente ou simples booleano do administrador.
4. Com entrada suficiente no registro financeiro, OP vai à fila. Apontamentos exigem novamente essa cobertura e bloqueiam pedido cancelado/estornado. Não basta `orders.payment_status='paid'`.
5. Apontamentos positivos ficam em histórico imutável com chave de idempotência. Repetir chave/corpo não soma duas vezes; reutilizar a chave com valores diferentes falha. Pedido e OP são travados antes de conferir quantidade. Cada lançamento informa o consumo real por filamento e por insumo da revisão vinculada ao pedido, inclusive perdas e reprovações. A soma em gramas é conferida; os saldos físicos são travados e baixados na mesma transação. Falta de um filamento ou insumo desfaz todos os movimentos, eventos e peças aprovadas. Cada aprovação cria uma saída de produção reservada exclusivamente ao pedido e não altera o estoque disponível do catálogo.
6. Cliente consulta apenas ordens do seu `print3d_customer_id`, com sessão 3D válida/ativa e versão de autenticação vigente. Token MDV não autentica essa consulta.
7. Expedição administrativa é uma operação única por pedido. O servidor confere novamente os recebimentos confirmados até o total dos produtos e frete, a conclusão de cada OP, as peças produzidas reservadas e as localizações das peças prontas. Na mesma transação, consome as reservas prontas, marca as peças produzidas como expedidas, sincroniza o saldo central, registra o rastreio e altera o pedido para enviado. Repetir o mesmo rastreio não gera segunda baixa; rastreio diferente é recusado. Essa operação apenas registra um envio físico já realizado, sem contratar frete nem emitir documento fiscal.

O plano novo permite entrada de 50% a 100% de todos os produtos, inclusive os prontos. O cliente escolhe frete posterior, inteiro na entrada ou dividido no mesmo percentual. O saldo inclui apenas o que falta e, nas encomendas, só pode gerar cobrança após conclusão da produção. Quitação integral exige o total dos produtos e do frete. A migration 044 preserva condições antigas como versão 0 e fixa escolhas novas na versão 1. Integração PIX ainda não homologada com banco/provedor reais; estornos parciais, taxas e conciliação bancária permanecem pendentes.

## Arquivos e ativação futura

- `services/print3dOrderPlan.cjs`: plano e confirmações internas.
- `services/print3dProduction.cjs`: criação/liberação/apontamento e projeções.
- `services/print3dProductionServer.cjs`: rotas admin e consulta cliente.
- Migrations preparadas: 040 (jobs/events), 041 (plans/item_plans/payment_receipts), 046 (saída de peças reservada por pedido), 047 (consumo real de material por lançamento), 048 (saldo físico e movimentos de filamentos), 049 (expedição única por pedido) e 050 (saldo físico e movimentos dos demais insumos). Dependem do schema central e migrations 028–035 relevantes. Nenhuma foi aplicada aqui.
- Tabelas novas bloqueadas no CRUD genérico das duas entradas VPS. Nenhuma rota pública cria, libera ou altera financeiramente OPs.
- `MDV_PRINT3D_PRODUCTION_ENABLED` continua desligada. Não ativar antes de homologar checkout/gateway em MySQL de teste e resolver cancelamento/expiração de reservas.
- `MDV_PRINT3D_DISPATCH_ENABLED` também fica desligada e depende do checkout habilitado. Aplicar a migration 049 e validar um pedido misto em MySQL isolado antes de ativar. A emissão fiscal e a entrega à transportadora continuam passos operacionais separados.

## Pendências após este incremento

Homologação do checkout transacional e gateway de duas cobranças, cancelamento/expiração/liberação de reservas, estorno/retificação de apontamento, seleção de impressora/capacidade e dados fiscais. A abertura privada do arquivo pela OP está preparada localmente, mas depende da configuração real do Synology e de um teste com arquivo físico. Os saldos de filamentos e insumos, a baixa pela produção e a expedição paga com consumo das reservas ainda exigem teste em MySQL real, saldo inicial conferido e operação piloto. Cada insumo usa a unidade informada na calculadora, preservada na revisão; mudar sua unidade com saldo positivo impede novas entradas até reconciliação. Detalhes do incremento em `docs/print3d-checkout.md`.

Os testes atuais usam banco/provedor simulados e navegador local com rede externa bloqueada. Eles não comprovam migrations ou concorrência em MySQL real.

Entradas de filamento e acessórios foram validadas com concorrência no MySQL descartável. A consulta do movimento por chave passou a usar leitura com trava (`FOR UPDATE`), evitando snapshot desatualizado após aguardar o saldo e retornando replay na segunda tentativa simultânea. Teste adicional executou os serviços de consumo na mesma transação de um evento real: falta de acessório reverteu filamento/evento e duas transações competindo por saldo insuficiente para ambas confirmaram apenas uma. A transação é montada pelo teste; ainda falta homologar a rota completa de apontamento com receita/pagamento e interface autenticada.

Produtos 3D não usam IMEI, conforme confirmação do operador; a operação segue por quantidade e SKU. A rota real de apontamento foi exercitada via Fastify com MySQL mínimo descartável, plano versão 1 e recibo/ficha de teste. Foi corrigido snapshot antigo que ocultava evento concorrente: a referência imutável do pedido é consultada antes de abrir a transação; depois, as travas permanecem pedido → produção. Duas tentativas iguais retornam lançamento/replay e a consulta do cliente apresenta 20/100 e 20 peças reservadas, com histórico único. Falta de acessório pela rota reverte evento, filamento e progresso. Autenticação neste cenário usa principais simulados; UI, NAS, gateway e schema fiel continuam fora da evidência desse teste.

Teste opcional de navegador integrado: `PRINT3D_MYSQL_BROWSER=1 npm run test:print3d:mysql` (no PowerShell, definir a variável de ambiente antes do comando), com Vite local em `127.0.0.1:3000`. Os componentes reais de admin e cliente são montados na página de preview sem modo demo. O transporte é interceptado para o Fastify do teste com MySQL descartável; APIs externas são bloqueadas. Foram verificados 20/100 → 40/100, nota privada oculta e erro de insumo sem progresso indevido. Sessões/principais e preferências são fixtures; o login e o layout protegido ainda exigem verificação própria.

Expedição validada em MySQL descartável: a rota recusa pedido sem quitação e produção incompleta; após concluir a produção, tentativas simultâneas com o mesmo rastreio geram um envio e um replay. Outro rastreio é recusado. O serviço de expedição de peças prontas preservou a reserva de outro pedido, atualizou o total central e reverteu a baixa quando o movimento falhou. Os cenários usam recibos e schema mínimo de teste; não homologam emissão fiscal, transportadora, gateway ou ação na interface.

O modo opcional de navegador também cobre expedição na tela administrativa móvel (390×844), com busca e listagem reais no Fastify/MySQL descartável. A confirmação registra o rastreio, atualiza o card e remove o formulário; reenvio de requisição é replay e preserva saldo de outro pedido. Essa evidência não inclui login real, guard/layout completo, emissão fiscal ou entrega à transportadora; usa sessão fixture e pedido descartável.
