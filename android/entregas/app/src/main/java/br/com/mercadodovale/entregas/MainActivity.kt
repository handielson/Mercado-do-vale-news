package br.com.mercadodovale.entregas

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.os.Build
import android.view.Gravity
import android.view.View
import android.webkit.ValueCallback
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import androidx.core.graphics.Insets
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.io.File
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private val preferences by lazy { getSharedPreferences("delivery_session", MODE_PRIVATE) }
    private var sessionToken: String = ""
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraPhotoUri: Uri? = null
    private var operationWebView: WebView? = null
    private var pendingTrackingJobId: String = ""

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
                        val summary = response.optJSONObject("delivery_summary")
                        if (summary != null) {
                            content.addView(body("${summary.optInt("jobs")} entregas · Custo ${formatCents(summary.optLong("cost_cents"))}"), spacedParams())
                        }
                        val jobs = response.optJSONArray("jobs") ?: JSONArray()
                        val deliveryPeople = response.optJSONArray("delivery_people") ?: JSONArray()
                        if (jobs.length() == 0) {
                            content.addView(body("Nenhuma entrega nesta categoria."), spacedParams())
                        } else {
                            for (index in 0 until jobs.length()) addJobCard(content, jobs.getJSONObject(index), deliveryPeople)
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

    private fun addJobCard(parent: LinearLayout, job: JSONObject, deliveryPeople: JSONArray) {
        val token = job.optString("token")
        val jobId = job.optString("id")
        val assigneeId = job.optString("delivery_person_customer_id")
        val assigneeName = job.optString("delivery_person_name")
        val rawOrder = job.optString("sale_id").take(8).uppercase().ifBlank {
            job.optString("order_number").take(8).uppercase()
        }
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
        card.addView(body("Entregador: ${assigneeName.ifBlank { "A definir pela loja" }}"))
        if (assigneeId == "store:unassigned" && deliveryPeople.length() > 0 && job.optString("delivery_status") !in listOf("delivered", "cancelled")) {
            val people = (0 until deliveryPeople.length()).map { deliveryPeople.getJSONObject(it) }
            val selector = Spinner(this).apply {
                adapter = ArrayAdapter(
                    this@MainActivity,
                    android.R.layout.simple_spinner_dropdown_item,
                    listOf("Selecione quem fará a entrega") + people.map { it.optString("name", "Entregador") }
                )
            }
            card.addView(selector, spacedParams())
            val assignmentFeedback = body("").apply { setTextColor(Color.rgb(185, 28, 28)) }
            card.addView(assignmentFeedback, spacedParams())
            card.addView(primaryButton("Definir quem entregou").apply {
                setOnClickListener {
                    if (selector.selectedItemPosition <= 0) {
                        assignmentFeedback.text = "Selecione quem fará a entrega."
                        return@setOnClickListener
                    }
                    val selected = people[selector.selectedItemPosition - 1]
                    isEnabled = false
                    assignmentFeedback.text = "Salvando responsável..."
                    thread {
                        runCatching {
                            apiRequest(
                                "/delivery/app/jobs/$jobId/assign",
                                "POST",
                                JSONObject().put("delivery_person_id", selected.getString("id")),
                                bearer = sessionToken
                            )
                        }.onSuccess { runOnUiThread { showDashboard() } }
                            .onFailure { error ->
                                runOnUiThread {
                                    isEnabled = true
                                    assignmentFeedback.text = friendlyError(error)
                                }
                            }
                    }
                }
            }, spacedParams())
        }
        card.addView(primaryButton(if (job.optString("delivery_status") == "delivered") "Ver entrega" else "Abrir entrega").apply {
            isEnabled = token.isNotBlank() && assigneeId != "store:unassigned"
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
        webView.addJavascriptInterface(DeliveryBridge(), "MdvDelivery")
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
                val photoFile = File.createTempFile("delivery-proof-", ".jpg", cacheDir)
                val photoUri = FileProvider.getUriForFile(this@MainActivity, "$packageName.fileprovider", photoFile)
                pendingCameraPhotoUri = photoUri
                val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                }
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST)
                } catch (_: Exception) {
                    pendingCameraPhotoUri = null
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                }
                return true
            }
        }
        webView.loadUrl("${BuildConfig.WEB_BASE_URL}/delivery/${Uri.encode(token)}")
        setSafeContentView(webView)
    }

    @Deprecated("Deprecated in Android")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val result = if (resultCode == RESULT_OK) pendingCameraPhotoUri?.let { arrayOf(it) } else null
            fileChooserCallback?.onReceiveValue(result)
            fileChooserCallback = null
            pendingCameraPhotoUri = null
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
        stopLocationTracking()
        sessionToken = ""
        preferences.edit().remove("access_token").apply()
        showLogin(message)
    }

    private inner class DeliveryBridge {
        @JavascriptInterface
        fun startTracking(jobId: String) {
            val safeJobId = jobId.trim()
            if (!safeJobId.matches(Regex("^[a-zA-Z0-9-]{8,80}$"))) return
            runOnUiThread { ensureLocationPermissionAndStart(safeJobId) }
        }

        @JavascriptInterface
        fun stopTracking() { runOnUiThread { stopLocationTracking() } }
    }

    private fun ensureLocationPermissionAndStart(jobId: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            ensureNotificationPermissionAndStart(jobId)
            return
        }
        pendingTrackingJobId = jobId
        requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), LOCATION_PERMISSION_REQUEST)
    }

    private fun startLocationTracking(jobId: String) {
        ContextCompat.startForegroundService(this, Intent(this, LocationTrackingService::class.java).putExtra(LocationTrackingService.EXTRA_JOB_ID, jobId))
    }

    private fun ensureNotificationPermissionAndStart(jobId: String) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            pendingTrackingJobId = jobId
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_PERMISSION_REQUEST)
            return
        }
        startLocationTracking(jobId)
    }

    private fun stopLocationTracking() {
        startService(Intent(this, LocationTrackingService::class.java).setAction(LocationTrackingService.ACTION_STOP))
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
            val jobId = pendingTrackingJobId
            pendingTrackingJobId = ""
            if (jobId.isNotBlank()) startLocationTracking(jobId)
            return
        }
        if (requestCode != LOCATION_PERMISSION_REQUEST) return
        val jobId = pendingTrackingJobId
        pendingTrackingJobId = ""
        if (grantResults.any { it == PackageManager.PERMISSION_GRANTED } && jobId.isNotBlank()) {
            ensureNotificationPermissionAndStart(jobId)
        } else {
            android.widget.Toast.makeText(this, "O GPS e necessario para o cliente acompanhar a entrega.", android.widget.Toast.LENGTH_LONG).show()
        }
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

    companion object {
        private const val FILE_CHOOSER_REQUEST = 8101
        private const val LOCATION_PERMISSION_REQUEST = 8102
        private const val NOTIFICATION_PERMISSION_REQUEST = 8103
    }
}
