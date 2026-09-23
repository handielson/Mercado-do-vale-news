# Funções do Bling e plano de reaproveitamento

Levantamento de 2026-09-22. Fontes: [referência oficial](https://developer.bling.com.br/referencia) e [central de ajuda](https://ajuda.bling.com.br/hc/pt-br). Foram enumeradas **todas as operações do OpenAPI obtido** e **todas as categorias/seções retornadas pelo índice público**, sem copiar os manuais. Isso não prova cobertura de toda função privada, módulo contratado ou artigo da plataforma.

- [catalogo-api.json](catalogo-api.json): 165 caminhos declarados (164 com operações e `/` vazio), 263 operações, 49 grupos; método, caminho, grupo e depreciação, com origem e hash do schema.
- [catalogo-ajuda.json](catalogo-ajuda.json): 23 categorias e 348 seções, com URLs e hierarquia. Inclui suporte, parceiros e histórico; uma seção não equivale a uma função operacional ativa.
- Atualização reproduzível: `node scripts/inspect-bling-catalog.cjs`, na raiz do projeto. O script só lê documentação pública e regrava estes dois índices locais após validar a coleta.

## Famílias funcionais

| Área | Funções identificadas no catálogo público | Mercado do Vale / decisão |
|---|---|---|
| Cadastros | Produtos, variantes, composições, categorias, grupos, fornecedores, contatos, vendedores, funcionários, listas de preços e campos personalizados | Há produtos, modelos, variantes, clientes, equipe e campos. Auditar equivalência antes de ampliar |
| Estoque | Depósitos, saldos, lançamentos, conferência, recebimento, lotes e movimentos por lote | Há locais, reservas e unidades serializadas. Assumir autoridade e testar concorrência |
| Compras | Pedidos, situações, entrada/estorno de estoque e contas, ligação com notas de entrada | Fila/cotações/fornecedores existentes; completar ciclo de recebimento e custo |
| Produção | Ordens, componentes e geração sob demanda | Uso pela loja não confirmado; classificar aplicabilidade |
| Vendas | Pedidos, propostas, PDV, caixa, checkout, meios de pagamento/POS, geração de nota e efeitos em contas/estoque | Fluxos locais existentes; testar ciclo completo e separar efeitos fiscais |
| NF-e/NFC-e | Cadastro, envio, consulta, documentos, contas/estoque; ajuda inclui eventos, devoluções, complementos, inutilização e certificados | Primeira prioridade: SEFAZ direta. Presença no painel não implica endpoint público equivalente |
| Tributação | Naturezas, consulta tributária, configurações de operação, RTC e eventos | Usar dados históricos para comparação; regras determinísticas próprias validadas |
| Obrigações/contabilidade | SPED, Sintegra, GNRE e espaço do contador | Confirmar necessidade e responsabilidade do contador; catálogo não comprova obrigação atual |
| Serviços | Ordens de serviço, contratos, NFS-e e orientações sobre CT-e | Não misturar NFS-e com NF-e/SEFAZ; escopo a confirmar |
| Financeiro | Pagar/receber, parcelas/baixas, borderôs, contas, categorias financeiras, caixa/bancos, boletos, conciliação e relatórios | Tela de pagar/receber depende do Bling; existem caixa, crediário e taxas no projeto |
| Serviços financeiros | Conta digital, Pix, link de pagamento, empréstimo | Mapear uso; substituição exige banco/provedor próprio, não reprodução da instituição financeira |
| Marketplaces | Canais, produtos por loja, anúncios/categorias, publicar/pausar e integrações por plataforma | Shopee e outros canais presentes; conferir dependência real por pedido, estoque e fiscal |
| Logística | Transportadoras/serviços, objetos, remessas, etiquetas, Bling Envios e rastreio | Usar canal/transportadora independente do Bling; validar etiqueta e vínculo fiscal |
| Loja virtual | Catálogo, loja e conexão multicanal | Catálogo/checkout locais existentes; mapear lacunas usadas |
| Multiempresa | Organização de contas/estabelecimentos e operações compartilhadas | Empresa precisa ser explícita; não concluir suporte completo pela existência de company_id |
| Sistema | Usuários, segurança, armazenamento, relatórios, situações/transições, notificações e documentos compartilhados | Reutilizar autenticação, permissões, backup e documentos, verificando cobertura |
| Análise/IA | Dashboard Meu Negócio, assistente e automações | Há dashboard/bot; funcionalidades específicas e necessidade a confirmar |
| Apoio/comercial | Implantação, treinamento, suporte, planos, parceiros e atualizações | Itens do índice, não módulos a reproduzir no ERP |

O inventário registra capacidade documentada, não paridade já implementada. Para cada função necessária, preencher: uso real, fonte atual, serviço existente, lacuna, dono da escrita, teste e critério de retirada do Bling no [checklist](../../CHECKLIST-MIGRACAO-BLING.md).

## Cuidados ao usar o catálogo

O grupo de homologação da API Bling é teste de integração do Bling, não o ambiente de homologação fiscal da SEFAZ. Cancelamento de pedido, exclusão de rascunho e cancelamento fiscal são ações distintas. Não usar operações POST/DELETE do inventário para explorar uma conta.

O catálogo API lista contratos de recursos, não o código proprietário nem fórmulas internas. Os 49 grupos vêm das operações, pois há grupos usados nos endpoints que não constam da lista global de tags. A coleta valida paginação e duplicidades, mas não executa os 263 endpoints.
