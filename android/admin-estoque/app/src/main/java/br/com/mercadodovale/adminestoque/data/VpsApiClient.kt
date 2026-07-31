package br.com.mercadodovale.adminestoque.data

import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class VpsApiClient(private val accessToken: String) {
    class HttpException(val statusCode: Int, message: String) : IllegalStateException(message)

    fun get(path: String): Result<String> = request(path, "GET")
    fun post(path: String, payload: JSONObject): Result<String> = request(path, "POST", payload)
    fun delete(path: String, payload: JSONObject): Result<String> = request(path, "DELETE", payload)
    fun uploadFile(
        path: String,
        fieldName: String,
        file: File,
        fileName: String = file.name,
        contentType: String = "image/jpeg",
    ): Result<String> = runCatching {
        require(path.startsWith('/')) { "A rota deve iniciar com /" }
        require(file.isFile && file.length() > 0) { "A foto do termo está vazia." }
        val boundary = "----MDVAndroid${UUID.randomUUID()}"
        val safeFileName = fileName.replace(Regex("[\"\\r\\n]"), "_")
        val prefix = (
            "--$boundary\r\n" +
                "Content-Disposition: form-data; name=\"$fieldName\"; filename=\"$safeFileName\"\r\n" +
                "Content-Type: $contentType\r\n\r\n"
            ).toByteArray()
        val suffix = "\r\n--$boundary--\r\n".toByteArray()
        val totalLength = prefix.size.toLong() + file.length() + suffix.size
        val connection = (URL("${ApiConfig.baseUrl}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Accept", "application/json")
            setRequestProperty("X-MDV-Client", "android")
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            if (accessToken.isNotBlank()) setRequestProperty("Authorization", "Bearer $accessToken")
            connectTimeout = 20_000
            readTimeout = 90_000
            doOutput = true
            setFixedLengthStreamingMode(totalLength)
        }
        connection.outputStream.use { output ->
            output.write(prefix)
            file.inputStream().use { input -> input.copyTo(output) }
            output.write(suffix)
        }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (connection.responseCode !in 200..299) {
            throw HttpException(
                connection.responseCode,
                runCatching { JSONObject(body).optString("error") }.getOrNull()
                    ?.takeIf(String::isNotBlank)
                    ?: "Erro HTTP ${connection.responseCode}",
            )
        }
        body
    }

    private fun request(path: String, method: String, payload: JSONObject? = null): Result<String> = runCatching {
        require(path.startsWith('/')) { "A rota deve iniciar com /" }
        val connection = (URL("${ApiConfig.baseUrl}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method; setRequestProperty("Accept", "application/json")
            setRequestProperty("X-MDV-Client", "android")
            if (accessToken.isNotBlank()) setRequestProperty("Authorization", "Bearer $accessToken")
            connectTimeout = 15_000; readTimeout = 20_000
            if (payload != null) { doOutput = true; setRequestProperty("Content-Type", "application/json"); outputStream.use { it.write(payload.toString().toByteArray()) } }
        }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (connection.responseCode !in 200..299) {
            throw HttpException(
                connection.responseCode,
                JSONObject(body).optString("error", "Erro HTTP ${connection.responseCode}"),
            )
        }
        body
    }

    companion object {
        fun isUnauthorized(error: Throwable): Boolean =
            error is HttpException && error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED

        fun login(identifier: String, password: String): Result<String> {
            if (identifier.isBlank() || password.isBlank()) return Result.failure(IllegalArgumentException("Informe usuário e senha."))
            return VpsApiClient("").request("/auth/login", "POST", JSONObject().put("email", identifier).put("cpf_cnpj", identifier).put("password", password)).map {
                val response = JSONObject(it)
                val customerType = response.optJSONObject("customer")?.optString("customer_type").orEmpty()
                if (!customerType.equals("ADMIN", ignoreCase = true)) {
                    throw IllegalAccessException("Acesso restrito a contas administrativas.")
                }
                response.getString("token")
            }
        }
    }
}
