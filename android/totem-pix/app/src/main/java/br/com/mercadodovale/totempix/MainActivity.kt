package br.com.mercadodovale.totempix

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.PowerManager
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var wakeLock: PowerManager.WakeLock? = null
    private var displayAwakeEnabled = true
    private val locationPermissionRequest = 87

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

        requestWifiPermissionIfNeeded()

        webView.loadUrl("https://www.mercadodovale.com.br/display")
    }

    override fun onResume() {
        super.onResume()
        if (displayAwakeEnabled) {
            setDisplayAwake(true)
        } else {
            allowDisplayToSleep(false)
        }
        window.decorView.systemUiVisibility = window.decorView.systemUiVisibility
    }

    override fun onDestroy() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
        super.onDestroy()
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

    private fun requestWifiPermissionIfNeeded() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.M) return
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) return
        requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), locationPermissionRequest)
    }

    private fun openExternalUrl(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            webView.loadUrl(url)
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
    }
}
