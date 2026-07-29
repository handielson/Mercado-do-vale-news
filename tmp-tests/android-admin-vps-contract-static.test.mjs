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
const genericPrinterClient = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/printing/GenericEscPosPrinterClient.kt', import.meta.url),
  'utf8',
);
const bluetoothPrinterClient = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/printing/BluetoothPrinterClient.kt', import.meta.url),
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
const saleModel = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/domain/SaleSummary.kt', import.meta.url),
  'utf8',
);
const pushService = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/push/SalesMessagingService.kt', import.meta.url),
  'utf8',
);
const pushRegistration = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/push/PushRegistration.kt', import.meta.url),
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
assert.match(activity, /Pré-visualização — esta mesma imagem será enviada à \$\{activePrinterProfile\.shortName\}/, 'a tela deve mostrar a etiqueta antes da impressao');
assert.match(activity, /Permissões do celular/, 'o app deve ter uma tela visivel de permissoes');
assert.match(activity, /LabelRenderer\.render\(product/, 'a previa e a impressao devem compartilhar o renderizador');
assert.match(activity, /Etiqueta avulsa[\s\S]*showCustomLabel/, 'a tela de etiquetas deve oferecer a etiqueta avulsa');
assert.match(activity, /private fun showCustomLabel[\s\S]*Texto da etiqueta[\s\S]*Imprimir etiqueta avulsa/, 'a etiqueta avulsa deve aceitar texto, mostrar previa e imprimir');
assert.match(activity, /LabelRenderer\.renderCustomText\([\s\S]*currentCustomLabelText[\s\S]*currentCustomLabelFontPercent/, 'a previa avulsa deve usar o texto e o tamanho de fonte escolhidos');
assert.match(labelRenderer, /MultiFormatWriter/, 'a etiqueta deve renderizar codigo de barras');
assert.match(labelRenderer, /fun renderCustomText/, 'o renderizador deve aceitar texto livre');
assert.match(labelRenderer, /fontPercent\.coerceIn\(40, 100\)/, 'a fonte avulsa deve permanecer dentro da area util');
assert.match(labelRenderer, /repeat\(22\)[\s\S]*layout\.height <= availableHeight/, 'o texto livre deve usar ajuste automatico para ocupar a area util sem cortar');
assert.match(labelRenderer, /Layout\.Alignment\.ALIGN_CENTER/, 'o texto livre deve ficar centralizado na etiqueta');
assert.match(activity, /contentDescription = "Diminuir fonte"[\s\S]*contentDescription = "Aumentar fonte"/, 'a etiqueta avulsa deve permitir diminuir e aumentar a fonte');
assert.match(activity, /updateFont\(-10\)[\s\S]*updateFont\(10\)/, 'os controles de fonte devem atualizar a previa em passos previsiveis');
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
assert.match(activity, /text = "−"[\s\S]*Diminuir quantidade de/, 'cada produto deve permitir diminuir a quantidade');
assert.match(activity, /text = "\+"[\s\S]*Aumentar quantidade de/, 'cada produto deve permitir aumentar a quantidade');
assert.match(activity, /text = "Todo estoque"[\s\S]*setQuantity\(item\.available, selectItem = true\)/, 'cada produto deve permitir usar todo o saldo disponivel');
assert.match(activity, /Pesquisar caixa por nome ou código[\s\S]*STOCK_LOCATION_FILTER_LABELS/, 'a lista de caixas deve ter pesquisa e filtro');
assert.match(activity, /Pesquisar caixa de destino[\s\S]*filterStockLocations/, 'a lista de destinos tambem deve ter pesquisa e filtro');
assert.match(activity, /Caixas 1 a 20[\s\S]*Caixas 81 ou mais[\s\S]*Outros locais/, 'o filtro deve dividir listas grandes em faixas');
assert.match(activity, /allBoxesContent[\s\S]*visibility = View\.GONE[\s\S]*▸ Todas as caixas/, 'a lista geral de caixas deve iniciar recolhida');
assert.match(activity, /allTargetsContent[\s\S]*visibility = View\.GONE[\s\S]*▸ Todas as caixas de destino/, 'a lista de destinos deve iniciar recolhida');
assert.match(stockLocationModel, /val boxNumber: Int\?/, 'o modelo deve identificar o numero da caixa para filtrar e ordenar');
assert.match(activity, /2\. Transferência em lote[\s\S]*showStockBatchBuilder/, 'a tela de estoque deve expor o lote como funcao propria');
assert.match(activity, /private fun showStockBatchBuilder[\s\S]*Bipar EAN, digitar SKU ou nome[\s\S]*Produtos selecionados[\s\S]*Escolher destino/, 'o lote deve pesquisar e manter varios produtos antes do destino');
assert.match(activity, /private fun loadBatchProductSources[\s\S]*Escolha a caixa de origem para adicionar ao lote/, 'cada produto do lote deve permitir escolher sua origem');
assert.match(activity, /transferLineKey\(item[\s\S]*productId\}\|\$\{item\.locationId/, 'o mesmo produto deve poder ser identificado por produto e origem');
assert.match(activity, /private fun showStockBatchTransfer[\s\S]*Ler QR da caixa de destino[\s\S]*Confirmar movimentação/, 'o lote deve permitir escolher o destino por QR e confirmar');
assert.match(activity, /prepared\.forEachIndexed[\s\S]*\/stock-locations\/transfers/, 'os produtos selecionados devem ser enviados em sequencia ao mesmo destino');
assert.match(activity, /put\("from_location_id", line\.item\.locationId\)/, 'cada item deve usar sua propria caixa de origem');
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
assert.match(bluetoothPrinterClient, /MARKLIFE_P50[\s\S]*GENERIC_ESC_POS/, 'o app deve manter perfis separados para P50 e impressora generica');
assert.match(activity, /Perfil da impressora[\s\S]*PrinterProfile\.entries/, 'a tela deve permitir escolher o perfil de impressao');
assert.match(activity, /Impressora Bluetooth pareada[\s\S]*genericPrinterClient\.pairedDevices/, 'o perfil generico deve listar dispositivos pareados');
assert.match(activity, /GENERIC_PRINTER_ADDRESS_KEY[\s\S]*putString\(GENERIC_PRINTER_ADDRESS_KEY/, 'a impressora generica escolhida deve permanecer salva');
assert.match(genericPrinterClient, /00001101-0000-1000-8000-00805f9b34fb/, 'a impressora generica deve usar o canal serial Bluetooth SPP');
assert.match(genericPrinterClient, /write\(GS\)[\s\S]*write\(0x76\)[\s\S]*write\(0x30\)/, 'o perfil generico deve enviar raster ESC POS');
assert.match(genericPrinterClient, /repeat\(copies\)[\s\S]*write\(image\)[\s\S]*write\(FORM_FEED\)/, 'as copias genericas devem ser enviadas em um unico lote com avanco');
assert.match(activity, /text = "−"[\s\S]*updateCopies\(-1\)/, 'a quantidade deve ter botao para diminuir');
assert.match(activity, /text = "\+"[\s\S]*updateCopies\(1\)/, 'a quantidade deve ter botao para aumentar');
assert.match(activity, /setSelectAllOnFocus\(true\)/, 'a quantidade deve selecionar todo o valor ao receber foco');
assert.match(activity, /MotionEvent\.ACTION_UP[\s\S]*selectAll\(\)/, 'um toque na quantidade deve permitir digitar por cima');
assert.match(buildGradle, /versionCode = 44/, 'o APK atualizado deve ter novo versionCode');
assert.match(buildGradle, /versionName = "0\.10\.1"/, 'o APK atualizado deve mostrar a nova versao');
assert.match(buildGradle, /firebase-messaging/, 'o APK deve receber notificacoes pelo Firebase Cloud Messaging');
assert.match(activity, /salesChannelRow\(SalesChannel\.ONLINE, SalesChannel\.PDV\)/, 'Online e PDV devem ocupar a primeira linha');
assert.match(activity, /salesChannelRow\(SalesChannel\.SHOPEE, SalesChannel\.TIKTOK\)/, 'Shopee e TikTok devem ocupar a segunda linha');
assert.match(activity, /showSaleDetailsFromApi/, 'a notificacao deve abrir os detalhes da venda');
assert.match(saleModel, /data class SaleSummary/, 'o app deve normalizar os detalhes de cada venda');
assert.match(saleModel, /enum class SaleStatusGroup[\s\S]*NEW\("Novas"\)[\s\S]*TO_SHIP\("A enviar"\)[\s\S]*SHIPPED\("Enviadas"\)[\s\S]*CANCELLED\("Canceladas"\)[\s\S]*OTHER\("Outras"\)/, 'as vendas devem oferecer os filtros operacionais pedidos');
assert.match(saleModel, /fun localized\(value: String\)[\s\S]*"READY_TO_SHIP" to "Pronta para envio"[\s\S]*"CANCELLED" to "Cancelada"/, 'status externos devem ser traduzidos para portugues');
assert.match(activity, /SaleStatusGroup\.entries[\s\S]*Filtrar por situação/, 'a lista de vendas deve mostrar o seletor de situacao');
assert.match(activity, /currentSalesFilter: SaleStatusGroup = SaleStatusGroup\.TO_SHIP/, 'o filtro A enviar deve iniciar pre-selecionado');
assert.match(activity, /currentSalesFilter = SaleStatusGroup\.TO_SHIP[\s\S]*showSalesList\(channel\)/, 'trocar o canal deve restaurar o filtro A enviar');
assert.match(activity, /sales\.filter\(filter::accepts\)/, 'o seletor deve filtrar os registros carregados');
assert.match(activity, /sale\.localizedStatus/, 'cards e detalhes devem evitar status em ingles');
assert.match(saleModel, /data class SalePaymentDetail/, 'o PDV deve preservar cada pagamento e suas taxas');
assert.match(saleModel, /val formattedPayment:[\s\S]*Taxa da operadora/, 'os detalhes devem mostrar parcelas, acrescimos e taxa da operadora');
assert.match(activity, /sale\.formattedPayment/, 'a tela da venda deve exibir o pagamento detalhado');
assert.match(pushService, /FirebaseMessagingService/, 'o app deve receber push mesmo fora da tela de vendas');
assert.match(pushRegistration, /\/admin\/mobile-push\/devices/, 'o aparelho deve registrar o token na VPS');
assert.match(buildGradle, /com\.google\.zxing:core/, 'o app deve incluir o encoder de QR e codigo de barras');
assert.match(manifest, /android\.permission\.BLUETOOTH"[\s\S]*android:maxSdkVersion="30"/, 'Android 8-11 precisa da permissao Bluetooth legada');
assert.match(manifest, /android\.permission\.BLUETOOTH_CONNECT/, 'Android 12+ precisa de BLUETOOTH_CONNECT para dispositivo pareado');
assert.match(manifest, /android\.permission\.CAMERA/, 'o leitor deve declarar permissao de camera');
assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/, 'Android 13+ precisa da permissao de notificacoes');
assert.match(manifest, /com\.google\.firebase\.MESSAGING_EVENT/, 'o manifesto deve declarar o servico FCM');
assert.doesNotMatch(manifest, /android\.permission\.BLUETOOTH_SCAN/, 'o app nao deve pedir permissao de scan sem executar descoberta');

console.log('android admin VPS contract: OK');
