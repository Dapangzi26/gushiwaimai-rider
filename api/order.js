/**
 * 订单相关 API
 */
import { get, post } from '../utils/request.js'

/**
 * 获取骑手工作台订单（派单模式下返回我的订单）
 */
export function getAvailableOrders(params = {}) {
  return get('/order/available', params)
}

/**
 * 获取我的配送订单
 * @param {object} params - 查询参数
 */
export function getRiderOrders(params = {}, options = {}) {
  return get('/order/rider-orders', params, options)
}

export function acceptTakeoutOrder(orderId) {
  return post('/order/accept-takeout', { order_id: orderId })
}

/**
 * 获取骑手今日统计
 */
export function getRiderTodaySummary(params = {}, options = {}) {
  return get('/rider/today-summary', params, options)
}

/**
 * 获取订单详情
 */
export function getOrderDetail(id) {
  return get('/order/detail/' + id)
}

export function getTransferStationmasters(params = {}) {
  return get('/order/transfer/stationmasters', params)
}

export function submitOrderTransfer(data = {}) {
  return post('/order/transfer/to-stationmaster', data)
}

export function revokeOrderTransfer(orderId) {
  return post('/order/transfer/revoke', { order_id: orderId })
}

export function getTransferTownRiders(params = {}) {
  return get('/order/transfer/town-riders', params)
}

export function submitOrderTransferToTownRider(data = {}) {
  return post('/order/transfer/to-town-rider', data)
}

/**
 * 标准送达：POST /api/order/confirm-delivery
 */
export function confirmDelivery(orderId) {
  return post('/order/confirm-delivery', { order_id: orderId })
}

export function riderPickup(orderId) {
  return post('/rider/order/pickup', { order_id: orderId })
}

/**
 * 特殊完结：POST /api/order/confirm-delivery-special
 */
export function confirmDeliverySpecial(orderId) {
  return post('/order/confirm-delivery-special', { order_id: orderId })
}

/**
 * 更新骑手状态
 */
export function updateRiderStatus(status) {
  return post('/order/rider-status', { status: status })
}

export function startMerchantSelfDelivery(orderId) {
  return post('/order/deliver', { order_id: orderId })
}

export function confirmMerchantSelfDelivery(orderId) {
  return post('/order/merchant-confirm-delivery', { order_id: orderId })
}
