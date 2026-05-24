/**
 * ==================== 全局配置文件 ====================
 * 作用：存放 APP 的全局设置，如服务器地址、状态定义等
 * 修改后需要重新编译 APP 才能生效
 */

// -------------------- 服务器地址 --------------------
// 这是后端 API 的地址，所有数据都从这个地址获取
export const BASE_URL = 'http://121.43.190.218:3000'

// -------------------- 骑手状态 --------------------
export const RIDER = {
  STATUS_OFFLINE: 0,  // 0 = 休息中（不接单）
  STATUS_ONLINE: 1    // 1 = 接单中（可以抢单）
}

// -------------------- 外卖订单状态 --------------------
// 每个数字代表订单的不同阶段，用于显示不同的文字和颜色
export const ORDER_STATUS = {
  0: { text: '待支付', color: '#FF6B35' },    // 顾客还没付款
  1: { text: '待接单', color: '#1890FF' },    // 等待骑手接单
  2: { text: '已接单', color: '#FAAD14' },    // 骑手已接单
  3: { text: '备货中', color: '#FAAD14' },    // 商家正在准备
  4: { text: '备货完成', color: '#2F54EB' },  // 商家已准备好
  5: { text: '配送中', color: '#52C41A' },    // 骑手正在送餐
  6: { text: '已完成', color: '#52C41A' },    // 订单已完成
  7: { text: '已取消', color: '#999' }        // 订单已取消
}

// -------------------- 订单操作判断函数 --------------------

/**
 * 判断：是否显示「确认送达」按钮
 * 条件：订单状态在 2~5 之间（已接单~配送中）
 */
export function canRiderShowConfirmDelivery(status) {
  const s = Number(status)
  return s >= 2 && s <= 5
}

/**
 * 判断：是否可以真正调用「确认送达」API
 * 条件：只有状态=5（配送中）才能点击送达
 */
export function canRiderCallConfirmDeliveryApi(status) {
  return Number(status) === 5
}

/**
 * 判断：是否显示「特殊完结」按钮
 * 条件：订单状态在 2~4 之间（已接单~备货完成）
 * 用途：用于异常情况直接结束订单
 */
export function canRiderOfferSpecialComplete(status) {
  const s = Number(status)
  return s >= 2 && s <= 4
}

// -------------------- 跑腿订单状态 --------------------
export const ERRAND_STATUS = {
  0: { text: '待支付', color: '#FF6B35' },   // 顾客还没付款
  1: { text: '待接单', color: '#1890FF' },   // 等待骑手接单
  5: { text: '配送中', color: '#52C41A' },   // 骑手正在配送
  6: { text: '已完成', color: '#52C41A' },   // 订单已完成
  7: { text: '已取消', color: '#999' }       // 订单已取消
}

export default {
  BASE_URL,
  RIDER,
  ORDER_STATUS,
  canRiderShowConfirmDelivery,
  canRiderCallConfirmDeliveryApi,
  canRiderOfferSpecialComplete,
  ERRAND_STATUS
}
