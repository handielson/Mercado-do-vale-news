package br.com.mercadodovale.adminestoque

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.widget.*
import br.com.mercadodovale.adminestoque.data.VpsApiClient
import org.json.JSONObject
import java.net.URLEncoder

class MainActivity : Activity() {
    private var token: String? = null
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
        root.addView(text("MDV Admin Estoque", 30, green))
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
        root.addView(text("MDV Admin Estoque", 30, green))
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
            val value = query.text.toString().trim()
            if (value.isBlank()) { result.text = "Informe um código ou nome."; return@button }
            result.text = "Consultando estoque..."
            runAsync {
                val encoded = URLEncoder.encode(value, "UTF-8")
                val response = VpsApiClient(token.orEmpty()).get("/products?search=$encoded")
                runOnUiThread { result.text = response.fold({ summarizeProducts(it) }, { it.message ?: "Falha na consulta." }) }
            }
        })
        root.addView(result)
        root.addView(text("Leitura QR", 18, green))
        root.addView(text("A câmera será usada para preencher este campo quando o leitor QR for integrado. Por enquanto, leitores Bluetooth que enviam texto funcionam diretamente neste campo.", 14, Color.DKGRAY))
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
        root.addView(button("Buscar impressoras Bluetooth") {
            if (android.os.Build.VERSION.SDK_INT >= 31 && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), 41)
            } else {
                val devices = BluetoothAdapter.getDefaultAdapter()?.bondedDevices?.joinToString("\n") { "• ${it.name ?: "Sem nome"}" }.orEmpty()
                status.text = if (devices.isBlank()) "Nenhuma impressora Bluetooth pareada encontrada." else "Pareadas:\n$devices"
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
