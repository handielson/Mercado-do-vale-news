package br.com.mercadodovale.adminestoque.data

import br.com.mercadodovale.adminestoque.BuildConfig

object ApiConfig {
    val baseUrl: String = BuildConfig.VPS_BASE_URL.trimEnd('/')
}
