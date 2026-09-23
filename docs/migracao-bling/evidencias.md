# Evidências — início da migração em 2026-09-22

Progresso canônico: [checklist](../../CHECKLIST-MIGRACAO-BLING.md). Todas as chamadas comerciais desta etapa foram GET; não houve emissão, cancelamento, baixa, migration de banco, publicação, commit ou push.

## E01 — Inspeção local

Checkout primário, branch main. Havia alterações preexistentes em AGENTS.md, API, Android, integrações e testes; foram preservadas. Inspecionados rotas, contratos de empresa/produtos, serviços Bling fiscal/financeiro, venda, estoque e compras. Limite: não é auditoria integral do banco/runtime de todos os módulos.

## E02 — Empresa

Consulta autenticada ao `/company-settings` da API própria: HTTP 200. Validada presença dos campos cadastrais e endereço; valores sensíveis não registrados. Consulta GET `https://api.bling.com.br/Api/v3/empresas/me/dados-basicos`: HTTP 200, CNPJ comparado em memória e coincidente. Token existente utilizado somente em memória; nenhuma renovação foi solicitada.

Resultado: aprovado para identificação inicial. Ausência dos campos fiscais na resposta local é lacuna de cadastro observado, não prova de inexistência de certificado em outro local.

## E03 — Amostras fiscais

GET de naturezas: HTTP 200, quatro registros na primeira página com limite 100. GET de listagem/detalhe NF-e e NFC-e: HTTP 200. Nova seleção com `situacao=5` em cada modelo encontrou amostra autorizada. Download via link oficial do documento: HTTP 200 em ambos.

Comparação em memória: emitente/CNPJ e IE iguais ao cadastro local, CRT 1, UF PE, cMun 2611101; XML com estrutura nfeProc e protocolo cStat 100. NF-e de setembro/2026 e NFC-e de junho/2026, série 1 nas amostras. Não foram salvos XMLs nem identificadores de clientes em arquivos versionados.

Resultado: aprovado para existência e consistência cadastral das amostras. Não equivale a auditoria do histórico completo, confirmação fiscal atual, teste de assinatura digital ou autenticação independente na SEFAZ.

## E04 — Catálogo público

Comando: `node scripts/inspect-bling-catalog.cjs`.

Resultado: aprovado. 165 caminhos, 263 operações, 49 grupos, 23 categorias e 348 seções. Asserções executadas: HTTP bem-sucedido, paginação completa versus total declarado, ausência de IDs/operações duplicados, categorias referenciadas existentes e endpoint de empresa presente. Fontes, horário e hash registrados nos JSONs.

## E05 — Testes locais existentes

| Comando | Resultado | Interpretação |
|---|---|---|
| `node tmp-tests/company-service-vps-only-static.test.mjs` | PASSOU | Guarda estática do transporte de empresa |
| `node tmp-tests/bling-finance-service-url-static.test.mjs` | PASSOU | Guarda estática da URL financeira |
| `npm.cmd run test:money` | PASSOU | Normalização monetária coberta pelo teste existente |
| `node tmp-tests/vps-bling-nf-fastify-static.test.mjs` | FALHOU | Assertion em vps_server.js: espera domínio www.bling.com.br no detalhe; código inspecionado usa api.bling.com.br |

A falha foi registrada, não corrigida silenciosamente. Nenhum desses testes demonstra emissão própria, estoque sincronizado com Shopee ou impressão. Não houve build porque não houve alteração de frontend/runtime comercial.

## E06 — Documentos e ferramenta de coleta

Na primeira validação, a comparação de contagens revelou que o OpenAPI declara 165 caminhos, mas um deles (`/`) é vazio, sem operação. O coletor foi ajustado para representar explicitamente 164 caminhos operacionais e um caminho vazio, sem omitir informação. Nova coleta e validação final registradas abaixo. Os testes de comportamento da nova emissão permanecem pendentes.

- Nova coleta: PASSOU, com asserções de paginação e identidade.
- Links relativos dos documentos e parse/contagens dos índices: PASSOU.
- `node --check scripts/inspect-bling-catalog.cjs`: PASSOU.
- Validador `quick_validate.py` da skill `bling-erp-migration`: PASSOU após atualização da referência ao checklist.
- `git diff --check` global: FALHOU por espaços finais em `pages/catalog/index.tsx` e linha em branco final em `vps_server.js`, arquivos com alterações preexistentes e não editados nesta tarefa. Não foram limpos para evitar interferência em outro trabalho.
- Arquivos criados nesta tarefa foram conferidos separadamente quanto a espaços finais e existência das referências.

## E07 — Cadastro fiscal e consulta por CNPJ (22/09/2026)

Ambiente: desenvolvimento local, dados sintéticos nos testes; nenhuma gravação em produção. Estado anterior: cadastro principal único, sem consulta tributária e sem tabela companies disponível. Alteração: perfis fiscais separados por CNPJ, regime e CRT manuais, consulta informativa, auditoria, bloqueio de versões obsoletas e seletor/cadastro de empresa. F01a aprovado localmente; F01/F01b permanecem abertos.

| Procedimento | Esperado e obtido | Resultado |
|---|---|---|
| npm run test:company-fiscal | Oito testes: CNPJ numérico/alfanumérico, campos desconhecidos, alternativa de fonte, validação manual, autenticação/flag, identidade principal, isolamento/concorrência e falha sem perda dos dados | 8/8 passaram |
| node --check nos novos serviços CJS e vps_server.cjs | Sintaxe válida | Passou |
| company-service-vps-only-static.test.mjs e company-settings-service-vps-only-static.test.mjs | Contratos existentes preservados | Passaram |
| npm run build | Compilação e pré-build sem dependência Supabase runtime | Passou |
| Chrome via agent-browser, fixture company-fiscal-ui-server.mjs | Atualizar consulta preserva Lucro Real/CRT 3 em A; adicionar B como MEI/CRT 4; selecionar A restaura configurações de A e resultado anterior | Passou, API em memória |
| git diff --check restrito à página e package.json | Sem erros de whitespace nas alterações verificadas | Passou |

O harness de navegador teve inicialmente erro de JSX virtual/configuração do Vite, corrigido antes de repetir os passos aprovados. Os testes de rotas usam adaptador SQL em memória: não comprovam compatibilidade da migration em MySQL real. A fixture de navegador não valida o layout completo nem a integração navegador→backend→banco real. A consulta real do CNPJ realizada na preparação usou fonte pública alternativa após bloqueio HTTP 403 da primeira fonte; nenhuma escolha tributária foi gravada automaticamente.

Pendências: aplicar/testar migration em homologação, ativação e persistência real; confirmar perfil/vigência com contabilidade; completar emitente/endereço/IE; ligar cada venda ao emitente; emissão SEFAZ posterior. Roteiro em cadastro-fiscal.md.

## E08 — Ampliação da validação (22/09/2026)

Continuação de F01a/F01b. npm run test:company-fiscal passou 11/11 testes. Os três casos adicionais comprovam bloqueio após mudança externa do CNPJ principal, consulta em andamento rejeitada quando uma edição posterior muda a versão (incluindo consulta simultânea 429) e exigência de administrador em todas as mutações, descartando resultado tributário forjado no payload.

Criado test:company-fiscal:mysql para banco local descartável. Primeira execução falhou no preflight: pipe dockerDesktopLinuxEngine ausente. A tentativa de iniciar Docker Desktop não manteve o backend em execução. Nenhuma migration foi executada e nenhum banco externo foi acessado. Sintaxe do teste validada; seus cenários MySQL ainda não foram aprovados. F01b segue pendente de ambiente, seguido de homologação integrada e publicação.

## E09 — MySQL real aprovado (22/09/2026)

Após o usuário iniciar Docker Desktop, executado npm run test:company-fiscal:mysql: 1/1 teste de integração passou (aproximadamente 83 segundos). Ambiente: MySQL 8.4 em container local descartável, banco mdv_fiscal_test e empresas fictícias; nenhum .env operacional carregado.

Comprovados: migration aplicada duas vezes; gravação/leitura de duas empresas; rejeição de CNPJ duplicado; preservação de regime/CRT após consulta simulada; consulta de B não altera A; duas edições na mesma versão resultam em 200 e 409; falha induzida por trigger na auditoria reverte os dados e a versão do perfil; quatro eventos válidos persistidos; identificação principal preservada. Container de teste removido ao finalizar.

F01b aprovado para banco real isolado. F01c mantém pendentes homologação integrada navegador/API/autenticação/fonte externa e publicação. O teste usa Fastify.inject e autenticação/consulta simuladas: não demonstra sessão real, rede HTTP completa nem emissão fiscal. Nenhuma alteração em produção, commit, push ou deploy nesta retomada.

## E10 — Fluxo integrado local aprovado (22/09/2026)

Com Docker ativo, executado `npm run test:company-fiscal:browser`: 1/1 passou. O teste reaplica a migration duas vezes em MySQL 8.4 descartável; abre a tela real no Chrome, passa pelo proxy HTTP e pelas rotas Fastify, usa as funções canônicas de assinatura/verificação do token do backend com administrador sintético e salva uma empresa adicional. A consulta de CNPJ público foi respondida pela Minha Receita após indisponibilidade da primeira fonte. Depois do recarregamento, a empresa adicional manteve Lucro Real/CRT 3 e seu resultado de consulta; a empresa principal permaneceu sem esse resultado. Consultas sem token, com usuário comum e com token alterado retornaram 401. Registro final confirmado por SELECT em MySQL. Container removido ao término.

Tentativas anteriores falharam por configuração do proxy do teste, seletor do navegador e espera de carregamento. O harness foi corrigido e a execução completa foi repetida com sucesso. O teste não criou venda, não transmitiu nota, não usou credencial operacional nem escreveu no banco da VPS. F01c concluído apenas no ambiente local; F01d e F01 geral continuam pendentes.

## E11 — Pré-validação inicial do emitente (22/09/2026)

Adicionada função pura `validateIssuerReadiness` em companyFiscalCore.cjs. Entrada: perfil fiscal escolhido, endereço e data de emissão. Saída: prontidão e lista de campos ausentes/incompatíveis, sem alterar dados. Verifica CNPJ, razão social, inscrição estadual informada, UF, município IBGE, CEP, logradouro, número, bairro, cidade, regime, CRT e vigência; bloqueia perfil com conflito de identidade. `npm run test:company-fiscal` passou 12/12, incluindo perfil completo e ausência/incompatibilidade. Não valida cálculo estadual de IE, regras por operação ou certificado, e ainda não está conectada ao transmissor SEFAZ. Para empresas adicionais, endereço específico ainda requer modelagem e cadastro antes de atingir prontidão real.

## E12 — Endereço por empresa fiscal (22/09/2026)

Incluídos campos de endereço na migration 020 ainda não aplicada fora dos testes, no formulário e nas rotas fiscais. A loja principal lê o endereço atual de company_settings e não o duplica no perfil fiscal. Empresas adicionais persistem endereço próprio, com normalização de CEP e limites de texto; cadastro incompleto continua possível, mas a pré-validação sinaliza campos faltantes antes da emissão.

Validação: `npm run test:company-fiscal` 12/12; `npm run build` aprovado; `npm run test:company-fiscal:browser` 1/1 após alteração final. O teste MySQL confirmou aplicação da migration, endereço próprio de B e endereço canônico da loja A; o Chrome salvou endereço de outra empresa, recarregou e confirmou UI e registro MySQL, além de consulta pública preservando escolhas manuais. Container removido ao término. Não houve escrita externa, commit, push ou deploy.

## E13 — Pré-validação visível por empresa (22/09/2026)

Adicionada rota autenticada, somente leitura, `GET /admin/fiscal-companies/:id/readiness`, e botão Verificar dados para emissão no painel. A rota lê o perfil selecionado do banco e retorna apenas resultado de prontidão cadastral e campos pendentes; exige administrador e respeita a flag de ativação. A função pura agora compara os dois primeiros dígitos do município IBGE com a UF; [a regra de composição consta no IBGE](https://www.ibge.gov.br/explica/codigos-dos-municipios.php). Uma combinação PE/5300108 fica pendente. A lista da UI esclarece que IE informada não é IE validada e que emissão exige análise fiscal, certificado e regras tributárias.

Verificação: `npm run test:company-fiscal` 13/13, incluindo isolamento e rota sem escrita; `npm run build` aprovado; `npm run test:company-fiscal:browser` 1/1 com MySQL real, autenticação canônica em ambiente isolado e CNPJ público. O navegador mostrou a pendência de IE na empresa adicional; acessos sem token, com usuário comum ou token alterado foram recusados. Nenhum container de teste permaneceu ativo. F01 ainda aberto: validação da IE por UF, município completo/cidade, dados fiscais por operação e integração ao emissor.

## E14 — Município completo no IBGE e limite dos dados Bling (22/09/2026)

Consulta oficial: [API de localidades do IBGE](https://servicodados.ibge.gov.br/api/docs/localidades), rota pública `GET /api/v1/localidades/municipios/{id}`. A rota de prontidão cadastral agora confere id, cidade e UF do perfil salvo com os dados oficiais. Município divergente, inexistente ou fonte indisponível aparecem como pendência; só os campos oficiais necessários são devolvidos. Consulta explícita, sem alterar cadastro. A leitura de Bling da etapa D02/E02 mostrou CNPJ no endpoint de dados básicos; esse endpoint não retornou IE. XML histórico permitiu comparar IE e emitente, mas não fornece validação atual da inscrição estadual. Por isso, nenhum valor de IE foi inferido ou copiado.

`npm run test:company-fiscal`: 14/14, incluindo divergência, 404 e falha da fonte sem aprovação. `npm run build`: passou. `npm run test:company-fiscal:browser`: 1/1 após ajuste de seletor do harness, com MySQL isolado, Chrome, API fiscal, CNPJ público e API real do IBGE; Brasília/DF foi confirmada pelo código 5300108 enquanto a IE ausente permaneceu pendente. Container removido. F01 continua aberto para validação estadual de IE e integração ao emissor; nenhuma nota transmitida e nenhuma escrita em produção.

## E15 — Dígitos da inscrição estadual de Pernambuco (22/09/2026)

Fonte primária: [SEFAZ-PE, cálculo do dígito verificador da nova inscrição](https://www.sefaz.pe.gov.br/Servicos/Sintegra/Paginas/calculo-do-digito-verificador.aspx), exemplo público 0321418-40; [Portaria SF 087/2007](https://www.sefaz.pe.gov.br/Legislacao/Tributaria/Documents/legislacao/Portarias/2007/Port087_2007orig.htm), que descreve a inscrição de nove dígitos. `verifyStateRegistration` remove pontuação, valida formato e aplica os dois cálculos somente para PE. Número de outra UF fica com estado `unsupported` e mantém a pré-validação pendente, mesmo quando o formato é numérico. IE ausente ou com dígito inválido recebe pendência específica. Isto não consulta a situação ativa do cadastro estadual.

Leitura somente da API operacional `/company-settings`, sem exibir ou gravar a IE: empresa principal em PE, nove dígitos e resultado `valid`. Os XMLs históricos do Bling já haviam permitido comparar a IE, mas não demonstram a situação cadastral atual. `npm run test:company-fiscal`: 15/15; `npm run build`: passou; `npm run test:company-fiscal:browser`: 1/1 em MySQL isolado com consulta pública. Nenhuma migration aplicada fora do teste; nenhum container permaneceu ativo. F01 segue aberto para situação da IE e emissão SEFAZ.

## E16 — Inscrição municipal por empresa (22/09/2026)

Estado anterior: a captura fornecida da tela Dados da empresa no Bling mostra inscrição municipal e opção Simples Nacional, mas o cadastro fiscal local não tinha campo para inscrição municipal. A captura é evidência da interface, não validação oficial de situação ou vigência; o número exibido não foi transcrito para código, fixture ou cadastro operacional.

Alteração local: coluna `municipal_registration` na migration 020 ainda não publicada; API e formulário preservam valor opcional por empresa. A loja principal mantém CNPJ, IE e endereço canônicos em `company_settings`; apenas a inscrição municipal fica em seu perfil fiscal. Regime, CRT e vigência continuam de escolha manual, sem importação automática da captura.

Esperado: gravar e reler inscrições municipais distintas sem afetar identidade, regime ou outra empresa. Obtido: `npm run test:company-fiscal` 15/15; `npm run build` aprovado; `npm run test:company-fiscal:browser` 1/1 com MySQL 8.4 descartável, Chrome, API autenticada e consulta pública. Fixtures sintéticas `IM-123` e `IM-456` foram lidas em resposta/API, após recarregar a tela e por SELECT no banco. Container removido. A migration ainda precisa de homologação e implantação; emissão SEFAZ e confirmação contábil do regime continuam pendentes.

## E17 — Pré-validação pura de item fiscal (22/09/2026)

Estado anterior: `Product` e a gravação em `services/products.ts` já continham NCM, CEST, origem e EANs, mas não havia verificador para preparar uma linha de NF-e/NFC-e. Unidade comercial, CFOP, aplicabilidade do CEST e regra tributária por operação não estavam definidos no cadastro canônico; o schema de produto aceita valores fiscais incompletos. Fonte consultada: [MOC 7.0, Anexo I do portal oficial NF-e](https://hom.nfe.fazenda.gov.br/PORTAL/exibirArquivo.aspx?conteudo=DQFCIFUzszw%3D), com campos NCM, CEST, CFOP, uCom, qCom e vUnCom; [GS1, cálculo do dígito do GTIN](https://www.gs1.org/services/how-calculate-check-digit-manually).

Alteração local: `services/fiscalItemReadiness.cjs` produz lista de pendências sem alterar produto, venda, estoque ou documento. Exige decisão explícita da operação para CEST, unidade, CFOP, regra tributária e GTIN/SEM GTIN. Preço é recebido como centavos inteiros do sistema; quantidade admite até quatro casas. Não confere se o NCM existe ou está vigente, se o CEST é tributariamente aplicável, se CFOP/regra estão corretos ou se o GTIN pertence oficialmente ao item; essas verificações exigem tabelas/regras vigentes e validação contábil.

Teste: `node --test tmp-tests/fiscal-item-readiness.test.cjs`, 5/5 aprovados com item completo, lacunas, CEST condicional, GTIN inválido, serviço e precisão. Verificador ainda não conectado à emissão ou ao cadastro de produto; F02 geral permanece aberto. Nenhuma gravação operacional ou publicação.

## E18 — Campos cadastrais complementares por empresa (22/09/2026)

Marco ativo: Dados da Empresa/F01. Antes, o cadastro principal já tinha nome, CNPJ, IE, CNAE, porte, endereço, telefone, e-mail e site; o perfil fiscal local tinha inscrição municipal, regime, CRT e município IBGE. A captura fornecida do Bling mostra também Suframa, atividade principal, segmentos, faixas de faturamento e funcionários, pessoa de contato, celular e e-mail de cobrança. Esses campos estavam sem representação no perfil por empresa. Nenhum valor real foi transcrito.

Foram adicionados campos opcionais à migration 020 ainda não aplicada operacionalmente, à validação de entrada, API e formulário. A empresa principal continua lendo CNAE, porte, telefone, e-mail e site de `company_settings`; o perfil permite os campos complementares. Empresas adicionais guardam seu próprio cadastro. O tipo de pessoa fica implícito como pessoa jurídica, porque este fluxo exige CNPJ. Faixas são texto cadastral, sem uso como regra fiscal ou inferência de tributação.

Resultado local: `npm run test:company-fiscal` 15/15; `npm run build` aprovado; `npm run test:company-fiscal:browser` 1/1 com migration aplicada duas vezes em MySQL 8.4 descartável, Chrome, API autenticada, empresa principal e adicional, persistência após recarga, concorrência e rollback. O teste usa apenas valores fictícios e confirmou Suframa, segmentos e e-mail de cobrança no banco. Container de teste removido. D06–D10/F01d ainda impedem concluir o marco e seguir para F02.

## E19 — Conferência complementar no Bling e IE substituta (22/09/2026)

Consulta somente leitura à página Dados da empresa no Bling: há seção adicional de inscrições estaduais dos substitutos tributários por UF, além de logo já coberto pelo cadastro operacional. Nenhuma IE substituta estava preenchida na tabela visível. A faixa de faturamento selecionada na interface consultada diferiu da captura anterior fornecida; por isso, nenhum valor foi copiado ou tratado como definitivo. O Bling apresenta Simples Nacional na interface, mas não informa vigência contábil comprovada.

Consulta somente leitura a Preferências → Certificado Digital: há certificado A1 no servidor do Bling com validade exibida até 02/03/2027 e opção de exportação para administrador. Não foi exportado, baixado, alterado ou excluído certificado; senha, chave privada e nome do titular não foram registrados aqui. Essa leitura comprova presença no Bling, não acesso independente ao certificado nem armazenamento seguro para o emissor próprio.

Incluído `substitute_state_registrations` JSON opcional por empresa na migration 020 ainda não aplicada operacionalmente, com UF única e inscrição não vazia; há controles de adicionar/remover no formulário. `npm run test:company-fiscal` 15/15 e `npm run build` aprovados. A primeira execução integrada falhou ao localizar o seletor novo no teste de navegador; foi dado nome acessível explícito e a execução completa `npm run test:company-fiscal:browser` passou 1/1, incluindo persistência MySQL da IE substituta fictícia. A validade do número na UF não é inferida. Nenhuma escrita no Bling ou na VPS.

## E20 — Requisitos oficiais e preflight de publicação (22/09/2026)

Leitura oficial da [SEFAZ-PE para NF-e](https://www.sefaz.pe.gov.br/Servicos/nota-fiscal-eletronica/Paginas/credenciamento-de-contribuintes.aspx): o credenciamento é controlado por homologação e produção; a página descreve testes em homologação antes da produção. A [SEFAZ-PE para NFC-e](https://www.sefaz.pe.gov.br/Servicos/Nota-Fiscal-de-Consumidor-Eletronica/Paginas/Credenciamento-de-Contribuintes.aspx) descreve os dois credenciamentos e CSC próprio por ambiente, com orientação específica para solicitação simultânea. Essas páginas não revelam a situação desta empresa. Nenhum credenciamento ou CSC foi criado, consultado com login ou alterado nesta etapa.

Preflight somente leitura `npm run publish:vps-plan -- --slug cadastro-fiscal-empresa --summary "Cadastro fiscal multiempresa"`: repositório local em `main`, quatro commits à frente e 26 atrás de `origin/main`, com dezenas de alterações alheias e arquivos não rastreados. O plano amplo sugeriu inclusive ações de n8n fora do escopo; não foi executado. Publicação do cadastro requer isolamento e reconciliação do Git, backup/restauração de homologação, aplicação controlada da migration e testes com sessão real. Nenhum commit, push, migration operacional ou deploy feito.

## E21 — Tentativa autorizada de exportação do A1 no Bling (22/09/2026)

Após autorização do responsável, acionado **Exportar certificado** em Preferências → Certificado Digital. O Bling abriu uma janela com dois campos obrigatórios: senha do administrador da conta e senha do certificado. A tentativa parou nessa etapa porque as senhas não estão disponíveis para o agente. Nenhum arquivo foi baixado, nenhuma senha foi digitada ou registrada e o certificado do Bling não foi alterado. D07 permanece aberto até o responsável completar a exportação e ser possível conferir a cópia e seu armazenamento seguro fora do repositório.

## E22 — Isenção de IE, segmentos e todos os CNAEs (22/09/2026)

O cadastro fiscal já permitia escolher os quatro segmentos vistos no Bling, mas não tinha marcador próprio de isenção de IE. Adicionado marcador por empresa, mutuamente exclusivo com número de IE; a prontidão fiscal fica pendente de validação externa quando há isenção, sem presumir que o emitente pode transmitir nota. A consulta de CNPJ agora preserva CNAE principal e secundários com código e descrição, mostra todos para conferência e permite gravá-los no perfil selecionado. A busca de CNPJ no cadastro principal também exibe a lista consultada. A fonte [BrasilAPI documenta `cnae_fiscal`, `cnae_fiscal_descricao` e `cnaes_secundarios`](https://github.com/BrasilAPI/BrasilAPI/blob/main/pages/docs/doc/cnpj.json); a [Concla/IBGE oferece notas explicativas](https://concla.ibge.gov.br/busca-online-cnae.html). Uma descrição cadastral não define sozinha tributação ou autorização de operação.

Verificação: `npm run test:company-fiscal` 17/17 e `npm run build` aprovados. Primeira integração MySQL falhou porque o fixture da empresa principal marcava isenção e trazia IE simultaneamente; o fixture foi corrigido, mantendo a regra de bloqueio. `npm run test:company-fiscal:browser` passou 1/1, aplicando a migration duas vezes em MySQL 8.4 descartável, salvando isenção e lista de CNAEs principal/secundário obtida de CNPJ público, recarregando a tela e conferindo a persistência no banco. `tsc --noEmit` segue com erros preexistentes em outros módulos; filtragem dos arquivos alterados não mostrou erros deste escopo. Nenhuma migration operacional, cadastro real ou emissão foi alterado.

## E23 — Cópia local do certificado A1 (22/09/2026)

O responsável informou que concluiu a exportação para `cert.pfx` na raiz do repositório sincronizado. Localizado arquivo de 8.963 bytes, não rastreado pelo Git. Movido para `%LOCALAPPDATA%\MercadoDoVale\certificates\cert.pfx`, fora do repositório e do SynologyDrive, com SHA-256 idêntico antes/depois da movimentação e ausência confirmada no caminho original. ACL do arquivo e da pasta restrita ao usuário Nitro, SYSTEM e Administradores. `.gitignore` atualizado para bloquear `*.pfx` e `*.p12`. O arquivo não foi aberto, importado ou enviado a nenhum serviço. Extensão e tamanho não comprovam que contém chave privada válida nem que pertence ao CNPJ correto; D07 fica aberto até validação com senha em ambiente controlado e backup seguro.

Adicionado `scripts/verify-fiscal-certificate.ps1` para solicitar a senha sem exibi-la, importar o PFX apenas em memória, conferir CNPJ/validade/chave privada e fazer uma assinatura local de teste. A análise sintática passou sem erros. Um teste funcional com certificado sintético local foi rejeitado automaticamente pela política de execução do ambiente, sem razão mais específica; não foi tentado por outro meio. O PFX real ainda não foi testado por esse script.

Correção após tentativa do operador: `pwsh` não está no PATH do Windows PowerShell interativo dele. O script agora usa a sobrecarga disponível no Windows PowerShell 5.1; a senha é convertida temporariamente apenas em memória, e o buffer BSTR é apagado após a importação. Sintaxe e disponibilidade das APIs conferidas no Windows PowerShell 5.1. Validação real ainda aguarda execução pelo operador.

Nova correção: o PowerShell do operador não encontrou o arquivo no caminho `%LOCALAPPDATA%` visto pela sessão de trabalho, embora a sessão de trabalho o encontrasse ali. O arquivo de 8.963 bytes foi devolvido à raiz original do repositório sincronizado sem sobrescrever outro arquivo; SHA-256 antes/depois da devolução coincidiu e `git check-ignore cert.pfx` confirmou exclusão do Git. A causa exata da diferença de visibilidade entre sessões não foi comprovada. A retirada definitiva da pasta sincronizada deve ser feita no PowerShell do operador, usando o `%LOCALAPPDATA%` daquela sessão; até lá, não considerar o armazenamento seguro concluído.

## E24 — Retirada da pasta sincronizada pelo operador (22/09/2026)

O operador informou que executou os comandos de movimentação e validação. Conferência independente da localização: não há mais `cert.pfx` na raiz do repositório; arquivo de 8.963 bytes está visível em `%LOCALAPPDATA%\MercadoDoVale\certificates\cert.pfx`; ACL lida no arquivo mostra acesso apenas de Nitro, SYSTEM e Administradores. `git check-ignore cert.pfx` continua ativo. O resultado do verificador de senha/chave/assinatura ainda não foi informado, portanto não está marcado como aprovado.

## E25 — Validação local do A1 comunicada pelo operador (22/09/2026)

O operador executou `scripts/verify-fiscal-certificate.ps1` no seu Windows PowerShell e informou: `CnpjCorresponde=True`, `ValidoNestaData=True`, `ValidoAte=2027-03-02`, `ChavePrivadaPresente=True` e `AssinaturaLocalFuncionou=True`. A data coincide com a validade exibida no Bling. Nenhuma senha, chave privada ou conteúdo do PFX foi transmitido na conversa. Isso comprova abertura do arquivo e assinatura local conforme o verificador, não credenciamento SEFAZ, autorização de emissão nem recuperação de uma cópia de backup. D07 permanece aberto apenas para backup/recuperação seguros; F07 cobre assinatura XML e comunicação fiscal posterior.

O operador escolheu adiar a segunda cópia e o ensaio de recuperação e pediu que permaneçam como pendência no checklist. Não foi criada cópia adicional nem alterado o PFX validado.

## E26 — Tela do certificado e aviso em pop-up (22/09/2026)

Incluído painel **Certificado digital** em Dados da Empresa, com seleção de empresa, tipo A1 servidor/A1 cliente/A3/Gerenciador do Windows, validade e antecedência configurável de 1 a 365 dias. O backend guarda apenas metadados em `company_certificate_settings`, isolados por perfil fiscal; nenhuma chave privada, PFX ou senha passa pela página. Um endpoint autenticado de administrador retorna certificados dentro da janela de aviso. O `AdminLayout` consulta esse endpoint ao abrir o painel e a cada hora enquanto estiver aberto; mostra pop-up para vencidos e próximos do vencimento. Fechar com “Lembrar na próxima sessão” suprime repetição naquela sessão/dia. Não envia e-mail/WhatsApp nem executa verificação sem sessão administrativa aberta.

## E27 — Cofre A1, operações controladas e status SEFAZ-PE (22/09/2026)

Estado anterior: o painel guardava somente validade e antecedência; não recebia o PFX, não instalava no servidor e não comunicava com a SEFAZ. Alteração: upload multipart de até 5 MB aceita `.pfx`/`.p12`, abre o PKCS#12 com a senha, exige chave privada e confere o CNPJ do titular com a empresa selecionada. O PFX original e a senha ficam em registro AES-256-GCM com IV aleatório e chave mestra exclusiva do ambiente, em diretório privado com permissões 0700/0600; MySQL guarda apenas metadados, estado e auditoria. A chave mestra não é enviada ao navegador nem versionada.

Exportação exige novamente a senha do PFX e registra evento. Exclusão exige senha e confirmação do CNPJ, remove o cofre e limpa metadados operacionais. Renovação substitui atomicamente o arquivo. O painel mostra titular, emissor, serial e SHA-256, mantém aviso configurável e inclui guia HTML e vídeo próprios. A consulta `NFeStatusServico4` usa mTLS com o A1 armazenado e endpoints oficiais da SEFAZ-PE para homologação e produção; código 107 é apresentado como operacional. Isto comprova o transporte/certificado quando executado com o A1 real, mas ainda não gera, assina nem transmite XML de NF-e.

Validações locais: `npm run test:company-fiscal` 19/19, incluindo PFX sintético, CNPJ divergente, cifra em repouso, senha errada, exportação, exclusão e resposta SEFAZ simulada; `npm run test:company-fiscal:mysql` 1/1 com migration aplicada duas vezes e ciclo upload/status/export/delete; `npm run test:company-fiscal:browser` 1/1 pela tela real, HTTP autenticado e MySQL 8.4 descartável; `npm run build` e verificações de sintaxe aprovados. Nenhum segredo real foi usado nos testes automatizados.

Publicação: migration aplicada na VPS e três tabelas conferidas; cofre privado e chave mestra gerada no ambiente; `mdv-api` reiniciada online. A primeira validação encontrou 404 porque o processo PM2 executa `server.js`; o deploy direcionado foi corrigido, ganhou teste de regressão e foi repetido. Depois da correção, acesso sem sessão retornou 401, login administrativo real retornou 200, listagem fiscal retornou `enabled=true`, uma empresa principal e HTTP 200. `/status` retornou 200 com `mysql.ok=true`; guia e vídeo retornaram 200. Pendente o operador instalar o A1 real pela tela e executar homologação para registrar o retorno oficial mTLS.

Validação: `npm run test:company-fiscal` 17/17; `npm run build` aprovado; `npm run test:company-fiscal:mysql` 1/1, incluindo configuração e leitura de aviso; `npm run test:company-fiscal:browser` 1/1 com cadastro e recarga da tela. Houve falhas intermediárias no teste de navegador por seletor e por corrida entre consulta e edição; o painel passou a bloquear edição durante carregamento e o teste final passou. A migration permanece sem aplicação operacional; nenhum certificado foi instalado no servidor ou apresentado como pronto para emitir.

## E28 — A1 real e status oficial da SEFAZ-PE em homologação (23/09/2026)

Ambiente: painel administrativo e API de produção, consultando o webservice oficial `NFeStatusServico4` da SEFAZ-PE em homologação. O operador instalou pelo painel o A1 da empresa com validade até 02/03/2027. O servidor confirmou CNPJ titular correspondente, presença de chave privada e armazenamento criptografado; a senha não foi enviada na conversa nem registrada nesta evidência.

A primeira consulta real falhou antes do SOAP porque o Node.js não reconhecia a AC Raiz ICP-Brasil v10 apresentada pelo servidor estadual. A raiz SSL pública foi obtida do [repositório oficial do ITI](https://www.gov.br/iti/pt-br/assuntos/repositorio/repositorio-ac-raiz), conferida pela impressão digital SHA-256 `6E:0B:FF:06:9A:26:99:4C:15:DE:2C:48:88:CC:54:AF:84:88:2E:54:95:B7:FB:F6:6B:E9:CC:FF:EC:74:89:F6` e adicionada ao cliente junto às raízes padrão. A validação TLS, de cadeia e de hostname permaneceu habilitada. Teste automatizado fiscal: 20/20; build aprovado; handshake separado retornou `tls-authorized=true`.

Publicação `v1.2.429-sefaz-icp-brasil`: commit `57c625fc`, site `/var/www/mdv-site/releases/20260923-000718-v12429-sefaz-icp-brasil`, API `mdv-api` reiniciada online e `/status` HTTP 200 com `mysql.ok=true`. Repetição pelo painel às 00:09:36 retornou **`107 — Serviço em Operação`**. Resultado: D07b aprovado. O teste comprova A1 real, autenticação mTLS, confiança da cadeia, transporte SOAP e consulta oficial de status; não comprova assinatura/transmissão/autorização de uma NF-e, que permanecem em F07/F08, nem o backup externo pendente em D07.

## E29 — Fonte canônica e separação entre dados gerais e fiscais (23/09/2026)

Problema: a mesma página apresentava o cadastro operacional e o fiscal em sequência, dando a impressão de dois cadastros independentes da empresa. A tabela `company_settings` já abastece PDV, recibos, documentos, garantias, integrações e outras funções; substituir essa fonte durante a migração criaria risco desnecessário nessas dependências.

Implementação: a página Dados da Empresa ganhou as áreas exclusivas **Dados gerais e operacionais** e **Fiscal e certificado**. Para a empresa principal, CNPJ, nomes, IE, CNAE, porte, telefone, e-mail, site, UF e endereço continuam vindo de `company_settings` e ficam bloqueados na área fiscal. O backend identifica essa origem como `company_settings` e sempre reaplica os valores canônicos ao salvar o perfil, impedindo sobrescrita por payload fiscal. Empresas adicionais usam `company_fiscal_profiles` como fonte própria. O aviso de vencimento abre diretamente `/admin/settings/company#fiscal`.

Auditoria somente leitura em produção, sem imprimir valores: os 10 campos compartilhados comparados entre `company_settings` e o perfil fiscal estavam coerentes depois de normalizar a máscara do CNPJ; nenhuma divergência foi encontrada. Permaneciam vazios no perfil fiscal Suframa, atividade principal, IE substituta, código IBGE do município e início da vigência. Eles não foram inferidos nem preenchidos. F01l continua aberto para conferência atual com o Bling e confirmação do responsável/contador.

Verificações: `npm.cmd run test:company-fiscal` passou 22/22, incluindo tentativa de sobrescrever pela API fiscal nome, CNPJ, razão social, IE, porte, telefone, e-mail, site, UF e endereço; `npm.cmd run build` passou. Publicação `v1.2.430-dados-empresa-fiscal`, commit `bb9736b3`, site `/var/www/mdv-site/releases/20260923-002939-v12430-dados-empresa-fiscal`; API reiniciada online com backup fiscal. `/status` retornou HTTP 200 e `mysql.ok=true`; página e `VERSION.json` retornaram 200. Na sessão administrativa real, a aba geral abriu por padrão e a fiscal abriu em `#fiscal` com os campos canônicos desabilitados, A1 instalado válido até 02/03/2027 e o último status SEFAZ-PE de homologação `107 — Serviço em Operação`. O retorno à aba geral também foi aprovado sem salvar ou alterar valores.

## E30 — Receita Federal como autoridade cadastral, sem confundir com SEFAZ (23/09/2026)

Correção solicitada pelo operador: razão social, nome fantasia, situação cadastral, abertura, porte, natureza jurídica, endereço e CNAEs pertencem ao cadastro CNPJ administrado pela Receita Federal. IE e sua situação pertencem à administração tributária estadual/SEFAZ; regime e CRT continuam configuração fiscal confirmada pelo responsável/contabilidade.

A implementação passou a salvar no `lookup_json` um retrato permitido dos campos devolvidos pelo provedor, junto de `authority=Receita Federal do Brasil`, provedor técnico, horário e indicador de consulta oficial direta. BrasilAPI e Minha Receita estão identificadas na tela como espelhos da base pública, sem se apresentarem como API oficial. A sugestão automática de regime foi removida: mesmo quando o retorno informa opção pelo Simples ou MEI, o sistema não altera regime nem CRT. QSA, documentos de sócios e campos não autorizados não são persistidos.

Verificações: `npm.cmd run test:company-fiscal` passou 24/24; `npm.cmd run build` passou; consulta real controlada do CNPJ da empresa retornou situação ativa, abertura, sete CNAEs e identidade cadastral pelo espelho Minha Receita, com `officialDirect=false` e `suggestedRegime=null`. O endereço veio ausente nessa resposta e permaneceu ausente no retrato, sem ser inventado. A API oficial em tempo real exige contratação e Consumer Key/Secret do SERPRO; F01p permanece pendente.

## E31 — Cliente da API oficial Consulta CNPJ do SERPRO preparado (23/09/2026)

O servidor agora prioriza a API Consulta CNPJ v2 do SERPRO quando `SERPRO_CNPJ_CONSUMER_KEY` e `SERPRO_CNPJ_CONSUMER_SECRET` estiverem configuradas juntas. O fluxo solicita token temporário via OAuth2 Client Credentials, mantém o token apenas em memória, consulta o endpoint oficial e registra `officialDirect=true`. Uma configuração com apenas uma chave é rejeitada; uma falha oficial preserva os dados anteriores e não é ocultada por consulta a espelho. Sem chaves, BrasilAPI e Minha Receita continuam como contingência explicitamente identificada.

Verificações: `npm.cmd run test:company-fiscal` passou 27/27, incluindo mapeamento da resposta v2, prioridade do SERPRO, sigilo do segredo no cabeçalho codificado e bloqueio de configuração parcial; `npm.cmd run build` passou. A consulta real oficial permanece pendente porque ainda não há contrato nem chaves de produção do SERPRO no cofre da VPS. Nenhuma credencial de exemplo foi publicada.

## E32 — Ambiente fiscal isolado e restauração do backup (23/09/2026)

Estado anterior: a integração fiscal já criava um MySQL 8.4 descartável no Docker Desktop, aplicava a migration duas vezes e usava duas empresas fictícias para testar isolamento, persistência, concorrência, rollback, certificado simulado e navegador. Ainda não havia evidência de que um backup desse ambiente podia ser restaurado sem perda.

Alteração: o teste canônico ganhou um ciclo real de `mysqldump` com transação consistente e sem bloqueio de tabelas, cálculo SHA-256 do conteúdo, criação de um segundo banco no mesmo contêiner e restauração pelo cliente MySQL. Depois da restauração, compara integralmente `company_settings`, `company_fiscal_profiles`, `company_fiscal_events` e `company_certificate_settings`, incluindo binários e datas normalizados. Uma alteração posterior na origem confirma que o banco restaurado permanece isolado. O script não lê `.env`, não usa certificado real e não acessa VPS ou banco externo.

Critério de aprovação: `npm.cmd run test:company-fiscal:sandbox` deve criar o contêiner local, aplicar migration/fixtures, provar rollback e concorrência, gerar e restaurar o backup, comparar os quatro conjuntos de dados e remover o contêiner ao final, inclusive em caso de falha. D10 só permanece aprovado enquanto esse teste passar.

## E33 — Consulta cadastral canônica nas duas áreas (23/09/2026)

Estado anterior observado em produção: a área fiscal consultava o backend centralizado e mostrava a fonte técnica, enquanto Dados gerais chamava a BrasilAPI diretamente no navegador. A duplicação permitia respostas e CNAEs diferentes na mesma página; na conferência realizada, o cadastro canônico ainda mostrava como principal um CNAE que a consulta fiscal retornou como secundário. Nenhum valor de produção foi salvo durante essa constatação.

Alteração: criado `GET /admin/cnpj-lookup/:cnpj`, autenticado, limitado e sem gravação. A rota reutiliza exatamente `lookupCnpj`, incluindo prioridade opcional do SERPRO, contingência identificada, normalização e bloqueios já testados. A área geral passou a consumir esse endpoint pelo `companyFiscalService`, preencher somente os campos cadastrais retornados e mostrar Receita Federal, provedor técnico e indicador de consulta direta. A chamada direta do navegador à BrasilAPI foi removida. Regime, CRT, IE e vigência não são inferidos.

Verificações locais: `npm.cmd run test:company-fiscal` passou 28/28, incluindo autenticação, ausência de escrita e retorno de CNAE principal/secundários pela rota comum; `npm.cmd run build` passou; `node --check services/companyFiscalServer.cjs` e `git diff --check` passaram. A contratação do SERPRO foi reclassificada como melhoria opcional porque não é requisito de emissão.

Publicação e validação operacional: versão `v1.2.434-cnpj-canonico`, commit `86ba04af`, site `/var/www/mdv-site/releases/20260923-121443-v12434-cnpj-canonico`; página e `/status` responderam HTTP 200 com `mysql.ok=true`, e a nova rota sem sessão respondeu 401. Na sessão administrativa, as duas áreas exibiram Receita Federal, provedor Minha Receita e consulta direta oficial `Não`. A consulta corrigiu a razão social para `HANDIELSON AMORIM BONFIM` e o CNAE principal para `4752100`, preservados após recarga.

Reconciliação F01l: foram salvos os sete CNAEs retornados, município IBGE `2611101`, descrição oficial da atividade principal, quatro segmentos, faturamento acima de R$ 360 mil, até cinco funcionários, contato e celular conferidos no Bling. Suframa e IE substituta ficaram vazios porque o Bling também os apresentava vazios. Regime Simples Nacional e CRT 1 já estavam configurados; a vigência `2019-08-30` foi registrada com observação da origem na data de opção pelo Simples retornada pela consulta cadastral. Tudo foi confirmado após recarga. A pré-validação passou a informar cadastro completo e município confirmado; a consulta mTLS à SEFAZ-PE homologação respondeu novamente `107 — Serviço em Operação` às 10:20:31. F01l e F01q foram concluídos; D06 ainda exige confirmação contábil das operações/regras tributárias antes de emitir.

## E34 — IE, credenciamentos DF-e e CSC no e-Fisco PE (23/09/2026)

Ambiente e procedimento: sessão autenticada no e-Fisco PE em produção com o certificado já instalado no Windows. A função somente leitura `Credenciamentos de DF-e do Contribuinte` foi filtrada pela IE da empresa e consultada separadamente para os tipos 38, 39, 83 e 84. Depois, `Código de Segurança do Contribuinte` foi filtrado pela raiz do CNPJ e situação ativa. Nenhuma solicitação, inclusão, cancelamento ou confirmação foi executada.

Resultado: a inscrição estadual foi reconhecida com razão social canônica e situação cadastral `Ativo`. NF-e homologação (38), NF-e produção (39), NFC-e homologação (83) e NFC-e produção (84) retornaram `Credenciado: Sim` e `Suspenso: Não`. A consulta de CSC retornou um token ativo em produção e um token ativo em homologação, ambos incluídos em 18/10/2023. Somente identificador, ambiente, situação e data foram conferidos; o conteúdo dos CSCs não foi lido, copiado, impresso em logs ou versionado.

Referência oficial vigente consultada: as páginas da SEFAZ-PE de credenciamento NF-e e NFC-e confirmam os tipos 38/39 e 83/84 e exigem CSC separado por ambiente para NFC-e. Resultado: D08 e F01 aprovados. D06 permanece aberto para o contador confirmar as regras das operações; D07 continua com o backup externo adiado pelo operador. O escopo de D09 foi fechado em E35.

## E35 — Escopo operacional inicial e classificação do Bling (23/09/2026)

Entradas usadas: pedido expresso do operador para suportar novas empresas e testar o ciclo completo com estoque, Shopee, nota, etiqueta e comprovante; módulos existentes de PDV, loja própria, Shopee, Mercado Livre e TikTok; histórico autorizado de NF-e modelo 55 e NFC-e modelo 65; credenciamentos oficiais confirmados em E34; inventário funcional do Bling de E04.

Decisão registrada em `escopo-operacional-inicial.md`: Mercado do Vale é a empresa do primeiro corte, mantendo seleção explícita e isolamento para futuras empresas. NF-e e NFC-e são necessárias; PDV, site e Shopee formam o primeiro ciclo; Mercado Livre e TikTok ficam para depois da aprovação da Shopee. Foram listados os casos obrigatórios de venda, cancelamento, devolução, inutilização, rejeição, timeout e contingência. CT-e, MDF-e, BP-e, NFCom, produção e serviços financeiros do Bling ficaram fora do primeiro corte; NFS-e permanece separado por ser municipal.

Resultado: D09 aprovado como definição de escopo. O documento não escolhe CFOP, CST/CSOSN, alíquotas ou benefícios; essas regras continuam bloqueadas por D06 e serão validadas com o contador antes de emitir.

## E36 — Pacote objetivo para validação contábil de D06

Data: 23/09/2026. Ambiente: documentação versionada; consulta histórica somente leitura já registrada em E03; nenhuma emissão, alteração tributária ou gravação no Bling/SEFAZ.

Estado anterior: D06 pedia confirmação contábil de forma genérica. O cadastro já continha Simples Nacional, CRT 1 e vigência baseada na data de opção, enquanto o e-Fisco comprovava IE e credenciamentos ativos. O escopo D09 já definia os canais e operações, mas ainda não havia um artefato único para o contador aprovar cada regra.

Alteração: criado `validacao-contabil-operacoes.md` com dados do emitente a confirmar, dez cenários operacionais, matriz de modelo/CFOP/CSOSN-CST/tributos/benefícios/vigência, exceções por produto e critério de aceite. Os quatro registros de natureza de operação observados no Bling e os XMLs autorizados são tratados somente como referências históricas; nenhum código foi ativado por inferência.

Verificação: links locais e estrutura obrigatória conferidos; `git diff --check` aprovado. D06 permanece aberto e atribuído ao contador até o preenchimento identificado e datado. D07 continua aberto somente para a segunda cópia segura e ensaio de recuperação, adiado pelo operador.
