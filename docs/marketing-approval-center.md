# Central de Aprovações de Marketing

## Decisão de execução

Usar a VPS como executor principal. Ela fica disponível continuamente e deve operar pelas APIs oficiais da Meta. Usar o Lenovo conectado ao tunnel apenas para uma ação que não tenha cobertura suficiente na API oficial e que possa ser realizada de forma compatível com as regras da plataforma.

Não criar extensão de Chrome antes de confirmar uma lacuna real da API. Uma extensão adiciona dependência de sessão, atualização do navegador, mudança de interface e disponibilidade do computador.

## Fluxo

```text
Agente prepara ação
  -> Gestão MV grava solicitação pendente
  -> Administrador revisa antes/depois, impacto, sucesso e reversão
  -> Aprovação válida por até 24 horas
  -> Executor autorizado reivindica a ação uma única vez
  -> Executor revalida estado externo
  -> Executor aplica ou registra falha
  -> Gestão MV preserva o histórico de eventos
```

Estados: `pending`, `approved`, `rejected`, `executing`, `succeeded`, `failed`, `cancelled` e `expired`.

## Autenticação

- Decisão humana: token administrativo do Gestão MV.
- Criação pelo agente: administrador ou `SYNC_SECRET` já autorizado pela API.
- Executor: header `x-marketing-runner-key` correspondente a `MARKETING_RUNNER_SECRET` na VPS.
- Não colocar token da Meta, cookies ou segredos dentro de `execution_payload` ou do histórico.

## Contrato do executor

- `GET /marketing-runner/approvals?execution_mode=vps_meta_api`: buscar ações aprovadas.
- `POST /marketing-runner/approvals/:id/claim`: reivindicar com `runner_id`.
- `POST /marketing-runner/approvals/:id/complete`: concluir com resultado sanitizado ou erro.

Modos disponíveis:

- `vps_meta_api`: VPS usando API oficial da Meta;
- `lenovo_chrome`: executor assistido no Lenovo, somente quando necessário;
- `manual`: ação apresentada para execução humana.

## Conexão Meta e auditoria

A área `Marketing > Campanhas IA` inicia o OAuth oficial e usa a callback configurada em `META_OAUTH_REDIRECT_URI`. O token fica somente na API da VPS, criptografado com AES-256-GCM por `META_TOKEN_ENCRYPTION_KEY`; o frontend recebe apenas estado, ativos descobertos e resultados de auditoria.

Depois da conexão, o administrador escolhe explicitamente a conta de anúncios e a Página ligada ao Instagram. A ação `Auditar agora` é somente leitura: consulta a conta, o perfil e as campanhas existentes, sem criar, pausar, ativar ou alterar orçamento.

O painel de indicadores consulta Insights no nível de campanha e organiza os dados em resultados de negócio, investimento/entrega, cliques/intenção e interação/vídeo. Ele oferece períodos de 7, 14 e 30 dias ou mês atual, sempre comparados à janela anterior equivalente. Cada indicador inclui explicação e orientação de interpretação; os eventos técnicos adicionais recebidos da Meta ficam disponíveis em uma seção recolhida.

Os números de conversa, compra, receita e ROAS exibem `Não mensurado` quando não existe valor atribuído. Isso evita apresentar zero como prova de ausência de venda quando o verdadeiro problema pode ser mensuração incompleta entre anúncio, WhatsApp, bot e fechamento.

As duas campanhas têm objetivo fixo de vendas e destino no WhatsApp oficial cadastrado na loja. A mensagem inicial inclui nome/modelo e SKU para o bot identificar o produto sem obrigar o cliente a repetir a escolha. Antes da ativação, o agente ainda deve validar o número, o vínculo da Meta com o WhatsApp e o roteamento real do bot.

## Execução em duas aprovações

A primeira aprovação usa a ação fixa `meta.create_paused_campaign_bundle.v1`. O executor da VPS cria somente dois recipientes de campanha, ambos pausados e sem conjuntos de anúncios, anúncios ou orçamento aplicado:

- `MDV | Loja inteira | Carrossel | Petrolina + Juazeiro`;
- `MDV | Smartphones | Petrolina + Juazeiro`.

O executor revalida a conexão, a permissão `ads_management`, a conta de anúncios aprovada e a existência de campanhas com os mesmos nomes. Cada item possui registro próprio de execução, evitando uma segunda criação quando houver repetição ou retomada do processamento.

A configuração de público local, posicionamentos, criativos, destino no WhatsApp e orçamento será preparada depois e exigirá uma nova aprovação. Essa segunda etapa deve respeitar o teto mensal autorizado de R$ 1.000,00, sendo R$ 400,00 para a loja inteira e R$ 600,00 para smartphones. Nenhuma campanha poderá ser ativada nessa primeira aprovação.

O Lenovo e uma possível extensão de Chrome continuam como alternativas somente se uma lacuna comprovada da API oficial impedir alguma ação necessária.
