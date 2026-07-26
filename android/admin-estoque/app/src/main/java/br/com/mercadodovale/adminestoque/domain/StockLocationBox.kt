package br.com.mercadodovale.adminestoque.domain

import br.com.mercadodovale.adminestoque.data.ApiConfig
import org.json.JSONArray
import org.json.JSONObject

data class StockLocationBox(
    val id: String,
    val depositId: String,
    val name: String,
    val code: String,
    val description: String?,
) {
    val displayName: String
        get() {
            val cleanName = name.trim().ifBlank { "Caixa" }
            val cleanCode = code.trim()
            return if (
                cleanCode.matches(Regex("\\d+")) &&
                !cleanName.endsWith(cleanCode, ignoreCase = true)
            ) "$cleanName $cleanCode" else cleanName
        }

    companion object {
        fun parseList(body: String): List<StockLocationBox> {
            val array = JSONArray(body)
            return buildList(array.length()) {
                for (index in 0 until array.length()) {
                    val json = array.getJSONObject(index)
                    add(
                        StockLocationBox(
                            id = json.optString("id"),
                            depositId = json.optString("deposit_id"),
                            name = json.optString("name", "Caixa"),
                            code = json.optString("code"),
                            description = json.optString("description")
                                .takeIf { it.isNotBlank() && it != "null" },
                        ),
                    )
                }
            }
        }

        fun idFromQr(value: String): String? {
            val clean = value.trim()
            val prefix = "mdv://stock-location/"
            return clean.takeIf { it.startsWith(prefix, ignoreCase = true) }
                ?.substring(prefix.length)
                ?.substringBefore('?')
                ?.trim()
                ?.takeIf { it.isNotBlank() }
        }
    }
}

data class StockLocationContent(
    val productId: String,
    val productName: String,
    val sku: String,
    val imageUrl: String?,
    val quantity: Int,
    val reservedQuantity: Int,
    val available: Int,
    val depositId: String,
    val locationId: String,
    val locationName: String,
) {
    fun toStateJson(): String = JSONObject()
        .put("product_id", productId)
        .put("product_name", productName)
        .put("sku", sku)
        .put("product_image", imageUrl)
        .put("quantity", quantity)
        .put("reserved_quantity", reservedQuantity)
        .put("available", available)
        .put("deposit_id", depositId)
        .put("location_id", locationId)
        .put("location_name", locationName)
        .toString()

    companion object {
        fun parseList(body: String): List<StockLocationContent> {
            val array = JSONArray(body)
            return buildList(array.length()) {
                for (index in 0 until array.length()) {
                    add(fromJson(array.getJSONObject(index)))
                }
            }
        }

        fun fromStateJson(value: String): StockLocationContent? =
            runCatching { fromJson(JSONObject(value)) }.getOrNull()

        private fun fromJson(json: JSONObject): StockLocationContent {
            val rawImage = json.optString("product_image")
                .takeIf { it.isNotBlank() && it != "null" }
            val quantity = json.optDouble("quantity", 0.0).toInt()
            val reserved = json.optDouble("reserved_quantity", 0.0).toInt()
            return StockLocationContent(
                productId = json.optString("product_id"),
                productName = json.optString("product_name", "Produto sem nome"),
                sku = json.optString("sku"),
                imageUrl = rawImage?.let(::absoluteImageUrl),
                quantity = quantity,
                reservedQuantity = reserved,
                available = json.optDouble("available", (quantity - reserved).toDouble()).toInt(),
                depositId = json.optString("deposit_id"),
                locationId = json.optString("location_id"),
                locationName = json.optString("location_name", "Caixa"),
            )
        }

        fun parseDistribution(
            body: String,
            product: ProductLabelProduct,
        ): List<StockLocationContent> {
            val array = JSONArray(body)
            return buildList(array.length()) {
                for (index in 0 until array.length()) {
                    val json = array.getJSONObject(index)
                    val quantity = json.optDouble("quantity", 0.0).toInt()
                    val reserved = json.optDouble("reserved_quantity", 0.0).toInt()
                    val location = json.optJSONObject("location")
                    add(
                        StockLocationContent(
                            productId = product.id,
                            productName = product.name,
                            sku = product.sku,
                            imageUrl = product.imageUrl,
                            quantity = quantity,
                            reservedQuantity = reserved,
                            available = quantity - reserved,
                            depositId = json.optString("deposit_id"),
                            locationId = json.optString("location_id"),
                            locationName = location?.optString("name", "Caixa") ?: "Caixa",
                        ),
                    )
                }
            }.filter { it.available > 0 && it.locationId.isNotBlank() }
        }

        private fun absoluteImageUrl(value: String): String = when {
            value.startsWith("https://") || value.startsWith("http://") -> value
            value.startsWith("/") -> "${ApiConfig.baseUrl}$value"
            else -> "${ApiConfig.baseUrl}/$value"
        }
    }
}

data class StockTransferLine(
    val item: StockLocationContent,
    val quantity: Int,
) {
    companion object {
        fun toStateJson(lines: List<StockTransferLine>): String =
            JSONArray().apply {
                lines.forEach { line ->
                    put(
                        JSONObject()
                            .put("item", JSONObject(line.item.toStateJson()))
                            .put("quantity", line.quantity),
                    )
                }
            }.toString()

        fun fromStateJson(value: String): List<StockTransferLine> = runCatching {
            val array = JSONArray(value)
            buildList {
                for (index in 0 until array.length()) {
                    val json = array.getJSONObject(index)
                    val item = StockLocationContent.fromStateJson(
                        json.getJSONObject("item").toString(),
                    ) ?: continue
                    add(StockTransferLine(item, json.optInt("quantity", 1).coerceAtLeast(1)))
                }
            }
        }.getOrDefault(emptyList())
    }
}
