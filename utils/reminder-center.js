import { getRiderOrders } from '@/api/order.js'
import { getTownErrandConversations } from '@/api/town-errand-message.js'
import { isMerchantDeliveryUser, isRiderAppUser, isTownStationmaster } from '@/utils/rider-auth.js'
import { initSocket, disconnectSocket, onReminderEvents, onSocketEvent } from '@/utils/socket.js'
import { playReminderAlert } from '@/utils/town-errand-voice.js'
import {
  getReminderSettings,
  isReminderEnabledForType
} from '@/utils/reminder-settings.js'

const LOG_PREFIX = '[reminder-center]'
const ORDER_POLL_INTERVAL_FOREGROUND = 15000
const ORDER_POLL_INTERVAL_BACKGROUND = 30000
const TOWN_POLL_INTERVAL_FOREGROUND = 15000
const TOWN_POLL_INTERVAL_BACKGROUND = 30000
const DEDUPE_WINDOW_MS = 180000
const INITIAL_ORDER_REMINDER_WINDOW_MS = 90000
const REMINDER_EVENT_NAME = 'rider-reminder:event'
const ORDER_REFRESH_EVENT_NAME = 'rider-reminder:order-refresh'
const TOWN_UNREAD_EVENT_NAME = 'rider-reminder:town-unread'
const SETTINGS_CHANGED_EVENT_NAME = 'rider-reminder:settings-changed'
const TIMEOUT_WARNING_LEVELS = [600, 180]
const HIGH_PRIORITY_VALUES = ['high', 'urgent', 'critical', 'p0', 'p1']
const TAB_PAGE_PREFIXES = ['/pages/index/index', '/pages/profile/index']
const RIDER_NEW_ORDER_PLAYABLE_STATUSES = [2, 3, 4]

function isAppPlatform() {
  try {
    if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
      const platform = String(uni.getSystemInfoSync()?.uniPlatform || '').toLowerCase()
      if (platform === 'app' || platform === 'app-plus') {
        return true
      }
    }
  } catch (error) {}
  return typeof plus !== 'undefined'
}

const state = {
  initialized: false,
  appVisible: true,
  token: '',
  userInfo: null,
  orderPollTimer: null,
  orderPollInFlight: false,
  townPollTimer: null,
  townPollInFlight: false,
  orderSnapshot: new Map(),
  dedupeMap: new Map(),
  townUnreadTotal: 0,
  townInitialized: false,
  socketCleanup: null,
  pushClickBound: false,
  plusReadyListening: false,
  plusReadyCallbacks: [],
  pollKickoffAt: 0
}

function logInfo(message, extra) {
  if (typeof extra === 'undefined') {
    console.log(LOG_PREFIX, message)
    return
  }
  console.log(LOG_PREFIX, message, extra)
}

function logWarn(message, extra) {
  if (typeof extra === 'undefined') {
    console.warn(LOG_PREFIX, message)
    return
  }
  console.warn(LOG_PREFIX, message, extra)
}

function logError(message, extra) {
  if (typeof extra === 'undefined') {
    console.error(LOG_PREFIX, message)
    return
  }
  console.error(LOG_PREFIX, message, extra)
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

function getCurrentPageOptions() {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const currentPage = Array.isArray(pages) && pages.length ? pages[pages.length - 1] : null
    return currentPage?.options || {}
  } catch (error) {
    return {}
  }
}

function isAppPlusRuntime() {
  // #ifdef APP-PLUS
  return true
  // #endif
  return false
}

function ensurePlusReady(callback) {
  if (!isAppPlusRuntime()) {
    return false
  }

  if (typeof plus !== 'undefined') {
    callback()
    return true
  }

  state.plusReadyCallbacks.push(callback)
  if (!state.plusReadyListening && typeof document !== 'undefined' && document.addEventListener) {
    state.plusReadyListening = true
    const onPlusReady = () => {
      document.removeEventListener('plusready', onPlusReady, false)
      state.plusReadyListening = false
      const callbacks = state.plusReadyCallbacks.slice()
      state.plusReadyCallbacks = []
      callbacks.forEach((fn) => {
        try {
          fn()
        } catch (error) {
          logError('执行 plusready 回调失败', error)
        }
      })
    }
    document.addEventListener('plusready', onPlusReady, false)
  }
  return false
}

function toArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function safeText(value) {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return ''
  }
  return String(value).trim()
}

function safeId(value) {
  const text = safeText(value)
  return text || ''
}

function parseJsonMaybe(value, fallback = {}) {
  if (!value) {
    return fallback
  }
  if (typeof value === 'object') {
    return value
  }
  try {
    return JSON.parse(String(value))
  } catch (error) {
    return fallback
  }
}

function isHighPriority(value) {
  return HIGH_PRIORITY_VALUES.includes(String(value || '').trim().toLowerCase())
}

function pickPayloadValue(payload = {}, ...keys) {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]
    if (!key) {
      continue
    }
    const value = payload[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return undefined
}

function normalizeReminderType(type = '') {
  const normalized = safeText(type).toLowerCase()
  if (!normalized) {
    return ''
  }

  const map = {
    new_delivery: 'new_order',
    order_assigned: 'new_order',
    rider_new_delivery: 'new_order',
    rider_station_order_assigned: 'new_order',
    rider_transfer_assigned: 'transfer',
    rider_transfer_revoked: 'transfer',
    rider_order_cancelled: 'cancel',
    rider_timeout_warning: 'timeout',
    rider_pickup_ready: 'pickup_ready',
    rider_station_notice: 'station_notice',
    rider_dispatch_notice: 'station_notice'
  }

  return map[normalized] || normalized
}

function pickOrder(payload = {}) {
  if (payload && typeof payload === 'object' && payload.id) {
    return payload
  }
  if (payload?.data && typeof payload.data === 'object') {
    return payload.data
  }
  if (payload?.order && typeof payload.order === 'object') {
    return payload.order
  }
  return {}
}

function getMerchantName(order = {}) {
  return safeText(order?.merchant?.name) || '商家'
}

function isTransferOrder(order = {}) {
  return toBoolean(order.is_transfer_order) || !!safeText(order.transfer_tag)
}

function isTownOrder(order = {}) {
  return order.order_type === 'town' || order.delivery_scope === 'town_delivery' || !!getTownName(order)
}

function getTownName(order = {}) {
  const targetTown = order.transfer_to_town
  if (targetTown && typeof targetTown === 'object') {
    return safeText(
      targetTown.area_name
      || targetTown.town_name
      || targetTown.label
      || targetTown.name
      || targetTown.value
    )
  }
  return safeText(order.customer_town || order.town_name || order.rider_town || targetTown)
}

function pickUnreadCount(item = {}) {
  const unread = item.unread_count ?? item.unreadCount ?? item.unread_num
  return Number(unread) > 0 ? Number(unread) : 0
}

function parseTimeValue(value) {
  if (!value && value !== 0) {
    return 0
  }

  if (typeof value === 'number') {
    if (value > 1000000000000) {
      return value
    }
    if (value > 1000000000) {
      return value * 1000
    }
    return 0
  }

  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function getTimeoutRemainingSeconds(order = {}) {
  const directFields = [
    'timeout_warning_in',
    'timeout_warning_seconds',
    'remaining_seconds',
    'remaining_time_seconds',
    'delivery_remaining_seconds',
    'pickup_remaining_seconds',
    'rider_remaining_seconds'
  ]
  for (let i = 0; i < directFields.length; i += 1) {
    const value = Number(order[directFields[i]])
    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value)
    }
  }

  const deadlineFields = [
    'timeout_at',
    'delivery_timeout_at',
    'pickup_timeout_at',
    'delivery_deadline_at',
    'pickup_deadline_at',
    'deadline_at',
    'expire_at'
  ]

  for (let i = 0; i < deadlineFields.length; i += 1) {
    const timestamp = parseTimeValue(order[deadlineFields[i]])
    if (!timestamp) {
      continue
    }
    const remaining = Math.floor((timestamp - Date.now()) / 1000)
    if (remaining > 0) {
      return remaining
    }
  }

  return 0
}

function getTimeoutBucket(order = {}) {
  const remainingSeconds = getTimeoutRemainingSeconds(order)
  if (!remainingSeconds) {
    return ''
  }

  if (remainingSeconds <= TIMEOUT_WARNING_LEVELS[1]) {
    return 'warn_3m'
  }
  if (remainingSeconds <= TIMEOUT_WARNING_LEVELS[0]) {
    return 'warn_10m'
  }
  return ''
}

function isActionableMerchantReady(order = {}) {
  const user = state.userInfo || getStoredUserInfo() || {}
  const status = Number(order.status || 0)
  // 平台骑手在商家出餐后进入 4，自配送员在商家出餐后直接进入 3。
  return isMerchantDeliveryUser(user) ? status === 3 : status === 4
}

function buildOrderSnapshot(order = {}) {
  return {
    id: safeId(order.id),
    status: Number(order.status || 0),
    isTransferOrder: isTransferOrder(order),
    transferStatus: safeText(order.transfer_status),
    transferTag: safeText(order.transfer_tag),
    transferToUserId: safeId(order?.transfer_to_user?.id || order?.transfer_to_user?.user_id || order?.transfer_to_user_id),
    transferFromUserId: safeId(order?.transfer_from_user?.id || order?.transfer_from_user?.user_id || order?.transfer_from_user_id),
    timeoutBucket: getTimeoutBucket(order),
    updatedAt: safeText(order.updated_at || order.transfer_updated_at || order.status_updated_at || order.modified_at || ''),
    merchantReady: isActionableMerchantReady(order)
  }
}

function shouldReplayInitialPoolReminder(order = {}, snapshot = {}) {
  // 这里补的是“App 刚重启，第一次轮询把新单当快照吃掉”的漏提醒窗口。
  // 只对刚进入待接单池、而且还很新的订单补一次提醒，避免把很早以前的旧单也重新播一遍。
  if (Number(order.rider_id || 0) > 0) {
    return false
  }
  if (!RIDER_NEW_ORDER_PLAYABLE_STATUSES.includes(Number(snapshot.status || 0))) {
    return false
  }

  const freshnessTs = parseTimeValue(
    order.accepted_at
    || order.status_updated_at
    || order.transfer_updated_at
    || order.created_at
  )
  if (!freshnessTs) {
    return false
  }

  const ageMs = Date.now() - freshnessTs
  return ageMs >= 0 && ageMs <= INITIAL_ORDER_REMINDER_WINDOW_MS
}

function shouldPlayNewPoolReminder(order = {}, snapshot = {}) {
  if (isTransferOrder(order)) {
    return true
  }
  if (Number(order.rider_id || 0) > 0) {
    return false
  }
  // 新配送语音只能在商家接单后响；用户刚付款的 status=1 只能提醒商家，不能提前吵到骑手。
  // 这里会影响 socket 和轮询两条入口，后面的 handleReminder 还会再做一次总闸门兜底。
  return RIDER_NEW_ORDER_PLAYABLE_STATUSES.includes(Number(snapshot.status || 0))
}

function pickReminderOrder(reminder = {}) {
  const meta = reminder?.meta || {}
  const payload = meta?.payload || {}
  const extra = meta?.extra || {}
  const candidates = [
    reminder.order,
    meta.order,
    pickOrder(payload),
    pickOrder(extra)
  ]
  return candidates.find((item = {}) => {
    if (!item || typeof item !== 'object') {
      return false
    }
    return item.id || item.order_no || item.status || item.order_status || item.orderStatus
  }) || {}
}

function pickReminderOrderStatus(reminder = {}) {
  const order = pickReminderOrder(reminder)
  const meta = reminder?.meta || {}
  const payload = meta?.payload || {}
  const extra = meta?.extra || {}
  const rawStatus = order.status
    ?? payload.status
    ?? payload.order_status
    ?? payload.orderStatus
    ?? extra.status
    ?? extra.order_status
    ?? extra.orderStatus
  const status = Number(rawStatus)
  return Number.isFinite(status) ? status : 0
}

function shouldBlockNewOrderVoice(reminder = {}) {
  const type = normalizeReminderType(reminder.type)
  if (type !== 'new_order') {
    return false
  }

  const order = pickReminderOrder(reminder)
  if (isTransferOrder(order) || normalizeReminderType(reminder.rawEventType) === 'transfer') {
    return false
  }

  const status = pickReminderOrderStatus(reminder)
  // 这里是骑手端最后一道语音闸门：凡是新配送提醒，必须带着已过商家接单的订单状态。
  // 如果某个 push/reminder_event 没带状态，也先不播，避免旧包或异常推送绕过前面的入口判断。
  return !RIDER_NEW_ORDER_PLAYABLE_STATUSES.includes(status)
}

function buildOrdersIndexTarget(scene, orderId = '') {
  const params = []
  if (scene) {
    params.push(`scene=${encodeURIComponent(scene)}`)
  }
  if (orderId) {
    params.push(`orderId=${encodeURIComponent(orderId)}`)
  }
  return {
    type: 'navigate',
    url: `/pages/orders/index${params.length ? `?${params.join('&')}` : ''}`
  }
}

function buildOrderDetailTarget(orderId = '') {
  return {
    type: 'navigate',
    url: `/pages/orders/detail?id=${encodeURIComponent(String(orderId || ''))}`
  }
}

function appendQueryParams(url = '', params = {}) {
  const safeUrl = safeText(url)
  if (!safeUrl) {
    return ''
  }
  const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (!entries.length) {
    return safeUrl
  }
  const query = entries
    .map(([key, value]) => `${encodeURIComponent(String(key))}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `${safeUrl}${safeUrl.includes('?') ? '&' : '?'}${query}`
}

function normalizeJumpPath(path = '') {
  const safePath = safeText(path)
  if (!safePath) {
    return ''
  }
  if (safePath.startsWith('/')) {
    return safePath
  }
  if (safePath.startsWith('pages/')) {
    return `/${safePath}`
  }
  if (safePath.startsWith('http://') || safePath.startsWith('https://')) {
    return safePath
  }
  return `/${safePath}`
}

function buildTargetFromJump(jumpPath = '', jumpParams = {}, fallbackOrderId = '') {
  const normalizedPath = normalizeJumpPath(jumpPath)
  const params = parseJsonMaybe(jumpParams, {})
  if (normalizedPath) {
    return {
      type: 'navigate',
      url: appendQueryParams(normalizedPath, params)
    }
  }

  if (fallbackOrderId) {
    return buildOrderDetailTarget(fallbackOrderId)
  }

  return buildOrdersIndexTarget('', '')
}

function emitUniEvent(name, payload) {
  if (typeof uni?.$emit === 'function') {
    uni.$emit(name, payload)
  }
}

function pruneDedupeCache(now = Date.now()) {
  state.dedupeMap.forEach((timestamp, key) => {
    if (now - Number(timestamp || 0) > DEDUPE_WINDOW_MS) {
      state.dedupeMap.delete(key)
    }
  })
}

function shouldSkipReminder(reminder = {}) {
  const key = safeText(reminder.dedupeKey)
  if (!key) {
    return false
  }

  const now = Date.now()
  pruneDedupeCache(now)
  const previous = Number(state.dedupeMap.get(key) || 0)
  if (previous && now - previous < DEDUPE_WINDOW_MS) {
    return true
  }
  state.dedupeMap.set(key, now)
  return false
}

function getReminderSettingsSnapshot() {
  return getReminderSettings()
}

function shouldSendSystemNotification() {
  const settings = getReminderSettingsSnapshot()
  return !state.appVisible && settings.systemNotificationEnabled
}

function createSystemNotification(reminder = {}) {
  const payload = {
    source: 'local_notification',
    reminderType: reminder.type || '',
    target: reminder.target || null,
    orderId: reminder.orderId || '',
    dedupeKey: reminder.dedupeKey || '',
    title: reminder.title || '',
    text: reminder.text || reminder.body || '',
    soundType: reminder.soundType || 'default',
    priority: reminder.priority || 'normal'
  }

  ensurePlusReady(() => {
    try {
      if (!plus.push || typeof plus.push.createMessage !== 'function') {
        logWarn('当前运行环境不支持 plus.push.createMessage，无法创建系统通知')
        return
      }
      plus.push.createMessage(
        safeText(reminder.body || reminder.text || reminder.title),
        JSON.stringify(payload),
        {
          title: safeText(reminder.title || '骑手提醒'),
          cover: false,
          delay: false
        }
      )
    } catch (error) {
      logError('创建本地系统通知失败', error)
    }
  })
}

function normalizePushPayload(rawPayload) {
  if (!rawPayload) {
    return {}
  }
  if (typeof rawPayload === 'object') {
    return rawPayload
  }
  try {
    return JSON.parse(String(rawPayload))
  } catch (error) {
    return {}
  }
}

function isTabPageUrl(url = '') {
  const safeUrl = safeText(url)
  if (!safeUrl) {
    return false
  }
  return TAB_PAGE_PREFIXES.some((prefix) => safeUrl.startsWith(prefix))
}

function openReminderTarget(target = null) {
  if (!target || !target.url) {
    return false
  }

  const url = String(target.url)
  if (!url) {
    return false
  }

  const isTabPage = isTabPageUrl(url)
  if (isTabPage) {
    uni.switchTab({
      url: url.split('?')[0],
      fail: () => {
        uni.reLaunch({ url: url.split('?')[0] })
      }
    })
    return true
  }

  uni.navigateTo({
    url,
    fail: () => {
      uni.redirectTo({
        url,
        fail: () => {
          uni.reLaunch({ url })
        }
      })
    }
  })
  return true
}

function bindPushClickListeners() {
  if (state.pushClickBound || !isAppPlusRuntime()) {
    return
  }

  ensurePlusReady(() => {
    if (!plus.push || typeof plus.push.addEventListener !== 'function') {
      logWarn('当前运行环境不支持 plus.push 事件监听')
      return
    }

    plus.push.addEventListener('click', (message) => {
      const payload = normalizePushPayload(message?.payload)
      const target = payload?.target || null
      if (target) {
        setTimeout(() => {
          openReminderTarget(target)
        }, 120)
      }
    })

    plus.push.addEventListener('receive', (message) => {
      const payload = normalizePushPayload(message?.payload)
      if (payload?.source === 'local_notification') {
        return
      }
      if (payload?.target && payload?.reminderType) {
        const extraPayload = parseJsonMaybe(payload?.extra, {})
        const order = pickOrder(payload)
        handleReminder({
          type: safeText(payload.reminderType),
          title: safeText(message?.title || payload?.title || '骑手通知'),
          text: safeText(message?.content || payload?.text || ''),
          body: safeText(message?.content || payload?.text || ''),
          target: payload.target,
          dedupeKey: safeText(payload?.dedupeKey || ''),
          soundType: safeText(payload?.soundType || 'default'),
          priority: safeText(payload?.priority || 'normal'),
          meta: {
            payload,
            order,
            extra: extraPayload,
            eventName: 'push_receive'
          }
        }, { source: 'push:receive' })
      }
    })

    state.pushClickBound = true
  })
}

function buildReminderFromUnifiedEvent(payload = {}) {
  const targetRole = safeText(payload.target_role).toLowerCase()
  if (targetRole && targetRole !== 'rider') {
    return null
  }

  const jumpParams = parseJsonMaybe(payload.jump_params, {})
  const extraPayload = parseJsonMaybe(payload.extra, {})
  const order = pickOrder(payload)
  const orderId = safeId(
    order.id
    || extraPayload.order_id
    || jumpParams.id
    || jumpParams.orderId
    || jumpParams.order_id
  )
  const eventType = safeText(payload.event_type)
  const normalizedType = normalizeReminderType(eventType)
  const speechText = safeText(payload.speech_text)
  const content = safeText(payload.content)
  const title = safeText(payload.title) || '骑手提醒'
  const text = speechText || content || title

  return {
    type: normalizedType || 'station_notice',
    rawEventType: eventType,
    orderId,
    title,
    text,
    body: content || text,
    dedupeKey: safeText(payload.dedupe_key) || `${normalizedType || eventType}:${orderId || title}:${safeText(payload.created_at)}`,
    target: buildTargetFromJump(payload.jump_path, jumpParams, orderId),
    soundType: safeText(payload.sound_type || 'default'),
    priority: safeText(payload.priority || 'normal'),
    eventVersion: safeText(payload.event_version),
    meta: {
      payload,
      order,
      extra: extraPayload,
      eventName: 'reminder_event'
    }
  }
}

function buildReminderFromSocket(eventName, payload = {}) {
  if (eventName === 'reminder_event') {
    return buildReminderFromUnifiedEvent(payload)
  }

  const order = pickOrder(payload)
  const orderId = safeId(order.id)
  const eventType = safeText(pickPayloadValue(payload, 'eventType', 'event_type'))
  const normalizedType = normalizeReminderType(eventType)
  const speechText = safeText(pickPayloadValue(payload, 'speechText', 'speech_text'))
  const socketMessage = safeText(pickPayloadValue(payload, 'message', 'content'))
  const socketTitle = safeText(payload.title)
  const soundType = safeText(pickPayloadValue(payload, 'soundType', 'sound_type') || 'default')
  const priority = safeText(payload.priority || 'normal')
  const jumpPath = safeText(pickPayloadValue(payload, 'jumpPath', 'jump_path'))
  const jumpParams = pickPayloadValue(payload, 'jumpParams', 'jump_params')
  const dedupeKey = safeText(pickPayloadValue(payload, 'dedupeKey', 'dedupe_key'))
  const timestamp = safeText(pickPayloadValue(payload, 'timestamp', 'created_at'))

  if (eventName === 'new_delivery' || eventName === 'order_assigned') {
    const transfer = isTransferOrder(order)
    if (!shouldPlayNewPoolReminder(order, buildOrderSnapshot(order))) {
      return null
    }
    const type = normalizedType || (transfer ? 'transfer' : 'new_order')
    const fallbackTitle = transfer ? '收到转派订单' : '收到新派单'
    const fallbackText = transfer
      ? `订单${safeText(order.order_no || orderId)}已转到你这里，请尽快处理`
      : `${getMerchantName(order)}有新的配送任务，请及时接单`
    return {
      type,
      orderId,
      rawEventType: eventType,
      title: socketTitle || fallbackTitle,
      text: speechText || socketMessage || fallbackText,
      body: socketMessage || speechText || fallbackText,
      dedupeKey: dedupeKey || `${type}:${orderId}:${timestamp || Number(order.status || 0)}`,
      target: buildTargetFromJump(
        jumpPath,
        jumpParams,
        orderId
      ) || (transfer ? buildOrderDetailTarget(orderId) : buildOrdersIndexTarget('new_delivery', orderId)),
      soundType,
      priority,
      meta: { order, payload, eventName }
    }
  }

  if (eventName === 'order_transfer' || eventName === 'order_reassign') {
    return {
      type: 'transfer',
      orderId,
      title: socketTitle || '订单转派提醒',
      text: speechText || socketMessage || `订单${safeText(order.order_no || orderId)}转派信息有更新`,
      body: socketMessage || speechText || `订单${safeText(order.order_no || orderId)}转派信息有更新`,
      dedupeKey: dedupeKey || `transfer:${orderId}:${safeText(order.transfer_status || order.updated_at || '')}`,
      target: buildTargetFromJump(jumpPath, jumpParams, orderId),
      soundType,
      priority,
      meta: { order, payload, eventName }
    }
  }

  if (eventName === 'order_cancelled') {
    return {
      type: 'cancel',
      orderId,
      title: '订单已取消',
      text: `订单${safeText(order.order_no || orderId)}已取消，请停止配送`,
      body: `订单${safeText(order.order_no || orderId)}已取消，请停止配送`,
      dedupeKey: `cancel:${orderId}`,
      target: buildOrderDetailTarget(orderId),
      meta: { order, eventName }
    }
  }

  if (eventName === 'merchant_ready') {
    return {
      type: 'pickup_ready',
      orderId,
      title: '商家已出餐',
      text: `${getMerchantName(order)}已出餐，请尽快取餐`,
      body: `${getMerchantName(order)}已出餐，请尽快取餐`,
      dedupeKey: `pickup_ready:${orderId}`,
      target: buildOrdersIndexTarget('pickup_ready', orderId),
      meta: { order, eventName }
    }
  }

  if (eventName === 'order_timeout_warning') {
    return {
      type: 'timeout',
      orderId,
      title: '订单即将超时',
      text: `订单${safeText(order.order_no || orderId)}即将超时，请尽快处理`,
      body: `订单${safeText(order.order_no || orderId)}即将超时，请尽快处理`,
      dedupeKey: `timeout:${orderId}:${getTimeoutBucket(order) || 'socket'}`,
      target: buildOrderDetailTarget(orderId),
      meta: { order, eventName }
    }
  }

  if (eventName === 'dispatch_notice' || eventName === 'station_notice' || eventName === 'town_message_notice') {
    const title = safeText(payload.title || '站长/调度通知')
    const text = safeText(payload.content || payload.message || '您有新的站长或调度通知，请及时查看')
    return {
      type: 'station_notice',
      title,
      text,
      body: text,
      dedupeKey: `station_notice:${safeText(payload.notice_id || payload.id || text)}`,
      target: payload?.target?.url ? payload.target : { type: 'navigate', url: '/pages/index/index' },
      meta: { payload, eventName }
    }
  }

  return null
}

function emitRefreshEvents(reminder = {}) {
  emitUniEvent(REMINDER_EVENT_NAME, reminder)

  if (['new_order', 'transfer', 'cancel', 'timeout', 'pickup_ready'].includes(reminder.type)) {
    emitUniEvent(ORDER_REFRESH_EVENT_NAME, {
      type: reminder.type,
      orderId: reminder.orderId || '',
      meta: reminder.meta || {}
    })
  }
}

function handleReminder(reminder = {}, { source = 'unknown' } = {}) {
  const type = safeText(reminder.type)
  if (!type) {
    return false
  }

  // 页面数据刷新不能依赖提醒是否成功播报，否则去重或关闭提醒时首页会滞后。
  emitRefreshEvents(reminder)

  if (shouldBlockNewOrderVoice(reminder)) {
    logWarn('新配送提醒未达到骑手播报状态，已跳过语音', {
      source,
      orderId: reminder.orderId || '',
      status: pickReminderOrderStatus(reminder),
      rawEventType: reminder.rawEventType || ''
    })
    return false
  }

  const settings = getReminderSettingsSnapshot()
  if (!isReminderEnabledForType(type, settings)) {
    logInfo(`提醒类型已关闭，跳过播报: ${type}`, { source })
    return false
  }

  if (shouldSkipReminder(reminder)) {
    logInfo(`命中去重，跳过重复提醒: ${type}`, { source, dedupeKey: reminder.dedupeKey })
    return false
  }

  if (shouldSendSystemNotification()) {
    createSystemNotification(reminder)
  }

  playReminderAlert({
    title: reminder.title || '骑手提醒',
    text: reminder.text || reminder.body || reminder.title || '您有新的骑手提醒',
    voice: settings.voiceEnabled,
    sound: settings.soundEnabled,
    vibration: settings.vibrationEnabled,
    toast: state.appVisible,
    soundType: reminder.soundType || 'default',
    priority: reminder.priority || 'normal'
  })
  return true
}

function evaluateOrderChanges(list = []) {
  const latestMap = new Map()
  list.forEach((order) => {
    const id = safeId(order.id)
    if (id) {
      latestMap.set(id, {
        raw: order,
        snapshot: buildOrderSnapshot(order)
      })
    }
  })

  const isInitialLoad = !state.orderSnapshot.size
  if (isInitialLoad) {
    latestMap.forEach(({ raw, snapshot }, id) => {
      if (!shouldReplayInitialPoolReminder(raw, snapshot)) {
        return
      }
      handleReminder({
        type: isTransferOrder(raw) ? 'transfer' : 'new_order',
        orderId: id,
        title: isTransferOrder(raw) ? '收到转派订单' : '收到新派单',
        text: isTransferOrder(raw)
          ? `订单${safeText(raw.order_no || id)}已转到你这里，请及时处理`
          : `${getMerchantName(raw)}有新的配送任务，请及时接单`,
        body: isTransferOrder(raw)
          ? `订单${safeText(raw.order_no || id)}已转到你这里，请及时处理`
          : `${getMerchantName(raw)}有新的配送任务，请及时接单`,
        dedupeKey: `${isTransferOrder(raw) ? 'transfer' : 'new_order'}:${id}:initial:${snapshot.status}`,
        target: isTransferOrder(raw) ? buildOrderDetailTarget(id) : buildOrdersIndexTarget('new_delivery', id),
        meta: { order: raw, source: 'order_poll_initial_recent' }
      }, { source: 'order-poll:initial-recent' })
    })
  } else {
    latestMap.forEach(({ raw, snapshot }, id) => {
      const previous = state.orderSnapshot.get(id)?.snapshot
      if (!previous) {
        if (!shouldPlayNewPoolReminder(raw, snapshot)) {
          return
        }
        handleReminder({
          type: isTransferOrder(raw) ? 'transfer' : 'new_order',
          orderId: id,
          title: isTransferOrder(raw) ? '收到转派订单' : '收到新派单',
          text: isTransferOrder(raw)
            ? `订单${safeText(raw.order_no || id)}已转到你这里，请及时处理`
            : `${getMerchantName(raw)}有新的配送任务，请及时接单`,
          body: isTransferOrder(raw)
            ? `订单${safeText(raw.order_no || id)}已转到你这里，请及时处理`
            : `${getMerchantName(raw)}有新的配送任务，请及时接单`,
          dedupeKey: `${isTransferOrder(raw) ? 'transfer' : 'new_order'}:${id}:${snapshot.status}`,
          target: isTransferOrder(raw) ? buildOrderDetailTarget(id) : buildOrdersIndexTarget('new_delivery', id),
          meta: { order: raw, source: 'order_poll_new' }
        }, { source: 'order-poll:new' })
        return
      }

      if (previous.status !== 7 && snapshot.status === 7) {
        handleReminder({
          type: 'cancel',
          orderId: id,
          title: '订单已取消',
          text: `订单${safeText(raw.order_no || id)}已取消，请停止配送`,
          body: `订单${safeText(raw.order_no || id)}已取消，请停止配送`,
          dedupeKey: `cancel:${id}`,
          target: buildOrderDetailTarget(id),
          meta: { order: raw, source: 'order_poll_cancel' }
        }, { source: 'order-poll:cancel' })
      }

      if (!previous.merchantReady && snapshot.merchantReady) {
        handleReminder({
          type: 'pickup_ready',
          orderId: id,
          title: '商家已出餐',
          text: `${getMerchantName(raw)}已出餐，请尽快取餐`,
          body: `${getMerchantName(raw)}已出餐，请尽快取餐`,
          dedupeKey: `pickup_ready:${id}`,
          target: buildOrdersIndexTarget('pickup_ready', id),
          meta: { order: raw, source: 'order_poll_pickup_ready' }
        }, { source: 'order-poll:pickup-ready' })
      }

      const transferSignatureChanged = previous.isTransferOrder !== snapshot.isTransferOrder
        || previous.transferStatus !== snapshot.transferStatus
        || previous.transferTag !== snapshot.transferTag
        || previous.transferToUserId !== snapshot.transferToUserId
        || previous.transferFromUserId !== snapshot.transferFromUserId

      if (transferSignatureChanged && snapshot.isTransferOrder) {
        handleReminder({
          type: 'transfer',
          orderId: id,
          title: '订单转派提醒',
          text: `订单${safeText(raw.order_no || id)}转派信息有更新`,
          body: `订单${safeText(raw.order_no || id)}转派信息有更新`,
          dedupeKey: `transfer:${id}:${snapshot.transferStatus || snapshot.updatedAt || snapshot.transferTag}`,
          target: buildOrderDetailTarget(id),
          meta: { order: raw, source: 'order_poll_transfer' }
        }, { source: 'order-poll:transfer' })
      }

      if (snapshot.timeoutBucket && snapshot.timeoutBucket !== previous.timeoutBucket) {
        handleReminder({
          type: 'timeout',
          orderId: id,
          title: '订单即将超时',
          text: `订单${safeText(raw.order_no || id)}即将超时，请尽快处理`,
          body: `订单${safeText(raw.order_no || id)}即将超时，请尽快处理`,
          dedupeKey: `timeout:${id}:${snapshot.timeoutBucket}`,
          target: buildOrderDetailTarget(id),
          meta: { order: raw, source: 'order_poll_timeout' }
        }, { source: 'order-poll:timeout' })
      }
    })
  }

  state.orderSnapshot = latestMap
}

async function pollOrders() {
  if (!state.token || state.orderPollInFlight) {
    return
  }
  state.orderPollInFlight = true
  try {
    const res = await getRiderOrders({}, {
      // 这里是提醒中心自己的后台轮询，不是骑手手动点击触发的页面请求。
      // 一旦接口偶发超时，如果还沿用默认请求提示，就会每隔几秒反复弹“网络错误，请检查网络”，
      // 骑手会误以为整个系统都坏了。
      // 所以这里统一按“静默后台刷新”处理：失败记日志，但不要直接打断界面。
      background: true,
      silent: true,
      suppressAuthToast: true,
      suppressErrorToast: true
    })
    const user = state.userInfo || getStoredUserInfo() || {}
    let list = toArray(res?.data ?? res)
    if (!isMerchantDeliveryUser(user)) {
      list = list.filter((order = {}) => order.order_type !== 'supermarket')
    }
    evaluateOrderChanges(list)
  } catch (error) {
    logError('订单提醒轮询失败', error)
  } finally {
    state.orderPollInFlight = false
  }
}

async function pollTownMessages() {
  if (!state.token || state.townPollInFlight || !isTownStationmaster(state.userInfo || {})) {
    return
  }
  if (getCurrentRoutePath() === '/pages/station-messages/index' || getCurrentRoutePath() === '/pages/station-messages/detail') {
    return
  }

  state.townPollInFlight = true
  try {
    const res = await getTownErrandConversations({}, {
      background: true,
      silent: true,
      suppressAuthToast: true,
      suppressErrorToast: true
    })
    const list = toArray(res?.data ?? res)
    const unreadTotal = list.reduce((sum, item = {}) => sum + pickUnreadCount(item), 0)

    emitUniEvent(TOWN_UNREAD_EVENT_NAME, { unreadTotal })
    if (!state.townInitialized) {
      state.townInitialized = true
      state.townUnreadTotal = unreadTotal
      return
    }

    if (unreadTotal > state.townUnreadTotal) {
      handleReminder({
        type: 'station_notice',
        title: '收到站长消息',
        text: '您有新的乡镇跑腿或站长消息，请及时查看',
        body: '您有新的乡镇跑腿或站长消息，请及时查看',
        dedupeKey: `station_notice:town_unread:${unreadTotal}`,
        target: { type: 'navigate', url: '/pages/station-messages/index' },
        meta: { unreadTotal }
      }, { source: 'town-message-poll' })
    }

    state.townUnreadTotal = unreadTotal
  } catch (error) {
    logError('站长消息提醒轮询失败', error)
  } finally {
    state.townPollInFlight = false
  }
}

function stopOrderPollTimer() {
  if (state.orderPollTimer) {
    clearInterval(state.orderPollTimer)
    state.orderPollTimer = null
  }
}

function stopTownPollTimer() {
  if (state.townPollTimer) {
    clearInterval(state.townPollTimer)
    state.townPollTimer = null
  }
}

function restartOrderPolling() {
  stopOrderPollTimer()
  if (!state.token || !state.userInfo || !isRiderAppUser(state.userInfo)) {
    return
  }
  const interval = state.appVisible ? ORDER_POLL_INTERVAL_FOREGROUND : ORDER_POLL_INTERVAL_BACKGROUND
  state.orderPollTimer = setInterval(() => {
    pollOrders()
  }, interval)
}

function restartTownPolling() {
  stopTownPollTimer()
  if (!state.token || !isTownStationmaster(state.userInfo || {})) {
    emitUniEvent(TOWN_UNREAD_EVENT_NAME, { unreadTotal: 0 })
    return
  }
  const interval = state.appVisible ? TOWN_POLL_INTERVAL_FOREGROUND : TOWN_POLL_INTERVAL_BACKGROUND
  state.townPollTimer = setInterval(() => {
    pollTownMessages()
  }, interval)
}

function bindSocketReminderEvents() {
  if (state.socketCleanup) {
    state.socketCleanup()
    state.socketCleanup = null
  }

  if (!state.token) {
    return
  }

  // 这里把 Socket 作为主通道保留下来，App 端也一样。
  // 原来 App 一进来就被主动断开，只能依赖轮询兜底，
  // 所以“商家刚点接单就立刻播报”这件事天然做不到。
  initSocket(state.token)
  const reminderCleanup = onReminderEvents((payload, eventName) => {
    const reminder = buildReminderFromSocket(eventName, payload)
    if (!reminder) {
      return
    }
    handleReminder(reminder, { source: `socket:${eventName}` })
  })
  const connectCleanup = onSocketEvent('connect', () => {
    logInfo('Socket 已连上，立即补拉一次订单，避免重连窗口漏提醒')
    pollOrders()
    pollTownMessages()
  })
  const connectErrorCleanup = onSocketEvent('connect_error', (payload = {}) => {
    logWarn('Socket 连接失败，当前继续保留轮询兜底', payload)
  })
  state.socketCleanup = () => {
    reminderCleanup()
    connectCleanup()
    connectErrorCleanup()
  }
}

function resetRuntimeState() {
  stopOrderPollTimer()
  stopTownPollTimer()
  if (state.socketCleanup) {
    state.socketCleanup()
    state.socketCleanup = null
  }
  disconnectSocket()
  state.orderPollInFlight = false
  state.townPollInFlight = false
  state.orderSnapshot = new Map()
  state.townUnreadTotal = 0
  state.townInitialized = false
}

export function initReminderCenter() {
  if (state.initialized) {
    return
  }
  state.initialized = true
  bindPushClickListeners()
  logInfo('统一提醒中心已初始化')
}

export function setReminderAppVisibility(visible = true) {
  state.appVisible = !!visible
  restartOrderPolling()
  restartTownPolling()
}

export function syncReminderCenterSession({ token = '', userInfo = null } = {}) {
  const safeToken = safeText(token)
  const safeUser = userInfo && typeof userInfo === 'object' ? userInfo : null
  const isReady = !!safeToken && !!safeUser && isRiderAppUser(safeUser)

  if (!isReady) {
    state.token = ''
    state.userInfo = null
    resetRuntimeState()
    return false
  }

  const tokenChanged = state.token !== safeToken
  state.token = safeToken
  state.userInfo = safeUser

  if (tokenChanged) {
    state.orderSnapshot = new Map()
    state.townInitialized = false
    state.townUnreadTotal = 0
  }

  bindSocketReminderEvents()
  restartOrderPolling()
  restartTownPolling()

  if (!state.pollKickoffAt || tokenChanged) {
    state.pollKickoffAt = Date.now()
    pollOrders()
    pollTownMessages()
  }

  return true
}

export function refreshReminderCenterNow() {
  pollOrders()
  pollTownMessages()
}

export function stopReminderCenter() {
  state.token = ''
  state.userInfo = null
  resetRuntimeState()
}

export function emitNavigationReminder(payload = {}) {
  const orderId = safeId(payload.orderId)
  const level = safeText(payload.level || 'near')
  const stage = safeText(payload.stage || 'pickup')
  const title = safeText(payload.title || '导航提醒')
  const text = safeText(payload.text || '请注意前方导航节点')

  handleReminder({
    type: 'navigation',
    orderId,
    title,
    text,
    body: text,
    dedupeKey: `navigation:${orderId}:${stage}:${level}`,
    target: payload.target || null,
    meta: payload
  }, { source: 'navigation' })
}

export function openReminderTargetFromPushPayload(payload = {}) {
  const normalized = normalizePushPayload(payload)
  return openReminderTarget(normalized?.target || null)
}

export const REMINDER_CENTER_EVENTS = {
  reminder: REMINDER_EVENT_NAME,
  orderRefresh: ORDER_REFRESH_EVENT_NAME,
  townUnread: TOWN_UNREAD_EVENT_NAME,
  settingsChanged: SETTINGS_CHANGED_EVENT_NAME
}

export function notifyReminderSettingsChanged() {
  emitUniEvent(SETTINGS_CHANGED_EVENT_NAME, getReminderSettingsSnapshot())
}

export function getReminderCenterSnapshot() {
  return {
    route: getCurrentRoutePath(),
    routeOptions: getCurrentPageOptions(),
    appVisible: state.appVisible,
    tokenReady: !!state.token,
    townUnreadTotal: state.townUnreadTotal
  }
}
