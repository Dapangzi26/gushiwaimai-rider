package com.example.search_sdk;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;

import com.dmap.api.mapwebsdk.core.MapServiceClient;
import com.dmap.api.mapwebsdk.response.search.PlaceTextSearchResponse;
// 关键：导入嵌套类
import com.dmap.api.mapwebsdk.response.search.PlaceTextSearchResponse.PlaceItem;

import com.dmap.api.mapwebsdk.service.searchpoi.SearchParams;
import com.dmap.api.mapwebsdk.utils.RpcRequestUtils;

public class SearchPOIActivity extends Activity {

    private TextView tv;
    // 添加服务客户端
    private MapServiceClient mapClient;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_search);
        // 初始化服务客户端
        mapClient = new MapServiceClient(this);
        tv = findViewById(R.id.tv_result);

        // 第一个按钮：关键词搜索
        Button btn = findViewById(R.id.btn_send);
        btn.setOnClickListener(v -> {
            Toast.makeText(this, "发送文本搜索请求...", Toast.LENGTH_SHORT).show();

            SearchParams params = SearchParams.create()
                    .setKeywords("麦当劳")
                    .setCity("北京市")
                    .setLocation("116.424790,39.956953"); // 可选

            mapClient.getSearchForPOIServices().keywordSearchApi(params, new RpcRequestUtils.Callback<PlaceTextSearchResponse>() {
                @Override public void onSuccess(PlaceTextSearchResponse data) {
                    handleSearchResponse(data);
                }
                @Override public void onBizError(int status, String msg, String traceId) {
                    tv.setText("业务失败 status=" + status + " msg=" + msg + " traceId=" + traceId);
                }
                @Override public void onFailure(Exception e) {
                    tv.setText("请求失败: " + (e == null ? "unknown" : e.getMessage()));
                }
            });
        });

        // 第二个按钮：周围搜索
        Button btnSend2 = findViewById(R.id.btn_send_around);
        btnSend2.setOnClickListener(v -> {
            Toast.makeText(this, "发送周围搜索请求...", Toast.LENGTH_SHORT).show();

            SearchParams params = SearchParams.create()
                    .setKeywords("南方智媒大厦")
                    .setCity("广州市") // 可选
                    .setMaxDistance(1000) // 整数类型
                    .setSortrule("distance") // 可选
                    //.setPoiTypes("101010") // 可选
                    ;

            // 使用 MapServiceClient 进行周边搜索
            mapClient.getSearchForPOIServices().peripheralSearchAPI(params, new RpcRequestUtils.Callback<PlaceTextSearchResponse>() {
                @Override
                public void onSuccess(PlaceTextSearchResponse data) {
                    handleSearchResponse(data);
                }
                @Override
                public void onBizError(int status, String msg, String traceId) {
                    tv.setText("业务失败 status=" + status + " msg=" + msg + " traceId=" + traceId);
                }
                @Override
                public void onFailure(Exception e) {
                    tv.setText("请求失败: " + (e == null ? "unknown" : e.getMessage()));
                }
            });
        });

        // 第三个按钮：输入提示
        Button btnSend3 = findViewById(R.id.btn_send_inputtips);
        btnSend3.setOnClickListener(v -> {
            Toast.makeText(this, "发送输入提示请求...", Toast.LENGTH_SHORT).show();

            SearchParams params = SearchParams.create()
                    .setKeywords("南方智媒大厦")
                    .setCity("北京") // 可选
                    .setLocation("116.434091,39.90923") // 可选
                    .setMaxDistance(500) // 整数类型
                    //.setInputTypes("101000") // 可选
                    .setCityLimit(false)
                    ;

            // 使用 MapServiceClient 进行输入提示搜索
            mapClient.getSearchForPOIServices().inputTipsAPI(params, new RpcRequestUtils.Callback<PlaceTextSearchResponse>() {
                @Override
                public void onSuccess(PlaceTextSearchResponse data) {
                    handleSearchResponse(data);
                }
                @Override
                public void onBizError(int status, String msg, String traceId) {
                    tv.setText("业务失败 status=" + status + " msg=" + msg + " traceId=" + traceId);
                }
                @Override
                public void onFailure(Exception e) {
                    tv.setText("请求失败: " + (e == null ? "unknown" : e.getMessage()));
                }
            });
        });
    }
    // 统一处理搜索响应
    private void handleSearchResponse(PlaceTextSearchResponse data) {
        int count = (data.results == null) ? 0 : data.results.size();
        StringBuilder sb = new StringBuilder();
        sb.append("状态: ").append(data.status).append("\n")
                .append("traceId: ").append(data.traceId).append("\n")
                .append("条数: ").append(count).append("\n");

        if (count > 0) {
            for (PlaceItem place : data.results) {
                sb.append("名称: ").append(place.name)
                        .append(" 地址: ").append(place.address)
                        .append(" 距离: ").append(place.distance)
                        .append("米\n");

                if (place.location != null) {
                    sb.append("坐标: ").append(place.location.lng)
                            .append(",").append(place.location.lat).append("\n");
                }

                // 添加分隔线
                sb.append("-----------------\n");
            }
        }
        tv.setText(sb.toString());
    }
}