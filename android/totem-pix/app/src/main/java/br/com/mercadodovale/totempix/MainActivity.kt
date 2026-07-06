package br.com.mercadodovale.totempix

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationManager
import android.app.admin.DevicePolicyManager
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.media.RingtoneManager
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import java.lang.ref.WeakReference

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var wakeLock: PowerManager.WakeLock? = null
    private var displayAwakeEnabled = true
    private val locationPermissionRequest = 87
    private val ringtonePickerRequest = 88
    private val notificationPermissionRequest = 89
    private val paymentTonePreferences = "mdv_totem_payment_tone"
    private val paymentToneUriKey = "payment_tone_uri"
    private val playStorePackage = "com.android.vending"
    private val appPackageName = "br.com.mercadodovale.totempix"
    private val displayHomeUrl = "https://www.mercadodovale.com.br/display"

    @SuppressLint("SetJavaScriptEnabled", "WakelockTimeout")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setDisplayAwake(true)
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )

        webView = WebView(this)
        webView.webViewClient = TotemWebViewClient()
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.addJavascriptInterface(TotemBridge(), "MdvTotem")
        setContentView(webView)
        activeInstance = WeakReference(this)

        requestWifiPermissionIfNeeded()
        requestNotificationPermissionIfNeeded()

        webView.loadUrl(displayHomeUrl)
        if (intent?.action == TotemPixMonitorService.ACTION_SHOW_PAYMENT_SCREEN) {
            showPaymentScreenNow()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent?.action == TotemPixMonitorService.ACTION_SHOW_PAYMENT_SCREEN) {
            showPaymentScreenNow()
        }
    }

    override fun onResume() {
        super.onResume()
        activeInstance = WeakReference(this)
        if (displayAwakeEnabled) {
            setDisplayAwake(true)
        } else {
            allowDisplayToSleep(false)
        }
        window.decorView.systemUiVisibility = window.decorView.systemUiVisibility
    }

    override fun onDestroy() {
        if (activeInstance?.get() === this) {
            activeInstance = null
        }
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
        super.onDestroy()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != ringtonePickerRequest || resultCode != RESULT_OK) return
        val uri = data?.getParcelableExtra<Uri>(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
        getSharedPreferences(paymentTonePreferences, Context.MODE_PRIVATE)
            .edit()
            .putString(paymentToneUriKey, uri?.toString() ?: "")
            .apply()
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MercadoDoValeTotemPix:Display")
        wakeLock?.setReferenceCounted(false)
        wakeLock?.acquire()
    }

    private fun releaseWakeLock() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    @SuppressLint("WakelockTimeout")
    private fun setDisplayAwake(awake: Boolean) {
        displayAwakeEnabled = awake
        if (awake) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            }
            window.addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    or WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            )
            window.attributes = window.attributes.apply {
                screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
            }
            acquireWakeLock()
        } else {
            allowDisplayToSleep(false)
        }
    }

    private fun allowDisplayToSleep(lockNow: Boolean) {
        displayAwakeEnabled = false
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(false)
            setTurnScreenOn(false)
        }
        window.clearFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                or WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        )
        window.attributes = window.attributes.apply {
            screenBrightness = 0.01f
        }
        acquireWakeLock()
        if (lockNow) {
            lockScreenIfAllowed()
        }
    }

    private fun devicePolicyManager(): DevicePolicyManager {
        return getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    }

    private fun adminComponent(): ComponentName {
        return ComponentName(this, TotemDeviceAdminReceiver::class.java)
    }

    private fun isScreenLockPermissionActive(): Boolean {
        return try {
            devicePolicyManager().isAdminActive(adminComponent())
        } catch (_: Exception) {
            false
        }
    }

    private fun requestScreenLockPermission() {
        if (isScreenLockPermissionActive()) return
        try {
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent())
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "Permite ao Totem Pix apagar a tela automaticamente quando a loja estiver fechada."
                )
            }
            startActivity(intent)
        } catch (_: Exception) {
            // If the system settings screen cannot be opened, the app still lets Android sleep normally.
        }
    }

    private fun lockScreenIfAllowed() {
        try {
            if (isScreenLockPermissionActive()) {
                devicePolicyManager().lockNow()
            }
        } catch (_: Exception) {
            // Falling back to the system screen timeout is acceptable.
        }
    }

    private fun playPaymentSuccessTone(toneName: String, volumePercent: Int) {
        try {
            val selectedToneUri = getSelectedPaymentToneUri()
            if (selectedToneUri != null) {
                playSelectedPaymentTone(selectedToneUri, volumePercent)
                return
            }

            val tone = when (toneName.lowercase()) {
                "cash" -> ToneGenerator.TONE_PROP_ACK
                "bell" -> ToneGenerator.TONE_PROP_BEEP2
                else -> ToneGenerator.TONE_PROP_BEEP
            }
            val safeVolume = volumePercent.coerceIn(0, 100)
            val generator = ToneGenerator(AudioManager.STREAM_MUSIC, safeVolume)
            generator.startTone(tone, 450)
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    generator.release()
                } catch (_: Exception) {
                }
            }, 700)
        } catch (_: Exception) {
            // Sound feedback is optional.
        }
    }

    private fun getSelectedPaymentToneUri(): Uri? {
        return try {
            val value = getSharedPreferences(paymentTonePreferences, Context.MODE_PRIVATE)
                .getString(paymentToneUriKey, "")
                ?.trim()
            if (value.isNullOrEmpty()) null else Uri.parse(value)
        } catch (_: Exception) {
            null
        }
    }

    private fun playSelectedPaymentTone(uri: Uri, volumePercent: Int) {
        try {
            val safeVolume = volumePercent.coerceIn(0, 100) / 100f
            val player = MediaPlayer().apply {
                setDataSource(this@MainActivity, uri)
                setAudioStreamType(AudioManager.STREAM_MUSIC)
                setVolume(safeVolume, safeVolume)
                setOnCompletionListener { mediaPlayer ->
                    try {
                        mediaPlayer.release()
                    } catch (_: Exception) {
                    }
                }
                setOnErrorListener { mediaPlayer, _, _ ->
                    try {
                        mediaPlayer.release()
                    } catch (_: Exception) {
                    }
                    true
                }
                prepare()
                start()
            }
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    if (player.isPlaying) player.stop()
                    player.release()
                } catch (_: Exception) {
                }
            }, 5000)
        } catch (_: Exception) {
            val fallback = RingtoneManager.getRingtone(this, uri)
            fallback?.play()
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    fallback?.stop()
                } catch (_: Exception) {
                }
            }, 5000)
        }
    }

    private fun chooseSystemPaymentTone() {
        try {
            val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
                putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_NOTIFICATION)
                putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Escolha o toque de pagamento aprovado")
                putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
                putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, getSelectedPaymentToneUri())
            }
            startActivityForResult(intent, ringtonePickerRequest)
        } catch (_: Exception) {
            try {
                startActivity(Intent(android.provider.Settings.ACTION_SOUND_SETTINGS))
            } catch (_: Exception) {
            }
        }
    }

    private fun clearSystemPaymentTone() {
        getSharedPreferences(paymentTonePreferences, Context.MODE_PRIVATE)
            .edit()
            .remove(paymentToneUriKey)
            .apply()
    }

    private fun requestWifiPermissionIfNeeded() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.M) return
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) return
        requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), locationPermissionRequest)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU) return
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), notificationPermissionRequest)
    }

    private fun areNotificationsEnabled(): Boolean {
        return try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.areNotificationsEnabled()
        } catch (_: Exception) {
            true
        }
    }

    private fun openNotificationPermissionSettings() {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), notificationPermissionRequest)
                return
            }

            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            }
            startActivity(intent)
        } catch (_: Exception) {
            openAppPermissionSettings()
        }
    }

    private fun isIgnoringBatteryOptimizations(): Boolean {
        return try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            powerManager.isIgnoringBatteryOptimizations(packageName)
        } catch (_: Exception) {
            false
        }
    }

    private fun requestBatteryOptimizationPermission() {
        try {
            if (isIgnoringBatteryOptimizations()) return
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        } catch (_: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            } catch (_: Exception) {
                openAppPermissionSettings()
            }
        }
    }

    private fun openAppPermissionSettings() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        } catch (_: Exception) {
        }
    }

    private fun openExternalUrl(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            webView.loadUrl(url)
        }
    }

    private fun openAppUpdate() {
        try {
            val marketIntent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$appPackageName")).apply {
                setPackage(playStorePackage)
            }
            startActivity(marketIntent)
            return
        } catch (_: Exception) {
        }

        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$appPackageName")))
        } catch (_: Exception) {
            webView.loadUrl("https://www.mercadodovale.com.br/totem-pix/atualizar")
        }
    }

    private fun returnToAppHome() {
        setDisplayAwake(true)

        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        } catch (_: Exception) {
        }

        try {
            webView.loadUrl(displayHomeUrl)
        } catch (_: Exception) {
        }
    }

    private fun showPaymentScreenNow() {
        setDisplayAwake(true)
        try {
            if (!webView.url.orEmpty().startsWith(displayHomeUrl)) {
                webView.loadUrl(displayHomeUrl)
            } else {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('mdv:force-display-refresh'))", null)
            }
        } catch (_: Exception) {
            try {
                webView.loadUrl(displayHomeUrl)
            } catch (_: Exception) {
            }
        }
    }

    private fun registerDisplayToken(token: String) {
        val safeToken = token.trim()
        getSharedPreferences(TotemPixMonitorService.PREFERENCES_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(TotemPixMonitorService.DISPLAY_TOKEN_KEY, safeToken)
            .apply()

        if (safeToken.isEmpty()) return

        try {
            val intent = Intent(this, TotemPixMonitorService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        } catch (_: Exception) {
            // Web polling still works when Android refuses to start the foreground service.
        }
    }

    inner class TotemWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val url = request?.url?.toString() ?: return false
            if (url.startsWith("market://") || url.contains("play.google.com/")) {
                openExternalUrl(url)
                return true
            }
            return false
        }
    }

    inner class TotemBridge {
        @JavascriptInterface
        fun getAppVersionName(): String {
            return try {
                packageManager.getPackageInfo(packageName, 0).versionName ?: ""
            } catch (_: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun getAppVersionCode(): Int {
            return try {
                val info = packageManager.getPackageInfo(packageName, 0)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    info.longVersionCode.toInt()
                } else {
                    @Suppress("DEPRECATION")
                    info.versionCode
                }
            } catch (_: Exception) {
                0
            }
        }

        @JavascriptInterface
        fun getWifiSsid(): String {
            return try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M &&
                    checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                ) {
                    runOnUiThread { requestWifiPermissionIfNeeded() }
                    return ""
                }

                val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                val rawSsid = wifiManager.connectionInfo?.ssid ?: ""
                rawSsid.trim().removeSurrounding("\"")
            } catch (_: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun setDisplayAwake(awake: Boolean) {
            runOnUiThread { this@MainActivity.setDisplayAwake(awake) }
        }

        @JavascriptInterface
        fun registerDisplayToken(token: String) {
            runOnUiThread { this@MainActivity.registerDisplayToken(token) }
        }

        @JavascriptInterface
        fun showPaymentScreenNow() {
            runOnUiThread { this@MainActivity.showPaymentScreenNow() }
        }

        @JavascriptInterface
        fun requestScreenSleep() {
            runOnUiThread { allowDisplayToSleep(true) }
        }

        @JavascriptInterface
        fun requestScreenLockPermission() {
            runOnUiThread { this@MainActivity.requestScreenLockPermission() }
        }

        @JavascriptInterface
        fun isScreenLockPermissionActive(): Boolean {
            return this@MainActivity.isScreenLockPermissionActive()
        }

        @JavascriptInterface
        fun areNotificationsEnabled(): Boolean {
            return this@MainActivity.areNotificationsEnabled()
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread { this@MainActivity.openNotificationPermissionSettings() }
        }

        @JavascriptInterface
        fun isIgnoringBatteryOptimizations(): Boolean {
            return this@MainActivity.isIgnoringBatteryOptimizations()
        }

        @JavascriptInterface
        fun requestBatteryOptimizationPermission() {
            runOnUiThread { this@MainActivity.requestBatteryOptimizationPermission() }
        }

        @JavascriptInterface
        fun openAppPermissionSettings() {
            runOnUiThread { this@MainActivity.openAppPermissionSettings() }
        }

        @JavascriptInterface
        fun playPaymentSuccessTone(tone: String, volume: Int) {
            runOnUiThread { this@MainActivity.playPaymentSuccessTone(tone, volume) }
        }

        @JavascriptInterface
        fun chooseSystemPaymentTone() {
            runOnUiThread { this@MainActivity.chooseSystemPaymentTone() }
        }

        @JavascriptInterface
        fun clearSystemPaymentTone() {
            runOnUiThread { this@MainActivity.clearSystemPaymentTone() }
        }

        @JavascriptInterface
        fun hasSystemPaymentTone(): Boolean {
            return this@MainActivity.getSelectedPaymentToneUri() != null
        }

        @JavascriptInterface
        fun openAppUpdate() {
            runOnUiThread { this@MainActivity.openAppUpdate() }
        }

        @JavascriptInterface
        fun returnToAppHome() {
            runOnUiThread { this@MainActivity.returnToAppHome() }
        }
    }

    companion object {
        @Volatile private var activeInstance: WeakReference<MainActivity>? = null

        fun requestShowPaymentScreenFromMonitor(): Boolean {
            val activity = activeInstance?.get() ?: return false
            if (!activity::webView.isInitialized) return false
            activity.runOnUiThread { activity.showPaymentScreenNow() }
            return true
        }
    }
}
