# Correções de estoque, Finance e Status — 14/10/2026

Estado: implementação local testada, sem commit, push, publicação ou recuperação mutante de sessão. Três agentes trabalharam em frentes separadas; revisão e validação integrada concluídas no checkout primário. Diário de aparelhos anteriormente preparado e arquivos preexistentes Shopee/3D preservados.

## Estoque

A consulta GET da distribuição não materializa mais saldo nem gera movimentos. Removido wrapper sem consumidores. A materialização explícita na reconciliação canônica consulta unidades serializadas disponíveis quando existem; bootstrap sem tabela units é permitido somente na migração inicial. Nenhuma mudança na reconciliação externa normal ou no SKU compartilhado.

PM7P12512P: dois cadastros com saldo agregado 2 e uma unidade disponível por cadastro. Registros distribution_open em 14/10 às 10h24 criaram uma unidade contábil em Entrada/Conferência em cada cadastro porque o agregado excedia a distribuição anterior. Não criaram unidades físicas. A origem anterior do agregado 2 é desconhecida; created_by do movimento está nulo.

Saldos atuais não foram alterados. Após conferir estoque físico, o ajuste revisável é Entrada/Conferência 1→0 em cada cadastro, com motivo e novo movimento de ajuste, preservando os registros históricos. A correção do GET impede o efeito colateral, mas não comprova a disponibilidade física dos IMEIs.

## Finance

PM2 executa server.js, que o deploy integral copia de vps_server.js. Hook /admin/openai/finance existia só no CJS. JS agora registra o mesmo módulo com autenticação administrativa. Deploy integral envia e valida o módulo antes de trocar o runtime. Teste do deploy verifica invariantes financeiras, preservando diferenças legítimas e outros trabalhos nos servidores.

## Status do WhatsApp

Hoje falharam cinco envios: imagem das 8h e quatro tabelas das 8h15. Logs do WAHA confirmam POST de imagem abortado após cerca de 90 segundos. Sessão declarava WORKING, mas consulta das mensagens de Status também não respondia. Causa interna do travamento do WPP não comprovada; o 404 financeiro é independente.

Saúde canônica agora verifica metadados da sessão e leitura de um Status sem mídia. JS/CJS usam um único helper de envio: preflight falhando não faz POST e pode ser tentado até três vezes; timeout/5xx/ausência de ID após POST ficam incertos, sem reenvio automático. O retorno do provedor exige ID válido, normalizado. A guarda não prova publicação só pela conexão.

Recuperação preparada: `node scripts/recover-whatsapp-status-session.cjs` só consulta. Ação separada, pendente de autorização: `node scripts/recover-whatsapp-status-session.cjs --restart --session=statusloja-wpp`. Valida alvo configurado e WAHA local, exige sessão indisponível, reinicia somente essa sessão e reconsulta; não envia Status. Se exigir QR ou continuar indisponível, para. Consulta não mutante das 11h07 confirmou indisponibilidade. Antes de reenviar os cinco casos incertos, conferir publicação no WhatsApp para evitar duplicação.

## Validação

52 testes integrados aprovados: Finance/patch de deploy, distribuição somente leitura, diário, saúde do sistema, sender/recuperação. Guardas adicionais de estoque e mídia/status aprovadas; build e sintaxe JS/CJS, módulos e deploy aprovados.

Limitações: teste MySQL descartável não executado por Docker indisponível; testes antigos de estoque dependem de migration Supabase ausente; guarda estática ampla de campanha contém expectativa marketingVariantOptions.map ausente também no HEAD, fora do escopo desta correção. Nenhuma dessas limitações foi escondida como aprovação.

Próximas ações de produção devem seguir publish-vps e publicar.md. Diário tem plano de migração próprio em migrations/unit-journal.md; não houve instalação de tabela/triggers. Nenhum registro comercial ou infraestrutura foi alterado neste trabalho.
