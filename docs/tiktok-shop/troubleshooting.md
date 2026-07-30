# TikTok Shop - Solucoes de problemas

## Coluna `shipping_weight` inexistente ao criar rascunho

- Data: 2026-07-26
- Area: produtos / VPS
- Sintoma: o proxy devolvia HTTP 502 ao chamar `POST /tiktok-shop/products/drafts`.
- Evidencia: o log da API registrou `Unknown column 'shipping_weight' in 'field list'` antes de qualquer chamada de criacao ao TikTok.
- Causa: a consulta local selecionava campos opcionais `shipping_*` que nao existem na tabela `products` de producao.
- Correcao: a consulta usa somente `weight_kg` e `dimensions`, campos existentes e suficientes para montar peso e dimensoes do pacote.
- Protecao: o teste estatico impede que a consulta de criacao volte a depender de colunas `shipping_*`.
- Risco restante: depois dessa correcao, o TikTok ainda pode validar regras comerciais do produto; esses erros devem ser tratados pelo codigo e `request_id` oficiais.

## Imagem local em base64 bloqueada ao criar rascunho

- Data: 2026-07-26
- Area: produtos / midia / VPS
- Sintoma: o proxy devolvia HTTP 502 e o log registrava `Imagem fora dos dominios autorizados do Mercado do Vale`.
- Evidencia: o produto possuia duas imagens HTTPS controladas e uma imagem valida `data:image/jpeg;base64`.
- Causa: a validacao aceitava apenas URLs HTTPS, embora o banco de imagens do proprio sistema tambem armazene imagens locais em data URI.
- Correcao: data URIs de JPEG, PNG, WEBP, HEIC e BMP sao decodificadas no backend, validadas pelo tipo e limite de 10 MB e enviadas diretamente ao endpoint oficial de imagens.
- Protecao: URLs remotas continuam restritas aos dominios controlados; nenhum novo dominio externo foi liberado.
- Melhoria adicional: o envio agora inicia um processo assincrono e o modal consulta cada etapa, evitando que um processamento longo termine como pagina HTML 502 do proxy.

## Video fora da proporcao permitida

- Data: 2026-07-27
- Area: produtos / video / VPS
- Sintoma: o upload falhava com `12019122: The video ratio must be between 9:16 and 16:9`.
- Evidencia: request ID `202607270802051D1285B9FACCB819FD76`; o video do produto media `474x850`, proporcao `0,5576`, abaixo do minimo `9:16` (`0,5625`).
- Fonte oficial: https://partner.tiktokshop.com/docv2/page/upload-product-file-202309
- Causa: embora visualmente quase vertical 9:16, faltavam aproximadamente seis pixels de largura para entrar na faixa aceita.
- Correcao: o backend usa FFmpeg para preencher o quadro ate a proporcao valida mais proxima, centralizando o conteudo sem corte ou deformacao. O video confirmado passou de `474x850` para `480x850`.
- Protecao: a versao do processamento integra o hash de cache, o deploy provisiona `ffmpeg-static` na VPS e o teste estatico protege filtro, dependencia e upload.
- Interface: falhas de envio agora oferecem `Copiar debug` com etapa, produto, categoria, codigo TikTok, request ID, job ID e horario.

### Correcao complementar: entrada e saida FFmpeg com o mesmo nome

- Evidencia: job `51592ba2-8b87-4280-ae7a-6316b25cc315` falhou com `Output ... same as Input #0`.
- Causa: para arquivos MP4, a entrada temporaria e a saida normalizada eram ambas chamadas `produto-video.mp4`.
- Correcao: a entrada preserva a extensao sob o nome `produto-video-original.*` e a saida usa `produto-video-ajustado.mp4`.
- Protecao: o teste agora gera primeiro um MP4 real, confirma caminhos diferentes e somente depois executa o mesmo ajuste usado em producao.

## Atributo obrigatorio ausente na publicacao

- Data: 29 de julho de 2026
- Area: produtos
- Sintoma: a publicacao do rascunho retorna HTTP 422 e codigo TikTok `12052104`.
- Evidencia: o TikTok informou a ausencia do atributo `102427`, `Is Anatel Homologation Code Required`.
- Documentacao oficial: `Get Attributes` e `Edit Product`; todos os atributos marcados como `is_required` devem ser enviados ao listar o produto.
- Causa: o painel apenas mostrava os nomes dos atributos obrigatorios. O publicador tinha um preenchimento automatico de ANATEL restrito a uma categoria passiva de impressao 3D.
- Correcao: o painel passou a oferecer selecao catalogada ou digitacao para os campos obrigatorios. O servidor consulta novamente os atributos, valida IDs e bloqueia localmente quando houver campo vazio.
- Protecao: `tmp-tests/tiktok-shop-required-attributes.test.mjs`.
- Risco restante: atributos condicionais adicionais podem aparecer depois de uma escolha; nesse caso, o TikTok pode exigir uma nova consulta e preenchimento na tentativa seguinte.

## Peso e medidas do modelo ignorados no preparo

- Data: 29 de julho de 2026
- Area: produtos / logistica
- Sintoma: o preparo do `INV15M` informava peso e medidas ausentes, embora o cadastro exibisse esses dados.
- Evidencia: o SKU tinha `weight_kg = null` e `dimensions = {}`, enquanto o modelo vinculado armazenava `0,4 kg` e `19 x 6 x 12 cm`.
- Causa: a tela e o publicador liam apenas os campos diretos do produto.
- Correcao: ambos agora preservam dados diretos e completam somente os campos ausentes com `template_values` do modelo.
- Protecao: `tmp-tests/tiktok-shop-required-attributes.test.mjs` valida o pacote herdado de `400 g`, `12 x 19 x 6 cm`.
