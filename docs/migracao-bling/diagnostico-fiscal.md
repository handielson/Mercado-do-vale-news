# Diagnóstico fiscal — 2026-09-22

Decisão do operador: emissão própria integrada diretamente à SEFAZ, sem provedor fiscal Bling. A migração começa pelo fiscal. Progresso e critérios no [checklist principal](../../CHECKLIST-MIGRACAO-BLING.md).

## Dados conferidos por consultas somente leitura

| Informação | Evidência | Consequência |
|---|---|---|
| Nome, razão social, CNPJ, IE, CNAE e endereço | Campos preenchidos no GET autenticado `/company-settings` | Reutilizar cadastro e serviço existentes; não criar outra identidade da empresa |
| Localidade | Petrolina, PE no cadastro | Consultar regras/autorizadores de PE após confirmar modelo e operação |
| Identidade no Bling | GET `/empresas/me/dados-basicos`, HTTP 200; CNPJ igual ao local | A conta consultada corresponde ao cadastro local |
| Naturezas de operação | Listagem HTTP 200 com quatro registros na primeira página, limite 100 | Há configurações para analisar; listagem não exporta o motor completo |
| NF-e autorizada | Amostra de setembro/2026, série 1; situação 5, XML com cStat 100 | Evidência histórica de emissão modelo 55; não define próxima numeração |
| NFC-e autorizada | Amostra de junho/2026, série 1; situação 5, XML com cStat 100 | Evidência histórica de emissão modelo 65; não define sua aplicabilidade futura |
| Emitente nos dois XMLs | CNPJ e IE coincidem com cadastro; UF PE, cMun 2611101, CRT 1 | Base histórica para conferência; confirmar regime e vigência atuais |
| Tela Dados da empresa do Bling (captura fornecida em 22/09/2026) | Exibe Simples Nacional e inscrição municipal para a empresa principal | Evidência do preenchimento na interface naquele momento; não demonstra vigência fiscal nem substitui confirmação contábil; valor não foi copiado para o sistema |
| Cadastro fiscal operacional | Nenhum campo de CRT/regime, certificado, CSC ou código IBGE encontrado na resposta de configurações | Criar extensão fiscal após inspecionar schema/migrations; ausência aqui não prova inexistência em toda infraestrutura |

Não foram gravados tokens, dados pessoais dos destinatários, chaves de notas, XMLs reais ou números completos de documentos neste diagnóstico. Os XMLs foram lidos em memória para comparar o emitente e verificar campos; não houve validação criptográfica nem nova consulta de autenticidade à SEFAZ nesta etapa.

O endpoint de dados básicos do Bling retornou somente identificação/nome/CNPJ/email/data de contrato; não retornou certificado, CSC ou regime. A captura da interface complementa esse endpoint, mas não comprova situação vigente na SEFAZ ou Receita. Não assumir que segredos/configurações sejam exportáveis pela API. Porte “MICRO EMPRESA” não substitui CRT/regime.

## Reaproveitamento confirmado no código

| Fonte existente | Reutilização | Limite observado |
|---|---|---|
| `types/company.ts`, `services/companyService.ts`, `pages/admin/settings/CompanyDataPage.tsx` | Empresa/endereço/CNPJ/IE/CNAE | Falta perfil fiscal operacional nos contratos inspecionados |
| `types/product.ts`, `schemas/product.ts`, `services/products.ts` | NCM, CEST e cadastro comercial | Presença do campo não prova preenchimento nem tributação correta |
| `services/blingService.ts` | Importação/vínculo e informações tributárias de produtos | É integração com Bling, não motor fiscal próprio |
| `services/blingNfService.ts`, `pages/admin/accounting/AccountingPage.tsx` | Consulta/relatório de notas | Dependência do Bling, cache no navegador, divergência de situação |
| `vps_server.cjs`, rotas `resource=nfe/nfce/nf-detail` | Transporte existente para histórico | Consulta o Bling; não constitui emissão direta |
| `services/saleService.ts`, `services/stockLocationService.ts` | Venda, depósito, reserva, baixa e reversão | Fiscal novo não deve repetir esses efeitos |
| `services/blingFinanceService.ts` | Contrato atual da tela financeira | Movimentações dependem do Bling |

## Achados antes de migrar

1. **Situação fiscal divergente:** `blingNfService.ts` documenta 2 como emitida e consulta `situacao=2`. O OpenAPI consultado enumera 2 como cancelada e 5 como autorizada; a amostra real autorizada retornou 5. Abrir correção F03 com teste de comportamento, sem alterar neste diagnóstico. O filtro ausente também não garante inclusão de canceladas.
2. **Consulta incompleta pode parecer sucesso:** `fetchAllPages` interrompe em resposta não OK e pode devolver acumulado parcial para cache. Testar falha na segunda página e evitar marcar intervalo completo sem prova.
3. **Teste legado falha:** o teste estático fiscal espera URL `www.bling.com.br`, enquanto a rota inspecionada usa `api.bling.com.br`. Revisar contrato/teste antes de concluir defeito em produção. A falha é anterior a este trabalho documental.
4. **Documentação antiga:** `bling.md` ainda menciona caminhos Supabase; confrontar com runtime atual, não reproduzir arquitetura antiga.

## Arquitetura proposta (ainda não implementada)

Estender o cadastro canônico com perfil fiscal versionado por estabelecimento e ambiente; referenciar certificado em armazenamento seguro, sem colocá-lo na resposta pública. Reutilizar dados de venda/produto, mas congelar os valores e campos fiscais no documento enviado para preservar o histórico.

Separar validação, cálculo tributário determinístico, geração/validação XSD, assinatura, transporte para o autorizador, tratamento de retornos/eventos, armazenamento e impressão. Bibliotecas auxiliares são possíveis, desde que avaliadas por manutenção, licença, cobertura atual e testes; a comunicação fiscal final deve ser direta com a SEFAZ. Nenhuma biblioteca foi selecionada nesta etapa.

Controlar estados: rascunho, validado, pendente de envio, enviado/resultado incerto, autorizado, rejeitado e cancelado, com eventos próprios. Timeout não autoriza criar nova nota: reconciliar resultado/chave antes de outra transmissão. Numeração exige controle concorrente; não excluir nota autorizada como se fosse rascunho.

Definir transações locais e fila durável para comunicação externa. Autorização fiscal não é nova baixa de estoque nem novo recebimento. Logística/etiqueta e comprovante são consumidores distintos do mesmo pedido.

## Fontes fiscais e verificações pendentes

- [NF-e: credenciamento PE](https://www.sefaz.pe.gov.br/Servicos/nota-fiscal-eletronica/Paginas/credenciamento-de-contribuintes.aspx): verificar situação nos dois ambientes; a página atual descreve solicitação e testes de homologação.
- [NFC-e: credenciamento e CSC PE](https://www.sefaz.pe.gov.br/Servicos/Nota-Fiscal-de-Consumidor-Eletronica/Paginas/Credenciamento-de-Contribuintes.aspx): conferir credenciamento e CSC por ambiente. A página atual possui orientação excepcional que difere de manuais antigos; não aplicar PDF antigo automaticamente.
- [Portal NF-e: notas técnicas](https://www.nfe.fazenda.gov.br/pOrtaL/listaConteudo.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=04BIflQt1aY%3D): fixar versão, vigência e hash dos documentos/esquemas efetivamente adotados; conferir RTC, eventos e mudanças de modelos/operações. O índice foi consultado, mas os manuais completos ainda não foram analisados.
- [Referência Bling](https://developer.bling.com.br/referencia): serve para extração/comparação histórica, não para definir obrigações fiscais da nova emissão.

Próximos dados necessários: acesso operacional ao certificado original e sua senha por meio seguro; regime vigente confirmado; credenciamento; CSC quando aplicável; série/numeração de corte por modelo; operações representativas. Não pedir reenvio de dados cadastrais já conferidos. Não afirmar que certificado instalado no Bling pode ser baixado de lá.
