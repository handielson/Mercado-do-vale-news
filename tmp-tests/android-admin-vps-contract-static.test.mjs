import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../vps_server.js', import.meta.url), 'utf8');
const mirrors = fs.readFileSync(new URL('../vps_server.cjs', import.meta.url), 'utf8');
const activity = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/MainActivity.kt', import.meta.url),
  'utf8',
);
const apiClient = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/data/VpsApiClient.kt', import.meta.url),
  'utf8',
);
const manifest = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
);
const productModel = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/domain/ProductLabelProduct.kt', import.meta.url),
  'utf8',
);
const stockLocationModel = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/domain/StockLocationBox.kt', import.meta.url),
  'utf8',
);
const labelRenderer = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/printing/LabelRenderer.kt', import.meta.url),
  'utf8',
);
const printerClient = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/printing/P50PrinterClient.kt', import.meta.url),
  'utf8',
);
const printerStatusView = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/ui/PrinterStatusView.kt', import.meta.url),
  'utf8',
);
const buildGradle = fs.readFileSync(
  new URL('../android/admin-estoque/app/build.gradle.kts', import.meta.url),
  'utf8',
);

assert.equal(source, mirrors, 'vps_server.js e vps_server.cjs devem permanecer identicos');

for (const route of [
  '/stock-locations/deposits',
  '/stock-locations/locations',
  '/stock-locations/products/:productId/distribution',
  '/stock-locations/locations/:locationId/contents',
]) {
  assert.match(source, new RegExp(`fastify\\.get\\('${route.replace(/[/:]/g, '\\$&')}', \\{ preHandler: requireSyncKeyOrAdmin \\}`));
}

assert.match(source, /fastify\.post\('\/stock-locations\/transfers', \{ preHandler: requireSyncKeyOrAdmin \}/);
assert.match(
  source,
  /isAdmin: normalizeAuthCustomerType\(customer\?\.customer_type\) === 'ADMIN'/,
  'a API deve reconhecer perfis administrativos antigos independentemente de caixa',
);
assert.match(source, /const LABEL_TEMPLATES_PREFERENCE_KEY = 'label\.templates';/);
assert.match(source, /fastify\.get\('\/admin\/label-templates', \{ preHandler: requireSyncKeyOrAdmin \}/);
assert.match(source, /fastify\.patch\('\/admin\/label-templates', \{ preHandler: requireSyncKeyOrAdmin \}/);

assert.match(apiClient, /customerType\.equals\("ADMIN", ignoreCase = true\)/, 'o app deve rejeitar login que nao seja administrativo');
assert.match(activity, /\/products\?search=\$encoded&compact=true&limit=10/, 'a busca Android deve usar a resposta compacta e limitada');
assert.match(productModel, /val formattedPrice[\s\S]*priceCents \/ 100\.0/, 'preco da API em centavos deve ser formatado em reais');
assert.match(productModel, /images\?\.optString\(0\)/, 'a primeira foto do produto deve ser carregada');
assert.match(productModel, /www\.mercadodovale\.com\.br\/produto/, 'o produto deve expor o link publico do site');
assert.match(productModel, /fun toStateJson\(\): String/, 'o produto selecionado deve poder ser preservado durante recriacoes da tela');
assert.match(productModel, /fun fromStateJson\(value: String\)/, 'o produto selecionado deve poder ser restaurado');
assert.match(productModel, /it\.widthMm == 30 && it\.heightMm == 20/, 'o tamanho inicial deve acompanhar o papel 30x20 usado na P50');
assert.match(activity, /Pré-visualização — esta mesma imagem será enviada à P50/, 'a tela deve mostrar a etiqueta antes da impressao');
assert.match(activity, /Permissões do celular/, 'o app deve ter uma tela visivel de permissoes');
assert.match(activity, /LabelRenderer\.render\(product/, 'a previa e a impressao devem compartilhar o renderizador');
assert.match(labelRenderer, /MultiFormatWriter/, 'a etiqueta deve renderizar codigo de barras');
assert.match(labelRenderer, /height \* 0\.40f/, 'o codigo de barras deve ocupar o mesmo bloco proporcional da etiqueta por cabo');
assert.match(labelRenderer, /product\.ean\.ifBlank \{ product\.sku \}/, 'a etiqueta deve usar EAN e recorrer ao SKU como no computador');
assert.doesNotMatch(labelRenderer, /QR_CODE/, 'o Android nao deve substituir o padrao por cabo por um QR code');
assert.match(labelRenderer, /BARCODE_HEIGHT_REDUCTION_MM = 2/, 'as barras devem ser 2 mm mais baixas');
assert.match(labelRenderer, /barsTop \+ it\.height \+ valueGap/, 'a reducao das barras deve preservar a linha inferior do EAN');
assert.match(labelRenderer, /CONTENT_TOP_OFFSET_MM = 1/, 'nome e SKU devem permanecer na zona superior');
assert.match(labelRenderer, /availablePriceHeight[\s\S]*pricePaint\.textSize \*=/, 'o preco deve se ajustar ao espaco central disponivel');
assert.match(labelRenderer, /priceSlotBottom[\s\S]*barsTop/, 'o preco deve terminar antes do codigo de barras');
assert.match(activity, /state == PrinterConnectionState\.CONNECTED[\s\S]*View\.GONE/, 'o botao conectar deve sumir quando a P50 estiver conectada');
assert.match(activity, /sessionPreferences\.edit\(\)\.putString\(SESSION_TOKEN_KEY, accessToken\)/, 'a sessao administrativa deve sobreviver a recriacao do app');
assert.match(activity, /getString\(SESSION_TOKEN_KEY, null\)/, 'o app deve restaurar a sessao salva ao iniciar');
assert.match(
  activity,
  /handleProtectedApiFailure[\s\S]*get\("\/auth\/me"\)[\s\S]*sessionResult\.isSuccess/,
  'uma rota protegida recusada deve validar a sessao antes de deslogar',
);
assert.match(activity, /override fun onSaveInstanceState[\s\S]*STATE_SCREEN[\s\S]*STATE_LABEL_PRODUCT/, 'a tela e o produto devem sobreviver a rotacao');
assert.match(activity, /sessionPreferences\.getString\(LABEL_PRODUCT_KEY, null\)[\s\S]*ProductLabelProduct\.fromStateJson/, 'o ultimo produto selecionado deve permanecer na sessao');
assert.match(activity, /putString\(LABEL_PRODUCT_KEY, product\.toStateJson\(\)\)/, 'a selecao por QR ou busca deve ser persistida imediatamente');
assert.match(activity, /dp\(280\)[\s\S]*ImageView\.ScaleType\.FIT_CENTER/, 'a foto deve ter uma area maior e aparecer inteira sem recorte');
assert.match(activity, /private fun showStockLocations\(\)/, 'o app deve ter a pagina de locais em estoque');
assert.match(activity, /Ler QR da caixa[\s\S]*StockLocationBox\.idFromQr/, 'o app deve abrir uma caixa pelo QR impresso');
assert.match(activity, /private fun showStockLocationContents[\s\S]*stockLocationProductRow/, 'o app deve mostrar os itens da caixa selecionada');
assert.match(activity, /item\.productName[\s\S]*SKU:[\s\S]*Disponível:[\s\S]*field\("Qtd\."\)/, 'cada item da caixa deve mostrar nome, SKU, saldo e quantidade');
assert.match(activity, /Pesquisar produto individual[\s\S]*Pesquisar produto[\s\S]*Ler código do produto/, 'a tela inicial deve oferecer pesquisa individual visivel');
assert.match(activity, /stockSearchProductRow[\s\S]*ImageView[\s\S]*FIT_CENTER/, 'o resultado individual deve mostrar a foto inteira do produto');
assert.match(activity, /Localizado em:[\s\S]*source\.locationName[\s\S]*source\.available/, 'o produto pesquisado deve listar suas localizacoes e saldos');
assert.match(activity, /products\.size == 1[\s\S]*loadProductStockSources/, 'uma pesquisa exata deve abrir automaticamente os locais do produto');
assert.match(activity, /Abrir uma caixa pelo QR[\s\S]*Ler QR da caixa e selecionar produtos/, 'a tela inicial deve oferecer o fluxo por QR da caixa');
assert.match(activity, /CheckBox/, 'cada produto da caixa deve ter controle de selecao');
assert.match(activity, /Selecionar todos/, 'a caixa deve permitir selecionar todos os produtos');
assert.match(activity, /Movimentar selecionados/, 'a caixa deve permitir movimentar um ou varios produtos');
assert.match(activity, /private fun showStockBatchTransfer[\s\S]*Ler QR da caixa de destino[\s\S]*Confirmar movimentação/, 'o lote deve permitir escolher o destino por QR e confirmar');
assert.match(activity, /prepared\.forEachIndexed[\s\S]*\/stock-locations\/transfers/, 'os produtos selecionados devem ser enviados em sequencia ao mesmo destino');
assert.match(activity, /\.post\("\/stock-locations\/transfers", payload\)/, 'o Android deve usar a mesma transferencia atomica do computador');
assert.match(activity, /amount > line\.item\.available/, 'o app deve impedir movimentacao acima do saldo disponivel');
assert.match(apiClient, /fun post\(path: String, payload: JSONObject\)/, 'o cliente Android deve enviar transferencias autenticadas');
assert.match(stockLocationModel, /depositId[\s\S]*reservedQuantity[\s\S]*available/, 'a movimentacao deve conhecer deposito e saldo disponivel da origem');
assert.match(source, /movementCreatedBy = String\(req\.headers\['x-mdv-client'\]/, 'o historico deve registrar se a movimentacao veio do Android');
assert.doesNotMatch(activity, /Distribuição por local|Histórico de movimentações|Divergências/, 'a pagina Android de caixas nao deve incluir secoes exclusivas do computador');
assert.match(stockLocationModel, /mdv:\/\/stock-location\//, 'o leitor deve reconhecer o QR individual da caixa');
assert.match(stockLocationModel, /product_image[\s\S]*product_name[\s\S]*sku[\s\S]*quantity/, 'o modelo deve ler foto, nome, SKU e quantidade do conteudo');
assert.match(activity, /Versão \$\{BuildConfig\.VERSION_NAME\}/, 'a versao instalada deve ficar visivel no aplicativo');
assert.match(printerClient, /0000ff02-0000-1000-8000-00805f9b34fb/, 'a P50 deve escrever na caracteristica FF02');
assert.match(printerClient, /BLE_JOB_START = byteArrayOf\(0x1F, 0xC0\.toByte\(\), 0x01, 0x00\)/, 'a impressao deve usar o envelope aceito pelo Bluetooth');
assert.doesNotMatch(printerClient, /postRotate|Matrix/, 'o envelope Bluetooth deve manter a arte horizontal');
assert.match(printerClient, /Deflater\(Deflater\.NO_COMPRESSION, true\)/, 'o raster girado deve manter o envelope ZLIB aceito pela P50 no BLE');
assert.match(printerClient, /write\(0x28\)[\s\S]*write\(0x15\)/, 'o ZLIB Bluetooth deve anunciar janela de 1 KB');
assert.match(printerClient, /write\(rowBytes ushr 8\)[\s\S]*write\(rowBytes\)[\s\S]*write\(source\.height ushr 8\)[\s\S]*write\(source\.height\)/, 'o envelope BLE deve manter a geometria horizontal 240x160');
assert.match(printerClient, /WRITE_TYPE_NO_RESPONSE/, 'o envio BLE deve usar a escrita continua do aplicativo oficial');
assert.doesNotMatch(printerClient, /PRINT_TOP_OFFSET_MM/, 'o deslocamento visual nao pode aumentar fisicamente a pagina');
assert.match(printerClient, /repeat\(copies\)[\s\S]*val isFirst = copy == 0[\s\S]*val isLast = copy == copies - 1[\s\S]*sendJobAndAwaitPrinter\(copyJob\)/, 'cada copia deve ser um trabalho completo como no aplicativo oficial');
assert.match(printerClient, /if \(isFirst\) \{[\s\S]*PAPER_TYPE_GAP[\s\S]*DENSITY_NORMAL[\s\S]*WAKEUP[\s\S]*BLE_JOB_START[\s\S]*if \(isFirst\) jobParts \+= ALIGN_LABEL_START[\s\S]*imagePacket[\s\S]*LOCATE_NEXT_GAP[\s\S]*BLE_JOB_END[\s\S]*if \(isLast\) jobParts \+= FEED_LABEL_END/, 'a sequencia P50S deve reproduzir o protocolo oficial por indice de copia');
assert.doesNotMatch(printerClient, /NEXT_LABEL|0x1D, 0x0C/, 'o comando raster USB nao pode interromper o protocolo BLE');
assert.doesNotMatch(printerClient, /FOOTER_DELAY_MS|BETWEEN_COPIES_DELAY_MS/, 'nao deve existir pausa artificial entre copias');
assert.match(printerClient, /val isReady:[\s\S]*gatt != null && writeCharacteristic != null/, 'uma falha de comando nao deve inutilizar uma conexao BLE ainda ativa');
assert.doesNotMatch(activity, /LABEL_GAP_MM|labelGapMm|Ativar sensor automático/, 'a tela nao deve mais alterar manualmente o intervalo ou o sensor');
assert.doesNotMatch(printerClient, /calibratePaper|LEARN_GAP_PAPER/, 'o cliente nao deve enviar calibracao separada que bloqueie a conexao');
assert.match(printerClient, /val imagePacket = encodeBleImagePacket\(bitmap\)/, 'a pagina deve ser convertida uma vez para o formato hibrido USB e BLE');
assert.doesNotMatch(printerClient, /bottomGapDots|content\.height \+ gapMm/, 'o espaco fisico do rolo nao pode ser desenhado dentro da pagina');
assert.match(printerClient, /PAPER_TYPE_GAP = byteArrayOf\(0x1F, 0x80\.toByte\(\), 0x02, 0x20\)/, 'o BLE deve configurar papel de etiquetas com o byte oficial para intervalo');
assert.match(printerClient, /LOCATE_NEXT_GAP = byteArrayOf\(0x1F, 0x12, 0x20, 0x00\)/, 'cada copia deve localizar o proximo intervalo pelo sensor');
assert.match(printerClient, /ALIGN_LABEL_START = byteArrayOf\(0x1F, 0x11, 0x51\)/, 'o lote deve alinhar o inicio pelo sensor');
assert.match(printerClient, /FEED_LABEL_END = byteArrayOf\(0x1F, 0x11, 0x50\)/, 'o lote deve expor a ultima etiqueta no corte');
assert.match(printerClient, /0000ff03-0000-1000-8000-00805f9b34fb/, 'o cliente deve usar o controle de fluxo FF03 da P50');
assert.match(printerClient, /0000ff01-0000-1000-8000-00805f9b34fb/, 'o cliente deve aguardar a confirmacao FF01 antes da proxima copia');
assert.match(printerClient, /PROPERTY_NOTIFY[\s\S]*ENABLE_NOTIFICATION_VALUE[\s\S]*ENABLE_INDICATION_VALUE/, 'o retorno FF01 deve ativar notificacao ou indicacao conforme a propriedade GATT');
assert.match(printerClient, /FF01 não confirmou[\s\S]*return/, 'a ausencia de retorno FF01 nao pode travar uma etiqueta ja entregue');
assert.match(printerClient, /FLOW_CONTROL_PROTOCOL = 0x01/, 'os creditos BLE devem seguir o protocolo 0x01');
assert.match(printerClient, /CHUNK_SIZE = 200/, 'a P50S deve receber pacotes BLE do tamanho validado pelo protocolo');
assert.doesNotMatch(printerClient, /reconnectAfterCalibration/, 'a calibracao nao deve derrubar a conexao antes da impressao');
assert.match(printerStatusView, /PrinterConnectionState\.CONNECTED -> Color\.rgb\(22, 163, 74\)/, 'o icone deve ficar verde quando conectado');
assert.match(printerStatusView, /ValueAnimator/, 'o estado Bluetooth deve ter animacao');
assert.match(activity, /text = "−"[\s\S]*updateCopies\(-1\)/, 'a quantidade deve ter botao para diminuir');
assert.match(activity, /text = "\+"[\s\S]*updateCopies\(1\)/, 'a quantidade deve ter botao para aumentar');
assert.match(activity, /setSelectAllOnFocus\(true\)/, 'a quantidade deve selecionar todo o valor ao receber foco');
assert.match(activity, /MotionEvent\.ACTION_UP[\s\S]*selectAll\(\)/, 'um toque na quantidade deve permitir digitar por cima');
assert.match(buildGradle, /versionCode = 37/, 'o APK atualizado deve ter novo versionCode');
assert.match(buildGradle, /com\.google\.zxing:core/, 'o app deve incluir o encoder de QR e codigo de barras');
assert.match(manifest, /android\.permission\.BLUETOOTH"[\s\S]*android:maxSdkVersion="30"/, 'Android 8-11 precisa da permissao Bluetooth legada');
assert.match(manifest, /android\.permission\.BLUETOOTH_CONNECT/, 'Android 12+ precisa de BLUETOOTH_CONNECT para dispositivo pareado');
assert.match(manifest, /android\.permission\.CAMERA/, 'o leitor deve declarar permissao de camera');
assert.doesNotMatch(manifest, /android\.permission\.BLUETOOTH_SCAN/, 'o app nao deve pedir permissao de scan sem executar descoberta');

console.log('android admin VPS contract: OK');
