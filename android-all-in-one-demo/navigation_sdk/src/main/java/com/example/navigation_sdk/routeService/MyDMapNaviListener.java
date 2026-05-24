package com.example.navigation_sdk.routeService;

import android.util.Log;

import com.dmap.api.nav.DMapNavi;
import com.dmap.api.nav.DMapNaviListener;
import com.dmap.api.nav.enums.GpsType;
import com.dmap.api.nav.model.DMapCalcRouteResult;
import com.dmap.api.nav.model.DMapLaneInfo;
import com.dmap.api.nav.model.DMapNaviCameraInfo;
import com.dmap.api.nav.model.DMapNaviCross;
import com.dmap.api.nav.model.DMapNaviLocation;
import com.dmap.api.nav.model.NaviInfo;

public class MyDMapNaviListener implements DMapNaviListener {
    private static final String TAG = "MyDMapNaviListener";
    private DMapNavi dMapNavi;
    public MyDMapNaviListener(DMapNavi dMapNavi) {
        this.dMapNavi = dMapNavi;
    }

    @Override
    public void onGetNavigationText(int i, String s) {

    }

    @Override
    public void onArriveDestination() {

    }

    @Override
    public void onNaviInfoUpdate(NaviInfo naviInfo) {

    }

    @Override
    public void onShowCross(DMapNaviCross dMapNaviCross) {

    }

    @Override
    public void onHideCross() {

    }

    @Override
    public void onShowLaneInfo(DMapLaneInfo dMapLaneInfo) {

    }

    @Override
    public void onHideLaneInfo() {

    }

    @Override
    public void onCalculateRouteSuccess(DMapCalcRouteResult dMapCalcRouteResult) {
        Log.i(TAG, "onCalculateRouteSuccess: " + dMapCalcRouteResult);
        long[] routeIds =dMapCalcRouteResult.getRouteId();
        if (routeIds != null && routeIds.length > 1) {
            dMapNavi.selectRouteId(routeIds[1]);
        }
        dMapNavi.startNavi();
    }

    @Override
    public void onCalculateRouteFailure(DMapCalcRouteResult dMapCalcRouteResult) {

    }

    @Override
    public void onGpsSignalChanged(GpsType gpsType) {

    }

    @Override
    public void onOperationStatus(boolean b) {

    }

    @Override
    public void onLocationChange(DMapNaviLocation dMapNaviLocation) {

    }

    @Override
    public void onTrafficStatusUpdate() {

    }

    @Override
    public void onReCalculateRouteForYaw() {

    }

    @Override
    public void updateCameraInfo(DMapNaviCameraInfo[] dMapNaviCameraInfos) {

    }

    @Override
    public void updateIntervalCameraInfo(DMapNaviCameraInfo[] dMapNaviCameraInfos) {

    }

    @Override
    public void onArrivedWayPoint(int i) {

    }
}
