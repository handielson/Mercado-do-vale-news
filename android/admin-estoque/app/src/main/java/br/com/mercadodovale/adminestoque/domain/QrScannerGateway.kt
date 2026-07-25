package br.com.mercadodovale.adminestoque.domain

/** Implement with CameraX + ML Kit after permission and device validation. */
interface QrScannerGateway {
    suspend fun scan(): String
}
