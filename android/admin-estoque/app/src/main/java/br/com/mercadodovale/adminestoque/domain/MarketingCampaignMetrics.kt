package br.com.mercadodovale.adminestoque.domain

import org.json.JSONObject

data class MarketingMetricValues(
    val spend: Double,
    val impressions: Double,
    val reach: Double,
    val frequency: Double,
    val cpm: Double,
    val clicks: Double,
    val uniqueClicks: Double,
    val linkClicks: Double,
    val outboundClicks: Double,
    val ctr: Double,
    val cpc: Double,
    val costPerLinkClick: Double,
    val engagements: Double,
    val conversations: Double,
    val costPerConversation: Double,
    val purchases: Double,
    val costPerPurchase: Double,
    val purchaseValue: Double,
    val roas: Double,
    val videoPlays: Double,
    val thruPlays: Double,
) {
    operator fun get(key: String): Double = when (key) {
        "spend" -> spend
        "impressions" -> impressions
        "reach" -> reach
        "frequency" -> frequency
        "cpm" -> cpm
        "clicks" -> clicks
        "uniqueClicks" -> uniqueClicks
        "linkClicks" -> linkClicks
        "outboundClicks" -> outboundClicks
        "ctr" -> ctr
        "cpc" -> cpc
        "costPerLinkClick" -> costPerLinkClick
        "engagements" -> engagements
        "conversations" -> conversations
        "costPerConversation" -> costPerConversation
        "purchases" -> purchases
        "costPerPurchase" -> costPerPurchase
        "purchaseValue" -> purchaseValue
        "roas" -> roas
        "videoPlays" -> videoPlays
        "thruPlays" -> thruPlays
        else -> 0.0
    }

    companion object {
        fun parse(value: JSONObject?): MarketingMetricValues {
            val json = value ?: JSONObject()
            fun number(key: String) = json.optDouble(key, 0.0).takeIf(Double::isFinite) ?: 0.0
            return MarketingMetricValues(
                spend = number("spend"),
                impressions = number("impressions"),
                reach = number("reach"),
                frequency = number("frequency"),
                cpm = number("cpm"),
                clicks = number("clicks"),
                uniqueClicks = number("uniqueClicks"),
                linkClicks = number("linkClicks"),
                outboundClicks = number("outboundClicks"),
                ctr = number("ctr"),
                cpc = number("cpc"),
                costPerLinkClick = number("costPerLinkClick"),
                engagements = number("engagements"),
                conversations = number("conversations"),
                costPerConversation = number("costPerConversation"),
                purchases = number("purchases"),
                costPerPurchase = number("costPerPurchase"),
                purchaseValue = number("purchaseValue"),
                roas = number("roas"),
                videoPlays = number("videoPlays"),
                thruPlays = number("thruPlays"),
            )
        }
    }
}

data class MarketingCampaignInsight(
    val id: String,
    val name: String,
    val status: String,
    val metrics: MarketingMetricValues,
    val followers: MarketingFollowerTracking?,
)

data class MarketingFollowerTracking(
    val baselineFollowers: Double?,
    val currentFollowers: Double?,
    val gainedFollowers: Double?,
    val growthPercent: Double?,
    val explanation: String,
) {
    companion object {
        fun parse(value: JSONObject?): MarketingFollowerTracking? {
            val json = value ?: return null
            fun optionalNumber(key: String): Double? = if (!json.has(key) || json.isNull(key)) null
            else json.optDouble(key).takeIf(Double::isFinite)
            return MarketingFollowerTracking(
                baselineFollowers = optionalNumber("baselineFollowers"),
                currentFollowers = optionalNumber("currentFollowers"),
                gainedFollowers = optionalNumber("gainedFollowers"),
                growthPercent = optionalNumber("growthPercent"),
                explanation = json.optString("explanation"),
            )
        }
    }
}

data class MarketingCampaignReport(
    val currentSince: String,
    val currentUntil: String,
    val previousSince: String,
    val previousUntil: String,
    val attribution: String,
    val totals: MarketingMetricValues,
    val campaigns: List<MarketingCampaignInsight>,
    val previousByCampaign: Map<String, MarketingCampaignInsight>,
) {
    companion object {
        fun parse(body: String): MarketingCampaignReport {
            val root = JSONObject(body)
            val ranges = root.optJSONObject("ranges") ?: JSONObject()
            val current = root.optJSONObject("current") ?: JSONObject()
            val previous = root.optJSONObject("previous") ?: JSONObject()

            fun campaigns(source: JSONObject): List<MarketingCampaignInsight> {
                val items = source.optJSONArray("campaigns") ?: return emptyList()
                return buildList {
                    for (index in 0 until items.length()) {
                        val item = items.optJSONObject(index) ?: continue
                        val id = item.optString("campaignId")
                        if (id.isBlank()) continue
                        add(
                            MarketingCampaignInsight(
                                id = id,
                                name = item.optString("campaignName", id),
                                status = item.optString("status", "UNKNOWN"),
                                metrics = MarketingMetricValues.parse(item.optJSONObject("metrics")),
                                followers = MarketingFollowerTracking.parse(item.optJSONObject("followers")),
                            ),
                        )
                    }
                }
            }

            val previousCampaigns = campaigns(previous)
            return MarketingCampaignReport(
                currentSince = ranges.optJSONObject("current")?.optString("since").orEmpty(),
                currentUntil = ranges.optJSONObject("current")?.optString("until").orEmpty(),
                previousSince = ranges.optJSONObject("previous")?.optString("since").orEmpty(),
                previousUntil = ranges.optJSONObject("previous")?.optString("until").orEmpty(),
                attribution = root.optString("attribution"),
                totals = MarketingMetricValues.parse(current.optJSONObject("totals")),
                campaigns = campaigns(current),
                previousByCampaign = previousCampaigns.associateBy { it.id },
            )
        }
    }
}
