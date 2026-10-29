# Seguranca e controle de mudancas

Fonte canonica: `regras.md` e `publicar.md`. Este resumo aponta os controles que devem ser lidos junto com eles, sem substitui-los.

- Diagnostico permite leitura e testes nao mutantes; escrita externa, deploy, restart, migration e publicacao exigem pedido explicito ou uma etapa inequivoca ja autorizada.
- Antes de alterar, confira `git status`, pesquise implementacoes equivalentes e revise a fonte de verdade. Nunca sobrescreva trabalho preexistente.
- Mudancas em estoque, preco, vendas, PDV, Bling, Shopee ou sincronizacao precisam de protecao regressiva focada e testes relacionados.
- Stage e sempre por arquivo; nunca usar `git add .`, reset destrutivo ou limpeza ampla.
- Nunca ler, imprimir, copiar para logs ou incluir em evidencias valores de `.env`, certificados, tokens, cookies ou chaves privadas. Relatar somente presenca/caminhos quando necessario.
- Para este trabalho, a instrucao do usuario e nao alterar saldo do sistema Mercado do Vale. Uma escrita local ou leitura de anuncio nao autoriza gravacao no Mercado Livre nem na producao.
- Preco, pedido, anuncio e estoque externos devem ser consultados antes de uma escrita e conferidos depois; falha ambigua nao pode gerar repeticao automatica.
- Nao alterar banco, migration ou schema sem plano e pedido explicito. Toda mudanca operacional deve ser aplicada nos ambientes suportados pelos scripts oficiais, nunca por um caminho improvisado.

Para qualquer publicacao, seguir integralmente `publicar.md` e a skill `publish-vps`; nao usar este resumo como substituto.
