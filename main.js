// ==================== APP 入口文件 ====================
// 作用：创建 Vue 应用实例，启动整个骑手端 APP
// 注意：这个文件一般不需要修改

import App from './App'                           // 导入根组件
import { createSSRApp } from 'vue'                // 从 Vue 导入创建应用的方法

// 创建 APP 实例的函数
export function createApp() {
  const app = createSSRApp(App)                   // 创建 Vue 应用
  return { app }                                  // 返回应用实例
}
