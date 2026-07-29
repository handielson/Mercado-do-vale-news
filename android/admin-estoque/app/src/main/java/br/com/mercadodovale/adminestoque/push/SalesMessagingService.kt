package br.com.mercadodovale.adminestoque.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import br.com.mercadodovale.adminestoque.MainActivity
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
        if (data["type"] != "sale" && message.notification == null) return

        val channel = data["channel"].orEmpty()
        val saleId = data["sale_id"].orEmpty()
        val title = message.notification?.title ?: "Nova venda"
        val body = message.notification?.body ?: "Toque para conferir os detalhes."

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
                },
            )
        }

        val openSaleIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(SalesNotificationContract.EXTRA_OPEN_SALE, true)
            putExtra(SalesNotificationContract.EXTRA_SALES_CHANNEL, channel)
            putExtra(SalesNotificationContract.EXTRA_SALE_ID, saleId)
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
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        manager.notify("$channel:$saleId".hashCode(), notification)
    }
}
