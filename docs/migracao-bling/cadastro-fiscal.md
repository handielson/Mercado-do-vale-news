# Cadastro fiscal por empresa

Estado em 22/09/2026: implementado e testado localmente, incluindo migration em MySQL 8.4 real descartável e fluxo integrado navegador → API → banco → consulta pública. Migration não aplicada em produção e recurso não publicado. F01 continua parcial: não há emissão SEFAZ nesta entrega.

## Uso

Em Dados da Empresa, a seção Empresas e regime tributário permite selecionar o cadastro fiscal em edição, adicionar outros CNPJs, escolher regime, CRT, município IBGE e vigência. Salvar cadastro fiscal é uma ação separada do salvamento dos dados principais da loja.

Regimes disponíveis: não definido, Simples Nacional, MEI, Lucro Presumido, Lucro Real, Lucro Arbitrado, imune, isenta e outro. O cadastro aceita configuração incompleta; isto não autoriza emissão. Cada empresa adicional pode registrar CEP, cidade, logradouro, número, bairro e complemento; a loja principal exibe o endereço do cadastro geral. O botão Verificar dados para emissão lê o perfil salvo da empresa selecionada e mostra lacunas de identidade, endereço e perfil com vigência. Compara os dois primeiros dígitos do código municipal com a UF e consulta [a API oficial de localidades do IBGE](https://servicodados.ibge.gov.br/api/docs/localidades) para conferir código, nome da cidade e UF. Se essa consulta falhar, o município permanece pendente; nenhum campo é alterado automaticamente. Para PE, o cálculo dos dois dígitos da IE segue [a regra publicada pela SEFAZ-PE](https://www.sefaz.pe.gov.br/Servicos/Sintegra/Paginas/calculo-do-digito-verificador.aspx), considerando nove dígitos; outras UFs permanecem pendentes até receberem suas regras oficiais. Dígito válido não comprova cadastro estadual ativo. Ainda faltam situação cadastral da IE, regras por operação, certificado e ligação ao emissor.

Atualizar dados tributários consulta fontes públicas, registra fonte/data e oferece sugestão explicitamente aplicável. Nunca substitui regime, CRT, vigência ou identificação manualmente definidos. A sugestão de regime não seleciona automaticamente o CRT. Não ser optante pelo Simples não determina Lucro Real ou Presumido. Consulta repetida em menos de 60 segundos reutiliza o resultado salvo.

## Estrutura e limites

A inscrição municipal é opcional e separada por empresa no perfil fiscal, inclusive para a loja principal. A captura fornecida da interface do Bling não preenche o valor automaticamente nem estabelece sua validade cadastral. A migration 020 permanece sem aplicação operacional.

O perfil inclui também Suframa, atividade principal, segmentos, faixa de faturamento do ano anterior, faixa de funcionários, contato, celular, e-mail de cobrança e inscrições estaduais substitutas por UF. Para a loja principal, CNAE, porte, telefone, e-mail e site continuam vindo do cadastro canônico `company_settings`; para empresas adicionais, ficam no respectivo perfil fiscal. Esses campos cadastrais não entram automaticamente na pré-validação de emissão. Os valores da captura do Bling não foram importados; exigem conferência antes de preencher o ambiente operacional. A IE substituta ainda exige verificação estadual própria antes de ser usada em documento fiscal.

A opção **Isento de inscrição estadual** é separada do regime tributário e bloqueia o preenchimento simultâneo de número de IE. A seleção é armazenada por empresa no perfil fiscal; para a loja principal, o número continua vindo de `company_settings`. Mesmo marcada, a pré-validação permanece pendente até confirmação cadastral/contábil de que a isenção se aplica ao emitente e ao modelo fiscal. Os segmentos Comércio, E-commerce, Indústria e Serviços são escolhas manuais, não inferidas do CNAE.

A consulta pública de CNPJ mostra CNAE principal e todos os secundários fornecidos pela fonte, com código e descrição. O botão **Usar todos os CNAEs consultados** grava essa lista no perfil da empresa selecionada; na principal, um CNAE principal divergente do cadastro canônico exige revisão antes de aplicar. A busca de CNPJ no cadastro operacional também mostra a lista consultada para conferência, mas sua gravação integral ocorre no cadastro fiscal. A descrição é um resumo da atividade; as [notas explicativas da Concla/IBGE](https://concla.ibge.gov.br/busca-online-cnae.html) detalham seu alcance e não substituem análise tributária.

A loja atual continua sendo o registro único de company_settings, inclusive para seu endereço. A tabela companies não estava disponível no ambiente inspecionado. company_fiscal_profiles guarda novos cadastros fiscais com endereço próprio e um vínculo único com a loja principal; company_fiscal_events mantém histórico de gravações e consultas. O seletor não altera a empresa operacional global, estoque ou vendas. O vínculo de emitente por venda é etapa posterior.

As rotas /admin/fiscal-companies exigem sessão bearer de administrador. Gravações usam transação, CNPJ único e versão para rejeitar alterações obsoletas. Trocar um CNPJ salvo exige outro cadastro. Mudança externa do CNPJ principal bloqueia o vínculo antigo para revisão.

O cliente da API oficial Consulta CNPJ v2 do SERPRO está implementado com OAuth2 Client Credentials, token temporário em memória e segredos lidos somente das variáveis `SERPRO_CNPJ_CONSUMER_KEY` e `SERPRO_CNPJ_CONSUMER_SECRET` do servidor. Quando as duas credenciais estiverem ativas, essa consulta direta tem prioridade e falhas não são mascaradas pelos espelhos. Enquanto a contratação não for concluída, BrasilAPI e Minha Receita funcionam como contingência e aparecem explicitamente como espelhos da base pública do CNPJ administrada pela Receita Federal. O sistema registra separadamente a autoridade cadastral, o provedor técnico e se a consulta foi direta. O retrato salvo limita-se a campos cadastrais permitidos: razão social, nome fantasia, situação e data, abertura, porte, natureza jurídica, contato, endereço e CNAEs; QSA e outros campos do retorno bruto não são persistidos. Nenhum regime ou CRT é deduzido. Timestamp indica momento da consulta, não atualização da base. A conferência municipal consulta exclusivamente o código IBGE informado. Sem tarefa automática nesta entrega: os botões oferecem controle por empresa. O endpoint básico da empresa no Bling, inspecionado na descoberta, continha identificação e CNPJ, mas não trouxe IE; XML histórico do Bling permite comparação, não comprova a IE vigente nem valida seu dígito.

## Publicação futura

1. Conferir backup/restauração e executar migrations/020_company_fiscal_profiles.sql em MySQL de homologação; conferir índices, tipos e transações com duas sessões reais.
2. Publicar frontend e backend incluindo companyFiscalServer.cjs e companyFiscalCore.cjs. Ambos os entrypoints VPS registram as rotas.
3. Manter MDV_COMPANY_FISCAL_ENABLED desativado até as tabelas existirem; então definir 1 e reiniciar o processo backend.
4. Com administrador, salvar principal, atualizar consulta, cadastrar segunda empresa e alternar; comprovar persistência após recarregar, ausência de cruzamento e rejeição de sessão comum/versão antiga.
5. Na reversão, desativar a flag e preservar tabelas e auditoria. Não apagar dados fiscais como rollback padrão.

## Verificação reproduzível

- npm run test:company-fiscal: quinze testes de núcleo e rotas Fastify com banco simulado; não valida SQL em MySQL real.
- npm run test:company-fiscal:mysql: integração com MySQL 8.4 descartável no Docker Desktop local (contexto desktop-linux conferido). Cria dados fictícios, aplica a migration duas vezes e verifica persistência, unicidade, edição concorrente e rollback por falha da auditoria. Não lê .env; usa porta aleatória em 127.0.0.1 e remove seu próprio container ao terminar. Requer Docker em execução e acesso à imagem mysql:8.4. Aprovado em 22/09 após o usuário iniciar o engine; evidência E09. Autenticação e consulta externa são simuladas neste teste.
- npm run test:company-fiscal:browser: estende o teste MySQL e abre Chrome local com a tela real de cadastro. Usa as funções canônicas de token do backend, usuário administrador sintético, proxy HTTP local, consulta pública de CNPJ e recarregamento da página. Testa negação de acesso sem token, com usuário comum e token alterado; confirma Lucro Real/CRT 3 preservados. Aprovado em E10. Usa servidor de teste isolado, sem serviços operacionais da VPS.
- npm run build: compilação frontend.
- node tmp-tests/company-fiscal-ui-server.mjs: fixture isolada em http://127.0.0.1:4197, API em memória e variáveis .env desativadas. Testar atualização preservando Lucro Real/CRT 3; adicionar empresa B como MEI/CRT 4; voltar à A e conferir as escolhas. Encerrar com Ctrl+C. Não comprova persistência de banco nem layout final da página completa.

## Referências

- [Minha Receita — documentação](https://docs.minhareceita.org/)
- [BrasilAPI — contrato CNPJ](https://github.com/BrasilAPI/BrasilAPI/blob/main/pages/docs/doc/cnpj.json)
- [Portal oficial do Simples Nacional](https://www8.receita.fazenda.gov.br/SimplesNacional/)
- [Receita — dígitos verificadores do CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf)
