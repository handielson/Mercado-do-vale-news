# Modelo disponível com configuração diferente

Situação: publicação autorizada em 15/10/2026, em andamento na versão v1.2.635-modelo-configuracao; sem envio de teste a clientes.

O atendimento final 6240 pediu Redmi Note 15 4G, 8GB/256GB. As execuções 42002 e 42032 receberam o catálogo contendo quatro unidades 6GB/128GB do mesmo modelo e zero unidades 8GB/256GB. A preparação interpretou 4G como RAM; o filtro de memória descartou as outras configurações antes da busca do modelo; a resposta negou o modelo inteiro e ofereceu outros. A segunda mensagem manteve os filtros anteriores. Os nós responsáveis são anteriores à publicação PayJoy 634 e ficaram inalterados naquela entrega.

A fonte da correção é `tmp-tests/n8n-sales-model-configuration.cjs`, transformação pura do fluxo ativo. Escopo de três nós existentes: Vendas - Preparar Busca, Vendas - Contexto Produtos e Vendas - Compor Resposta IA. Grafo, modelos, credenciais, pagamentos e demais nós preservados.

- 4G/5G são rede; 4GB/5GB e abreviações explicitamente ligadas a RAM continuam memória. A mesma interpretação de rede alimenta a identidade do modelo, a preparação e o estado da lista.
- O conjunto inicial inclui as configurações do modelo solicitado antes do filtro de memória. O catálogo ainda aplica estoque positivo, status ativo, visibilidade e demais filtros existentes. A configuração exata tem prioridade; se não estiver disponível, as outras configurações do mesmo modelo são oferecidas com aviso explícito. O título não atribui a memória solicitada ao produto alternativo.
- A identidade normalizada exige o mesmo modelo e preserva Pro/Plus/Ultra/S/C e rede explicitada; outro nome não vira configuração equivalente. Usa metadados do modelo quando presentes e o nome sem a cor cadastrada quando ausentes.
- Uma nova mensagem com modelo explícito e sem capacidades reavalia somente a memória herdada. Preserva rede e demais preferências. O compositor usa o catálogo confirmado nesse pedido, evitando prefixo gerado pela IA que negue um produto disponível.
- Oferecer outra configuração não cria reserva ou venda. Os passos de escolher item/cor e confirmar a compra continuam com o responsável existente e SKU, memória e preço coerentes.

O teste `tmp-tests/n8n-sales-model-configuration.test.cjs` executa a cadeia de contexto, parse, pós-lista, resolução, preparação da busca, confirmação simulada de preferências, catálogo, composição e divisão. Classificação e serviços externos são simulados; o código dos nós é real. O teste reproduz a falha no fluxo anterior e passa no candidato corrigido. A suíte também verifica identidades próximas, rede/memória, variantes sem metadados, estoque/visibilidade e seleção com aceite.

O gate inclui esses testes automaticamente para o marcador sales-model-configuration-v1 e exige candidato já corrigido. O publicador existente ganha `--model-configuration`; futura aplicação exige evidência nativa recente do hash exato com os oito cenários anteriores e os dois turnos da sequência. As outras correções de atendimento pendentes no diretório não entram neste candidato.

Validação local: 84 testes do gate aprovados, 13 grupos novos. Reexecução offline das duas mensagens e classificações capturadas, com o catálogo capturado, ofereceu somente Redmi Note 15 4G de 6GB/128GB nas duas respostas. Chamadas externas dessa reexecução foram simuladas; não houve envio ou alteração de controle do cliente. Dry-run remoto confirmou somente os três nós previstos e grafo preservado.

Candidato SHA-256 nodes/connections: 0099b60d7899b03cc400dcd0b3506550f93a58ae567a542a08f4b396b67d3a15. Evidências privadas de diagnóstico e reexecução ficam em .local, sem versionar histórico pessoal ou catálogo completo.


Testes com chamadas reais: oito cenários nativos anteriores e dois turnos de vendas aprovados no candidato exato, via Agent V3/Responses. Primeiro turno: RAM [8], armazenamento [256], rede 4g, aviso de configuração indisponível, somente os quatro SKUs 6/128 do mesmo modelo e nenhum rascunho. Segundo turno: capacidades herdadas vazias, rede 4g preservada, as mesmas opções disponíveis e nenhum rascunho. Fluxo isolado de código com classificação e especialista reais; estado, catálogo e preferências simulados, sem motor completo de workflow, memória externa ou Evolution/WhatsApp. Evidência privada .local/n8n-sales-model-configuration-native-evidence.json, testedAt 2026-10-15T14:53:51.088Z. Novo dry-run remoto confirmou o mesmo hash, somente três nós e 84 testes aprovados.

A identidade mantém a família/marca quando a preparação extrai apenas o código alfanumérico (C71, A15, M6 Pro), sem confundir Pro/Plus como o mesmo aparelho. O acknowledgment offline de preferências usa a função real extractCatalogPreferences com o corpo message/remoteJid do endpoint; testa a memória mínima persistida sem atribuir esses campos à preparação.

O executor nativo foi corrigido: substituições de payload usam callbacks literais para não expandir $&, $` ou $' dentro do JavaScript dos nós; o script gerado é compilado localmente antes do SSH e executado como CommonJS explícito. A substituição antiga corrompia o script e acionava falhas antes dos testes no Node 26.7.0. Diagnósticos filtram trechos de fonte que poderiam conter credenciais. Os testes falhos anteriores não geraram evidência aprovada nem gravaram em produção.
