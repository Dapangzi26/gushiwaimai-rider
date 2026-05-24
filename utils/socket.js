import { io } from 'socket.io-client'
import { BASE_URL } from '../config/index.js'

let socket = null
let socketToken = ''
let currentSocketId = ''
const listenerRegistry = new Map()
const coreEventHandlers = new Map()

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

function buildSocketTransports() {
  return ['polling', 'websocket']
}

function buildSocketOptions(token) {
  const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  const baseOptions = {
    path: '/socket.io',
    auth: { token: bearer },
    transports: buildSocketTransports(),
    upgrade: true,
    tryAllTransports: true,
    autoConnect: true,
    withCredentials: false,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 60000,
    forceNew: true,
    rememberUpgrade: false,
    query: {
      token: bearer,
      role: 'rider'
    },
    extraHeaders: {
      Authorization: bearer,
      token: bearer
    }
  }

  return baseOptions
}

function cleanupCoreHandlers() {
  if (!socket) {
    coreEventHandlers.clear()
    return
  }
  coreEventHandlers.forEach((handler, eventName) => {
    socket.off(eventName, handler)
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
    const errorPayload = {
      message: error?.message || '',
      description: error?.description || '',
      context: error?.context || '',
      type: error?.type || '',
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

  const socketBaseUrl = sanitizeSocketUrl(BASE_URL)

  console.log('[socket] 开始初始化连接', {
    baseUrl: BASE_URL,
    connectUrl: socketBaseUrl,
    tokenLength: safeToken.length,
    hasToken: !!safeToken,
    transports: buildSocketTransports()
  })

  socket = io(socketBaseUrl, buildSocketOptions(safeToken))
  bindCoreListeners()
  return socket
}

function destroySocket() {
  if (socket) {
    cleanupCoreHandlers()
    socket.disconnect()
    socket = null
  }
  socketToken = ''
  currentSocketId = ''
}

export function initSocket(token) {
  const safeToken = String(token || '').trim()
  if (!safeToken) {
    console.warn('[socket] 跳过初始化：token 为空')
    return null
  }

  if (isAppPlatform()) {
    if (socket) {
      destroySocket()
    }
    console.log('[socket] App 端已禁用实时 Socket，统一走 HTTP 轮询兜底')
    return null
  }

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
