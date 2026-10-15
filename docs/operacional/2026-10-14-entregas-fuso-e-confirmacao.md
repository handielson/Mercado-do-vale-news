# Entregas: filtro diário, etapas e notificações

Estado: publicado em v1.2.628-vendas-entregas, com API/site conferidos e APK 1.1.5 instalado no Realme RMX5011. Validação sem envio de mensagens nem alteração de vendas reais pelo agente; detalhes na nota da versão.

## Evidências

- A venda `87e6d48e` tem trabalho operacional pendente, sem responsável definido. A consulta administrativa sem período retorna a entrega; a consulta ativa com `period=today` a exclui.
- O banco usa UTC: durante a investigação, a data do banco já era 15/10, enquanto a data comercial de Petrolina ainda era 14/10. `CURDATE()` excluía as entregas anteriores às 21h locais do filtro “Hoje”.
- O aplicativo informado pelo operador é 1.1.4. Há um APK local com versionCode 8 e SHA-256 `e41eea37805afd09e6491319f64680c977367f6cb461ea0d90754a5254ce475f`. O código versionado encontrado estava em 1.1.3. Após o pedido adicional de retorno automático, a alteração original da 1.1.4 foi recuperada do histórico local de 13/09 e conciliada com o suporte atual a links externos, preservando painel e filtros antes de preparar a 1.1.5.
- O DEX do APK 1.1.4, inspecionado com o `dexdump` do Android SDK, inicializa `currentPeriod=today` e envia esse período em `/delivery/app/jobs`. A análise Android da REA não estava disponível por ausência do provedor JADX; nenhuma conclusão de decompilação REA é alegada.
- A venda `b715f475` está entregue, sem confirmação de aviso de saída, e registra dois envios de conclusão. O texto do erro inicial não foi recuperado; não foi possível provar a causa daquela primeira falha. Foram confirmadas a permissão para concluir diretamente do estado pendente e a ausência de proteção contra repetição da notificação de conclusão.

## Correções

`buildDeliveryAppDateFilter`, nos dois arquivos da API, é a fonte única dos filtros da lista e do painel. Usa o calendário de `America/Recife`, limites de dia convertidos para o relógio da sessão SQL e intervalo com fim exclusivo. Hoje, ontem, mês e datas explícitas deixam de depender de `CURDATE()` do banco UTC. Mantém o filtro por responsável e a autenticação existentes.

Na operação comum, concluir exige responsável, pagamento liberado e estado `in_route`. A baixa administrativa com motivo preserva sua exceção operacional. Repetir a conclusão preserva a data original; entrega cancelada não pode ser concluída. A interface explica o responsável pendente e diferencia registrar saída, reenviar aviso conhecido como falho e confirmar recebimento.

As notificações usam bloqueio MySQL por entrega/tipo, releitura do registro confirmado e descarte de cópias antigas. O comprovante de venda diferido e o aviso de conclusão ficam serializados. Avisos incertos não são reenviados automaticamente. A API distingue saída registrada de mensagem confirmada e a tela recarrega o estado após uma falha de rede, sem anunciar envio bem-sucedido sem confirmação.

## Verificação

- 34 testes de entrega passaram, incluindo 18 cenários comportamentais executando as funções reais dos dois arquivos da API.
- A consulta corrigida foi executada somente em leitura contra o MySQL real: ambas as vendas entram no dia comercial 14/10, sem modificar registros.
- Build Vite e sintaxe da API aprovados. A bateria anterior de 61 testes dos fluxos de vendas/PayJoy também passou.
- `npm.cmd run test:customer-delivery` agora inclui a proteção de datas, transições, repetição, concorrência e envio incerto.

Após publicação autorizada da API e do site, conferir o filtro “Hoje” no app 1.1.4 e acompanhar novas operações autorizadas. Não reenviar “saiu para entrega” para a venda já entregue nem recriar o trabalho da venda pendente. Como alternativa temporária de leitura, o filtro “Mês” inclui a venda excluída por “Hoje”.

## Retorno automático solicitado após a investigação

Versão Android preparada: 1.1.5, versionCode 9. A página chama `MdvDelivery.closeDelivery()` somente depois de receber `delivery_status=delivered`. A ponte nativa encerra GPS, remove a WebView da operação e recria o painel inicial com consulta atualizada. Falhas ou resposta sem confirmação mantêm a operação aberta. A versão instalada 1.1.4 não tem esse método: o retorno automático depende do APK novo e da publicação da página.

Cinco testes adicionais cobrem a ordem da confirmação, falha de API, resposta não confirmada, compatibilidade com ponte ausente e descarte/retorno nativo. A bateria de entregas passou em 39 testes e os builds web/Android foram aprovados. APK instalado com `install -r`, versão 1.1.5/code 9 conferida e Activity aberta. Não foi feita conclusão de entrega real como teste.

Documentação oficial consultada: [ciclo de vida de Activity](https://developer.android.com/guide/components/activities/activity-lifecycle), [WebView](https://developer.android.com/reference/android/webkit/WebView#destroy()) e [JavascriptInterface](https://developer.android.com/reference/android/webkit/JavascriptInterface).
