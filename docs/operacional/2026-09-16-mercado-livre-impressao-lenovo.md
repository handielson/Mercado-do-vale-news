# Ativacao da impressao Mercado Livre no Lenovo

## Causa e fonte de verdade

Em 16/09 o processo ativo executava `C:\ProgramData\MercadoDoVale\printer-service\scripts\shopee-auto-print.cjs` sem consumidor Mercado Livre. A API ja tinha integracao conectada, DC-e automatica habilitada e 12 registros sem nenhuma tentativa de impressao. Todos estavam enviados, entregues ou cancelados. A instalacao de 04/09 havia acrescentado somente a impressao central ao script de agosto.

O consumidor canonico agora fica em `scripts/mercado-livre-print-agent.cjs`. O script Shopee apenas inicializa esse modulo, reutilizando a configuracao protegida das impressoras e a consulta de localizacoes por SKU. O comprovante Mercado Livre e gerado pelo formatador exclusivo de `mercado-livre-print-core.cjs`, em pagina 90x100 mm; o comprovante Shopee permanece inalterado.

## Comportamento e recuperacao

- Consulta a fila a cada 60 segundos; sem venda elegivel, nenhuma impressao.
- Etiqueta e declaracao: ZDesigner ZD220-203dpi ZPL, papel 4x6, fit. Comprovante: alias preparado pelo auxiliar central, papel exato 90x100 mm, retrato e sem escala.
- API concilia uma DC-e pendente por consulta e verifica o estado atual da remessa antes de entrega-la ao consumidor. Reserva condicional evita dois consumidores reclamarem o mesmo trabalho.
- Remessas enviadas, entregues, canceladas e nao entregues sao apresentadas como encerradas para impressao. A projecao preserva os dados e marcadores antigos; nao ha migration nem reimpressao de pedidos antigos.
- Cada etapa grava intencao duravel antes do Windows e resultado depois, em `scripts/mercado_livre_printed`. Nao apagar esse diretorio. `submitted` reenvia somente a confirmacao para a VPS. `sending` exige conferencia, inclusive apos reinicio.
- Webhook nao reabre uma falha de impressao com erro registrado nem uma impressao em andamento. Uma tentativa incerta precisa de investigacao e acao explicita; nao apagar marcadores para forcar reimpressao.

## Instalacao seletiva

1. Consultar fila Windows e processo ativo; baixar o script instalado e comparar seu SHA256 antes da escrita.
2. Montar pacote com o script instalado preservado e somente o bloco de inicializacao canonico Mercado Livre acrescentado. Incluir `mercado-livre-print-agent.cjs`, `mercado-livre-print-core.cjs` e `mercado-livre-print-test.cjs`.
3. Enviar para `.staging/ml-20260916`, conferir SHA256 e sintaxe. Nao copiar `.env`, tokens, marcadores Shopee ou diarios centrais.
4. Salvar os arquivos substituidos em `.restore-points/mercado-livre-20260916`. Copiar dependencias antes do ponto de entrada.
5. Reiniciar somente o processo PM2 de impressao, conferir log de inicializacao Mercado Livre e porta local 8081; salvar PM2.
6. API: usar `node deploy-vps-server-only.cjs --mercado-livre-only`, que faz backup e publica somente `services/mercadoLivreServer.cjs`. Site segue o fluxo completo de `publicar.md`, a partir do commit isolado das alteracoes preexistentes.

## Testes sem venda

`node scripts/mercado-livre-print-test.cjs --output <diretorio>` gera previa ficticia. `--print-test` autoriza o envio fisico do mesmo fixture. `--summary-only` usa o ID `TESTE-20260916-ML02`, marca etiqueta e declaracao como concluidas e envia somente um comprovante 90x100. Nao usa API Mercado Livre, VPS ou emissao fiscal. Os IDs fixos e os diarios independentes impedem copias extras ao repetir o comando no mesmo diretorio.

Em 16/09, 13:45 UTC, o teste inicial no Lenovo confirmou tres envios ao Windows e a repeticao confirmou zero envios adicionais. O comprovante, ainda em pagina 80x152,4 mm sobre driver 100x150, avancou papel demais, travou e deixou a impressora piscando. O novo documento exclusivo foi reduzido para a medida fisica da LABEL-9X10: 90x100 mm. Nenhum novo envio deve ser feito enquanto a impressora estiver piscando; depois do destravamento, validar uma unica pagina com `--summary-only --print-test`.

O teste corretivo de 90x100 mm foi enviado pela impressao central e o operador confirmou tamanho e legibilidade perfeitos. A conferencia identificou apenas ausencia de folga lateral; o layout final acrescentou 5 mm de recuo em cada lado, totalizando margens horizontais internas de 10 mm, sem mudar o papel ou a escala. A segunda impressao fisica foi aprovada pelo operador.

19 testes Mercado Livre aprovados: webhook e emissao simulados, documentos, reserva, cancelamento, DC-e pendente, falha de rede, queda durante envio, retomada e dimensoes 90x100. Testes do comprovante Shopee e configuracao VPS aprovados. A guarda ampla `shopee-dual-thermal-print-flow-static.test.mjs` passa ate a comparacao final entre `vps_server.js` e `.cjs`, que ja divergem no HEAD anterior; esses arquivos nao foram alterados nesta entrega.

## Inicializacao Windows e limites

A tarefa `Mercado do Vale - Impressao Shopee` executa PM2 resurrect na sessao Lenovo, com gatilho de login e horario. O tunnel inicia no boot como SYSTEM. A atualizacao usa o mesmo processo e tarefa, sem alterar credenciais, tunnel ou politica de login. O funcionamento antes do login e um reboot completo do Windows nao sao comprovados por um restart do PM2. Manter Lenovo ligado e sessao iniciada.

A emissao e o download reais da DC-e/etiqueta continuam dependendo da proxima venda apta do Mercado Livre; os testes nao criam venda, movimentam estoque ou emitem documento fiscal.
