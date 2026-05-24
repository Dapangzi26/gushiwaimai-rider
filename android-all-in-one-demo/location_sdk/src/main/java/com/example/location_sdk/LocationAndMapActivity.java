package com.example.location_sdk;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.dmap.api.location.DMapLocation;
import com.dmap.api.location.DMapLocationClient;
import com.dmap.api.location.DMapLocationClientOption;
import com.dmap.api.location.DMapLocationListener;

import java.util.Date;

public class LocationAndMapActivity extends AppCompatActivity {
    private static final String TAG = "LocationAndMapActivity";
    private static final int REQUEST_FINE_LOCATION = 100;
    private DMapLocationClient locationClient;
    private DMapLocationClientOption locationOption;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_map); // 假设布局文件存在

        // 检查并请求定位权限
        if (ContextCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION},
                    REQUEST_FINE_LOCATION
            );
        } else {
            // 权限已授予，初始化并启动定位
            initAndStartLocation();
        }
    }

    /**
     * 初始化并启动定位服务
     */
    private void initAndStartLocation() {
        // 1. 新建定位服务client
        locationClient = new DMapLocationClient(this);

        // 2. 设置定位回调监听
        locationClient.setLocationListener(dmapLocation -> {
            if (dmapLocation.getErrorCode() == DMapLocation.ErrorCode.SUCCESS) {
                dLogLocs(new Date().toLocaleString() + ":\n" + dmapLocation.toString());
                // 定位成功示例：显示经纬度
                showLocationToast(dmapLocation);
            } else {
                // 定位失败
                dLogLocs("DmapError location Error, ErrCode:"
                        + dmapLocation.getErrorCode() + ", errInfo:"
                        + dmapLocation.getErrorInfo());
                Toast.makeText(this, "定位失败", Toast.LENGTH_SHORT).show();
            }
        });

        // 3. 设置option
        locationOption = new DMapLocationClientOption();
        // 设置导航场景，默认非导航场景
        locationOption.setNaviMode(true);
        // 设置回调间隔，默认Normal：3秒一次
        locationOption.setInterval(DMapLocationClientOption.IntervalMode.NORMAL);
        // 设置单次定位，默认为连续定位（如需单次定位取消注释）
        // locationOption.setOnceLocation(true);
        locationClient.setLocationOption(locationOption);

        // 4. 启动定位
        locationClient.startLocation();
    }

    /**
     * 显示定位结果Toast
     */
    private void showLocationToast(DMapLocation location) {
        double latitude = location.getLatitude();
        double longitude = location.getLongitude();
        String msg = "定位成功\n纬度：" + latitude + "\n经度：" + longitude;
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_FINE_LOCATION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // 权限授予后启动定位
                initAndStartLocation();
            } else {
                Toast.makeText(this, "需要定位权限才能使用", Toast.LENGTH_SHORT).show();
                finish();
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // 停止定位（页面不可见时节省电量）
        if (locationClient != null) {
            locationClient.stopLocation();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // 重新启动定位（页面可见时）
        if (locationClient != null) {
            locationClient.startLocation();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // 停止定位并释放资源
        if (locationClient != null) {
            locationClient.stopLocation();
            locationClient = null;
        }
    }

    private void dLogLocs(String info) {
        Log.i(TAG, info);
    }
}