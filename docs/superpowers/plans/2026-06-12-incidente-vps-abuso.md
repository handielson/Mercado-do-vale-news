# Incidente VPS Hostinger - abuso / uso excessivo

Data: 2026-06-12
Servidor: srv1412857.hstgr.cloud / KVM 2
Status: publicacao pausada ate auditoria e liberacao do servidor.

## Evidencia recebida

- Hostinger informou suspensao por abuso.
- Transcript do Kodee informou limite automatico por uso alto e prolongado de CPU.
- Kodee informou que o servidor foi parado para evitar atividade maliciosa adicional.
- Kodee informou que nao ha scanner Monarx instalado no VPS.
- Painel de uso mostra limitacao de recursos e processo suspeito:
  - `./systemd-bench --config=.bench.json --threads=2`
  - CPU aproximada: 179%
- Kodee encontrou persistencia por cron executando `xmrig-restore` no boot e a cada 30 minutos.
- Crontab confirmado:
  - `@reboot sleep 90 && /etc/xmrig-restore/restore.sh`
  - `*/30 * * * * /etc/xmrig-restore/restore.sh`
- Outros processos visiveis:
  - `runc init`
  - `/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock`
  - `/usr/bin/containerd`
  - `/usr/sbin/mysqld`

## Hipotese inicial

O processo `systemd-bench` nao parece parte normal do sistema nem da aplicacao Mercado do Vale. Por estar sendo executado como arquivo local (`./systemd-bench`) com arquivo oculto `.bench.json`, a hipotese principal e comprometimento do VPS ou container rodando minerador/benchmark abusivo.

A persistencia `xmrig-restore` no cron confirma forte indicio de minerador, nao apenas configuracao pesada.

## Checklist de contencao

- [x] Pausar publicacao cirurgica ate entender a causa.
- [x] Aplicar endurecimento local inicial no backend com rate limit em rotas publicas sensiveis.
- [x] Validar localmente build e testes depois do endurecimento.
- [x] Criar script de auditoria somente leitura para executar no VPS quando o acesso voltar.
- [ ] Solicitar para a Hostinger os detalhes tecnicos do abuso.
- [ ] Iniciar/liberar console do VPS apenas para auditoria, sem remover limitacao semanal.
- [ ] Obter acesso SSH/rescue ou console para auditoria.
- [ ] Identificar caminho, usuario e processo pai do `systemd-bench`.
- [ ] Remover persistencia `xmrig-restore` do crontab apos backup.
- [x] Remover persistencia `xmrig-restore` do crontab apos backup.
- [x] Parar os processos suspeitos encontrados.
- [x] Confirmar quarentena/remocao de `/etc/xmrig-restore`.
- [x] Confirmar apos reboot que `xmrig-restore`, `xmrig`, `systemd-bench` e `.bench.json` nao voltaram.
- [x] Identificar processos `MainThr+` vistos apos limpeza e confirmar se sao servicos Node conhecidos.
- [x] Confirmar que migracoes/boot da Evolution finalizaram.
- [x] Verificar no codigo ativo se Mercado do Vale depende de n8n.
- [x] Pausar n8n para reduzir carga antes de remover limitacao.
- [x] Remover limitacao Hostinger.
- [x] Confirmar CPU sem `st` alto apos remocao da limitacao.
- [x] Confirmar cron limpo e site local respondendo apos remocao da limitacao.
- [x] Confirmar n8n sem processo ativo e servicos Docker n8n em `0/1`.
- [ ] Remover persistencias desconhecidas adicionais em cron, systemd, Docker e scripts de boot.
- [ ] Rotacionar senhas e chaves.
- [ ] Revisar firewall, SSH e fail2ban.
- [x] Trocar senha root.
- [x] Limpar/recriar `/root/.ssh/authorized_keys`.
- [x] Criar/adicionar nova chave SSH confiavel para deploy.
- [x] Desativar login SSH por senha e manter root apenas por chave.
- [ ] Publicar somente depois de ambiente limpo ou VPS recriado.

## Pedido para enviar a Hostinger

Ola. Recebemos a suspensao por abuso no VPS srv1412857.hstgr.cloud. No painel aparece o processo `./systemd-bench --config=.bench.json --threads=2` consumindo CPU. Precisamos do relatorio tecnico do abuso para corrigir a causa antes de remover as limitacoes.

Por favor, enviem:

- horario exato do abuso em UTC;
- tipo de abuso detectado: mineracao, DDoS, spam, malware, brute force, proxy aberto ou outro;
- IPs/portas de origem e destino;
- amostra de log ou evidencia;
- usuario/processo/caminho identificado, se disponivel;
- se houve trafego de saida anormal;
- se podem liberar modo rescue, console ou SSH temporario para auditoria.

Nao queremos apenas reativar o servidor sem corrigir a origem.

## Auditoria quando o acesso voltar

Script preparado:

```bash
bash tools/vps-abuse-audit.sh
```

O script apenas coleta informacoes e nao remove processos, arquivos, usuarios, containers ou servicos.

Se o acesso for apenas pelo console da Hostinger, colar primeiro este diagnostico curto:

```bash
echo "===== DATE ====="; date
echo "===== UPTIME ====="; uptime
echo "===== TOP ====="; top -bn1 | head -60
echo "===== PS CPU ====="; ps auxww --sort=-%cpu | head -30
echo "===== SUSPEITOS ====="; ps auxww | grep -Ei 'systemd-bench|bench\.json|xmrig|miner|kdevtmpfsi|kinsing|watchdog|masscan|zgrab|cryptonight' | grep -v grep || true
echo "===== CRONTAB ROOT ====="; crontab -l 2>&1
echo "===== SYSTEMD ERROS ====="; journalctl -p err -n 100 --no-pager
```

No Windows, quando SSH voltar, tambem pode rodar pelo projeto:

```powershell
.\tools\vps-abuse-audit-runner.ps1 -HostName 76.13.232.162 -User root
```

Esse runner envia o script para `/tmp`, executa no VPS e baixa o pacote `.tar.gz` com hash `.sha256`.

Script de contencao preparado para depois da auditoria:

```bash
bash tools/vps-abuse-contain.sh --pid=1234 --path=/caminho/systemd-bench
```

Por padrao ele roda em `dry-run` e apenas mostra o que faria. Para aplicar:

```bash
bash tools/vps-abuse-contain.sh --apply --pid=1234 --path=/caminho/systemd-bench
```

Para o caso confirmado de `xmrig-restore` no cron, rodar primeiro:

```bash
bash tools/vps-abuse-contain.sh --pattern='xmrig-restore|xmrig|systemd-bench|bench\.json' --dir=/etc/xmrig-restore
```

Se o dry-run mostrar apenas os alvos suspeitos, aplicar:

```bash
bash tools/vps-abuse-contain.sh --apply --pattern='xmrig-restore|xmrig|systemd-bench|bench\.json' --dir=/etc/xmrig-restore
```

## Procedimento recomendado

1. Nao remover a limitacao semanal no painel enquanto o processo suspeito ainda aparecer.
2. Iniciar o VPS apenas para obter console/SSH, se o painel permitir.
3. Rodar a auditoria e baixar o pacote de evidencias.
4. Identificar PID, caminho real, diretorio de trabalho, usuario e processo pai do `systemd-bench`.
5. Identificar a persistencia que reinicia o processo: cron, systemd, Docker, script em `/tmp`, `/var/tmp`, `/dev/shm`, `/root`, `/home`, `/opt` ou `/var/www`.
6. Parar o processo suspeito.
7. Desabilitar/remover a persistencia confirmada.
8. Rotacionar credenciais.
9. Revisar firewall/SSH/fail2ban.
10. Remover limitacao no painel.
11. Publicar o Mercado do Vale.

## Caminho de emergencia

Usar somente se o site precisar voltar imediatamente e o risco for aceito.

- Antes de clicar em remover limitacao, tentar pelo menos coletar evidencias com o script.
- Se nao houver SSH/console e o painel permitir apenas remover limitacao, entender que isso pode consumir a unica liberacao semanal.
- Depois de remover a limitacao, a primeira acao deve ser abrir SSH/console e matar/remover o `systemd-bench`.
- Nao publicar novas versoes antes de confirmar que o processo suspeito nao voltou.

Mensagem curta para o Kodee:

```text
Preciso de acesso SSH/console temporario para remover a causa antes de clicar em "Remover limitacao". O processo suspeito ainda aparece como ./systemd-bench --config=.bench.json --threads=2 usando CPU alta. Se eu remover a limitacao sem limpar isso, a limitacao pode voltar e eu perco a remocao semanal. Pode liberar console/rescue ou executar comigo os comandos de auditoria?
```

## Rotacao obrigatoria apos contencao

- [ ] Senha root e usuarios SSH.
- [ ] Chaves SSH autorizadas.
- [ ] `SYNC_SECRET`.
- [ ] `JWT_SECRET` e segredos de sessao.
- [ ] Senha do banco.
- [ ] Tokens WhatsApp/Evolution.
- [ ] Token Telegram.
- [ ] Credenciais SMTP/e-mail.
- [ ] Chave OpenAI usada para geracao de JSON.

## Diario

- 2026-06-12: usuario informou suspensao Hostinger por abuso.
- 2026-06-12: print do painel mostrou `systemd-bench` com alto uso de CPU.
- 2026-06-12: publicacao pausada para evitar reativar ambiente possivelmente comprometido.
- 2026-06-12: criado script de auditoria somente leitura para rodar no VPS quando houver acesso.
- 2026-06-12: script reforcado para coletar caminho real, diretorio, processo pai, ambiente e arquivos abertos do processo suspeito.
- 2026-06-12: criado runner PowerShell para enviar a auditoria via SSH e baixar evidencias.
- 2026-06-12: painel Hostinger confirmou que a remocao das limitacoes esta disponivel apenas uma vez por semana; nao remover enquanto `systemd-bench` ainda aparecer consumindo CPU.
- 2026-06-12: transcript do Kodee informou que o limite veio de uso alto e prolongado de CPU, que o VPS foi parado para evitar atividade maliciosa adicional e que nao ha Monarx instalado.
- 2026-06-12: adicionado procedimento recomendado e caminho de emergencia para restauracao controlada.
- 2026-06-12: criado script de contencao em modo dry-run por padrao para usar apos identificar PID/caminho/persistencia.
- 2026-06-12: Kodee orientou iniciar o VPS e coletar `top`, `ps`, `crontab` e `journalctl`; adicionado bloco unico com separadores para console.
- 2026-06-12: Kodee encontrou persistencia `xmrig-restore` no boot e a cada 30 minutos, forte indicio de minerador; roteiro atualizado para remover cron e quarentenar arquivos.
- 2026-06-12: crontab confirmou `/etc/xmrig-restore/restore.sh` em `@reboot` e a cada 30 minutos; contencao atualizada para quarentenar `/etc/xmrig-restore`.
- 2026-06-12: usuario executou limpeza no console. Cron final ficou apenas com tarefas legitimas do app e nenhum processo `xmrig-restore`, `xmrig`, `systemd-bench` ou `.bench.json` apareceu no `ps`. Primeiro comando de `BACKUP_DIR` falhou por caractere especial colado no console; revisar arquivos de backup soltos antes do reboot.
- 2026-06-12: `/etc/xmrig-restore` apareceu como `/etc/xmrig-restore.quarantine-20260612-120845`; processos suspeitos nao apareceram. `top` ainda mostrou alto `st` (steal) e processos `MainThr+`, exigindo checagem de PID/container antes de remover limitacao.
- 2026-06-12: apos reboot, uptime 10 min, crontab continuou sem `xmrig-restore`, pasta suspeita permaneceu em quarentena e nenhum processo `xmrig-restore`, `xmrig`, `systemd-bench` ou `.bench.json` apareceu. `top` ainda mostrou `90.8 st`, coerente com limitacao ativa da Hostinger; pendente identificar `MainThr+`.
- 2026-06-12: `MainThr+` identificado como `node /usr/local/bin/n8n` e `node dist/main`; tambem havia `prisma migrate deploy` da Evolution durante inicializacao. Nenhum indicio novo de minerador na lista de CPU.
- 2026-06-12: apos nova checagem, nenhum processo suspeito apareceu e migracoes Prisma nao estavam mais rodando. CPU ainda com `90.2 st`, indicando limitacao/steal time ativa da Hostinger; `n8n` apareceu no topo sob CPU limitada.
- 2026-06-12: busca no codigo ativo `mercado-do-vale` nao encontrou dependencia real de n8n; referencias encontradas estao em artefatos antigos/worktrees ou neste diario. Pode pausar n8n para aliviar CPU antes de remover limitacao.
- 2026-06-12: n8n pausado; processo ficou zombie sem memoria e `st` caiu de cerca de 90 para 73.5, ainda indicando limitacao ativa da Hostinger.
- 2026-06-12: usuario removeu limitacoes no painel Hostinger. Pendente checar `top` sem `st` alto e confirmar que minerador/n8n nao voltaram.
- 2026-06-12: apos remover limitacao, usuario confirmou `SUSPEITOS` vazio, crontab apenas com rotinas legitimas do app e nginx local respondendo `HTTP/1.1 200 OK`. Trecho de CPU/top ainda nao foi colado.
- 2026-06-12: `top` apos remocao da limitacao mostrou `86.4 id` e `9.1 st`, load caindo para `1.06`; VPS estabilizado para iniciar rotacao de credenciais.
- 2026-06-12: senha root alterada com sucesso. `/root/.ssh/authorized_keys` contem linha malformada com duas chaves coladas e uma chave duplicada; pendente limpar e reemitir chave confiavel.
- 2026-06-12: `/root/.ssh/authorized_keys` limpo, backup criado em `/root/.ssh/authorized_keys.backup-20260612-123647`; acesso por chave root antigo desativado.
- 2026-06-12: SSH com chave nova `mdv-vps-20260612` funcionando a partir da maquina local.
- 2026-06-12: n8n nao esta rodando; servicos Docker `n8n_n8n` e `whatsapp-bot_n8n` estao em `0/1`. CPU normalizada com `90.9 id`, `4.5 st`, load `0.75`.
- 2026-06-12: SSH endurecido com `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin prohibit-password` e `PubkeyAuthentication yes`; nova conexao por chave validada apos reload.
