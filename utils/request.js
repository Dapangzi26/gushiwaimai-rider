/**
 * 网络请求封装
 * - 自动携带 token
 * - 支持静默后台请求
 * - 统一鉴权退出
 */

import { BASE_URL } from '../config/index.js'
import { clearRiderSession } from './storage.js'

const API_BASE_URL = BASE_URL + '/api'
let logoutInProgress = false
const DEBUG_SERVER_URL = 'http://198.18.0.1:7777/event'
const DEBUG_SESSION_ID = 'rider-random-logout'
const ENABLE_DEBUG_EVENT_REPORT = false

function reportRequestDebug(hypothesisId, location, msg, data = {}) {
  if (!ENABLE_DEBUG_EVENT_REPORT) {
    return
  }
  // #region debug-point A:request-auth
  uni.request({
    url: DEBUG_SERVER_URL,
    method: 'POST',
    data: {
      sessionId: DEBUG_SESSION_ID,
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now()
    },
    header: { 'Content-Type': 'application/json' },
    fail: () => {}
  })
  // #endregion
}

function normalizeRoute(route = '') {
  if (!route) {
    return ''
  }
  return route.startsWith('/') ? route : `/${route}`
}

function getCurrentRoutePath() {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const currentPage = Array.isArray(pages) && pages.length ? pages[pages.length - 1] : null
    return normalizeRoute(currentPage?.route || '')
  } catch (error) {
    return ''
  }
}

function isLoginRoute() {
  return getCurrentRoutePath() === '/pages/login/index'
}

function showToast(title) {
  const safeTitle = String(title || '').trim()
  if (!safeTitle) {
    return
  }
  uni.showToast({ title: safeTitle, icon: 'none', duration: 2000 })
}

function notifySessionCleared() {
  if (typeof getApp !== 'function') {
    return
  }
  try {
    const app = getApp()
    const hook = app?.globalData?.clearRiderSessionState
    if (typeof hook === 'function') {
      hook()
    }
  } catch (error) {}
}

function logoutOnce({ toastMessage = '', suppressToast = false } = {}) {
  if (logoutInProgress) {
    reportRequestDebug('A', 'utils/request.js:74', 'logoutOnce skipped because guard is active', {
      toastMessage,
      suppressToast,
      currentRoute: getCurrentRoutePath(),
      hasToken: !!(uni.getStorageSync('token') || '')
    })
    return
  }

  reportRequestDebug('A', 'utils/request.js:84', 'logoutOnce triggered', {
    toastMessage,
    suppressToast,
    currentRoute: getCurrentRoutePath(),
    hasToken: !!(uni.getStorageSync('token') || '')
  })
  logoutInProgress = true
  clearRiderSession()
  notifySessionCleared()

  if (!suppressToast && !isLoginRoute()) {
    showToast(toastMessage || '登录已失效，请重新登录')
  }

  if (!isLoginRoute()) {
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 0)
  }

  setTimeout(() => {
    logoutInProgress = false
  }, 1500)
}

export function resetLogoutGuard() {
  logoutInProgress = false
}

function request({
  url,
  method = 'GET',
  data = {},
  timeout = 30000,
  silent = false,
  background = false,
  suppressToast = false,
  suppressAuthToast = false,
  suppressErrorToast = false,
  skipAuthLogout = false
}) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || ''
    const muteAllToast = silent || background || suppressToast
    const muteAuthToast = muteAllToast || suppressAuthToast
    const muteErrorToast = muteAllToast || suppressErrorToast

    uni.request({
      url: API_BASE_URL + url,
      method,
      data,
      timeout,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        const responseData = res.data || {}
        const msg = responseData?.msg || responseData?.message || responseData?.detail || '请求失败'

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData)
          return
        }

        if (res.statusCode === 401) {
          reportRequestDebug('A', 'utils/request.js:140', 'request received 401', {
            url,
            method,
            hasToken: !!token,
            skipAuthLogout,
            background,
            silent,
            message: msg,
            currentRoute: getCurrentRoutePath()
          })
          if (token && !skipAuthLogout) {
            logoutOnce({
              toastMessage: msg || '登录已失效，请重新登录',
              suppressToast: muteAuthToast
            })
            reject({ code: 401, msg: msg || '请先登录' })
            return
          }

          if (!muteAuthToast) {
            showToast(msg || '请先登录')
          }
          reject({ code: 401, msg: msg || '请先登录' })
          return
        }

        if (res.statusCode === 403) {
          reportRequestDebug('A', 'utils/request.js:166', 'request received 403', {
            url,
            method,
            hasToken: !!token,
            background,
            silent,
            message: msg,
            currentRoute: getCurrentRoutePath()
          })
          if (!muteAuthToast) {
            showToast(msg || '没有权限访问')
          }
          reject({ code: 403, msg: msg || '没有权限访问' })
          return
        }

        if (!muteErrorToast) {
          showToast(msg)
        }
        reject({ code: res.statusCode, msg })
      },
      fail: (err) => {
        console.error('网络请求失败:', err)
        if (!muteErrorToast) {
          showToast('网络错误，请检查网络')
        }
        reject({ code: 500, msg: '网络错误' })
      }
    })
  })
}

export function get(url, data, options = {}) {
  return request({ url, method: 'GET', data, ...options })
}

export function post(url, data, options = {}) {
  return request({ url, method: 'POST', data, ...options })
}

export function put(url, data, options = {}) {
  return request({ url, method: 'PUT', data, ...options })
}

export function del(url, data, options = {}) {
  return request({ url, method: 'DELETE', data, ...options })
}

export default request
