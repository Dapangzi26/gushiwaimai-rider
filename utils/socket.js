// 这个文件是“骑手端 Socket 实时连接封装”。
// 它专门负责：
// 1. 创建和销毁 socket.io 连接
// 2. 统一处理 connect / disconnect / connect_error
// 3. 给提醒中心暴露新订单、转派、取消等实时事件
//
// 这次重点修的是 App 端从项目初期就一直存在的 timeout 问题。
// 根因不是后端没开，而是 App 端沿用了“polling -> websocket 升级”的默认策略，
// 在 uni-app 的 app-plus 运行时里一直没有稳定连通过。
import { io } from 'socket.io-client'
import { BASE_URL } from '../config/index.js'

let socket = null
let socketToken = ''
let currentSocketId = ''
let currentSocketTraceId = ''
let nativeSocketTask = null
let nativeReconnectTimer = null
let nativeConnectTimer = null
let nativeReconnectAttempts = 0
let nativeManualClose = false
let nativeSocketGeneration = 0
const listenerRegistry = new Map()
const coreEventHandlers = new Map()
const NATIVE_SOCKET_CONNECT_TIMEOUT_MS = 15000
const NATIVE_SOCKET_RECONNECT_MAX_ATTEMPTS = 20
const NATIVE_SOCKET_RECONNECT_DELAY_MS = 1000
const NATIVE_SOCKET_RECONNECT_DELAY_MAX_MS = 30000
// #region debug-point A:socket-report
const DEBUG_SOCKET_REPORT_URL = 'http://192.168.1.9:7778/event'
const DEBUG_SOCKET_SESSION_ID = 'socket-timeout'
const DEBUG_SOCKET_RUN_ID = 'pre-fix'
const DEBUG_SOCKET_REPORT_ENABLED = false
function reportSocketDebug(hypothesisId, msg, data = {}) {
  if (!DEBUG_SOCKET_REPORT_ENABLED) {
    return
  }
  const payload = {
    sessionId: DEBUG_SOCKET_SESSION_ID,
    runId: DEBUG_SOCKET_RUN_ID,
    hypothesisId,
    traceId: currentSocketTraceId || '',
    location: 'utils/socket.js',
    msg,
    data,
    ts: Date.now()
  }
  try {
    // App 真机里不一定有 fetch。
    // 这里如果直接调用 fetch，会在真正创建 socket 之前先抛错，
    // 最后表现成“既没有连接成功，也没有连接失败”，把真实现象盖住。
    if (typeof uni !== 'undefined' && typeof uni.request === 'function') {
      uni.request({
        url: DEBUG_SOCKET_REPORT_URL,
        method: 'POST',
        data: payload,
        header: {
          'Content-Type': 'application/json'
        },
        fail: () => {}
      })
      return
    }
    if (typeof fetch === 'function') {
      fetch(DEBUG_SOCKET_REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {})
    }
  } catch (error) {}
}
// #endregion

export const REMINDER_SOCKET_EVENTS = [
  'reminder_event',
  'new_delivery',
  'order_assigned',
  'order_transfer',
  'order_reassign',
  'order_cancelled',
  'order_timeout_warning',
  'merchant_ready',
  'dispatch_notice',
  'station_notice',
  'town_message_notice'
]

function ensureListenerSet(eventName) {
  if (!listenerRegistry.has(eventName)) {
    listenerRegistry.set(eventName, new Set())
  }
  return listenerRegistry.get(eventName)
}

function dispatchEvent(eventName, payload) {
  const listeners = listenerRegistry.get(eventName)
  if (!listeners || !listeners.size) {
    return
  }

  listeners.forEach((callback) => {
    try {
      callback(payload, eventName)
    } catch (error) {
      console.error(`[socket] 事件监听执行失败: ${eventName}`, error)
    }
  })
}

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

function sanitizeSocketUrl(url) {
  return String(url || '')
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\/+$/, '')
}

function resolveSocketConnectUrl(baseUrl) {
  const normalized = sanitizeSocketUrl(baseUrl)
  if (!normalized) {
    return ''
  }
  return normalized
}

function buildNativeSocketUrl(baseUrl, bearer, traceId = '') {
  const normalized = resolveSocketConnectUrl(baseUrl)
  if (!normalized) {
    return ''
  }

  const wsBaseUrl = normalized
    .replace(/^https:\/\//i, 'wss://')
    .replace(/^http:\/\//i, 'ws://')
    .replace(/\/+$/, '')

  const query = [
    'EIO=4',
    'transport=websocket',
    `token=${encodeURIComponent(bearer)}`,
    'role=rider',
    `debugTraceId=${encodeURIComponent(traceId || '')}`
  ].join('&')

  return `${wsBaseUrl}/socket.io/?${query}`
}

function buildSocketTransports() {
  if (isAppPlatform()) {
    return ['websocket']
  }
  return ['polling', 'websocket']
}

function buildSocketQuery(bearer, traceId = '') {
  return {
    token: bearer,
    role: 'rider',
    debugTraceId: traceId || ''
  }
}

function buildSocketAuth(bearer) {
  return { token: bearer }
}

function buildSocketExtraHeaders(bearer) {
  // H5 不需要自定义 header，App 端这里也不再额外塞 header。
  // 原因是 query + auth 已经够后端识别，继续多头塞参数只会把握手链路搞复杂，
  // 后面排查“到底哪种握手方式生效了”会越来越难。
  void bearer
  return undefined
}

function buildSocketOptions(token, traceId = '') {
  const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  const appRuntime = isAppPlatform()
  const baseOptions = {
    path: '/socket.io',
    auth: buildSocketAuth(bearer),
    transports: buildSocketTransports(),
    // App 端这次改成 websocket 直连，不再走升级链。
    // H5 仍保留原来的多传输兼容策略。
    upgrade: !appRuntime,
    tryAllTransports: !appRuntime,
    autoConnect: true,
    withCredentials: false,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 60000,
    forceNew: true,
    rememberUpgrade: appRuntime,
    query: buildSocketQuery(bearer, traceId)
  }

  const extraHeaders = buildSocketExtraHeaders(bearer)
  if (extraHeaders && typeof extraHeaders === 'object') {
    baseOptions.extraHeaders = extraHeaders
  }

  return baseOptions
}

function clearNativeTimers() {
  if (nativeConnectTimer) {
    clearTimeout(nativeConnectTimer)
    nativeConnectTimer = null
  }
  if (nativeReconnectTimer) {
    clearTimeout(nativeReconnectTimer)
    nativeReconnectTimer = null
  }
}

function createNativeSocketFacade() {
  return {
    id: currentSocketId,
    connected: false,
    io: {
      engine: {
        transport: {
          name: 'websocket'
        },
        readyState: ''
      },
      on() {}
    },
    nsp: '/',
    connect() {
      if (socketToken) {
        createNativeSocket(socketToken, { reconnect: true })
      }
    },
    disconnect() {
      destroyNativeSocket()
    },
    emit(eventName, payload) {
      if (!eventName) {
        return false
      }
      return sendNativeSocketPacket(`42${JSON.stringify([eventName, payload])}`)
    },
    on() {},
    off() {}
  }
}

function updateNativeSocketFacade(connected) {
  if (!socket) {
    socket = createNativeSocketFacade()
  }
  socket.id = currentSocketId
  socket.connected = !!connected
  if (socket.io?.engine) {
    socket.io.engine.readyState = connected ? 'open' : 'closed'
  }
}

function sendNativeSocketPacket(packet) {
  if (!nativeSocketTask || !packet) {
    return false
  }
  try {
    nativeSocketTask.send({
      data: packet,
      fail: (error) => {
        console.warn('[socket:native] send failed', error)
      }
    })
    return true
  } catch (error) {
    console.warn('[socket:native] send exception', error)
    return false
  }
}

function dispatchNativeConnect(socketId = '') {
  nativeReconnectAttempts = 0
  clearNativeTimers()
  currentSocketId = socketId || currentSocketId || ''
  updateNativeSocketFacade(true)
  console.log('[socket:native] connected', {
    socketId: currentSocketId,
    transport: 'websocket'
  })
  console.log('Socket 已连接', {
    socketId: currentSocketId,
    transport: 'websocket',
    channel: 'native'
  })
  dispatchEvent('connect', {
    connected: true,
    socketId: currentSocketId
  })
}

function dispatchNativeConnectError(message, extra = {}) {
  const errorPayload = {
    message: message || 'native websocket error',
    description: extra.description || '',
    context: extra.context || '',
    type: extra.type || 'NativeWebSocketError',
    platform: 'app',
    transports: ['websocket'],
    tokenLength: socketToken ? socketToken.length : 0,
    baseUrl: BASE_URL
  }
  reportSocketDebug('A', '[DEBUG] rider native socket connect_error', {
    ...errorPayload,
    ...extra,
    connected: !!socket?.connected,
    socketId: currentSocketId || ''
  })
  console.error('[socket:native] connect failed', errorPayload)
  dispatchEvent('connect_error', errorPayload)
}

function scheduleNativeReconnect(reason = '') {
  if (nativeManualClose || !socketToken) {
    return
  }
  if (nativeReconnectAttempts >= NATIVE_SOCKET_RECONNECT_MAX_ATTEMPTS) {
    dispatchNativeConnectError('native websocket reconnect attempts exhausted', { reason })
    return
  }

  nativeReconnectAttempts += 1
  const baseDelay = Math.min(
    NATIVE_SOCKET_RECONNECT_DELAY_MS * Math.pow(2, nativeReconnectAttempts - 1),
    NATIVE_SOCKET_RECONNECT_DELAY_MAX_MS
  )
  const jitter = Math.floor(Math.random() * 1000)
  const delay = baseDelay + jitter

  clearNativeTimers()
  nativeReconnectTimer = setTimeout(() => {
    createNativeSocket(socketToken, { reconnect: true })
  }, delay)
}

function handleNativeSocketMessage(rawData, bearer) {
  const data = typeof rawData === 'string' ? rawData : String(rawData || '')
  if (!data) {
    return
  }

  const packetType = data.charAt(0)
  if (packetType === '0') {
    sendNativeSocketPacket(`40${JSON.stringify({ token: bearer })}`)
    return
  }

  if (data.startsWith('40')) {
    const payloadText = data.slice(2)
    let socketId = ''
    if (payloadText) {
      try {
        socketId = JSON.parse(payloadText)?.sid || ''
      } catch (error) {}
    }
    dispatchNativeConnect(socketId)
    return
  }

  if (packetType === '2') {
    sendNativeSocketPacket('3')
    return
  }

  if (data.startsWith('42')) {
    try {
      const payload = JSON.parse(data.slice(2))
      const eventName = payload?.[0]
      if (!eventName) {
        return
      }
      dispatchEvent(eventName, payload?.[1])
    } catch (error) {
      console.warn('[socket:native] event parse failed', error)
    }
    return
  }

  if (data.startsWith('44')) {
    let message = 'Unauthorized'
    try {
      message = JSON.parse(data.slice(2))?.message || message
    } catch (error) {}
    dispatchNativeConnectError(message, { packet: data })
  }
}

function createNativeSocket(token, options = {}) {
  const safeToken = String(token || '').trim()
  if (!safeToken) {
    return null
  }

  const bearer = safeToken.startsWith('Bearer ') ? safeToken : `Bearer ${safeToken}`
  if (!options.reconnect) {
    nativeReconnectAttempts = 0
  }
  nativeManualClose = false
  currentSocketTraceId = currentSocketTraceId || `sock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const generation = nativeSocketGeneration + 1

  const socketUrl = buildNativeSocketUrl(BASE_URL, bearer, currentSocketTraceId)
  if (!socketUrl || typeof uni === 'undefined' || typeof uni.connectSocket !== 'function') {
    dispatchNativeConnectError('native websocket unavailable', { socketUrl })
    return null
  }

  nativeSocketGeneration = generation
  try {
    if (nativeSocketTask && typeof nativeSocketTask.close === 'function') {
      nativeSocketTask.close({ code: 1000, reason: 'reconnect' })
    }
  } catch (error) {}

  clearNativeTimers()
  updateNativeSocketFacade(false)
  console.log('[socket:native] connecting', {
    baseUrl: BASE_URL,
    platform: 'app',
    reconnect: !!options.reconnect,
    attempt: nativeReconnectAttempts,
    transports: ['websocket']
  })
  reportSocketDebug('A', '[DEBUG] rider native socket create', {
    baseUrl: BASE_URL,
    connectUrl: socketUrl.replace(/token=[^&]*/g, 'token=***'),
    platform: 'app',
    transports: ['websocket'],
    reconnect: !!options.reconnect,
    attempt: nativeReconnectAttempts,
    hasToken: !!safeToken,
    tokenLength: safeToken.length
  })

  nativeSocketTask = uni.connectSocket({
    url: socketUrl,
    complete: () => {}
  })
  if (!nativeSocketTask || typeof nativeSocketTask.onOpen !== 'function') {
    dispatchNativeConnectError('native websocket task unavailable')
    scheduleNativeReconnect('task_unavailable')
    return socket
  }

  nativeConnectTimer = setTimeout(() => {
    if (generation !== nativeSocketGeneration) {
      return
    }
    if (socket?.connected) {
      return
    }
    dispatchNativeConnectError('native websocket connect timeout')
    try {
      nativeSocketTask?.close?.({ code: 1000, reason: 'connect_timeout' })
    } catch (error) {}
    scheduleNativeReconnect('connect_timeout')
  }, NATIVE_SOCKET_CONNECT_TIMEOUT_MS)

  nativeSocketTask.onOpen(() => {
    if (generation !== nativeSocketGeneration) {
      return
    }
    reportSocketDebug('A', '[DEBUG] rider native websocket open', {
      traceId: currentSocketTraceId
    })
  })

  nativeSocketTask.onMessage((message = {}) => {
    if (generation !== nativeSocketGeneration) {
      return
    }
    handleNativeSocketMessage(message.data, bearer)
  })

  nativeSocketTask.onError((error = {}) => {
    if (generation !== nativeSocketGeneration) {
      return
    }
    updateNativeSocketFacade(false)
    dispatchNativeConnectError(error?.errMsg || 'native websocket error', { error })
    scheduleNativeReconnect('error')
  })

  nativeSocketTask.onClose((event = {}) => {
    if (generation !== nativeSocketGeneration) {
      return
    }
    const wasConnected = !!socket?.connected
    clearNativeTimers()
    updateNativeSocketFacade(false)
    if (wasConnected) {
      dispatchEvent('disconnect', {
        connected: false,
        reason: event?.reason || event?.errMsg || 'native websocket closed'
      })
    }
    scheduleNativeReconnect(event?.reason || event?.errMsg || 'close')
  })

  return socket
}

function destroyNativeSocket() {
  nativeManualClose = true
  nativeSocketGeneration += 1
  clearNativeTimers()
  if (nativeSocketTask) {
    try {
      nativeSocketTask.close({ code: 1000, reason: 'manual_close' })
    } catch (error) {}
    nativeSocketTask = null
  }
  if (socket) {
    socket.connected = false
  }
}

function cleanupCoreHandlers() {
  if (!socket) {
    coreEventHandlers.clear()
    return
  }
  coreEventHandlers.forEach((handler, eventName) => {
    if (typeof socket.off === 'function') {
      socket.off(eventName, handler)
    }
  })
  coreEventHandlers.clear()
}

function bindCoreListeners() {
  if (!socket) {
    return
  }

  const connectHandler = () => {
    currentSocketId = socket?.id || ''
    console.log('Socket 已连接', {
      socketId: currentSocketId,
      transport: socket?.io?.engine?.transport?.name || ''
    })
    dispatchEvent('connect', {
      connected: true,
      socketId: currentSocketId
    })
  }

  const disconnectHandler = (reason) => {
    console.log('Socket 已断开', reason)
    dispatchEvent('disconnect', { connected: false, reason: reason || '' })
  }

  const connectErrorHandler = (error) => {
    // #region debug-point A:connect-error
    reportSocketDebug('A', '[DEBUG] rider socket connect_error', {
      message: error?.message || '',
      description: error?.description || '',
      context: error?.context || '',
      type: error?.type || '',
      platform: isAppPlatform() ? 'app' : 'non-app',
      transports: buildSocketTransports(),
      connected: !!socket?.connected,
      socketId: socket?.id || '',
      transportName: socket?.io?.engine?.transport?.name || '',
      readyState: socket?.io?.engine?.readyState || '',
      uri: socket?.io?.uri || '',
      nsp: socket?.nsp || ''
    })
    // #endregion
    const errorPayload = {
      message: error?.message || '',
      description: error?.description || '',
      context: error?.context || '',
      type: error?.type || '',
      platform: isAppPlatform() ? 'app' : 'non-app',
      transports: buildSocketTransports(),
      tokenLength: socketToken ? socketToken.length : 0,
      baseUrl: BASE_URL
    }
    console.error('Socket 连接失败', errorPayload)
    dispatchEvent('connect_error', errorPayload)
  }

  socket.on('connect', connectHandler)
  socket.on('disconnect', disconnectHandler)
  socket.on('connect_error', connectErrorHandler)
  coreEventHandlers.set('connect', connectHandler)
  coreEventHandlers.set('disconnect', disconnectHandler)
  coreEventHandlers.set('connect_error', connectErrorHandler)

  REMINDER_SOCKET_EVENTS.forEach((eventName) => {
    const handler = (payload) => {
      dispatchEvent(eventName, payload)
    }
    socket.on(eventName, handler)
    coreEventHandlers.set(eventName, handler)
  })
}

function createSocket(token) {
  const safeToken = String(token || '').trim()
  if (!safeToken) {
    return null
  }
  currentSocketTraceId = `sock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const socketBaseUrl = resolveSocketConnectUrl(BASE_URL)
  if (isAppPlatform() && typeof uni !== 'undefined' && typeof uni.connectSocket === 'function') {
    return createNativeSocket(safeToken)
  }

  console.log('[socket] 开始初始化连接', {
    baseUrl: BASE_URL,
    connectUrl: socketBaseUrl,
    platform: isAppPlatform() ? 'app' : 'non-app',
    tokenLength: safeToken.length,
    hasToken: !!safeToken,
    transports: buildSocketTransports()
  })
  // #region debug-point A:create-socket
  reportSocketDebug('A', '[DEBUG] rider socket create', {
    baseUrl: BASE_URL,
    connectUrl: socketBaseUrl,
    platform: isAppPlatform() ? 'app' : 'non-app',
    transports: buildSocketTransports(),
    hasToken: !!safeToken,
    tokenLength: safeToken.length
  })
  // #endregion

  socket = io(socketBaseUrl, buildSocketOptions(safeToken, currentSocketTraceId))
  // #region debug-point A:manager-error
  socket.io.on('error', (managerError) => {
    reportSocketDebug('A', '[DEBUG] rider socket manager error', {
      message: managerError?.message || '',
      description: managerError?.description || '',
      context: managerError?.context || '',
      type: managerError?.type || '',
      transportName: socket?.io?.engine?.transport?.name || '',
      readyState: socket?.io?.engine?.readyState || ''
    })
  })
  // #endregion
  bindCoreListeners()
  return socket
}

function destroySocket() {
  destroyNativeSocket()
  if (socket) {
    cleanupCoreHandlers()
    if (typeof socket.disconnect === 'function') {
      socket.disconnect()
    }
    socket = null
  }
  socketToken = ''
  currentSocketId = ''
  currentSocketTraceId = ''
}

export function initSocket(token) {
  const safeToken = String(token || '').trim()
  if (!safeToken) {
    console.warn('[socket] 跳过初始化：token 为空')
    return null
  }

  // 这里不能再把 App 端实时链路直接关掉。
  // 之前一旦走到这个分支，骑手端就只能靠 5 秒轮询“碰运气”收新单，
  // 商家点击接单后天然做不到“马上语音提醒”。
  // 现在统一让 H5 / App 都优先走 Socket，轮询只保留兜底。
  console.log('[socket] 准备初始化实时 Socket 连接', {
    platform: isAppPlatform() ? 'app' : 'non-app'
  })

  if (socket && socketToken === safeToken) {
    if (!socket.connected && typeof socket.connect === 'function') {
      socket.connect()
    }
    return socket
  }

  destroySocket()
  socketToken = safeToken
  return createSocket(safeToken)
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  destroySocket()
}

export function onNewDelivery(callback) {
  return onSocketEvent('new_delivery', callback)
}

export function onSocketEvent(eventName, callback) {
  if (!eventName || typeof callback !== 'function') {
    return () => {}
  }
  const listeners = ensureListenerSet(eventName)
  listeners.add(callback)
  return () => offSocketEvent(eventName, callback)
}

export function offSocketEvent(eventName, callback) {
  const listeners = listenerRegistry.get(eventName)
  if (!listeners) {
    return
  }

  if (typeof callback === 'function') {
    listeners.delete(callback)
  } else {
    listeners.clear()
  }
}

export function onReminderEvents(callback, eventNames = REMINDER_SOCKET_EVENTS) {
  const list = Array.isArray(eventNames) ? eventNames : REMINDER_SOCKET_EVENTS
  const cleanups = list.map((eventName) => onSocketEvent(eventName, callback))
  return () => {
    cleanups.forEach((cleanup) => cleanup())
  }
}

export function offAllListeners() {
  listenerRegistry.clear()
}

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  onNewDelivery,
  onSocketEvent,
  offSocketEvent,
  onReminderEvents,
  REMINDER_SOCKET_EVENTS,
  offAllListeners
}
