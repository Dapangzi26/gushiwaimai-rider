package com.example.gps_sdk;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;


import com.dmap.api.track.DMapTrackClient;
import com.dmap.api.track.DMapTrackData;
import com.dmap.api.track.DMapTrackError;
import com.dmap.api.track.IDMapCommonInfoDelegate;
import com.dmap.api.track.IDMapTrackDataDelegate;
import com.example.gps_sdk.R;

public class GPSActivity extends AppCompatActivity {
    private static final String TAG = "GPSActivity";
    private static final int REQUEST_FINE_LOCATION = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_map); // 假设布局文件存在

        // 检查定位权限
        if (ContextCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION},
                    REQUEST_FINE_LOCATION
            );
        } else {
            // 权限已授予，初始化GPS点串上报
            initGPSTrackReporting();
        }
    }

    /**
     * 初始化GPS点串上报功能
     */
    private void initGPSTrackReporting() {
        // 在使用DMapLocationClient、DMapTrackClient之前调用（如App.onCreate时机）
//        DMapLocationConfig config = new DMapLocationConfig.Builder()
//                .scene(DMapLocationConfig.Scene.DRIVER) // 设置为司机定位场景
//                .build();
//        DMapLocationManager.getInstance().init(
//                getApplicationContext(),
//                config
//        );
//        Log.i(TAG, "GPS定位配置初始化完成");
        // —— 2. 在初始化完 locationConfig 之后，再设置 DMapTrackClient 的代理，准备上报 GPS 点串 ——
        DMapTrackClient.getDefaultClient().init(getApplicationContext(), new IDMapCommonInfoDelegate() {
            @Override
            public String getPhone() {
                return "";
            }

            @Override
            public String getUid() {
                return "12300001111";
            }

            @Override
            public String getToken() {
                return "";
            }

            @Override
            public long getCityId() {
                return 0;
            }

            @Override
            public long getCountryId() {
                return 0;
            }
        });
        // 实现GPS点串协议代理方法，提供业务信息
        DMapTrackClient.getDefaultClient().setTrackDataDelegate(new IDMapTrackDataDelegate() {
            @Override
            public DMapTrackData getTrackData() {
                return new DMapTrackData.Builder()
                        .thirdPartyUid("703986516506298433") // 第三方用户ID（示例）
                        .thirdPartyOid("123456")             // 第三方订单ID（示例）
                        .openUid("703986516506298433")       // 滴滴开放平台用户ID（选填）
                        .openOid("987654321")                // 滴滴开放平台订单ID（示例）
                        .orderSource(DMapTrackData.OrderSource.THIRD_PARTY) // 订单来源
                        .role(DMapTrackData.Role.DRIVER)      // 用户角色：司机
                        .bizStatus(DMapTrackData.BizStatus.ONTRIP) // 业务状态：行程中
                        .build();
            }
        });
        DMapTrackClient.getDefaultClient().setTrackEventListener(result -> {
            String printStr = "上报时间: "
                    + "\nresult: " + result;
            Log.i(TAG, printStr);
        });
        Log.i(TAG, "GPS点串数据代理设置完成");

        // 启动GPS点串上报
        startGPSTrackReporting();
    }

    /**
     * 启动GPS点串上报
     */
    private void startGPSTrackReporting() {
        int result = DMapTrackClient.getDefaultClient().start(this);
        if (result == DMapTrackError.ERROR_OK) {
            Log.i(TAG, "GPS点串上报启动成功");
            Toast.makeText(this, "GPS轨迹上报已启动", Toast.LENGTH_SHORT).show();
        } else {
            Log.e(TAG, "GPS点串上报启动失败，错误码：" + result);
            Toast.makeText(this, "GPS轨迹上报启动失败", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_FINE_LOCATION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // 权限授予后启动GPS上报
                initGPSTrackReporting();
            } else {
                Toast.makeText(this, "需要定位权限才能上报GPS轨迹", Toast.LENGTH_SHORT).show();
                finish(); // 无权限时关闭页面
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // 停止GPS点串上报（释放资源）
        DMapTrackClient.getDefaultClient().stop();
        Log.i(TAG, "GPS点串上报已停止");
    }
}