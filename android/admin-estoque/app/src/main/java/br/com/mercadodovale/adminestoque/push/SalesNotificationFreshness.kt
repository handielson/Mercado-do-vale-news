package br.com.mercadodovale.adminestoque.push

import java.time.Instant

object SalesNotificationFreshness {
    private const val MAX_AGE_MS = 30 * 60 * 1000L
    private const val MAX_FUTURE_SKEW_MS = 5 * 60 * 1000L

    fun shouldAlert(
        occurredAt: String?,
        sentTimeMs: Long,
        nowMs: Long = System.currentTimeMillis(),
    ): Boolean {
        val occurredAtMs = occurredAt
            ?.takeIf(String::isNotBlank)
            ?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
        val timestamps = listOfNotNull(
            occurredAtMs,
            sentTimeMs.takeIf { it > 0L },
        )
        if (timestamps.isEmpty()) return true
        return timestamps.all { timestamp ->
            val ageMs = nowMs - timestamp
            ageMs in -MAX_FUTURE_SKEW_MS..MAX_AGE_MS
        }
    }
}
