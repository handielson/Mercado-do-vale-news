# Plano de impressão central no Lenovo

Data: 04/09/2026. Estado atualizado: fila de PDFs/etiquetas publicada e ativada no Lenovo; teste de envio ao Windows aprovado, conferência visual e etapas posteriores pendentes. Ver `2026-09-04-impressao-central-instalacao.md` para escopo implementado e instalação. As anotações abaixo preservam o histórico do levantamento.

## Resultado esperado

Qualquer PC com sessão de administrador do Mercado do Vale poderá solicitar impressão na Comprovante, Zebra ou P50 conectadas ao Lenovo, pela internet. O painel terá destinos, formatos, disponibilidade, fila e histórico. Não dependerá de instalar drivers nos PCs solicitantes.

## Evidências verificadas

| Equipamento | Computador atual | Nome no Windows | Driver | Porta |
| --- | --- | --- | --- | --- |
| Zebra ZD220 | Lenovo | ZDesigner ZD220-203dpi ZPL | ZDesigner ZD220-203dpi ZPL | USB002 |
| Comprovante | Lenovo | Comprovante | LABEL | USB003 |
| P50 | Nitro | P50 Printer | P50 Printer | USB002 |

As portas USB são locais a cada computador e não devem virar identificadores globais. A P50 não foi encontrada entre as impressoras instaladas no Lenovo. O Nitro também apresenta o dispositivo Bluetooth P50S-B672-BLE; isto não comprova impressão Bluetooth pelo driver Windows. O tamanho de papel da P50 não foi informado por Get-PrintConfiguration: medir/confirmar o rolo antes do teste físico.

O Lenovo também possui uma Epson L3150 de rede, fora dos três destinos solicitados inicialmente.

O serviço ativo do Lenovo está em `C:\ProgramData\MercadoDoVale\printer-service`, versão declarada v1.2.228 de 11/08. O checkout principal está mais adiantado. Não substituir a instalação inteira por uma cópia do checkout: comparar arquivos necessários e preservar configuração, documentos e marcadores existentes.

O serviço foi recuperado nesta tarefa e processou quatro pedidos da Shopee, com etiqueta e resumo registrados e fila Windows vazia. A tarefa Windows tem verificação a cada cinco minutos, repetição em falha e execução permitida na bateria. Sua identidade continua interativa: operação antes do login do Windows ainda precisa ser validada.

## Fontes existentes e reutilização

| Responsabilidade | Fonte atual | Aproveitamento |
| --- | --- | --- |
| Agente Windows/Shopee | scripts/shopee-auto-print.cjs | Evoluir o agente instalado, mantendo a impressão automática funcionando durante a transição |
| Resumos térmicos | scripts/shopee-separation-summary.cjs | Reutilizar PDF, escala e margens já calibradas no Lenovo |
| Configuração de impressoras | pages/admin/settings/components/ShopeePrintersTab.tsx | Reutilizar configurações; promover seleção central comum aos documentos |
| Etiquetas de produtos | components/products/LabelPrintModal.tsx | Reutilizar PDF e medidas; acrescentar envio central ao fluxo existente |
| Templates de etiquetas | services/labelPrintTemplatesService.ts e /admin/label-templates | Continuar como fonte de layout; não duplicar templates |
| Comprovantes de venda | utils/printSaleReceipt.ts e demais utils/print*.ts | Preservar conteúdo e converter a renderização HTML existente em PDF para o destino central |
| Sessão administrativa | services/authSession.ts e services/vpsAuthService.ts | Reutilizar Bearer da sessão |
| Autorização na API | requireAdminBearerToken e getVpsBearerAuthContext em vps_server.cjs | Verificar administrador no servidor e registrar identidade resolvida pelo token |
| Fila Mercado Livre | services/mercadoLivreServer.cjs, mercado_livre_print_jobs | Integrar por adaptador; manter a tabela como estado logístico, com um único executor de impressão |

O painel Shopee hoje usa `http://127.0.0.1:8081`, que aponta para o PC do navegador. Este endereço não serve como transporte central. A fila do Mercado Livre é específica de remessas e não cobre PDFs avulsos, impressoras ou dispositivos; a fila geral será a autoridade de execução física. O código existente de SELECT seguido de UPDATE não deve ser copiado como reserva concorrente de trabalhos.

## Arquitetura proposta

PC admin → API autenticada → fila MySQL + PDF privado → agente Lenovo → spooler Windows → impressora.

- O agente faz conexões de saída HTTPS à VPS. Não expor porta Windows, compartilhamento público ou acesso anônimo.
- Credencial exclusiva do dispositivo, revogável e armazenada com acesso restrito; na API, guardar hash. Não usar a chave global de sincronização como credencial da nova fila.
- Administrador enfileira, consulta e pede reimpressão. Dispositivo consulta somente seus trabalhos e documentos e informa resultados; não ganha permissão de administrador.
- Identificar empresa, dispositivo e impressora explicitamente, conforme o contexto autenticado. Nomes e IDs enviados pelo navegador não concedem autorização.
- Novos trabalhos aceitam PDFs validados, tamanho/quantidade limitados e formato compatível; não aceitar comando de shell, caminho local ou URL arbitrária para execução/download pelo agente.
- PDFs privados com hash, prazo de retenção e download autenticado. Registrar versão do documento e preservar o conteúdo impresso, sem renderizar novamente com dados comerciais que possam ter mudado.

## Modelo e contratos a implementar

Propor migração explícita após inspeção do schema: dispositivos de impressão, destinos e perfis de papel, trabalhos e eventos. Não criar tabelas automaticamente ao iniciar o servidor.

Trabalho: ID, empresa, origem/tipo e ID do documento, administrador solicitante, dispositivo/destino, papel/orientação/escala, cópias, referência privada do PDF, hash, chave de idempotência, estado, tentativas, reserva, horários e erro sanitizado. Reimpressão cria novo trabalho ligado ao anterior e registra motivo.

Contratos previstos, sujeitos à conferência final de rotas antes de implementar:

- Administração: listar destinos/status; criar e consultar trabalho; listar histórico; cancelar trabalho ainda não enviado; reimprimir explicitamente; cadastrar/revogar dispositivo e definir perfis.
- Dispositivo: heartbeat com inventário e capacidades; reservar trabalho por POST; baixar PDF autorizado; reportar recebimento, envio ao spooler, falha e estado observado.
- Reserva atômica por transação ou atualização condicional compatível com a versão real do MySQL. Impedir que dois consumidores recebam o mesmo trabalho.

## Estados e recuperação

Estados mínimos: aguardando, reservado, enviando, enviado ao spooler, falhou, confirmação necessária e cancelado.

1. Antes de envio físico, persistir no Lenovo um diário pelo ID do trabalho e hash do PDF.
2. Falha comprovadamente anterior ao envio permite retry limitado com atraso progressivo.
3. Se houver queda após começar o envio e antes do retorno, marcar confirmação necessária. Não reenviar automaticamente por vencimento da reserva.
4. Repetição da confirmação da API deve ser idempotente. Diário local permite reenviar o resultado sem imprimir novamente.
5. Não prometer impressão física confirmada apenas porque pdf-to-printer retornou ou a fila ficou vazia. Mostrar “enviado à impressora” quando esta for a evidência disponível.
6. Serializar por impressora; permitir progresso independente nos outros destinos. Falha na P50 não bloqueia a Zebra.
7. Cancelamento após envio não garante interrupção física; o painel deve refletir isso.

Heartbeat sugerido a cada 15 segundos e estado offline após 60 segundos, ajustáveis após teste. Separar Lenovo disponível, driver instalado e estado reportado pela impressora; usar “desconhecido” se o driver não fornecer telemetria confiável.

## Perfis e interface

- Zebra: etiquetas de envio 100 × 150 mm; manter configuração atual até validação de escala.
- Comprovante: recibos/resumos; reutilizar largura e margens já aprovadas, com altura variável quando compatível.
- P50: etiquetas de produto/preço nas medidas selecionadas no sistema; usar o gerador existente e imprimir em escala real, sem redimensionamento automático.
- Um seletor comum apresenta destino padrão por tipo, papel, cópias, prévia e disponibilidade. Não exigir que o administrador conheça USB002 ou o protocolo da impressora.
- Fila comum mostra solicitante, documento, destino, horários e resultado. Interface acessível apenas ao administrador, com autorização também na API.

## Entregas em ordem

1. **Preparação física:** conectar a P50 ao Lenovo, instalar o driver correspondente já identificado no Nitro, confirmar papel e realizar teste autorizado de alinhamento e leitura de código de barras. Não transferir configuração/segredos do Nitro em bloco.
2. **Núcleo local e API:** preparar migração revisável, fila, autorização, idempotência, reserva, armazenamento de PDF e contratos testados com spooler simulado. Não aplicar migração em produção nesta etapa.
3. **Agente Lenovo:** acrescentar consumo central, diário, inventário e heartbeat ao serviço existente. Empacotar apenas dependências necessárias e manter rollback. Validar recuperação após reinício e comportamento antes/depois do login Windows; não depender apenas de uma tarefa iniciada por SSH.
4. **Impressão manual:** conectar PDFs de etiquetas e resumos; depois adaptar comprovantes HTML preservando layout, valores e regras existentes. Usar uma fonte de renderização por documento, sem manter duas versões divergentes do comprovante.
5. **Automação Shopee e Mercado Livre:** criar trabalhos na fila geral e desativar o envio direto correspondente somente no corte controlado. Importar/consultar marcadores de impressão existentes e estados por etapa para não reimprimir pedidos antigos. Nunca executar os dois consumidores para o mesmo documento.
6. **Publicação gradual:** com autorização de publicação, seguir publish-vps e publicar.md, aplicar migração aditiva, atualizar agente e habilitar destinos progressivamente. Manter impressão atual operacional até aprovação dos testes do novo caminho.

## Critérios de aceite

- Dois PCs distintos, incluindo um fora da rede local, enviam com sessão admin e recebem acompanhamento do mesmo trabalho.
- Sessão ausente, expirada ou não administrativa não imprime nem acessa documentos privados; credencial de dispositivo não acessa funções administrativas.
- Mesmo pedido repetido por duplo clique/retry não gera impressão duplicada; reimpressão explícita gera evento separado.
- Dois consumidores concorrentes não reservam o mesmo trabalho; reserva vencida após envio incerto não causa reimpressão automática.
- Lenovo offline mantém fila; reconexão processa trabalhos seguros. Impressora desconectada não bloqueia outro destino.
- Reinício do Lenovo, do agente e falha de rede entre envio e confirmação têm comportamento validado.
- Cada equipamento imprime documento real no papel correto; conferir margens, orientação, acentos, valores e leitura do código de barras.
- Pedidos Shopee já marcados e etapas do Mercado Livre já concluídas não são repetidos na migração.
- O histórico diferencia enviado ao spooler de confirmação física disponível.

## Limites e rollback

O levantamento não comprova que o driver P50 já funciona no Lenovo: ele ainda está instalado no Nitro. A conexão física precisa ser feita pelo operador. Validar suspensão, energia e sessão Windows no equipamento antes de prometer disponibilidade contínua.

Não atualizar o Lenovo diretamente com o checkout principal: há alterações locais preexistentes em vps_server.cjs/js, módulo Mercado Livre e Android P50. A implementação deve preservar esses trabalhos e separar seu diff.

Rollback: pausar entrada da fila central, conferir trabalhos reservados/enviados, preservar diário e auditoria e só então restaurar executor anterior para documentos ainda não enviados. Manter migração aditiva e backup da tarefa/serviço; não remover marcadores nem reprocessar tudo.

Nesta etapa foi criado apenas este plano. Nenhuma nova fila, migração, credencial, instalação de driver ou publicação foi executada.

## Atualização: conexão da P50 em 04/09

Após o levantamento inicial, o operador conectou a P50 ao Lenovo. Confirmado hardware USB `VID_09C7&PID_00D1`, serial `000000000004`, igual ao dispositivo anteriormente conectado ao Nitro. O Windows atribuiu `USB005`, mas ainda não criou a fila P50.

O instalador foi obtido na página oficial https://www.marklifeprinter.com/jp/download/download-15-802.html e seus arquivos foram instalados em `C:\Program Files\APRT\P50`. O pacote e o log estão em `C:\ProgramData\MercadoDoVale\drivers\p50-20260904`. O pacote disponível não fornece INF/CAT; a tentativa de registrar seus arquivos pela API Windows foi recusada. Evento PrintService/Admin 869 em 04/09 às 10:16:46: erro 0xBCB, “Driver não tem nenhum catálogo válido”. Não foi alterada política de segurança ou verificação de assinatura. O assistente aberto por esta tentativa foi encerrado.

Estado: conexão física concluída; instalação funcional e teste de papel pendentes de driver compatível com as validações do Lenovo. Zebra, Comprovante e serviço na porta 8081 continuam ativos. Não foi enviado teste à P50 nem implementada/publicada a fila central.

### Instalação concluída pelo assistente do fabricante

Após o operador executar o DriverSetup no Lenovo, a consulta confirmou `P50 Printer`, driver de mesmo nome, ambiente Windows x64, porta `USB005` e estado `Normal`. O endpoint local `http://127.0.0.1:8081/printers` também lista a P50 junto com Comprovante e Zebra. Fila Windows sem trabalhos no momento da conferência.

A recusa anterior dizia respeito à tentativa de registro manual; não impediu a instalação pelo assistente do fabricante. A pendência de instalação está resolvida. Ainda faltam confirmação das medidas do rolo e impressão física de teste; `Get-PrintConfiguration` continua sem informar tamanho do papel. Não confundir reconhecimento pelo serviço local com disponibilidade remota: fila central/API/painel ainda não foram implementados.

## Diretriz do operador: configuração do sistema é a fonte da impressão

O operador determinou que a impressão siga a tela existente “Imprimir Etiqueta”. A imagem fornecida apresenta a seleção 30 × 20 mm (P50); isso é uma seleção do trabalho, não um tamanho fixo para todos os trabalhos futuros. Não é necessário solicitar novamente ao operador o tamanho já escolhido no sistema. As referências anteriores à confirmação do rolo tratam apenas da compatibilidade física no teste, não da origem das dimensões do documento.

- Preservar tamanho selecionado, nome/descrição editados, EAN/SKU, preço, exibição de preço, fontes, margens, orientação e demais opções efetivamente usadas pelo gerador atual.
- Enviar à fila o PDF produzido pelo gerador canônico com um retrato das configurações daquele trabalho. Não reconstruir a etiqueta no Lenovo nem substituir suas configurações por um template do agente.
- O código atual de `buildPdf` em `LabelPrintModal.tsx` já gera uma página por cópia. Portanto, enviar esse PDF uma única vez ao spooler, com uma cópia do documento; não multiplicar novamente a quantidade no driver.
- Configurar o papel do trabalho a partir das dimensões do PDF/configuração e usar escala real. Se o driver não aceitar o formato, informar incompatibilidade; não aplicar fit/shrink nem usar silenciosamente outro papel.
- Reutilizar a tela e a prévia existentes, acrescentando destino e acompanhamento da fila. Não criar outro configurador concorrente de etiqueta.
- Testar 30 × 20 mm, outro tamanho suportado, opções de conteúdo e múltiplas cópias; validar que N cópias geram exatamente N etiquetas, preservando dimensões e leitura do código de barras.

Esta diretriz foi incorporada ao plano; a integração com a fila central ainda não foi implementada.
