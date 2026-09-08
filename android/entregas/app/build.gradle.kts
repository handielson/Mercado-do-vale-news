plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val vpsBaseUrl = providers.gradleProperty("VPS_BASE_URL")
    .orElse("https://api.xiaomipetrolina.com.br")
    .get()
val webBaseUrl = providers.gradleProperty("WEB_BASE_URL")
    .orElse("https://www.mercadodovale.com.br")
    .get()

android {
    namespace = "br.com.mercadodovale.entregas"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.mercadodovale.entregas"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.0.1"
        buildConfigField("String", "VPS_BASE_URL", "\"${vpsBaseUrl.trimEnd('/')}\"")
        buildConfigField("String", "WEB_BASE_URL", "\"${webBaseUrl.trimEnd('/')}\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
}
