plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.example.yutest"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
        targetSdk = 35

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        compose = true
    }
}
dependencies {
    // 👇 基础框架依赖（子模块需要，用 api 传递）
    api(libs.androidx.core.ktx)
    api(libs.androidx.lifecycle.runtime.ktx)
    api(libs.androidx.activity.compose)
    api(platform(libs.androidx.compose.bom))
    api(libs.androidx.ui)
    api(libs.androidx.ui.graphics)
    api(libs.androidx.ui.tooling.preview)
    api(libs.androidx.material3)

    // 👇 旧版 Android 支持库（子模块需要，用 api 传递）
    api("androidx.appcompat:appcompat:1.2.0")
    api("androidx.legacy:legacy-support-v4:1.0.0")
    api("androidx.constraintlayout:constraintlayout:1.1.3")
    api("androidx.media:media:1.0.0")

    // 👇 第三方库（子模块需要，用 api 传递）
    api("org.greenrobot:eventbus:3.1.1")
    api("com.github.bumptech.glide:glide:4.11.0")
    api("com.squareup.wire:wire-runtime:1.6.1")
    api("com.squareup.okio:okio:2.8.0")
    api("com.google.code.gson:gson:2.8.5")

    // 👇 本地 AAR（子模块需要，用 api 传递）
    api(files("libs/export-sdk-0.0.457.aar"))

    // 👇 测试依赖（仅主模块用，用 implementation/testImplementation）
    testImplementation(kotlin("test"))
}