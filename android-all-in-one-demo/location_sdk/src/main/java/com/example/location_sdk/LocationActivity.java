package com.example.location_sdk;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.dmap.api.location.DMapLocation;
import com.dmap.api.location.DMapLocationClient;
import com.dmap.api.location.DMapLocationClientOption;

import java.util.Date;

public class LocationActivity extends AppCompatActivity {
    private static final String TAG = "LocationActivity";
    private static final int REQUEST_FINE_LOCATION = 100;
    private static final int TOAST_DURATION = 8000; // 自定义Toast显示时间（8秒）
    private static final int TOAST_REFRESH_INTERVAL = 3500; // Toast刷新间隔（3.5秒）

    // 新增：Toast刷新相关的成员变量
    private static final int MSG_SHOW_TOAST = 1;
    private Handler toastHandler;
    private Runnable toastRunnable;

    private DMapLocationClient locationClient;
    private DMapLocationClientOption locationOption;
    private Toast locationToast; // 用于管理自定义Toast
    private String currentToastMessage = ""; // 当前Toast显示的内容

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_navi); // 假设布局文件存在

        // 初始化Toast刷新Handler
        toastHandler = new Handler();
        toastRunnable = new Runnable() {
            @Override
            public void run() {
                if (locationToast != null && !currentToastMessage.isEmpty()) {
                    locationToast.show();
                }
                toastHandler.postDelayed(this, TOAST_REFRESH_INTERVAL);
            }
        };

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
                showExtendedToast("定位失败"); // 使用长时间显示的Toast
            }
        });

        // 3. 设置option
        locationOption = new DMapLocationClientOption();
        // 设置导航场景，默认非导航场景
        locationOption.setNaviMode(true);
        // 设置回调间隔，默认Normal：3秒一次
        locationOption.setInterval(DMapLocationClientOption.IntervalMode.LOW_FREQUENCY);
        // 设置单次定位，默认为连续定位（如需单次定位取消注释）
        // locationOption.setOnceLocation(true);
        locationClient.setLocationOption(locationOption);

        // 4. 启动定位
        locationClient.startLocation();
    }

    /**
     * 显示长时间定位结果Toast（修改重点）
     */
    private void showLocationToast(DMapLocation location) {
        double latitude = location.getLatitude();
        double longitude = location.getLongitude();
        String msg = "定位成功\n纬度：" + latitude + "\n经度：" + longitude;
        showExtendedToast(msg);
    }

    // 新增：长时间显示的Toast方法
    private void showExtendedToast(String message) {
        currentToastMessage = message; // 保存当前消息

        // 取消之前的Toast和回调
        cancelActiveToast();

        // 自定义Toast布局
        LayoutInflater inflater = getLayoutInflater();
        View layout = inflater.inflate(R.layout.custom_toast, null); // 需要创建custom_toast.xml

        TextView textView = layout.findViewById(R.id.toast_text);
        textView.setText(message);
        textView.setTextSize(18); // 设置字体大小

        locationToast = new Toast(getApplicationContext());
        locationToast.setGravity(Gravity.CENTER, 0, 0); // 居中显示
        locationToast.setDuration(Toast.LENGTH_LONG);
        locationToast.setView(layout);
        locationToast.show();

        // 启动定时刷新机制
        toastHandler.postDelayed(toastRunnable, TOAST_REFRESH_INTERVAL);

        // 设置总时长后自动取消
        toastHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                cancelActiveToast();
            }
        }, TOAST_DURATION);
    }

    // 新增：取消当前活动的Toast
    private void cancelActiveToast() {
        if (locationToast != null) {
            locationToast.cancel();
            locationToast = null;
        }
        if (toastRunnable != null) {
            toastHandler.removeCallbacks(toastRunnable);
        }
        currentToastMessage = "";
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_FINE_LOCATION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // 权限授予后启动定位
                initAndStartLocation();
            } else {
                showExtendedToast("需要定位权限才能使用");
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
        // 取消Toast显示
        cancelActiveToast();
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
        // 取消Toast显示和Handler回调
        toastHandler.removeCallbacksAndMessages(null);
        cancelActiveToast();
    }

    private void dLogLocs(String info) {
        Log.i(TAG, info);
    }
}