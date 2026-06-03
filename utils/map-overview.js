import { ORDER_STATUS } from '@/config/index.js'
import { hasOrderOwnership } from '@/utils/delivery-order.js'

// 这个文件专门管“骑手多订单地图总览”相关的数据整理。
// 以后只要是“从订单列表里筛活跃单、提用户坐标、确定当前高亮单”，都从这里走，别再散在页面里各写一套。

export function safeText(value) {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

function getCoordinateByKeys(source = {}, keys = []) {
  for (let i = 0; i < keys.length; i++) {
    const value = source[keys[i]]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return ''
}

function parseAddressForOrder(order = {}) {
  try {
    return typeof order.delivery_address === 'string'
      ? JSON.parse(order.delivery_address)
      : (order.delivery_address || {})
  } catch (error) {
    return {}
  }
}

export function hasValidCoords(coords = {}) {
  const lng = Number(coords.lng)
  const lat = Number(coords.lat)
  return Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0)
}

export function extractRiderOrderList(res) {
  const candidates = [
    res?.data?.data,
    res?.data,
    res?.rows,
    res
  ]
  return candidates.find(item => Array.isArray(item)) || []
}

export function isActiveMapOrderStatus(status, stage = 'delivery') {
  const normalizedStage = safeText(stage) === 'pickup' ? 'pickup' : 'delivery'
  const numericStatus = Number(status)
  if (normalizedStage === 'pickup') {
    return [2, 3, 4].includes(numericStatus)
  }
  return numericStatus === 5
}

export function getCustomerCoords(order = {}) {
  const address = parseAddressForOrder(order)
  const lng = getCoordinateByKeys(order, ['customer_lng', 'delivery_longitude', 'longitude', 'delivery_lng', 'deliveryLng', 'user_lng', 'userLng', 'contact_lng', 'receiver_lng', 'to_lng', 'dest_lng', 'customerLng'])
    || getCoordinateByKeys(address, ['customer_lng', 'delivery_longitude', 'longitude', 'lng', 'delivery_lng', 'deliveryLng', 'user_lng', 'receiver_lng', 'to_lng', 'dest_lng', 'customerLng'])
  const lat = getCoordinateByKeys(order, ['customer_lat', 'delivery_latitude', 'latitude', 'delivery_lat', 'deliveryLat', 'user_lat', 'userLat', 'contact_lat', 'receiver_lat', 'to_lat', 'dest_lat', 'customerLat'])
    || getCoordinateByKeys(address, ['customer_lat', 'delivery_latitude', 'latitude', 'lat', 'delivery_lat', 'deliveryLat', 'user_lat', 'receiver_lat', 'to_lat', 'dest_lat', 'customerLat'])
  return { lng, lat }
}

export function getMerchantCoords(order = {}) {
  const address = parseAddressForOrder(order)
  const merchant = order?.merchant || {}
  const lng = getCoordinateByKeys(order, ['merchant_lng', 'merchantLng', 'shop_lng', 'shopLng', 'store_lng', 'storeLng', 'pickup_lng', 'pickupLng', 'from_lng', 'fromLng'])
    || getCoordinateByKeys(merchant, ['merchant_lng', 'merchantLng', 'lng', 'lat_lng', 'longitude', 'lon', 'map_lng'])
    || getCoordinateByKeys(address, ['merchant_lng', 'shop_lng', 'store_lng', 'pickup_lng', 'from_lng'])
  const lat = getCoordinateByKeys(order, ['merchant_lat', 'merchantLat', 'shop_lat', 'shopLat', 'store_lat', 'storeLat', 'pickup_lat', 'pickupLat', 'from_lat', 'fromLat'])
    || getCoordinateByKeys(merchant, ['merchant_lat', 'merchantLat', 'lat', 'latitude', 'map_lat'])
    || getCoordinateByKeys(address, ['merchant_lat', 'shop_lat', 'store_lat', 'pickup_lat', 'from_lat'])
  return { lng, lat }
}

function getStatusText(order = {}) {
  const backendText = safeText(order.status_text)
  if (backendText) {
    return backendText
  }
  return ORDER_STATUS[Number(order.status)]?.text || `状态${safeText(order.status) || '未知'}`
}

function maskPrivacyName(name = '') {
  const value = safeText(name)
  if (!value) {
    return ''
  }
  if (value.length <= 1) {
    return `${value}*`
  }
  return `${value.slice(0, 1)}${'*'.repeat(Math.max(1, value.length - 1))}`
}

function maskPrivacyPhone(phone = '') {
  const value = safeText(phone).replace(/\s+/g, '')
  if (!value) {
    return ''
  }
  if (value.length >= 11) {
    return `${value.slice(0, 3)}****${value.slice(-4)}`
  }
  if (value.length >= 7) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`
  }
  if (value.length <= 2) {
    return `${value}*`
  }
  return `${value.slice(0, 1)}***${value.slice(-1)}`
}

function parseProductsInfo(order = {}) {
  const candidates = [
    order.products_info,
    order.productsInfo,
    order.order_items,
    order.orderItems,
    order.items_json,
    order.items
  ]
  const source = candidates.find(item => item !== undefined && item !== null && item !== '')
  if (Array.isArray(source)) {
    return source
  }
  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      return []
    }
  }
  return []
}

function buildGoodsSummaryList(order = {}) {
  const goodsList = parseProductsInfo(order)
  return goodsList
    .map(item => {
      const name = safeText(
        item?.product_name
        || item?.goods_name
        || item?.name
        || item?.title
        || item?.productName
      )
      const quantity = Number(
        item?.quantity
        ?? item?.count
        ?? item?.num
        ?? item?.amount
        ?? item?.qty
        ?? 1
      )
      if (!name) {
        return ''
      }
      return quantity > 1 ? `${name} x${quantity}` : name
    })
    .filter(Boolean)
}

function getMerchantName(order = {}) {
  return safeText(
    order?.merchant_name
    || order?.merchantName
    || order?.merchant?.name
    || order?.shop_name
    || order?.store_name
  )
}

function getContactName(order = {}) {
  return safeText(
    order?.contact_name
    || order?.contactName
    || order?.receiver_name
    || order?.receiverName
    || order?.user?.nickname
  )
}

function getContactPhone(order = {}) {
  return safeText(
    order?.contact_phone
    || order?.contactPhone
    || order?.receiver_phone
    || order?.receiverPhone
    || order?.user?.phone
  )
}

function buildOrderLabel(order = {}) {
  const orderNo = safeText(order.order_no || order.orderNo)
  if (orderNo) {
    return `尾号${orderNo.slice(-4)}`
  }
  const fallbackId = safeText(order.id)
  return fallbackId ? `订单${fallbackId.slice(-4)}` : '订单'
}

// 地图总览这里要严格区分“取餐”和“送货”：
// 1. 送货总览只能看已经取完餐、真正进入配送中的单，不然骑手会分不清哪些餐已经在手上。
// 2. 取餐阶段后面如果要扩，也只能看待取餐单，不能和送货用户点混在一起。
export function buildRiderOverviewOrders(orderList = [], { currentOrderId = '', user = {}, stage = 'delivery' } = {}) {
  const currentIdText = safeText(currentOrderId)
  const normalizedStage = safeText(stage) === 'pickup' ? 'pickup' : 'delivery'
  return orderList
    .filter(item => isActiveMapOrderStatus(item?.status, normalizedStage))
    .filter(item => hasOrderOwnership(item, user))
    .map(item => {
      const customerCoords = getCustomerCoords(item)
      if (!hasValidCoords(customerCoords)) {
        return null
      }
      const merchantCoords = getMerchantCoords(item)
      const orderId = safeText(item?.id)
      return {
        id: orderId,
        orderNo: safeText(item?.order_no || item?.orderNo),
        label: buildOrderLabel(item),
        status: Number(item?.status || 0),
        statusText: getStatusText(item),
        merchantName: getMerchantName(item),
        privacyContactName: maskPrivacyName(getContactName(item)),
        privacyContactPhone: maskPrivacyPhone(getContactPhone(item)),
        goodsSummaryList: buildGoodsSummaryList(item),
        // 订单里的商家 / 用户坐标当前统一按业务坐标 WGS84 存库。
        // 后面只要进入腾讯地图或腾讯导航，再由消费端明确转成 GCJ02，
        // 这样可以避免不同页面各自猜坐标系，最后出现“一边在左、一边在右”的偏移问题。
        customerLng: String(customerCoords.lng || ''),
        customerLat: String(customerCoords.lat || ''),
        merchantLng: String(merchantCoords.lng || ''),
        merchantLat: String(merchantCoords.lat || ''),
        customerCoordType: 'wgs84',
        merchantCoordType: 'wgs84',
        isCurrent: currentIdText !== '' && orderId === currentIdText
      }
    })
    .filter(Boolean)
}

export function findOverviewOrder(orderList = [], orderId = '') {
  const targetId = safeText(orderId)
  return orderList.find(item => safeText(item?.id) === targetId) || null
}
