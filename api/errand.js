/**
 * 跑腿订单 API
 */
import { get, post } from '@/utils/request.js'

/**
 * 获取跑腿订单列表
 */
export function getErrandList(params = {}, options = {}) {
  return get('/order/errand/list', params, options)
}

/**
 * 获取跑腿订单详情
 */
export function getErrandDetail(id) {
  return get(`/order/detail/${id}`)
}

/**
 * 接跑腿订单
 */
export function acceptErrand(data) {
  return post('/order/errand/accept', data)
}

/**
 * 完成跑腿订单
 */
export function completeErrand(data) {
  return post('/order/errand/complete', data)
}
