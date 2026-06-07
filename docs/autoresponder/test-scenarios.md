# Cenarios Obrigatorios Do AutoResponder

Cada publicacao que altera bot deve rodar estes cenarios em `/autoresponder/test-flow`.

## Cenarios

1. Saudacao simples
   - Mensagens: `["oi"]`
   - Esperado: resposta curta de saudacao ou pergunta de nome, sem lista de produto.

2. Busca de produto
   - Mensagens: `["redmi note 15"]`
   - Esperado: lista de produtos e rodape com "vamos ficar com qual deles hoje?"

3. Escolha de produto
   - Mensagens: `["redmi note 15", "1"]`
   - Esperado: detalhe do produto e proximo passo de compra/detalhes.

4. Entrega fora de compra
   - Mensagens: `["faz entrega?", "56320690"]`
   - Esperado: consulta de endereco, sem mensagem de instabilidade.

5. Fluxo de compra com entrega
   - Mensagens: `["redmi note 15", "1", "comprar", "1", "1", "finalizar", "entrega", "56320690"]`
   - Esperado: CEP consultado dentro da compra e pedido de numero/complemento.

6. Troca de CEP dentro da compra
   - Mensagens: `["redmi note 15", "1", "comprar", "1", "1", "finalizar", "entrega", "56320690", "56330000"]`
   - Esperado: novo CEP consultado imediatamente, mantendo itens do carrinho e pedido de numero/complemento.

7. Fluxo de compra com retirada e pagamento
   - Mensagens: `["redmi note 15", "1", "comprar", "1", "1", "finalizar", "retirada", "pix"]`
   - Esperado: retirada confirmada, pagamento Pix salvo e pedido de dados de cadastro, sem avancar para CPF/CNPJ.

8. Fallback fora do fluxo
   - Mensagens: `["xpto mensagem solta"]`
   - Esperado: fallback fora de fluxo com opcoes de caminho ou curadoria.

9. Fallback contextual de CEP
   - Mensagens: `["faz entrega?", "nao sei"]`
   - Esperado: pedir apenas os 8 numeros do CEP.

10. Pedido humano
   - Mensagens: `["falar com atendente"]`
   - Esperado: resposta de atendimento humano e pausa.

## Rodada Real Antes De Remover Legado

Depois que os cenarios acima passarem contra a API publicada, executar uma conversa real controlada pelo WhatsApp da loja antes de remover `AUTORESPONDER_ENGINE_V2` ou fallbacks de `purchase_flow.status`.

Sequencia minima:

1. Buscar produto real.
2. Escolher o produto ou variacao.
3. Enviar `comprar`.
4. Confirmar quantidade.
5. Finalizar.
6. Escolher entrega.
7. Informar CEP.
8. Informar numero/complemento.
9. Escolher pagamento.
10. Informar dados de cadastro quando solicitados.
11. Confirmar chegada ao handoff para atendimento humano.

Esperado:

- O produto escolhido permanece o mesmo depois de `comprar`.
- O carrinho mantem itens durante entrega, CEP e pagamento.
- A entrega dentro da compra nao cai na entrega avulsa.
- A conversa chega ao resumo para atendente e fica pausada.
- Evidencia da conversa fica registrada no runbook de rollout antes da limpeza final.
