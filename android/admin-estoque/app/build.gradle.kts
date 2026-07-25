plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val vpsBaseUrl = providers.gradleProperty("VPS_BASE_URL")
    .orElse("https://api.xiaomipetrolina.com.br")
    .get()

android {
    namespace = "br.com.mercadodovale.adminestoque"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.mercadodovale.adminestoque"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "VPS_BASE_URL", "\"${vpsBaseUrl.trimEnd('/')}\"")
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
