package br.com.mercadodovale.totempix

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.nio.charset.StandardCharsets
import org.json.JSONObject

class TotemPixMonitorService : Service() {
    private var worker: Thread? = null
    @Volatile private var running = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var lastActivePixSignature: String? = null
    private var lastActivePixNotificationSignature: String? = null
    private var lastWakeAttemptAt = 0L
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        startWorker()
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        worker?.interrupt()
        worker = null
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startWorker() {
        if (worker?.isAlive == true) return
        running = true
        worker = Thread {
            while (running) {
                try {
                    pollDisplayState()
                    Thread.sleep(POLL_INTERVAL_MS)
                } catch (_: InterruptedException) {
                    running = false
                } catch (_: Exception) {
                    try {
                        Thread.sleep(POLL_INTERVAL_MS)
                    } catch (_: InterruptedException) {
                        running = false
                    }
                }
            }
        }.apply {
            name = "TotemPixMonitor"
            isDaemon = true
            start()
        }
    }

    private fun pollDisplayState() {
        val token = readDisplayToken()
        if (token.isBlank()) return
        val encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8.name())
        val connection = URL("$DISPLAY_STATE_URL?token=$encodedToken").openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode !in 200..299) return
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val signature = activePixSignature(body)
            if (signature == null) {
                lastActivePixSignature = null
                lastActivePixNotificationSignature = null
                lastWakeAttemptAt = 0L
                cancelActivePixNotification()
                return
            }
            if (!shouldWakeForActivePix(signature)) return
            showPaymentScreen(signature)
        } finally {
            connection.disconnect()
        }
    }

    private fun activePixSignature(body: String): String? {
        return try {
            val activePix = JSONObject(body).optJSONObject("active_pix") ?: return null
            val status = activePix.optString("status", "").trim()
            if (status != "pending") return null
            val id = firstNonBlank(
                activePix.optString("id", ""),
                activePix.optString("mercado_pago_payment_id", ""),
                activePix.optString("external_reference", ""),
                activePix.optString("updated_at", ""),
            )
            "$status:$id"
        } catch (_: Exception) {
            if (!body.contains("\"active_pix\"") || body.contains("\"active_pix\":null")) return null
            if (!body.contains("\"status\":\"pending\"")) return null
            body.hashCode().toString()
        }
    }

    private fun firstNonBlank(vararg values: String): String {
        return values.firstOrNull { it.trim().isNotEmpty() }?.trim() ?: "active"
    }

    private fun shouldWakeForActivePix(signature: String): Boolean {
        val now = System.currentTimeMillis()
        if (signature != lastActivePixSignature) {
            lastActivePixSignature = signature
            lastWakeAttemptAt = now
            return true
        }
        if (now - lastWakeAttemptAt >= WAKE_REPEAT_INTERVAL_MS) {
            lastWakeAttemptAt = now
            return true
        }
        return false
    }

    private fun showPaymentScreen(signature: String) {
        acquireWakeLock()
        val openedDirectly = MainActivity.requestShowPaymentScreenFromMonitor()
        if (openedDirectly) {
            cancelActivePixNotification()
        }
        bringTotemTaskToFront()
        openTotemPaymentActivity()
        mainHandler.postDelayed({
            val retriedDirectly = MainActivity.requestShowPaymentScreenFromMonitor()
            if (retriedDirectly) {
                cancelActivePixNotification()
            } else {
                bringTotemTaskToFront()
                openTotemPaymentActivity()
                publishActivePixNotificationOnce(signature)
            }
        }, WAKE_RETRY_DELAY_MS)
    }

    private fun openTotemPaymentActivity() {
        try {
            startActivity(buildPaymentScreenIntent())
        } catch (_: Exception) {
            // Android can block background launches; the high-priority notification remains as fallback.
        }
    }

    private fun bringTotemTaskToFront() {
        try {
            val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val task = activityManager.appTasks.firstOrNull()
            task?.moveToFront()
        } catch (_: Exception) {
            // If the task cannot be moved, the explicit activity launch below is still attempted.
        }
    }

    private fun buildPaymentScreenIntent(): Intent {
        return Intent(this, MainActivity::class.java).apply {
            action = ACTION_SHOW_PAYMENT_SCREEN
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
        }
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "MercadoDoValeTotemPix:Monitor"
        ).apply {
            setReferenceCounted(false)
            acquire(30_000)
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    private fun buildNotification(): Notification {
        ensureNotificationChannel()
        val pendingIntent = buildPaymentScreenPendingIntent(0)
        return Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle("Totem Pix ativo")
            .setContentText("Monitorando Pix para acordar a tela quando houver cobranca.")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun publishActivePixNotificationOnce(signature: String) {
        if (signature == lastActivePixNotificationSignature) return
        try {
            ensureActivePixNotificationChannel()
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(ACTIVE_PIX_NOTIFICATION_ID, buildActivePixNotification())
            lastActivePixNotificationSignature = signature
        } catch (_: Exception) {
        }
    }

    private fun cancelActivePixNotification() {
        try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel(ACTIVE_PIX_NOTIFICATION_ID)
        } catch (_: Exception) {
        }
    }

    private fun buildActivePixNotification(): Notification {
        val builder = Notification.Builder(this, ACTIVE_PIX_NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle("Pix aguardando no Totem")
            .setContentText("Toque para abrir o QR Code no Totem Pix.")
            .setContentIntent(buildPaymentScreenPendingIntent(1))
            .setOngoing(false)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_STATUS)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setPriority(Notification.PRIORITY_HIGH)
        }
        return builder.build()
    }

    private fun buildPaymentScreenPendingIntent(requestCode: Int): PendingIntent {
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getActivity(this, requestCode, buildPaymentScreenIntent(), pendingIntentFlags)
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Monitor do Totem Pix",
                NotificationManager.IMPORTANCE_LOW
            )
        )
    }

    private fun ensureActivePixNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(ACTIVE_PIX_NOTIFICATION_CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                ACTIVE_PIX_NOTIFICATION_CHANNEL_ID,
                "Pix ativo no Totem",
                NotificationManager.IMPORTANCE_HIGH
            )
        )
    }

    private fun readDisplayToken(): String {
        return getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            .getString(DISPLAY_TOKEN_KEY, "")
            ?.trim()
            ?: ""
    }

    companion object {
        const val ACTION_SHOW_PAYMENT_SCREEN = "br.com.mercadodovale.totempix.SHOW_PAYMENT_SCREEN"
        const val PREFERENCES_NAME = "mdv_totem_pix_monitor"
        const val DISPLAY_TOKEN_KEY = "display_token"
        private const val DISPLAY_STATE_URL = "https://api.xiaomipetrolina.com.br/pdv/display-state"
        private const val NOTIFICATION_CHANNEL_ID = "totem_pix_monitor"
        private const val ACTIVE_PIX_NOTIFICATION_CHANNEL_ID = "totem_pix_active"
        private const val NOTIFICATION_ID = 20260705
        private const val ACTIVE_PIX_NOTIFICATION_ID = 20260706
        private const val POLL_INTERVAL_MS = 5000L
        private const val WAKE_REPEAT_INTERVAL_MS = 10_000L
        private const val WAKE_RETRY_DELAY_MS = 1500L
    }
}
