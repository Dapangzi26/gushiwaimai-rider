package com.example.sdk_demo_y;

import android.app.Application;

import com.dmap.api.auth.DiDiAuth;
import com.dmap.api.privacy.DMapLocationClientPrivacy;
import com.dmap.api.privacy.DMapMapViewClientPrivacy;
import com.dmap.api.privacy.DMapNavigationClientPrivacy;
import com.dmap.api.privacy.DMapTrackUploadClientPrivacy;

public class MyApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        String apiKey = getResources().getString(R.string.api_key);
        //定位隐私协议授权
        DMapLocationClientPrivacy.updatePrivacyShow(this, true, true);
        DMapLocationClientPrivacy.updatePrivacyAgree(this, true);
        //地图隐私协议授权
        DMapMapViewClientPrivacy.updatePrivacyShow(this, true, true);
        DMapMapViewClientPrivacy.updatePrivacyAgree(this, true);
        //导航隐私协议授权
        DMapNavigationClientPrivacy.updatePrivacyShow(this, true, true);
        DMapNavigationClientPrivacy.updatePrivacyAgree(this, true);
        //轨迹隐私协议授权
        DMapTrackUploadClientPrivacy.updatePrivacyShow(this, true, true);
        DMapTrackUploadClientPrivacy.updatePrivacyAgree(this, true);
        // 初始化 DiDiAuth
        DiDiAuth.init(this, apiKey);
        DiDiAuth.setGetter(new DiDiAuth.Getter() {
            @Override
            public String getUserId() {
                return "12300001111";
            }

            @Override
            public String getOAID() {
                return "12300001111";
            }
            
            @Override
            public String getDevHost() {
                return null;
            }
        });

    }
}
