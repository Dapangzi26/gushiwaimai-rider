# 腾讯原生测试插件接入说明

当前项目里已经存在腾讯官方 demo 工程，可作为第一轮原生测试插件的直接参考来源：

- `android-all-in-one-demo/app/src/main/java/com/example/sdk_demo_y/MyApplication.java`
- `android-all-in-one-demo/navigation_sdk/src/main/java/com/example/navigation_sdk/NavigationActivity.java`
- `android-all-in-one-demo/search_sdk/src/main/java/com/example/search_sdk/RoutePlanningActivity.java`

## 当前已经完成

- 已建立 `sdk/tencent-nav` 测试模块。
- 已建立腾讯测试页。
- 已建立 JS 侧原生桥接检测逻辑。
- 已创建 `nativeplugins/TencentNaviModule` 本地插件目录与 `package.json`。
- 已在 `manifest.json` 注册 `TencentNaviModule`。
- 已生成第一版 `TencentNaviModule-release.aar`，当前可用于原生测试壳验证。

## 当前还没完成

- 腾讯导航 AAR、地图/定位/导航隐私初始化还没并入 uni-app 原生插件链路。

## 当前新增事实

- 项目已明确放弃滴滴，本地插件与旧滴滴 SDK 骨架需要移出打包链。
- 仓库里还没有腾讯地图/导航/定位正式 `aar` 资源。
- 因此第一版只能先做 `JS -> 原生插件 -> 原生 Activity -> 回调` 的测试壳。
- 当前测试壳只验证参数传递与原生拉起，不代表正式腾讯地图已经接通。

## 下一步最小目标

1. 在真机重打包后确认测试页能检测到 `TencentNaviModule`。
2. 确认测试页点击后能真实拉起原生 Activity。
3. 补齐腾讯地图/定位/导航正式 `aar` 与初始化链路。
4. 最后才考虑切正式业务页。
