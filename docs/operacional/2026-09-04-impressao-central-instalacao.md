# Impressão central: instalação e validação

Estado: publicado e ativado no Lenovo em 04/09/2026, versão `v1.2.330-impressao-reenvio` (commit `66cf10a3`). API, migration 018 e agente ativos. Primeiro teste físico confirmou orientação incorreta; correção aplicada e nova etiqueta enviada para conferência.

## Entrega implementada

- Fila MySQL de PDFs privados, acesso administrativo por Bearer, credencial revogável de dispositivo, inventário e heartbeat.
- PDFs até 8 MB e 500 páginas de mesmo formato; dimensões verificadas no conteúdo real, hash e uma única cópia do documento no spooler.
- Tela “Imprimir Etiqueta” envia o PDF do gerador atual com todas as configurações escolhidas. A quantidade já expandida em páginas não é multiplicada no driver.
- Painel na aba Impressoras da Shopee: computadores, credencial exibida uma vez, envio de PDF para qualquer destino permitido, histórico, cancelamento antes da reserva e reimpressão explícita com motivo.
- Agente integrado ao processo existente do Lenovo, com processamento independente por impressora, reserva atômica, diário local durável e confirmação idempotente. Configuração ausente mantém o fluxo antigo; erro ao iniciar a central não derruba a Shopee.
- Auxiliar Windows compilado que valida dimensões pelo driver. Para papel personalizado usa uma fila local `MDV Central <hash>`, sem compartilhamento, preservando os padrões da fila original.
- Expiração de envio já iniciado leva a “Conferir impressão”, nunca a reimpressão automática. PDFs de trabalhos encerrados são removidos após 30 dias; metadados e eventos ficam preservados. PDFs incertos permanecem para conferência.

Limite desta entrega: os botões de comprovantes que hoje geram HTML e chamam a impressão do navegador continuam no fluxo atual. Seus PDFs podem ser enviados pelo painel central. A automação fiscal/impressão direta da Shopee e a fila logística do Mercado Livre também continuam como estão; sua migração para um executor único é uma etapa posterior do plano, com corte e conciliação de marcadores próprios. Nenhum consumidor novo reclama pedidos dessas integrações nesta entrega.

## Preparação da publicação

1. Seguir `publish-vps` e `publicar.md`. O checkout possui alterações preexistentes em VPS, Mercado Livre e Android; publicar apenas o delta revisado desta entrega.
2. Confirmar versão MySQL, InnoDB e `max_allowed_packet` suficiente para o PDF de 8 MB mais metadados. Conferir limites Nginx/proxy para requisição JSON de 12 MB. Inspecionar a ausência/conformidade das três tabelas antes de executar a migração.
3. Fazer backup e aplicar explicitamente `migrations/018_central_printing.sql`. O servidor não executa DDL no startup.
4. Publicar `services/centralPrintingCore.cjs`, `services/centralPrintingServer.cjs` e o ponto de registro da entrada VPS. O módulo usa `pdf-lib`, já presente nas dependências.
5. Definir `MDV_CENTRAL_PRINT_ENABLED=1` na API somente após a migração, pelo procedimento oficial. Sem essa opção as rotas não são montadas. Não habilitar um segundo domínio/instância apontando para outra fila por engano.
6. Publicar o frontend e validar autenticação no caminho real `/api/vps-proxy` e nos endpoints diretos da API. O frontend não envia a chave global como autorização da central.

Escopo de acesso: a instalação atual usa administradores globais da loja, conforme `getVpsBearerAuthContext`. Não há seletor de empresa fornecido pelo navegador nem promessa de isolamento multiempresa nesta entrega. Uma futura versão multiempresa deve resolver a empresa no servidor antes de compartilhar esse módulo entre lojas.

## Preparação do Lenovo

1. Conferir impressoras físicas `P50 Printer` (USB005), `Comprovante` (USB003) e `ZDesigner ZD220-203dpi ZPL` (USB002). Portas são evidência atual, não identificadores fixos para mudanças futuras.
2. Compilar no Windows com `node scripts/build-central-print-helper.cjs`. Isso gera `scripts/central-print-runtime/central-print-paper.exe`. O artefato é gerado e ignorado pelo Git; distribuir junto dos fontes revisados e conferir SHA-256 da cópia. Não é necessário mudar a política PowerShell para executar o auxiliar nativo.
3. Preparar backup e atualizar seletivamente na instalação `C:\ProgramData\MercadoDoVale\printer-service`:
   - `scripts/shopee-auto-print.cjs` com o delta de inicialização da central;
   - `scripts/central-print-agent.cjs`;
   - `scripts/central-print-runtime/central-print-paper.exe`;
   - `services/centralPrintingCore.cjs`.
4. O checkout de agosto do Lenovo difere do checkout principal. Não copiar o script principal mais recente às cegas: ele também contém alterações posteriores do Mercado Livre. Aplicar/revisar o delta da central sobre a versão instalada, ou publicar uma atualização completa separadamente validada.
5. Na aba Impressoras, cadastrar Lenovo com a lista explícita das três impressoras. Guardar a credencial exibida uma vez em local acessível apenas ao usuário do agente/administradores. Não enviar a credencial para logs ou histórico de shell.
6. Configurar no ambiente privado do agente, carregado pelo dotenv existente:
   - `MDV_PRINT_API_URL`: origem HTTPS direta da API, sem caminho;
   - `MDV_PRINT_DEVICE_TOKEN`: credencial gerada no painel, formato ID.segredo.
7. Reiniciar pelo procedimento aprovado e verificar heartbeat, inventário e formatos. As chaves acima habilitam a central; não trocar a chave global usada pela Shopee.
8. O diário fica em `scripts/central-print-journal`. Restringir ACL à conta do serviço e administradores; não sincronizar/publicar essa pasta. Não limpar os arquivos JSON: eles impedem nova tentativa física depois de uma queda. PDFs locais são removidos após confirmação sincronizada.
9. Confirmar que o processo roda na conta Lenovo e herda as preferências de impressão dessa mesma conta. A recuperação existente depende da sessão interativa; testar login, reinício e suspensão. A disponibilidade antes de login ainda não está garantida.

## Papel personalizado

O driver pode não anunciar todos os formatos aceitos. Na P50, o inventário enumera quatro formatos predefinidos e omite flags de papel personalizado; a chamada nativa de validação aceita 30 × 20 e 50 × 30 mm. O agente faz um probe em memória para detectar essa capacidade e valida novamente o tamanho de cada trabalho.

O auxiliar preserva bytes privados do DEVMODE, solicita largura/altura do PDF, orientação, escala 100% e uma cópia. Se o driver ou a releitura Windows alterar as dimensões, o trabalho falha antes de enviar. Não cria um fallback de escala. A fila auxiliar é conferida por driver, porta e comentário de origem antes de ser reutilizada.

Referências de implementação:

- https://learn.microsoft.com/en-us/windows/win32/printdocs/printer-info-9
- https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-devicecapabilitiesw
- https://www.sumatrapdfreader.org/docs/Command-line-arguments

## Validações realizadas nesta implementação

- `node --test tmp-tests/central-printing.test.cjs`: PDF, scripts embutidos, formato, cópias, checksum, falha de rede, diário, autenticação, reserva concorrente e transições.
- Regressões existentes: `shopee-dual-thermal-print-flow-static.test.mjs`, `product-label-print-page-static.test.mjs`, `label-print-copy-stepper-static.test.mjs`.
- Build Vite e verificação de sintaxe dos módulos/entradas alterados.
- A checagem TypeScript global permanece bloqueada por erros de sintaxe preexistentes em `tmp/n8n-active-product-context-20260812.js`; não foi declarada aprovação global de tipos.
- Auxiliar compilado com .NET Framework. Teste local no Nitro criou fila auxiliar com 30 × 20, releu as dimensões e confirmou que as preferências da P50 original não mudaram. A fila de teste foi removida, sem impressão física.
- No Lenovo, probes em memória aceitaram P50 30 × 20 e 50 × 30 e Comprovante 30 × 20. Não foram criadas filas auxiliares nem impressos documentos no Lenovo por estes probes.

Ainda exigem ambiente publicado/teste autorizado: migração real e comportamento SQL em MySQL, dois PCs administradores, PDF físico legível nas três impressoras, falta de papel e reconexão, driver customizado efetivamente utilizado pelo Sumatra, restart durante envio e funcionamento antes/depois do login. Os testes de concorrência locais usam um pool simulado com exclusão mútua e não substituem o teste com MySQL.

## Rollback

Desabilitar novas solicitações antes de parar o agente central; conferir trabalhos reservados/enviados e manter o diário. Retirar as duas variáveis do agente desativa somente a central, preservando a Shopee. Desativar `MDV_CENTRAL_PRINT_ENABLED` pela publicação oficial remove rotas/worker; conservar tabelas e eventos para auditoria. Não reenfileirar automaticamente resultados incertos e não apagar marcadores antigos da Shopee.

## Validação da ativação em produção

- Site: `/var/www/mdv-site/releases/20260904-145500-impressao-central-pdf`; homepage HTTP 200, VERSION correto e painel administrativo renderizado. API `/status` com `mysql.ok=true`; acesso anônimo à administração HTTP 401.
- Lenovo conectado; P50/USB005, Zebra/USB002 e Comprovante/USB003 normais. Credencial exclusiva instalada em `.env.local` com ACL restrita; processo PM2 salvo.
- Etiqueta real do modal, SKU FDH01, 30 × 20 mm, uma página: trabalho `9db4e45d-e2a0-42c4-bad5-5ef566a49fba`, estado `submitted`, uma tentativa, diário sincronizado e fila Windows vazia. Sem confirmação visual da saída física até este registro.
- O primeiro envio foi recusado antes de criar trabalho: jsPDF inclui `/OpenAction` com destino de visualização. Corrigido para permitir somente destinos locais explícitos; ações de impressão e scripts seguem bloqueados. Coberto por teste com jsPDF real. Total: 17 testes aprovados.
- API publicada pelo comando oficial `node deploy-vps-server-only.cjs --central-printing-only`, preservando conteúdo atual das demais rotas. Backups: `/var/www/mdv-api/backups/central-printing-1788533282627` e `central-printing-1788533565594`.
- Lenovo: backup anterior em `.restore-points/central-printing-20260904`; script antigo recebeu somente a inicialização da central. Automação Shopee continuou ativa em 127.0.0.1:8081.
- Lenovo precisa permanecer ligado, sem suspensão, com a sessão Lenovo iniciada. Esta implantação não transforma o processo interativo em serviço anterior ao login.

## Correção após conferência física

O operador confirmou que o primeiro trabalho saiu vertical. A versão 1.2.329 passou a definir `orientation=landscape` quando o PDF é mais largo que alto, impedindo que a orientação portrait do driver controle a rotação do conteúdo no Sumatra 3.4.6. Os bytes e as dimensões do PDF permanecem intactos.

A versão 1.2.330 corrigiu também a serialização das configurações JSON ao reimprimir: mysql2 pode retornar a coluna como objeto. A tentativa anterior retornou ER_INVALID_JSON_TEXT e rollback, sem impressão. Reimpressão explícita `5b748fc7-a91b-491e-8ab0-57b9bfdfac57`, do trabalho original, enviada uma vez após a correção; diário local submitted e fila Windows vazia. Conferência visual da segunda etiqueta pendente neste registro.

Release final: `/var/www/mdv-site/releases/20260904-150500-impressao-reenvio`. API saudável, mysql.ok=true, VERSION público validado, 18 testes aprovados. Core do Lenovo verificado por SHA256 contra fonte local. Backup da última API: `/var/www/mdv-api/backups/central-printing-1788533993018`.
