package br.com.mercadodovale.adminestoque.data

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class VpsApiClient(private val accessToken: String) {
    fun get(path: String): Result<String> = request(path, "GET")

    private fun request(path: String, method: String, payload: JSONObject? = null): Result<String> = runCatching {
        require(path.startsWith('/')) { "A rota deve iniciar com /" }
        val connection = (URL("${ApiConfig.baseUrl}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method; setRequestProperty("Accept", "application/json")
            if (accessToken.isNotBlank()) setRequestProperty("Authorization", "Bearer $accessToken")
            connectTimeout = 15_000; readTimeout = 20_000
            if (payload != null) { doOutput = true; setRequestProperty("Content-Type", "application/json"); outputStream.use { it.write(payload.toString().toByteArray()) } }
        }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (connection.responseCode !in 200..299) throw IllegalStateException(JSONObject(body).optString("error", "Erro HTTP ${connection.responseCode}"))
        body
    }

    companion object {
        fun login(identifier: String, password: String): Result<String> {
            if (identifier.isBlank() || password.isBlank()) return Result.failure(IllegalArgumentException("Informe usuário e senha."))
            return VpsApiClient("").request("/auth/login", "POST", JSONObject().put("email", identifier).put("cpf_cnpj", identifier).put("password", password)).map {
                JSONObject(it).getString("token")
            }
        }
    }
}
