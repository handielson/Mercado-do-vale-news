# Escopo operacional inicial da substituição do Bling

Definição de 23/09/2026 para o primeiro corte fiscal. Este escopo organiza a ordem de implementação; regras tributárias, CFOP, CST/CSOSN e exceções continuam dependentes da validação contábil de D06.

## Empresas

| Classificação | Escopo |
|---|---|
| Necessário no primeiro corte | Mercado do Vale, CNPJ `34.719.515/0001-68`, como emitente principal |
| Necessário desde a arquitetura | Seleção explícita da empresa em cadastro fiscal, certificado, regime, série, numeração, CSC, documento, estoque e canal |
| Futuro | Novas empresas cadastradas pelo painel, cada uma com dados, credenciamentos e segredos próprios |

Nenhuma nova empresa herda automaticamente certificado, CSC, regime, numeração ou regra fiscal da empresa principal.

## Modelos e canais

| Classificação | Modelo/canal | Uso inicial |
|---|---|---|
| Necessário | NFC-e, modelo 65 | Venda presencial no PDV e venda interna a consumidor final quando a operação se enquadrar na NFC-e |
| Necessário | NF-e, modelo 55 | Pedidos expedidos, venda interestadual, destinatário que exija NF-e e operações que não se enquadrem na NFC-e |
| Necessário | PDV local | Venda, pagamento, baixa de estoque, documento fiscal e comprovante correlacionados pelo mesmo identificador |
| Necessário | Loja/site próprio | Pedido, pagamento, estoque, NF-e quando aplicável, etiqueta e comprovante |
| Necessário | Shopee | Importar pedido, reservar/baixar estoque, emitir NF-e, obter etiqueta, expedir e devolver status ao canal |
| Futuro | Mercado Livre e TikTok Shop | Conectar ao mesmo contrato multicanal depois do ciclo Shopee aprovado |
| Fora do primeiro corte | CT-e, MDF-e, BP-e e NFCom | A empresa não atua como emissora desses documentos no fluxo levantado |
| Separado | NFS-e | Serviço municipal; não faz parte da integração direta NF-e/NFC-e com a SEFAZ-PE |

A escolha entre modelo 55 e 65 será uma regra configurável por empresa, canal, UF do destinatário e tipo de operação. O canal sozinho não determina o modelo.

## Operações obrigatórias para homologação

1. Venda presencial interna a consumidor final.
2. Pedido do site com entrega dentro de Pernambuco.
3. Pedido Shopee com expedição dentro de Pernambuco.
4. Pedido de e-commerce interestadual.
5. Venda para pessoa jurídica ou contribuinte quando exigir NF-e.
6. Cancelamento dentro do prazo, sem duplicar estorno de estoque ou financeiro.
7. Devolução vinculada ao documento original.
8. Inutilização de faixa, com motivo e auditoria.
9. Rejeição corrigível e rejeição definitiva.
10. Timeout/resultado incerto, com consulta antes de qualquer reenvio.
11. Contingência aplicável ao modelo e ao autorizador.

## Classificação funcional do Bling

| Função | Decisão |
|---|---|
| Dados da empresa, produtos, clientes, pedidos, estoque e financeiro | Migrar/reutilizar os módulos canônicos do sistema próprio |
| NF-e/NFC-e, certificado, eventos, XML, DANFE e numeração | Substituir por motor fiscal próprio e SEFAZ direta |
| Shopee: pedidos, estoque, nota, etiqueta e expedição | Substituir no primeiro ciclo completo |
| Relatórios e histórico fiscal do Bling | Importar para consulta e auditoria; corrigir paginação e situação em F03 |
| Mercado Livre e TikTok Shop | Manter como integração futura depois da Shopee |
| Compras, contas a pagar/receber e conciliação | Migrar em marcos próprios depois do fiscal e do ciclo de venda |
| Produção, CT-e, MDF-e, BP-e, NFCom e serviços financeiros do Bling | Não aplicável ao primeiro corte; reavaliar somente se surgir uso real |

## Critério para retirar o Bling do ciclo inicial

O Bling só deixa o fluxo de venda escolhido quando o pedido percorrer, em homologação e depois em produção controlada, estoque, documento fiscal, armazenamento de XML/protocolo, DANFE, etiqueta, expedição, comprovante, cancelamento/devolução e reconciliação sem chamada operacional ao Bling. Falha parcial deve ser recuperável sem duplicar nota, baixa ou recebimento.
