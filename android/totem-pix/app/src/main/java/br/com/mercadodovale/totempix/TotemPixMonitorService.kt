package br.com.mercadodovale.totempix

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.nio.charset.StandardCharsets

class TotemPixMonitorService : Service() {
    private var worker: Thread? = null
    @Volatile private var running = false
    private var wakeLock: PowerManager.WakeLock? = null

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
            if (hasVisibleActivePix(body)) {
                showPaymentScreen()
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun hasVisibleActivePix(body: String): Boolean {
        if (!body.contains("\"active_pix\"") || body.contains("\"active_pix\":null")) return false
        return body.contains("\"status\":\"pending\"") || body.contains("\"status\":\"approved\"")
    }

    private fun showPaymentScreen() {
        acquireWakeLock()
        val intent = Intent(this, MainActivity::class.java).apply {
            action = ACTION_SHOW_PAYMENT_SCREEN
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
        }
        try {
            startActivity(intent)
        } catch (_: Exception) {
            // The foreground notification still lets the operator reopen the totem if Android blocks background launch.
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
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val intent = Intent(this, MainActivity::class.java).apply {
            action = ACTION_SHOW_PAYMENT_SCREEN
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingIntentFlags)
        return Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle("Totem Pix ativo")
            .setContentText("Monitorando Pix para acordar a tela quando houver cobranca.")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
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
        private const val DISPLAY_STATE_URL = "https://www.mercadodovale.com.br/pdv/display-state"
        private const val NOTIFICATION_CHANNEL_ID = "totem_pix_monitor"
        private const val NOTIFICATION_ID = 20260705
        private const val POLL_INTERVAL_MS = 5000L
    }
}
