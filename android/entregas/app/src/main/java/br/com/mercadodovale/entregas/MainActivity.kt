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
import android.view.MotionEvent
import android.view.View
import android.view.animation.DecelerateInterpolator
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
    private var currentTab: String = "dashboard" // "dashboard" or "jobs"
    private var currentPeriod: String = "today"  // "today", "yesterday", "7d", "month", "all", "custom"
    private var customDate: String = "" // "YYYY-MM-DD"
    private var currentJobStatus: String = "open" // "open", "delivered", "all"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sessionToken = preferences.getString("access_token", "").orEmpty()
        if (sessionToken.isBlank()) showLogin() else showMainScreen()
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
                    runOnUiThread { showMainScreen() }
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

    private fun showDatePickerDialog() {
        val calendar = java.util.Calendar.getInstance()
        val dpd = android.app.DatePickerDialog(
            this,
            { _, year, month, dayOfMonth ->
                customDate = String.format("%04d-%02d-%02d", year, month + 1, dayOfMonth)
                currentPeriod = "custom"
                showMainScreen()
            },
            calendar.get(java.util.Calendar.YEAR),
            calendar.get(java.util.Calendar.MONTH),
            calendar.get(java.util.Calendar.DAY_OF_MONTH)
        )
        dpd.show()
    }

    private fun formatCustomDateLabel(dateStr: String): String {
        return try {
            val parts = dateStr.split("-")
            if (parts.size == 3) "${parts[2]}/${parts[1]}" else dateStr
        } catch (_: Exception) {
            dateStr
        }
    }

    private fun showDashboard(status: String = "open") {
        currentTab = "jobs"
        currentJobStatus = status
        showMainScreen()
    }

    private fun showMainScreen() {
        operationWebView = null
        val root = verticalLayout(0).apply { setBackgroundColor(Color.rgb(248, 250, 252)) }

        val header = verticalLayout(16).apply {
            setBackgroundColor(Color.rgb(20, 83, 45))
        }
        val headingLine = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        headingLine.addView(TextView(this).apply {
            text = "Mercado do Vale\nEntregas"
            textSize = 22f
            setTextColor(Color.WHITE)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

        val logoutBtn = TextView(this).apply {
            text = "Sair"
            textSize = 14f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(32, 16, 32, 16)
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.argb(50, 255, 255, 255))
                cornerRadius = 24f
            }
        }
        setupIPhonePressEffect(logoutBtn) { logout() }
        headingLine.addView(logoutBtn)
        header.addView(headingLine)

        // Segmented Control em Cápsula (Estilo iPhone)
        val capsuleContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(6, 6, 6, 6)
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.argb(60, 0, 0, 0))
                cornerRadius = 32f
            }
            layoutParams = LinearLayout.LayoutParams(-1, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                setMargins(0, 14, 0, 0)
            }
        }

        val isDashboard = currentTab == "dashboard"
        val dashboardTab = TextView(this).apply {
            text = "📊 Resumos"
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(0, 18, 0, 18)
            setTextColor(if (isDashboard) Color.rgb(20, 83, 45) else Color.rgb(220, 252, 231))
            setTypeface(typeface, if (isDashboard) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
            background = if (isDashboard) {
                android.graphics.drawable.GradientDrawable().apply {
                    setColor(Color.WHITE)
                    cornerRadius = 26f
                }
            } else null
        }
        setupIPhonePressEffect(dashboardTab) {
            if (currentTab != "dashboard") {
                currentTab = "dashboard"
                showMainScreen()
            }
        }
        capsuleContainer.addView(dashboardTab, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

        val jobsTab = TextView(this).apply {
            text = "📋 Entregas"
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(0, 18, 0, 18)
            setTextColor(if (!isDashboard) Color.rgb(20, 83, 45) else Color.rgb(220, 252, 231))
            setTypeface(typeface, if (!isDashboard) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
            background = if (!isDashboard) {
                android.graphics.drawable.GradientDrawable().apply {
                    setColor(Color.WHITE)
                    cornerRadius = 26f
                }
            } else null
        }
        setupIPhonePressEffect(jobsTab) {
            if (currentTab != "jobs") {
                currentTab = "jobs"
                showMainScreen()
            }
        }
        capsuleContainer.addView(jobsTab, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        header.addView(capsuleContainer)

        // Barra de Filtro de Período Horizontal (Estilo iOS Chips)
        val periodScrollView = android.widget.HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            setPadding(0, 10, 0, 2)
        }
        val periodRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        val periodOptions = listOf(
            "today" to "Hoje",
            "yesterday" to "Ontem",
            "7d" to "7 dias",
            "month" to "Mês",
            "all" to "Tudo"
        )
        for ((code, label) in periodOptions) {
            val isSelected = currentPeriod == code
            val chip = TextView(this).apply {
                text = label
                textSize = 13f
                gravity = Gravity.CENTER
                setPadding(26, 12, 26, 12)
                setTextColor(if (isSelected) Color.rgb(20, 83, 45) else Color.rgb(220, 252, 231))
                setTypeface(typeface, if (isSelected) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
                background = android.graphics.drawable.GradientDrawable().apply {
                    if (isSelected) {
                        setColor(Color.WHITE)
                    } else {
                        setColor(Color.argb(40, 255, 255, 255))
                    }
                    cornerRadius = 20f
                }
            }
            setupIPhonePressEffect(chip) {
                if (currentPeriod != code) {
                    currentPeriod = code
                    customDate = ""
                    showMainScreen()
                }
            }
            periodRow.addView(chip, LinearLayout.LayoutParams(-2, -2).apply { setMargins(0, 0, 8, 0) })
        }

        val isCustomSelected = currentPeriod == "custom"
        val customLabel = if (isCustomSelected && customDate.isNotEmpty()) {
            "📅 ${formatCustomDateLabel(customDate)}"
        } else {
            "📅 Data"
        }
        val customDateChip = TextView(this).apply {
            text = customLabel
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding(26, 12, 26, 12)
            setTextColor(if (isCustomSelected) Color.rgb(20, 83, 45) else Color.rgb(220, 252, 231))
            setTypeface(typeface, if (isCustomSelected) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
            background = android.graphics.drawable.GradientDrawable().apply {
                if (isCustomSelected) {
                    setColor(Color.WHITE)
                } else {
                    setColor(Color.argb(40, 255, 255, 255))
                }
                cornerRadius = 20f
            }
        }
        setupIPhonePressEffect(customDateChip) {
            showDatePickerDialog()
        }
        periodRow.addView(customDateChip, LinearLayout.LayoutParams(-2, -2))
        periodScrollView.addView(periodRow)
        header.addView(periodScrollView)

        root.addView(header)

        val content = verticalLayout(16)
        content.addView(ProgressBar(this).apply { isIndeterminate = true })
        root.addView(ScrollView(this).apply { addView(content) }, LinearLayout.LayoutParams(-1, 0, 1f))
        setSafeContentView(root)

        if (isDashboard) {
            renderDashboardTab(content)
        } else {
            renderJobsTab(content)
        }
    }

    private fun renderDashboardTab(content: LinearLayout) {
        val dateParams = if (currentPeriod == "custom" && customDate.isNotEmpty()) {
            "&date_from=$customDate&date_to=$customDate"
        } else ""
        thread {
            runCatching { apiRequest("/delivery/app/dashboard?period=$currentPeriod$dateParams", bearer = sessionToken) }
                .onSuccess { response ->
                    runOnUiThread {
                        content.removeAllViews()
                        val profile = response.optJSONObject("profile")
                        val summary = response.optJSONObject("summary") ?: JSONObject()
                        val byPerson = response.optJSONArray("by_person") ?: JSONArray()

                        content.addView(title("Olá, ${profile?.optString("name", "Loja") ?: "Entregador"}", 22f))
                        val periodSubtitle = when (currentPeriod) {
                            "today" -> "Hoje"
                            "yesterday" -> "Ontem"
                            "7d" -> "Últimos 7 dias"
                            "month" -> "Este Mês"
                            "custom" -> "Data: ${formatCustomDateLabel(customDate)}"
                            else -> "Histórico completo"
                        }
                        content.addView(body("Resumo operacional · $periodSubtitle"), LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 2, 0, 14) })

                        // Grid 2 Colunas de KPIs Navegáveis
                        val totalJobs = summary.optInt("total_jobs")
                        val pendingJobs = summary.optInt("pending_jobs")
                        val inRouteJobs = summary.optInt("in_route_jobs")
                        val deliveredJobs = summary.optInt("delivered_jobs")

                        val row1 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                        row1.addView(createKpiCard("📦", "Total Pedidos", totalJobs.toString(), Color.rgb(15, 23, 42), Color.rgb(241, 245, 249)) {
                            currentTab = "jobs"
                            currentJobStatus = "all"
                            showMainScreen()
                        }, LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(0, 0, 6, 12) })

                        row1.addView(createKpiCard("⏳", "Pendentes", pendingJobs.toString(), Color.rgb(180, 83, 9), Color.rgb(254, 243, 199)) {
                            currentTab = "jobs"
                            currentJobStatus = "open"
                            showMainScreen()
                        }, LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(6, 0, 0, 12) })
                        content.addView(row1)

                        val row2 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                        row2.addView(createKpiCard("🛵", "Em Rota", inRouteJobs.toString(), Color.rgb(29, 78, 216), Color.rgb(219, 234, 254)) {
                            currentTab = "jobs"
                            currentJobStatus = "open"
                            showMainScreen()
                        }, LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(0, 0, 6, 12) })

                        row2.addView(createKpiCard("✅", "Concluídas", deliveredJobs.toString(), Color.rgb(22, 101, 52), Color.rgb(220, 252, 231)) {
                            currentTab = "jobs"
                            currentJobStatus = "delivered"
                            showMainScreen()
                        }, LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(6, 0, 0, 12) })
                        content.addView(row2)

                        // Card Destaque de Frete Total
                        val freteCard = verticalLayout(18).apply {
                            background = android.graphics.drawable.GradientDrawable().apply {
                                setColor(Color.WHITE)
                                cornerRadius = 24f
                                setStroke(2, Color.rgb(226, 232, 240))
                            }
                            elevation = 3f
                        }
                        val freteHeader = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
                        freteHeader.addView(TextView(this).apply { text = "💰"; textSize = 22f })
                        freteHeader.addView(TextView(this).apply {
                            text = "  Total em Fretes no Período"
                            textSize = 14f
                            setTextColor(Color.rgb(100, 116, 139))
                            setTypeface(typeface, android.graphics.Typeface.BOLD)
                        })
                        freteCard.addView(freteHeader)
                        freteCard.addView(TextView(this).apply {
                            text = formatCents(summary.optLong("total_delivery_cents"))
                            textSize = 30f
                            setTextColor(Color.rgb(20, 83, 45))
                            setTypeface(typeface, android.graphics.Typeface.BOLD)
                        }, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 6, 0, 2) })
                        freteCard.addView(body("Soma das taxas de entregas no período selecionado."))
                        setupIPhonePressEffect(freteCard) {
                            currentTab = "jobs"
                            currentJobStatus = "all"
                            showMainScreen()
                        }
                        content.addView(freteCard, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 0, 0, 16) })

                        // Desempenho por Entregador (se houver)
                        if (byPerson.length() > 0) {
                            content.addView(title("Entregas por Responsável", 18f))
                            val teamGroup = verticalLayout(0).apply {
                                background = android.graphics.drawable.GradientDrawable().apply {
                                    setColor(Color.WHITE)
                                    cornerRadius = 24f
                                    setStroke(2, Color.rgb(226, 232, 240))
                                }
                                elevation = 3f
                                layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 10, 0, 16) }
                            }
                            for (i in 0 until byPerson.length()) {
                                val person = byPerson.getJSONObject(i)
                                val personItem = LinearLayout(this).apply {
                                    orientation = LinearLayout.HORIZONTAL
                                    gravity = Gravity.CENTER_VERTICAL
                                    setPadding(18, 16, 18, 16)
                                }
                                val initials = person.optString("person_name", "E").split(" ")
                                    .filter { it.isNotBlank() }
                                    .take(2)
                                    .map { it.first().uppercase() }
                                    .joinToString("")
                                val avatar = TextView(this).apply {
                                    text = initials.ifBlank { "E" }
                                    textSize = 14f
                                    gravity = Gravity.CENTER
                                    setTextColor(Color.rgb(20, 83, 45))
                                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                                    background = android.graphics.drawable.GradientDrawable().apply {
                                        setColor(Color.rgb(220, 252, 231))
                                        cornerRadius = 30f
                                    }
                                }
                                personItem.addView(avatar, LinearLayout.LayoutParams(42, 42))

                                val personInfo = verticalLayout(0).apply {
                                    layoutParams = LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(14, 0, 0, 0) }
                                }
                                personInfo.addView(TextView(this).apply {
                                    text = person.optString("person_name", "Entregador")
                                    textSize = 15f
                                    setTextColor(Color.rgb(15, 23, 42))
                                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                                })
                                personInfo.addView(TextView(this).apply {
                                    text = "${person.optInt("delivered_count")} entregas concluídas"
                                    textSize = 13f
                                    setTextColor(Color.rgb(100, 116, 139))
                                })
                                personItem.addView(personInfo)

                                personItem.addView(TextView(this).apply {
                                    text = formatCents(person.optLong("total_amount_cents"))
                                    textSize = 14f
                                    setTextColor(Color.rgb(20, 83, 45))
                                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                                })

                                teamGroup.addView(personItem)
                                if (i < byPerson.length() - 1) {
                                    teamGroup.addView(View(this).apply {
                                        setBackgroundColor(Color.rgb(241, 245, 249))
                                        layoutParams = LinearLayout.LayoutParams(-1, 2).apply { setMargins(18, 0, 18, 0) }
                                    })
                                }
                            }
                            content.addView(teamGroup)
                        }

                        val refreshBtn = primaryButton("Atualizar Resumos")
                        setupIPhonePressEffect(refreshBtn) { renderDashboardTab(content) }
                        content.addView(refreshBtn, spacedParams())

                        fadeInSlide(content)
                    }
                }
                .onFailure { error ->
                    runOnUiThread {
                        if (error.message?.contains("401") == true) {
                            logout("Sua sessão expirou. Entre novamente.")
                        } else {
                            content.removeAllViews()
                            content.addView(body(friendlyError(error)).apply { setTextColor(Color.rgb(185, 28, 28)) })
                            val retryBtn = primaryButton("Tentar novamente")
                            setupIPhonePressEffect(retryBtn) { renderDashboardTab(content) }
                            content.addView(retryBtn, spacedParams())
                        }
                    }
                }
        }
    }

    private fun createKpiCard(icon: String, label: String, value: String, accentColor: Int, badgeBg: Int, onClick: () -> Unit): View {
        val card = verticalLayout(14).apply {
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadius = 22f
                setStroke(2, Color.rgb(226, 232, 240))
            }
            elevation = 3f
        }
        val topRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val iconBadge = TextView(this).apply {
            text = icon
            textSize = 16f
            gravity = Gravity.CENTER
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(badgeBg)
                cornerRadius = 16f
            }
        }
        topRow.addView(iconBadge, LinearLayout.LayoutParams(34, 34))
        topRow.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        topRow.addView(TextView(this).apply {
            text = "›"
            textSize = 22f
            setTextColor(Color.rgb(148, 163, 184))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        card.addView(topRow)

        card.addView(TextView(this).apply {
            text = value
            textSize = 30f
            setTextColor(accentColor)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 8, 0, 0) })

        card.addView(TextView(this).apply {
            text = label
            textSize = 13f
            setTextColor(Color.rgb(100, 116, 139))
        })

        setupIPhonePressEffect(card, onClick)
        return card
    }

    private fun renderJobsTab(content: LinearLayout) {
        val filterRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 0, 0, 12)
        }
        listOf("open" to "Em aberto", "delivered" to "Concluídas", "all" to "Todas").forEach { (value, label) ->
            val isSelected = currentJobStatus == value
            val filterChip = TextView(this).apply {
                text = label
                textSize = 14f
                gravity = Gravity.CENTER
                setPadding(20, 14, 20, 14)
                setTextColor(if (isSelected) Color.WHITE else Color.rgb(71, 85, 105))
                setTypeface(typeface, if (isSelected) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
                background = android.graphics.drawable.GradientDrawable().apply {
                    if (isSelected) {
                        setColor(Color.rgb(20, 83, 45))
                    } else {
                        setColor(Color.WHITE)
                        setStroke(2, Color.rgb(226, 232, 240))
                    }
                    cornerRadius = 20f
                }
            }
            setupIPhonePressEffect(filterChip) {
                if (currentJobStatus != value) {
                    currentJobStatus = value
                    renderJobsTab(content)
                }
            }
            filterRow.addView(filterChip, LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(4, 0, 4, 0) })
        }
        content.removeAllViews()
        content.addView(filterRow)

        val listContainer = verticalLayout(0)
        listContainer.addView(ProgressBar(this).apply { isIndeterminate = true })
        content.addView(listContainer)

        loadJobs(currentJobStatus, listContainer)
    }

    private fun loadJobs(status: String, content: LinearLayout) {
        val dateParams = if (currentPeriod == "custom" && customDate.isNotEmpty()) {
            "&date_from=$customDate&date_to=$customDate"
        } else ""
        thread {
            runCatching { apiRequest("/delivery/app/jobs?status=$status&period=$currentPeriod$dateParams", bearer = sessionToken) }
                .onSuccess { response ->
                    runOnUiThread {
                        content.removeAllViews()
                        val jobs = response.optJSONArray("jobs") ?: JSONArray()
                        val deliveryPeople = response.optJSONArray("delivery_people") ?: JSONArray()
                        val summary = response.optJSONObject("delivery_summary")
                        if (summary != null) {
                            val periodSubtitle = when (currentPeriod) {
                                "today" -> "Hoje"
                                "yesterday" -> "Ontem"
                                "7d" -> "Últimos 7 dias"
                                "month" -> "Este Mês"
                                "custom" -> formatCustomDateLabel(customDate)
                                else -> "Histórico completo"
                            }
                            content.addView(body("${summary.optInt("jobs")} entregas ($periodSubtitle) · Total: ${formatCents(summary.optLong("cost_cents"))}"), LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 4, 0, 12) })
                        }
                        if (jobs.length() == 0) {
                            val emptyCard = verticalLayout(24).apply {
                                gravity = Gravity.CENTER_HORIZONTAL
                                background = android.graphics.drawable.GradientDrawable().apply {
                                    setColor(Color.WHITE)
                                    cornerRadius = 24f
                                    setStroke(2, Color.rgb(226, 232, 240))
                                }
                                setPadding(24, 32, 24, 32)
                            }
                            emptyCard.addView(TextView(this).apply { text = "📦"; textSize = 36f; gravity = Gravity.CENTER })
                            emptyCard.addView(title("Nenhuma entrega encontrada", 17f).apply { gravity = Gravity.CENTER })
                            emptyCard.addView(body("Não há entregas nesta categoria no momento.").apply { gravity = Gravity.CENTER })
                            content.addView(emptyCard, spacedParams())
                        } else {
                            for (index in 0 until jobs.length()) {
                                addJobCard(content, jobs.getJSONObject(index), deliveryPeople)
                            }
                        }
                        val refreshBtn = primaryButton("Atualizar Lista")
                        setupIPhonePressEffect(refreshBtn) { loadJobs(status, content) }
                        content.addView(refreshBtn, spacedParams())

                        fadeInSlide(content)
                    }
                }
                .onFailure { error ->
                    runOnUiThread {
                        if (error.message?.contains("401") == true) {
                            logout("Sua sessão expirou. Entre novamente.")
                        } else {
                            content.removeAllViews()
                            content.addView(body(friendlyError(error)).apply { setTextColor(Color.rgb(185, 28, 28)) })
                            val retryBtn = primaryButton("Tentar novamente")
                            setupIPhonePressEffect(retryBtn) { loadJobs(status, content) }
                            content.addView(retryBtn, spacedParams())
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
        val status = job.optString("delivery_status")

        val card = verticalLayout(16).apply {
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadius = 24f
                setStroke(2, Color.rgb(226, 232, 240))
            }
            elevation = 3f
            layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 0, 0, 14) }
        }

        val cardHeader = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        cardHeader.addView(title("Pedido #$rawOrder", 17f), LinearLayout.LayoutParams(0, -2, 1f))

        val (badgeBg, badgeText, statusText) = when (status) {
            "delivered" -> Triple(Color.rgb(220, 252, 231), Color.rgb(22, 101, 52), "Entregue")
            "in_route" -> Triple(Color.rgb(219, 234, 254), Color.rgb(29, 78, 216), "Em rota")
            "cancelled" -> Triple(Color.rgb(254, 226, 226), Color.rgb(185, 28, 28), "Cancelada")
            else -> Triple(Color.rgb(254, 243, 199), Color.rgb(180, 83, 9), "Aguardando")
        }
        val statusPill = TextView(this).apply {
            text = statusText
            textSize = 12f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(badgeText)
            setPadding(18, 8, 18, 8)
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(badgeBg)
                cornerRadius = 16f
            }
        }
        cardHeader.addView(statusPill)
        card.addView(cardHeader)

        card.addView(View(this).apply {
            setBackgroundColor(Color.rgb(241, 245, 249))
            layoutParams = LinearLayout.LayoutParams(-1, 2).apply { setMargins(0, 10, 0, 10) }
        })

        val buyerName = job.optString("buyer_name", "Cliente")
        val address = job.optString("delivery_address_text", "Endereço não informado")
        card.addView(TextView(this).apply {
            text = "👤 $buyerName"
            textSize = 15f
            setTextColor(Color.rgb(15, 23, 42))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        card.addView(TextView(this).apply {
            text = "📍 $address"
            textSize = 14f
            setTextColor(Color.rgb(71, 85, 105))
        }, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 4, 0, 0) })

        val bottomInfo = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 10, 0, 0) }
        }
        bottomInfo.addView(TextView(this).apply {
            text = "🛵 ${assigneeName.ifBlank { "A definir pela loja" }}"
            textSize = 13f
            setTextColor(Color.rgb(100, 116, 139))
        }, LinearLayout.LayoutParams(0, -2, 1f))

        bottomInfo.addView(TextView(this).apply {
            text = formatCents(job.optLong("delivery_amount"))
            textSize = 16f
            setTextColor(Color.rgb(20, 83, 45))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        card.addView(bottomInfo)

        if (assigneeId == "store:unassigned" && deliveryPeople.length() > 0 && status !in listOf("delivered", "cancelled")) {
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
            val assignBtn = primaryButton("Definir quem entregou")
            setupIPhonePressEffect(assignBtn) {
                if (selector.selectedItemPosition <= 0) {
                    assignmentFeedback.text = "Selecione quem fará a entrega."
                    return@setupIPhonePressEffect
                }
                val selected = people[selector.selectedItemPosition - 1]
                assignBtn.isEnabled = false
                assignmentFeedback.text = "Salvando responsável..."
                thread {
                    runCatching {
                        apiRequest(
                            "/delivery/app/jobs/$jobId/assign",
                            "POST",
                            JSONObject().put("delivery_person_id", selected.getString("id")),
                            bearer = sessionToken
                        )
                    }.onSuccess { runOnUiThread { showMainScreen() } }
                        .onFailure { error ->
                            runOnUiThread {
                                assignBtn.isEnabled = true
                                assignmentFeedback.text = friendlyError(error)
                            }
                        }
                }
            }
            card.addView(assignBtn, spacedParams())
        }

        val actionBtn = primaryButton(if (status == "delivered") "Ver detalhes / Comprovante" else "Abrir entrega").apply {
            isEnabled = token.isNotBlank() && assigneeId != "store:unassigned"
        }
        setupIPhonePressEffect(actionBtn) {
            openOperation(token)
        }
        card.addView(actionBtn, spacedParams())

        parent.addView(card)
    }

    private fun setupIPhonePressEffect(view: View, onClick: () -> Unit) {
        view.isClickable = true
        view.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    v.animate().scaleX(0.96f).scaleY(0.96f).setDuration(110).start()
                }
                MotionEvent.ACTION_UP -> {
                    v.animate().scaleX(1.0f).scaleY(1.0f).setDuration(130).start()
                    onClick()
                }
                MotionEvent.ACTION_CANCEL -> {
                    v.animate().scaleX(1.0f).scaleY(1.0f).setDuration(130).start()
                }
            }
            true
        }
    }

    private fun fadeInSlide(view: View) {
        view.alpha = 0f
        view.translationY = 28f
        view.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(240)
            .setInterpolator(DecelerateInterpolator())
            .start()
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
            web != null -> showMainScreen()
            currentTab == "jobs" -> {
                currentTab = "dashboard"
                showMainScreen()
            }
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

        @JavascriptInterface
        fun closeDelivery() {
            runOnUiThread {
                val completedWebView = operationWebView ?: return@runOnUiThread
                stopLocationTracking()
                pendingTrackingJobId = ""
                currentTab = "dashboard"
                currentJobStatus = "open"
                currentPeriod = "today"
                customDate = ""
                operationWebView = null
                completedWebView.stopLoading()
                completedWebView.removeJavascriptInterface("MdvDelivery")
                showMainScreen()
                completedWebView.destroy()
            }
        }

        @JavascriptInterface
        fun openExternalUrl(rawUrl: String) { openTrustedExternalUrl(rawUrl) }
    }

    private fun openTrustedExternalUrl(rawUrl: String) {
        val uri = runCatching { Uri.parse(rawUrl.trim()) }.getOrNull() ?: return
        val host = uri.host.orEmpty().lowercase()
        val isGoogleMaps = host == "google.com" || host.endsWith(".google.com") || host == "maps.app.goo.gl"
        val isWhatsApp = host == "wa.me" || host == "api.whatsapp.com" || host.endsWith(".whatsapp.com")
        if (uri.scheme != "https" || (!isGoogleMaps && !isWhatsApp)) return
        runOnUiThread { runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) } }
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
