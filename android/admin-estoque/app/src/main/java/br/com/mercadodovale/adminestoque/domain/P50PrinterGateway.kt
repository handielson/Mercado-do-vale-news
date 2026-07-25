package br.com.mercadodovale.adminestoque.domain

/**
 * Boundary for the Marklife P50 proprietary Bluetooth protocol.
 * No generic ESC/POS bytes are emitted here: a physical-printer spike must validate the protocol first.
 */
interface P50PrinterGateway {
    suspend fun pairedDevices(): List<PrinterDevice>
    suspend fun print(job: LabelPrintJob): PrintResult
}

data class PrinterDevice(val id: String, val name: String)
data class LabelPrintJob(val templateId: String, val widthMm: Int, val heightMm: Int, val copies: Int, val productId: String)
sealed interface PrintResult {
    data object Completed : PrintResult
    data class Rejected(val reason: String) : PrintResult
}
