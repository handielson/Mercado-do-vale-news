package br.com.mercadodovale.entregas

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private val preferences by lazy { getSharedPreferences("delivery_session", MODE_PRIVATE) }
    private var sessionToken: String = ""
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var operationWebView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sessionToken = preferences.getString("access_token", "").orEmpty()
        if (sessionToken.isBlank()) showLogin() else showDashboard()
    }

    private fun showLogin(message: String = "") {
        operationWebView = null
        val root = verticalLayout(24).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.rgb(248, 250, 252))
        }
        root.addView(TextView(this).apply {
            text = "MDV"
            textSize = 34f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(20, 83, 45))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, layoutParams(match = true, height = 70))
        root.addView(title("Mercado do Vale Entregas", 25f))
        root.addView(body("Acesse com o CPF ou e-mail do seu perfil de entregador."))

        val identifier = input("CPF ou e-mail")
        val password = input("Senha").apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        root.addView(identifier, spacedParams())
        root.addView(password, spacedParams())
        val feedback = body(message).apply { setTextColor(Color.rgb(185, 28, 28)) }
        root.addView(feedback, spacedParams())
        val login = primaryButton("Entrar")
        root.addView(login, spacedParams())
        root.addView(body("Versão ${BuildConfig.VERSION_NAME}").apply { gravity = Gravity.CENTER }, spacedParams())

        login.setOnClickListener {
            val id = identifier.text.toString().trim()
            val secret = password.text.toString()
            if (id.isBlank() || secret.isBlank()) {
                feedback.text = "Informe seu CPF/e-mail e a senha."
                return@setOnClickListener
            }
            login.isEnabled = false
            feedback.text = "Entrando..."
            thread {
                runCatching {
                    apiRequest(
                        "/auth/login",
                        "POST",
                        JSONObject().put("email", id).put("cpf_cnpj", id).put("password", secret),
                        bearer = ""
                    ).getString("token")
                }.onSuccess { token ->
                    sessionToken = token
                    preferences.edit().putString("access_token", token).apply()
                    runOnUiThread { showDashboard() }
                }.onFailure { error ->
                    runOnUiThread {
                        login.isEnabled = true
                        feedback.text = friendlyError(error)
                    }
                }
            }
        }
        setSafeContentView(root)
    }

    private fun showDashboard(status: String = "open") {
        operationWebView = null
        val root = verticalLayout(0).apply { setBackgroundColor(Color.rgb(248, 250, 252)) }
        val header = verticalLayout(20).apply { setBackgroundColor(Color.rgb(20, 83, 45)) }
        val headingLine = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        headingLine.addView(TextView(this).apply {
            text = "Mercado do Vale\nEntregas"
            textSize = 22f
            setTextColor(Color.WHITE)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        headingLine.addView(Button(this).apply {
            text = "Sair"
            setOnClickListener { logout() }
        })
        header.addView(headingLine)
        root.addView(header)

        val filters = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(16, 12, 16, 8) }
        listOf("open" to "Em aberto", "delivered" to "Concluídas", "all" to "Todas").forEach { (value, label) ->
            filters.addView(Button(this).apply {
                text = label
                isEnabled = value != status
                setOnClickListener { showDashboard(value) }
            }, LinearLayout.LayoutParams(0, 52, 1f))
        }
        root.addView(filters)

        val content = verticalLayout(16)
        content.addView(ProgressBar(this).apply { isIndeterminate = true })
        root.addView(ScrollView(this).apply { addView(content) }, LinearLayout.LayoutParams(-1, 0, 1f))
        setSafeContentView(root)
        loadJobs(status, content)
    }

    private fun loadJobs(status: String, content: LinearLayout) {
        thread {
            runCatching { apiRequest("/delivery/app/jobs?status=$status", bearer = sessionToken) }
                .onSuccess { response ->
                    runOnUiThread {
                        content.removeAllViews()
                        val profile = response.optJSONObject("profile")
                        content.addView(title("Olá, ${profile?.optString("name", "Entregador") ?: "Entregador"}", 20f))
                        val jobs = response.optJSONArray("jobs") ?: JSONArray()
                        if (jobs.length() == 0) {
                            content.addView(body("Nenhuma entrega nesta categoria."), spacedParams())
                        } else {
                            for (index in 0 until jobs.length()) addJobCard(content, jobs.getJSONObject(index))
                        }
                        content.addView(primaryButton("Atualizar").apply { setOnClickListener { showDashboard(status) } }, spacedParams())
                    }
                }
                .onFailure { error ->
                    runOnUiThread {
                        if (error.message?.contains("401") == true) {
                            logout("Sua sessão expirou. Entre novamente.")
                        } else {
                            content.removeAllViews()
                            content.addView(body(friendlyError(error)).apply { setTextColor(Color.rgb(185, 28, 28)) })
                            content.addView(primaryButton("Tentar novamente").apply { setOnClickListener { showDashboard(status) } }, spacedParams())
                        }
                    }
                }
        }
    }

    private fun addJobCard(parent: LinearLayout, job: JSONObject) {
        val token = job.optString("token")
        val rawOrder = job.optString("order_number").ifBlank { job.optString("sale_id").take(8).uppercase() }
        val card = verticalLayout(16).apply {
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.WHITE); cornerRadius = 24f; setStroke(1, Color.rgb(226, 232, 240))
            }
            elevation = 3f
        }
        card.addView(title("Pedido #$rawOrder", 18f))
        card.addView(body(job.optString("buyer_name", "Cliente")))
        card.addView(body(job.optString("delivery_address_text", "Endereço não informado")))
        card.addView(body("Situação: ${statusLabel(job.optString("delivery_status"))}"))
        card.addView(body("Valor da entrega: ${formatCents(job.optLong("delivery_amount"))}"))
        card.addView(primaryButton(if (job.optString("delivery_status") == "delivered") "Ver entrega" else "Abrir entrega").apply {
            isEnabled = token.isNotBlank()
            setOnClickListener { openOperation(token) }
        }, spacedParams())
        parent.addView(card, spacedParams())
    }

    private fun openOperation(token: String) {
        val webView = WebView(this)
        operationWebView = webView
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val host = uri.host.orEmpty().lowercase()
                if (uri.scheme == "https" && (host == "mercadodovale.com.br" || host.endsWith(".mercadodovale.com.br"))) return false
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                return true
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(webView: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = callback
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply { type = "image/*"; addCategory(Intent.CATEGORY_OPENABLE) }
                startActivityForResult(Intent.createChooser(intent, "Foto da entrega"), FILE_CHOOSER_REQUEST)
                return true
            }
        }
        webView.loadUrl("${BuildConfig.WEB_BASE_URL}/delivery/${Uri.encode(token)}")
        setSafeContentView(webView)
    }

    @Deprecated("Deprecated in Android")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val result = if (resultCode == RESULT_OK) data?.data?.let { arrayOf(it) } else null
            fileChooserCallback?.onReceiveValue(result)
            fileChooserCallback = null
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    @Deprecated("Deprecated in Android")
    override fun onBackPressed() {
        val web = operationWebView
        when {
            web?.canGoBack() == true -> web.goBack()
            web != null -> showDashboard()
            else -> super.onBackPressed()
        }
    }

    private fun apiRequest(path: String, method: String = "GET", body: JSONObject? = null, bearer: String): JSONObject {
        val connection = URL("${BuildConfig.VPS_BASE_URL}$path").openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 25_000
            connection.setRequestProperty("Accept", "application/json")
            if (bearer.isNotBlank()) connection.setRequestProperty("Authorization", "Bearer $bearer")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(body.toString().toByteArray(StandardCharsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = if (text.isBlank()) JSONObject() else JSONObject(text)
            if (code !in 200..299) throw IllegalStateException("HTTP $code: ${json.optString("error", "Falha na API")}")
            json
        } finally {
            connection.disconnect()
        }
    }

    private fun logout(message: String = "") {
        sessionToken = ""
        preferences.edit().remove("access_token").apply()
        showLogin(message)
    }

    private fun setSafeContentView(view: View) {
        val initialLeft = view.paddingLeft
        val initialTop = view.paddingTop
        val initialRight = view.paddingRight
        val initialBottom = view.paddingBottom
        ViewCompat.setOnApplyWindowInsetsListener(view) { target, windowInsets ->
            val bars: Insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            target.setPadding(
                initialLeft + bars.left,
                initialTop + bars.top,
                initialRight + bars.right,
                initialBottom + bars.bottom
            )
            windowInsets
        }
        setContentView(view)
        ViewCompat.requestApplyInsets(view)
    }

    private fun friendlyError(error: Throwable): String = when {
        error.message?.contains("Perfil de entregador", true) == true -> "Seu cadastro ainda não está habilitado como entregador. Fale com a loja."
        error.message?.contains("Acesso exclusivo", true) == true -> "Este perfil não tem acesso às entregas."
        error.message?.contains("401") == true -> "CPF/e-mail ou senha inválidos."
        else -> "Não foi possível conectar. Confira a internet e tente novamente."
    }

    private fun statusLabel(value: String) = when (value) {
        "pending" -> "Aguardando saída"
        "in_route" -> "Em rota"
        "delivered" -> "Entregue"
        "cancelled" -> "Cancelada"
        else -> value
    }

    private fun formatCents(value: Long): String = "R$ %.2f".format(java.util.Locale("pt", "BR"), value / 100.0)
    private fun verticalLayout(padding: Int) = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(padding, padding, padding, padding) }
    private fun title(value: String, size: Float) = TextView(this).apply { text = value; textSize = size; setTextColor(Color.rgb(15, 23, 42)); setTypeface(typeface, android.graphics.Typeface.BOLD) }
    private fun body(value: String) = TextView(this).apply { text = value; textSize = 15f; setTextColor(Color.rgb(71, 85, 105)); setLineSpacing(0f, 1.15f) }
    private fun input(hintValue: String) = EditText(this).apply { hint = hintValue; textSize = 16f; setPadding(16, 12, 16, 12); background = android.graphics.drawable.GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = 18f; setStroke(1, Color.rgb(203, 213, 225)) } }
    private fun primaryButton(label: String) = Button(this).apply { text = label; setTextColor(Color.WHITE); backgroundTintList = android.content.res.ColorStateList.valueOf(Color.rgb(22, 163, 74)) }
    private fun layoutParams(match: Boolean = false, height: Int = LinearLayout.LayoutParams.WRAP_CONTENT) = LinearLayout.LayoutParams(if (match) -1 else -2, height)
    private fun spacedParams() = LinearLayout.LayoutParams(-1, LinearLayout.LayoutParams.WRAP_CONTENT).apply { setMargins(0, 12, 0, 0) }

    companion object { private const val FILE_CHOOSER_REQUEST = 8101 }
}
