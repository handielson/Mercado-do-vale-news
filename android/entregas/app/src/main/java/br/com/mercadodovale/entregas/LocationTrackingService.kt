package br.com.mercadodovale.entregas

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.IBinder
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors

class LocationTrackingService : Service() {
    private val client by lazy { LocationServices.getFusedLocationProviderClient(this) }
    private val executor = Executors.newSingleThreadExecutor()
    private var jobId = ""
    private var lastUploadAt = 0L

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            val now = System.currentTimeMillis()
            if (now - lastUploadAt < 8_000) return
            lastUploadAt = now
            executor.execute { upload(location.latitude, location.longitude, location.accuracy.toDouble()) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Rastreamento da entrega", NotificationManager.IMPORTANCE_LOW))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopTracking()
            return START_NOT_STICKY
        }
        jobId = intent?.getStringExtra(EXTRA_JOB_ID).orEmpty()
        if (jobId.isBlank()) { stopSelf(); return START_NOT_STICKY }
        getSharedPreferences("delivery_session", MODE_PRIVATE).edit().putString("tracking_job_id", jobId).apply()
        val openIntent = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("Entrega em andamento")
            .setContentText("Localizacao compartilhada com o cliente")
            .setOngoing(true).setContentIntent(openIntent).build()
        startForeground(NOTIFICATION_ID, notification)
        startLocationUpdates()
        return START_REDELIVER_INTENT
    }

    private fun startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopTracking(); return
        }
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000)
            .setMinUpdateIntervalMillis(5_000).setMinUpdateDistanceMeters(10f).build()
        client.removeLocationUpdates(callback)
        client.requestLocationUpdates(request, callback, mainLooper)
    }

    private fun upload(latitude: Double, longitude: Double, accuracy: Double) {
        val token = getSharedPreferences("delivery_session", MODE_PRIVATE).getString("access_token", "").orEmpty()
        if (token.isBlank() || jobId.isBlank()) return
        val connection = URL("${BuildConfig.VPS_BASE_URL}/delivery/app/jobs/$jobId/location").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 12_000
            connection.readTimeout = 12_000
            connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            val body = JSONObject().put("latitude", latitude).put("longitude", longitude).put("accuracy", accuracy)
            connection.outputStream.use { it.write(body.toString().toByteArray(StandardCharsets.UTF_8)) }
            if (connection.responseCode == 401 || connection.responseCode == 403 || connection.responseCode == 409) stopTracking()
        } catch (_: Exception) {
            // A proxima leitura tenta novamente; nenhuma coordenada e registrada em log.
        } finally { connection.disconnect() }
    }

    private fun stopTracking() {
        client.removeLocationUpdates(callback)
        getSharedPreferences("delivery_session", MODE_PRIVATE).edit().remove("tracking_job_id").apply()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() { client.removeLocationUpdates(callback); executor.shutdownNow(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP = "br.com.mercadodovale.entregas.STOP_TRACKING"
        const val EXTRA_JOB_ID = "job_id"
        private const val CHANNEL_ID = "delivery_tracking"
        private const val NOTIFICATION_ID = 8102
    }
}
