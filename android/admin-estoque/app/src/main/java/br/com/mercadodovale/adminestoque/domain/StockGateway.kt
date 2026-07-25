package br.com.mercadodovale.adminestoque.domain

interface StockGateway {
    suspend fun findProduct(query: String): ProductLookup
    suspend fun productDistribution(productId: String): List<StockBalance>
    suspend fun transfer(command: StockTransferCommand): StockTransferResult
}

data class ProductLookup(val id: String, val name: String, val sku: String?, val ean: String?)
data class StockBalance(val deposit: String, val location: String, val quantity: Double)
data class StockTransferCommand(val productId: String, val sourceLocationId: String, val targetLocationId: String, val quantity: Double)
data class StockTransferResult(val movementId: String)
