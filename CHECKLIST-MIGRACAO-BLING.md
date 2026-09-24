# Migração do Bling — checklist principal

Atualizado em 2026-09-23. Objetivo aprovado: eliminar a dependência operacional do Bling, começando pelo fiscal com integração direta à SEFAZ. Evoluir por etapas e testar o ciclo de venda inteiro. Este arquivo é a fonte única do progresso; os documentos vinculados guardam detalhes e evidências.

## Estado e próxima entrega

**Marco atual: Dados da Empresa e cadastro do emitente (D06–D10 e F01).** Não iniciar F02/F03 ou emissão enquanto este marco não estiver implantado, testado em homologação e validado no ambiente operacional. F02a foi uma antecipação local já testada; permanecerá sem continuidade até encerrar o marco atual. Não emitir documento real apenas para testar.

- [Diagnóstico fiscal e proposta técnica](docs/migracao-bling/diagnostico-fiscal.md)
- [Funções do Bling e reaproveitamento local](docs/migracao-bling/mapa-funcional.md)
- [Registro dos testes e consultas](docs/migracao-bling/evidencias.md)
- [Pacote de validação contábil por operação](docs/migracao-bling/validacao-contabil-operacoes.md)
- [Inventário completo de métodos/caminhos da API consultada](docs/migracao-bling/catalogo-api.json)
- [Índice público de categorias e seções](docs/migracao-bling/catalogo-ajuda.json)

## Regra de execução e conclusão

Para cada alteração: identificar o item deste checklist, registrar estado anterior, implementar, testar o comportamento e exceções pertinentes, registrar evidência e atualizar o item. Usar estados pendente, em andamento, bloqueado, reprovado ou aprovado. Marcar `[x]` somente quando o critério estiver demonstrado. Documento escrito, build aprovado e endpoint saudável não provam ciclo comercial funcionando.

Cada registro deve conter ID, data, ambiente, alteração, dados sintéticos ou identificadores protegidos, procedimento/comando, esperado, obtido, resultado e pendência. Guardar segredos, XMLs reais e dados pessoais fora de documentos versionados. Em testes de impressão, registrar dispositivo e formato.

Se um teste falhar, manter o item aberto, corrigir dentro do escopo e repetir o teste afetado. Se a falha for anterior ou exigir outra mudança, registrar claramente e não declarar aquela etapa aprovada. Implementação local, homologação, publicação e validação real são estados separados.

**Trava sequencial acordada em 22/09/2026:** concluir todos os critérios do marco ativo, incluindo dados faltantes, migration, sessão operacional, validação em homologação e publicação/validação real, antes de trabalhar no próximo. Dependências externas permanecem abertas com responsável e evidência; não são tratadas como concluídas por captura de tela ou teste local.

## D — Descoberta e preparação

- [x] D01 — Inspecionar serviços e cadastros existentes. Evidência E01/E02; cobertura inicial, sem auditoria integral de cada módulo.
- [x] D02 — Conferir dados da empresa no sistema e identidade no Bling. E02: CNPJ coincidente; campos cadastrais presentes.
- [x] D03 — Consultar amostras NF-e/NFC-e e XMLs sem mutação. E03: emitente coincidente, CRT 1 e protocolo 100 nos arquivos.
- [x] D04 — Catalogar API pública e índice de ajuda. E04: 263 operações, 165 caminhos, 49 grupos; 23 categorias e 348 seções.
- [x] D05 — Executar verificações iniciais e registrar inclusive falhas. E05; isto não significa aprovação da migração.
- [ ] D06 — Pacote e painel por empresa preparados em `docs/migracao-bling/validacao-contabil-operacoes.md` e E36/E37. **Aguardando o contador:** confirmar regime/CRT/vigência, apuração, frete/rateio e exceções por produto; preencher modelo, CFOP, CSOSN/CST, ICMS/ST/FCP/DIFAL, PIS/COFINS/IPI e benefícios das operações utilizadas. Histórico permanece apenas como referência.
- [x] D06a — Painel administrativo editável e isolado por empresa implementado para o contador salvar rascunho, marcar revisão e aprovar a matriz operacional. A aprovação exige responsável, data, decisões gerais, operações completas e decisão explícita sobre exceções por produto; não ativa cálculo ou emissão. Migration, concorrência, auditoria, backup/restauração, publicação e persistência após recarga testados em E37.
- [ ] D06b — Espaço do Contador separado do painel administrativo, com concessão por conta e empresa, formulário D06, auditoria e visão de faturamento operacional/fiscal. Migration 022 e site/API publicados em E39; rotas protegidas e tabelas conferidas. A conta fictícia de ensaio recebeu acesso e abriu `/contador` após o login (release `v1.2.446-accountant-login`). Importador corrigido e publicado em E40/E41. Em `v1.2.450-accountant-revenue-cents`, a validação autenticada confirmou que a tela abre, os valores são apresentados na escala de centavos do sistema e não há erro de API. A prévia foi publicada em E43; a correção do filtro de fim de dia foi publicada e a prévia autenticada de 22/09/2026 retornou 5 NF-e autorizadas, compatíveis com a listagem do Bling (E44). O primeiro lote de 5 NF-e foi importado sob autorização do operador; o total fiscal apareceu no Espaço do Contador e persistiu após recarga (E45). A versão `v1.2.454-fiscal-note-sales-channel` identificou o canal pela correspondência exata do pedido; em produção, as 5 notas de 22/09 apareceram como Shopee, e as 2 notas de 23/09 como Shopee e TikTok Shop (E46). E47 acrescenta a conferência explícita de diferenças de valor e de estado entre pedido e nota vinculados, sem reclassificação automática. Próximos passos: investigar as diferenças com o contador, testar isolamento por outra empresa/conta e obter a validação do contador real e de D06. Vendas ainda pendentes não são classificadas automaticamente como sem nota.
- [x] D06b.1 — Isolamento técnico de duas empresas e duas contas em teste sintético: listagem limitada pela concessão, acesso cruzado às rotas fiscais negado, faturamento da empresa adicional indisponível e importação pela conexão Bling principal bloqueada (E48). Ainda falta ensaio autenticado com segunda empresa/conta reais; não criar dados fiscais fictícios em produção apenas para testar.
- [x] D06b.2 — Origem dos três avisos de conciliação conferida por leitura dos eventos e notas: os status Shopee/TikTok são capturas da sincronização, não consultas atuais ao marketplace. O painel mostra a data da captura e pede conferência do status atual (E49). Diferenças de valor continuam abertas para análise documental com o contador; nenhuma classificação fiscal foi alterada.
- [x] D06b.3 — Notas emitidas no período com pedido Shopee/TikTok criado em outro dia exibem o vínculo na fila de conferência, com a data do pedido, sem somá-lo ao faturamento operacional do período (E50). Teste sintético de pedido em 21/09 e NF-e em 22/09 e validação autenticada da tela em produção aprovados nas versões 458/459. A definição da competência contábil segue aberta em D06b.8.
- [ ] D06b.4 — Concluir com o contador a análise fiscal das diferenças de R$ 2,00 (Shopee `260923S8DHQDU6`, NF-e 000699) e -R$ 1,93 (Shopee `260922N18QBRPP`, NF-e 000693). A decomposição numérica está em E51; ela não determina sozinha qual valor deve compor a NF-e. Responsável: operador e contador. Não alterar notas, tributos ou classificação automaticamente.
- [x] D06b.4a — Conferência aritmética somente de leitura no Bling e na Shopee: a NF-e 000693 tem produto R$ 12,00 e frete R$ 12,38; o pedido soma esses valores, taxa ao comprador R$ 1,99 e desconto de moedas R$ 0,06, chegando a R$ 26,31. Na NF-e 000699, produto R$ 24,99 mais frete R$ 32,92 chegam a R$ 57,91; a Shopee registra cupom da plataforma de R$ 2,00 e total do pedido R$ 55,91. E51. A coincidência numérica não resolve o tratamento fiscal.
- [ ] D06b.4b — Contador confirmar documentalmente o tratamento de taxa ao comprador, moedas/cupom da plataforma e frete em cada operação; registrar decisão em D06, sem aplicar regra por inferência. Responsável: contador. E51.
- [ ] D06b.4c — Confrontar o cancelamento atual do pedido Shopee `260923S8DHQDU6` com a situação da NF-e 000699 na fonte fiscal competente. A Shopee devolveu `CANCELLED`; a consulta autenticada à SEFAZ-PE em produção retornou `100 — Autorizado o uso da NF-e` em 23/09/2026 (E53). A divergência está confirmada; o contador deve determinar e registrar se cabe cancelamento fiscal, devolução ou outra providência, antes de qualquer mutação. Responsável: operador e contador.
- [x] D06b.4d — Disponibilizar no Espaço do Contador consulta somente de leitura do protocolo da NF-e na SEFAZ-PE, com A1 da empresa selecionada, conferência da chave e permissão por empresa. Testes sintéticos e publicação em E52; teste autenticado real da NF-e 000699 aprovado em E53. A resposta não altera o documento importado nem decide o tratamento fiscal.
- [x] D06b.4e — Registrar por NF-e a análise do contador sobre valores e providência fiscal proposta, com fontes, identificação profissional, auditoria e isolamento por empresa. Migration, testes de MySQL e publicação aprovados em E54; a NF-e 000699 abriu o formulário vazio em sessão autenticada. A persistência de rascunho foi provada em MySQL descartável, sem gravar decisão fictícia em produção. O registro não executa ação fiscal e não encerra D06b.4b/c sem decisão do contador real.
- [ ] D06b.5 — Conceder acesso ao contador real, preencher/revisar D06 e obter aprovação das regras fiscais por operação, exceções e conciliação de faturamento. Responsável: contador e operador. A conta fictícia de ensaio e testes automáticos não substituem esta validação.
- [ ] D06b.6 — Testar autenticação, concessão e isolamento com segunda empresa e segunda conta reais. Responsável: operador quando houver segunda empresa; E48 cobre somente duas empresas/contas sintéticas.
- [ ] D06b.7 — Segregar vendas e eventos operacionais por empresa antes de habilitar faturamento para empresas adicionais; hoje as fontes globais são restritas à empresa principal (E48). Responsável: implementação futura, após definição da origem operacional por empresa.
- [ ] D06b.8 — Definir com o contador a competência e o fuso contábil para vendas e notas próximas da meia-noite. Hoje o filtro diário usa a data armazenada na base; a tela passa a mostrar esse mesmo dia, mas ainda falta decidir se o relatório deve converter os instantes para o calendário de Pernambuco antes de agregar. Responsável: contador e operador; não alterar competências retroativamente sem essa decisão (E50).
- [ ] D06b.9 — Corrigir a orientação da prévia fiscal do Bling após HTTP 422 por excesso de notas. A tela agora começa por um dia, oferece reduzir o período excedido e avançar após cada importação, mantendo prévia e confirmação por lote (E55). Testes locais aprovados; pendem publicação e conferência da tela. Se um único dia exceder 120 notas, ainda será necessária subdivisão por horário antes de importá-lo.
- [ ] D07 — A1 exportado e removido do repositório sincronizado (E19/E21/E23–E25). O operador executou validação local com a senha: CNPJ corresponde, certificado vigente até 02/03/2027, chave privada presente e assinatura local aprovada. A ACL do arquivo local permite apenas Nitro, SYSTEM e Administradores. **Pendente por escolha do operador em 22/09/2026:** criar segunda cópia segura fora deste computador e ensaiar a recuperação depois. A autenticação mTLS e a consulta de status na SEFAZ-PE foram aprovadas em E28; a assinatura de XML fiscal continua em F07.
- [x] D07a — Tela de metadados do certificado por empresa e aviso configurável em pop-up no painel administrativo implementados localmente (E26). Não guarda PFX/senha; só dispara ao usar o painel e após migration/publicação. Testes locais aprovados; não equivale à instalação do A1 no servidor nem ao backup pendente em D07.
- [x] D07b — Gestão real do A1 pelo painel implantada e validada (E27/E28): instalação real, cofre AES-256-GCM, metadados, auditoria, exportação/exclusão controladas, guia/vídeo, alerta e consulta autenticada. O A1 da empresa foi aceito e a SEFAZ-PE homologação respondeu `107 — Serviço em Operação`; o backup externo de D07 continua separado.
- [x] D08 — Conferência autenticada no e-Fisco PE concluída em E34: IE ativa; NF-e modelos 38/39 e NFC-e modelos 83/84 credenciadas, sem suspensão; CSC ativo em homologação e produção. Nenhum código CSC foi exibido, copiado ou versionado.
- [x] D09 — Escopo inicial definido em `docs/migracao-bling/escopo-operacional-inicial.md` e E35: empresa principal com arquitetura multiempresa; NF-e/NFC-e; PDV, site e Shopee no primeiro ciclo; Mercado Livre/TikTok futuros; operações e funções do Bling classificadas sem inferir regras tributárias.
- [x] D10 — Ambiente fiscal isolado e reproduzível com MySQL 8.4 descartável, fixtures sintéticas e backup lógico restaurado em banco separado com comparação integral. E32.

## F — Fiscal primeiro, direto na SEFAZ

- [x] F01 — Pré-validação reutilizável do emitente concluída: identidade, IE ativa, UF/município IBGE, endereço, regime/CRT, vigência e CNAEs persistidos; ausências, formatos, divergência de empresa e sessão operacional testados em E07–E16, E27–E30 e E33–E34.
- [x] F01a — Implementação local do cadastro fiscal por empresa, seleção manual de regime/CRT e consulta de CNPJ sem substituir escolhas. Testes locais E07; não representa liberação para emissão.
- [x] F01b — Validar migration e rotas em MySQL real isolado com duas empresas, concorrência e rollback. E09: MySQL 8.4 local aprovado; consulta externa e autenticação simuladas.
- [x] F01c — Validar localmente página → HTTP → autenticação bearer → MySQL e consulta pública real, mantendo regime/CRT escolhidos. Evidência E10; não representa publicação.
- [x] F01e — Criar verificação pura inicial de prontidão do emitente: identidade, endereço, regime/CRT e vigência. Teste local E11; ainda não ligada a uma emissão.
- [x] F01f — Cadastrar endereço fiscal por empresa adicional; manter endereço da loja principal canônico em company_settings. Testes MySQL e navegador E12.
- [x] F01g — Exibir pré-validação por empresa com leitura autenticada e conferir prefixo UF do código municipal IBGE. E13; não equivale à validação completa para SEFAZ.
- [x] F01h — Conferir código, cidade e UF completos pela API oficial do IBGE na pré-validação; falha da fonte não libera cadastro. E14.
- [x] F01i — Validar formato e dois dígitos da IE de PE pela regra oficial; para outras UFs, marcar validação indisponível até implementar regra própria. E15; situação cadastral ativa confirmada no e-Fisco PE em E34.
- [x] F01j — Registrar inscrição municipal opcional por empresa sem alterar a identidade operacional; conferir persistência na empresa principal e adicional, com testes de API, MySQL e navegador. E16. Captura do Bling é referência, não preenchimento automático.
- [x] F01k — Cobrir campos cadastrais observados no Bling por empresa: Suframa, CNAE/porte canônicos, atividade, segmentos, faixas, contato, celular, e-mail de cobrança e IE substituta por UF. E18/E19: testes locais; valores reais não copiados.
- [x] F01m — Expor segmentos por empresa, opção explícita de isenção de IE e todos os CNAEs retornados pelo CNPJ com descrição; manter a isenção pendente de confirmação para emissão. E22: testes locais e integração MySQL/navegador; nenhum valor real aplicado.
- [x] F01l — Conferência campo a campo concluída em produção entre cadastro canônico, consulta cadastral da Receita, Bling e perfil fiscal. Razão social e CNAE principal foram corrigidos pela consulta canônica; todos os CNAEs, município IBGE, atividade, segmentos, faturamento, funcionários, contato, celular e vigência foram persistidos e confirmados após recarga. Suframa e IE substituta permanecem vazios porque também estavam vazios no Bling. E33.
- [x] F01n — Separar visualmente dados gerais/operacionais de fiscal/certificado sem criar uma segunda fonte para a empresa principal. `company_settings` permanece canônico para os módulos antigos; empresas adicionais usam o perfil fiscal próprio. E29: 10 campos compartilhados coerentes em produção, API protegida contra sobrescrita fiscal, 22/22 testes e navegação autenticada aprovada. Os campos complementares foram reconciliados em F01l/E33.
- [x] F01o — Corrigir a autoridade dos dados cadastrais para Receita Federal, distinguir o provedor técnico e impedir inferência de regime/CRT. O retrato consultado preserva campos cadastrais e todos os CNAEs permitidos; IE continua estadual/SEFAZ. E30: 24/24 testes, build e consulta real controlada ao espelho público aprovados.
- [x] F01p-preparo — Implementar o cliente da API oficial Consulta CNPJ v2 do SERPRO com OAuth2 Client Credentials, renovação de token, origem auditável e segredos exclusivos do servidor. Sem as duas chaves, nenhum segredo é enviado e os espelhos permanecem identificados como contingência.
- [ ] F01p — **Melhoria opcional, não bloqueia emissão nem este marco:** contratar/habilitar a API oficial Consulta CNPJ do SERPRO e cadastrar Consumer Key/Secret somente no cofre do servidor. Sem contrato, os espelhos públicos permanecem identificados e a interface mostra `Consulta direta oficial: Não`.
- [x] F01q — Centralizar a consulta das abas geral e fiscal no mesmo endpoint autenticado do backend, removendo a chamada direta do navegador à BrasilAPI. E33: fonte, identidade, endereço e todos os CNAEs usam a mesma normalização; regime e CRT continuam manuais. Implementação e testes locais aprovados; publicação e validação operacional registram a conclusão final em E33.
- [x] F01d — Migration aplicada e validada na VPS, cadastro fiscal ativado, página publicada e rota confirmada com sessão administrativa real (E27). A publicação foi reconciliada em worktree isolado sobre `origin/main`, preservando as mudanças alheias do diretório principal.
- [ ] F02 — Pré-validação fiscal dos itens: NCM, CEST quando aplicável, GTIN, origem, unidade e regra por operação. Testar campos ausentes e precisão decimal.
- [x] F02a — Implementado e testado localmente antes da trava sequencial (E17); sem continuidade ou integração até conclusão de D06–D10/F01.
- [ ] F03 — Corrigir/validar leitura histórica: divergência de situação no `blingNfService.ts` (2 cancelada; 5 autorizada no contrato consultado), paginação e falha parcial. Testar canceladas separadamente de autorizadas.
- [ ] F04 — Definir contratos, persistência e estados do documento; vínculos com venda e eventos; plano de migration ainda sem aplicação.
- [ ] F05 — Controlar série/numeração por empresa, modelo e ambiente, com concorrência e recuperação. Não deduzir o próximo número apenas de uma amostra.
- [ ] F06 — Gerar XML com pacote XSD e notas técnicas vigentes, incluindo regras RTC pertinentes. Validar XSD, campos e totais antes da transmissão.
- [ ] F07 — Assinar XML e configurar comunicação TLS com certificado. Validar assinatura e cenários de certificado expirado/incompatível sem expor a chave privada.
- [ ] F08 — Consultar serviço e transmitir em homologação; consultar resultado/recibo conforme o contrato. Testar timeout e recuperação sem duplicação.
- [ ] F09 — Preservar XML autorizado, protocolo, eventos e trilha de auditoria. Testar leitura, hash, backup e restauração.
- [ ] F10 — Gerar DANFE e, quando aplicável, DANFE NFC-e/QR Code. Conferir visualmente e imprimir no equipamento alvo.
- [ ] F11 — Implementar cancelamento, inutilização, CC-e e devoluções conforme aplicabilidade. Testar rejeições e efeitos separados de estoque/financeiro.
- [ ] F12 — Definir contingência e recuperação por autorizador/modelo; testar indisponibilidade. Não aplicar um procedimento genérico a todos os modelos.
- [ ] F13 — Validar casos fiscais representativos em homologação e confirmar com contador as regras aplicadas.
- [ ] F14 — Liberar produção em escopo controlado após validação e autorização de publicação/operação real.

## C — Ciclo completo de venda

Executar dois roteiros distintos: venda local que atualiza a Shopee; pedido originado na Shopee que entra no sistema. A ordem fiscal/expedição deve respeitar a operação e o contrato atual do canal.

- [ ] C01 — Pedido único, cliente e produtos corretos; manter identificadores de correlação.
- [ ] C02 — Reserva e baixa local exatamente uma vez, no depósito e unidade/IMEI corretos.
- [ ] C03 — Atualização do saldo disponível na Shopee confirmada por leitura; evitar dois publicadores concorrentes.
- [ ] C04 — Pagamento/recebível e taxas coerentes, sem dupla baixa.
- [ ] C05 — Nota própria autorizada vinculada ao pedido e itens corretos.
- [ ] C06 — Vincular/enviar dados fiscais ou XML para a Shopee conforme a API vigente; confirmar aceitação.
- [ ] C07 — Obter etiqueta do canal/transportadora correta, conferir pedido, volumes e impressão.
- [ ] C08 — Gerar comprovante comercial com número da venda, itens e pagamentos; conferir impressão. Não confundir com DANFE ou etiqueta.
- [ ] C09 — Conferir separação, envio/rastreio e estado final em todas as partes.
- [ ] C10 — Testar cancelamento antes/depois da reserva/baixa, nota rejeitada, pagamento pendente e devolução/estorno.
- [ ] C11 — Testar evento repetido, comunicação interrompida e duas vendas para a última unidade.

## M — Demais módulos e virada

- [ ] M01 — Produtos/cadastros independentes, vínculos externos preservados e imagens/documentos sem dependência de links do Bling.
- [ ] M02 — Estoque consolidado por depósito, unidade, composição e reserva; testar inventário e transferências.
- [ ] M03 — Compras e recebimento parcial/XML sem entrada duplicada; ligar contas a pagar e custo.
- [ ] M04 — Financeiro próprio, parcelas, baixas parciais, juros, descontos, taxas, estornos e conciliação.
- [ ] M05 — Substituir caminhos Bling dos demais canais efetivamente usados e validar cada ciclo.
- [ ] M06 — Migrar histórico e saldos de abertura separadamente; comparar contagens e totais por empresa, estado e período.
- [ ] M07 — Ensaiar corte, delta final e recuperação; manter um único responsável por cada efeito comercial durante a transição.
- [ ] M08 — Validar operação sem chamadas operacionais ao Bling, incluindo jobs, webhooks, relatórios, imagens, notas e logística.
- [ ] M09 — Desativar integrações antigas e encerrar assinatura somente após conferência final e autorização correspondente.

## Registro de execução

| Data | Itens | Resultado | Evidência | Próximo passo |
|---|---|---|---|---|
| 2026-09-22 | D01–D05 | Diagnóstico registrado; 3 testes locais passaram e 1 teste estático fiscal falhou | E01–E06 em evidencias.md | F01/F02 e resolução documentada de D06–D08; F03 antes de migrar histórico |
