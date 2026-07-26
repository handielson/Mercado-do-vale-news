# MDV Admin Estoque

Aplicativo Android nativo para consulta e movimentacao de estoque e impressao de etiquetas.

## Fontes oficiais

- Produtos e estoque: API VPS/MySQL existente.
- Sessao: `POST /auth/login`, com token bearer da VPS.
- Etiquetas: `GET/PATCH /admin/label-templates` como fonte central de formatos.

O aplicativo nunca incorpora `x-sync-key`, `VITE_VPS_SYNC_KEY`, Supabase ou credenciais de banco.

## Recursos implementados

- Login restrito a contas administrativas, com sessao persistida no aparelho.
- Versao instalada visivel nas telas de login e painel.
- Consulta por nome, SKU, EAN, QR e codigo de barras.
- Foto, preco em centavos, estoque e link publico do produto.
- Pre-visualizacao da mesma imagem monocromatica enviada a impressora.
- Formato inicial 30 x 20 mm e arte alinhada a guia direita do papel.
- Zonas independentes para nome/SKU, preco e barras, sem sobreposicao.
- Preco reduzido automaticamente apenas quando duas linhas de nome diminuem o espaco central.
- Barras do codigo de barras reduzidas em 2 mm, mantendo o EAN na linha inferior.
- Intervalo de 2,5 segundos entre copias para o sensor concluir o avanco da etiqueta.
- Página física enviada em 30 × 20 mm, sem acrescentar a lacuna do rolo à imagem.
- Nenhum campo de espaço ou botão de calibração separado: ambos foram removidos para não alterar o estado da conexão.
- Impressão Bluetooth replica o trabalho RAW capturado do driver USB P50: raster girado, sensor, form-feed até o próximo intervalo e encerramento.
- Conexao BLE com Marklife P50/P50S pelo servico FF00 e escrita FF02.
- Impressao bitmap pelo protocolo nativo 0x1F, com ZLIB de 1 KB compativel com o firmware.
- Envio BLE confirmado em pacotes de 200 bytes e finalizacao em duas fases.
- Tela explicativa para permissoes de camera e dispositivos proximos.

## Validacao fisica

O app mostra estados separados de conexao, envio e erro. A validacao fisica confirma, alem do recebimento BLE, o alinhamento e a qualidade da etiqueta em cada lote de papel.

## Compilacao

Requer JDK 17 e Android SDK Platform 35. Defina `VPS_BASE_URL` em `~/.gradle/gradle.properties` ou passe `-PVPS_BASE_URL=https://...` para apontar a API VPS autorizada. O valor padrao acompanha o painel web atual.
