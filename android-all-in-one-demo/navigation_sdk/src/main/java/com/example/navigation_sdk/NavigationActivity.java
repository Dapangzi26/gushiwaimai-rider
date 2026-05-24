package com.example.navigation_sdk;

import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.dmap.api.maps.DiMap;
import com.dmap.api.maps.MapView;
import com.dmap.api.maps.model.LatLng;
import com.dmap.api.nav.DMapNavi;
import com.dmap.api.nav.DMapNaviListener;
import com.dmap.api.nav.enums.PathPlanningStrategy;
import com.dmap.api.nav.model.DMapCarInfo;
import com.dmap.api.nav.model.NaviPoi;
import com.example.navigation_sdk.routeService.MyDMapNaviListener;
import com.example.navigation_sdk.routeService.MyParallelRoadListener;
import com.example.navigation_sdk.R;

import java.util.ArrayList;
import java.util.List;

public class NavigationActivity extends AppCompatActivity {
    private MapView mapView;
    private DiMap mDimap;
    private DMapNavi dMapNavi;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.route_map); // 假设布局文件存在
        mapView = findViewById(R.id.mapview);

        mapView.getMap(didiMap -> {
            mDimap = didiMap;
            dMapNavi = getDMapNavi();

            // 起点：东软北京研发中心科研楼
            NaviPoi start = new NaviPoi(
                    "东软北京研发中心科研楼",
                    new LatLng(40.04809245589786, 116.28114759922028),
                    ""
            );

            // 终点：北京西站
            NaviPoi end = new NaviPoi(
                    "北京西站",
                    new LatLng(39.89591, 116.3213),
                    ""
            );

            // 途经点（示例：西二旗地铁站）
            List<NaviPoi> waypoints = new ArrayList<>();
            waypoints.add(new NaviPoi(
                    "西二旗地铁站",
                    new LatLng(40.053061, 116.306205),
                    ""
            ));

            // 计算驾车路线
            dMapNavi.calculateDriveRoute(
                    start,
                    end,
                    waypoints,
                    PathPlanningStrategy.DRIVING_DEFAULT
            );
        });
    }

    @NonNull
    private DMapNavi getDMapNavi() {
        // 初始化导航实例（传入Context和地图实例）
        DMapNavi dMapNavi = new DMapNavi(NavigationActivity.this, mDimap);

        // 添加导航信息回调监听（假设MyDMapNaviListener在services包中）
        MyDMapNaviListener naviListener = new MyDMapNaviListener(dMapNavi);
        dMapNavi.addDMapNaviListener(naviListener);

        // 添加主辅路、桥上桥下信息回调监听
        MyParallelRoadListener parallelRoadListener = new MyParallelRoadListener();
        dMapNavi.addParallelRoadListener(parallelRoadListener);

        // 设置车辆信息
        DMapCarInfo carInfo = new DMapCarInfo();
        carInfo.setCarNumber("京666666");
        carInfo.setRestriction(true);
        dMapNavi.setCarInfo(carInfo);

        return dMapNavi;
    }

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
        // 释放地图资源
        if (mapView != null) {
            mapView.onDestroy();
        }
        // 释放导航资源（新增）
        if (dMapNavi != null) {
            dMapNavi.destroy();
        }
    }
}