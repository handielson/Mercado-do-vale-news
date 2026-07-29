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

enum class SaleStatusGroup(val label: String) {
    ALL("Todas"),
    NEW("Novas"),
    TO_SHIP("A enviar"),
    SHIPPED("Enviadas"),
    COMPLETED("Concluídas"),
    CANCELLED("Canceladas"),
    RETURNS("Devoluções e reembolsos"),
    OTHER("Outras");

    fun accepts(sale: SaleSummary): Boolean = this == ALL || sale.statusGroup == this

    companion object {
        fun fromRaw(value: String): SaleStatusGroup = when (normalizeStatus(value)) {
            "NEW", "CREATED", "PENDING", "UNPAID", "AWAITING_PAYMENT", "PENDING_PAYMENT" -> NEW
            "PAID", "CONFIRMED", "READY_TO_SHIP", "AWAITING_SHIPMENT", "TO_SHIP",
            "PROCESSING", "PACKING", "PICKUP_PENDING" -> TO_SHIP
            "PROCESSED", "SHIPPED", "IN_TRANSIT", "PICKED_UP", "TO_CONFIRM_RECEIVE" -> SHIPPED
            "DELIVERED", "COMPLETED", "COMPLETE", "SUCCESS", "FINISHED" -> COMPLETED
            "CANCELLED", "CANCELED", "IN_CANCEL", "VOIDED" -> CANCELLED
            "REFUND", "REFUNDED", "PARTIAL_REFUND", "RETURN", "RETURNED", "IN_RETURN" -> RETURNS
            else -> OTHER
        }

        fun localized(value: String): String {
            val normalized = normalizeStatus(value)
            return mapOf(
                "NEW" to "Nova venda",
                "CREATED" to "Criada",
                "PENDING" to "Pendente",
                "UNPAID" to "Aguardando pagamento",
                "AWAITING_PAYMENT" to "Aguardando pagamento",
                "PENDING_PAYMENT" to "Pagamento pendente",
                "PAID" to "Paga",
                "CONFIRMED" to "Confirmada",
                "READY_TO_SHIP" to "Pronta para envio",
                "AWAITING_SHIPMENT" to "Aguardando envio",
                "TO_SHIP" to "A enviar",
                "PROCESSING" to "Em preparação",
                "PACKING" to "Em separação",
                "PICKUP_PENDING" to "Aguardando coleta",
                "PROCESSED" to "Envio preparado",
                "SHIPPED" to "Enviada",
                "IN_TRANSIT" to "Em trânsito",
                "PICKED_UP" to "Coletada",
                "TO_CONFIRM_RECEIVE" to "Aguardando confirmação de recebimento",
                "DELIVERED" to "Entregue",
                "COMPLETED" to "Concluída",
                "COMPLETE" to "Concluída",
                "SUCCESS" to "Concluída",
                "FINISHED" to "Finalizada",
                "CANCELLED" to "Cancelada",
                "CANCELED" to "Cancelada",
                "IN_CANCEL" to "Cancelamento em andamento",
                "VOIDED" to "Cancelada",
                "REFUND" to "Em reembolso",
                "REFUNDED" to "Reembolsada",
                "PARTIAL_REFUND" to "Reembolso parcial",
                "RETURN" to "Em devolução",
                "RETURNED" to "Devolvida",
                "IN_RETURN" to "Devolução em andamento",
                "FAILED" to "Falhou",
            )[normalized] ?: value
                .replace('_', ' ')
                .lowercase(Locale("pt", "BR"))
                .replaceFirstChar { it.titlecase(Locale("pt", "BR")) }
        }

        private fun normalizeStatus(value: String): String =
            value.trim().uppercase(Locale.ROOT).replace('-', '_').replace(' ', '_')
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

data class SalePaymentDetail(
    val label: String,
    val amountCents: Long,
    val totalWithFeeCents: Long,
    val installments: Int,
    val installmentCents: Long,
    val feePercentage: Double,
    val feeAmountCents: Long,
    val operatorFeePercentage: Double,
    val operatorFeeAmountCents: Long,
    val receivedCents: Long,
    val changeCents: Long,
    val dueDate: String,
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
    val paymentDetails: List<SalePaymentDetail>,
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

    val statusGroup: SaleStatusGroup
        get() = SaleStatusGroup.fromRaw(status)

    val localizedStatus: String
        get() = SaleStatusGroup.localized(status)

    val localizedDeliveryType: String
        get() = when (deliveryType.trim().lowercase(Locale.ROOT).replace('-', '_')) {
            "delivery", "shipping", "shipment" -> "Entrega"
            "pickup", "store_pickup", "retirada" -> "Retirada na loja"
            "motoboy", "local_delivery" -> "Entrega local"
            "" -> ""
            else -> deliveryType
                .replace('_', ' ')
                .lowercase(Locale("pt", "BR"))
                .replaceFirstChar { it.titlecase(Locale("pt", "BR")) }
        }

    val formattedPayment: String
        get() = if (paymentDetails.isEmpty()) {
            payment
        } else {
            paymentDetails.joinToString("\n\n") { detail ->
                buildString {
                    append(detail.label)
                    if (detail.installments > 1) {
                        append(" em ").append(detail.installments).append("x de ")
                            .append(formatCents(detail.installmentCents))
                    }
                    append("\nValor: ").append(formatCents(detail.amountCents))
                    if (detail.feeAmountCents > 0 || detail.feePercentage > 0) {
                        append("\nAcréscimo: ").append(formatCents(detail.feeAmountCents))
                        if (detail.feePercentage > 0) append(" (").append(formatPercent(detail.feePercentage)).append(")")
                    }
                    if (detail.totalWithFeeCents != detail.amountCents) {
                        append("\nTotal cobrado: ").append(formatCents(detail.totalWithFeeCents))
                    }
                    if (detail.operatorFeeAmountCents > 0 || detail.operatorFeePercentage > 0) {
                        append("\nTaxa da operadora: ").append(formatCents(detail.operatorFeeAmountCents))
                        if (detail.operatorFeePercentage > 0) {
                            append(" (").append(formatPercent(detail.operatorFeePercentage)).append(")")
                        }
                    }
                    if (detail.receivedCents > 0) append("\nRecebido: ").append(formatCents(detail.receivedCents))
                    if (detail.changeCents > 0) append("\nTroco: ").append(formatCents(detail.changeCents))
                    if (detail.dueDate.isNotBlank()) append("\nVencimento: ").append(detail.dueDate)
                }
            }
        }

    private fun formatCents(value: Long): String =
        NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(value / 100.0)

    private fun formatPercent(value: Double): String =
        String.format(Locale("pt", "BR"), "%.2f%%", value)

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
            val rawPayments = details.optJSONArray("payment_details") ?: JSONArray()
            val paymentDetails = buildList {
                for (index in 0 until rawPayments.length()) {
                    val item = rawPayments.optJSONObject(index) ?: continue
                    add(
                        SalePaymentDetail(
                            label = item.optString("label", "Pagamento"),
                            amountCents = item.optLong("amount_cents"),
                            totalWithFeeCents = item.optLong("total_with_fee_cents"),
                            installments = item.optInt("installments", 1).coerceAtLeast(1),
                            installmentCents = item.optLong("installment_cents"),
                            feePercentage = item.optDouble("fee_percentage"),
                            feeAmountCents = item.optLong("fee_amount_cents"),
                            operatorFeePercentage = item.optDouble("operator_fee_percentage"),
                            operatorFeeAmountCents = item.optLong("operator_fee_amount_cents"),
                            receivedCents = item.optLong("received_cents"),
                            changeCents = item.optLong("change_cents"),
                            dueDate = item.optString("due_date"),
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
                paymentDetails = paymentDetails,
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
