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
   - Mensagens: `["redmi note 15", "1", "comprar", "1", "finalizar", "entrega", "56320690"]`
   - Esperado: CEP consultado dentro da compra e pedido de numero/complemento.

6. Fallback fora do fluxo
   - Mensagens: `["xpto mensagem solta"]`
   - Esperado: fallback fora de fluxo com opcoes de caminho ou curadoria.

7. Fallback contextual de CEP
   - Mensagens: `["faz entrega?", "nao sei"]`
   - Esperado: pedir apenas os 8 numeros do CEP.

8. Pedido humano
   - Mensagens: `["falar com atendente"]`
   - Esperado: resposta de atendimento humano e pausa.
