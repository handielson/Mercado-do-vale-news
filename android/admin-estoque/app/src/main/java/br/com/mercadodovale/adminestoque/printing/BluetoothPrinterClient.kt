package br.com.mercadodovale.adminestoque.printing

import android.graphics.Bitmap

enum class PrinterConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    PRINTING,
    ERROR,
}

enum class PrinterProfile(
    val preferenceValue: String,
    val displayName: String,
    val shortName: String,
) {
    MARKLIFE_P50("marklife_p50", "Marklife P50 / P50S", "Marklife P50"),
    GENERIC_ESC_POS("generic_esc_pos", "Genérica Bluetooth (ESC/POS)", "impressora genérica");

    override fun toString(): String = displayName

    companion object {
        fun fromPreference(value: String?): PrinterProfile =
            entries.firstOrNull { it.preferenceValue == value } ?: MARKLIFE_P50
    }
}

fun interface PrinterStateListener {
    fun onPrinterState(state: PrinterConnectionState, message: String)
}

interface BluetoothPrinterClient {
    val state: PrinterConnectionState
    val isReady: Boolean

    fun connect()

    fun print(
        bitmap: Bitmap,
        copies: Int,
        completion: (Result<Unit>) -> Unit,
    )

    fun close()
}
