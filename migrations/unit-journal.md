# Diário permanente de aparelhos — instalação pendente

Implementação canônica: `services/unitJournalSchema.cjs`. Gera a tabela MySQL `unit_journal_events` e triggers a partir das colunas realmente existentes. Não usar as migrations PostgreSQL/Supabase legadas deste diretório.

O diário acompanha a unidade pelo seu ID e IMEIs/serial, nunca pela unicidade do SKU. Inclui todos os campos das 22 colunas atuais da unidade e 87 do produto, além dos dados completos de venda e movimentação envolvidos em cada evento. Arquivos/imagens referenciados não são copiados para armazenamento imutável; seus caminhos e os valores salvos no cadastro ficam preservados. Dados completos são privados, consultáveis apenas com sessão administrativa.

Eventos: cadastro; edição e remoção da unidade; edição/remoção do produto; inclusão, alteração e remoção do item de venda; alteração/remoção da venda e do pedido vinculado; alterações de saldo por localização; movimentações de estoque. Alterações de produto/local são contexto da unidade, não prova de deslocamento físico daquele IMEI. Gravação pelo trigger pertence à mesma transação do evento: se a escrita do diário falhar, a operação é rejeitada; rollback também desfaz o evento não confirmado.

Registros preexistentes recebem uma fotografia identificada como `baseline`, com horário da implantação e `created_at` original nos dados. Vendas existentes são vinculadas apenas por identificador da unidade ou IMEI/serial. Não se atribui uma venda pelo SKU compartilhado. Não se inventa histórico anterior nem responsável humano: `db_actor` é a conta técnica real da conexão; `created_by`/`seller_id` são preservados quando disponíveis nos dados operacionais.

## Consulta no painel e exportação

No painel Produtos, o ícone de relógio `Histórico do produto`, ao lado de `Ver locais de estoque`, abre o mesmo diário usado na tela de unidades. Inclui os identificadores de produto agrupados no card, seus filhos e vínculos de família preservados nos snapshots. Nunca seleciona aparelhos por SKU compartilhado. Produtos sem unidades registradas podem não ter eventos neste diário de aparelhos.

`Imprimir histórico` abre a impressão do navegador, permitindo salvar em PDF. `Compartilhar via WhatsApp` prepara a mensagem para escolha da conversa pelo operador. As duas opções consultam todas as páginas antes da exportação e usam ordem cronológica; falhas impedem exportações parciais. Históricos acima de 6.000 caracteres codificados são baixados como TXT completo, com orientação para anexar o arquivo na conversa. Não há disparo automático. Dados binários de imagens são indicados como imagens preservadas no painel, sem incluir base64 no texto.

Validação em 14/10/2026: 19 testes aprovados (leitor, autorização, família/identificadores, exportação completa, datas, escape HTML e deploy seletivo) e build aprovado. Integração MySQL 8 aprovada em schema descartável, incluindo eventos de produto, pedido, venda, locais e movimentações, rollback e proteção imutável. Clone vazio do schema real também aprovado. Instalação autorizada concluída com 20 triggers, 244 fotografias iniciais e 162 referências de vendas, sem alterar totais operacionais.

## Preparação e validação

`node scripts/prepare-unit-journal.cjs` lê apenas o schema e gera `.local/unit-journal-migration.sql`. Não executa DDL/DML. A consulta por IMEI/serial usa índices dos identificadores antigos e atuais; continua funcionando após remoção/alteração do cadastro.

`node --test tmp-tests/unit-journal.test.cjs tmp-tests/unit-journal-mysql.test.cjs` verifica contrato, autorização, paginação, snapshots e integração opcional. O teste MySQL exige `UNIT_JOURNAL_TEST_MYSQL=1`, host local e banco vazio com nome `mdv_unit_journal_test_*`, explicitamente configurado por `UNIT_JOURNAL_TEST_DATABASE`, `UNIT_JOURNAL_TEST_USER` e `UNIT_JOURNAL_TEST_PASSWORD`. Nunca usa credenciais de produção.

## Instalação autorizada

`node scripts/install-unit-journal.cjs` valida em clone vazio separado do schema operacional, usando a conta DBA local da VPS. `--apply`, somente sob autorização explícita, pausa a API, verifica ausência de outros comandos ativos no banco, cria e verifica backup completo gzip, aplica a migração, confere cobertura e totais e retoma a API. Instalação parcial mantém a API parada para reparo. Recusa sobrescrever diário existente. Não altera parâmetros globais nem binlog.

Publicação seletiva: `node deploy-vps-server-only.cjs --unit-journal-check` para conferir o patch; `--unit-journal-only` publica os dois módulos e insere o hook nos três entrypoints, preservando código remoto alheio, com backup, validação de sintaxe, verificação de concorrência e rollback do código. Preservar sempre o diário instalado.

1. Validar em MySQL de teste e fazer backup completo do banco operacional. Conferir versão MySQL 8 e privilegios da conta DBA para triggers; o usuário operacional já teve restrição de criação de triggers com binlog. Não desabilitar binlog nem mudar parâmetros globais por tentativa.
2. Durante janela de manutenção, suspender escritas em unidades/produtos/vendas/estoque, inclusive integrações. Ler novamente o schema, gerar o plano e revisar o delta. Triggers devem ser regenerados explicitamente quando novas colunas forem adicionadas; não sobrescrever triggers existentes às cegas.
3. Executar o SQL revisado com conta DBA. Não há UPDATE/DELETE em registros comerciais no plano. Os únicos INSERTs de implantação são fotografias e referências no diário. Triggers de proteção impedem UPDATE/DELETE no diário. Conferir todos os triggers e contagens antes de liberar escritas. DDL MySQL não é transacional; implantação parcial exige concluir a instalação sob manutenção, sem apagar eventos.
4. Publicar API e site conforme `publish-vps`; o manifest da API inclui os módulos do diário. Sem tabela, a leitura responde 503 explicitamente. Validar consulta administrativa e rejeição de acesso público/genérico. Testar eventos somente com registros de teste identificados.
5. Preservar backups do diário junto com os do sistema. A aplicação não expõe edição/exclusão e bloqueia `/table-data/unit_journal_events`. Uma conta DBA capaz de DROP/TRUNCATE ou restauração de backup pode alterar o banco inteiro; proteção contra o próprio administrador da infraestrutura exigiria cópias externas imutáveis e política de retenção específica.

Rollback: voltar código/site quando necessário, preservando tabela e eventos. Não apagar o diário para reverter a interface. A instalação não corrige estoque, vendas ou cadastros existentes.

## Conferência PM7P12512P em 14/10/2026

Estado inicial da conferência: implementação local sem instalação. Em 14/10/2026, após autorização do operador, validação MySQL e instalação foram concluídas conforme descrito acima. Backup completo: /var/backups/mdv-unit-journal/before-journal-20261014144631921.sql.gz. Publicação e validação final na nota v1.2.622-diario-aparelhos. Alterações preexistentes de Shopee/3D preservadas.

Unidade com IMEI 1 final 8463 cadastrada em 17/06/2026 às 15h47 (São Paulo), disponível, sem vínculo com pedido/venda; não foi encontrada venda/garantia nos identificadores informados. Repetição do SKU é válida.

Dois cadastros deste SKU têm saldo 2 cada, mas somente uma unidade disponível por cadastro. Cada um tem 1 no Estoque Geral e 1 em Depósito / Entrada-Conferência. As duas entradas adicionais foram criadas em 14/10/2026 às 10h24 com motivo `distribution_open`: rotina que materializa saldo do produto ainda sem local ao abrir a distribuição. Isso confirma a origem dessas entradas, mas não recupera a origem do saldo 2 anterior. Nenhum saldo foi alterado nesta conferência e não há prova de venda deste IMEI.
