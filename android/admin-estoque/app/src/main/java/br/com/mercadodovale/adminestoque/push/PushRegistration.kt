package br.com.mercadodovale.adminestoque.push

import android.content.Context
import android.os.Build
import br.com.mercadodovale.adminestoque.BuildConfig
import br.com.mercadodovale.adminestoque.data.VpsApiClient
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject

object PushRegistration {
    fun refresh(context: Context, onComplete: (Result<Unit>) -> Unit = {}) {
        val appContext = context.applicationContext
        val accessToken = appContext
            .getSharedPreferences(
                SalesNotificationContract.SESSION_PREFERENCES,
                Context.MODE_PRIVATE,
            )
            .getString(SalesNotificationContract.SESSION_TOKEN_KEY, null)
            .orEmpty()
        if (accessToken.isBlank()) {
            onComplete(Result.success(Unit))
            return
        }

        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { firebaseToken ->
                Thread {
                    val result = VpsApiClient(accessToken).post(
                        "/admin/mobile-push/devices",
                        JSONObject()
                            .put("token", firebaseToken)
                            .put("platform", "android")
                            .put("app_version", BuildConfig.VERSION_NAME)
                            .put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}".trim()),
                    ).map { Unit }
                    onComplete(result)
                }.start()
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun unregister(context: Context, accessToken: String) {
        if (accessToken.isBlank()) return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { firebaseToken ->
            Thread {
                VpsApiClient(accessToken).delete(
                    "/admin/mobile-push/devices",
                    JSONObject().put("token", firebaseToken),
                )
            }.start()
        }
    }
}
