# Validação contábil das operações fiscais

Pacote preparado em 23/09/2026 para concluir o item D06 antes da implementação do motor fiscal. O preenchimento deve ser feito pelo contador responsável pela empresa. Códigos encontrados no Bling ou em XMLs antigos são referências de comparação e não serão ativados automaticamente.

## Emitente conferido

| Campo | Valor cadastrado | Origem da conferência | Confirmação do contador |
|---|---|---|---|
| Empresa | Handielson Amorim Bonfim — Mercado do Vale | Cadastro canônico e consulta cadastral | Pendente |
| CNPJ | `34.719.515/0001-68` | Cadastro canônico, certificado A1 e e-Fisco | Pendente |
| UF/município | PE — Petrolina, IBGE `2611101` | Cadastro canônico e IBGE | Pendente |
| Regime | Simples Nacional | Perfil fiscal; Bling como referência | Pendente |
| CRT | `1` | Perfil fiscal e XMLs históricos | Pendente |
| Início da vigência cadastrado | `30/08/2019` | Data de opção pelo Simples retornada na consulta cadastral | Pendente: confirmar se vale para a configuração fiscal atual |
| Inscrição estadual | Ativa | Consulta autenticada no e-Fisco PE | Pendente |
| Credenciamento | NF-e e NFC-e, homologação e produção, sem suspensão | Consulta autenticada no e-Fisco PE | Pendente |

Os sete CNAEs e suas descrições já estão no perfil fiscal. CNAE não determina sozinho a tributação de uma venda.

## Decisões gerais que o contador deve registrar

1. Confirmar o regime, CRT e a data a partir da qual as regras aprovadas valem.
2. Informar se a empresa usa regime de caixa ou competência no Simples e se isso afeta apenas apuração ou algum dado emitido.
3. Confirmar o tratamento de ICMS por operação, incluindo antecipação, substituição tributária, DIFAL, FCP, desoneração e benefícios quando aplicáveis.
4. Confirmar regras de IPI, PIS e COFINS por operação/produto, inclusive valores zerados, não incidência, isenção ou suspensão.
5. Definir quando CEST é obrigatório e quais produtos exigem revisão de NCM, origem, GTIN e unidade comercial/tributável.
6. Confirmar se há código de benefício fiscal, informações adicionais obrigatórias, responsáveis técnicos ou observações legais por cenário.
7. Definir o tratamento de frete, seguro, desconto, outras despesas e rateio nos itens.
8. Informar regras para devolução, cancelamento, inutilização, nota complementar, ajuste e carta de correção.
9. Confirmar quais operações exigem NF-e modelo 55 e quais admitem NFC-e modelo 65.
10. Informar qualquer exceção por destinatário contribuinte, consumidor final, órgão público, revenda, uso/consumo ou ativo imobilizado.

## Matriz por operação

Preencher uma linha para cada combinação que tenha regra diferente. Se uma operação não existir na empresa, marcar **não utilizada** e justificar.

| ID | Cenário | Modelo | UF destino | Destinatário | Finalidade | CFOP | CSOSN/CST ICMS | ICMS/ST/FCP/DIFAL | CST PIS/COFINS | IPI | Benefício/observações | Vigência | Aprovado por/data |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OP01 | Venda presencial interna no PDV | 65 ou 55 | PE | Consumidor final não contribuinte | Normal | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |
| OP02 | Site próprio com entrega em PE | 55 ou 65 | PE | Consumidor final não contribuinte | Normal | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |
| OP03 | Shopee com entrega em PE | 55 | PE | Consumidor final não contribuinte | Normal | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |
| OP04 | E-commerce interestadual | 55 | Outra UF | Consumidor final não contribuinte | Normal | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |
| OP05 | Venda para pessoa jurídica contribuinte | 55 | PE/outra UF | Contribuinte de ICMS | Normal | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |
| OP06 | Venda para pessoa jurídica não contribuinte | 55 | PE/outra UF | Não contribuinte | Normal | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |
| OP07 | Devolução de venda | 55 | Conforme documento original | Conforme documento original | Devolução | Pendente | Pendente | Pendente | Pendente | Pendente | Referenciar documento original | Pendente | Pendente |
| OP08 | Entrada por devolução de cliente | 55 | Conforme documento original | Conforme documento original | Devolução/entrada | Pendente | Pendente | Pendente | Pendente | Pendente | Referenciar documento original | Pendente | Pendente |
| OP09 | Cancelamento dentro do prazo | Evento | — | — | Cancelamento | — | — | — | — | — | Prazo, justificativa e efeitos contábeis | Pendente | Pendente |
| OP10 | Inutilização de numeração | Evento | — | — | Inutilização | — | — | — | — | — | Faixa, justificativa e prazo | Pendente | Pendente |

## Regras por produto

O contador deve devolver também uma relação de exceções por produto ou grupo. Cada regra precisa informar NCM, CEST quando aplicável, origem, unidade, enquadramento, tributos e vigência. O sistema não copiará a tributação da nota de compra para a saída e não aplicará uma alíquota geral apenas pelo CNAE.

| Grupo/produto | NCM | CEST | Origem | Unidade comercial/tributável | Regra/tributos | Operações abrangidas | Vigência | Aprovado por/data |
|---|---|---|---|---|---|---|---|---|
| Celulares e smartphones | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |
| Acessórios e periféricos | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |
| Demais mercadorias | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |

## Referências históricas a confrontar

- A conta do Bling apresentou quatro naturezas ativas: **COMPRA** (padrão compra), **Devolução de produto** (padrão devolução de entrada), **Simples remessa** e **VENDA** (padrão venda).
- XMLs históricos autorizados confirmam uso de NF-e modelo 55, NFC-e modelo 65, série 1 e CRT 1. Eles não determinam a próxima numeração nem as regras atuais.
- O escopo operacional aprovado está em `escopo-operacional-inicial.md`.

### Configuração observada na natureza VENDA do Bling

Consulta somente leitura realizada em 23/09/2026. Estes valores são uma fotografia da configuração do Bling e continuam pendentes de confirmação contábil. Eles não foram ativados no motor fiscal próprio.

| Campo/regra | Valor observado no Bling | Situação na migração |
|---|---|---|
| Série | `1` | Referência; numeração será tratada separadamente em F05 |
| Tipo | Saída | Pendente de confirmação |
| CRT | `1` — Simples Nacional | Pendente de confirmação em D06 |
| Indicador de presença | `1` — Operação presencial | Aplicável ao PDV; não deve ser copiado para e-commerce |
| Faturada / consumidor final / devolução | Sim / Sim / Não | Pendente de confirmação por cenário |
| ICMS para PE | CFOP `5102`, CSOSN `400`, alíquota `0%`, base `0%` | Referência para OP01–OP03; contador deve confirmar abrangência e exceções |
| ICMS para demais destinos | CFOP `6108`, CSOSN `400`, alíquota `0%`, base `0%` | Referência para OP04–OP06; contador deve confirmar consumidor/contribuinte, DIFAL, FCP e ST |
| IPI | CST `53` — saída não tributada, alíquota `0%`, base `100%` | Pendente de confirmação por produto/operação |
| PIS | CST `07` — operação isenta, alíquota `0%`, base `100%` | Pendente de confirmação |
| COFINS | CST `07` — operação isenta, alíquota `0%`, base `100%` | Pendente de confirmação |

A natureza VENDA usa uma regra geral para qualquer produto nas abas observadas. Isso não comprova que celulares, acessórios e outros grupos tenham o mesmo tratamento correto. O contador deve indicar exceções por NCM, CEST, origem, destino e tipo de destinatário.

## Critério de aceite de D06

D06 somente será aprovado quando esta matriz tiver responsável e data, regime/CRT/vigência confirmados e todas as operações utilizadas tiverem modelo, CFOP, códigos tributários, exceções e vigência definidos. Depois disso, as regras serão cadastradas de forma versionada, testadas com valores sintéticos e comparadas com casos reais em homologação antes de qualquer emissão em produção.
