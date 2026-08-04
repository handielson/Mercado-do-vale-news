package br.com.mercadodovale.adminestoque.domain

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

data class ShopeeProductReview(
    val commentId: Long,
    val orderSn: String,
    val buyerName: String,
    val itemName: String,
    val modelName: String,
    val comment: String,
    val reply: String,
    val rating: Int,
    val createdAt: String,
) {
    val answered: Boolean get() = reply.isNotBlank()

    companion object {
        fun parseList(body: String): List<ShopeeProductReview> {
            val root = JSONObject(body)
            val rows = root.optJSONArray("reviews") ?: JSONArray()
            return buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    add(
                        ShopeeProductReview(
                            commentId = row.optLong("comment_id"),
                            orderSn = row.optString("order_sn"),
                            buyerName = row.optString("buyer_name", "Comprador Shopee"),
                            itemName = row.optString("item_name", "Produto"),
                            modelName = row.optString("model_name"),
                            comment = row.optString("comment"),
                            reply = row.optString("reply"),
                            rating = row.optInt("rating").coerceIn(0, 5),
                            createdAt = row.optString("created_at"),
                        ),
                    )
                }
            }
        }
    }
}

data class ShopeeConversation(
    val conversationId: String,
    val buyerId: String,
    val buyerName: String,
    val lastMessage: String,
    val unreadCount: Int,
    val updatedAt: String,
) {
    companion object {
        fun parseList(body: String): List<ShopeeConversation> {
            val root = JSONObject(body)
            val rows = root.optJSONArray("conversations") ?: JSONArray()
            return buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    add(
                        ShopeeConversation(
                            conversationId = row.optString("conversation_id"),
                            buyerId = row.optString("buyer_id"),
                            buyerName = row.optString("buyer_name", "Comprador Shopee"),
                            lastMessage = row.optString("last_message"),
                            unreadCount = row.optInt("unread_count").coerceAtLeast(0),
                            updatedAt = row.optString("updated_at"),
                        ),
                    )
                }
            }
        }
    }
}

data class ShopeeChatMessage(
    val messageId: String,
    val fromBuyer: Boolean,
    val text: String,
    val createdAt: String,
) {
    companion object {
        fun parseList(body: String): List<ShopeeChatMessage> {
            val root = JSONObject(body)
            val rows = root.optJSONArray("messages") ?: JSONArray()
            return buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    add(
                        ShopeeChatMessage(
                            messageId = row.optString("message_id"),
                            fromBuyer = row.optBoolean("from_buyer"),
                            text = row.optString("text", "Mensagem sem texto"),
                            createdAt = row.optString("created_at"),
                        ),
                    )
                }
            }.sortedBy { runCatching { Instant.parse(it.createdAt) }.getOrNull() }
        }
    }
}
