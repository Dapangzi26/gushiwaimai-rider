plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.example.sdk_demo_y"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.sdk_demo_y"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

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
    signingConfigs {
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation("androidx.appcompat:appcompat:1.2.0")
    implementation("androidx.legacy:legacy-support-v4:1.0.0")
    implementation("androidx.constraintlayout:constraintlayout:1.1.3")
    implementation("androidx.media:media:1.0.0")

    implementation("org.greenrobot:eventbus:3.1.1")
    implementation("com.github.bumptech.glide:glide:4.11.0")
    implementation("com.squareup.wire:wire-runtime:1.6.1")
    implementation("com.squareup.okio:okio:2.8.0")
    implementation("com.google.code.gson:gson:2.8.5")
    implementation("com.squareup.wire:wire-runtime:1.6.1")
    implementation("com.squareup.okio:okio:2.8.0")
    implementation ("androidx.legacy:legacy-support-v4:1.0.0")
    api(project(":common_library"))
    api(project(":map_sdk"))
    api(project(":location_sdk"))
    api(project(":gps_sdk"))
    api(project(":navigation_sdk"))
    api(project(":search_sdk"))
    testImplementation(kotlin("test"))


}