# Cenarios Obrigatorios Do AutoResponder

Cada publicacao que altera bot deve rodar estes cenarios em `/autoresponder/test-flow`.

## Cenarios

1. Saudacao simples
   - Mensagens: `["oi"]`
   - Esperado: resposta curta de saudacao ou pergunta de nome, sem lista de produto.

2. Busca de produto
   - Mensagens: `["redmi note 15"]`
   - Esperado: lista de produtos no formato oficial e pergunta de escolha enviada separadamente.

3. Comparação filtrada por família e memória
   - Mensagens: `["Poco qualquer modelo contanto que seja 12 de Ram"]`
   - Esperado: somente modelos Poco com 12 GB; cada aparelho aparece uma vez com características curtas, memória, preço PIX, cartão em 12x e cores; não enviar uma redação da IA antes ou depois da lista.

4. Escolha de produto
   - Mensagens: `["redmi note 15", "1"]`
   - Esperado: detalhe do produto e proximo passo de compra/detalhes.

5. Entrega fora de compra com DDD local
   - Mensagens: `["faz entrega?", "Centro", "<localização do WhatsApp>", "sim"]`
   - Esperado: DDD 87 presume Petrolina-PE e DDD 74 presume Juazeiro-BA; o bot pergunta o bairro, pede a localização, capta o endereço e solicita confirmação.

6. Fluxo de compra de smartphone com entrega
   - Mensagens: `["redmi note 15", "1", "comprar", "1", "1", "finalizar", "entrega", "Centro", "<localização do WhatsApp>", "sim"]`
   - Esperado: informa entrega gratuita sem valor mínimo, confirma o endereço captado e pede número/complemento.

7. Troca de CEP dentro da compra
   - Mensagens: `["redmi note 15", "1", "comprar", "1", "1", "finalizar", "entrega", "56320690", "56330000"]`
   - Esperado: novo CEP consultado imediatamente, mantendo itens do carrinho e pedido de numero/complemento.

8. Fluxo de compra com retirada e pagamento
   - Mensagens: `["redmi note 15", "1", "comprar", "1", "1", "finalizar", "retirada", "pix"]`
   - Esperado: retirada confirmada, pagamento Pix salvo e pedido de dados de cadastro, sem avancar para CPF/CNPJ.

9. Fallback fora do fluxo
   - Mensagens: `["xpto mensagem solta"]`
   - Esperado: fallback fora de fluxo com opcoes de caminho ou curadoria.

10. Fallback contextual de localização
   - Mensagens: `["faz entrega?", "Centro", "não consigo", "Rua Exemplo, 100, Centro"]`
   - Esperado: aceitar endereço digitado quando não for possível compartilhar ou interpretar a localização e pedir confirmação.

11. Pedido humano
   - Mensagens: `["falar com atendente"]`
   - Esperado: resposta de atendimento humano e pausa.
