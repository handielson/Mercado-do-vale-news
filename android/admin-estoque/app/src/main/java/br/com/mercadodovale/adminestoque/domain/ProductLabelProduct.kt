package br.com.mercadodovale.adminestoque.domain

import br.com.mercadodovale.adminestoque.data.ApiConfig
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.roundToLong

data class ProductLabelProduct(
    val id: String,
    val name: String,
    val sku: String,
    val ean: String,
    val priceCents: Long,
    val stockQuantity: Int,
    val imageUrl: String?,
    val slug: String,
) {
    val formattedPrice: String
        get() = NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(priceCents / 100.0)

    val publicUrl: String
        get() = "https://www.mercadodovale.com.br/produto/${slug.ifBlank { id }}"

    fun toStateJson(): String = JSONObject()
        .put("id", id)
        .put("name", name)
        .put("sku", sku)
        .put("ean", ean)
        .put("priceCents", priceCents)
        .put("stockQuantity", stockQuantity)
        .put("imageUrl", imageUrl)
        .put("slug", slug)
        .toString()

    companion object {
        fun fromStateJson(value: String): ProductLabelProduct? = runCatching {
            val json = JSONObject(value)
            ProductLabelProduct(
                id = json.optString("id"),
                name = json.optString("name", "Produto sem nome"),
                sku = json.optString("sku"),
                ean = json.optString("ean"),
                priceCents = json.optLong("priceCents"),
                stockQuantity = json.optInt("stockQuantity"),
                imageUrl = json.optString("imageUrl").takeIf { it.isNotBlank() && it != "null" },
                slug = json.optString("slug"),
            )
        }.getOrNull()

        fun parseList(body: String): List<ProductLabelProduct> {
            val array = JSONArray(body)
            return buildList(array.length()) {
                for (index in 0 until array.length()) add(fromJson(array.getJSONObject(index)))
            }
        }

        private fun fromJson(json: JSONObject): ProductLabelProduct {
            val images = json.optJSONArray("images")
            val rawImage = images?.optString(0)?.takeIf { it.isNotBlank() && it != "null" }
            return ProductLabelProduct(
                id = json.optString("id"),
                name = json.optString("name", "Produto sem nome"),
                sku = json.optString("sku"),
                ean = json.optString("ean"),
                priceCents = parseCents(json.opt("price_retail")),
                stockQuantity = json.optDouble("stock_quantity", 0.0).roundToLong().toInt(),
                imageUrl = rawImage?.let(::absoluteImageUrl),
                slug = json.optString("slug"),
            )
        }

        private fun parseCents(value: Any?): Long = when (value) {
            is Number -> value.toDouble().roundToLong()
            is String -> value.replace(',', '.').toDoubleOrNull()?.roundToLong() ?: 0L
            else -> 0L
        }

        private fun absoluteImageUrl(value: String): String = when {
            value.startsWith("https://") || value.startsWith("http://") -> value
            value.startsWith("/") -> "${ApiConfig.baseUrl}$value"
            else -> "${ApiConfig.baseUrl}/$value"
        }
    }
}

data class LabelSize(
    val widthMm: Int,
    val heightMm: Int,
    val fontName: Float,
    val fontPrice: Float,
    val barcodeFont: Float,
    val paddingMm: Float,
) {
    override fun toString(): String = "$widthMm × $heightMm mm"

    companion object {
        val desktopDefaults = listOf(
            LabelSize(40, 30, 7f, 26f, 8f, 1f),
            LabelSize(50, 30, 8f, 28f, 9f, 1f),
            LabelSize(30, 40, 7f, 24f, 7f, 0.8f),
            LabelSize(40, 25, 7f, 24f, 7f, 0.8f),
            LabelSize(30, 20, 6f, 20f, 6f, 0.5f),
        )

        val default: LabelSize
            get() = desktopDefaults.first { it.widthMm == 30 && it.heightMm == 20 }
    }
}
