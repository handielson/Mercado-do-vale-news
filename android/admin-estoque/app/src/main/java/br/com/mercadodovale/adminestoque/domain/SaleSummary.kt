package br.com.mercadodovale.adminestoque.domain

import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

enum class SalesChannel(
    val apiKey: String,
    val label: String,
    val subtitle: String,
) {
    ONLINE("online", "Online", "Pedidos pagos pelo site"),
    PDV("pdv", "PDV", "Vendas realizadas no caixa"),
    SHOPEE("shopee", "Shopee", "Pedidos recebidos na Shopee"),
    TIKTOK("tiktok", "TikTok", "Pedidos do TikTok Shop");

    companion object {
        fun fromApiKey(value: String?): SalesChannel? =
            entries.firstOrNull { it.apiKey.equals(value, ignoreCase = true) }
    }
}

data class SaleItem(
    val name: String,
    val sku: String,
    val variation: String,
    val quantity: Int,
    val unitPriceCents: Long,
    val totalCents: Long,
    val imageUrl: String,
)

data class SaleSummary(
    val channel: SalesChannel,
    val externalId: String,
    val status: String,
    val customerName: String,
    val totalCents: Long,
    val currency: String,
    val occurredAt: String,
    val items: List<SaleItem>,
    val payment: String,
    val customerPhone: String,
    val customerEmail: String,
    val deliveryType: String,
    val shippingAddress: String,
    val trackingNumber: String,
    val notes: String,
) {
    val formattedTotal: String
        get() = runCatching {
            NumberFormat.getCurrencyInstance(Locale("pt", "BR")).apply {
                currency = Currency.getInstance(this@SaleSummary.currency.ifBlank { "BRL" })
            }.format(totalCents / 100.0)
        }.getOrElse { "R$ %.2f".format(Locale("pt", "BR"), totalCents / 100.0) }

    val shortId: String
        get() = externalId.take(12).uppercase()

    companion object {
        fun parseList(body: String): List<SaleSummary> {
            val root = JSONObject(body)
            val sales = root.optJSONArray("sales") ?: JSONArray()
            return buildList {
                for (index in 0 until sales.length()) {
                    sales.optJSONObject(index)?.let { add(fromJson(it)) }
                }
            }
        }

        fun parseSingle(body: String): SaleSummary {
            val root = JSONObject(body)
            return fromJson(root.getJSONObject("sale"))
        }

        private fun fromJson(json: JSONObject): SaleSummary {
            val channel = SalesChannel.fromApiKey(json.optString("channel"))
                ?: error("Canal de venda desconhecido.")
            val details = json.optJSONObject("details") ?: JSONObject()
            val rawItems = details.optJSONArray("items") ?: JSONArray()
            val items = buildList {
                for (index in 0 until rawItems.length()) {
                    val item = rawItems.optJSONObject(index) ?: continue
                    add(
                        SaleItem(
                            name = item.optString("name", "Item"),
                            sku = item.optString("sku"),
                            variation = item.optString("variation"),
                            quantity = item.optInt("quantity", 1).coerceAtLeast(1),
                            unitPriceCents = item.optLong("unit_price_cents"),
                            totalCents = item.optLong("total_cents"),
                            imageUrl = item.optString("image_url"),
                        ),
                    )
                }
            }
            return SaleSummary(
                channel = channel,
                externalId = json.getString("external_id"),
                status = json.optString("status", "confirmada"),
                customerName = json.optString("customer_name", "Cliente"),
                totalCents = json.optLong("total_cents"),
                currency = json.optString("currency", "BRL"),
                occurredAt = json.optString("occurred_at"),
                items = items,
                payment = details.optString("payment", "Não informado"),
                customerPhone = details.optString("customer_phone"),
                customerEmail = details.optString("customer_email"),
                deliveryType = details.optString("delivery_type"),
                shippingAddress = stringifyAddress(details.opt("shipping_address")),
                trackingNumber = details.optString("tracking_number"),
                notes = details.optString("notes"),
            )
        }

        private fun stringifyAddress(value: Any?): String = when (value) {
            null, JSONObject.NULL -> ""
            is JSONObject -> listOf(
                value.optString("full_address"),
                listOf(
                    value.optString("name"),
                    value.optString("phone"),
                ).filter(String::isNotBlank).joinToString(" • "),
                listOf(
                    value.optString("street"),
                    value.optString("district"),
                    value.optString("city"),
                    value.optString("state"),
                    value.optString("zipcode"),
                ).filter(String::isNotBlank).joinToString(", "),
            ).filter(String::isNotBlank).joinToString("\n")
            else -> value.toString()
        }
    }
}
