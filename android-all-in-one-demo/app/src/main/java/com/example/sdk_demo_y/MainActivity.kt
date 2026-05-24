package com.example.sdk_demo_y

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.gps_sdk.GPSActivity
import com.example.location_sdk.LocationActivity
import com.example.sdk_demo_y.ui.theme.Sdk_demo_yTheme
import com.example.map_sdk.MapActivity
import com.example.navigation_sdk.NavigationActivity
import com.example.search_sdk.GeocodingActivity
import com.example.search_sdk.RoutePlanningActivity
import com.example.search_sdk.SearchPOIActivity

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            Sdk_demo_yTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // 地图SDK按钮
                        Button(
                            onClick = {

                                    startActivity(Intent(this@MainActivity, MapActivity::class.java))

                            },
                            modifier = Modifier
                                .width(200.dp)
                                .height(50.dp)
                        ) {
                            Text(text = "MapSDK-Demo")
                        }

                        // 位置SDK按钮
                        Button(
                            onClick = {
                                startActivity(Intent(this@MainActivity, LocationActivity::class.java))
                            },
                            modifier = Modifier
                                .width(200.dp)
                                .height(50.dp)
                        ) {
                            Text(text = "LocationSDK-Demo")
                        }

                        // 导航SDK按钮（修正重复的LocationActivity跳转）
                        Button(
                            onClick = {
                                startActivity(Intent(this@MainActivity, NavigationActivity::class.java))
                            },
                            modifier = Modifier
                                .width(200.dp)
                                .height(50.dp)
                        ) {
                            Text(text = "NavigationSDK-Demo")
                        }

                        Button(
                            onClick = {
                                startActivity(Intent(this@MainActivity, GeocodingActivity::class.java))
                            },
                            modifier = Modifier
                                .width(200.dp)
                                .height(50.dp)
                        ) {
                            Text(text = "Geocoding-Demo")
                        }

                        Button(
                            onClick = {
                                startActivity(Intent(this@MainActivity, RoutePlanningActivity::class.java))
                            },
                            modifier = Modifier
                                .width(200.dp)
                                .height(50.dp)
                        ) {
                            Text(text = "RoutePlanning-Demo")
                        }

                        Button(
                            onClick = {
                                startActivity(Intent(this@MainActivity, SearchPOIActivity::class.java))
                            },
                            modifier = Modifier
                                .width(200.dp)
                                .height(50.dp)
                        ) {
                            Text(text = "SearchPOI-Demo")
                        }

                        Button(
                            onClick = {
                                startActivity(Intent(this@MainActivity, GPSActivity::class.java))
                            },
                            modifier = Modifier
                                .width(200.dp)
                                .height(50.dp)
                        ) {
                            Text(text = "GPSSDK-Demo")
                        }
                    }
                }
            }
        }
    }


}