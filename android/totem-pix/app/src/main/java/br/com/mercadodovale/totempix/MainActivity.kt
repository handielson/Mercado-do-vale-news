package br.com.mercadodovale.totempix

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.PowerManager
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var wakeLock: PowerManager.WakeLock? = null
    private val locationPermissionRequest = 87

    @SuppressLint("SetJavaScriptEnabled", "WakelockTimeout")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                or WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        )
        acquireWakeLock()
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )

        webView = WebView(this)
        webView.webViewClient = WebViewClient()
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
        acquireWakeLock()
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

    private fun requestWifiPermissionIfNeeded() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.M) return
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) return
        requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), locationPermissionRequest)
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
    }
}
