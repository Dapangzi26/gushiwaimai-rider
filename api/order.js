/**
 * 订单相关 API
 */
import { get, post } from '../utils/request.js'

// 这个 Map 专门给 `getRiderOrders(获取骑手订单)` 做“静默请求并发去重”。
// 原因是首页、地图、提醒中心这几条链路都会悄悄打同一个接口，
// 如果它们刚好在同一瞬间一起发，就会把同一份数据重复请求好几次。
// 这里不去碰前台可见的主动刷新，只收口后台/静默场景，尽量既减压又不影响用户操作手感。
const pendingSilentRiderOrdersRequests = new Map()

function buildRiderOrdersDedupeKey(params = {}) {
  return JSON.stringify(params || {})
}

function shouldDedupeSilentRiderOrders(options = {}) {
  return !!(
    options.background
    || options.silent
    || options.suppressToast
    || options.suppressAuthToast
    || options.suppressErrorToast
  )
}

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
  // 这里只对后台/静默请求做并发复用。
  // 如果是用户主动进入列表页、手动刷新这类前台请求，仍然保持原来的直连行为，
  // 避免把“该提示用户的错误”也一起吞掉。
  if (!shouldDedupeSilentRiderOrders(options)) {
    return get('/order/rider-orders', params, options)
  }

  const dedupeKey = buildRiderOrdersDedupeKey(params)
  if (pendingSilentRiderOrdersRequests.has(dedupeKey)) {
    return pendingSilentRiderOrdersRequests.get(dedupeKey)
  }

  const requestPromise = get('/order/rider-orders', params, options)
    .finally(() => {
      pendingSilentRiderOrdersRequests.delete(dedupeKey)
    })

  pendingSilentRiderOrdersRequests.set(dedupeKey, requestPromise)
  return requestPromise
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
