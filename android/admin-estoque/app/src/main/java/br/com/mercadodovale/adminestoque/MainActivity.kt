package br.com.mercadodovale.adminestoque

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothProfile
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.widget.*
import br.com.mercadodovale.adminestoque.data.VpsApiClient
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONObject
import java.net.URLEncoder

class MainActivity : Activity() {
    private var token: String? = null
    private var printerStatus: TextView? = null
    private val green = Color.rgb(11, 107, 58)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showLogin()
    }

    private fun screen(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(24), dp(20), dp(24), dp(28))
        setBackgroundColor(Color.rgb(248, 250, 248))
        setOnApplyWindowInsetsListener { view, insets ->
            view.setPadding(dp(24), insets.systemWindowInsetTop + dp(24), dp(24), dp(28))
            insets
        }
    }

    private fun showLogin() {
        val root = screen()
        root.addView(text("Gestão MDV", 30, green))
        root.addView(text("Entre com uma conta administrativa da VPS.", 16, Color.DKGRAY))
        val user = field("E-mail ou CPF")
        val password = field("Senha", true)
        val status = text("", 14, Color.DKGRAY)
        root.addView(user); root.addView(password)
        root.addView(button("Entrar") {
            status.text = "Autenticando..."
            runAsync {
                val result = VpsApiClient.login(user.text.toString(), password.text.toString())
                runOnUiThread {
                    result.fold(
                        onSuccess = { accessToken -> token = accessToken; showDashboard() },
                        onFailure = { status.text = it.message ?: "Não foi possível entrar." }
                    )
                }
            }
        })
        root.addView(status)
        setContentView(root)
    }

    private fun showDashboard() {
        val root = screen()
        root.addView(text("Gestão MDV", 30, green))
        root.addView(text("Escolha uma operação", 16, Color.DKGRAY))
        root.addView(card("Movimentar estoque", "Consultar produto por código, EAN ou QR e localizar o saldo.") { showStockLookup() })
        root.addView(card("Imprimir etiquetas", "Escolher tamanho e localizar a impressora Marklife P50 pareada.") { showLabels() })
        root.addView(button("Sair") { token = null; showLogin() })
        setContentView(root)
    }

    private fun showStockLookup() {
        val root = screen()
        root.addView(back("Movimentar estoque") { showDashboard() })
        root.addView(text("Pesquise por SKU, nome, EAN ou código lido.", 16, Color.DKGRAY))
        val query = field("Código ou nome do produto")
        val result = text("", 14, Color.DKGRAY)
        root.addView(query)
        root.addView(button("Buscar produto") {
            searchProduct(query.text.toString(), result)
        })
        root.addView(button("Ler QR ou código de barras") {
            val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(
                Barcode.FORMAT_QR_CODE, Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
                Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39
            ).build()
            GmsBarcodeScanning.getClient(this, options).startScan()
                .addOnSuccessListener { barcode ->
                    query.setText(barcode.rawValue.orEmpty())
                    searchProduct(barcode.rawValue.orEmpty(), result)
                }
                .addOnFailureListener { error -> result.text = "Não foi possível abrir o leitor: ${error.message}" }
        })
        root.addView(result)
        root.addView(text("O leitor usa a câmera do aparelho e também reconhece EAN e Code 128.", 14, Color.DKGRAY))
        setContentView(root)
    }

    private fun showLabels() {
        val root = screen()
        root.addView(back("Imprimir etiquetas") { showDashboard() })
        val product = field("SKU, EAN ou código do produto")
        val copies = field("Quantidade de etiquetas")
        val sizes = Spinner(this).apply { adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, listOf("20 × 20 mm", "30 × 30 mm", "40 × 30 mm", "50 × 30 mm")) }
        val status = text("", 14, Color.DKGRAY)
        root.addView(product); root.addView(text("Tamanho da etiqueta", 15, Color.DKGRAY)); root.addView(sizes); root.addView(copies)
        root.addView(button("Buscar produto para etiqueta") { searchProduct(product.text.toString(), status) })
        root.addView(button("Ler QR ou código do produto") { scanTo(product, status) })
        root.addView(button("Conectar à Marklife P50") {
            printerStatus = status
            if (android.os.Build.VERSION.SDK_INT >= 31 && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), 41)
            } else {
                connectP50(status)
            }
        })
        root.addView(status)
        root.addView(text("A impressão só será liberada após validarmos os comandos proprietários da P50 em uma impressora física.", 14, Color.DKGRAY))
        setContentView(root)
    }

    private fun summarizeProducts(body: String): String = try {
        val item = JSONObject(body)
        if (item.has("error")) item.getString("error") else "Consulta recebida. Selecione o produto no próximo passo."
    } catch (_: Exception) { "Consulta concluída. ${body.take(600)}" }

    private fun searchProduct(rawQuery: String, result: TextView) {
        val value = rawQuery.trim()
        if (value.isBlank()) { result.text = "Informe ou leia um código."; return }
        result.text = "Consultando estoque..."
        runAsync {
            val encoded = URLEncoder.encode(value, "UTF-8")
            val response = VpsApiClient(token.orEmpty()).get("/products?search=$encoded")
            runOnUiThread { result.text = response.fold({ summarizeProducts(it) }, { it.message ?: "Falha na consulta." }) }
        }
    }

    private fun scanTo(target: EditText, result: TextView) {
        val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(
            Barcode.FORMAT_QR_CODE, Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39
        ).build()
        GmsBarcodeScanning.getClient(this, options).startScan()
            .addOnSuccessListener { barcode -> target.setText(barcode.rawValue.orEmpty()); searchProduct(barcode.rawValue.orEmpty(), result) }
            .addOnFailureListener { error -> result.text = "Não foi possível abrir o leitor: ${error.message}" }
    }

    private fun connectP50(status: TextView) {
        val printer = BluetoothAdapter.getDefaultAdapter()?.bondedDevices?.firstOrNull {
            it.name?.contains("P50", true) == true || it.name?.contains("MARKLIFE", true) == true
        }
        if (printer == null) { status.text = "P50 não encontrada. Ligue e pareie a impressora primeiro."; return }
        status.text = "P50 encontrada (${printer.name}). Conectando..."
        printer.connectGatt(this, false, object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, state: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_CONNECTED) gatt.discoverServices()
                else if (newState == BluetoothProfile.STATE_DISCONNECTED) runOnUiThread { status.text = "P50 desconectada." }
            }
            override fun onServicesDiscovered(gatt: BluetoothGatt, state: Int) {
                val service = gatt.services.firstOrNull { it.uuid.toString().startsWith("0000ff00", true) }
                runOnUiThread {
                    status.text = if (state == BluetoothGatt.GATT_SUCCESS && service != null) "P50 conectada e reconhecida. Serviço FF00 disponível." else "Conectou, mas o serviço de impressão FF00 não foi encontrado."
                }
            }
        })
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 41) {
            val status = printerStatus
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED && status != null) connectP50(status)
            else status?.text = "A permissão Bluetooth é necessária para conectar à P50."
        }
    }

    private fun field(hint: String, secret: Boolean = false) = EditText(this).apply {
        this.hint = hint
        textSize = 16f
        if (secret) inputType = 0x81
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(14) }
    }
    private fun text(value: String, size: Int, color: Int) = TextView(this).apply { text = value; textSize = size.toFloat(); setTextColor(color); setPadding(0, 0, 0, dp(16)) }
    private fun button(label: String, action: () -> Unit) = Button(this).apply { text = label; setOnClickListener { action() }; layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(14) } }
    private fun back(label: String, action: () -> Unit) = Button(this).apply { text = "‹  $label"; setOnClickListener { action() } }
    private fun card(heading: String, detail: String, action: () -> Unit) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(18), dp(18), dp(18)); setBackgroundColor(Color.WHITE); isClickable = true; setOnClickListener { action() }
        addView(text(heading, 21, green)); addView(text(detail, 15, Color.DKGRAY))
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(16) }
    }
    private fun runAsync(work: () -> Unit) = Thread(work).start()
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
