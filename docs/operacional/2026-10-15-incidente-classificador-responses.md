# Incidente do classificador OpenAI — 15/10/2026

Status: causa identificada; correção mínima preparada e testada localmente. Produção não alterada nesta investigação.

## Evidência em produção

O workflow `SkrkB4vyKVDnQ68t` está ativo e sua entidade coincide com o histórico ativo. Main e runner estão em `1/1`; `/healthz` e `/healthz/readiness` respondem `ok`. Isso não prova atendimento funcionando: as chamadas ao classificador falham antes da resposta.

Os erros das execuções `41764`, `41774`, `41781` e `41786` contêm a descrição da API:

> Unsupported parameter: 'reasoning_effort'. In the Responses API, this parameter has moved to 'reasoning.effort'.

O cliente final 8918 corresponde à execução `41764`; o final 0939, à `41781`. As outras duas correspondem ao final 8751. Não houve repetição dessas execuções nem envio aos clientes nesta investigação.

A execução `40805`, de 14/10 às 18:13 no horário de Brasília, antecede a migração. Sua descrição é outra: corpo JSON inválido. A causa exata desse corpo antigo não foi comprovada; não atribuir esse erro à nova configuração de reasoning.

## Causa e lacuna dos testes anteriores

A migração publicada deixou `options.extraBody` com `{"reasoning_effort":"none"}` nos três provedores de chat. O schema instalado do `lmChatOpenAi` v1.3 tem `responsesApiEnabled` com padrão `true`. Em produção, o parâmetro incompatível era enviado à API Responses.

O contexto simulado do teste anterior retornava o fallback `false` quando esse parâmetro estava ausente, sem aplicar o padrão do schema. Assim, os testes reais anteriores usaram Chat Completions e não reproduziram a seleção de API do runtime. Eles não constituíam evidência de compatibilidade do agente em produção. Esse erro de cobertura permitiu a regressão publicada.

Fonte: configuração ativa, descrições completas das execuções e código/schema instalados no n8n 2.38.5. A [documentação oficial da OpenAI](https://developers.openai.com/api/docs/guides/reasoning) confirma o campo `reasoning.effort` para Responses.

## Correção mínima preparada

Somente `OpenAI Chat Model`, `OpenAI Classificador` e `OpenAI Vendas` mudam:

```json
{
  "responsesApiEnabled": true,
  "options": {
    "extraBody": "{\"reasoning\":{\"effort\":\"none\"}}",
    "temperature": 0
  }
}
```

O transformador existente de migração remove o campo antigo, explicita a API e preserva modelo, credenciais, prompts, nós restantes e conexões. Esta correção de incidente fica separada das sete correções de atendimento preparadas anteriormente, que também continuam sem publicação.

O teste nativo agora executa `ToolsAgentV3.toolsAgentExecute` para os três agentes, em vez de chamar somente `model.invoke`. O helper reutiliza os parâmetros e prompts dos agentes, sem memória externa, ferramentas ou mensageiro. A interceptação das requisições exige `/responses`, o modelo esperado, `reasoning.effort=none` e ausência de `reasoning_effort` e `max_tokens`. As duas leituras de imagem continuam pelo adaptador nativo OpenAI.

O publicador rejeita evidência antiga que não confirme `responsesApi=true` e `nativeAgentExecution=true`.

## Validação

- 6 testes da migração e 61 testes de regressão passaram sobre o candidato exportado novamente do fluxo ativo.
- 8 cenários reais passaram: quatro decisões do classificador; explicação contextual PayJoy; produto sem estoque confirmado; imagem sintética aprovada; imagem ilegível.
- O hash da evidência real coincide com o candidato gerado no preflight: `1ef08bb887e985f859976d81f673002d4cc86baf790af7816b5d5b720b33c88f`.
- Revisão especializada confirmou o padrão do schema e reproduziu o caminho do Agent com rede simulada.
- Nenhum `--apply`, restart, commit, push ou envio WhatsApp foi executado nesta investigação.

O preflight disponível usa `tmp-tests/n8n-fix-payjoy-link-confirmation.cjs --gpt6-luna --snapshot-out CAMINHO`. Antes de publicar, repetir o preflight e gerar evidência recente com `tmp-tests/n8n-gpt6-luna-native-smoke.cjs --snapshot CAMINHO --evidence EVIDENCIA`; o hash deve coincidir. Aplicação em produção depende de autorização e do procedimento de publicação existente.
