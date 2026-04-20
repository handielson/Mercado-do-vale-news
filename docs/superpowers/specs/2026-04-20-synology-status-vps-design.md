# Painel NAS em Status VPS

## Objetivo

Adicionar na tela `Status VPS` um painel do Synology NAS com memoria RAM online, swap, uptime, idade da ultima leitura e acoes operacionais seguras, sem customizar o DSM e sem expor credenciais do NAS no frontend.

## Recomendacao

Usar a VPS como intermediaria. O NAS envia um heartbeat periodico para a VPS com suas metricas. O admin consome essas metricas pela propria API da VPS.

Essa abordagem e a recomendada porque:

- evita acoplamento do navegador ao DSM
- evita expor usuario, senha ou token do NAS no frontend
- reaproveita a fila de comandos Synology ja existente
- continua funcional mesmo quando o navegador nao consegue acessar o NAS diretamente
- mantem a customizacao dentro do nosso sistema, nao dentro da interface nativa da Synology

## Escopo

### Interface

Expandir a pagina `pages/admin/settings/VpsStatusPage.tsx` para exibir:

- status do NAS: `online`, `desatualizado`, `offline`
- RAM total, usada e disponivel
- swap total, usado e livre
- uptime do NAS
- horario do ultimo heartbeat
- proximo reboot semanal configurado
- botoes de acao:
  - `Atualizar agora`
  - `Reiniciar tunel`
  - `Reiniciar NAS agora`

### Backend VPS

Adicionar endpoints em `vps_server.js` para:

- receber o ultimo snapshot de status do NAS
- expor esse snapshot ao frontend
- enfileirar comando de reboot completo do NAS

### NAS

Expandir `synology-command-poller.sh` para:

- continuar consumindo a fila de comandos da VPS
- coletar metricas locais do NAS
- enviar heartbeat periodico com essas metricas para a VPS

## Arquitetura

### Fluxo de leitura

1. O script local do NAS coleta metricas com comandos locais.
2. O script envia os dados para a VPS com autenticacao via `x-poll-key`.
3. A VPS guarda o ultimo snapshot em memoria.
4. A pagina `Status VPS` busca esse snapshot e renderiza os cards do NAS.

### Fluxo de acoes

1. O admin clica em uma acao na tela.
2. O frontend chama a VPS via `vpsClient`.
3. A VPS enfileira um comando para o NAS.
4. O `synology-command-poller.sh` consome a fila na proxima execucao.
5. O NAS executa o comando e envia `ack-command`.
6. A tela mostra `pendente`, `sucesso` ou `falha`.

## Dados do Snapshot

O payload recomendado para o status do NAS:

```json
{
  "ok": true,
  "hostname": "Hand_Server",
  "model": "DS723+",
  "timestamp": "2026-04-20T16:40:00.000Z",
  "uptime_seconds": 123456,
  "memory": {
    "total_mb": 1942,
    "used_mb": 765,
    "available_mb": 876,
    "used_percent": 39
  },
  "swap": {
    "total_mb": 3213,
    "used_mb": 28,
    "free_mb": 3185,
    "used_percent": 1
  },
  "cache": {
    "cached_mb": 762,
    "buffers_mb": 18,
    "slab_mb": 126
  },
  "health": {
    "level": "ok",
    "message": "Memoria estavel"
  },
  "scheduled_reboot": {
    "enabled": true,
    "label": "Domingo 04:00"
  }
}
```

## Coleta no NAS

O script do NAS deve coletar:

- `hostname`
- `model`
- `uptime_seconds`
- memoria e swap via `/proc/meminfo`
- data da coleta

Comandos base:

- `cat /proc/sys/kernel/syno_hw_version`
- `cat /proc/uptime`
- `cat /proc/meminfo`

Nao vamos depender de parse de interface HTML do DSM.

## Regras Visuais

### Badge de saude

- `ok`: memoria disponivel >= 25% e swap usado < 20%
- `warning`: memoria disponivel < 25% ou swap usado >= 20%
- `critical`: memoria disponivel < 15% ou swap usado >= 40%
- `offline`: heartbeat ausente ou atrasado

### Staleness do heartbeat

- `online`: ultimo heartbeat ha menos de 2 minutos
- `desatualizado`: entre 2 e 5 minutos
- `offline`: acima de 5 minutos

## Acoes

### Atualizar agora

Atualiza a leitura da pagina imediatamente. Nao obriga o NAS a coletar naquele segundo; apenas reconsulta a VPS.

### Reiniciar tunel

Reaproveita o mecanismo ja existente de `enqueue-restart` para o `cloudflared`.

### Reiniciar NAS agora

Nova acao, mais sensivel, com protecoes:

- confirmacao explicita
- texto de impacto
- bloqueio quando ja existir comando pendente
- retorno visual de `pendente`, `sucesso` ou `falha`

O comando executado no NAS sera:

```bash
/sbin/reboot
```

## Endpoints Recomendados

### VPS -> frontend

- `GET /synology/status`
- `GET /synology/command-status`
- `POST /synology/enqueue-restart`
- `POST /synology/enqueue-reboot`

### NAS -> VPS

- `GET /synology/poll-command`
- `POST /synology/ack-command`
- `POST /synology/report-status`

## Persistencia

Inicialmente, guardar o ultimo snapshot do NAS em memoria dentro do processo da VPS e suficiente.

Justificativa:

- implementacao mais simples
- baixo risco
- resolve o problema imediato

Limite conhecido:

- se a VPS reiniciar, o snapshot some ate o proximo heartbeat

Isso e aceitavel para a fase 1.

## Tratamento de Erros

- se a VPS nao tiver snapshot do NAS: mostrar estado `sem dados ainda`
- se o heartbeat estiver velho: mostrar `desatualizado` ou `offline`
- se houver comando pendente: desabilitar botoes destrutivos
- se o reboot falhar: mostrar ultima mensagem de erro curta retornada pelo poller

## Testes

### Backend

- teste do endpoint `GET /synology/status` sem snapshot
- teste do endpoint `GET /synology/status` com snapshot valido
- teste do `POST /synology/enqueue-reboot`
- teste de expiracao de comando pendente

### Frontend

- renderiza card do NAS quando existir snapshot
- renderiza estados `online`, `desatualizado` e `offline`
- desabilita `Reiniciar NAS agora` quando ha comando pendente
- exibe mensagens de erro e loading corretamente

### Operacional

- validar que o `synology-command-poller.sh` continua executando o restart do tunel
- validar que o heartbeat chega na VPS no intervalo esperado
- validar que o reboot semanal continua separado desta funcionalidade

## Riscos

### Risco principal

O reboot manual do NAS e uma acao sensivel. Se for disparado no horario errado, pode interromper sincronizacao, upload ou acesso remoto.

Mitigacao:

- confirmacao visual
- estado pendente claro
- sem execucao automatica fora das tarefas agendadas

### Risco secundario

Snapshot apenas em memoria pode sumir ao reiniciar a VPS.

Mitigacao:

- o poller volta a publicar no proximo ciclo
- a UI deve tratar o estado `sem dados`

## Fora de Escopo

- editar a interface nativa do DSM
- ler metricas diretamente do browser para o NAS
- expor credenciais do NAS no frontend
- salvar historico longo de metricas
- criar graficos de tendencia na fase 1

## Resultado Esperado

A tela `Status VPS` passa a funcionar como um painel operacional unico da infraestrutura, mostrando tanto a saude da VPS quanto a saude atual do Synology NAS, com memoria online e acoes administrativas seguras.
