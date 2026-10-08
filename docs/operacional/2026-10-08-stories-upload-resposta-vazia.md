# Stories: resposta vazia no upload

O Nginx registrou em 08/10/2026 às 19:54:29 e 19:54:47 UTC `POST /api/vps-proxy?path=%2Fsynology%2Fupload%3Ffolder%3Dimagens` com status 200 e zero bytes. Também ocorreram respostas vazias em uploads diretos de vídeo. A lista GET de agendamentos retornou normalmente. A falha desta tela ocorre no upload, antes da criação do novo agendamento.

A rota `/synology/upload` enviava o recibo com `reply.send()` e encerrava o handler async sem retornar `reply`. Com hooks assíncronos de serialização, Fastify concluía a requisição com corpo vazio antes do recibo. Reproduzido localmente com HTTP 200 vazio e erro de cabeçalhos enviados duas vezes. O cliente tentava `Response.json()` e exibiu `Unexpected end of JSON input`.

Correção nas três entradas existentes: retornar `reply` depois de enfileirar a tarefa de background. Mantém autenticação, limites, recibo, status e processamento existentes. Não troca por upload síncrono, não repete automaticamente uma requisição e não modifica agendamentos ou publica mídias.

Validação: `node --test tmp-tests/synology-upload-response.test.cjs` executa a rota extraída das três entradas com hook assíncrono, arquivo simulado e background interceptado: 3 testes passaram. Confirma JSON com uploadId/URL, tarefa enfileirada uma vez e rejeição de pasta inválida. Sintaxe das três entradas, 13 testes estáticos de Stories e regressões `test:marketing-calendar` passaram.

Publicação da API pendente, seguindo `publish-vps`. Nenhum arquivo foi enviado ao NAS nem agendamento criado/cancelado em teste. Os uploads anteriores podem ter sido processados mesmo sem recibo; a falta de resposta não significa ausência do arquivo. Não houve tentativa automática adicional nem alteração de produção. Preservadas as alterações pendentes do complemento de título e os arquivos preexistentes de Shopee.
