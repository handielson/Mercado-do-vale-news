package br.com.mercadodovale.adminestoque.domain

import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

data class MarketingCreativeCard(
    val name: String,
    val sku: String,
    val imageUrl: String,
    val priceCents: Double,
    val stock: Int,
    val whatsappMessage: String,
)

data class MarketingApproval(
    val id: String,
    val status: String,
    val title: String,
    val targetName: String,
    val executionMode: String,
    val proposedState: JSONObject?,
    val financialImpact: JSONObject?,
    val successCriteria: JSONObject?,
    val rollbackPlan: String,
    val lastError: String,
    val createdAt: String,
    val approvalExpiresAt: String,
) {
    val statusLabel: String
        get() = when (status) {
            "pending" -> "Aguardando aprovação"
            "approved" -> "Aprovada"
            "executing" -> "Executando"
            "succeeded" -> "Concluída"
            "failed" -> "Falhou"
            "rejected" -> "Rejeitada"
            "expired" -> "Expirada"
            "cancelled" -> "Cancelada"
            else -> status
        }

    fun financialSummary(): String {
        val impact = financialImpact ?: return "Impacto financeiro não informado"
        val currency = impact.optString("currency", "BRL")
        val immediate = impact.optDouble("immediateMaximum", Double.NaN)
        val ceiling = impact.optDouble("authorizedMonthlyCeiling", Double.NaN)
        val formatter = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))
        return buildList {
            if (!immediate.isNaN()) add("Impacto imediato máximo: ${formatter.format(immediate)}")
            if (!ceiling.isNaN()) add("Teto mensal autorizado: ${formatter.format(ceiling)}")
            if (isEmpty()) add("Moeda: $currency")
        }.joinToString("\n")
    }

    fun campaignSummary(): String {
        val campaigns = proposedState?.optJSONArray("campaigns") ?: return targetName
        return buildList {
            for (index in 0 until campaigns.length()) {
                val item = campaigns.optJSONObject(index) ?: continue
                val name = item.optString("name", item.optString("itemKey", "Campanha"))
                val amount = item.optDouble("periodLimit", Double.NaN)
                add(if (amount.isNaN()) name else "$name — ${NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(amount)}")
            }
        }.joinToString("\n").ifBlank { targetName }
    }

    fun creativeCards(): List<MarketingCreativeCard> {
        val campaigns = proposedState?.optJSONArray("campaigns") ?: return emptyList()
        return buildList {
            for (campaignIndex in 0 until campaigns.length()) {
                val cards = campaigns.optJSONObject(campaignIndex)?.optJSONArray("cards") ?: continue
                for (cardIndex in 0 until cards.length()) {
                    val card = cards.optJSONObject(cardIndex) ?: continue
                    val imageUrl = card.optString("imageUrl")
                    if (imageUrl.isBlank()) continue
                    add(
                        MarketingCreativeCard(
                            name = card.optString("name", "Produto"),
                            sku = card.optString("sku"),
                            imageUrl = imageUrl,
                            priceCents = card.optDouble("priceCents", 0.0),
                            stock = card.optInt("stock", 0),
                            whatsappMessage = card.optString("whatsappMessage"),
                        ),
                    )
                }
            }
        }
    }

    fun reviewText(): String = buildString {
        appendLine(statusLabel)
        appendLine()
        appendLine("Alvo:")
        appendLine(campaignSummary())
        appendLine()
        appendLine(financialSummary())
        appendLine()
        appendLine("Modo de execução: $executionMode")
        successCriteria?.optString("required")?.takeIf(String::isNotBlank)?.let {
            appendLine()
            appendLine("Critério de sucesso:")
            appendLine(it)
        }
        if (rollbackPlan.isNotBlank()) {
            appendLine()
            appendLine("Como desfazer:")
            appendLine(rollbackPlan)
        }
        if (lastError.isNotBlank()) {
            appendLine()
            appendLine("Erro registrado:")
            appendLine(lastError)
        }
    }.trim()

    companion object {
        fun parseList(body: String): List<MarketingApproval> {
            val items = JSONObject(body).optJSONArray("items") ?: return emptyList()
            return buildList {
                for (index in 0 until items.length()) {
                    val item = items.optJSONObject(index) ?: continue
                    add(
                        MarketingApproval(
                            id = item.optString("id"),
                            status = item.optString("status"),
                            title = item.optString("title", "Ação de marketing"),
                            targetName = item.optString("target_name"),
                            executionMode = item.optString("execution_mode"),
                            proposedState = item.optJSONObject("proposed_state"),
                            financialImpact = item.optJSONObject("financial_impact"),
                            successCriteria = item.optJSONObject("success_criteria"),
                            rollbackPlan = item.optString("rollback_plan"),
                            lastError = item.optString("last_error"),
                            createdAt = item.optString("created_at"),
                            approvalExpiresAt = item.optString("approval_expires_at"),
                        ),
                    )
                }
            }
        }
    }
}
