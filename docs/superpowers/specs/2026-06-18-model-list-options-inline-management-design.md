# Gerenciamento de Opcoes de Lista no Editor de Modelos

## Objetivo

Permitir cadastrar e editar itens de campos selecionaveis diretamente no editor de modelos, sem sair do fluxo atual. Quando a IA retornar um item ainda inexistente, o sistema deve cadastra-lo, seleciona-lo e manter uma acao de edicao disponivel.

O recurso atua sobre os itens dentro dos campos, nao sobre a criacao de novos campos personalizados.

## Escopo

O comportamento deve funcionar em todos os campos renderizados como lista:

- campos personalizados com opcoes manuais (`select`);
- campos relacionados a tabelas (`table_relation`);
- listas como Cor, RAM, Armazenamento, Versao e outras configuradas dinamicamente.

Campos de texto, numero, data, checkbox e outros controles que nao sejam listas permanecem inalterados.

## Interface

Cada campo de lista deve ser renderizado em uma linha estavel:

- o seletor ocupa o espaco disponivel;
- um botao de adicionar, com icone `Plus`, fica alinhado a direita;
- um botao de editar, com icone `Pencil`, aparece ao lado quando houver item selecionado;
- ambos possuem tooltip e dimensoes fixas para nao deslocar o formulario.

O botao de adicionar abre um modal compacto sobre o editor de modelos. O modal identifica o campo de origem e solicita os dados necessarios para aquela lista.

O botao de editar abre o mesmo modal preenchido com o item selecionado. Ao salvar, a lista e o valor selecionado sao atualizados imediatamente.

Para listas manuais, o formulario edita o texto da opcao. Para tabelas, o formulario usa os atributos suportados pela tabela. Cor deve permitir nome e codigo hexadecimal; tabelas simples usam pelo menos o nome.

## Cadastro Manual

Ao clicar em adicionar:

1. O usuario informa o novo item.
2. O sistema normaliza o texto para procurar duplicidades.
3. Se ja existir um item equivalente, nenhuma duplicata e criada e o item existente e selecionado.
4. Se nao existir, o item e persistido na fonte correspondente.
5. A lista local e recarregada.
6. O item criado fica pre-selecionado no modelo.

A comparacao de duplicidade ignora:

- diferencas entre maiusculas e minusculas;
- acentos;
- espacos excedentes no inicio, fim ou entre palavras.

## Preenchimento por IA

Quando o JSON gerado ou aplicado contiver um valor inexistente em um campo de lista:

1. O normalizador continua identificando a escolha ausente.
2. O editor tenta localizar novamente um equivalente normalizado.
3. Se ainda nao existir, cria o item na fonte correspondente.
4. Atualiza as opcoes do campo.
5. Aplica o novo identificador ou valor ao modelo.
6. Exibe uma notificacao informando quais itens foram criados.
7. A notificacao oferece a acao `Editar`, que abre o editor do item criado.

O preenchimento dos demais campos nao deve ser interrompido se uma criacao falhar. Nesse caso, o item permanece sem selecao e uma mensagem identifica o campo e o valor que nao puderam ser cadastrados.

Itens vazios, respostas genericas como `Nao informado` e valores incompativeis com o tipo do campo nao devem ser criados automaticamente. Esses valores permanecem pendentes para revisao manual.

## Persistencia

### Listas manuais

Adicionar ou editar uma opcao atualiza o array `options` do registro em `custom_fields` por meio de `customFieldsService.update`.

Ao editar uma opcao ja usada pelo modelo aberto, o valor do modelo tambem e substituido. Outros modelos existentes nao serao migrados automaticamente nesta primeira versao.

### Listas por tabela

O `tableDataService` deve ganhar operacoes explicitas para criar e atualizar linhas usando `/table-data/:table`.

O cadastro deve preservar os campos obrigatorios conhecidos pela tabela. Para tabelas simples, o valor principal e salvo na coluna configurada como `label_column`. Identificadores e demais colunas usam os padroes ja adotados pelos servicos especificos quando necessario.

Tabelas com regras proprias, como cores, devem usar o servico de dominio existente para preservar validacoes e atributos adicionais. Tabelas genericas podem usar o servico de dados de tabela.

## Componentes

### Controle de lista

Um componente reutilizavel deve encapsular:

- seletor;
- botoes de adicionar e editar;
- estado de carregamento;
- recarga das opcoes;
- selecao do item criado ou atualizado.

Ele deve funcionar com listas manuais e relacionamentos de tabela por meio de callbacks, sem conhecer detalhes de persistencia.

### Editor de opcao

Um modal compacto deve receber:

- campo;
- item atual opcional;
- modo `create` ou `edit`;
- callback de salvamento.

O modal deve manter o foco no fluxo do modelo e fechar somente depois da persistencia bem-sucedida.

### Orquestracao da IA

O editor de modelos deve processar `missingChoices` de forma assincrona antes de aplicar definitivamente os valores de lista. O resultado deve retornar:

- valores resolvidos;
- itens criados;
- falhas por campo.

## Concorrencia e Estado

- Os botoes do campo ficam desabilitados durante a gravacao daquele item.
- A aplicacao da IA fica em estado de processamento enquanto cria itens ausentes.
- Cada campo e atualizado de forma independente.
- Uma falha nao desfaz itens que ja foram criados com sucesso.
- Depois da criacao ou edicao, o cache de campos personalizados e invalidado quando aplicavel.

## Seguranca

O sistema nao deve permitir que o usuario informe arbitrariamente uma tabela. As operacoes usam apenas `table_name`, `value_column` e `label_column` provenientes do cadastro carregado para o campo.

As rotas existentes de `table-data` permanecem protegidas por `X-Sync-Key` e pela validacao de identificadores do servidor. O recurso nao cria uma rota publica nem aceita nomes de tabela vindos do formulario de edicao.

## Testes

Devem ser cobertos:

- botao de adicionar em listas manuais e por tabela;
- botao de editar somente quando houver selecao;
- criacao manual com pre-selecao;
- reaproveitamento de opcao equivalente sem duplicar;
- edicao de opcao manual;
- criacao e edicao de item por tabela;
- criacao automatica de escolha ausente retornada pela IA;
- selecao automatica do item criado pela IA;
- falha parcial sem perder os demais campos preenchidos;
- bloqueio de valores vazios ou genericos;
- recarga das opcoes ao reabrir o modal;
- build completo da aplicacao.

## Fora do Escopo

- criar novos campos personalizados dentro do editor de modelos;
- migrar valores de todos os modelos quando uma opcao for renomeada;
- excluir itens de lista pelo editor de modelos;
- cadastrar automaticamente marcas ou categorias retornadas pela IA;
- alterar regras de campos que nao sejam listas.

## Criterios de Aceite

- Toda lista exibida no editor possui controles alinhados para adicionar e editar itens.
- Um item criado manualmente aparece e fica selecionado sem recarregar a pagina.
- Uma escolha nova retornada pela IA e persistida e selecionada automaticamente.
- O usuario consegue editar imediatamente um item criado pela IA.
- Opcoes equivalentes nao sao duplicadas.
- Falhas de cadastro sao apresentadas sem descartar o restante do preenchimento.
