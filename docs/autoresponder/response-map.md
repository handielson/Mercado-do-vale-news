# Mapa De Respostas Do AutoResponder

## Ordem Global Atual

1. Bloqueio e grupo
2. Audio sem suporte
3. Pausa de conversa
4. Fluxo de nome do contato
5. Status da loja
6. Saudacao
7. Garantia
8. Fluxo de compra em `purchase_flow`
9. Escolha numerada
10. Mais opcoes
11. Pedido humano
12. Opt-in lista de telefone
13. Regras manuais
14. Tags de produto
15. Categoria/orcamento
16. Busca generica de produto
17. IA fallback
18. Fallback geral

## Fluxo: Entrega Fora De Compra

| Entrada | Estado atual | Resposta do bot | Proximo estado | Resposta esperada | Fallback contextual |
|---|---|---|---|---|---|
| faz entrega? (DDD 87) | none | Informa gratuidade para smartphones, presume Petrolina-PE e pergunta o bairro | awaiting_delivery_neighborhood | Bairro | Qual é o bairro da entrega? |
| faz entrega? (DDD 74) | none | Informa gratuidade para smartphones, presume Juazeiro-BA e pergunta o bairro | awaiting_delivery_neighborhood | Bairro | Qual é o bairro da entrega? |
| Centro | awaiting_delivery_neighborhood | Salva o bairro e pede a localização do WhatsApp | awaiting_delivery_location | Localização compartilhada | Envie pelo clipe e pela opção Localização. |
| Localização compartilhada | awaiting_delivery_location | Converte as coordenadas em endereço e pede confirmação | awaiting_delivery_address_confirmation | sim ou não | Esse endereço está correto? |
| não consigo | awaiting_delivery_location | Oferece a alternativa de endereço digitado | awaiting_delivery_address_text | Rua, número e bairro | Me envie o endereço completo por texto. |
| faz entrega? (outro DDD) | none | Informa a área gratuita para smartphones e pede CEP | awaiting_delivery_zip | CEP de 8 dígitos | Me envie os 8 números do CEP. |

## Fluxo: Busca De Produto

| Entrada | Estado atual | Resposta do bot | Proximo estado | Resposta esperada | Fallback contextual |
|---|---|---|---|---|---|
| redmi note 15 | none | Lista opcoes | product_search.awaiting_choice | numero, nome ou mais | Me diga o numero da opcao ou o nome do modelo. |
| Poco qualquer modelo contanto que seja 12 de RAM | none ou product_search.awaiting_choice | Uma única lista filtrada; cada modelo traz características curtas, memória, preço PIX, cartão em 12x e cores | product_search.awaiting_choice | numero ou nome | Qual modelo você quer ver em mais detalhes? |
| 1 | product_search.awaiting_choice | Detalhe do produto | purchase.awaiting_action | comprar, detalhes ou outro produto | Quer comprar, ver detalhes ou procurar outro modelo? |
| mais | product_search.awaiting_choice | Proxima pagina | product_search.awaiting_choice | numero, nome ou mais | Ja mostrei tudo dessa lista. Quer buscar outro modelo? |

## Fluxo: Compra

| Entrada | Estado atual | Resposta do bot | Proximo estado | Resposta esperada | Fallback contextual |
|---|---|---|---|---|---|
| comprar | purchase.awaiting_action | Pergunta quantidade | purchase.awaiting_quantity | numero | Me envie a quantidade em numero. Ex: 1 |
| 1 | purchase.awaiting_quantity | Adiciona item e pergunta finalizar | purchase.item_added | finalizar, adicionar, remover | Responda finalizar, adicionar ou remover. |
| finalizar | purchase.item_added | Pergunta entrega ou retirada | purchase.awaiting_fulfillment | entrega ou retirada | Voce prefere entrega ou retirada na loja? |

### Regra De Frete Para Smartphones

- Smartphones têm entrega gratuita em toda Petrolina-PE e Juazeiro-BA, sem valor mínimo de compra.
- Contatos com DDD 87 são tratados como Petrolina-PE e contatos com DDD 74 como Juazeiro-BA.
- A identificação pelo DDD inicia a coleta do bairro e da localização. O endereço captado sempre precisa ser confirmado pelo cliente.
- A gratuidade automática não se aplica a outras categorias de produto.

### Regra De Comparação De Smartphones

- Pedidos por família e memória, como `Poco com 12 de RAM`, devem reconhecer a memória mesmo quando o cliente omitir `GB`.
- `Poco` e `Redmi` limitam os resultados à família citada, mesmo quando o cadastro da marca está como Xiaomi.
- Cada modelo aparece uma vez, com uma linha curta de características confirmadas e, logo abaixo, memória, preço à vista no PIX, cartão em até 12x e cores.
- Quando a lista estruturada estiver pronta, a resposta conversacional da IA não deve ser enviada junto nem repetir características ou valores.

### Regra De Envio Da Lista

- Quando o catálogo determinístico estiver pronto, ele é a resposta completa: não enviar apresentação, resumo ou pergunta criada pela IA antes da lista.
- A pergunta de escolha permanece no último bloco do catálogo, separada dos produtos.
- Uma marca de smartphone reconhecida, como `Realme`, `Poco`, `Redmi`, `Samsung` ou `Motorola`, abre imediatamente a lista correspondente; não pedir confirmação do tipo de produto.
- Uma continuação pelo nome do modelo, como `Me envia também do Poco M7 Pró 5G`, volta ao formatador oficial: características, memória, PIX, cartão em 12x e cores, no mesmo padrão do modelo anterior.
- Nesse seguimento, enviar a ficha técnica prevista para o modelo e não acrescentar uma segunda imagem avulsa do produto.
- A resposta livre da IA só é usada quando não existe catálogo determinístico para enviar.

## Fallback Fora Do Fluxo

Mensagem padrao:

```text
Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?
```
