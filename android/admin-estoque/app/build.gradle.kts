plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
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
        versionCode = 41
        versionName = "0.8.0"
        buildConfigField("String", "VPS_BASE_URL", "\"${vpsBaseUrl.trimEnd('/')}\"")
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.9.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    implementation("com.google.zxing:core:3.5.3")
}
