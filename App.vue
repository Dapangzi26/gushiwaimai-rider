<script>
// 这个文件是骑手端 App 的全局入口。
// 这里统一处理登录会话、Socket 提醒中心、后台位置上报等全局任务；
// 改这里会影响整个骑手端，所以位置上报这类后台任务要尽量稳，不能频繁打断前台接单流程。
import { get, post } from '@/utils/request.js'
import { wgs84ToGcj02 } from '@/utils/coord-transform.js'
import { initReminderCenter, setReminderAppVisibility, stopReminderCenter, syncReminderCenterSession } from '@/utils/reminder-center.js'
import { isCountyRider, isRiderAppUser } from '@/utils/rider-auth.js'
import { canReportDispatchLocationByProfile } from '@/utils/delivery-identity.js'
import { clearRiderSession, getToken, getUserInfo as getStoredUserInfo, setRiderStatus, setUserInfo } from '@/utils/storage.js'

let locationTimer = null
let locationPermissionPrompted = false
let lastLocationSample = null
let locationReportInFlight = false
let locationKickoffTimer = null
let navigationLocationReportingActive = false
let gcj02Unsupported = false
let locationHintToastUntil = 0
let locationTimeoutLogUntil = 0
let lastHighAccuracyLocationTs = 0
let sessionValidationPromise = null
let validatedSessionToken = ''
let validatedSessionUserId = ''
let validatedSessionUser = null
const DEBUG_SERVER_URL = 'http://198.18.0.1:7777/event'
const DEBUG_SESSION_ID = 'rider-random-logout'
const ENABLE_DEBUG_EVENT_REPORT = false
const LOCATION_DEBUG_SERVER_URL = 'http://192.168.1.9:7777/event'
const LOCATION_DEBUG_SESSION_ID = 'station-location-timeout'
const ENABLE_LOCATION_DEBUG_REPORT = false
// 后台位置上报间隔。
// 这里设成 20 秒，是为了减少手机高频定位导致的超时和耗电；
// 调度台仍能看到骑手大概位置，接单和订单提醒不依赖这个秒级刷新。
const LOCATION_REPORT_INTERVAL_MS = 20000
const LOCATION_HIGH_ACCURACY_REFRESH_MS = 60000
const LOCATION_TIMEOUT_LOG_INTERVAL_MS = 60000

function reportSessionDebug(hypothesisId, location, msg, data = {}) {
  if (!ENABLE_DEBUG_EVENT_REPORT) {
    return
  }
  // #region debug-point B:app-session
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

function reportLocationDebug(hypothesisId, location, msg, data = {}) {
  if (!ENABLE_LOCATION_DEBUG_REPORT) {
    return
  }
  // #region debug-point A:station-location-timeout
  uni.request({
    url: LOCATION_DEBUG_SERVER_URL,
    method: 'POST',
    data: {
      sessionId: LOCATION_DEBUG_SESSION_ID,
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

function canReportDispatchLocation(userInfo = {}) {
  return canReportDispatchLocationByProfile(userInfo)
}

function shouldPauseBackgroundLocationReport(userInfo = {}, navigationActive = false) {
  if (!navigationActive) {
    return false
  }
  return !isCountyRider(userInfo)
}

function normalizeRoute(route = '') {
  if (!route) {
    return ''
  }
  return route.startsWith('/') ? route : `/${route}`
}

function getUserId(userInfo = {}) {
  const rawId = userInfo.id ?? userInfo.user_id ?? userInfo.userId ?? ''
  return rawId === null || typeof rawId === 'undefined' ? '' : String(rawId)
}

function requestUniLocation(type = 'wgs84', extraOptions = {}) {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type,
      isHighAccuracy: true,
      highAccuracyExpireTime: 10000,
      geocode: false,
      ...extraOptions,
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    })
  })
}

function shouldRefreshHighAccuracyLocation() {
  if (!hasFreshLocationSample(lastLocationSample, 30000)) {
    return true
  }
  return Date.now() - lastHighAccuracyLocationTs >= LOCATION_HIGH_ACCURACY_REFRESH_MS
}

function shouldLogLocationTimeout() {
  if (Date.now() < locationTimeoutLogUntil) {
    return false
  }
  locationTimeoutLogUntil = Date.now() + LOCATION_TIMEOUT_LOG_INTERVAL_MS
  return true
}

function isGcj02NotSupportedError(error) {
  const errMsg = String(error?.errMsg || error?.message || '')
  return errMsg.includes('not support gcj02')
}

function normalizeReportLocation(res, requestTs, coordinateType = 'gcj02', source = coordinateType) {
  const latitude = Number(res?.latitude)
  const longitude = Number(res?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  let normalizedLng = longitude
  let normalizedLat = latitude
  if (coordinateType === 'wgs84') {
    const converted = wgs84ToGcj02(longitude, latitude)
    normalizedLng = converted.lng
    normalizedLat = converted.lat
  }
  if (!Number.isFinite(normalizedLat) || !Number.isFinite(normalizedLng)) {
    return null
  }
  return {
    latitude: normalizedLat,
    longitude: normalizedLng,
    accuracy: Number.isFinite(Number(res?.accuracy)) ? Number(res.accuracy) : null,
    altitude: Number.isFinite(Number(res?.altitude)) ? Number(res.altitude) : null,
    speed: Number.isFinite(Number(res?.speed)) ? Number(res.speed) : null,
    provider: res?.provider || res?.verticalAccuracy || source || 'unknown',
    ts: requestTs,
    locationSource: source
  }
}

function isNearlySameLocation(current = {}, previous = {}) {
  const latDiff = Math.abs(Number(current.latitude || 0) - Number(previous.latitude || 0))
  const lngDiff = Math.abs(Number(current.longitude || 0) - Number(previous.longitude || 0))
  return latDiff + lngDiff <= 0.00001
}

function hasFreshLocationSample(sample = {}, maxAgeMs = 120000) {
  const sampleTs = Number(sample?.ts || 0)
  if (!sampleTs) {
    return false
  }
  if (!Number.isFinite(Number(sample?.latitude)) || !Number.isFinite(Number(sample?.longitude))) {
    return false
  }
  return Date.now() - sampleTs <= maxAgeMs
}

function buildLocationFailureMeta(error) {
  const errMsg = String(error?.errMsg || error?.message || '')
  const lower = errMsg.toLowerCase()

  if (lower.includes('position retrieval timed out') || lower.includes('timeout')) {
    return {
      type: 'timeout',
      text: '定位超时',
      detail: '手机长时间没有拿到 GPS 位置，未执行位置上报'
    }
  }

  if (lower.includes('auth deny') || lower.includes('authorize no response') || lower.includes('auth denied')) {
    return {
      type: 'permission',
      text: '定位权限未开启',
      detail: '需要开启定位权限，县城司机才能出现在调度地图'
    }
  }

  if (lower.includes('system permission denied') || lower.includes('location service is disabled') || lower.includes('system location')) {
    return {
      type: 'service_disabled',
      text: '系统定位未开启',
      detail: '手机系统定位服务未开启，未执行位置上报'
    }
  }

  return {
    type: 'unknown',
    text: '定位失败',
    detail: errMsg || '未知原因，未执行位置上报'
  }
}

export default {
  globalData: {},
  onLaunch() {
    console.log('App Launch - 骑手端启动')
    reportSessionDebug('B', 'App.vue:157', 'app launch lifecycle entered', {
      hasToken: !!getToken(),
      hasUserInfo: !!getStoredUserInfo(),
      currentRoute: this.getCurrentRoutePath()
    })
    initReminderCenter()
    this.registerGlobalActions()
    setReminderAppVisibility(true)
    this.handleAppVisible('launch')
  },
  onShow() {
    console.log('App Show - 骑手端显示')
    reportSessionDebug('B', 'App.vue:164', 'app show lifecycle entered', {
      hasToken: !!getToken(),
      hasUserInfo: !!getStoredUserInfo(),
      currentRoute: this.getCurrentRoutePath()
    })
    this.registerGlobalActions()
    setReminderAppVisibility(true)
    this.handleAppVisible('show')
  },
  onHide() {
    console.log('App Hide - 骑手端隐藏')
    reportSessionDebug('B', 'App.vue:170', 'app hide lifecycle entered', {
      hasToken: !!getToken(),
      hasUserInfo: !!getStoredUserInfo(),
      currentRoute: this.getCurrentRoutePath()
    })
    setReminderAppVisibility(false)
    this.stopLocationReport()
  },
  methods: {
    registerGlobalActions() {
      if (!this.globalData) {
        this.globalData = {}
      }
      this.globalData.latestRiderLocation = lastLocationSample ? { ...lastLocationSample } : null
      this.globalData.refreshRiderSession = async (forceValidation = false) => {
        return this.refreshBackgroundJobs(forceValidation, 'external')
      }
      this.globalData.clearRiderSessionState = () => {
        this.resetValidatedSession('登录态已清理')
        this.stopAllBackgroundJobs()
      }
      this.globalData.setNavigationLocationReportingActive = (active = false) => {
        navigationLocationReportingActive = !!active
        const storedUser = getStoredUserInfo() || {}
        if (shouldPauseBackgroundLocationReport(storedUser, navigationLocationReportingActive)) {
          this.stopLocationReport()
          return
        }
        this.refreshBackgroundJobs(false, 'nav-location-reporting-changed')
      }
      this.globalData.getLatestRiderLocation = () => {
        return lastLocationSample ? { ...lastLocationSample } : null
      }
    },
    getCurrentRoutePath() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const currentPage = Array.isArray(pages) && pages.length ? pages[pages.length - 1] : null
        return normalizeRoute(currentPage?.route || '')
      } catch (error) {
        return ''
      }
    },
    isBootingOrLoginPage() {
      const route = this.getCurrentRoutePath()
      return !route || route === '/pages/login/index'
    },
    isNavigationLocationReportingActive() {
      return navigationLocationReportingActive || this.getCurrentRoutePath() === '/pages/map/nav'
    },
    shouldPauseLocationReportForNavigation(userInfo = getStoredUserInfo() || {}) {
      return shouldPauseBackgroundLocationReport(userInfo, this.isNavigationLocationReportingActive())
    },
    getLocalSessionSnapshot() {
      return {
        token: getToken(),
        userInfo: getStoredUserInfo()
      }
    },
    resetValidatedSession(reason = '') {
      if (reason) {
        console.log('重置骑手端会话校验状态:', reason)
      }
      sessionValidationPromise = null
      validatedSessionToken = ''
      validatedSessionUserId = ''
      validatedSessionUser = null
    },
    hasLocalRiderSession(snapshot = this.getLocalSessionSnapshot()) {
      return !!snapshot.token && !!snapshot.userInfo && isRiderAppUser(snapshot.userInfo)
    },
    hasValidatedRiderSession(snapshot = this.getLocalSessionSnapshot()) {
      if (!this.hasLocalRiderSession(snapshot)) {
        return false
      }
      if (!validatedSessionToken || !validatedSessionUser || !isRiderAppUser(validatedSessionUser)) {
        return false
      }
      if (validatedSessionToken !== snapshot.token) {
        return false
      }
      const localUserId = getUserId(snapshot.userInfo)
      if (localUserId && validatedSessionUserId && localUserId !== validatedSessionUserId) {
        return false
      }
      return true
    },
    canStartBackgroundJobs() {
      if (this.isBootingOrLoginPage()) {
        return false
      }
      return this.hasValidatedRiderSession()
    },
    async handleAppVisible(source = 'show') {
      await this.refreshBackgroundJobs(false, source)
    },
    async refreshBackgroundJobs(forceValidation = false, source = 'manual') {
      const snapshot = this.getLocalSessionSnapshot()
      reportSessionDebug('B', 'App.vue:262', 'refreshBackgroundJobs start', {
        source,
        forceValidation,
        hasToken: !!snapshot.token,
        hasUserInfo: !!snapshot.userInfo,
        isRiderUser: !!(snapshot.userInfo && isRiderAppUser(snapshot.userInfo)),
        currentRoute: this.getCurrentRoutePath()
      })

      if (snapshot.token && (!snapshot.userInfo || !isRiderAppUser(snapshot.userInfo))) {
        reportSessionDebug('B', 'App.vue:272', 'local session is invalid before remote validation', {
          source,
          hasToken: !!snapshot.token,
          hasUserInfo: !!snapshot.userInfo,
          isRiderUser: !!(snapshot.userInfo && isRiderAppUser(snapshot.userInfo)),
          currentRoute: this.getCurrentRoutePath()
        })
        this.clearInvalidLocalSession('检测到本地残留的非骑手或损坏登录态', { redirect: !this.isBootingOrLoginPage() })
        return false
      }

      if (this.isBootingOrLoginPage()) {
        console.log(`当前处于启动/登录页，不启动后台任务: ${source}`)
        this.stopAllBackgroundJobs()
        return false
      }

      if (!snapshot.token) {
        reportSessionDebug('C', 'App.vue:289', 'refreshBackgroundJobs stopped because token is missing', {
          source,
          currentRoute: this.getCurrentRoutePath()
        })
        this.resetValidatedSession('本地无 token，不启动后台任务')
        this.stopAllBackgroundJobs()
        return false
      }

      const sessionReady = await this.ensureRiderSessionReady(forceValidation)
      if (!sessionReady || !this.canStartBackgroundJobs()) {
        this.stopAllBackgroundJobs()
        return false
      }

      this.startAuthorizedBackgroundJobs()
      return true
    },
    async ensureRiderSessionReady(forceValidation = false) {
      const snapshot = this.getLocalSessionSnapshot()
      reportSessionDebug('D', 'App.vue:306', 'ensureRiderSessionReady start', {
        forceValidation,
        hasToken: !!snapshot.token,
        hasUserInfo: !!snapshot.userInfo,
        isRiderUser: !!(snapshot.userInfo && isRiderAppUser(snapshot.userInfo)),
        currentRoute: this.getCurrentRoutePath()
      })
      if (!this.hasLocalRiderSession(snapshot)) {
        return false
      }

      if (!forceValidation && this.hasValidatedRiderSession(snapshot)) {
        return true
      }

      if (sessionValidationPromise) {
        return sessionValidationPromise
      }

      sessionValidationPromise = (async () => {
        try {
          const res = await get('/auth/me', {}, {
            background: true,
            silent: true,
            suppressAuthToast: true,
            suppressErrorToast: true
          })
          const remoteUser = res?.data || null
          reportSessionDebug('D', 'App.vue:329', 'auth/me returned', {
            hasRemoteUser: !!remoteUser,
            remoteRole: remoteUser?.role || '',
            remoteUserId: getUserId(remoteUser),
            deliveryScope: remoteUser?.delivery_scope || '',
            riderKind: remoteUser?.rider_kind || ''
          })
          if (!remoteUser || !isRiderAppUser(remoteUser)) {
            this.clearInvalidLocalSession('服务端会话校验失败：当前账号不是 rider', { redirect: true })
            return false
          }

          setUserInfo(remoteUser)
          validatedSessionToken = snapshot.token
          validatedSessionUserId = getUserId(remoteUser)
          validatedSessionUser = remoteUser
          console.log('骑手端会话校验通过，允许启动后台任务')
          return true
        } catch (error) {
          const code = Number(error?.code || 0)
          reportSessionDebug('D', 'App.vue:343', 'auth/me validation failed', {
            code,
            message: error?.msg || error?.message || '',
            currentRoute: this.getCurrentRoutePath()
          })
          if (code === 401 || code === 403) {
            this.clearInvalidLocalSession(`服务端会话校验失败，状态码: ${code}`, { redirect: !this.isBootingOrLoginPage() })
            return false
          }
          console.error('骑手端会话校验失败，暂不启动后台任务', error)
          this.resetValidatedSession('会话校验未通过')
          return false
        } finally {
          sessionValidationPromise = null
        }
      })()

      return sessionValidationPromise
    },
    clearInvalidLocalSession(reason, { redirect = false } = {}) {
      reportSessionDebug('E', 'App.vue:359', 'clearInvalidLocalSession called', {
        reason,
        redirect,
        currentRoute: this.getCurrentRoutePath(),
        hasToken: !!getToken(),
        hasUserInfo: !!getStoredUserInfo()
      })
      console.warn(reason)
      clearRiderSession()
      this.resetValidatedSession(reason)
      this.stopAllBackgroundJobs()
      if (redirect && !this.isBootingOrLoginPage()) {
        uni.reLaunch({ url: '/pages/login/index' })
      }
    },
    startAuthorizedBackgroundJobs() {
      this.startLocationReport()
      this.syncCountyDriverOnlineStatus()
      this.syncReminderCenterState()
    },
    stopAllBackgroundJobs() {
      this.stopLocationReport()
      stopReminderCenter()
    },
    syncReminderCenterState() {
      const snapshot = this.getLocalSessionSnapshot()
      const userInfo = validatedSessionUser || snapshot.userInfo || getStoredUserInfo() || null
      syncReminderCenterSession({
        token: snapshot.token,
        userInfo
      })
    },
    startLocationReport() {
      if (!this.canStartBackgroundJobs()) {
        this.stopLocationReport()
        reportLocationDebug('A', 'App.vue:startLocationReport:not-ready', '位置上报未启动，会话未就绪', {
          route: getCurrentPages().slice(-1)[0]?.route || ''
        })
        console.log('会话未就绪，不启动位置上报')
        return
      }

      const storedUser = getStoredUserInfo() || {}
      reportLocationDebug('C', 'App.vue:startLocationReport:entry', '进入位置上报启动判定', {
        role: storedUser.role || '',
        delivery_scope: storedUser.delivery_scope || '',
        rider_kind: storedUser.rider_kind || '',
        user_id: getUserId(storedUser),
        can_report: canReportDispatchLocation(storedUser),
        navigation_reporting_active: navigationLocationReportingActive
      })
      if (!canReportDispatchLocation(storedUser)) {
        this.stopLocationReport()
        reportLocationDebug('C', 'App.vue:startLocationReport:skip-role', '当前账号不属于定位上报角色', {
          role: storedUser.role || '',
          delivery_scope: storedUser.delivery_scope || '',
          rider_kind: storedUser.rider_kind || '',
          user_id: getUserId(storedUser)
        })
        console.log('当前账号不属于调度定位上报角色，不启动位置上报')
        return
      }
      if (this.shouldPauseLocationReportForNavigation(storedUser)) {
        this.stopLocationReport()
        reportLocationDebug('A', 'App.vue:startLocationReport:paused-nav', '导航态暂停后台位置上报', {
          role: storedUser.role || '',
          delivery_scope: storedUser.delivery_scope || '',
          rider_kind: storedUser.rider_kind || '',
          user_id: getUserId(storedUser)
        })
        console.log('当前处于导航态，后台位置上报让位暂停')
        return
      }
      if (locationTimer) {
        return
      }

      reportLocationDebug('A', 'App.vue:startLocationReport:started', '位置上报定时器已启动', {
        interval_ms: LOCATION_REPORT_INTERVAL_MS,
        role: storedUser.role || '',
        delivery_scope: storedUser.delivery_scope || '',
        rider_kind: storedUser.rider_kind || '',
        user_id: getUserId(storedUser)
      })
      console.log('启动位置上报定时器，间隔 ' + LOCATION_REPORT_INTERVAL_MS / 1000 + ' 秒')
      locationTimer = setInterval(() => {
        const latestUser = getStoredUserInfo() || {}
        if (
          !this.canStartBackgroundJobs() ||
          !canReportDispatchLocation(latestUser) ||
          this.shouldPauseLocationReportForNavigation(latestUser)
        ) {
          this.stopLocationReport()
          return
        }
        this.doReportLocation()
      }, LOCATION_REPORT_INTERVAL_MS)
      if (locationKickoffTimer) {
        clearTimeout(locationKickoffTimer)
        locationKickoffTimer = null
      }
      const latestUser = getStoredUserInfo() || {}
      if (
        this.canStartBackgroundJobs() &&
        canReportDispatchLocation(latestUser) &&
        !this.shouldPauseLocationReportForNavigation(latestUser) &&
        !hasFreshLocationSample(lastLocationSample, 60000)
      ) {
        this.doReportLocation()
      }
    },
    stopLocationReport() {
      if (locationKickoffTimer) {
        clearTimeout(locationKickoffTimer)
        locationKickoffTimer = null
      }
      if (locationTimer) {
        clearInterval(locationTimer)
        locationTimer = null
        console.log('位置上报定时器已停止')
      }
      locationReportInFlight = false
    },
    async reportLocationSample(sample = null) {
      if (!sample || !Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude)) {
        return null
      }
      const payload = {
        latitude: sample.latitude,
        longitude: sample.longitude
      }
      const nearlySameAsLast = !!lastLocationSample && isNearlySameLocation(sample, lastLocationSample)
      if (ENABLE_LOCATION_DEBUG_REPORT) {
        console.log('位置上报请求体:', {
          ...payload,
          timestamp: sample.ts,
          locationSource: sample.locationSource,
          nearlySameAsLast
        })
      }
      lastLocationSample = { ...sample }
      if (this.globalData) {
        this.globalData.latestRiderLocation = { ...sample }
      }
      const reportRes = await post('/rider/location/report', payload, {
        background: true,
        silent: true,
        suppressAuthToast: true,
        suppressErrorToast: true
      }).catch(err => {
        reportLocationDebug('D', 'App.vue:reportLocationSample:report-fail', '位置上报接口失败', {
          errMsg: String(err?.message || err?.errMsg || ''),
          latitude: payload.latitude,
          longitude: payload.longitude,
          locationSource: sample.locationSource || ''
        })
        if (ENABLE_LOCATION_DEBUG_REPORT) {
          console.log('真实位置上报接口失败:', err)
        }
        return null
      })

      if (reportRes?.data?.throttled) {
        reportLocationDebug('D', 'App.vue:reportLocationSample:report-throttled', '位置已获取但后端限频忽略写入', {
          latitude: payload.latitude,
          longitude: payload.longitude,
          rider_location_updated_at: reportRes?.data?.rider_location_updated_at || '',
          locationSource: sample.locationSource || ''
        })
        console.warn('位置已获取，但后端本次限频忽略写入:', {
          latitude: payload.latitude,
          longitude: payload.longitude,
          rider_location_updated_at: reportRes?.data?.rider_location_updated_at || '',
          reason: '位置上报过于频繁，已忽略本次写入',
          locationSource: sample.locationSource || ''
        })
      } else if (reportRes) {
        reportLocationDebug('D', 'App.vue:reportLocationSample:report-ok', '位置已成功提交到后端', {
          latitude: payload.latitude,
          longitude: payload.longitude,
          rider_location_updated_at: reportRes?.data?.rider_location_updated_at || '',
          locationSource: sample.locationSource || ''
        })
        if (ENABLE_LOCATION_DEBUG_REPORT) {
          console.log('位置上报成功，已提交到后端:', {
            latitude: payload.latitude,
            longitude: payload.longitude,
            rider_location_updated_at: reportRes?.data?.rider_location_updated_at || '',
            locationSource: sample.locationSource || ''
          })
        }
      }
      return reportRes
    },
    doReportLocation() {
      const storedUser = getStoredUserInfo() || {}
      if (
        !this.canStartBackgroundJobs() ||
        !canReportDispatchLocation(storedUser) ||
        this.shouldPauseLocationReportForNavigation(storedUser)
      ) {
        this.stopLocationReport()
        return
      }
      if (locationReportInFlight) {
        return
      }

      locationReportInFlight = true
      const requestTs = Date.now()
      ;(async () => {
        try {
          reportLocationDebug('A', 'App.vue:doReportLocation:begin', '开始一次位置上报尝试', {
            role: storedUser.role || '',
            delivery_scope: storedUser.delivery_scope || '',
            rider_kind: storedUser.rider_kind || '',
            user_id: getUserId(storedUser),
            gcj02_unsupported: gcj02Unsupported
          })
          let res = null
          let sample = null
          // 后台位置上报优先用普通精度快速拿点。
          // 这类上报主要给调度台看骑手大概位置，不需要每 10 秒都抢一次高精度 GPS；
          // 高频高精度调用容易和导航页、系统定位服务抢资源，最后就会刷 Position retrieval timed out。
          if (!sample) {
            try {
              reportLocationDebug('B', 'App.vue:doReportLocation:wgs84-low-first', '先用 wgs84 普通精度快速定位', {
                high_accuracy: false,
                high_accuracy_expire_time: 15000
              })
              res = await requestUniLocation('wgs84', {
                isHighAccuracy: false,
                highAccuracyExpireTime: 15000
              })
              sample = normalizeReportLocation(res, requestTs, 'wgs84', 'wgs84_low_accuracy_first')
            } catch (error) {
              reportLocationDebug('B', 'App.vue:doReportLocation:wgs84-low-first-fail', 'wgs84 普通精度定位失败', {
                errMsg: String(error?.errMsg || error?.message || '')
              })
              if (buildLocationFailureMeta(error).type !== 'timeout' || shouldLogLocationTimeout()) {
                console.warn('wgs84 普通精度定位失败，准备尝试高精度定位:', error)
              }
            }
          }
          if (!sample && shouldRefreshHighAccuracyLocation() && !gcj02Unsupported) {
            try {
              reportLocationDebug('B', 'App.vue:doReportLocation:gcj02', '尝试 gcj02 高精度定位', {
                high_accuracy: true
              })
              res = await requestUniLocation('gcj02')
              sample = normalizeReportLocation(res, requestTs, 'gcj02', 'gcj02_high_accuracy')
              lastHighAccuracyLocationTs = Date.now()
            } catch (error) {
              reportLocationDebug('B', 'App.vue:doReportLocation:gcj02-fail', 'gcj02 高精度定位失败', {
                errMsg: String(error?.errMsg || error?.message || ''),
                unsupported: isGcj02NotSupportedError(error)
              })
              if (isGcj02NotSupportedError(error)) {
                gcj02Unsupported = true
                console.warn('当前环境不支持 gcj02，后续改用 wgs84 定位并本地转换为 gcj02 上报')
              } else if (buildLocationFailureMeta(error).type !== 'timeout' || shouldLogLocationTimeout()) {
                console.warn('gcj02 高精度定位失败，准备改用 wgs84 高精度兜底:', error)
              }
            }
          }
          if (!sample && shouldRefreshHighAccuracyLocation()) {
            try {
              reportLocationDebug('B', 'App.vue:doReportLocation:wgs84-high', '尝试 wgs84 高精度定位补偿', {
                high_accuracy: true
              })
              res = await requestUniLocation('wgs84')
              sample = normalizeReportLocation(res, requestTs, 'wgs84', 'wgs84_to_gcj02')
              lastHighAccuracyLocationTs = Date.now()
            } catch (error) {
              reportLocationDebug('B', 'App.vue:doReportLocation:wgs84-high-fail', 'wgs84 高精度定位失败', {
                errMsg: String(error?.errMsg || error?.message || '')
              })
              if (buildLocationFailureMeta(error).type !== 'timeout' || shouldLogLocationTimeout()) {
                console.warn('wgs84 高精度定位失败，继续走最近定位兜底:', error)
              }
            }
          }
          if (!sample) {
            reportLocationDebug('B', 'App.vue:doReportLocation:wgs84-low', '尝试 wgs84 普通精度兜底', {
              high_accuracy: false,
              high_accuracy_expire_time: 15000
            })
            res = await requestUniLocation('wgs84', {
              isHighAccuracy: false,
              highAccuracyExpireTime: 15000
            })
            sample = normalizeReportLocation(res, requestTs, 'wgs84', 'wgs84_low_accuracy_fallback')
          }
          locationPermissionPrompted = false
          reportLocationDebug('B', 'App.vue:doReportLocation:location-ok', '已获取原始定位结果', {
            latitude: sample?.latitude,
            longitude: sample?.longitude,
            accuracy: sample?.accuracy,
            locationSource: sample?.locationSource,
            provider: sample?.provider || ''
          })
          const nearlySameAsLast = !!lastLocationSample && isNearlySameLocation(sample, lastLocationSample)
          if (ENABLE_LOCATION_DEBUG_REPORT) {
            console.log('位置上报原始定位结果:', {
              latitude: sample.latitude,
              longitude: sample.longitude,
              accuracy: sample.accuracy,
              altitude: sample.altitude,
              speed: sample.speed,
              provider: sample.provider,
              timestamp: sample.ts,
              locationSource: sample.locationSource,
              nearlySameAsLast
            })
          }

          if (!Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude)) {
            console.warn('本次定位结果无效，不上报旧点')
            return
          }
          await this.reportLocationSample(sample)
        } catch (err) {
          const failureMeta = buildLocationFailureMeta(err)
          reportLocationDebug('E', 'App.vue:doReportLocation:catch', '位置上报总流程失败', {
            errMsg: String(err?.errMsg || err?.message || ''),
            failure_type: failureMeta.type,
            failure_text: failureMeta.text,
            failure_detail: failureMeta.detail
          })
          if (failureMeta.type === 'timeout' && hasFreshLocationSample(lastLocationSample, 120000)) {
            // 后台位置上报偶发超时时，优先复用最近一次有效定位，别把“定位超时”反复弹到前台界面。
            // 对骑手来说，当前最需要的是界面稳定和持续可操作；只要最近 2 分钟内拿到过有效定位，
            // 这里就用旧点先兜底上报，避免正常送单过程中不停被 toast 打断。
            const fallbackSample = {
              ...lastLocationSample,
              ts: Date.now(),
              locationSource: `${lastLocationSample.locationSource || 'cached'}_timeout_fallback`
            }
            console.warn('本次实时定位超时，已改为复用最近一次有效定位静默上报:', {
              latitude: fallbackSample.latitude,
              longitude: fallbackSample.longitude,
              locationSource: fallbackSample.locationSource
            })
            await this.reportLocationSample(fallbackSample)
            return
          }
          console.warn(`[定位上报失败] ${failureMeta.text}: ${failureMeta.detail}`, err)
          // 后台位置上报超时属于系统定位波动，不该不停打断前台操作。
          // 这里前台只保留“权限没开 / 系统定位没开”这类必须让骑手立刻处理的提示，
          // 普通超时和未知失败只记控制台，不再弹屏。
          if (
            Date.now() >= locationHintToastUntil
            && (failureMeta.type === 'permission' || failureMeta.type === 'service_disabled')
          ) {
            locationHintToastUntil = Date.now() + 12000
            uni.showToast({
              title: failureMeta.text,
              icon: 'none',
              duration: 2200
            })
          }
          this.handleLocationPermissionError(err)
        } finally {
          locationReportInFlight = false
        }
      })()
    },
    handleLocationPermissionError(err) {
      const storedUser = getStoredUserInfo() || {}
      if (!this.canStartBackgroundJobs() || !canReportDispatchLocation(storedUser)) {
        return
      }

      const failureMeta = buildLocationFailureMeta(err)
      const isPermissionDenied = failureMeta.type === 'permission'

      if (!isPermissionDenied || locationPermissionPrompted) {
        if (failureMeta.type === 'service_disabled' && Date.now() >= locationHintToastUntil) {
          locationHintToastUntil = Date.now() + 12000
          uni.showToast({
            title: '请先打开系统定位',
            icon: 'none',
            duration: 2200
          })
        }
        return
      }

      locationPermissionPrompted = true
      uni.showModal({
        title: '需要定位权限',
        content: '县城司机要出现在调度台，必须允许定位权限并成功上报当前位置。请前往授权。',
        confirmText: '去授权',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm && typeof uni.openSetting === 'function') {
            uni.openSetting({
              success: () => {
                locationPermissionPrompted = false
                this.doReportLocation()
              },
              fail: () => {
                locationPermissionPrompted = false
              }
            })
          } else {
            locationPermissionPrompted = false
          }
        },
        fail: () => {
          locationPermissionPrompted = false
        }
      })
    },
    async syncCountyDriverOnlineStatus() {
      const storedUser = getStoredUserInfo() || {}

      if (!this.canStartBackgroundJobs() || !isCountyRider(storedUser)) {
        return
      }

      const rawStatus = uni.getStorageSync('riderStatus')
      const hasSavedStatus = rawStatus !== '' && rawStatus !== null && typeof rawStatus !== 'undefined'
      const nextStatus = hasSavedStatus ? (Number(rawStatus) === 1 ? 1 : 0) : 1

      if (!hasSavedStatus) {
        setRiderStatus(nextStatus)
      }

      try {
        await post('/order/rider-status', { status: nextStatus }, {
          background: true,
          silent: true,
          suppressAuthToast: true,
          suppressErrorToast: true
        })
        console.log('县城司机在线状态已同步到后端:', nextStatus)
      } catch (error) {
        console.error('县城司机在线状态同步失败:', error)
      }
    }
  }
}
</script>

<style>
/* 全局样式 */
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 主题色 */
.primary-color {
  color: #1890FF;
}

.primary-bg {
  background-color: #1890FF;
}

/* 卡片样式 */
.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

/* 按钮样式 */
.btn-primary {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
  border-radius: 8rpx;
  padding: 16rpx 32rpx;
  font-size: 28rpx;
  border: none;
}

.btn-success {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #fff;
  border-radius: 8rpx;
  padding: 16rpx 32rpx;
  font-size: 28rpx;
  border: none;
}
</style>
