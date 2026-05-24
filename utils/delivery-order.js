import {
  ORDER_STATUS,
  canRiderCallConfirmDeliveryApi,
  canRiderOfferSpecialComplete
} from '@/config/index.js'
import { getCurrentUserId } from '@/utils/delivery-identity.js'

export const DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS = 800
export const DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED = false

function normalizeText(value) {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

function normalizeAvailableActions(order = {}) {
  const list = Array.isArray(order.available_actions) ? order.available_actions : []
  return list.map(item => normalizeText(item)).filter(Boolean)
}

function getOrderOwnerId(order = {}) {
  // user_id 是下单用户，不是配送归属人，不能拿来判断骑手/自配送员是否可操作。
  const raw = order?.rider_id ?? order?.riderId ?? ''
  return raw === null || typeof raw === 'undefined' ? '' : String(raw)
}

function getOrderResponsibleId(order = {}) {
  const raw = order?.current_responsible_user_id ?? order?.currentResponsibleUserId ?? order?.rider_id ?? order?.riderId ?? ''
  return raw === null || typeof raw === 'undefined' ? '' : String(raw)
}

export function getOrderStatusText(status, { profile = {}, order = {} } = {}) {
  const backendText = normalizeText(order.status_text)
  if (backendText) {
    return backendText
  }
  if (profile.isMerchantSelfDelivery) {
    if (Number(status) === 3) return '待配送'
    if (Number(status) === 5) return '配送中'
  }
  return ORDER_STATUS[status]?.text || '未知'
}

export function hasOrderOwnership(order = {}, user = {}, { allowMerchantPending = true } = {}) {
  const currentUserId = getCurrentUserId(user)
  const orderOwnerId = getOrderOwnerId(order)
  const responsibleId = getOrderResponsibleId(order)
  const isMerchantPending =
    allowMerchantPending &&
    Number(order?.status) === 3 &&
    !orderOwnerId &&
    !responsibleId

  if (isMerchantPending) {
    return true
  }

  if (!currentUserId) {
    return false
  }

  return currentUserId === orderOwnerId || currentUserId === responsibleId
}

export function canStartSelfDelivery(order = {}, profile = {}, owned = false) {
  const actions = normalizeAvailableActions(order)
  if (actions.includes('start_delivery')) {
    return owned
  }
  return profile.isMerchantSelfDelivery && Number(order.status) === 3 && owned
}

export function canCompleteSelfDelivery(order = {}, profile = {}, owned = false) {
  const actions = normalizeAvailableActions(order)
  if (actions.includes('complete_delivery')) {
    return owned
  }
  return profile.isMerchantSelfDelivery && Number(order.status) === 5 && owned
}

export function getPrimaryDeliveryAction(order = {}, { profile = {}, owned = false } = {}) {
  if (canStartSelfDelivery(order, profile, owned)) {
    return {
      key: 'start_delivery',
      text: '开始配送',
      visible: true
    }
  }

  if (canCompleteSelfDelivery(order, profile, owned)) {
    return {
      key: 'complete_delivery',
      text: '确认送达',
      visible: true
    }
  }

  if (
    owned &&
    canRiderCallConfirmDeliveryApi(order.status)
  ) {
    return {
      key: 'complete_delivery',
      text: '确认送达',
      visible: true
    }
  }

  return {
    key: '',
    text: '',
    visible: false
  }
}

export function getConfirmDeliveryHint(order = {}, {
  profile = {},
  owned = false,
  distanceLoading = false,
  distanceMeters = null,
  distanceError = ''
} = {}) {
  if (!owned) {
    return ''
  }

  if (profile.isMerchantSelfDelivery) {
    if (Number(order.status) === 3) {
      return '当前订单已出餐，可由自配送员开始配送'
    }
    if (Number(order.status) === 5) {
      return '确认订单已送达后即可完成本次自配送'
    }
    return '当前订单暂不可执行自配送操作'
  }

  if (!canRiderCallConfirmDeliveryApi(order.status)) {
    return '订单未进入配送中，暂不可确认送达'
  }
  if (!DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED) {
    return '测试期间已放开距离限制，可直接确认送达'
  }
  if (distanceLoading) {
    return '正在校验骑手与用户距离...'
  }
  if (distanceError) {
    return distanceError
  }
  if (typeof distanceMeters === 'number') {
    const meters = Math.round(distanceMeters)
    if (meters <= DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS) {
      return `距用户约 ${meters} 米，已满足确认送达条件`
    }
    return `距用户约 ${meters} 米，需在 ${DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS} 米内才能确认送达`
  }
  return `需在距用户 ${DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS} 米内才能确认送达`
}

export function canShowSpecialComplete(order = {}, owned = false) {
  return owned &&
    canRiderOfferSpecialComplete(order.status) &&
    !canRiderCallConfirmDeliveryApi(order.status)
}
