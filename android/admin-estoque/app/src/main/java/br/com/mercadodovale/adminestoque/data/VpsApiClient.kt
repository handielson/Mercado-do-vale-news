package br.com.mercadodovale.adminestoque.data

import java.net.HttpURLConnection
import java.net.URL

/** Minimal bearer-only transport. Sync keys and database credentials must never enter the APK. */
class VpsApiClient(private val accessToken: String) {
    fun open(path: String, method: String = "GET"): HttpURLConnection {
        require(path.startsWith('/')) { "A rota deve iniciar com /" }
        return (URL("${ApiConfig.baseUrl}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            connectTimeout = 15_000
            readTimeout = 20_000
        }
    }
}
