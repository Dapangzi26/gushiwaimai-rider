package com.example.search_sdk;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;

import com.dmap.api.mapwebsdk.core.MapServiceClient;
import com.dmap.api.mapwebsdk.response.geocoding.ForwardGeoResponse;
import com.dmap.api.mapwebsdk.response.geocoding.ReverseGeoResponse;
import com.dmap.api.mapwebsdk.response.geocoding.ReverseGeoResponse.Result;
import com.dmap.api.mapwebsdk.service.geocoding.GeoParams;
import com.dmap.api.mapwebsdk.utils.RpcRequestUtils;

public class GeocodingActivity extends Activity {

    private MapServiceClient mapClient;
    private TextView tvResult;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_geocoding);

        // 初始化服务客户端
        mapClient = new MapServiceClient(this);
        tvResult = findViewById(R.id.tv_result);

        // 逆地理编码按钮
        Button btnReverseGeo = findViewById(R.id.btn_reverse_geo);
        btnReverseGeo.setOnClickListener(v -> {
            Toast.makeText(this, "发送逆地理编码请求...", Toast.LENGTH_SHORT).show();

            // 逆地理编码参数：经纬度坐标
            GeoParams reverseParams = GeoParams.create()
                    .setLocation("121.4737,31.2304"); // 上海坐标

            // 直接发起逆地理编码请求
            mapClient.getGeocodingService().reverseGeocodeAPI(reverseParams,
                    new RpcRequestUtils.Callback<ReverseGeoResponse>() {
                        @Override
                        public void onSuccess(ReverseGeoResponse data) {
                            // 直接在回调中处理响应
                            int count = (data.results == null) ? 0 : data.results.size();
                            StringBuilder sb = new StringBuilder();
                            sb.append("=== 逆地理编码结果 ===\n")
                                    .append("状态: ").append(data.status).append("\n")
                                    .append("traceId: ").append(data.traceId).append("\n")
                                    .append("结果数量: ").append(count).append("\n\n");

                            if (count > 0) {
                                Result first = data.results.get(0);
                                if (first != null) {
                                    sb.append("最近地点: ").append(first.name).append("\n\n")
                                            .append("详细地址: ").append(first.address).append("\n\n")
                                            .append("城市/区: ").append(first.city).append("/").append(first.district).append("\n\n")
                                            .append("完整地址: ").append(first.addressAll).append("\n\n") // 新增 addressAll 字段
                                            .append("行政区编码: ").append(first.adcode).append("\n\n");

                                    if (first.location != null) {
                                        sb.append("精确坐标: ")
                                                .append(first.location.lng).append(",")
                                                .append(first.location.lat);
                                    }
                                }
                            } else {
                                sb.append("未找到匹配的地理位置");
                            }

                            tvResult.setText(sb.toString());
                        }

                        @Override
                        public void onBizError(int status, String msg, String traceId) {
                            tvResult.setText("逆地理编码失败: status=" + status + "\nmsg=" + msg + "\ntraceId=" + traceId);
                        }

                        @Override
                        public void onFailure(Exception e) {
                            tvResult.setText("逆地理编码请求失败: " + (e == null ? "unknown" : e.getMessage()));
                        }
                    });
        });

        // 地理编码按钮
        Button btnForwardGeo = findViewById(R.id.btn_forward_geo);
        btnForwardGeo.setOnClickListener(v -> {
            Toast.makeText(this, "发送地理编码请求...", Toast.LENGTH_SHORT).show();

            // 地理编码参数：地址和城市
            GeoParams forwardParams = GeoParams.create()
                    .setAddress("北京市海淀区西二旗东路1号")
                    .setCity("北京市"); // 城市为必填项

            // 直接发起地理编码请求
            mapClient.getGeocodingService().forwardGeocodeAPI(forwardParams,
                    new RpcRequestUtils.Callback<ForwardGeoResponse>() {
                        @Override
                        public void onSuccess(ForwardGeoResponse data) {
                            // 直接在回调中处理响应
                            int count = (data.results == null || data.results.geocodes == null) ? 0 : data.results.geocodes.size();
                            StringBuilder sb = new StringBuilder();
                            sb.append("=== 地理编码结果 ===\n")
                                    .append("状态: ").append(data.status).append("\n")
                                    .append("traceId: ").append(data.traceId).append("\n")
                                    .append("总结果数: ").append(data.results != null ? data.results.count : 0).append("\n")
                                    .append("返回结果数: ").append(count).append("\n\n");

                            if (count > 0) {
                                ForwardGeoResponse.GeoItem first = data.results.geocodes.get(0);
                                if (first != null) {
                                    sb.append("国家: ").append(first.country).append("\n\n")
                                            .append("省份: ").append(first.province).append("\n\n")
                                            .append("城市: ").append(first.city).append("\n\n")
                                            .append("区县: ").append(first.district).append("\n\n")
                                            .append("行政区编码: ").append(first.adcode).append("\n\n");

                                    if (first.location != null) {
                                        sb.append("地理坐标: ")
                                                .append(first.location.lng).append(",")
                                                .append(first.location.lat).append("\n\n");
                                    }
                                }
                            } else {
                                sb.append("未找到匹配的地理坐标");
                            }

                            tvResult.setText(sb.toString());
                        }

                        @Override
                        public void onBizError(int status, String msg, String traceId) {
                            tvResult.setText("地理编码失败: status=" + status + "\nmsg=" + msg + "\ntraceId=" + traceId);
                        }

                        @Override
                        public void onFailure(Exception e) {
                            tvResult.setText("地理编码请求失败: " + (e == null ? "unknown" : e.getMessage()));
                        }
                    });
        });
    }
}