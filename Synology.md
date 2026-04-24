# Synology NAS — Documentação Operacional e Runbook de Recuperação

Atualizado em `24/04/2026`.

> Observação crítica
>
> Antes de qualquer alteração, verificar memória RAM e swap do NAS.
> Há forte indício de que pressão de memória pode derrubar ou desestabilizar o `cloudflared`.
> Se a RAM estiver muito pressionada ou o swap estiver no limite, tratar isso primeiro ou pelo menos considerar isso como causa provável antes de reiniciar túnel, mexer em DNS ou alterar scripts.

---

## 1. Objetivo deste documento

Este arquivo existe para servir como referência principal do ambiente Synology do Mercado do Vale e como runbook de recuperação caso os vídeos, imagens ou a API DSM parem de responder.

Ele consolida:

- arquitetura atual do NAS + Cloudflare Tunnel;
- estado final correto após o incidente de `24/04/2026`;
- sintomas mais comuns e como interpretar cada um;
- checklist de diagnóstico em ordem;
- procedimento de recuperação;
- causa-raiz confirmada do incidente;
- hipótese operacional importante de pressão de memória;
- pendências e boas práticas para evitar regressão.

Este documento deve ser tratado como fonte mais confiável do que handoffs antigos ou trechos históricos da UI admin que possam estar desatualizados.

---

## 2. Estado final correto do ambiente

### 2.1 Túnel Cloudflare correto

O túnel canônico e saudável do ambiente é:

- nome: `mdv-videos`
- UUID: `7680ed44-a7a9-4700-a37e-2026b3653360`

Mapeamento importante:

- no painel da Cloudflare, o nome operacional visível é `mdv-videos`;
- no NAS, o que aparece nos scripts e no `config.yml` é principalmente o UUID `7680ed44-a7a9-4700-a37e-2026b3653360`;
- nome e UUID referem-se ao mesmo túnel correto.

No painel da Cloudflare, o esperado é ver:

- apenas o túnel `mdv-videos` como referência operacional;
- status `Saudável`.

Túneis antigos conflitantes foram removidos durante a correção do incidente de `24/04/2026`.

### 2.2 Hostnames públicos que devem responder por esse túnel

Atualmente os hostnames relevantes são:

- `dsm-api.xiaomipetrolina.com.br`
- `imagens.xiaomipetrolina.com.br`
- `videos.mercadodovale.com.br`
- `videos.mercadodovale.com`

### 2.3 Snapshot de DNS observado no painel Cloudflare em 24/04/2026

Este bloco registra o conteúdo informado manualmente a partir do painel Cloudflare. Ele serve como fotografia operacional do que estava visível na data e ajuda a comparar futuras divergências.

#### Zona `xiaomipetrolina.com.br`

Registros informados:

- `A api` -> `76.13.232.162` — `Com proxy`
- `A xiaomipetrolina.com.br` -> `216.198.79.1` — `Com proxy`
- `CNAME arquivos` -> `5f9387a6-52f2-4272-bbc4-345962ea73c9.cfargotunnel.com` — exibido como túnel `synology-nas`
- `CNAME dsm-api` -> `7680ed44-a7a9-4700-a37e-2026b3653360.cfargotunnel.com` — exibido como túnel `mdv-videos`
- `CNAME imagens` -> `7680ed44-a7a9-4700-a37e-2026b3653360.cfargotunnel.com` — exibido como túnel `mdv-videos`

Link informado para acesso:

- [DNS xiaomipetrolina.com.br](https://dash.cloudflare.com/8114558994545fcb1dac3536aad408a4/xiaomipetrolina.com.br/dns/records)

#### Zona `mercadodovale.com.br`

Registros informados:

- `A api` -> `76.13.232.162` — `Somente DNS`
- `A mail` -> `31.57.174.13` — `Somente DNS`
- `A mercadodovale.com.br` -> `76.76.21.21` — `Somente DNS`
- `CNAME imagens.xiaomipetrolina.com.br` -> `7680ed44-a7a9-4700-a37e-2026b3653360.cfargotunnel.com` — exibido como túnel `mdv-videos`
- `CNAME mv` -> `70bf796723737047.vercel-dns-017.com` — `Somente DNS`
- `CNAME videos` -> `7680ed44-a7a9-4700-a37e-2026b3653360.cfargotunnel.com` — exibido como túnel `mdv-videos`
- `CNAME www` -> `cname.vercel-dns.com` — `Somente DNS`
- `MX mercadodovale.com.br` -> `mail.mercadodovale.com.br`
- `MX mercadodovale.com.br` -> `_dc-mx.a717ae6ecf69.mercadodovale.com.br`
- `TXT mercadodovale.com.br` -> SPF configurado

#### Leitura técnica desse snapshot

- `dsm-api` e `imagens` na zona `xiaomipetrolina.com.br` estão coerentes com o túnel correto `mdv-videos` / UUID `7680ed44-a7a9-4700-a37e-2026b3653360`.
- `videos` na zona `mercadodovale.com.br` também está coerente com o túnel correto `mdv-videos`.
- a entrada `arquivos` em `xiaomipetrolina.com.br` ainda apareceu apontando para o UUID antigo `5f9387a6-52f2-4272-bbc4-345962ea73c9`, associado ao túnel `synology-nas`.
- essa entrada `arquivos` deve ser tratada como legado até revisão explícita. Ela não deve ser usada como referência para validar o estado correto do ambiente de vídeos/DSM.

### 2.4 Interpretação operacional do DNS

Para fins de recuperação do incidente Synology, os hostnames mais importantes são:

- `dsm-api.xiaomipetrolina.com.br`
- `imagens.xiaomipetrolina.com.br`
- `videos.mercadodovale.com.br`

Se esses três estiverem coerentes com o UUID `7680ed44-a7a9-4700-a37e-2026b3653360`, o mapa principal do túnel `mdv-videos` está consistente.

### 2.5 Processo `cloudflared` correto no NAS

O processo correto é o baseado em `config.yml`, usando o binário:

```sh
/usr/local/bin/cloudflared tunnel --config /volume1/.cloudflared/config.yml run
```

Se houver outro processo `cloudflared` rodando ao mesmo tempo, especialmente via `--token`, isso deve ser tratado como alerta.

### 2.6 Tarefas do DSM observadas e desejadas

Estado operacional desejado:

- `synology-command-poller` — ativa
- `watchdog-cloudflared` — ativa
- `Reboot NAS Semanal` — ativa
- `update-tunnel-config` — ativa
- `diagnostico-synology` — opcional

Tarefa legada que pode ainda existir em alguns ambientes, mas não faz parte do estado desejado:

- `instalar-cloudflared` — manter desativada ou remover

### 2.7 Definições exatas observadas no DSM em 24/04/2026

#### `synology-command-poller`

- usuário: `root`
- programação: `Diariamente`
- hora: `00:00`
- repetir: a cada `1` minuto
- última hora de execução observada: `23:59`
- script:

```sh
sh /volume1/scripts/synology-command-poller.sh
```

#### `watchdog-cloudflared`

- usuário: `root`
- programação: `Diariamente`
- hora: `00:00`
- repetir: a cada `5` minutos
- última hora de execução observada: `23:55`
- função operacional esperada:
  - manter no ar o túnel `mdv-videos`;
  - na prática ele sobe o `cloudflared` usando o `config.yml` do UUID `7680ed44-a7a9-4700-a37e-2026b3653360`
- script:

```sh
sh /volume1/scripts/watchdog-cloudflared.sh
```

#### `instalar-cloudflared` — legado perigoso

- usuário: `root`
- evento: `Reinicialização`
- pré-tarefa: em branco
- observação:
  - esta tarefa foi encontrada no DSM;
  - ela sobe `cloudflared` por `--token`;
  - esse caminho foi a origem do túnel errado no incidente de `24/04/2026`;
  - ela não é o caminho correto para manter o túnel `mdv-videos`;
  - se ainda existir, deve permanecer desativada ou ser removida.

Script observado, com token propositalmente redigido neste documento:

```sh
#!/bin/sh
pkill -x cloudflared 2>/dev/null
sleep 2
mkdir -p /volume1/.cloudflared
if [ ! -f /volume1/.cloudflared/cloudflared ]; then
  wget -q -O /volume1/.cloudflared/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x /volume1/.cloudflared/cloudflared
fi
nohup /volume1/.cloudflared/cloudflared tunnel run --protocol http2 --token <TOKEN_ANTIGO_REDIGIDO> >> /volume1/.cloudflared/tunnel.log 2>&1 &
echo "Started $(date)"
sleep 8
ps aux | grep cloudflared | grep -v grep
echo Done
```

#### `update-tunnel-config`

- usuário: `root`
- evento: `Reinicialização`
- pré-tarefa: em branco
- observação:
  - esta tarefa deve continuar ativa;
  - ela reescreve o `config.yml` do túnel `mdv-videos`;
  - o UUID gravado nela deve ser `7680ed44-a7a9-4700-a37e-2026b3653360`;
  - o conteúdo abaixo foi o observado no DSM;
  - a duplicação de `#!/bin/sh` é desnecessária, mas não muda a intenção operacional.

Script observado:

```sh
#!/bin/sh
#!/bin/sh
cat > /volume1/.cloudflared/config.yml << 'ENDOFFILE'
tunnel: 7680ed44-a7a9-4700-a37e-2026b3653360
credentials-file: /volume1/.cloudflared/7680ed44-a7a9-4700-a37e-2026b3653360.json
ingress:
  - hostname: dsm-api.xiaomipetrolina.com.br
    service: https://localhost:5001
    originRequest:
      noTLSVerify: true
  - hostname: imagens.xiaomipetrolina.com.br
    service: http://localhost:80
  - hostname: videos.mercadodovale.com.br
    service: http://localhost:80
  - hostname: videos.mercadodovale.com
    service: http://localhost:80
  - service: http_status:404
ENDOFFILE

cp /volume1/.cloudflared/config.yml /volume1/web/config_dump.txt
```

### 2.8 Frequência operacional esperada

- `synology-command-poller`
  - usuário: `root`
  - repetição: a cada `1` minuto
- `watchdog-cloudflared`
  - usuário: `root`
  - repetição: a cada `5` minutos
- `Reboot NAS Semanal`
  - usuário: `root`
  - semanal, domingo `04:00`
- `update-tunnel-config`
  - usuário: `root`
  - evento: `Reinicialização`

---

## 3. Arquitetura atual

### 3.1 Fluxo lógico

1. O usuário ou a aplicação acessa um hostname público.
2. A Cloudflare encaminha o tráfego ao túnel `mdv-videos`.
3. O `cloudflared` rodando no NAS recebe esse tráfego.
4. O `config.yml` decide para qual serviço local mandar:
   - `http://localhost:80` para conteúdo web de imagens e vídeos;
   - `https://localhost:5001` para o DSM via `dsm-api`, com `noTLSVerify: true`.
5. O `synology-command-poller` envia heartbeat para a VPS e consome comandos remotos.
6. O `watchdog-cloudflared` garante que o `cloudflared` suba novamente se o processo cair.

### 3.2 Componentes principais

#### No NAS

- binário principal do túnel: `/usr/local/bin/cloudflared`
- config do túnel: `/volume1/.cloudflared/config.yml`
- credentials do túnel: `/volume1/.cloudflared/7680ed44-a7a9-4700-a37e-2026b3653360.json`
- log do túnel: `/volume1/.cloudflared/tunnel.log`
- script watchdog: `/volume1/scripts/watchdog-cloudflared.sh`
- script poller: `/volume1/scripts/synology-command-poller.sh`
- PID file: `/var/run/cloudflared.pid`

#### Na Cloudflare

- túnel em uso: `mdv-videos`
- hostnames públicos apontando para o túnel

#### Na VPS / backend

- endpoint de status do NAS
- fila de comandos para `restart-cloudflared` e `reboot-nas`
- endpoints que dependem do Synology para listar arquivos

### 3.3 `config.yml` canônico

O `config.yml` esperado é este:

```yaml
tunnel: 7680ed44-a7a9-4700-a37e-2026b3653360
credentials-file: /volume1/.cloudflared/7680ed44-a7a9-4700-a37e-2026b3653360.json
ingress:
  - hostname: dsm-api.xiaomipetrolina.com.br
    service: https://localhost:5001
    originRequest:
      noTLSVerify: true
  - hostname: imagens.xiaomipetrolina.com.br
    service: http://localhost:80
  - hostname: videos.mercadodovale.com.br
    service: http://localhost:80
  - hostname: videos.mercadodovale.com
    service: http://localhost:80
  - service: http_status:404
```

Se o conteúdo atual do NAS divergir disso, corrigir antes de reativar qualquer rotina automática.

---

## 4. Sinais e como interpretar

### 4.1 `Error 1033` da Cloudflare

Interpretação:

- a Cloudflare conhece o túnel, mas não encontra conector ativo para servir tráfego;
- normalmente aponta para `cloudflared` ausente, travado, mal configurado ou subido pelo túnel errado.

### 4.2 `403` na raiz de `https://videos.mercadodovale.com.br/`

Isso pode ser normal.

Importante:

- a raiz do hostname pode retornar uma página 403 do Synology;
- isso, sozinho, não significa falha;
- o teste correto é abrir um arquivo real, por exemplo `.../SKU.mp4`.

### 4.3 `dsm-api` retornando JSON com `"success": true`

Isso é sinal forte de saúde do túnel DSM.

Exemplo de teste válido:

```sh
https://dsm-api.xiaomipetrolina.com.br/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=SYNO.API.Auth,SYNO.FileStation.List
```

Se responder com JSON e `success: true`, o caminho Cloudflare -> túnel -> DSM está funcional.

### 4.4 QuickConnect abre, mas o túnel público não

Interpretação:

- o NAS está ligado;
- o DSM está acessível;
- a falha está mais provavelmente em `cloudflared`, `config.yml`, conflito de processos, ou pressão de recursos.

### 4.5 Admin mostra 0 arquivos, mas o File Station tem arquivos

Interpretação mais provável:

- túnel caiu;
- DSM API não está respondendo por hostname público;
- backend não consegue listar arquivos;
- ou o `cloudflared` foi reiniciado pelo método errado.

---

## 5. Primeira regra operacional: verificar RAM e swap antes de qualquer alteração

### 5.1 Por que isso é importante

No incidente de `24/04/2026`, um snapshot remoto mostrou:

- cerca de `11%` de RAM disponível;
- `swap` em `100%`.

Isso não prova sozinho a causa-raiz, mas é um indicativo forte de ambiente sob pressão. Em cenários assim, processos auxiliares como `cloudflared`, watchdogs e tarefas agendadas podem ficar instáveis, ser mortos, demorar para responder ou falhar de maneira intermitente.

### 5.2 Como checar no DSM

Pelo QuickConnect / DSM:

1. Abrir `Monitoramento de recursos`.
2. Ir na aba `Memória`.
3. Ver:
   - uso total de RAM;
   - memória livre;
   - swap, se exibido;
   - processos com maior consumo.

### 5.3 Como checar via shell

Se houver terminal/SSH:

```sh
grep -E 'MemTotal|MemAvailable|MemFree|SwapTotal|SwapFree|Buffers|Cached|SReclaimable' /proc/meminfo
```

Se a memória estiver muito apertada ou o swap estiver quase todo consumido:

- registrar isso como fator relevante;
- evitar concluir rápido demais que “o problema é só o túnel”;
- considerar reinicialização controlada do NAS se o sistema estiver claramente degradado.

### 5.4 Regra prática

Antes de:

- reiniciar túnel;
- mudar DNS;
- alterar `config.yml`;
- reativar tarefa;
- concluir que “o túnel caiu sozinho”;

fazer primeiro a checagem de RAM e swap.

---

## 6. Runbook de diagnóstico em ordem

Executar em ordem. Não pular etapas.

### 6.1 Passo 1 — Confirmar se o NAS está vivo

Verificações possíveis:

- abrir QuickConnect / DSM remoto;
- abrir File Station;
- verificar se o Monitoramento de Recursos responde.

Se QuickConnect abre:

- o NAS não está morto;
- o foco deve ir para túnel, scripts e recursos.

### 6.2 Passo 2 — Checar memória RAM e swap

Isso deve ser feito antes de qualquer restart.

Se a memória estiver muito pressionada:

- registrar o estado;
- tratar isso como suspeita forte;
- só então seguir para as camadas seguintes.

### 6.3 Passo 3 — Testar os endpoints públicos

#### Teste da API DSM

```sh
https://dsm-api.xiaomipetrolina.com.br/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=SYNO.API.Auth,SYNO.FileStation.List
```

Esperado:

- JSON com `"success": true`

#### Teste de vídeo real

```sh
https://videos.mercadodovale.com.br/SEU_ARQUIVO_REAL.mp4
```

Esperado:

- vídeo abrir ou baixar normalmente

### 6.4 Passo 4 — Rodar o diagnóstico automatizado

Na pasta `mercado-do-vale`:

```sh
node diagnose-synology.cjs
```

Ou, a partir da raiz do workspace:

```sh
node mercado-do-vale/diagnose-synology.cjs
```

Arquivo principal:

- `mercado-do-vale/diagnose-synology.cjs`

Esse script testa em sequência:

1. CDN público de vídeos
2. DSM API via túnel
3. login DSM
4. listagem de arquivos pela VPS

### 6.5 Passo 5 — Conferir o túnel na Cloudflare

No painel:

- abrir `Cloudflare Tunnels`
- confirmar que `mdv-videos` está `Saudável`
- confirmar que túneis antigos não voltaram

Se existir outro túnel paralelo, investigar imediatamente.

#### Checklist de 30 segundos no painel Cloudflare

Se estiver no meio de um incidente e precisar de uma checagem rápida:

1. abrir `Cloudflare Zero Trust` ou `Cloudflare One`
2. entrar em `Networks`
3. entrar em `Connectors` ou `Cloudflare Tunnels`
4. localizar o túnel `mdv-videos`
5. validar os seguintes pontos

O que deve aparecer:

- nome do túnel: `mdv-videos`
- status: `Saudável`
- tempo de atividade recente
- ausência de outro túnel Synology paralelo `Inoperante` ou `Inativo`

Sinais de alerta imediatos:

- `mdv-videos` com status diferente de `Saudável`
- reaparecimento de túnel antigo ligado ao UUID `5f9387a6-52f2-4272-bbc4-345962ea73c9`
- mais de um túnel parecendo “dono” dos mesmos hostnames

Se essa checagem falhar, não concluir ainda que o problema é só Cloudflare.
Voltar um passo e verificar RAM/swap do NAS, depois confirmar se o `cloudflared` correto ainda está rodando no DSM.

### 6.6 Passo 6 — Conferir o Task Scheduler no DSM

Verificar:

- `synology-command-poller` ativa
- `watchdog-cloudflared` ativa
- `update-tunnel-config` ativa
- `Reboot NAS Semanal` ativa

Confirmar também:

- usuário `root`
- horários esperados
- resultado recente de execução

### 6.7 Passo 7 — Verificar processos `cloudflared`

O objetivo é garantir que exista apenas o processo correto.

Exemplo de verificação:

```sh
ps aux | grep cloudflared | grep -v grep
```

Esperado:

- apenas uma linha relevante;
- baseada em `/usr/local/bin/cloudflared tunnel --config /volume1/.cloudflared/config.yml run`

Se aparecer processo via `--token`, isso é sinal de regressão.

---

## 7. Procedimento de recuperação recomendado

### 7.1 Se a configuração parece íntegra e o NAS está saudável

Ordem recomendada:

1. verificar RAM e swap;
2. executar manualmente `update-tunnel-config`;
3. executar manualmente `watchdog-cloudflared`;
4. testar `dsm-api`;
5. testar um vídeo real.

### 7.2 O que executar manualmente no DSM

No `Agendador de Tarefas`:

1. `update-tunnel-config`
2. `watchdog-cloudflared`

Depois:

- validar `Normal (0)` no resultado;
- testar os endpoints.

### 7.3 O que não fazer

Não reintroduzir:

- `instalar-cloudflared`;
- execução de `cloudflared` via `--token`;
- segundo túnel paralelo;
- scripts antigos que façam download de `latest` no boot e subam outro UUID de túnel.

### 7.4 Se reaparecerem dois `cloudflared` ao mesmo tempo

Isso deve ser tratado como regressão do incidente de `24/04/2026`.

O cenário perigoso é encontrar algo como:

- `/volume1/.cloudflared/cloudflared tunnel run --protocol http2 --token ...`
- `/usr/local/bin/cloudflared tunnel --config /volume1/.cloudflared/config.yml run`

Nesse caso:

1. confirmar qual linha contém `--token`;
2. tratar essa instância como processo errado;
3. manter como desejado apenas a instância via `config.yml`;
4. revisar imediatamente se alguém reintroduziu `instalar-cloudflared` ou startup antigo;
5. validar depois com `dsm-api` e um vídeo real.

Se for necessário matar a instância errada manualmente, matar apenas o PID da linha que contém `--token`, nunca a instância baseada em `config.yml`.

### 7.5 Quando considerar reboot do NAS

Se houver sinais como:

- DSM respondendo mal;
- memória muito pressionada;
- swap lotado;
- tarefas aparentemente corretas, mas processo continua morrendo;
- comportamento inconsistente mesmo após `update-tunnel-config` + `watchdog`;

então o reboot controlado do NAS passa a ser opção razoável.

Observação:

- no incidente de `24/04/2026`, o reboot físico trouxe o ambiente de volta;
- isso sugere travamento/intermitência sistêmica, não apenas erro estático de configuração.

---

## 8. Scripts importantes e função de cada um

### 8.1 `synology-command-poller.sh`

Arquivo local no repo:

- `synology-command-poller.sh`

Função:

- coleta heartbeat do NAS;
- envia status para a VPS;
- consome comandos remotos;
- chama o watchdog quando recebe `restart-cloudflared`;
- coleta memória e swap do NAS.

Pontos importantes:

- fala com `https://api.xiaomipetrolina.com.br`;
- usa `POLL_KEY`;
- lê `/proc/meminfo`;
- envia snapshot de memória;
- faz `ack` de comandos.

### 8.2 `watchdog-cloudflared.sh`

Arquivo local no repo:

- `watchdog-cloudflared.sh`

Função:

- verificar se o `cloudflared` já está rodando;
- se não estiver, iniciar usando o `config.yml` canônico;
- gravar PID file;
- escrever log de watchdog.

Pontos importantes:

- usa `/usr/local/bin/cloudflared`;
- usa `/volume1/.cloudflared/config.yml`;
- não deve subir túnel via token.

### 8.3 `update-tunnel-config`

Função:

- reescrever o `config.yml` correto no boot;
- evitar drift entre o que o NAS carrega e o que o ambiente espera.

Conteúdo canônico esperado da tarefa:

```sh
#!/bin/sh
cat > /volume1/.cloudflared/config.yml << 'ENDOFFILE'
tunnel: 7680ed44-a7a9-4700-a37e-2026b3653360
credentials-file: /volume1/.cloudflared/7680ed44-a7a9-4700-a37e-2026b3653360.json
ingress:
  - hostname: dsm-api.xiaomipetrolina.com.br
    service: https://localhost:5001
    originRequest:
      noTLSVerify: true
  - hostname: imagens.xiaomipetrolina.com.br
    service: http://localhost:80
  - hostname: videos.mercadodovale.com.br
    service: http://localhost:80
  - hostname: videos.mercadodovale.com
    service: http://localhost:80
  - service: http_status:404
ENDOFFILE

cp /volume1/.cloudflared/config.yml /volume1/web/config_dump.txt
```

### 8.4 `diagnose-synology.cjs`

Arquivo:

- `mercado-do-vale/diagnose-synology.cjs`

Função:

- testar as quatro camadas principais da integração;
- servir como verificação rápida pós-incidente.

---

## 9. Incidente de 24/04/2026 — causa-raiz detalhada

### 9.1 Sintoma observado

O ambiente apresentava comportamento intermitente:

- Cloudflare retornando `1033`;
- admin mostrando `0` arquivos;
- sensação de que o túnel “caía sozinho”;
- reboot do NAS trazia o serviço de volta temporariamente.

### 9.2 O que foi descoberto

Havia dois caminhos diferentes para subir `cloudflared` no NAS:

1. um caminho via `instalar-cloudflared`, usando `--token`;
2. outro caminho via `watchdog-cloudflared`, usando `config.yml`.

Isso já seria ruim por si só, mas havia algo pior:

- esses dois caminhos apontavam para túneis diferentes.

### 9.3 Os dois túneis conflitantes

#### Túnel antigo e incorreto para o cenário atual

- UUID: `5f9387a6-52f2-4272-bbc4-345962ea73c9`
- subido via `--token`
- associado ao fluxo antigo `instalar-cloudflared`

#### Túnel correto

- UUID: `7680ed44-a7a9-4700-a37e-2026b3653360`
- usado pelo `config.yml`
- correspondente aos hostnames públicos em uso

### 9.4 Como a divergência se manifestava

Em determinados momentos havia dois processos `cloudflared` rodando:

- `/volume1/.cloudflared/cloudflared tunnel run --protocol http2 --token ...`
- `/usr/local/bin/cloudflared tunnel --config /volume1/.cloudflared/config.yml run`

Isso criava um cenário de split-brain operacional:

- um boot subia o túnel errado;
- o watchdog tentava manter o túnel correto;
- DNS e hostnames apontavam para um túnel;
- parte dos scripts subia outro.

### 9.5 Validação definitiva da causa

Durante o diagnóstico:

- `dsm-api.xiaomipetrolina.com.br` e `videos.mercadodovale.com.br` apontavam no DNS para o túnel `7680...`;
- quando só o processo via token `5f93...` ficou de pé, o `dsm-api` caiu em `1033`;
- quando o watchdog recolocou o processo via `config.yml` do túnel `7680...`, o `dsm-api` voltou com `success: true`.

Isso confirmou que o túnel de token não era o túnel certo para os hostnames operacionais.

### 9.6 Correção aplicada

Foram executadas as seguintes ações:

- desativação do fluxo antigo baseado em token;
- eliminação do processo `cloudflared` errado;
- atualização do `config.yml` com os hostnames reais;
- validação manual via `update-tunnel-config` + `watchdog-cloudflared`;
- limpeza de túneis antigos no painel Cloudflare;
- consolidação em um único túnel: `mdv-videos`.

### 9.7 Conclusão da causa-raiz

Causa-raiz confirmada:

- conflito entre dois métodos de inicialização de `cloudflared`, apontando para dois túneis diferentes.

Fator contribuinte provável:

- pressão de memória / swap no NAS.

---

## 10. Estado do incidente após a correção

Após a limpeza e alinhamento:

- `dsm-api` voltou a responder com JSON `success: true`;
- vídeo real em `videos.mercadodovale.com.br` voltou a abrir;
- apenas o túnel `mdv-videos` permaneceu no painel Cloudflare;
- as tarefas relevantes do DSM ficaram coerentes entre si;
- o caminho via token deixou de ser parte do estado desejado.

---

## 11. Checklist rápido de recuperação futura

Se o problema reaparecer, usar esta ordem:

1. verificar se o NAS está vivo via QuickConnect;
2. verificar RAM e swap;
3. testar `dsm-api`;
4. testar um vídeo real;
5. confirmar `mdv-videos` saudável na Cloudflare;
6. conferir se só existe um `cloudflared` correto rodando;
7. executar `update-tunnel-config`;
8. executar `watchdog-cloudflared`;
9. retestar;
10. se o sistema estiver degradado e a memória ruim, considerar reboot controlado.

---

## 12. Anti-regressão — coisas que não devem voltar

Não voltar a usar:

- túnel paralelo antigo;
- inicialização por token do túnel antigo;
- tarefa `instalar-cloudflared`;
- dois processos `cloudflared` simultâneos;
- `config.yml` sem `dsm-api.xiaomipetrolina.com.br`;
- `config.yml` sem `videos.mercadodovale.com.br`.

Se qualquer um desses elementos reaparecer, tratar como regressão.

---

## 13. Pendências e observações de hardening

### 13.1 Pressão de memória ainda precisa de observação contínua

Mesmo com a causa-raiz confirmada do conflito entre túneis, a hipótese de memória continua relevante.

Recomendação:

- sempre registrar o estado de RAM e swap quando houver incidente;
- comparar se há correlação entre quedas e consumo anormal;
- observar se `cloudflared` cai mais quando o NAS está muito carregado.

### 13.2 Observabilidade do status do NAS

Existe um detalhe importante no backend:

- o serviço de status do Synology re-normaliza snapshots e pode gerar `last_report_at` enganoso;
- por isso, ao investigar incidentes, não confiar apenas na leitura superficial desse timestamp.

### 13.3 Documentação histórica na UI admin

Há trechos históricos em:

- `mercado-do-vale/pages/admin/settings/SynologyConfigPage.tsx`

que servem como referência, mas não devem ser tomados automaticamente como estado atual, porque parte deles foi escrita antes da consolidação final do túnel.

### 13.4 Segurança

O token do túnel antigo deixou de ser relevante operacionalmente porque o túnel antigo foi removido.

Ainda assim, manter a disciplina:

- não publicar tokens em scripts;
- não manter startup alternativo via `--token`;
- preferir o fluxo único via `config.yml` + credentials file.

---

## 14. Referências úteis no repositório

- `synology-command-poller.sh`
- `watchdog-cloudflared.sh`
- `HANDOFF-synology-cloudflared-2026-04-24.md`
- `synology-tunnel-fix-2026-04-24.md`
- `mercado-do-vale/docs/operacional/2026-04-24-synology-nas-checklist.md`
- `mercado-do-vale/diagnose-synology.cjs`

---

## 15. Resumo executivo

O ambiente Synology caiu de forma intermitente porque havia duas rotas de subida do `cloudflared`, ligadas a dois túneis diferentes. O túnel correto hoje é `mdv-videos` (`7680ed44-a7a9-4700-a37e-2026b3653360`), iniciado via `config.yml`. O fluxo antigo por token deve permanecer fora de operação.

Ao mesmo tempo, existe evidência forte de que memória pressionada pode agravar ou disparar a instabilidade. Por isso, a primeira checagem operacional futura deve ser sempre RAM e swap, antes de qualquer alteração em scripts, tarefas ou Cloudflare.
