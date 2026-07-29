package br.com.mercadodovale.adminestoque.push

object SalesNotificationContract {
    const val CHANNEL_ID = "sales_controlled_sound_v2"
    const val EXTRA_OPEN_SALE = "open_sale"
    const val EXTRA_SALES_CHANNEL = "sales_channel"
    const val EXTRA_SALE_ID = "sale_id"
    const val ACTION_SALE_RECEIVED = "br.com.mercadodovale.adminestoque.SALE_RECEIVED"
    const val SESSION_PREFERENCES = "mdv_admin_session"
    const val SESSION_TOKEN_KEY = "access_token"
}
