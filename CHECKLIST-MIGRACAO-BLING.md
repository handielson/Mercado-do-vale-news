# Migração do Bling — checklist principal

Atualizado em 2026-09-23. Objetivo aprovado: eliminar a dependência operacional do Bling, começando pelo fiscal com integração direta à SEFAZ. Evoluir por etapas e testar o ciclo de venda inteiro. Este arquivo é a fonte única do progresso; os documentos vinculados guardam detalhes e evidências.

## Estado e próxima entrega

**Marco atual: Dados da Empresa e cadastro do emitente (D06–D10 e F01).** Não iniciar F02/F03 ou emissão enquanto este marco não estiver implantado, testado em homologação e validado no ambiente operacional. F02a foi uma antecipação local já testada; permanecerá sem continuidade até encerrar o marco atual. Não emitir documento real apenas para testar.

- [Diagnóstico fiscal e proposta técnica](docs/migracao-bling/diagnostico-fiscal.md)
- [Funções do Bling e reaproveitamento local](docs/migracao-bling/mapa-funcional.md)
- [Registro dos testes e consultas](docs/migracao-bling/evidencias.md)
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
- [ ] D06 — Confirmar regime atual/vigência e operações fiscais com o contador; histórico é referência, não configuração automaticamente vigente.
- [ ] D07 — A1 exportado e removido do repositório sincronizado (E19/E21/E23–E25). O operador executou validação local com a senha: CNPJ corresponde, certificado vigente até 02/03/2027, chave privada presente e assinatura local aprovada. A ACL do arquivo local permite apenas Nitro, SYSTEM e Administradores. **Pendente por escolha do operador em 22/09/2026:** criar segunda cópia segura fora deste computador e ensaiar a recuperação depois. A autenticação mTLS e a consulta de status na SEFAZ-PE foram aprovadas em E28; a assinatura de XML fiscal continua em F07.
- [x] D07a — Tela de metadados do certificado por empresa e aviso configurável em pop-up no painel administrativo implementados localmente (E26). Não guarda PFX/senha; só dispara ao usar o painel e após migration/publicação. Testes locais aprovados; não equivale à instalação do A1 no servidor nem ao backup pendente em D07.
- [x] D07b — Gestão real do A1 pelo painel implantada e validada (E27/E28): instalação real, cofre AES-256-GCM, metadados, auditoria, exportação/exclusão controladas, guia/vídeo, alerta e consulta autenticada. O A1 da empresa foi aceito e a SEFAZ-PE homologação respondeu `107 — Serviço em Operação`; o backup externo de D07 continua separado.
- [ ] D08 — Conferir no e-Fisco PE credenciamento NF-e/NFC-e por modelo e ambiente e CSC por ambiente se NFC-e for aplicável. Requisitos oficiais revistos em E20; situação desta empresa ainda não comprovada.
- [ ] D09 — Definir empresas, modelos, canais e tipos de operação usados; classificar funções do inventário como necessárias, futuras ou não aplicáveis.
- [ ] D10 — Preparar ambiente isolado, fixtures sintéticas e backup com teste de restauração.

## F — Fiscal primeiro, direto na SEFAZ

- [ ] F01 — Pré-validação reutilizável do emitente: CNPJ, IE, UF, município, endereço e perfil tributário com vigência. Testar ausências, formatos e divergência de empresa.
- [x] F01a — Implementação local do cadastro fiscal por empresa, seleção manual de regime/CRT e consulta de CNPJ sem substituir escolhas. Testes locais E07; não representa liberação para emissão.
- [x] F01b — Validar migration e rotas em MySQL real isolado com duas empresas, concorrência e rollback. E09: MySQL 8.4 local aprovado; consulta externa e autenticação simuladas.
- [x] F01c — Validar localmente página → HTTP → autenticação bearer → MySQL e consulta pública real, mantendo regime/CRT escolhidos. Evidência E10; não representa publicação.
- [x] F01e — Criar verificação pura inicial de prontidão do emitente: identidade, endereço, regime/CRT e vigência. Teste local E11; ainda não ligada a uma emissão.
- [x] F01f — Cadastrar endereço fiscal por empresa adicional; manter endereço da loja principal canônico em company_settings. Testes MySQL e navegador E12.
- [x] F01g — Exibir pré-validação por empresa com leitura autenticada e conferir prefixo UF do código municipal IBGE. E13; não equivale à validação completa para SEFAZ.
- [x] F01h — Conferir código, cidade e UF completos pela API oficial do IBGE na pré-validação; falha da fonte não libera cadastro. E14.
- [x] F01i — Validar formato e dois dígitos da IE de PE pela regra oficial; para outras UFs, marcar validação indisponível até implementar regra própria. E15; situação cadastral atual ainda não confirmada.
- [x] F01j — Registrar inscrição municipal opcional por empresa sem alterar a identidade operacional; conferir persistência na empresa principal e adicional, com testes de API, MySQL e navegador. E16. Captura do Bling é referência, não preenchimento automático.
- [x] F01k — Cobrir campos cadastrais observados no Bling por empresa: Suframa, CNAE/porte canônicos, atividade, segmentos, faixas, contato, celular, e-mail de cobrança e IE substituta por UF. E18/E19: testes locais; valores reais não copiados.
- [x] F01m — Expor segmentos por empresa, opção explícita de isenção de IE e todos os CNAEs retornados pelo CNPJ com descrição; manter a isenção pendente de confirmação para emissão. E22: testes locais e integração MySQL/navegador; nenhum valor real aplicado.
- [ ] F01l — Conferir campo a campo os valores atuais da empresa principal entre cadastro canônico, Bling e perfil fiscal salvo; resolver divergências com o responsável. Testar persistência após recarga, sem preencher automaticamente valores conflitantes.
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
