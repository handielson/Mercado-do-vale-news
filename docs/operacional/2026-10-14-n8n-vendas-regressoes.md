# Vendas WhatsApp: correções e proteção contra regressões

Estado: publicado em v1.2.628-vendas-entregas. API contrato 2 instalada antes do workflow; entidade/histórico alinhados, 61 testes no readback e dry-run posterior changed=false. Não houve envio de WhatsApp, alteração de estoque ou criação de pedido nesta validação.

## Causas e correções

- O catálogo agrupava memórias distintas pelo menor preço e unia as cores. O contexto da IA, a escolha e o resumo agora conservam produto, memória, cor e preço da configuração exata. Uma versão ambígua exige esclarecimento. A resposta oficial do catálogo prevalece sobre preços escritos pela IA.
- Perguntas sobre cartão, produtos e entrega entravam nos campos de endereço. O coletor distingue respostas ao campo de interrupções e mantém os dados já coletados.
- Eventos rápidos podiam sobrescrever um estado mais recente. A API exige a revisão esperada, inclusive para eventos com horário posterior. Em conflito, o fluxo recarrega o estado e reaplica o mesmo evento, com limite de tentativas; sem confirmação de persistência, não envia a resposta derivada.
- O estado terminal dizia que o pedido estava encaminhado sem criar pedido nem avisar a equipe. O fluxo agora solicita conferência humana com a configuração e o valor, e só afirma que avisou a equipe após confirmação do mecanismo de notificação existente. Disponibilidade e horário continuam sujeitos à confirmação humana.

## Validação reproduzível

Gerar o candidato a partir do fluxo atual com `tmp-tests/n8n-sales-flow-contract.cjs`, sem reutilizar exportações antigas como substituição integral da produção. Rodar:

```powershell
npm.cmd run test:n8n-sales -- --snapshot caminho-do-candidato.json
node tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --sales-contract
```

O primeiro comando exige o artefato exato e falha se um teste falhar ou se o artefato mudar durante a validação. O segundo é uma simulação: consulta o fluxo atual, compõe o candidato, verifica escopo e idempotência e executa a mesma bateria antes de qualquer aplicação. O modo `--apply` exige autorização de publicação.

A bateria independente executa o código dos nós exportados com dados sintéticos, sem importar os transformadores. A primeira rodada reproduziu 11 falhas no fluxo anterior; a versão final passou em 19 cenários independentes. A bateria completa passou em 61 testes e também cobre as regras de variantes, coleta, concorrência, confirmação humana e PayJoy. Testes de valores monetários e do autoresponder foram executados separadamente.

Esses testes simulam entradas de IA e HTTP. Não equivalem a executar o agendador real do n8n, o modelo real, SQL ou o envio pela Evolution. Após publicação autorizada, conferir versão ativa/histórico, saúde e novas execuções; não reenviar conversa de cliente como teste.

## Próximas mudanças

1. Cada defeito observado vira um cenário sintético que falha antes da correção. Não incluir dados pessoais em fixtures.
2. Alterar a regra existente; remover caminhos antigos substituídos. Conservar agrupamento visual sem misturar os fatos de cada variante.
3. Testar o candidato final inteiro, incluindo PayJoy, encaminhamento humano e perguntas durante a coleta. Testar rejeição de dados ambíguos e eventos repetidos/concorrentes.
4. Aplicar apenas o escopo revisado sobre o fluxo atual. O mutador canônico executa a bateria também quando patches PayJoy são reaplicados sobre o contrato novo.
5. Na publicação, atualizar primeiro a API com `n8n_conversation_state_contract >= 2` em `/status`. O mutador bloqueia a aplicação do novo fluxo se esse contrato estiver ausente. Só depois atualizar o workflow e seu histórico ativo, reler e repetir a validação.
6. Guardar backup e identificar o artefato validado pelo SHA-256. Outros meios de editar o workflow precisam executar a mesma bateria; este bloqueio não impede edições manuais externas ao mutador.
