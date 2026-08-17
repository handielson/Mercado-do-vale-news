# Filtro de aparelhos já disponíveis — Design

## Objetivo

Deixar a fila de cadastro por foto focada nos aparelhos que ainda exigem trabalho, sem confundir produto/variação existente com aparelho já liberado para venda.

## Escopo

- Exibir o controle `Ocultar já disponíveis` na fila de conferência, desligado inicialmente.
- Quando ativado, ocultar apenas itens cujo status seja `completed` (`Disponível para venda`).
- Manter os demais estados e os dados da fila inalterados.
- Trocar o aviso de variação existente por uma explicação orientada à ação: o produto foi encontrado e ainda falta concluir o aparelho para a venda.

## Fora do escopo

Não haverá alteração em estoque, preços, IMEI, produto, variação, API ou regras de finalização.

## Fluxo

1. A fila continua carregando e ordenando todos os itens como hoje.
2. O filtro visual remove somente os itens `completed` da lista apresentada e atualiza o contador para os itens visíveis.
3. Se o item selecionado for filtrado, a tela seleciona o primeiro item ainda visível; se não houver, não mostra item selecionado.
4. O aviso de produto encontrado informa que não será criado outro produto e que o aparelho deve ser concluído para ficar disponível à venda.

## Proteção regressiva

O teste estático do fluxo de foto deve confirmar o filtro por `completed`, a cópia visível do controle e os novos textos que distinguem produto encontrado de aparelho pendente.
