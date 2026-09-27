# Checkout e PIX 3D — implementação local

Nenhuma migration, configuração externa, cobrança real ou publicação foi executada. Rotas desligadas por padrão. Testes usam banco e provedor simulados.

Validação local usa testes focados e cenário de navegador móvel com APIs externas bloqueadas. O cenário verifica retry com a mesma chave, escolha de entrada/frete, PIX simulado, confirmação da entrada e prévia sem chamadas à API da loja. Isso não substitui homologação em MySQL e provedor reais.

Após a correção da regra: 124 testes automatizados passaram, incluindo 432 comparações de prévia/servidor dentro da suíte. Navegador móvel validou 50%, 70% e 100% nos três modos, recusa de 49%, repetição do pedido e estorno. A barra de comparação MDV não aparece nas rotas 3D.

## Regra confirmada pelo operador

- Todos os pedidos: cliente escolhe entrada de 50% a 100% dos produtos, incluindo peças prontas. O estoque altera a produção necessária, não a entrada.
- Frete posterior: percentual escolhido dos produtos agora; restante dos produtos e frete inteiro no saldo.
- Frete inteiro agora: percentual escolhido dos produtos mais todo o frete na entrada.
- Frete dividido: percentual escolhido do total (produtos e frete) na entrada; restante no saldo. Com 50%, paga metade do pedido com frete.
- Percentuais em pontos-base inteiros (5000–10000), centavos inteiros e arredondamento global para cima. Tela mostra entrada e saldo antes da confirmação.
- Saldo quitado antes do envio; se houver encomenda, cobrança do saldo aguarda produção concluída. Pagamento antecipado de 100% do total quita o pedido; 100% dos produtos com frete posterior ainda deixa saldo de frete.
- Conta 3D verificada; encomenda exige WhatsApp verificado.

## Implementação

Checkout, pedido, reserva das peças prontas por localização, plano financeiro e OPs são gravados numa transação. A cotação de frete é assinada por dez minutos e vinculada ao carrinho, preço, divisão pronta/encomenda, prazo e CEP. Mudanças exigem nova conferência. Valores do navegador não definem o pedido.

PIX tem intenção persistida antes da chamada ao provedor e chave estável para recuperar uma tentativa interrompida. Webhook assinado consulta o pagamento canônico; recebedor, moeda, método, referência e valor precisam corresponder. Somente confirmação financeira libera produção. A cobrança do saldo exige produção concluída; quitação integral exige a soma total, incluindo frete.

Telas: `/loja-3d/checkout`, `/loja-3d/pedidos`, `/loja-3d/conta/producao`. Demonstração explícita usa dados fictícios. Consulta real exige sessão 3D; não usa sessão MDV. Tabelas financeiras/reservas bloqueadas no CRUD genérico.

## Pendências para ativação

- Resolver cancelamento/abandono, expiração das cobranças e liberação rastreável das reservas, incluindo pagamento tardio. **Não ativar operação real antes disso.**
- Homologar migrations 040–044 e dependências em MySQL isolado; concorrência entre lojas, rollback e reinício precisam de banco real. A 044 versiona as condições do plano: histórico versão 0 conserva condições originais e pedidos novos recebem versão 1, com escolhas imutáveis após confirmação.
- Configurar empresa central por `MDV_PRINT3D_COMPANY_ID`; habilitações separadas de clientes, frete, produção e checkout. Checkout usa `MDV_PRINT3D_CHECKOUT_ENABLED=1` somente depois das dependências.
- PIX exclusivo: `MDV_PRINT3D_PAYMENTS_ENABLED`, `MDV_PRINT3D_MP_ACCESS_TOKEN`, `MDV_PRINT3D_MP_COLLECTOR_ID`, `MDV_PRINT3D_MP_WEBHOOK_SECRET` e `MDV_PRINT3D_MP_NOTIFICATION_URL` HTTPS terminando em `/print3d/payments/webhook`. Segredos só no servidor. Nenhuma reutilização automática das credenciais MDV.
- Homologar webhook, timeout/repetição, pagamento tardio e reembolso no provedor. Reembolso/chargeback exige revisão operacional; não libera produção.
- Integrar trava da expedição, consumo de insumos, destino das peças aprovadas e fluxo fiscal.

Fontes oficiais consultadas para o adaptador: [PIX Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix) e [webhooks](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod).
