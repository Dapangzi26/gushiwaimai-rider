package com.example.map_sdk;

import android.app.Application;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.dmap.api.auth.DiDiAuth;
import com.dmap.api.maps.DiMap;
import com.dmap.api.maps.MapView;
import com.dmap.api.maps.OnMapReadyCallback;
import com.dmap.api.maps.model.BitmapDescriptor;
import com.dmap.api.maps.model.BitmapDescriptorFactory;
import com.dmap.api.maps.model.CameraUpdateFactory;
import com.dmap.api.maps.model.Circle;
import com.dmap.api.maps.model.CircleOptions;
import com.dmap.api.maps.model.HeatDataNode;
import com.dmap.api.maps.model.HeatOverlay;
import com.dmap.api.maps.model.HeatOverlayOptions;
import com.dmap.api.maps.model.LatLng;
import com.dmap.api.maps.model.Marker;
import com.dmap.api.maps.model.MarkerOptions;
import com.dmap.api.maps.model.Polyline;
import com.dmap.api.maps.model.PolylineOptions;
import com.dmap.api.maps.model.animation.AlphaAnimation;
import com.dmap.api.maps.model.animation.Animation;
import com.dmap.api.maps.model.animation.AnimationSet;
import com.dmap.api.maps.model.animation.RotateAnimation;
import com.dmap.api.maps.model.animation.ScaleAnimation;

import java.util.ArrayList;

public class MapActivity extends AppCompatActivity {
    private MapView mapView; // 声明为成员变量，后续从XML绑定
    private DiMap mDimap;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_map); // 加载XML布局

        // 从XML中找到MapView实例（通过@+id/map的ID）
        mapView = findViewById(R.id.map);
        Application app = getApplication();


        // 获取地图并设置中心点和标记
        mapView.getMap(new OnMapReadyCallback() {
            @Override
            public void onMapReady(DiMap diMap) {
                mDimap = diMap;  // 拿到DiMap后，进行后续的操作

                // 北京天安门的经纬度
                LatLng markerLocation = new LatLng(39.9075, 116.3972);  // 设置天安门位置

                // 设置地图缩放级别，并将相机聚焦到指定的经纬度
                mDimap.moveCamera(CameraUpdateFactory.newLatLngZoom(markerLocation, 16)); // 缩放级别为16

                // 从assets中加载一张名为"arrow.png"的bitmap
                BitmapDescriptor bitmapDescriptor = BitmapDescriptorFactory.fromAsset(MapActivity.this, "arrow.png");

                // 创建MarkerOptions，为添加的Marker赋予必要的属性。position表示其地理坐标
                MarkerOptions markerOptions = new MarkerOptions().icon(bitmapDescriptor).position(markerLocation);

                // 通过DiMap创建Marker
                Marker marker = mDimap.addMarker(markerOptions);

                AnimationSet animationSet = new AnimationSet(true);
                // 添加透明度动画
                animationSet.addAnimation(new AlphaAnimation(0f,1f));
                // 添加旋转动画
                animationSet.addAnimation(new RotateAnimation(0f, 180f, 0f, 0f, 0f));
                // 缩放动画
                animationSet.addAnimation(new ScaleAnimation(1f,2f,1f,2f));
                animationSet.setDuration(3000);
                marker.setAnimationListener(new Animation.AnimationListener() {
                    @Override
                    public void onAnimationStart() {
                        Toast.makeText(MapActivity.this, "动画开始", Toast.LENGTH_SHORT).show();
                    }

                    @Override
                    public void onAnimationEnd() {
                        Toast.makeText(MapActivity.this, "动画结束", Toast.LENGTH_SHORT).show();
                    }
                });
                //开启动画
                marker.startAnimation(animationSet);
                // 添加第二个带有标题和信息窗口的标记
                LatLng secondMarkerLocation = new LatLng(39.9087, 116.3975); // 设置第二个标记的位置
                MarkerOptions secondMarkerOptions = new MarkerOptions()
                        .icon(BitmapDescriptorFactory.defaultMarker())
                        .position(secondMarkerLocation)
                        .title("我是天安门")
                        .snippet("中国的象征")
                        .setInfoWindowEnable(true); // 启用信息窗口

                Marker secondMarker = mDimap.addMarker(secondMarkerOptions);

                // 显示信息窗口
                secondMarker.showInfoWindow();
                // 定义天安门附近的经纬度坐标
                LatLng tiananmen = new LatLng(39.9075, 116.3972);
                LatLng wangfujing = new LatLng(39.915, 116.403);
                LatLng forbiddenCity = new LatLng(39.916, 116.397);
                PolylineOptions.MultiColorLineInfo[] infos = new PolylineOptions.MultiColorLineInfo[] {
                        new PolylineOptions.MultiColorLineInfo(0, PolylineOptions.MultiColor.RED),    // 从天安门到王府井，红色
                        new PolylineOptions.MultiColorLineInfo(1, PolylineOptions.MultiColor.YELLOW), // 从王府井到故宫，黄色
                };
                Polyline line = mDimap.addPolyline(
                        (new PolylineOptions())
                                .add(tiananmen, wangfujing, forbiddenCity)
                                .width(20).multiColorLineInfo(infos)
                                .type(PolylineOptions.LineType.LINE_TYPE_MULTICOLOR));
                CircleOptions options = new CircleOptions().center(tiananmen)
                        .radius(1000).strokeColor(Color.BLACK)
                        .fillColor(Color.argb(50, 1,1,1)).strokeWidth(20);
                Circle circle = mDimap.addCircle(options);


            }
        });
    }

    // 以下生命周期方法需调用mapView的对应方法（使用绑定后的实例）
    @Override
    protected void onStart() {
        super.onStart();
        mapView.onStart();
    }

    @Override
    protected void onResume() {
        super.onResume();
        mapView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        mapView.onPause();
    }

    @Override
    protected void onStop() {
        super.onStop();
        mapView.onStop();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        mapView.onDestroy();
    }
}

