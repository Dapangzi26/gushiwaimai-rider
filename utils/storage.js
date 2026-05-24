/**
 * 本地存储封装
 */

const STORAGE_KEY = {
  TOKEN: 'token',
  USER_INFO: 'userInfo',
  RIDER_STATUS: 'riderStatus'
}

const DEBUG_SERVER_URL = 'http://198.18.0.1:7777/event'
const DEBUG_SESSION_ID = 'rider-random-logout'
const ENABLE_DEBUG_EVENT_REPORT = false

function reportStorageDebug(hypothesisId, location, msg, data = {}) {
  if (!ENABLE_DEBUG_EVENT_REPORT) {
    return
  }
  // #region debug-point F:storage-session
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

export function setToken(token) {
  uni.setStorageSync(STORAGE_KEY.TOKEN, token)
}

export function getToken() {
  return uni.getStorageSync(STORAGE_KEY.TOKEN) || ''
}

export function removeToken() {
  reportStorageDebug('F', 'utils/storage.js:39', 'removeToken called', {
    hasTokenBefore: !!(uni.getStorageSync(STORAGE_KEY.TOKEN) || '')
  })
  uni.removeStorageSync(STORAGE_KEY.TOKEN)
}

export function setUserInfo(userInfo) {
  uni.setStorageSync(STORAGE_KEY.USER_INFO, JSON.stringify(userInfo))
}

export function getUserInfo() {
  const str = uni.getStorageSync(STORAGE_KEY.USER_INFO)
  if (!str) {
    return null
  }
  try {
    return JSON.parse(str)
  } catch (error) {
    reportStorageDebug('F', 'utils/storage.js:55', 'userInfo cache parse failed and will be removed', {
      rawLength: String(str || '').length
    })
    console.warn('userInfo 缓存解析失败，已清理本地缓存', error)
    uni.removeStorageSync(STORAGE_KEY.USER_INFO)
    return null
  }
}

export function removeUserInfo() {
  reportStorageDebug('F', 'utils/storage.js:64', 'removeUserInfo called', {
    hasUserInfoBefore: !!uni.getStorageSync(STORAGE_KEY.USER_INFO)
  })
  uni.removeStorageSync(STORAGE_KEY.USER_INFO)
}

export function setRiderStatus(status) {
  uni.setStorageSync(STORAGE_KEY.RIDER_STATUS, status)
}

export function getRiderStatus() {
  return uni.getStorageSync(STORAGE_KEY.RIDER_STATUS) || 0
}

export function removeRiderStatus() {
  reportStorageDebug('F', 'utils/storage.js:78', 'removeRiderStatus called', {
    hadStatusBefore: uni.getStorageSync(STORAGE_KEY.RIDER_STATUS)
  })
  uni.removeStorageSync(STORAGE_KEY.RIDER_STATUS)
}

export function clearRiderSession() {
  reportStorageDebug('F', 'utils/storage.js:84', 'clearRiderSession called', {
    hasTokenBefore: !!(uni.getStorageSync(STORAGE_KEY.TOKEN) || ''),
    hasUserInfoBefore: !!uni.getStorageSync(STORAGE_KEY.USER_INFO),
    riderStatusBefore: uni.getStorageSync(STORAGE_KEY.RIDER_STATUS) || 0
  })
  removeToken()
  removeUserInfo()
  removeRiderStatus()
}

export function clearAll() {
  uni.clearStorageSync()
}
