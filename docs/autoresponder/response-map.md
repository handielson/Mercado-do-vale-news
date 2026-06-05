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
| faz entrega? | none | Explica entrega e pergunta CEP | delivery.awaiting_cep | CEP de 8 digitos | Me envie apenas os 8 numeros do CEP. Ex: 56320690 |
| 56320690 | delivery.awaiting_cep | Consulta endereco e frete | none | Produto ou atendente | Quer escolher um produto agora ou falar com atendente? |

## Fluxo: Busca De Produto

| Entrada | Estado atual | Resposta do bot | Proximo estado | Resposta esperada | Fallback contextual |
|---|---|---|---|---|---|
| redmi note 15 | none | Lista opcoes | product_search.awaiting_choice | numero, nome ou mais | Me diga o numero da opcao ou o nome do modelo. |
| 1 | product_search.awaiting_choice | Detalhe do produto | purchase.awaiting_action | comprar, detalhes ou outro produto | Quer comprar, ver detalhes ou procurar outro modelo? |
| mais | product_search.awaiting_choice | Proxima pagina | product_search.awaiting_choice | numero, nome ou mais | Ja mostrei tudo dessa lista. Quer buscar outro modelo? |

## Fluxo: Compra

| Entrada | Estado atual | Resposta do bot | Proximo estado | Resposta esperada | Fallback contextual |
|---|---|---|---|---|---|
| comprar | purchase.awaiting_action | Pergunta quantidade | purchase.awaiting_quantity | numero | Me envie a quantidade em numero. Ex: 1 |
| 1 | purchase.awaiting_quantity | Adiciona item e pergunta finalizar | purchase.item_added | finalizar, adicionar, remover | Responda finalizar, adicionar ou remover. |
| finalizar | purchase.item_added | Pergunta entrega ou retirada | purchase.awaiting_fulfillment | entrega ou retirada | Voce prefere entrega ou retirada na loja? |

## Fallback Fora Do Fluxo

Mensagem padrao:

```text
Nao consegui identificar certinho. Voce quer ver produtos, consultar entrega, formas de pagamento ou falar com atendente?
```
