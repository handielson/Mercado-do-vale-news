# PDV - Venda Rapida com Cliente Balcao

Data: 2026-06-12

## Objetivo

Criar um fluxo de venda simplificada no PDV para compradores que nao querem se cadastrar. A venda ainda precisa gerar historico em um perfil tecnico para permitir consulta, devolucao e estorno de uma venda especifica.

## Perfil tecnico

Usar um cliente unico chamado `Cliente Balcao`.

Esse perfil nao representa uma pessoa real. Ele existe apenas para satisfazer a obrigatoriedade de `customer_id` nas vendas e concentrar o historico das vendas sem cadastro.

Regras do perfil:

- Sem CPF/CNPJ.
- Sem telefone/e-mail obrigatorios.
- Sem beneficios.
- Sem moedas.
- Conta ativa.
- Deve ser facilmente selecionavel no PDV.
- Deve poder ser criado automaticamente se nao existir.

## Fluxo no PDV

Na area de cliente do PDV, adicionar uma acao visivel: `Venda rapida` ou `Cliente Balcao`.

Ao acionar:

- selecionar automaticamente o perfil `Cliente Balcao`;
- definir a entrega como `Retirada na loja`;
- limpar custos de entrega;
- manter o restante do fluxo normal de carrinho, pagamento, comprovante e finalizacao.

O usuario ainda pode trocar para um cliente real se desejar antes de finalizar.

## Finalizacao da venda

Quando a venda estiver associada ao `Cliente Balcao`:

- nao acumular Moedas do Vale;
- nao conceder beneficios, incluindo beneficio de pelicula;
- nao exigir CPF/CNPJ;
- gravar a venda normalmente com `customer_id` do perfil tecnico;
- permitir que a venda apareca no historico do `Cliente Balcao`.

## Devolucao e estorno

Como a venda rapida gera venda real vinculada ao `Cliente Balcao`, qualquer devolucao ou estorno deve continuar apontando para a venda especifica, nao para um cadastro anonimo.

Isso permite localizar:

- data da venda;
- itens vendidos;
- metodo de pagamento;
- vendedor;
- comprovante;
- status da venda.

## Dados e compatibilidade

Preferir uma flag no cliente para identificar o perfil tecnico, por exemplo:

- `is_walk_in_customer = true`

Se nao for seguro criar coluna nova de imediato, pode-se usar uma identificacao por nome normalizado como fallback inicial, mas a implementacao final deve evitar depender apenas do nome.

## Testes

Validar:

- PDV consegue selecionar/criar `Cliente Balcao`;
- venda finaliza com retirada na loja;
- venda fica no historico do `Cliente Balcao`;
- venda com `Cliente Balcao` nao gera moedas;
- venda com `Cliente Balcao` nao gera beneficios;
- cliente real continua funcionando sem regressao.
