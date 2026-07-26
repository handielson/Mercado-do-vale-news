package br.com.mercadodovale.adminestoque

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import br.com.mercadodovale.adminestoque.data.VpsApiClient
import br.com.mercadodovale.adminestoque.domain.LabelSize
import br.com.mercadodovale.adminestoque.domain.ProductLabelProduct
import br.com.mercadodovale.adminestoque.domain.StockLocationBox
import br.com.mercadodovale.adminestoque.domain.StockLocationContent
import br.com.mercadodovale.adminestoque.domain.StockTransferLine
import br.com.mercadodovale.adminestoque.printing.LabelRenderer
import br.com.mercadodovale.adminestoque.printing.P50PrinterClient
import br.com.mercadodovale.adminestoque.printing.PrinterConnectionState
import br.com.mercadodovale.adminestoque.ui.PrinterStatusView
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class MainActivity : Activity(), P50PrinterClient.Listener {
    private var token: String? = null
    private var currentLabelProduct: ProductLabelProduct? = null
    private var currentLabelSize = LabelSize.default
    private var currentScreen = SCREEN_DASHBOARD
    private var currentStockLocationId: String? = null
    private var currentStockLocationName: String? = null
    private var currentTransferLines: List<StockTransferLine> = emptyList()
    private var currentTransferTargetId: String? = null
    private var labelPreview: ImageView? = null
    private var printerIndicator: PrinterStatusView? = null
    private var printerStatusText: TextView? = null
    private var printerConnectButton: Button? = null
    private var currentPrinterMessage = "Impressora desconectada."
    private var pendingCameraAction: (() -> Unit)? = null
    private lateinit var printerClient: P50PrinterClient
    private val green = Color.rgb(11, 107, 58)
    private val blue = Color.rgb(37, 99, 235)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        printerClient = P50PrinterClient(applicationContext, this)
        token = sessionPreferences.getString(SESSION_TOKEN_KEY, null)
        currentLabelProduct = (
            savedInstanceState?.getString(STATE_LABEL_PRODUCT)
                ?: sessionPreferences.getString(LABEL_PRODUCT_KEY, null)
            )?.let { ProductLabelProduct.fromStateJson(it) }
        currentScreen = savedInstanceState?.getString(STATE_SCREEN) ?: SCREEN_DASHBOARD
        currentStockLocationId = savedInstanceState?.getString(STATE_STOCK_LOCATION_ID)
        currentStockLocationName = savedInstanceState?.getString(STATE_STOCK_LOCATION_NAME)
        currentTransferLines = savedInstanceState
            ?.getString(STATE_TRANSFER_LINES)
            ?.let(StockTransferLine::fromStateJson)
            .orEmpty()
        currentTransferTargetId = savedInstanceState?.getString(STATE_TRANSFER_TARGET_ID)
        if (token.isNullOrBlank()) {
            showLogin()
        } else {
            when (currentScreen) {
                SCREEN_LABELS -> showLabels()
                SCREEN_STOCK_CONTENTS -> {
                    val locationId = currentStockLocationId
                    if (locationId.isNullOrBlank()) showStockLocations()
                    else showStockLocationContents(
                        locationId,
                        currentStockLocationName ?: "Caixa",
                    )
                }
                SCREEN_STOCK_TRANSFER -> {
                    if (currentTransferLines.isEmpty() || currentStockLocationId.isNullOrBlank()) {
                        showStockLocations()
                    } else {
                        showStockBatchTransfer(currentTransferLines)
                    }
                }
                SCREEN_STOCK -> showStockLocations()
                SCREEN_PERMISSIONS -> showPermissions()
                else -> showDashboard()
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(STATE_SCREEN, currentScreen)
        outState.putString(STATE_STOCK_LOCATION_ID, currentStockLocationId)
        outState.putString(STATE_STOCK_LOCATION_NAME, currentStockLocationName)
        outState.putString(STATE_TRANSFER_TARGET_ID, currentTransferTargetId)
        currentLabelProduct?.let { outState.putString(STATE_LABEL_PRODUCT, it.toStateJson()) }
        if (currentTransferLines.isNotEmpty()) {
            outState.putString(
                STATE_TRANSFER_LINES,
                StockTransferLine.toStateJson(currentTransferLines),
            )
        }
    }

    override fun onDestroy() {
        printerClient.close()
        super.onDestroy()
    }

    override fun onPrinterState(state: PrinterConnectionState, message: String) {
        runOnUiThread {
            currentPrinterMessage = message
            printerIndicator?.setState(state)
            printerStatusText?.apply {
                text = message
                setTextColor(
                    when (state) {
                        PrinterConnectionState.CONNECTED -> Color.rgb(21, 128, 61)
                        PrinterConnectionState.PRINTING -> blue
                        PrinterConnectionState.ERROR -> Color.rgb(185, 28, 28)
                        else -> Color.DKGRAY
                    }
                )
            }
            printerConnectButton?.apply {
                visibility = if (
                    state == PrinterConnectionState.CONNECTED ||
                    state == PrinterConnectionState.PRINTING
                ) View.GONE else View.VISIBLE
                isEnabled = state != PrinterConnectionState.CONNECTING
                text = if (state == PrinterConnectionState.CONNECTING) {
                    "Conectando à Marklife P50…"
                } else {
                    "Conectar à Marklife P50"
                }
            }
        }
    }

    private fun screen(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(24), dp(20), dp(24), dp(32))
        setBackgroundColor(Color.rgb(248, 250, 248))
        setOnApplyWindowInsetsListener { view, insets ->
            view.setPadding(dp(24), systemBarTop(insets) + dp(20), dp(24), dp(32))
            insets
        }
    }

    private fun showContent(root: LinearLayout) {
        printerIndicator = null
        printerStatusText = null
        printerConnectButton = null
        labelPreview = null
        setContentView(ScrollView(this).apply {
            isFillViewport = true
            addView(root)
        })
    }

    private fun showLogin() {
        currentScreen = SCREEN_LOGIN
        val root = screen()
        root.addView(text("Gestão MDV", 30, green))
        root.addView(text("Entre com uma conta administrativa da VPS.", 16, Color.DKGRAY))
        val user = field("E-mail ou CPF")
        val password = field("Senha", true)
        val status = text("", 14, Color.DKGRAY)
        root.addView(user)
        root.addView(password)
        root.addView(button("Entrar") {
            status.text = "Autenticando…"
            runAsync {
                val result = VpsApiClient.login(user.text.toString(), password.text.toString())
                runOnUiThread {
                    result.fold(
                        onSuccess = { accessToken ->
                            token = accessToken
                            sessionPreferences.edit().putString(SESSION_TOKEN_KEY, accessToken).apply()
                            showDashboard()
                        },
                        onFailure = { status.text = it.message ?: "Não foi possível entrar." },
                    )
                }
            }
        })
        root.addView(status)
        root.addView(appVersionText())
        showContent(root)
    }

    private fun showDashboard() {
        currentScreen = SCREEN_DASHBOARD
        val root = screen()
        root.addView(text("Gestão MDV", 30, green))
        root.addView(text("Escolha uma operação", 16, Color.DKGRAY))
        root.addView(card("Movimentar estoque", "Consultar caixas e os produtos guardados em cada local.") { showStockLocations() })
        root.addView(card("Imprimir etiquetas", "Visualizar a etiqueta e imprimir na Marklife P50.") { showLabels() })
        root.addView(card("Permissões do celular", permissionSummary()) { showPermissions() })
        root.addView(button("Sair") {
            token = null
            currentLabelProduct = null
            sessionPreferences.edit()
                .remove(SESSION_TOKEN_KEY)
                .remove(LABEL_PRODUCT_KEY)
                .apply()
            printerClient.close()
            showLogin()
        })
        root.addView(appVersionText())
        showContent(root)
    }

    private fun showPermissions() {
        currentScreen = SCREEN_PERMISSIONS
        val root = screen()
        root.addView(back("Permissões do celular") { showDashboard() })
        root.addView(text("O aplicativo pede somente o necessário para ler códigos e conectar à impressora.", 16, Color.DKGRAY))

        val cameraGranted = hasCameraPermission()
        root.addView(permissionCard("Câmera", cameraGranted, "Leitura de QR, EAN, Code 128 e Code 39."))
        if (!cameraGranted) root.addView(button("Permitir câmera") {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA)
        })

        val bluetoothGranted = hasBluetoothPermission()
        val bluetoothEnabled = getSystemService(BluetoothManager::class.java)?.adapter?.isEnabled == true
        root.addView(permissionCard("Bluetooth", bluetoothGranted && bluetoothEnabled, "Conexão com a Marklife P50 já pareada."))
        if (!bluetoothGranted && Build.VERSION.SDK_INT >= 31) root.addView(button("Permitir dispositivos próximos") {
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), REQUEST_BLUETOOTH)
        })
        if (bluetoothGranted && !bluetoothEnabled) root.addView(button("Ativar Bluetooth") {
            startActivity(Intent(android.bluetooth.BluetoothAdapter.ACTION_REQUEST_ENABLE))
        })

        root.addView(text("O app não precisa acessar fotos, arquivos, localização, contatos ou telefone.", 14, Color.DKGRAY))
        root.addView(button("Abrir configurações do aplicativo") { openAppSettings() })
        showContent(root)
    }

    private fun showStockLocations() {
        currentScreen = SCREEN_STOCK
        currentStockLocationId = null
        currentStockLocationName = null
        currentTransferLines = emptyList()
        currentTransferTargetId = null
        val root = screen()
        root.addView(back("Movimentar estoque") { showDashboard() })
        root.addView(text("Movimentar estoque", 27, green))

        root.addView(text("1. Pesquisar produto individual", 19, Color.rgb(15, 23, 42)))
        root.addView(text("Pesquise pelo nome, SKU, EAN ou leia o código do produto.", 14, Color.DKGRAY))
        val productQuery = field("Nome, SKU ou EAN")
        val productStatus = text("", 14, Color.DKGRAY)
        val productResults = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        root.addView(productQuery)
        root.addView(button("Pesquisar produto") {
            searchStockProduct(productQuery.text.toString(), productStatus, productResults)
        })
        root.addView(button("Ler código do produto") {
            ensureCameraPermission(productStatus) {
                launchScanner { value ->
                    productQuery.setText(value)
                    searchStockProduct(value, productStatus, productResults)
                }
            }
        })
        root.addView(productStatus)
        root.addView(productResults)

        root.addView(text("2. Abrir uma caixa pelo QR", 19, Color.rgb(15, 23, 42)))
        root.addView(text("Leia a etiqueta da caixa para escolher um ou vários produtos.", 14, Color.DKGRAY))
        val status = text("Carregando caixas…", 14, Color.DKGRAY)
        val list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        var loadedLocations = emptyList<StockLocationBox>()
        root.addView(button("Ler QR da caixa e selecionar produtos") {
            ensureCameraPermission(status) {
                launchScanner { value ->
                    val locationId = StockLocationBox.idFromQr(value)
                    val location = loadedLocations.firstOrNull { it.id == locationId }
                    if (location == null) {
                        status.text = "Este QR não pertence a uma caixa cadastrada."
                    } else {
                        showStockLocationContents(location.id, location.displayName)
                    }
                }
            }
        })
        root.addView(status)
        root.addView(text("Ou selecione uma caixa:", 15, Color.DKGRAY))
        root.addView(list)
        showContent(root)

        runAsync {
            VpsApiClient(token.orEmpty()).get("/stock-locations/locations").fold(
                onSuccess = { body ->
                    runCatching { StockLocationBox.parseList(body) }.fold(
                        onSuccess = { locations ->
                            runOnUiThread {
                                if (currentScreen != SCREEN_STOCK) return@runOnUiThread
                                loadedLocations = locations
                                list.removeAllViews()
                                status.text = if (locations.isEmpty()) {
                                    "Nenhuma caixa cadastrada."
                                } else {
                                    "${locations.size} caixa(s) encontrada(s)."
                                }
                                locations.forEach { location ->
                                    list.addView(
                                        card(
                                            location.displayName,
                                            location.description ?: "Toque para visualizar os produtos.",
                                        ) {
                                            showStockLocationContents(location.id, location.displayName)
                                        },
                                    )
                                }
                            }
                        },
                        onFailure = { error ->
                            runOnUiThread {
                                status.text = error.message ?: "Não foi possível ler as caixas."
                            }
                        },
                    )
                },
                onFailure = { error ->
                    runOnUiThread {
                        handleProtectedApiFailure(
                            error,
                            status,
                            "Não foi possível carregar as caixas.",
                        )
                    }
                },
            )
        }
    }

    private fun searchStockProduct(
        rawQuery: String,
        status: TextView,
        results: LinearLayout,
    ) {
        val query = rawQuery.trim()
        if (query.isBlank()) {
            status.text = "Informe o nome, SKU ou EAN do produto."
            return
        }
        status.text = "Pesquisando produto…"
        results.removeAllViews()
        runAsync {
            val encoded = URLEncoder.encode(query, "UTF-8")
            VpsApiClient(token.orEmpty())
                .get("/products?search=$encoded&compact=true&limit=12")
                .fold(
                    onSuccess = { body ->
                        runCatching {
                            ProductLabelProduct.parseList(body)
                                .filter { it.stockQuantity > 0 }
                                .take(8)
                        }.fold(
                            onSuccess = { products ->
                                runOnUiThread {
                                    if (currentScreen != SCREEN_STOCK) return@runOnUiThread
                                    status.text = if (products.isEmpty()) {
                                        "Nenhum produto com estoque foi encontrado."
                                    } else {
                                        "Selecione o produto que deseja movimentar."
                                    }
                                    if (products.size == 1) {
                                        loadProductStockSources(products.first(), status, results)
                                    } else {
                                        products.forEach { product ->
                                            results.addView(
                                                stockSearchProductRow(product) {
                                                    loadProductStockSources(product, status, results)
                                                },
                                            )
                                        }
                                    }
                                }
                            },
                            onFailure = { error ->
                                runOnUiThread {
                                    status.text = error.message ?: "Não foi possível ler os produtos."
                                }
                            },
                        )
                    },
                    onFailure = { error ->
                        runOnUiThread {
                            status.text = error.message ?: "Não foi possível pesquisar o produto."
                        }
                    },
                )
        }
    }

    private fun loadProductStockSources(
        product: ProductLabelProduct,
        status: TextView,
        results: LinearLayout,
    ) {
        status.text = "Localizando ${product.name} nas caixas…"
        results.removeAllViews()
        runAsync {
            val productId = URLEncoder.encode(product.id, "UTF-8")
            VpsApiClient(token.orEmpty())
                .get("/stock-locations/products/$productId/distribution")
                .fold(
                    onSuccess = { body ->
                        runCatching {
                            StockLocationContent.parseDistribution(body, product)
                        }.fold(
                            onSuccess = { sources ->
                                runOnUiThread {
                                    if (currentScreen != SCREEN_STOCK) return@runOnUiThread
                                    results.removeAllViews()
                                    results.addView(stockSearchProductRow(product, null))
                                    results.addView(text("Localizado em:", 17, Color.rgb(15, 23, 42)))
                                    status.text = if (sources.isEmpty()) {
                                        "Este produto não possui saldo disponível em nenhuma caixa."
                                    } else {
                                        "${sources.size} localização(ões) encontrada(s). Escolha a origem."
                                    }
                                    sources.forEach { source ->
                                        results.addView(
                                            card(
                                                source.locationName,
                                                "Disponível: ${source.available} • físico: ${source.quantity}" +
                                                    if (source.reservedQuantity > 0) {
                                                        " • reservado: ${source.reservedQuantity}"
                                                    } else {
                                                        ""
                                                    },
                                            ) {
                                                currentStockLocationId = source.locationId
                                                currentStockLocationName = source.locationName
                                                showStockTransfer(source)
                                            },
                                        )
                                    }
                                }
                            },
                            onFailure = { error ->
                                runOnUiThread {
                                    status.text = error.message ?: "Não foi possível ler a distribuição do produto."
                                }
                            },
                        )
                    },
                    onFailure = { error ->
                        runOnUiThread {
                            handleProtectedApiFailure(
                                error,
                                status,
                                "Não foi possível localizar o produto nas caixas.",
                            )
                        }
                    },
                )
        }
    }

    private fun stockSearchProductRow(
        product: ProductLabelProduct,
        action: (() -> Unit)?,
    ): View = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(12), dp(12), dp(12), dp(12))
        setBackgroundColor(Color.WHITE)
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = dp(10) }

        val photo = ImageView(this@MainActivity).apply {
            layoutParams = LinearLayout.LayoutParams(dp(96), dp(96)).apply {
                marginEnd = dp(14)
            }
            scaleType = ImageView.ScaleType.FIT_CENTER
            setPadding(dp(4), dp(4), dp(4), dp(4))
            setBackgroundColor(Color.rgb(248, 250, 252))
            contentDescription = "Foto de ${product.name}"
        }
        addView(photo)
        addView(
            LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    1f,
                )
                addView(text(product.name, 16, Color.rgb(15, 23, 42)))
                addView(text("SKU: ${product.sku.ifBlank { "-" }}", 14, Color.DKGRAY))
                if (product.ean.isNotBlank()) {
                    addView(text("EAN: ${product.ean}", 13, Color.DKGRAY))
                }
                addView(text("Estoque total: ${product.stockQuantity}", 14, green))
                if (action != null) {
                    addView(text("Toque para ver onde está localizado", 13, blue))
                }
            },
        )
        loadProductImage(product.imageUrl, photo)
        if (action != null) {
            isClickable = true
            isFocusable = true
            setOnClickListener { action() }
        }
    }

    private fun showStockLocationContents(locationId: String, locationName: String) {
        currentScreen = SCREEN_STOCK_CONTENTS
        currentStockLocationId = locationId
        currentStockLocationName = locationName
        currentTransferLines = emptyList()
        currentTransferTargetId = null
        val root = screen()
        root.addView(back(locationName) { showStockLocations() })
        root.addView(text(locationName, 27, green))
        root.addView(text("Produtos guardados nesta caixa", 16, Color.DKGRAY))
        root.addView(text("Use “Movimentar” no produto que deseja enviar para outra caixa.", 14, Color.DKGRAY))
        val status = text("Carregando produtos…", 14, Color.DKGRAY)
        val itemsView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        val selectedItems = linkedMapOf<String, StockSelectionRow>()
        val rows = linkedMapOf<String, StockSelectionRow>()
        val moveSelected = button("Movimentar selecionados (0)") {
            val lines = selectedItems.values.mapNotNull { row ->
                val amount = row.quantity.text.toString().toIntOrNull()
                when {
                    amount == null || amount <= 0 -> {
                        status.text = "Informe uma quantidade válida para ${row.item.productName}."
                        null
                    }
                    amount > row.item.available -> {
                        status.text = "${row.item.productName}: máximo disponível ${row.item.available}."
                        null
                    }
                    else -> StockTransferLine(row.item, amount)
                }
            }
            if (lines.size == selectedItems.size && lines.isNotEmpty()) {
                showStockBatchTransfer(lines)
            } else if (selectedItems.isEmpty()) {
                status.text = "Marque pelo menos um produto para movimentar."
            }
        }.apply { isEnabled = false }
        fun refreshSelectionAction() {
            moveSelected.text = "Movimentar selecionados (${selectedItems.size})"
            moveSelected.isEnabled = selectedItems.isNotEmpty()
        }

        root.addView(status)
        root.addView(
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                addView(button("Selecionar todos") {
                    rows.values.forEach { row ->
                        if (row.item.available > 0) row.checkBox.isChecked = true
                    }
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                addView(button("Limpar seleção") {
                    rows.values.forEach { it.checkBox.isChecked = false }
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            },
        )
        root.addView(moveSelected)
        root.addView(itemsView)
        showContent(root)

        runAsync {
            val path = "/stock-locations/locations/${URLEncoder.encode(locationId, "UTF-8")}/contents"
            VpsApiClient(token.orEmpty()).get(path).fold(
                onSuccess = { body ->
                    runCatching { StockLocationContent.parseList(body) }.fold(
                        onSuccess = { items ->
                            runOnUiThread {
                                if (
                                    currentScreen != SCREEN_STOCK_CONTENTS ||
                                    currentStockLocationId != locationId
                                ) return@runOnUiThread
                                itemsView.removeAllViews()
                                status.text = if (items.isEmpty()) {
                                    "Esta caixa está vazia."
                                } else {
                                    "${items.size} produto(s) nesta caixa."
                                }
                                items.forEach { item ->
                                    val row = stockLocationProductRow(item) { checked, selectionRow ->
                                        if (checked) {
                                            selectedItems[item.productId] = selectionRow
                                        } else {
                                            selectedItems.remove(item.productId)
                                        }
                                        refreshSelectionAction()
                                    }
                                    rows[item.productId] = row
                                    itemsView.addView(row.view)
                                }
                            }
                        },
                        onFailure = { error ->
                            runOnUiThread {
                                status.text = error.message ?: "Não foi possível ler os produtos."
                            }
                        },
                    )
                },
                onFailure = { error ->
                    runOnUiThread {
                        handleProtectedApiFailure(
                            error,
                            status,
                            "Não foi possível abrir esta caixa.",
                        )
                    }
                },
            )
        }
    }

    private data class StockSelectionRow(
        val item: StockLocationContent,
        val view: View,
        val checkBox: CheckBox,
        val quantity: EditText,
    )

    private fun stockLocationProductRow(
        item: StockLocationContent,
        onChecked: (Boolean, StockSelectionRow) -> Unit,
    ): StockSelectionRow {
        val checkBox = CheckBox(this).apply {
            isEnabled = item.available > 0
            contentDescription = "Selecionar ${item.productName}"
        }
        val quantity = field("Qtd.").apply {
            inputType = InputType.TYPE_CLASS_NUMBER
            setText("1")
            setSelectAllOnFocus(true)
            layoutParams = LinearLayout.LayoutParams(dp(76), LinearLayout.LayoutParams.WRAP_CONTENT)
            isEnabled = item.available > 0
        }
        val rowView = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(10), dp(10), dp(10))
            setBackgroundColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                bottomMargin = dp(10)
            }

            addView(checkBox)
            val photo = ImageView(this@MainActivity).apply {
                layoutParams = LinearLayout.LayoutParams(dp(72), dp(72)).apply {
                    marginEnd = dp(12)
                }
                scaleType = ImageView.ScaleType.FIT_CENTER
                setPadding(dp(4), dp(4), dp(4), dp(4))
                setBackgroundColor(Color.rgb(248, 250, 252))
                contentDescription = "Foto de ${item.productName}"
            }
            addView(photo)
            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    layoutParams = LinearLayout.LayoutParams(
                        0,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        1f,
                    )
                    addView(text(item.productName, 16, Color.rgb(15, 23, 42)))
                    addView(text("SKU: ${item.sku.ifBlank { "-" }}", 13, Color.DKGRAY))
                    addView(text("Disponível: ${item.available}", 13, Color.DKGRAY))
                },
            )
            addView(quantity)
            loadProductImage(item.imageUrl, photo)
        }
        val selectionRow = StockSelectionRow(item, rowView, checkBox, quantity)
        checkBox.setOnCheckedChangeListener { _, checked -> onChecked(checked, selectionRow) }
        return selectionRow
    }

    private fun showStockTransfer(item: StockLocationContent) {
        showStockBatchTransfer(listOf(StockTransferLine(item, 1)))
    }

    private fun showStockBatchTransfer(lines: List<StockTransferLine>) {
        val firstItem = lines.firstOrNull()?.item ?: run {
            showStockLocations()
            return
        }
        val sourceLocationId = currentStockLocationId ?: firstItem.locationId
        val sourceLocationName = currentStockLocationName ?: firstItem.locationName
        if (sourceLocationId.isBlank()) {
            showStockLocations()
            return
        }

        currentScreen = SCREEN_STOCK_TRANSFER
        currentTransferLines = lines
        val root = screen()
        root.addView(back("Movimentar produtos") {
            showStockLocationContents(sourceLocationId, sourceLocationName)
        })
        root.addView(text("Movimentar produtos", 27, green))
        root.addView(text("Origem: $sourceLocationName", 16, Color.DKGRAY))

        val quantityInputs = linkedMapOf<String, EditText>()
        lines.forEach { line ->
            root.addView(
                LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(dp(10), dp(8), dp(10), dp(8))
                    setBackgroundColor(Color.WHITE)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ).apply { bottomMargin = dp(8) }
                    addView(
                        LinearLayout(this@MainActivity).apply {
                            orientation = LinearLayout.VERTICAL
                            layoutParams = LinearLayout.LayoutParams(
                                0,
                                LinearLayout.LayoutParams.WRAP_CONTENT,
                                1f,
                            )
                            addView(text(line.item.productName, 15, Color.rgb(15, 23, 42)))
                            addView(
                                text(
                                    "SKU: ${line.item.sku.ifBlank { "-" }} • disponível: ${line.item.available}",
                                    13,
                                    Color.DKGRAY,
                                ),
                            )
                        },
                    )
                    val input = field("Qtd.").apply {
                        inputType = InputType.TYPE_CLASS_NUMBER
                        setText(line.quantity.toString())
                        setSelectAllOnFocus(true)
                        layoutParams = LinearLayout.LayoutParams(
                            dp(82),
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                        )
                    }
                    quantityInputs[line.item.productId] = input
                    addView(input)
                },
            )
        }
        val reason = field("Motivo (opcional)").apply {
            setText("Movimentação pelo aplicativo Android")
        }
        val status = text("Carregando caixas de destino…", 14, Color.DKGRAY)
        val selectedTarget = text("Destino: selecione uma caixa", 16, Color.DKGRAY)
        val targetList = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        var locations = emptyList<StockLocationBox>()
        var target: StockLocationBox? = null

        fun selectTarget(location: StockLocationBox) {
            if (location.id == sourceLocationId) {
                status.text = "A caixa de destino precisa ser diferente da origem."
                return
            }
            target = location
            currentTransferTargetId = location.id
            selectedTarget.text = "Destino: ${location.displayName}"
            selectedTarget.setTextColor(green)
            status.text = "Destino selecionado. Confira a quantidade e confirme."
        }

        root.addView(reason)
        root.addView(selectedTarget)
        root.addView(button("Ler QR da caixa de destino") {
            ensureCameraPermission(status) {
                launchScanner { value ->
                    val targetId = StockLocationBox.idFromQr(value)
                    val scanned = locations.firstOrNull { it.id == targetId }
                    if (scanned == null) {
                        status.text = "Este QR não pertence a uma caixa cadastrada."
                    } else {
                        selectTarget(scanned)
                    }
                }
            }
        })
        root.addView(text("Ou selecione a caixa de destino:", 15, Color.DKGRAY))
        root.addView(targetList)
        root.addView(status)

        lateinit var confirm: Button
        confirm = button("Confirmar movimentação de ${lines.size} produto(s)") {
            val selected = target
            val prepared = mutableListOf<StockTransferLine>()
            var validationError: String? = null
            lines.forEach { line ->
                val amount = quantityInputs[line.item.productId]?.text.toString().toIntOrNull()
                when {
                    amount == null || amount <= 0 ->
                        validationError = "Informe uma quantidade válida para ${line.item.productName}."
                    amount > line.item.available ->
                        validationError = "${line.item.productName}: máximo disponível ${line.item.available}."
                    line.item.depositId.isBlank() ->
                        validationError = "${line.item.productName} não possui depósito de origem válido."
                    else -> prepared += StockTransferLine(line.item, amount)
                }
            }
            when {
                selected == null ->
                    status.text = "Selecione ou leia o QR da caixa de destino."
                selected.depositId.isBlank() ->
                    status.text = "A caixa de destino não possui depósito válido."
                validationError != null ->
                    status.text = validationError
                else -> {
                    confirm.isEnabled = false
                    status.text = "Movimentando 0 de ${prepared.size} produto(s)…"
                    runAsync {
                        var succeeded = 0
                        val failures = mutableListOf<String>()
                        prepared.forEachIndexed { index, line ->
                            runOnUiThread {
                                status.text = "Movimentando ${index + 1} de ${prepared.size}: ${line.item.productName}"
                            }
                            val payload = JSONObject()
                                .put("product_id", line.item.productId)
                                .put("from_deposit_id", line.item.depositId)
                                .put("from_location_id", sourceLocationId)
                                .put("to_deposit_id", selected.depositId)
                                .put("to_location_id", selected.id)
                                .put("quantity", line.quantity)
                                .put("reason", reason.text.toString().trim().ifBlank {
                                    "Movimentação pelo aplicativo Android"
                                })
                                .put(
                                    "notes",
                                    "Origem: $sourceLocationName; destino: ${selected.displayName}",
                                )
                            VpsApiClient(token.orEmpty())
                                .post("/stock-locations/transfers", payload)
                                .fold(
                                    onSuccess = { succeeded += 1 },
                                    onFailure = {
                                        failures += "${line.item.sku.ifBlank { line.item.productName }}: ${it.message ?: "falha"}"
                                    },
                                )
                        }
                        runOnUiThread {
                            val message = if (failures.isEmpty()) {
                                "$succeeded produto(s) movimentado(s) para ${selected.displayName}."
                            } else {
                                "$succeeded concluído(s); ${failures.size} falharam: ${failures.take(2).joinToString()}"
                            }
                            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                            currentTransferLines = emptyList()
                            currentTransferTargetId = null
                            showStockLocationContents(sourceLocationId, sourceLocationName)
                        }
                    }
                }
            }
        }
        root.addView(confirm)
        showContent(root)

        runAsync {
            VpsApiClient(token.orEmpty()).get("/stock-locations/locations").fold(
                onSuccess = { body ->
                    runCatching { StockLocationBox.parseList(body) }.fold(
                        onSuccess = { loaded ->
                            runOnUiThread {
                                if (currentScreen != SCREEN_STOCK_TRANSFER) return@runOnUiThread
                                locations = loaded.filter { it.id != sourceLocationId }
                                targetList.removeAllViews()
                                locations.forEach { location ->
                                    targetList.addView(
                                        card(
                                            location.displayName,
                                            location.description ?: "Usar como destino",
                                        ) { selectTarget(location) },
                                    )
                                }
                                currentTransferTargetId
                                    ?.let { id -> locations.firstOrNull { it.id == id } }
                                    ?.let(::selectTarget)
                                if (locations.isEmpty()) {
                                    status.text = "Não existe outra caixa disponível para receber o produto."
                                } else if (target == null) {
                                    status.text = "Selecione uma caixa de destino."
                                }
                            }
                        },
                        onFailure = { error ->
                            runOnUiThread {
                                status.text = error.message ?: "Não foi possível ler as caixas."
                            }
                        },
                    )
                },
                onFailure = { error ->
                    runOnUiThread {
                        handleProtectedApiFailure(
                            error,
                            status,
                            "Não foi possível carregar as caixas de destino.",
                        )
                    }
                },
            )
        }
    }

    private fun showLabels() {
        currentScreen = SCREEN_LABELS
        val root = screen()
        root.addView(back("Imprimir etiquetas") { showDashboard() })

        val printerRow = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 0, 0, dp(12))
        }
        val indicator = PrinterStatusView(this).also {
            it.setState(printerClient.state)
            printerIndicator = it
        }
        val printerText = text(currentPrinterMessage, 15, Color.DKGRAY).also {
            printerStatusText = it
            it.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        printerRow.addView(indicator)
        printerRow.addView(printerText)
        root.addView(printerRow)

        val query = field("SKU, EAN ou código do produto").apply {
            setText(currentLabelProduct?.sku.orEmpty())
        }
        val searchStatus = text("", 14, Color.DKGRAY)
        val photo = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(280)).apply {
                bottomMargin = dp(12)
            }
            scaleType = ImageView.ScaleType.FIT_CENTER
            setPadding(dp(8), dp(8), dp(8), dp(8))
            setBackgroundColor(Color.WHITE)
            contentDescription = "Foto do produto"
        }
        val productDetails = text("Pesquise um produto para montar a etiqueta.", 16, Color.DKGRAY)
        val productLink = button("Abrir produto no site") {
            currentLabelProduct?.let { openUrl(it.publicUrl) }
        }.apply { isEnabled = currentLabelProduct != null }

        root.addView(query)
        root.addView(button("Buscar produto para etiqueta") {
            selectProductForLabel(query.text.toString(), searchStatus) { selected ->
                bindLabelProduct(selected, photo, productDetails, productLink)
            }
        })
        root.addView(button("Ler QR ou código do produto") {
            ensureCameraPermission(searchStatus) {
                launchScanner { value ->
                    query.setText(value)
                    selectProductForLabel(value, searchStatus) { selected ->
                        bindLabelProduct(selected, photo, productDetails, productLink)
                    }
                }
            }
        })
        root.addView(searchStatus)
        root.addView(photo)
        root.addView(productDetails)
        root.addView(productLink)

        val sizes = LabelSize.desktopDefaults
        val sizeSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, sizes)
            setSelection(sizes.indexOf(LabelSize.default))
        }
        val copies = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER
            setText("1")
            gravity = Gravity.CENTER
            textSize = 16f
            setSelectAllOnFocus(true)
            setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) post { selectAll() }
            }
            setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_UP) post { selectAll() }
                false
            }
            layoutParams = LinearLayout.LayoutParams(dp(64), dp(52))
        }
        fun updateCopies(delta: Int) {
            val current = copies.text.toString().toIntOrNull() ?: 1
            copies.setText((current + delta).coerceIn(1, 100).toString())
            copies.selectAll()
        }
        val copiesSelector = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                bottomMargin = dp(14)
            }
            addView(Button(this@MainActivity).apply {
                text = "−"
                contentDescription = "Diminuir quantidade"
                setOnClickListener { updateCopies(-1) }
                layoutParams = LinearLayout.LayoutParams(dp(52), dp(52))
            })
            addView(copies)
            addView(Button(this@MainActivity).apply {
                text = "+"
                contentDescription = "Aumentar quantidade"
                setOnClickListener { updateCopies(1) }
                layoutParams = LinearLayout.LayoutParams(dp(52), dp(52))
            })
        }
        val preview = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            setPadding(dp(1), dp(1), dp(1), dp(1))
            setBackgroundColor(Color.WHITE)
            contentDescription = "Pré-visualização da etiqueta"
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(200)).apply {
                bottomMargin = dp(14)
            }
        }
        labelPreview = preview
        fun updatePreview() {
            currentLabelSize = sizeSpinner.selectedItem as LabelSize
            val product = currentLabelProduct
            if (product == null) {
                preview.setImageDrawable(null)
                return
            }
            updatePreviewDimensions(preview, currentLabelSize)
            preview.setImageBitmap(LabelRenderer.render(product, currentLabelSize))
        }
        sizeSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = updatePreview()
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }

        root.addView(text("Tamanho da etiqueta", 15, Color.DKGRAY))
        root.addView(sizeSpinner)
        root.addView(text("Quantidade de cópias", 15, Color.DKGRAY))
        root.addView(copiesSelector)
        root.addView(text("O intervalo entre etiquetas será localizado automaticamente pela P50.", 13, Color.GRAY))
        root.addView(text("Pré-visualização — esta mesma imagem será enviada à P50", 14, Color.DKGRAY))
        root.addView(preview)
        val connectButton = button("Conectar à Marklife P50") { requestBluetoothAndConnect() }.apply {
            visibility = if (
                printerClient.state == PrinterConnectionState.CONNECTED ||
                printerClient.state == PrinterConnectionState.PRINTING
            ) View.GONE else View.VISIBLE
            isEnabled = printerClient.state != PrinterConnectionState.CONNECTING
            if (!isEnabled) text = "Conectando à Marklife P50…"
        }
        printerConnectButton = connectButton
        root.addView(connectButton)
        root.addView(button("Imprimir etiquetas") {
            val product = currentLabelProduct
            val quantity = copies.text.toString().toIntOrNull()
            when {
                product == null -> searchStatus.text = "Busque e selecione um produto antes de imprimir."
                quantity == null || quantity !in 1..100 -> searchStatus.text = "Informe uma quantidade entre 1 e 100."
                !printerClient.isReady -> {
                    searchStatus.text = "Conectando à P50. Aguarde o ícone ficar verde e toque em imprimir novamente."
                    requestBluetoothAndConnect()
                }
                else -> {
                    val bitmap = LabelRenderer.render(product, sizeSpinner.selectedItem as LabelSize)
                    preview.setImageBitmap(bitmap)
                    printerClient.print(bitmap, quantity) { result ->
                        runOnUiThread {
                            searchStatus.text = result.fold(
                                onSuccess = { "$quantity etiqueta(s) enviada(s) para a P50." },
                                onFailure = { it.message ?: "Falha ao imprimir." },
                            )
                        }
                    }
                }
            }
        })

        currentLabelProduct?.let {
            bindLabelProduct(it, photo, productDetails, productLink)
            updatePreview()
        }
        showContent(root)
        labelPreview = preview
        printerIndicator = indicator
        printerStatusText = printerText
        printerConnectButton = connectButton
        if (hasBluetoothPermission() && printerClient.state == PrinterConnectionState.DISCONNECTED) printerClient.connect()
    }

    private fun updatePreviewDimensions(preview: ImageView, size: LabelSize) {
        val availableWidthDp = resources.displayMetrics.run { (widthPixels / density).toInt() } - 48
        val proportionalHeightDp = availableWidthDp * size.heightMm / size.widthMm
        preview.layoutParams = (preview.layoutParams as LinearLayout.LayoutParams).apply {
            height = dp(proportionalHeightDp.coerceIn(120, 300))
        }
    }

    private fun bindLabelProduct(
        product: ProductLabelProduct,
        photo: ImageView,
        details: TextView,
        link: Button,
    ) {
        currentLabelProduct = product
        sessionPreferences.edit()
            .putString(LABEL_PRODUCT_KEY, product.toStateJson())
            .apply()
        details.text = buildString {
            append(product.name)
            append("\n\nPreço: ").append(product.formattedPrice)
            if (product.sku.isNotBlank()) append("\nSKU: ").append(product.sku)
            if (product.ean.isNotBlank()) append("\nEAN: ").append(product.ean)
            append("\nEstoque: ").append(product.stockQuantity).append(" un.")
            append("\n").append(product.publicUrl)
        }
        link.isEnabled = true
        loadProductImage(product.imageUrl, photo)
        refreshLabelPreview()
    }

    private fun refreshLabelPreview() {
        val product = currentLabelProduct ?: return
        labelPreview?.setImageBitmap(LabelRenderer.render(product, currentLabelSize))
    }

    private fun selectProductForLabel(
        rawQuery: String,
        status: TextView,
        onSelected: (ProductLabelProduct) -> Unit,
    ) {
        findProducts(rawQuery, status) { products ->
            val normalized = rawQuery.trim()
            val selected = products.firstOrNull {
                it.sku.equals(normalized, true) || it.ean.equals(normalized, true) || it.id.equals(normalized, true)
            } ?: products.firstOrNull()
            if (selected == null) status.text = "Nenhum produto encontrado."
            else {
                status.text = "Produto selecionado: ${selected.name}"
                onSelected(selected)
            }
        }
    }

    private fun searchProducts(rawQuery: String, result: TextView) {
        findProducts(rawQuery, result) { products ->
            result.text = if (products.isEmpty()) "Nenhum produto encontrado." else buildString {
                append("Produtos encontrados:\n")
                products.take(10).forEach { product ->
                    append("\n• ").append(product.name)
                    if (product.sku.isNotBlank()) append("\n  SKU: ").append(product.sku)
                    if (product.ean.isNotBlank()) append(" | EAN: ").append(product.ean)
                    append(" | ").append(product.formattedPrice)
                    append(" | Estoque: ").append(product.stockQuantity)
                    append('\n')
                }
            }
        }
    }

    private fun findProducts(rawQuery: String, result: TextView, onSuccess: (List<ProductLabelProduct>) -> Unit) {
        val value = rawQuery.trim()
        if (value.isBlank()) {
            result.text = "Informe ou leia um código."
            return
        }
        result.text = "Consultando estoque…"
        runAsync {
            val encoded = URLEncoder.encode(value, "UTF-8")
            val response = VpsApiClient(token.orEmpty()).get("/products?search=$encoded&compact=true&limit=10")
            runOnUiThread {
                response.fold(
                    onSuccess = { body ->
                        runCatching { ProductLabelProduct.parseList(body) }.fold(
                            onSuccess = onSuccess,
                            onFailure = {
                                result.text = try {
                                    JSONObject(body).optString("error", "Resposta inválida da API.")
                                } catch (_: Exception) {
                                    "Resposta inválida da API."
                                }
                            },
                        )
                    },
                    onFailure = { error ->
                        if (VpsApiClient.isUnauthorized(error)) {
                            token = null
                            sessionPreferences.edit().remove(SESSION_TOKEN_KEY).apply()
                            Toast.makeText(
                                this,
                                "Sua sessão expirou. Entre novamente.",
                                Toast.LENGTH_LONG,
                            ).show()
                            showLogin()
                        } else {
                            result.text = error.message ?: "Falha na consulta."
                        }
                    },
                )
            }
        }
    }

    private fun loadProductImage(imageUrl: String?, target: ImageView) {
        target.setImageDrawable(null)
        target.tag = imageUrl
        if (imageUrl.isNullOrBlank()) {
            target.contentDescription = "Produto sem foto"
            return
        }
        target.contentDescription = "Carregando foto do produto"
        runAsync {
            val bitmap = runCatching {
                val connection = URL(imageUrl).openConnection() as HttpURLConnection
                connection.connectTimeout = 12_000
                connection.readTimeout = 18_000
                connection.inputStream.use(BitmapFactory::decodeStream).also { connection.disconnect() }
            }.getOrNull()
            runOnUiThread {
                if (target.tag == imageUrl) {
                    if (bitmap != null) {
                        target.setImageBitmap(bitmap)
                        target.contentDescription = "Foto do produto"
                    } else {
                        target.contentDescription = "Não foi possível carregar a foto do produto"
                    }
                }
            }
        }
    }

    private fun ensureCameraPermission(status: TextView, action: () -> Unit) {
        if (hasCameraPermission()) action()
        else {
            pendingCameraAction = action
            status.text = "Autorize a câmera para ler o código."
            requestPermissions(arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA)
        }
    }

    private fun launchScanner(onValue: (String) -> Unit) {
        val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(
            Barcode.FORMAT_QR_CODE,
            Barcode.FORMAT_EAN_13,
            Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_CODE_128,
            Barcode.FORMAT_CODE_39,
        ).build()
        GmsBarcodeScanning.getClient(this, options).startScan()
            .addOnSuccessListener { barcode -> barcode.rawValue?.takeIf { it.isNotBlank() }?.let(onValue) }
            .addOnFailureListener { error -> Toast.makeText(this, "Não foi possível abrir o leitor: ${error.message}", Toast.LENGTH_LONG).show() }
    }

    private fun requestBluetoothAndConnect() {
        if (!hasBluetoothPermission() && Build.VERSION.SDK_INT >= 31) {
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), REQUEST_BLUETOOTH)
        } else {
            printerClient.connect()
        }
    }

    private fun hasCameraPermission(): Boolean =
        checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun hasBluetoothPermission(): Boolean =
        Build.VERSION.SDK_INT < 31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun permissionSummary(): String {
        val camera = if (hasCameraPermission()) "câmera autorizada" else "câmera pendente"
        val bluetooth = if (hasBluetoothPermission()) "Bluetooth autorizado" else "Bluetooth pendente"
        return "$camera • $bluetooth"
    }

    private fun permissionCard(title: String, granted: Boolean, description: String) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(14), dp(16), dp(14))
        setBackgroundColor(if (granted) Color.rgb(220, 252, 231) else Color.rgb(254, 242, 242))
        addView(text("${if (granted) "✓" else "!"}  $title", 18, if (granted) Color.rgb(21, 128, 61) else Color.rgb(185, 28, 28)))
        addView(text(description, 14, Color.DKGRAY))
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(12)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        when (requestCode) {
            REQUEST_CAMERA -> {
                val action = pendingCameraAction
                pendingCameraAction = null
                if (granted) action?.invoke()
                else Toast.makeText(this, "A câmera continua bloqueada. Você pode autorizá-la em Permissões do celular.", Toast.LENGTH_LONG).show()
            }
            REQUEST_BLUETOOTH -> {
                if (granted) printerClient.connect()
                else onPrinterState(PrinterConnectionState.ERROR, "Permissão Bluetooth não autorizada.")
            }
        }
    }

    private fun openAppSettings() {
        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
    }

    private fun openUrl(url: String) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            .onFailure { Toast.makeText(this, "Não foi possível abrir o link.", Toast.LENGTH_LONG).show() }
    }

    private fun field(hint: String, secret: Boolean = false) = EditText(this).apply {
        this.hint = hint
        textSize = 16f
        if (secret) inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(14)
        }
    }

    private fun text(value: String, size: Int, color: Int) = TextView(this).apply {
        text = value
        textSize = size.toFloat()
        setTextColor(color)
        setPadding(0, 0, 0, dp(12))
    }

    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        setOnClickListener { action() }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(12)
        }
    }

    private fun back(label: String, action: () -> Unit) = Button(this).apply {
        text = "‹  $label"
        setOnClickListener { action() }
    }

    private fun card(heading: String, detail: String, action: () -> Unit) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18), dp(18), dp(18), dp(18))
        setBackgroundColor(Color.WHITE)
        isClickable = true
        isFocusable = true
        setOnClickListener { action() }
        addView(text(heading, 21, green))
        addView(text(detail, 15, Color.DKGRAY))
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(16)
        }
    }

    private fun runAsync(work: () -> Unit) = Thread(work).start()

    private fun handleProtectedApiFailure(
        error: Throwable,
        status: TextView,
        fallbackMessage: String,
    ) {
        if (!VpsApiClient.isUnauthorized(error)) {
            status.text = error.message ?: fallbackMessage
            return
        }

        status.text = "Confirmando sua sessão…"
        val accessToken = token.orEmpty()
        runAsync {
            val sessionResult = VpsApiClient(accessToken).get("/auth/me")
            runOnUiThread {
                if (sessionResult.isSuccess) {
                    status.text = "Sua sessão continua ativa, mas o acesso aos locais foi recusado. Tente novamente."
                    return@runOnUiThread
                }

                val sessionError = sessionResult.exceptionOrNull()
                if (sessionError != null && VpsApiClient.isUnauthorized(sessionError)) {
                    token = null
                    sessionPreferences.edit().remove(SESSION_TOKEN_KEY).apply()
                    Toast.makeText(
                        this,
                        "Sua sessão expirou. Entre novamente.",
                        Toast.LENGTH_LONG,
                    ).show()
                    showLogin()
                } else {
                    status.text = sessionError?.message ?: fallbackMessage
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun systemBarTop(insets: WindowInsets): Int =
        if (Build.VERSION.SDK_INT >= 30) insets.getInsets(WindowInsets.Type.systemBars()).top
        else insets.systemWindowInsetTop

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun appVersionText() = text(
        "Versão ${BuildConfig.VERSION_NAME}",
        13,
        Color.GRAY,
    ).apply {
        gravity = Gravity.CENTER_HORIZONTAL
    }

    private val sessionPreferences by lazy {
        getSharedPreferences(SESSION_PREFERENCES, MODE_PRIVATE)
    }

    companion object {
        private const val REQUEST_BLUETOOTH = 41
        private const val REQUEST_CAMERA = 42
        private const val SESSION_PREFERENCES = "mdv_admin_session"
        private const val SESSION_TOKEN_KEY = "access_token"
        private const val LABEL_PRODUCT_KEY = "selected_label_product"
        private const val STATE_LABEL_PRODUCT = "state_label_product"
        private const val STATE_SCREEN = "state_screen"
        private const val STATE_STOCK_LOCATION_ID = "state_stock_location_id"
        private const val STATE_STOCK_LOCATION_NAME = "state_stock_location_name"
        private const val STATE_TRANSFER_LINES = "state_transfer_lines"
        private const val STATE_TRANSFER_TARGET_ID = "state_transfer_target_id"
        private const val SCREEN_LOGIN = "login"
        private const val SCREEN_DASHBOARD = "dashboard"
        private const val SCREEN_PERMISSIONS = "permissions"
        private const val SCREEN_STOCK = "stock"
        private const val SCREEN_STOCK_CONTENTS = "stock_contents"
        private const val SCREEN_STOCK_TRANSFER = "stock_transfer"
        private const val SCREEN_LABELS = "labels"
    }
}
