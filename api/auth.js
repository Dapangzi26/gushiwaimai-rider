/**
 * ==================== 登录认证相关接口 ====================
 * 作用：处理骑手的登录、注册、获取个人信息等
 */

import { post, get, put } from '@/utils/request.js'

/**
 * 骑手登录
 * @param {object} data - 登录信息（手机号、密码等）
 */
export function login(data) {
  return post('/auth/login', {
    ...data,
    login_scene: 'rider_app'
  })
}

/**
 * 骑手注册
 * @param {object} data - 注册信息（手机号、密码、姓名等）
 */
export function registerRider(data) {
  return post('/auth/register/rider', data)
}

/**
 * 解析商家绑定ID
 * @param {object} data - { merchant_binding_code }
 */
export function resolveMerchantBinding(data) {
  return post('/auth/merchant-binding/resolve', data)
}

/**
 * 获取当前登录用户的信息
 * 用途：APP启动时检查登录状态
 */
export function getCurrentUser() {
  return get('/auth/me')
}

/**
 * 更新个人资料
 * @param {object} data - 要修改的信息
 */
export function updateProfile(data) {
  return put('/auth/profile', data)
}

/**
 * 更新骑手在线状态（休息/接单中）
 * @param {object} data - { status: 0或1 }
 */
export function updateRiderStatus(data) {
  return post('/order/rider-status', data)
}
