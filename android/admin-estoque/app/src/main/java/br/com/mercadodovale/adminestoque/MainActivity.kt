package br.com.mercadodovale.adminestoque

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.TimePickerDialog
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.graphics.Color
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.provider.OpenableColumns
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
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
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import br.com.mercadodovale.adminestoque.data.SalesCache
import br.com.mercadodovale.adminestoque.data.VpsApiClient
import br.com.mercadodovale.adminestoque.domain.LabelSize
import br.com.mercadodovale.adminestoque.domain.ProductLabelProduct
import br.com.mercadodovale.adminestoque.domain.SaleSummary
import br.com.mercadodovale.adminestoque.domain.SaleStatusGroup
import br.com.mercadodovale.adminestoque.domain.SalesChannel
import br.com.mercadodovale.adminestoque.domain.StockLocationBox
import br.com.mercadodovale.adminestoque.domain.StockLocationContent
import br.com.mercadodovale.adminestoque.domain.StockTransferLine
import br.com.mercadodovale.adminestoque.printing.BluetoothPrinterClient
import br.com.mercadodovale.adminestoque.printing.GenericEscPosPrinterClient
import br.com.mercadodovale.adminestoque.printing.LabelRenderer
import br.com.mercadodovale.adminestoque.printing.P50PrinterClient
import br.com.mercadodovale.adminestoque.printing.PrinterConnectionState
import br.com.mercadodovale.adminestoque.printing.PrinterProfile
import br.com.mercadodovale.adminestoque.push.PushRegistration
import br.com.mercadodovale.adminestoque.push.SalesNotificationContract
import br.com.mercadodovale.adminestoque.push.SalesSoundSettings
import br.com.mercadodovale.adminestoque.ui.PrinterStatusView
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.Normalizer
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MainActivity : Activity() {
    private var token: String? = null
    private var currentLabelProduct: ProductLabelProduct? = null
    private var currentLabelSize = LabelSize.default
    private var currentScreen = SCREEN_DASHBOARD
    private var currentStockLocationId: String? = null
    private var currentStockLocationName: String? = null
    private var currentTransferLines: List<StockTransferLine> = emptyList()
    private var currentTransferTargetId: String? = null
    private var currentSalesChannel: SalesChannel? = null
    private var currentSaleId: String? = null
    private var currentSalesFilter: SaleStatusGroup = SaleStatusGroup.TO_SHIP
    private var currentCustomLabelText: String = ""
    private var currentCustomLabelFontPercent: Int = 90
    private val syncingSalesChannels = mutableSetOf<SalesChannel>()
    private var saleReceiverRegistered = false
    private var labelPreview: ImageView? = null
    private var printerIndicator: PrinterStatusView? = null
    private var printerStatusText: TextView? = null
    private var printerConnectButton: Button? = null
    private var currentPrinterMessage = "Impressora desconectada."
    private var pendingCameraAction: (() -> Unit)? = null
    private lateinit var p50PrinterClient: P50PrinterClient
    private lateinit var genericPrinterClient: GenericEscPosPrinterClient
    private var activePrinterProfile = PrinterProfile.MARKLIFE_P50
    private val printerClient: BluetoothPrinterClient
        get() = when (activePrinterProfile) {
            PrinterProfile.MARKLIFE_P50 -> p50PrinterClient
            PrinterProfile.GENERIC_ESC_POS -> genericPrinterClient
        }
    private val green = Color.rgb(11, 107, 58)
    private val blue = Color.rgb(37, 99, 235)
    private val salePushReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val channel = SalesChannel.fromApiKey(
                intent?.getStringExtra(SalesNotificationContract.EXTRA_SALES_CHANNEL),
            ) ?: return
            if (
                currentScreen == SCREEN_SALES_LIST &&
                currentSalesChannel == channel &&
                channel !in syncingSalesChannels
            ) {
                showSalesList(channel)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        activePrinterProfile = PrinterProfile.fromPreference(
            sessionPreferences.getString(PRINTER_PROFILE_KEY, null),
        )
        p50PrinterClient = P50PrinterClient(applicationContext) { state, message ->
            onPrinterState(PrinterProfile.MARKLIFE_P50, state, message)
        }
        genericPrinterClient = GenericEscPosPrinterClient(applicationContext) { state, message ->
            onPrinterState(PrinterProfile.GENERIC_ESC_POS, state, message)
        }.apply {
            selectedDeviceAddress = sessionPreferences.getString(GENERIC_PRINTER_ADDRESS_KEY, null)
        }
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
        currentSalesChannel = SalesChannel.fromApiKey(
            savedInstanceState?.getString(STATE_SALES_CHANNEL),
        )
        currentSaleId = savedInstanceState?.getString(STATE_SALE_ID)
        currentSalesFilter = savedInstanceState
            ?.getString(STATE_SALES_FILTER)
            ?.let { value -> SaleStatusGroup.entries.firstOrNull { it.name == value } }
            ?: SaleStatusGroup.TO_SHIP
        currentCustomLabelText = savedInstanceState?.getString(STATE_CUSTOM_LABEL_TEXT).orEmpty()
        currentCustomLabelFontPercent = savedInstanceState
            ?.getInt(STATE_CUSTOM_LABEL_FONT_PERCENT, 90)
            ?.coerceIn(40, 100)
            ?: 90
        if (token.isNullOrBlank()) {
            showLogin()
        } else if (handleSaleIntent(intent)) {
            Unit
        } else {
            when (currentScreen) {
                SCREEN_SALES_DETAIL -> {
                    val channel = currentSalesChannel
                    val saleId = currentSaleId
                    if (channel != null && !saleId.isNullOrBlank()) {
                        showSaleDetailsFromApi(channel, saleId)
                    } else {
                        showSalesOverview()
                    }
                }
                SCREEN_SALES_LIST -> currentSalesChannel?.let(::showSalesList) ?: showSalesOverview()
                SCREEN_SALES_SOUND -> showSalesSoundSettings()
                SCREEN_SALES -> showSalesOverview()
                SCREEN_LABELS -> showLabels()
                SCREEN_CUSTOM_LABEL -> showCustomLabel()
                SCREEN_STOCK_CONTENTS -> {
                    val locationId = currentStockLocationId
                    if (locationId.isNullOrBlank()) showStockLocations()
                    else showStockLocationContents(
                        locationId,
                        currentStockLocationName ?: "Caixa",
                    )
                }
                SCREEN_STOCK_TRANSFER -> {
                    if (currentTransferLines.isEmpty()) {
                        showStockLocations()
                    } else {
                        showStockBatchTransfer(currentTransferLines)
                    }
                }
                SCREEN_STOCK_BATCH_BUILD -> showStockBatchBuilder()
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
        outState.putString(STATE_SALES_CHANNEL, currentSalesChannel?.apiKey)
        outState.putString(STATE_SALE_ID, currentSaleId)
        outState.putString(STATE_SALES_FILTER, currentSalesFilter.name)
        outState.putString(STATE_CUSTOM_LABEL_TEXT, currentCustomLabelText)
        outState.putInt(STATE_CUSTOM_LABEL_FONT_PERCENT, currentCustomLabelFontPercent)
        currentLabelProduct?.let { outState.putString(STATE_LABEL_PRODUCT, it.toStateJson()) }
        if (currentTransferLines.isNotEmpty()) {
            outState.putString(
                STATE_TRANSFER_LINES,
                StockTransferLine.toStateJson(currentTransferLines),
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!token.isNullOrBlank()) handleSaleIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        if (!saleReceiverRegistered) {
            val filter = IntentFilter(SalesNotificationContract.ACTION_SALE_RECEIVED)
            ContextCompat.registerReceiver(
                this,
                salePushReceiver,
                filter,
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
            saleReceiverRegistered = true
        }
    }

    override fun onStop() {
        if (saleReceiverRegistered) {
            unregisterReceiver(salePushReceiver)
            saleReceiverRegistered = false
        }
        super.onStop()
    }

    override fun onDestroy() {
        p50PrinterClient.close()
        genericPrinterClient.close()
        super.onDestroy()
    }

    private fun onPrinterState(
        profile: PrinterProfile,
        state: PrinterConnectionState,
        message: String,
    ) {
        if (profile != activePrinterProfile) return
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
                    "Conectando à ${activePrinterProfile.shortName}…"
                } else {
                    "Conectar à ${activePrinterProfile.shortName}"
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
                            requestSalesNotificationPermission()
                            PushRegistration.refresh(applicationContext)
                            if (!handleSaleIntent(intent)) showDashboard()
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
        root.addView(
            card(
                "Vendas e notificações",
                "Online, PDV, Shopee e TikTok com detalhes e avisos automáticos.",
            ) { showSalesOverview() },
        )
        root.addView(card("Movimentar estoque", "Consultar caixas e os produtos guardados em cada local.") { showStockLocations() })
        root.addView(
            card(
                "Imprimir etiquetas",
                "Visualizar a etiqueta e imprimir na P50 ou em uma impressora Bluetooth genérica.",
            ) { showLabels() },
        )
        root.addView(card("Permissões do celular", permissionSummary()) { showPermissions() })
        root.addView(button("Sair") {
            val accessToken = token.orEmpty()
            PushRegistration.unregister(applicationContext, accessToken)
            token = null
            currentLabelProduct = null
            sessionPreferences.edit()
                .remove(SESSION_TOKEN_KEY)
                .remove(LABEL_PRODUCT_KEY)
                .apply()
            SalesCache.clearAll(applicationContext)
            printerClient.close()
            showLogin()
        })
        root.addView(appVersionText())
        showContent(root)
    }

    private fun showSalesOverview() {
        currentScreen = SCREEN_SALES
        currentSalesChannel = null
        currentSaleId = null
        val root = screen()
        root.addView(back("Vendas") { showDashboard() })
        root.addView(text("Vendas", 28, green))
        root.addView(
            text(
                "Escolha uma origem. Ao tocar em uma notificação, esta área abre diretamente nos detalhes da venda.",
                15,
                Color.DKGRAY,
            ),
        )
        root.addView(salesChannelRow(SalesChannel.ONLINE, SalesChannel.PDV))
        root.addView(salesChannelRow(SalesChannel.SHOPEE, SalesChannel.TIKTOK))

        val pushStatus = text(
            if (hasSalesNotificationPermission()) {
                "✓ Notificações automáticas autorizadas neste celular."
            } else {
                "Autorize as notificações para receber novas vendas com o aplicativo fechado."
            },
            14,
            if (hasSalesNotificationPermission()) Color.rgb(21, 128, 61) else Color.rgb(185, 28, 28),
        )
        root.addView(pushStatus)
        if (!hasSalesNotificationPermission()) {
            root.addView(button("Ativar notificações de vendas") {
                requestSalesNotificationPermission()
            })
        }
        root.addView(button("Atualizar registro deste celular") {
            pushStatus.text = "Registrando este celular…"
            PushRegistration.refresh(applicationContext) { result ->
                runOnUiThread {
                    pushStatus.text = result.fold(
                        onSuccess = { "✓ Celular registrado para receber novas vendas." },
                        onFailure = { it.message ?: "Não foi possível registrar este celular." },
                    )
                }
            }
        })
        root.addView(button("Configurar som das vendas") { showSalesSoundSettings() })
        showContent(root)
    }

    private fun showSalesSoundSettings() {
        currentScreen = SCREEN_SALES_SOUND
        currentSalesChannel = null
        currentSaleId = null
        val config = SalesSoundSettings.load(applicationContext)
        val root = screen()
        root.addView(back("Som das vendas") { showSalesOverview() })
        root.addView(text("Som das notificações", 28, green))
        root.addView(
            text(
                "Escolha o áudio, o volume e em quais horários uma nova venda pode tocar.",
                15,
                Color.DKGRAY,
            ),
        )

        root.addView(CheckBox(this).apply {
            text = "Tocar som ao receber nova venda"
            isChecked = config.enabled
            setOnCheckedChangeListener { _, checked ->
                SalesSoundSettings.setEnabled(applicationContext, checked)
            }
        })
        root.addView(
            text(
                "Som selecionado: ${SalesSoundSettings.selectedSoundLabel(applicationContext, config)}",
                16,
                Color.rgb(15, 23, 42),
            ),
        )
        root.addView(button("Escolher toque do sistema") { openSystemSoundPicker() })
        root.addView(button("Importar arquivo de áudio") { openCustomSoundPicker() })

        val volumeLabel = text("Volume: ${config.volumePercent}%", 16, Color.DKGRAY)
        root.addView(volumeLabel)
        root.addView(SeekBar(this).apply {
            max = 100
            progress = config.volumePercent
            contentDescription = "Volume do som de vendas"
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    volumeLabel.text = "Volume: $progress%"
                    if (fromUser) SalesSoundSettings.setVolume(applicationContext, progress)
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
            })
        })

        root.addView(CheckBox(this).apply {
            text = "Tocar somente no horário programado"
            isChecked = config.scheduleEnabled
            setOnCheckedChangeListener { _, checked ->
                SalesSoundSettings.setScheduleEnabled(applicationContext, checked)
                showSalesSoundSettings()
            }
        })
        if (config.scheduleEnabled) {
            root.addView(
                button("Início: ${SalesSoundSettings.formatMinutes(config.startMinutes)}") {
                    chooseSalesSoundTime(isStart = true)
                },
            )
            root.addView(
                button("Fim: ${SalesSoundSettings.formatMinutes(config.endMinutes)}") {
                    chooseSalesSoundTime(isStart = false)
                },
            )
            root.addView(
                text(
                    "Se o horário final for menor que o inicial, o período atravessa a meia-noite.",
                    13,
                    Color.GRAY,
                ),
            )
        }
        root.addView(button("Testar som agora") {
            val played = SalesSoundSettings.play(applicationContext, ignoreSchedule = true)
            Toast.makeText(
                this,
                if (played) "Reproduzindo o som configurado." else "Ative o som e escolha um volume maior que zero.",
                Toast.LENGTH_SHORT,
            ).show()
        })
        root.addView(
            text(
                "O volume definido é relativo ao volume de notificações do aparelho. O modo silencioso e o Não Perturbe continuam sendo respeitados.",
                13,
                Color.GRAY,
            ),
        )
        showContent(root)
    }

    @Suppress("DEPRECATION")
    private fun openSystemSoundPicker() {
        val config = SalesSoundSettings.load(applicationContext)
        val currentUri = config.systemSoundUri.takeIf(String::isNotBlank)?.let(Uri::parse)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        startActivityForResult(
            Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
                putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_NOTIFICATION)
                putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Escolher som da venda")
                putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
                putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, currentUri)
            },
            REQUEST_SALES_SYSTEM_SOUND,
        )
    }

    @Suppress("DEPRECATION")
    private fun openCustomSoundPicker() {
        startActivityForResult(
            Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "audio/*"
            },
            REQUEST_SALES_CUSTOM_SOUND,
        )
    }

    private fun chooseSalesSoundTime(isStart: Boolean) {
        val config = SalesSoundSettings.load(applicationContext)
        val currentMinutes = if (isStart) config.startMinutes else config.endMinutes
        TimePickerDialog(
            this,
            { _, hour, minute ->
                val selected = hour * 60 + minute
                SalesSoundSettings.setSchedule(
                    applicationContext,
                    if (isStart) selected else config.startMinutes,
                    if (isStart) config.endMinutes else selected,
                )
                showSalesSoundSettings()
            },
            currentMinutes / 60,
            currentMinutes % 60,
            true,
        ).show()
    }

    private fun salesChannelRow(left: SalesChannel, right: SalesChannel) =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            weightSum = 2f
            addView(salesChannelCard(left), LinearLayout.LayoutParams(0, dp(150), 1f).apply {
                marginEnd = dp(7)
                bottomMargin = dp(14)
            })
            addView(salesChannelCard(right), LinearLayout.LayoutParams(0, dp(150), 1f).apply {
                marginStart = dp(7)
                bottomMargin = dp(14)
            })
        }

    private fun salesChannelCard(channel: SalesChannel) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(16), dp(16), dp(16), dp(16))
        setBackgroundColor(Color.WHITE)
        isClickable = true
        isFocusable = true
        contentDescription = "Abrir vendas ${channel.label}"
        setOnClickListener {
            currentSalesFilter = SaleStatusGroup.TO_SHIP
            showSalesList(channel)
        }
        addView(text(channel.label, 22, salesChannelColor(channel)))
        addView(text(channel.subtitle, 14, Color.DKGRAY))
        addView(text("Toque para abrir  ›", 13, blue))
    }

    private fun salesChannelColor(channel: SalesChannel): Int = when (channel) {
        SalesChannel.ONLINE -> Color.rgb(37, 99, 235)
        SalesChannel.PDV -> green
        SalesChannel.SHOPEE -> Color.rgb(238, 77, 45)
        SalesChannel.TIKTOK -> Color.rgb(15, 23, 42)
    }

    private fun showSalesList(channel: SalesChannel) {
        currentScreen = SCREEN_SALES_LIST
        currentSalesChannel = channel
        currentSaleId = null
        val root = screen()
        root.addView(back("Vendas ${channel.label}") { showSalesOverview() })
        root.addView(text(channel.label, 28, salesChannelColor(channel)))
        root.addView(text(channel.subtitle, 15, Color.DKGRAY))
        val status = text("Abrindo vendas salvas…", 14, Color.DKGRAY)
        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val filters = SaleStatusGroup.entries
        val filterSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                filters.map { it.label },
            )
            setSelection(filters.indexOf(currentSalesFilter).coerceAtLeast(0))
        }
        root.addView(text("Filtrar por situação", 15, Color.DKGRAY))
        root.addView(filterSpinner)
        root.addView(button("Atualizar tudo") {
            refreshAllSales(channel, currentSalesFilter, status, list)
        })
        root.addView(status)
        root.addView(list)
        showContent(root)
        filterSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                currentSalesFilter = filters[position]
                renderCachedSales(channel, currentSalesFilter, status, list)
                syncPendingSales(channel, currentSalesFilter, status, list)
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
    }

    private fun renderCachedSales(
        channel: SalesChannel,
        filter: SaleStatusGroup,
        status: TextView,
        list: LinearLayout,
    ) {
        val sales = SalesCache.load(applicationContext, channel)
        val filtered = sales.filter(filter::accepts)
        list.removeAllViews()
        status.text = when {
            !SalesCache.isInitialized(applicationContext, channel) ->
                "Preparando o primeiro carregamento…"
            filtered.isEmpty() && sales.isEmpty() ->
                "Nenhuma venda salva nesta origem."
            filtered.isEmpty() ->
                "Nenhuma venda em “${filter.label}”."
            filter == SaleStatusGroup.ALL ->
                "${filtered.size} venda(s) salva(s) • novas entram automaticamente"
            else ->
                "${filtered.size} de ${sales.size} venda(s) em “${filter.label}” • atualização automática"
        }
        filtered.forEach { sale -> list.addView(saleListCard(sale)) }
    }

    private fun refreshAllSales(
        channel: SalesChannel,
        filter: SaleStatusGroup,
        status: TextView,
        list: LinearLayout,
    ) {
        if (!syncingSalesChannels.add(channel)) return
        status.text = "Atualizando todas as vendas…"
        runAsync {
            val response = VpsApiClient(token.orEmpty()).get(
                "/admin/mobile-sales?channel=${channel.apiKey}&limit=100",
            )
            runOnUiThread {
                syncingSalesChannels.remove(channel)
                if (channel != currentSalesChannel) return@runOnUiThread
                response.fold(
                    onSuccess = { body ->
                        runCatching { SalesCache.replace(applicationContext, channel, body) }.fold(
                            onSuccess = { sales ->
                                val refreshedIds = sales.mapTo(mutableSetOf(), SaleSummary::externalId)
                                SalesCache.pendingIds(applicationContext, channel)
                                    .filter(refreshedIds::contains)
                                    .forEach { SalesCache.resolvePending(applicationContext, channel, it) }
                                renderCachedSales(channel, currentSalesFilter, status, list)
                                if (filter == currentSalesFilter) {
                                    Toast.makeText(this, "Vendas atualizadas.", Toast.LENGTH_SHORT).show()
                                }
                                syncPendingSales(channel, currentSalesFilter, status, list)
                            },
                            onFailure = {
                                status.text = it.message ?: "Resposta de vendas inválida."
                            },
                        )
                    },
                    onFailure = {
                        handleProtectedApiFailure(it, status, "Falha ao carregar as vendas.")
                    },
                )
            }
        }
    }

    private fun syncPendingSales(
        channel: SalesChannel,
        filter: SaleStatusGroup,
        status: TextView,
        list: LinearLayout,
    ) {
        if (!SalesCache.isInitialized(applicationContext, channel)) {
            refreshAllSales(channel, filter, status, list)
            return
        }
        val pendingIds = SalesCache.pendingIds(applicationContext, channel)
        if (pendingIds.isEmpty() || !syncingSalesChannels.add(channel)) return
        status.text = "Incluindo ${pendingIds.size} nova(s) venda(s)…"
        runAsync {
            val client = VpsApiClient(token.orEmpty())
            pendingIds.forEach { saleId ->
                val encodedSaleId = URLEncoder.encode(saleId, "UTF-8")
                client.get("/admin/mobile-sales/${channel.apiKey}/$encodedSaleId")
                    .onSuccess { body ->
                        SalesCache.upsertSingle(applicationContext, channel, body)
                        SalesCache.resolvePending(applicationContext, channel, saleId)
                    }
            }
            runOnUiThread {
                syncingSalesChannels.remove(channel)
                if (channel == currentSalesChannel && filter == currentSalesFilter) {
                    renderCachedSales(channel, filter, status, list)
                }
            }
        }
    }

    private fun saleListCard(sale: SaleSummary) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(14), dp(16), dp(14))
        setBackgroundColor(Color.WHITE)
        isClickable = true
        isFocusable = true
        contentDescription = "Abrir venda ${sale.shortId}"
        setOnClickListener { showSaleDetails(sale) }
        addView(text("${sale.formattedTotal}  •  ${sale.customerName}", 18, green))
        addView(text("#${sale.shortId}  •  ${formatSaleDate(sale.occurredAt)}", 14, Color.DKGRAY))
        val itemSummary = sale.items.take(2).joinToString("\n") {
            "${it.quantity}x ${it.name}${it.sku.takeIf(String::isNotBlank)?.let { sku -> " • $sku" }.orEmpty()}"
        }
        if (itemSummary.isNotBlank()) addView(text(itemSummary, 14, Color.rgb(15, 23, 42)))
        addView(text("${sale.localizedStatus}  ›", 13, blue))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = dp(12) }
    }

    private fun showSaleDetailsFromApi(channel: SalesChannel, saleId: String) {
        currentScreen = SCREEN_SALES_DETAIL
        currentSalesChannel = channel
        currentSaleId = saleId
        val root = screen()
        root.addView(back("Detalhes da venda") { showSalesList(channel) })
        val status = text("Carregando a venda #${saleId.take(12).uppercase()}…", 16, Color.DKGRAY)
        root.addView(status)
        showContent(root)

        runAsync {
            val encodedSaleId = URLEncoder.encode(saleId, "UTF-8")
            val response = VpsApiClient(token.orEmpty()).get(
                "/admin/mobile-sales/${channel.apiKey}/$encodedSaleId",
            )
            runOnUiThread {
                response.fold(
                    onSuccess = { body ->
                        runCatching { SaleSummary.parseSingle(body) }.fold(
                            onSuccess = { sale ->
                                SalesCache.upsertSingle(applicationContext, channel, body)
                                SalesCache.resolvePending(applicationContext, channel, saleId)
                                showSaleDetails(sale)
                            },
                            onFailure = { status.text = it.message ?: "Detalhes inválidos." },
                        )
                    },
                    onFailure = {
                        handleProtectedApiFailure(it, status, "Falha ao carregar a venda.")
                    },
                )
            }
        }
    }

    private fun showSaleDetails(sale: SaleSummary) {
        currentScreen = SCREEN_SALES_DETAIL
        currentSalesChannel = sale.channel
        currentSaleId = sale.externalId
        val root = screen()
        root.addView(back("Detalhes da venda") { showSalesList(sale.channel) })
        root.addView(text(sale.channel.label, 17, salesChannelColor(sale.channel)))
        root.addView(text(sale.formattedTotal, 32, green))
        root.addView(text("Venda #${sale.shortId}", 18, Color.rgb(15, 23, 42)))
        root.addView(text(formatSaleDate(sale.occurredAt), 15, Color.DKGRAY))
        root.addView(saleDetailSection("Status", sale.localizedStatus))
        root.addView(saleDetailSection("Cliente", buildString {
            append(sale.customerName)
            if (sale.customerPhone.isNotBlank()) append("\n").append(sale.customerPhone)
            if (sale.customerEmail.isNotBlank()) append("\n").append(sale.customerEmail)
        }))
        root.addView(saleDetailSection("Pagamento", sale.formattedPayment))
        if (sale.trackingNumber.isNotBlank()) {
            root.addView(saleDetailSection("Rastreamento", sale.trackingNumber))
        }
        if (sale.deliveryType.isNotBlank() || sale.shippingAddress.isNotBlank()) {
            root.addView(
                saleDetailSection(
                    "Entrega",
                    listOf(sale.localizedDeliveryType, sale.shippingAddress)
                        .filter(String::isNotBlank)
                        .joinToString("\n"),
                ),
            )
        }
        root.addView(text("Itens", 21, Color.rgb(15, 23, 42)))
        if (sale.items.isEmpty()) {
            root.addView(text("A origem não retornou os itens desta venda.", 14, Color.DKGRAY))
        } else {
            sale.items.forEach { item ->
                root.addView(
                    saleDetailSection(
                        "${item.quantity}x ${item.name}",
                        buildString {
                            if (item.variation.isNotBlank()) append(item.variation).append("\n")
                            if (item.sku.isNotBlank()) append("SKU: ").append(item.sku).append("\n")
                            append(formatMoneyCents(item.totalCents, sale.currency))
                        },
                    ),
                )
            }
        }
        if (sale.notes.isNotBlank()) root.addView(saleDetailSection("Observações", sale.notes))
        showContent(root)
    }

    private fun saleDetailSection(title: String, value: String) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(14), dp(16), dp(14))
        setBackgroundColor(Color.WHITE)
        addView(text(title, 14, Color.GRAY))
        addView(text(value.ifBlank { "Não informado" }, 17, Color.rgb(15, 23, 42)))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = dp(12) }
    }

    private fun formatSaleDate(value: String): String = runCatching {
        DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm")
            .withZone(ZoneId.of("America/Sao_Paulo"))
            .format(Instant.parse(value))
    }.getOrElse { value.ifBlank { "Data não informada" } }

    private fun formatMoneyCents(cents: Long, currency: String): String =
        runCatching {
            java.text.NumberFormat.getCurrencyInstance(java.util.Locale("pt", "BR")).apply {
                this.currency = java.util.Currency.getInstance(currency.ifBlank { "BRL" })
            }.format(cents / 100.0)
        }.getOrElse { "R$ %.2f".format(cents / 100.0) }

    private fun handleSaleIntent(sourceIntent: Intent): Boolean {
        if (!sourceIntent.getBooleanExtra(SalesNotificationContract.EXTRA_OPEN_SALE, false)) {
            return false
        }
        val channel = SalesChannel.fromApiKey(
            sourceIntent.getStringExtra(SalesNotificationContract.EXTRA_SALES_CHANNEL),
        )
        val saleId = sourceIntent.getStringExtra(SalesNotificationContract.EXTRA_SALE_ID).orEmpty()
        sourceIntent.removeExtra(SalesNotificationContract.EXTRA_OPEN_SALE)
        if (channel == null || saleId.isBlank()) return false
        showSaleDetailsFromApi(channel, saleId)
        return true
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
        root.addView(
            permissionCard(
                "Bluetooth",
                bluetoothGranted && bluetoothEnabled,
                "Conexão com a P50 ou com impressoras térmicas genéricas já pareadas.",
            ),
        )
        if (!bluetoothGranted && Build.VERSION.SDK_INT >= 31) root.addView(button("Permitir dispositivos próximos") {
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), REQUEST_BLUETOOTH)
        })
        if (bluetoothGranted && !bluetoothEnabled) root.addView(button("Ativar Bluetooth") {
            if (hasBluetoothPermission()) {
                requestEnableBluetooth()
            } else if (Build.VERSION.SDK_INT >= 31) {
                requestPermissions(
                    arrayOf(Manifest.permission.BLUETOOTH_CONNECT),
                    REQUEST_BLUETOOTH,
                )
            }
        })

        val notificationsGranted = hasSalesNotificationPermission()
        root.addView(
            permissionCard(
                "Notificações de vendas",
                notificationsGranted,
                "Avisos imediatos de novas vendas Online, PDV, Shopee e TikTok.",
            ),
        )
        if (!notificationsGranted && Build.VERSION.SDK_INT >= 33) {
            root.addView(button("Permitir notificações de vendas") {
                requestSalesNotificationPermission()
            })
        }

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

        root.addView(text("2. Transferência em lote", 19, Color.rgb(15, 23, 42)))
        root.addView(
            card(
                "Transferência em lote",
                "Pesquise e adicione vários produtos, escolha a origem de cada um e envie todos para o mesmo destino.",
            ) {
                currentTransferLines = emptyList()
                currentTransferTargetId = null
                showStockBatchBuilder()
            },
        )

        root.addView(text("3. Abrir uma caixa pelo QR", 19, Color.rgb(15, 23, 42)))
        root.addView(text("Leia a etiqueta da caixa para escolher um ou vários produtos.", 14, Color.DKGRAY))
        val status = text("Carregando caixas…", 14, Color.DKGRAY)
        val list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        var loadedLocations = emptyList<StockLocationBox>()
        var locationsLoaded = false
        val locationQuery = field("Pesquisar caixa por nome ou código")
        val locationFilter = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                STOCK_LOCATION_FILTER_LABELS,
            )
        }
        val allBoxesContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
        }
        var allBoxesExpanded = false
        lateinit var allBoxesToggle: Button
        allBoxesToggle = button("▸ Todas as caixas") {
            allBoxesExpanded = !allBoxesExpanded
            allBoxesContent.visibility = if (allBoxesExpanded) View.VISIBLE else View.GONE
            val count = if (locationsLoaded) " (${loadedLocations.size})" else ""
            allBoxesToggle.text =
                "${if (allBoxesExpanded) "▾" else "▸"} Todas as caixas$count"
        }
        lateinit var renderLocations: () -> Unit
        renderLocations = {
            if (locationsLoaded) {
                val visibleLocations = filterStockLocations(
                    loadedLocations,
                    locationQuery.text.toString(),
                    locationFilter.selectedItemPosition,
                )
                list.removeAllViews()
                status.text = when {
                    loadedLocations.isEmpty() -> "Nenhuma caixa cadastrada."
                    visibleLocations.isEmpty() -> "Nenhuma caixa encontrada com este filtro."
                    visibleLocations.size == loadedLocations.size ->
                        "${loadedLocations.size} caixa(s) encontrada(s)."
                    else -> "${visibleLocations.size} de ${loadedLocations.size} caixa(s)."
                }
                allBoxesToggle.text =
                    "${if (allBoxesExpanded) "▾" else "▸"} Todas as caixas (${loadedLocations.size})"
                visibleLocations.forEach { location ->
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
        }
        locationQuery.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = renderLocations()
            override fun afterTextChanged(s: Editable?) = Unit
        })
        locationFilter.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = renderLocations()
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
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
        root.addView(allBoxesToggle)
        allBoxesContent.addView(text("Pesquise ou filtre para selecionar uma caixa:", 15, Color.DKGRAY))
        allBoxesContent.addView(locationQuery)
        allBoxesContent.addView(locationFilter)
        allBoxesContent.addView(list)
        root.addView(allBoxesContent)
        showContent(root)

        runAsync {
            VpsApiClient(token.orEmpty()).get("/stock-locations/locations").fold(
                onSuccess = { body ->
                    runCatching { StockLocationBox.parseList(body) }.fold(
                        onSuccess = { locations ->
                            runOnUiThread {
                                if (currentScreen != SCREEN_STOCK) return@runOnUiThread
                                loadedLocations = locations
                                locationsLoaded = true
                                renderLocations()
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

    private fun showStockBatchBuilder() {
        currentScreen = SCREEN_STOCK_BATCH_BUILD
        currentStockLocationId = null
        currentStockLocationName = null
        currentTransferTargetId = null

        val selectedLines = linkedMapOf<String, StockTransferLine>().apply {
            currentTransferLines.forEach { line ->
                put(transferLineKey(line.item), line)
            }
        }
        val root = screen()
        root.addView(back("Transferência em lote") { showStockLocations() })
        root.addView(text("Transferência em lote", 27, green))
        root.addView(
            text(
                "Adicione produtos de qualquer caixa. Cada item mantém sua própria origem e todos seguem para um único destino.",
                15,
                Color.DKGRAY,
            ),
        )

        val query = field("Bipar EAN, digitar SKU ou nome")
        val status = text("", 14, Color.DKGRAY)
        val results = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        val selectedList = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        lateinit var continueButton: Button
        lateinit var renderSelected: () -> Unit
        renderSelected = {
            currentTransferLines = selectedLines.values.toList()
            selectedList.removeAllViews()
            if (selectedLines.isEmpty()) {
                selectedList.addView(
                    text(
                        "Nenhum produto na lista. Pesquise ou leia um código para adicionar.",
                        14,
                        Color.GRAY,
                    ),
                )
            } else {
                selectedLines.forEach { (key, line) ->
                    selectedList.addView(
                        batchSelectionRow(
                            line = line,
                            onQuantityChanged = { quantity ->
                                selectedLines[key] = line.copy(quantity = quantity)
                                currentTransferLines = selectedLines.values.toList()
                            },
                            onRemove = {
                                selectedLines.remove(key)
                                renderSelected()
                            },
                        ),
                    )
                }
            }
            continueButton.text = "Escolher destino (${selectedLines.size})"
            continueButton.isEnabled = selectedLines.isNotEmpty()
        }
        val addSource: (StockLocationContent) -> Unit = { source ->
            val key = transferLineKey(source)
            if (selectedLines.containsKey(key)) {
                status.text =
                    "${source.productName} já está na lista com origem em ${source.locationName}."
            } else {
                selectedLines[key] = StockTransferLine(source, 1)
                status.text =
                    "${source.productName} adicionado da origem ${source.locationName}."
                query.setText("")
                results.removeAllViews()
                renderSelected()
            }
        }
        val runSearch = {
            searchBatchProduct(
                rawQuery = query.text.toString(),
                status = status,
                results = results,
                onAdd = addSource,
            )
        }

        root.addView(query)
        root.addView(button("Pesquisar produto") { runSearch() })
        root.addView(button("Ler código do produto") {
            ensureCameraPermission(status) {
                launchScanner { value ->
                    query.setText(value)
                    searchBatchProduct(value, status, results, addSource)
                }
            }
        })
        root.addView(status)
        root.addView(results)
        root.addView(text("Produtos selecionados", 19, Color.rgb(15, 23, 42)))
        root.addView(selectedList)
        continueButton = button("Escolher destino (0)") {
            val prepared = selectedLines.values.toList()
            if (prepared.isEmpty()) {
                status.text = "Adicione pelo menos um produto."
            } else {
                currentTransferLines = prepared
                showStockBatchTransfer(prepared)
            }
        }.apply { isEnabled = false }
        root.addView(continueButton)
        renderSelected()
        showContent(root)
    }

    private fun searchBatchProduct(
        rawQuery: String,
        status: TextView,
        results: LinearLayout,
        onAdd: (StockLocationContent) -> Unit,
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
                                    if (currentScreen != SCREEN_STOCK_BATCH_BUILD) {
                                        return@runOnUiThread
                                    }
                                    status.text = if (products.isEmpty()) {
                                        "Nenhum produto com estoque foi encontrado."
                                    } else {
                                        "Selecione o produto para escolher a origem."
                                    }
                                    if (products.size == 1) {
                                        loadBatchProductSources(
                                            products.first(),
                                            status,
                                            results,
                                            onAdd,
                                        )
                                    } else {
                                        products.forEach { product ->
                                            results.addView(
                                                stockSearchProductRow(product) {
                                                    loadBatchProductSources(
                                                        product,
                                                        status,
                                                        results,
                                                        onAdd,
                                                    )
                                                },
                                            )
                                        }
                                    }
                                }
                            },
                            onFailure = { error ->
                                runOnUiThread {
                                    status.text =
                                        error.message ?: "Não foi possível ler os produtos."
                                }
                            },
                        )
                    },
                    onFailure = { error ->
                        runOnUiThread {
                            handleProtectedApiFailure(
                                error,
                                status,
                                "Não foi possível pesquisar o produto.",
                            )
                        }
                    },
                )
        }
    }

    private fun loadBatchProductSources(
        product: ProductLabelProduct,
        status: TextView,
        results: LinearLayout,
        onAdd: (StockLocationContent) -> Unit,
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
                                    if (currentScreen != SCREEN_STOCK_BATCH_BUILD) {
                                        return@runOnUiThread
                                    }
                                    results.removeAllViews()
                                    results.addView(stockSearchProductRow(product, null))
                                    status.text = if (sources.isEmpty()) {
                                        "Este produto não possui saldo disponível em nenhuma caixa."
                                    } else {
                                        "Escolha a caixa de origem para adicionar ao lote."
                                    }
                                    sources.forEach { source ->
                                        results.addView(
                                            card(
                                                "Adicionar de ${source.locationName}",
                                                "Disponível: ${source.available}" +
                                                    if (source.reservedQuantity > 0) {
                                                        " • reservado: ${source.reservedQuantity}"
                                                    } else {
                                                        ""
                                                    },
                                            ) { onAdd(source) },
                                        )
                                    }
                                }
                            },
                            onFailure = { error ->
                                runOnUiThread {
                                    status.text = error.message
                                        ?: "Não foi possível ler a distribuição do produto."
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

    private fun batchSelectionRow(
        line: StockTransferLine,
        onQuantityChanged: (Int) -> Unit,
        onRemove: () -> Unit,
    ): View {
        val quantity = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER
            setText(line.quantity.toString())
            gravity = Gravity.CENTER
            setSelectAllOnFocus(true)
            layoutParams = LinearLayout.LayoutParams(dp(58), dp(44))
        }
        fun updateQuantity(value: Int) {
            val next = value.coerceIn(1, line.item.available.coerceAtLeast(1))
            quantity.setText(next.toString())
            quantity.selectAll()
            onQuantityChanged(next)
        }
        quantity.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(
                value: CharSequence?,
                start: Int,
                count: Int,
                after: Int,
            ) = Unit

            override fun onTextChanged(
                value: CharSequence?,
                start: Int,
                before: Int,
                count: Int,
            ) {
                value?.toString()?.toIntOrNull()
                    ?.takeIf { it in 1..line.item.available }
                    ?.let(onQuantityChanged)
            }

            override fun afterTextChanged(value: Editable?) = Unit
        })

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(12))
            setBackgroundColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(10) }

            addView(text(line.item.productName, 16, Color.rgb(15, 23, 42)))
            addView(
                text(
                    "SKU: ${line.item.sku.ifBlank { "-" }} • origem: ${line.item.locationName} • disponível: ${line.item.available}",
                    13,
                    Color.DKGRAY,
                ),
            )
            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    addView(Button(this@MainActivity).apply {
                        text = "−"
                        contentDescription = "Diminuir quantidade de ${line.item.productName}"
                        setOnClickListener {
                            updateQuantity(
                                (quantity.text.toString().toIntOrNull() ?: 1) - 1,
                            )
                        }
                    }, LinearLayout.LayoutParams(dp(46), dp(44)))
                    addView(quantity)
                    addView(Button(this@MainActivity).apply {
                        text = "+"
                        contentDescription = "Aumentar quantidade de ${line.item.productName}"
                        setOnClickListener {
                            updateQuantity(
                                (quantity.text.toString().toIntOrNull() ?: 1) + 1,
                            )
                        }
                    }, LinearLayout.LayoutParams(dp(46), dp(44)))
                    addView(Button(this@MainActivity).apply {
                        text = "Todo estoque"
                        isAllCaps = false
                        setOnClickListener { updateQuantity(line.item.available) }
                    }, LinearLayout.LayoutParams(0, dp(44), 1f))
                },
            )
            addView(button("Remover da lista") { onRemove() })
        }
    }

    private fun transferLineKey(item: StockLocationContent): String =
        "${item.productId}|${item.locationId}"

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
            setOnTouchListener { view, event ->
                if (event.action == MotionEvent.ACTION_UP) {
                    (view as EditText).post { view.selectAll() }
                }
                false
            }
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(dp(54), dp(44))
            isEnabled = item.available > 0
        }
        fun setQuantity(value: Int, selectItem: Boolean = false) {
            quantity.setText(value.coerceIn(1, item.available.coerceAtLeast(1)).toString())
            quantity.selectAll()
            if (selectItem && item.available > 0) checkBox.isChecked = true
        }
        val quantitySelector = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.END
            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    addView(Button(this@MainActivity).apply {
                        text = "−"
                        textSize = 16f
                        contentDescription = "Diminuir quantidade de ${item.productName}"
                        isEnabled = item.available > 0
                        setPadding(0, 0, 0, 0)
                        setOnClickListener {
                            setQuantity((quantity.text.toString().toIntOrNull() ?: 1) - 1)
                        }
                    }, LinearLayout.LayoutParams(dp(42), dp(44)))
                    addView(quantity)
                    addView(Button(this@MainActivity).apply {
                        text = "+"
                        textSize = 16f
                        contentDescription = "Aumentar quantidade de ${item.productName}"
                        isEnabled = item.available > 0
                        setPadding(0, 0, 0, 0)
                        setOnClickListener {
                            setQuantity((quantity.text.toString().toIntOrNull() ?: 1) + 1)
                        }
                    }, LinearLayout.LayoutParams(dp(42), dp(44)))
                },
            )
            addView(Button(this@MainActivity).apply {
                text = "Todo estoque"
                textSize = 12f
                isAllCaps = false
                contentDescription = "Usar todo o estoque disponível de ${item.productName}"
                isEnabled = item.available > 0
                setOnClickListener { setQuantity(item.available, selectItem = true) }
            }, LinearLayout.LayoutParams(dp(138), dp(44)))
        }
        val rowView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10), dp(10), dp(10), dp(10))
            setBackgroundColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                bottomMargin = dp(10)
            }

            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    )
                    addView(checkBox)
                    val photo = ImageView(this@MainActivity).apply {
                        layoutParams = LinearLayout.LayoutParams(dp(82), dp(82)).apply {
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
                    loadProductImage(item.imageUrl, photo)
                },
            )
            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(dp(48), dp(6), 0, 0)
                    addView(
                        text("Quantidade", 13, Color.DKGRAY),
                        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
                    )
                    addView(quantitySelector)
                },
            )
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
        val sourceLocationIds = lines.map { it.item.locationId }.filter { it.isNotBlank() }.toSet()
        val commonSourceLocationId = sourceLocationIds.singleOrNull()
        val sourceLocationName = if (commonSourceLocationId != null) {
            lines.firstOrNull { it.item.locationId == commonSourceLocationId }?.item?.locationName
                ?: currentStockLocationName
                ?: "Caixa"
        } else {
            "${sourceLocationIds.size} caixas"
        }
        val returnsToSingleSource =
            commonSourceLocationId != null &&
                currentStockLocationId == commonSourceLocationId &&
                !currentStockLocationName.isNullOrBlank()
        if (sourceLocationIds.isEmpty() || lines.any { it.item.locationId.isBlank() }) {
            showStockLocations()
            return
        }

        currentScreen = SCREEN_STOCK_TRANSFER
        currentTransferLines = lines
        val root = screen()
        root.addView(back("Movimentar produtos") {
            if (returnsToSingleSource) {
                showStockLocationContents(
                    commonSourceLocationId.orEmpty(),
                    currentStockLocationName ?: sourceLocationName,
                )
            } else {
                showStockBatchBuilder()
            }
        })
        root.addView(text("Movimentar produtos", 27, green))
        root.addView(
            text(
                if (commonSourceLocationId != null) {
                    "Origem: $sourceLocationName"
                } else {
                    "Origens: ${sourceLocationIds.size} caixas diferentes"
                },
                16,
                Color.DKGRAY,
            ),
        )

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
                                    "SKU: ${line.item.sku.ifBlank { "-" }} • origem: ${line.item.locationName} • disponível: ${line.item.available}",
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
                    quantityInputs[transferLineKey(line.item)] = input
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
        var targetLocationsLoaded = false
        var target: StockLocationBox? = null
        val selectTarget: (StockLocationBox) -> Unit = { location ->
            if (location.id in sourceLocationIds) {
                status.text = "O destino não pode ser uma das caixas de origem do lote."
            } else {
                target = location
                currentTransferTargetId = location.id
                selectedTarget.text = "Destino: ${location.displayName}"
                selectedTarget.setTextColor(green)
                status.text = "Destino selecionado. Confira a quantidade e confirme."
            }
        }
        val targetQuery = field("Pesquisar caixa de destino")
        val targetFilter = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                STOCK_LOCATION_FILTER_LABELS,
            )
        }
        val targetListStatus = text("", 13, Color.GRAY)
        val allTargetsContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
        }
        var allTargetsExpanded = false
        lateinit var allTargetsToggle: Button
        allTargetsToggle = button("▸ Todas as caixas de destino") {
            allTargetsExpanded = !allTargetsExpanded
            allTargetsContent.visibility =
                if (allTargetsExpanded) View.VISIBLE else View.GONE
            val count = if (targetLocationsLoaded) " (${locations.size})" else ""
            allTargetsToggle.text =
                "${if (allTargetsExpanded) "▾" else "▸"} Todas as caixas de destino$count"
        }
        lateinit var renderTargetLocations: () -> Unit
        renderTargetLocations = {
            if (targetLocationsLoaded) {
                val visibleLocations = filterStockLocations(
                    locations,
                    targetQuery.text.toString(),
                    targetFilter.selectedItemPosition,
                )
                targetList.removeAllViews()
                visibleLocations.forEach { location ->
                    targetList.addView(
                        card(
                            location.displayName,
                            location.description ?: "Usar como destino",
                        ) { selectTarget.invoke(location) },
                    )
                }
                targetListStatus.text = when {
                    locations.isEmpty() -> "Não existe outra caixa disponível."
                    visibleLocations.isEmpty() -> "Nenhuma caixa de destino encontrada."
                    visibleLocations.size == locations.size -> "${locations.size} caixa(s) disponível(is)."
                    else -> "${visibleLocations.size} de ${locations.size} caixa(s)."
                }
                allTargetsToggle.text =
                    "${if (allTargetsExpanded) "▾" else "▸"} Todas as caixas de destino (${locations.size})"
            }
        }
        targetQuery.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = renderTargetLocations()
            override fun afterTextChanged(s: Editable?) = Unit
        })
        targetFilter.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = renderTargetLocations()
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
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
                        selectTarget.invoke(scanned)
                    }
                }
            }
        })
        root.addView(allTargetsToggle)
        allTargetsContent.addView(
            text("Pesquise ou filtre a caixa de destino:", 15, Color.DKGRAY),
        )
        allTargetsContent.addView(targetQuery)
        allTargetsContent.addView(targetFilter)
        allTargetsContent.addView(targetListStatus)
        allTargetsContent.addView(targetList)
        root.addView(allTargetsContent)
        root.addView(status)

        lateinit var confirm: Button
        confirm = button("Confirmar movimentação de ${lines.size} produto(s)") {
            val selected = target
            val prepared = mutableListOf<StockTransferLine>()
            var validationError: String? = null
            lines.forEach { line ->
                val amount = quantityInputs[transferLineKey(line.item)]
                    ?.text
                    .toString()
                    .toIntOrNull()
                when {
                    amount == null || amount <= 0 ->
                        validationError = "Informe uma quantidade válida para ${line.item.productName}."
                    amount > line.item.available ->
                        validationError = "${line.item.productName}: máximo disponível ${line.item.available}."
                    line.item.depositId.isBlank() ->
                        validationError = "${line.item.productName} não possui depósito de origem válido."
                    line.item.locationId.isBlank() ->
                        validationError = "${line.item.productName} não possui caixa de origem válida."
                    line.item.locationId == selected?.id ->
                        validationError = "${line.item.productName} já está na caixa de destino."
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
                    currentTransferLines = prepared
                    confirm.isEnabled = false
                    status.text = "Movimentando 0 de ${prepared.size} produto(s)…"
                    runAsync {
                        var succeeded = 0
                        val failures = mutableListOf<String>()
                        val failedLines = mutableListOf<StockTransferLine>()
                        prepared.forEachIndexed { index, line ->
                            runOnUiThread {
                                status.text = "Movimentando ${index + 1} de ${prepared.size}: ${line.item.productName}"
                            }
                            val payload = JSONObject()
                                .put("product_id", line.item.productId)
                                .put("from_deposit_id", line.item.depositId)
                                .put("from_location_id", line.item.locationId)
                                .put("to_deposit_id", selected.depositId)
                                .put("to_location_id", selected.id)
                                .put("quantity", line.quantity)
                                .put("reason", reason.text.toString().trim().ifBlank {
                                    "Movimentação pelo aplicativo Android"
                                })
                                .put(
                                    "notes",
                                    "Origem: ${line.item.locationName}; destino: ${selected.displayName}",
                                )
                            VpsApiClient(token.orEmpty())
                                .post("/stock-locations/transfers", payload)
                                .fold(
                                    onSuccess = { succeeded += 1 },
                                    onFailure = {
                                        failedLines += line
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
                            if (failedLines.isEmpty()) {
                                currentTransferLines = emptyList()
                                currentTransferTargetId = null
                                if (returnsToSingleSource) {
                                    showStockLocationContents(
                                        commonSourceLocationId.orEmpty(),
                                        currentStockLocationName ?: sourceLocationName,
                                    )
                                } else {
                                    showStockLocations()
                                }
                            } else {
                                currentTransferLines = failedLines
                                showStockBatchTransfer(failedLines)
                            }
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
                                locations = loaded.filter { it.id !in sourceLocationIds }
                                targetLocationsLoaded = true
                                renderTargetLocations()
                                currentTransferTargetId
                                    ?.let { id -> locations.firstOrNull { it.id == id } }
                                    ?.let(selectTarget)
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
        root.addView(button("Etiqueta avulsa") { showCustomLabel() })

        root.addView(text("Perfil da impressora", 15, Color.DKGRAY))
        val printerProfiles = PrinterProfile.entries
        val profileSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                printerProfiles,
            )
            setSelection(printerProfiles.indexOf(activePrinterProfile))
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(
                    parent: AdapterView<*>?,
                    view: View?,
                    position: Int,
                    id: Long,
                ) {
                    val selectedProfile = printerProfiles[position]
                    if (selectedProfile != activePrinterProfile) {
                        switchPrinterProfile(selectedProfile)
                        showLabels()
                    }
                }

                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            }
        }
        root.addView(profileSpinner)

        if (activePrinterProfile == PrinterProfile.GENERIC_ESC_POS) {
            root.addView(text("Impressora Bluetooth pareada", 15, Color.DKGRAY))
            val pairedDevices = if (hasBluetoothPermission()) {
                genericPrinterClient.pairedDevices()
            } else {
                emptyList()
            }
            if (pairedDevices.isEmpty()) {
                root.addView(
                    text(
                        if (hasBluetoothPermission()) {
                            "Nenhuma impressora pareada. Faça o pareamento nas configurações Bluetooth do celular."
                        } else {
                            "Autorize dispositivos próximos para listar as impressoras pareadas."
                        },
                        14,
                        Color.rgb(185, 28, 28),
                    ),
                )
            } else {
                val deviceSpinner = Spinner(this).apply {
                    adapter = ArrayAdapter(
                        this@MainActivity,
                        android.R.layout.simple_spinner_dropdown_item,
                        pairedDevices,
                    )
                    val selectedIndex = pairedDevices.indexOfFirst {
                        it.address == genericPrinterClient.selectedDeviceAddress
                    }.coerceAtLeast(0)
                    setSelection(selectedIndex)
                    onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                        override fun onItemSelected(
                            parent: AdapterView<*>?,
                            view: View?,
                            position: Int,
                            id: Long,
                        ) {
                            val selectedDevice = pairedDevices[position]
                            if (selectedDevice.address != genericPrinterClient.selectedDeviceAddress) {
                                genericPrinterClient.close()
                                genericPrinterClient.selectedDeviceAddress = selectedDevice.address
                                sessionPreferences.edit()
                                    .putString(GENERIC_PRINTER_ADDRESS_KEY, selectedDevice.address)
                                    .apply()
                            }
                        }

                        override fun onNothingSelected(parent: AdapterView<*>?) = Unit
                    }
                }
                root.addView(deviceSpinner)
            }
            root.addView(
                text(
                    "Compatível com impressoras térmicas Bluetooth clássicas que aceitam ESC/POS.",
                    13,
                    Color.GRAY,
                ),
            )
        }

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
        root.addView(
            text(
                if (activePrinterProfile == PrinterProfile.MARKLIFE_P50) {
                    "O intervalo entre etiquetas será localizado automaticamente pela P50."
                } else {
                    "O perfil genérico envia a etiqueta raster e avança o papel pelo comando ESC/POS."
                },
                13,
                Color.GRAY,
            ),
        )
        root.addView(
            text(
                "Pré-visualização — esta mesma imagem será enviada à ${activePrinterProfile.shortName}",
                14,
                Color.DKGRAY,
            ),
        )
        root.addView(preview)
        val connectButton = button("Conectar à ${activePrinterProfile.shortName}") {
            requestBluetoothAndConnect()
        }.apply {
            visibility = if (
                printerClient.state == PrinterConnectionState.CONNECTED ||
                printerClient.state == PrinterConnectionState.PRINTING
            ) View.GONE else View.VISIBLE
            isEnabled = printerClient.state != PrinterConnectionState.CONNECTING
            if (!isEnabled) text = "Conectando à ${activePrinterProfile.shortName}…"
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
                    searchStatus.text =
                        "Conectando à ${activePrinterProfile.shortName}. Aguarde o ícone ficar verde e toque em imprimir novamente."
                    requestBluetoothAndConnect()
                }
                else -> {
                    val bitmap = LabelRenderer.render(product, sizeSpinner.selectedItem as LabelSize)
                    preview.setImageBitmap(bitmap)
                    printerClient.print(bitmap, quantity) { result ->
                        runOnUiThread {
                            searchStatus.text = result.fold(
                                onSuccess = {
                                    "$quantity etiqueta(s) enviada(s) para a ${activePrinterProfile.shortName}."
                                },
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
        if (
            hasBluetoothPermission() &&
            printerClient.state == PrinterConnectionState.DISCONNECTED &&
            (
                activePrinterProfile == PrinterProfile.MARKLIFE_P50 ||
                    !genericPrinterClient.selectedDeviceAddress.isNullOrBlank()
                )
        ) {
            printerClient.connect()
        }
    }

    private fun showCustomLabel() {
        currentScreen = SCREEN_CUSTOM_LABEL
        val root = screen()
        root.addView(back("Etiqueta avulsa") { showLabels() })
        root.addView(text("Etiqueta avulsa", 28, green))
        root.addView(
            text(
                "Digite qualquer texto. O aplicativo ajusta automaticamente o maior tamanho possível para ocupar toda a área útil da etiqueta.",
                14,
                Color.DKGRAY,
            ),
        )
        root.addView(
            text(
                "Impressora: ${activePrinterProfile.shortName}. Para trocar o perfil ou o dispositivo, volte à tela anterior.",
                13,
                Color.GRAY,
            ),
        )

        val status = text(currentPrinterMessage, 14, Color.DKGRAY)
        printerStatusText = status
        val indicator = PrinterStatusView(this).also {
            it.setState(printerClient.state)
            printerIndicator = it
        }
        val printerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(indicator)
            addView(status, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        root.addView(printerRow)

        val customText = EditText(this).apply {
            hint = "Texto da etiqueta"
            setText(currentCustomLabelText)
            inputType = InputType.TYPE_CLASS_TEXT or
                InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            gravity = Gravity.TOP or Gravity.START
            minLines = 4
            maxLines = 12
            textSize = 18f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(14) }
        }
        val sizes = LabelSize.desktopDefaults
        val sizeSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, sizes)
            setSelection(sizes.indexOf(currentLabelSize).coerceAtLeast(0))
        }
        val copies = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER
            setText("1")
            gravity = Gravity.CENTER
            textSize = 16f
            setSelectAllOnFocus(true)
            layoutParams = LinearLayout.LayoutParams(dp(72), dp(52))
        }
        fun updateCopies(delta: Int) {
            val current = copies.text.toString().toIntOrNull() ?: 1
            copies.setText((current + delta).coerceIn(1, 100).toString())
            copies.selectAll()
        }
        val copiesSelector = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
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
            setBackgroundColor(Color.WHITE)
            contentDescription = "Pré-visualização da etiqueta avulsa"
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(200),
            ).apply { bottomMargin = dp(14) }
        }
        fun updateCustomPreview() {
            currentCustomLabelText = customText.text.toString()
            currentLabelSize = sizeSpinner.selectedItem as LabelSize
            updatePreviewDimensions(preview, currentLabelSize)
            preview.setImageBitmap(
                LabelRenderer.renderCustomText(
                    currentCustomLabelText,
                    currentLabelSize,
                    currentCustomLabelFontPercent,
                ),
            )
        }
        val fontValue = text("Fonte: $currentCustomLabelFontPercent%", 16, Color.rgb(15, 23, 42))
        fun updateFont(delta: Int) {
            currentCustomLabelFontPercent =
                (currentCustomLabelFontPercent + delta).coerceIn(40, 100)
            fontValue.text = if (currentCustomLabelFontPercent == 100) {
                "Fonte: 100% — máximo que cabe"
            } else {
                "Fonte: $currentCustomLabelFontPercent%"
            }
            updateCustomPreview()
        }
        val fontSelector = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(Button(this@MainActivity).apply {
                text = "A−"
                contentDescription = "Diminuir fonte"
                setOnClickListener { updateFont(-10) }
                layoutParams = LinearLayout.LayoutParams(dp(72), dp(52))
            })
            addView(fontValue, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(Button(this@MainActivity).apply {
                text = "A+"
                contentDescription = "Aumentar fonte"
                setOnClickListener { updateFont(10) }
                layoutParams = LinearLayout.LayoutParams(dp(72), dp(52))
            })
        }
        customText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(value: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(value: CharSequence?, start: Int, before: Int, count: Int) = updateCustomPreview()
            override fun afterTextChanged(value: Editable?) = Unit
        })
        sizeSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = updateCustomPreview()
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }

        root.addView(text("Texto", 15, Color.DKGRAY))
        root.addView(customText)
        root.addView(text("Tamanho da etiqueta", 15, Color.DKGRAY))
        root.addView(sizeSpinner)
        root.addView(text("Tamanho da fonte", 15, Color.DKGRAY))
        root.addView(fontSelector)
        root.addView(text("Quantidade de cópias", 15, Color.DKGRAY))
        root.addView(copiesSelector)
        root.addView(text("Pré-visualização — exatamente como será impressa", 14, Color.DKGRAY))
        root.addView(preview)

        val connectButton = button("Conectar à ${activePrinterProfile.shortName}") {
            requestBluetoothAndConnect()
        }.apply {
            visibility = if (printerClient.isReady) View.GONE else View.VISIBLE
        }
        printerConnectButton = connectButton
        root.addView(connectButton)
        root.addView(button("Imprimir etiqueta avulsa") {
            val value = customText.text.toString().trim()
            val quantity = copies.text.toString().toIntOrNull()
            when {
                value.isBlank() -> status.text = "Digite o texto da etiqueta."
                quantity == null || quantity !in 1..100 -> status.text = "Informe uma quantidade entre 1 e 100."
                !printerClient.isReady -> {
                    status.text = "Conectando à ${activePrinterProfile.shortName}…"
                    requestBluetoothAndConnect()
                }
                else -> {
                    val bitmap = LabelRenderer.renderCustomText(
                        value,
                        sizeSpinner.selectedItem as LabelSize,
                        currentCustomLabelFontPercent,
                    )
                    preview.setImageBitmap(bitmap)
                    printerClient.print(bitmap, quantity) { result ->
                        runOnUiThread {
                            status.text = result.fold(
                                onSuccess = { "$quantity etiqueta(s) avulsa(s) enviada(s)." },
                                onFailure = { it.message ?: "Falha ao imprimir." },
                            )
                        }
                    }
                }
            }
        })
        showContent(root)
        updateCustomPreview()
        if (
            hasBluetoothPermission() &&
            printerClient.state == PrinterConnectionState.DISCONNECTED &&
            (
                activePrinterProfile == PrinterProfile.MARKLIFE_P50 ||
                    !genericPrinterClient.selectedDeviceAddress.isNullOrBlank()
                )
        ) {
            printerClient.connect()
        }
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
                            SalesCache.clearAll(applicationContext)
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

    private fun switchPrinterProfile(profile: PrinterProfile) {
        if (profile == activePrinterProfile) return
        printerClient.close()
        activePrinterProfile = profile
        sessionPreferences.edit()
            .putString(PRINTER_PROFILE_KEY, profile.preferenceValue)
            .apply()
        val client = printerClient
        currentPrinterMessage = when (client.state) {
            PrinterConnectionState.CONNECTED -> "${profile.shortName} conectada."
            PrinterConnectionState.PRINTING -> "Imprimindo na ${profile.shortName}…"
            else -> "${profile.shortName} desconectada."
        }
    }

    private fun hasCameraPermission(): Boolean =
        checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun hasSalesNotificationPermission(): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun requestSalesNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !hasSalesNotificationPermission()) {
            requestPermissions(
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                REQUEST_NOTIFICATIONS,
            )
        } else {
            PushRegistration.refresh(applicationContext)
        }
    }

    @SuppressLint("MissingPermission")
    private fun requestEnableBluetooth() {
        if (!hasBluetoothPermission()) return
        startActivity(Intent(android.bluetooth.BluetoothAdapter.ACTION_REQUEST_ENABLE))
    }

    private fun hasBluetoothPermission(): Boolean =
        Build.VERSION.SDK_INT < 31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun permissionSummary(): String {
        val camera = if (hasCameraPermission()) "câmera autorizada" else "câmera pendente"
        val bluetooth = if (hasBluetoothPermission()) "Bluetooth autorizado" else "Bluetooth pendente"
        val notifications = if (hasSalesNotificationPermission()) {
            "notificações autorizadas"
        } else {
            "notificações pendentes"
        }
        return "$camera • $bluetooth • $notifications"
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

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) return
        when (requestCode) {
            REQUEST_SALES_SYSTEM_SOUND -> {
                val uri = data?.getParcelableExtra<Uri>(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
                SalesSoundSettings.useSystemSound(applicationContext, uri)
                showSalesSoundSettings()
                Toast.makeText(this, "Toque do sistema selecionado.", Toast.LENGTH_SHORT).show()
            }
            REQUEST_SALES_CUSTOM_SOUND -> {
                val uri = data?.data ?: return
                val displayName = contentDisplayName(uri)
                runAsync {
                    val result = runCatching {
                        SalesSoundSettings.importCustomSound(applicationContext, uri, displayName)
                    }
                    runOnUiThread {
                        result.fold(
                            onSuccess = {
                                showSalesSoundSettings()
                                Toast.makeText(this, "Áudio importado.", Toast.LENGTH_SHORT).show()
                            },
                            onFailure = {
                                Toast.makeText(
                                    this,
                                    it.message ?: "Não foi possível importar o áudio.",
                                    Toast.LENGTH_LONG,
                                ).show()
                            },
                        )
                    }
                }
            }
        }
    }

    private fun contentDisplayName(uri: Uri): String =
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
            if (it.moveToFirst()) it.getString(0) else null
        } ?: "Áudio personalizado"

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
                else onPrinterState(
                    activePrinterProfile,
                    PrinterConnectionState.ERROR,
                    "Permissão Bluetooth não autorizada.",
                )
            }
            REQUEST_NOTIFICATIONS -> {
                if (granted) {
                    PushRegistration.refresh(applicationContext)
                    Toast.makeText(
                        this,
                        "Notificações de vendas ativadas.",
                        Toast.LENGTH_SHORT,
                    ).show()
                } else {
                    Toast.makeText(
                        this,
                        "Sem essa permissão, novas vendas não aparecerão como aviso.",
                        Toast.LENGTH_LONG,
                    ).show()
                }
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

    private fun filterStockLocations(
        locations: List<StockLocationBox>,
        rawQuery: String,
        filterIndex: Int,
    ): List<StockLocationBox> {
        val query = normalizeSearchText(rawQuery)
        return locations
            .asSequence()
            .filter { location ->
                val number = location.boxNumber
                when (filterIndex) {
                    1 -> number != null && number in 1..20
                    2 -> number != null && number in 21..40
                    3 -> number != null && number in 41..60
                    4 -> number != null && number in 61..80
                    5 -> number != null && number >= 81
                    6 -> number == null
                    else -> true
                }
            }
            .filter { location ->
                query.isBlank() || normalizeSearchText(
                    listOfNotNull(
                        location.displayName,
                        location.code,
                        location.description,
                    ).joinToString(" "),
                ).contains(query)
            }
            .sortedWith(
                compareBy<StockLocationBox>(
                    { it.boxNumber ?: Int.MAX_VALUE },
                    { normalizeSearchText(it.displayName) },
                ),
            )
            .toList()
    }

    private fun normalizeSearchText(value: String): String =
        Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
            .lowercase()

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
                    SalesCache.clearAll(applicationContext)
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
        private const val REQUEST_NOTIFICATIONS = 43
        private const val REQUEST_SALES_SYSTEM_SOUND = 44
        private const val REQUEST_SALES_CUSTOM_SOUND = 45
        private const val SESSION_PREFERENCES = "mdv_admin_session"
        private const val SESSION_TOKEN_KEY = "access_token"
        private const val LABEL_PRODUCT_KEY = "selected_label_product"
        private const val PRINTER_PROFILE_KEY = "printer_profile"
        private const val GENERIC_PRINTER_ADDRESS_KEY = "generic_printer_address"
        private const val STATE_LABEL_PRODUCT = "state_label_product"
        private const val STATE_SCREEN = "state_screen"
        private const val STATE_STOCK_LOCATION_ID = "state_stock_location_id"
        private const val STATE_STOCK_LOCATION_NAME = "state_stock_location_name"
        private const val STATE_TRANSFER_LINES = "state_transfer_lines"
        private const val STATE_TRANSFER_TARGET_ID = "state_transfer_target_id"
        private const val STATE_SALES_CHANNEL = "state_sales_channel"
        private const val STATE_SALE_ID = "state_sale_id"
        private const val STATE_SALES_FILTER = "state_sales_filter"
        private const val STATE_CUSTOM_LABEL_TEXT = "state_custom_label_text"
        private const val STATE_CUSTOM_LABEL_FONT_PERCENT = "state_custom_label_font_percent"
        private const val SCREEN_LOGIN = "login"
        private const val SCREEN_DASHBOARD = "dashboard"
        private const val SCREEN_PERMISSIONS = "permissions"
        private const val SCREEN_STOCK = "stock"
        private const val SCREEN_STOCK_CONTENTS = "stock_contents"
        private const val SCREEN_STOCK_BATCH_BUILD = "stock_batch_build"
        private const val SCREEN_STOCK_TRANSFER = "stock_transfer"
        private const val SCREEN_LABELS = "labels"
        private const val SCREEN_CUSTOM_LABEL = "custom_label"
        private const val SCREEN_SALES = "sales"
        private const val SCREEN_SALES_SOUND = "sales_sound"
        private const val SCREEN_SALES_LIST = "sales_list"
        private const val SCREEN_SALES_DETAIL = "sales_detail"
        private val STOCK_LOCATION_FILTER_LABELS = listOf(
            "Todas as caixas",
            "Caixas 1 a 20",
            "Caixas 21 a 40",
            "Caixas 41 a 60",
            "Caixas 61 a 80",
            "Caixas 81 ou mais",
            "Outros locais",
        )
    }
}
