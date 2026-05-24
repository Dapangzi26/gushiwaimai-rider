package com.example.navigation_sdk.routeService;

import android.util.Log;

import com.dmap.api.nav.ParallelRoadListener;
import com.dmap.api.nav.enums.DMapNaviParallelRoadStatus;

public class MyParallelRoadListener implements ParallelRoadListener {
    @Override
    public void notifyParallelRoad(DMapNaviParallelRoadStatus status) {
        if (status == null) {
            Log.d("ParallelRoad", "主辅路信息为空");
            return;
        }

        int parallelRoadStatus = status.getParallelRoadStatusFlag();
        int elevatedRoadStatus = status.getElevatedRoadStatusFlag();

        // 主辅路状态处理
        switch (parallelRoadStatus) {
            case 1:
                Log.d("ParallelRoad", "当前在主路上");
                break;
            case 2:
                Log.d("ParallelRoad", "当前在辅路上");
                break;
            default:
                Log.d("ParallelRoad", "未知主辅路状态");
                break;
        }

        // 高架路上下状态处理
        switch (elevatedRoadStatus) {
            case 1:
                Log.d("ParallelRoad", "当前在桥下");
                break;
            case 2:
                Log.d("ParallelRoad", "当前在桥上");
                break;
            default:
                Log.d("ParallelRoad", "未知高架路状态");
                break;
        }
    }
}

