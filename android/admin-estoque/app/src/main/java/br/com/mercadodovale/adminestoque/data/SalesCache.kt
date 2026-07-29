package br.com.mercadodovale.adminestoque.data

import android.content.Context
import br.com.mercadodovale.adminestoque.domain.SaleSummary
import br.com.mercadodovale.adminestoque.domain.SalesChannel
import org.json.JSONArray
import org.json.JSONObject

object SalesCache {
    private const val PREFERENCES = "mdv_sales_cache"
    private const val MAX_SALES_PER_CHANNEL = 100

    fun isInitialized(context: Context, channel: SalesChannel): Boolean =
        preferences(context).contains(salesKey(channel))

    fun load(context: Context, channel: SalesChannel): List<SaleSummary> = synchronized(this) {
        val body = preferences(context).getString(salesKey(channel), null) ?: return emptyList()
        runCatching { SaleSummary.parseList(body) }.getOrElse { emptyList() }
    }

    fun replace(context: Context, channel: SalesChannel, responseBody: String): List<SaleSummary> =
        synchronized(this) {
            val source = JSONObject(responseBody).optJSONArray("sales") ?: JSONArray()
            val stored = JSONObject().put("sales", copyLimited(source))
            preferences(context).edit().putString(salesKey(channel), stored.toString()).commit()
            SaleSummary.parseList(stored.toString())
        }

    fun upsertSingle(
        context: Context,
        channel: SalesChannel,
        responseBody: String,
    ): List<SaleSummary> = synchronized(this) {
        val incoming = JSONObject(responseBody).getJSONObject("sale")
        val incomingId = incoming.optString("external_id")
        require(incomingId.isNotBlank()) { "Venda sem identificador." }

        val cached = preferences(context).getString(salesKey(channel), null)
            ?.let { JSONObject(it).optJSONArray("sales") }
            ?: JSONArray()
        val merged = JSONArray().put(incoming)
        for (index in 0 until cached.length()) {
            if (merged.length() >= MAX_SALES_PER_CHANNEL) break
            val sale = cached.optJSONObject(index) ?: continue
            if (sale.optString("external_id") != incomingId) merged.put(sale)
        }
        val stored = JSONObject().put("sales", merged)
        preferences(context).edit().putString(salesKey(channel), stored.toString()).commit()
        SaleSummary.parseList(stored.toString())
    }

    fun markPending(context: Context, channelKey: String, saleId: String) = synchronized(this) {
        val channel = SalesChannel.fromApiKey(channelKey) ?: return
        if (saleId.isBlank()) return
        val ids = pendingIdsLocked(context, channel).toMutableSet()
        ids.add(saleId)
        savePendingLocked(context, channel, ids)
    }

    fun pendingIds(context: Context, channel: SalesChannel): List<String> = synchronized(this) {
        pendingIdsLocked(context, channel)
    }

    fun resolvePending(context: Context, channel: SalesChannel, saleId: String) = synchronized(this) {
        val ids = pendingIdsLocked(context, channel).toMutableSet()
        if (ids.remove(saleId)) savePendingLocked(context, channel, ids)
    }

    fun clearAll(context: Context) {
        preferences(context).edit().clear().apply()
    }

    private fun copyLimited(source: JSONArray): JSONArray {
        val result = JSONArray()
        for (index in 0 until minOf(source.length(), MAX_SALES_PER_CHANNEL)) {
            source.optJSONObject(index)?.let(result::put)
        }
        return result
    }

    private fun pendingIdsLocked(context: Context, channel: SalesChannel): List<String> {
        val raw = preferences(context).getString(pendingKey(channel), null) ?: return emptyList()
        val array = runCatching { JSONArray(raw) }.getOrElse { JSONArray() }
        return buildList {
            for (index in 0 until array.length()) {
                array.optString(index).takeIf(String::isNotBlank)?.let(::add)
            }
        }
    }

    private fun savePendingLocked(
        context: Context,
        channel: SalesChannel,
        ids: Collection<String>,
    ) {
        preferences(context).edit()
            .putString(pendingKey(channel), JSONArray(ids).toString())
            .commit()
    }

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    private fun salesKey(channel: SalesChannel) = "sales_${channel.apiKey}"
    private fun pendingKey(channel: SalesChannel) = "pending_${channel.apiKey}"
}
