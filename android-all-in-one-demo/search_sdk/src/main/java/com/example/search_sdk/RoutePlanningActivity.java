package com.example.search_sdk;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;

import com.dmap.api.mapwebsdk.core.MapServiceClient;
import com.dmap.api.mapwebsdk.response.routeplan.BusRouteResponse;
import com.dmap.api.mapwebsdk.response.routeplan.RouteResponse;
import com.dmap.api.mapwebsdk.service.RoutePlanningService;
import com.dmap.api.mapwebsdk.service.routeplanning.RouteParams;
import com.dmap.api.mapwebsdk.utils.RpcRequestUtils;

public class RoutePlanningActivity extends Activity {

    private MapServiceClient mapServiceClient;
    private TextView tv;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_route_planning);

        // 初始化SDK客户端
        mapServiceClient = new MapServiceClient(this);
        tv = findViewById(R.id.tv_result);

        // 驾车路线规划示例
        Button btnDriving = findViewById(R.id.btn_send);
        btnDriving.setOnClickListener(v -> {
            Toast.makeText(this, "驾车路线规划示例", Toast.LENGTH_SHORT).show();

            // 1. 创建路线参数
            RouteParams params = RouteParams.create()
                    .setOrigin("116.2807,40.04811")  // 起点坐标
                    .setDestination("116.30334,40.05203")  // 终点坐标
                    .setRouteplanType(RouteParams.TYPE_DROPOFF)  // 路线类型
                    .setDepartureTime(System.currentTimeMillis() / 1000)  // 当前时间戳
                    .setNeedPolyline(true);  // 需要路径点

            // 2. 获取服务
            RoutePlanningService service = mapServiceClient.getRoutePlanningService();

            // 3. 发起请求
            service.planDrivingRouteAPI(params, new RpcRequestUtils.Callback<RouteResponse>() {
                @Override
                public void onSuccess(RouteResponse data) {
                    // 4. 处理结果
                    if (data.results != null && !data.results.isEmpty()) {
                        RouteResponse.Result result = data.results.get(0);
                        StringBuilder msg = new StringBuilder("驾车路线规划成功\n")
                                .append("距离：").append(result.dist).append("米\n")
                                .append("时长：").append(result.duration).append("秒\n")
                                .append("路径点数：").append(result.geoList != null ? result.geoList.size() : 0);

                        // 打印起点和终点的经纬度
                        if (result.geoList != null && result.geoList.size() >= 2) {
                            // 第一个点（起点）
                            RouteResponse.GeoPoint startPoint = result.geoList.get(0);
                            double startLat = startPoint.latitude != null ? startPoint.latitude : 0.0;
                            double startLng = startPoint.longitude != null ? startPoint.longitude : 0.0;

                            // 最后一个点（终点）
                            RouteResponse.GeoPoint endPoint = result.geoList.get(result.geoList.size() - 1);
                            double endLat = endPoint.latitude != null ? endPoint.latitude : 0.0;
                            double endLng = endPoint.longitude != null ? endPoint.longitude : 0.0;

                            msg.append("\n\n起点坐标：").append(startLat).append(", ").append(startLng)
                                    .append("\n终点坐标：").append(endLat).append(", ").append(endLng);
                        }

                        // 打印任意两个中间点（例如第5个和第10个）
                        if (result.geoList != null && result.geoList.size() > 10) {
                            // 第5个点
                            RouteResponse.GeoPoint point5 = result.geoList.get(4);
                            double lat5 = point5.latitude != null ? point5.latitude : 0.0;
                            double lng5 = point5.longitude != null ? point5.longitude : 0.0;

                            // 第10个点
                            RouteResponse.GeoPoint point10 = result.geoList.get(9);
                            double lat10 = point10.latitude != null ? point10.latitude : 0.0;
                            double lng10 = point10.longitude != null ? point10.longitude : 0.0;

                            msg.append("\n\n中间点示例：")
                                    .append("\n第5个点：").append(lat5).append(", ").append(lng5)
                                    .append("\n第10个点：").append(lat10).append(", ").append(lng10);
                        }

                        tv.setText(msg.toString());
                    }
                }

                @Override
                public void onBizError(int status, String msg, String traceId) {
                    tv.setText("驾车路线规划失败：" + msg);
                }

                @Override
                public void onFailure(Exception e) {
                    tv.setText("驾车路线规划异常：" + e.getMessage());
                }
            });
        });

        // 步行路线规划示例
        Button btnWalking = findViewById(R.id.btn_walking);
        btnWalking.setOnClickListener(v -> {
            Toast.makeText(this, "步行路线规划示例", Toast.LENGTH_SHORT).show();

            // 1. 创建路线参数（步行只需要起点和终点）
            RouteParams params = RouteParams.create()
                    .setOrigin("116.2807,40.04811")  // 起点坐标
                    .setDestination("116.30334,40.05203");  // 终点坐标

            // 2. 获取服务
            RoutePlanningService service = mapServiceClient.getRoutePlanningService();

            // 3. 发起请求
            service.planWalkingRouteAPI(params, new RpcRequestUtils.Callback<RouteResponse>() {
                @Override
                public void onSuccess(RouteResponse data) {
                    // 4. 处理结果
                    if (data.results != null && !data.results.isEmpty()) {
                        RouteResponse.Result result = data.results.get(0);
                        StringBuilder msg = new StringBuilder("步行路线规划成功\n")
                                .append("距离：").append(result.dist).append("米\n")
                                .append("时长：").append(result.duration).append("秒\n")
                                .append("路径点数：").append(result.geoList != null ? result.geoList.size() : 0);

                        // 打印起点和终点的经纬度
                        if (result.geoList != null && result.geoList.size() >= 2) {
                            // 第一个点（起点）
                            RouteResponse.GeoPoint startPoint = result.geoList.get(0);
                            double startLat = startPoint.latitude != null ? startPoint.latitude : 0.0;
                            double startLng = startPoint.longitude != null ? startPoint.longitude : 0.0;

                            // 最后一个点（终点）
                            RouteResponse.GeoPoint endPoint = result.geoList.get(result.geoList.size() - 1);
                            double endLat = endPoint.latitude != null ? endPoint.latitude : 0.0;
                            double endLng = endPoint.longitude != null ? endPoint.longitude : 0.0;

                            msg.append("\n\n起点坐标：").append(startLat).append(", ").append(startLng)
                                    .append("\n终点坐标：").append(endLat).append(", ").append(endLng);
                        }

                        // 打印任意两个中间点（例如第3个和第6个）
                        if (result.geoList != null && result.geoList.size() > 6) {
                            // 第3个点
                            RouteResponse.GeoPoint point3 = result.geoList.get(2);
                            double lat3 = point3.latitude != null ? point3.latitude : 0.0;
                            double lng3 = point3.longitude != null ? point3.longitude : 0.0;

                            // 第6个点
                            RouteResponse.GeoPoint point6 = result.geoList.get(5);
                            double lat6 = point6.latitude != null ? point6.latitude : 0.0;
                            double lng6 = point6.longitude != null ? point6.longitude : 0.0;

                            msg.append("\n\n中间点示例：")
                                    .append("\n第3个点：").append(lat3).append(", ").append(lng3)
                                    .append("\n第6个点：").append(lat6).append(", ").append(lng6);
                        }

                        tv.setText(msg.toString());
                    }
                }

                @Override
                public void onBizError(int status, String msg, String traceId) {
                    tv.setText("步行路线规划失败：" + msg);
                }

                @Override
                public void onFailure(Exception e) {
                    tv.setText("步行路线规划异常：" + e.getMessage());
                }
            });
        });

// 骑行路线规划示例
        Button btnBiking = findViewById(R.id.btn_biking);
        btnBiking.setOnClickListener(v -> {
            Toast.makeText(this, "骑行路线规划示例", Toast.LENGTH_SHORT).show();

            // 1. 创建路线参数（骑行只需要起点和终点）
            RouteParams params = RouteParams.create()
                    .setOrigin("116.2807,40.04811")  // 起点坐标
                    .setDestination("116.30334,40.05203");  // 终点坐标

            // 2. 获取服务
            RoutePlanningService service = mapServiceClient.getRoutePlanningService();

            // 3. 发起请求
            service.planBikingRouteAPI(params, new RpcRequestUtils.Callback<RouteResponse>() {
                @Override
                public void onSuccess(RouteResponse data) {
                    // 4. 处理结果
                    if (data.results != null && !data.results.isEmpty()) {
                        RouteResponse.Result result = data.results.get(0);
                        StringBuilder msg = new StringBuilder("骑行路线规划成功\n")
                                .append("距离：").append(result.dist).append("米\n")
                                .append("时长：").append(result.duration).append("秒\n")
                                .append("路径点数：").append(result.geoList != null ? result.geoList.size() : 0);

                        // 打印起点和终点的经纬度
                        if (result.geoList != null && result.geoList.size() >= 2) {
                            // 第一个点（起点）
                            RouteResponse.GeoPoint startPoint = result.geoList.get(0);
                            double startLat = startPoint.latitude != null ? startPoint.latitude : 0.0;
                            double startLng = startPoint.longitude != null ? startPoint.longitude : 0.0;

                            // 最后一个点（终点）
                            RouteResponse.GeoPoint endPoint = result.geoList.get(result.geoList.size() - 1);
                            double endLat = endPoint.latitude != null ? endPoint.latitude : 0.0;
                            double endLng = endPoint.longitude != null ? endPoint.longitude : 0.0;

                            msg.append("\n\n起点坐标：").append(startLat).append(", ").append(startLng)
                                    .append("\n终点坐标：").append(endLat).append(", ").append(endLng);
                        }

                        // 打印任意两个中间点（例如第4个和第8个）
                        if (result.geoList != null && result.geoList.size() > 8) {
                            // 第4个点
                            RouteResponse.GeoPoint point4 = result.geoList.get(3);
                            double lat4 = point4.latitude != null ? point4.latitude : 0.0;
                            double lng4 = point4.longitude != null ? point4.longitude : 0.0;

                            // 第8个点
                            RouteResponse.GeoPoint point8 = result.geoList.get(7);
                            double lat8 = point8.latitude != null ? point8.latitude : 0.0;
                            double lng8 = point8.longitude != null ? point8.longitude : 0.0;

                            msg.append("\n\n中间点示例：")
                                    .append("\n第4个点：").append(lat4).append(", ").append(lng4)
                                    .append("\n第8个点：").append(lat8).append(", ").append(lng8);
                        }

                        tv.setText(msg.toString());
                    }
                }

                @Override
                public void onBizError(int status, String msg, String traceId) {
                    tv.setText("骑行路线规划失败：" + msg);
                }

                @Override
                public void onFailure(Exception e) {
                    tv.setText("骑行路线规划异常：" + e.getMessage());
                }
            });
        });
        Button btnBus = findViewById(R.id.btn_bus);
        btnBus.setOnClickListener(v -> {
            Toast.makeText(this, "公交路线规划示例", Toast.LENGTH_SHORT).show();

            // 1. 创建路线参数
            RouteParams params = RouteParams.create()
                    .setOrigin("116.2807,40.04811")  // 起点坐标
                    .setDestination("116.30334,40.05203")  // 终点坐标
                    .setCity("北京市")  // 必填：城市名称
                    .setStrategy(RouteParams.BUS_STRATEGY_MIN_TRANSFER)  // 可选：最少换乘模式
                    .setDepartureTime(System.currentTimeMillis() / 1000)  // 可选：出发时间（当前时间）
                    .setRouteNum(3);  // 可选：返回3条路线

            // 2. 获取服务
            RoutePlanningService service = mapServiceClient.getRoutePlanningService();

            // 3. 发起请求 - 使用新的BusRouteResponse模型
            service.planBusRouteAPI(params, new RpcRequestUtils.Callback<BusRouteResponse>() {
                @Override
                public void onSuccess(BusRouteResponse data) {
                    // 4. 处理结果
                    if (data.results != null && !data.results.isEmpty()) {
                        StringBuilder result = new StringBuilder("公交路线规划成功\n\n");
                        for (int i = 0; i < data.results.size(); i++) {
                            BusRouteResponse.BusRouteResult route = data.results.get(i);
                            result.append("===== 路线 ").append(i + 1).append(" =====").append("\n")
                                    .append("起点: ").append(route.origin).append("\n")
                                    .append("终点: ").append(route.destination).append("\n")
                                    .append("总距离: ").append(route.distance).append("米\n")
                                    .append("总时间: ").append(formatDuration(route.duration)).append("\n")
                                    .append("费用: ").append(formatCost(route.cost)).append("\n")
                                    .append("步行距离: ").append(route.walkingDistance).append("米\n")
                                    .append("\n路线分段:\n");

                            // 处理路线分段
                            if (route.segments != null && !route.segments.isEmpty()) {
                                for (BusRouteResponse.BusSegment segment : route.segments) {
                                    if ("WALKING".equals(segment.mode) && segment.walking != null) {
                                        BusRouteResponse.WalkingSegment walking = segment.walking;
                                        result.append("  - 步行段: ").append(walking.origin).append(" → ").append(walking.destination).append("\n")
                                                .append("    距离: ").append(walking.distance).append("米, ")
                                                .append("时间: ").append(formatDuration(walking.duration)).append("\n");
                                    } else if ("TRANSIT".equals(segment.mode) && segment.metrobus != null) {
                                        for (BusRouteResponse.BusDetail bus : segment.metrobus) {
                                            result.append("  - 公交段: ").append(bus.name)
                                                    .append(" (").append(getBusType(bus.type)).append(")\n")
                                                    .append("    上车站: ").append(getBusStopName(bus.departureStop)).append("\n")
                                                    .append("    下车站: ").append(getBusStopName(bus.arrivalStop)).append("\n")
                                                    .append("    距离: ").append(bus.distance).append("米, ")
                                                    .append("时间: ").append(formatDuration(bus.duration)).append("\n")
                                                    .append("    首班车: ").append(bus.firstTime).append(", 末班车: ").append(bus.lastTime).append("\n");

                                            // 显示途经站点
                                            if (bus.viaStops != null && !bus.viaStops.isEmpty()) {
                                                result.append("    途经:");
                                                for (BusRouteResponse.BusStop stop : bus.viaStops) {
                                                    result.append(" ").append(getBusStopName(stop));
                                                }
                                                result.append("\n");
                                            }
                                        }
                                    }
                                }
                            }
                            result.append("\n");
                        }
                        tv.setText(result.toString());
                    } else {
                        tv.setText("未找到公交路线方案");
                    }
                }

                @Override
                public void onBizError(int status, String msg, String traceId) {
                    tv.setText("公交路线规划失败: " + msg + "\n追踪ID: " + traceId);
                }

                @Override
                public void onFailure(Exception e) {
                    tv.setText("公交路线规划异常: " + e.getMessage());
                }

                // 辅助方法：格式化费用
                private String formatCost(Integer cost) {
                    return cost != null ? (cost / 100.0) + "元" : "免费";
                }

                // 辅助方法：格式化时间
                private String formatDuration(Integer seconds) {
                    if (seconds == null) return "0分钟";
                    int minutes = seconds / 60;
                    return minutes + "分钟";
                }

                // 辅助方法：获取公交类型名称
                private String getBusType(Integer type) {
                    if (type == null) return "未知";
                    switch (type) {
                        case 0: return "公交";
                        case 1: return "地铁";
                        case 2: return "步行";
                        default: return "未知";
                    }
                }

                // 辅助方法：获取站点名称
                private String getBusStopName(BusRouteResponse.BusStop stop) {
                    return stop != null && stop.name != null ? stop.name : "未知站点";
                }
            });
        });
    }
}