package br.com.mercadodovale.adminestoque.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.media.AudioAttributes
import android.os.Build
import androidx.core.app.NotificationCompat
import br.com.mercadodovale.adminestoque.MainActivity
import br.com.mercadodovale.adminestoque.data.SalesCache
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class SalesMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        PushRegistration.refresh(applicationContext)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        val messageType = data["type"].orEmpty()
        if (messageType != "sale" && messageType != "operational_alert" && message.notification == null) return

        val channel = data["channel"].orEmpty()
        val isOperationalAlert = messageType == "operational_alert" || data["operational_alert"] == "true"
        val saleId = if (isOperationalAlert) data["alert_id"].orEmpty() else data["sale_id"].orEmpty()
        val title = data["notification_title"] ?: message.notification?.title ?: "Nova venda"
        val body = data["notification_body"]
            ?: message.notification?.body
            ?: "Toque para conferir os detalhes."
        if (!isOperationalAlert) {
            SalesCache.markPending(applicationContext, channel, saleId)
            sendBroadcast(
                Intent(SalesNotificationContract.ACTION_SALE_RECEIVED)
                    .setPackage(packageName)
                    .putExtra(SalesNotificationContract.EXTRA_SALES_CHANNEL, channel)
                    .putExtra(SalesNotificationContract.EXTRA_SALE_ID, saleId),
            )
        }
        if (!SalesNotificationFreshness.shouldAlert(
                occurredAt = data["occurred_at"],
                sentTimeMs = message.sentTime,
            )
        ) {
            return
        }

        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    SalesNotificationContract.CHANNEL_ID,
                    "Vendas",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Avisos automáticos de novas vendas"
                    enableVibration(true)
                    setSound(
                        null,
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .build(),
                    )
                },
            )
        }

        val openSaleIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            if (!isOperationalAlert) {
                putExtra(SalesNotificationContract.EXTRA_OPEN_SALE, true)
                putExtra(SalesNotificationContract.EXTRA_SALES_CHANNEL, channel)
                putExtra(SalesNotificationContract.EXTRA_SALE_ID, saleId)
            }
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            "$channel:$saleId".hashCode(),
            openSaleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, SalesNotificationContract.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setSilent(true)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        manager.notify("$channel:$saleId".hashCode(), notification)
        SalesSoundSettings.play(applicationContext)
    }
}
