export const TENCENT_NAV_STAGE = {
  PICKUP: 'pickup',
  DELIVERY: 'delivery'
}

export function maskKey(key = '') {
  const text = String(key || '').trim()
  if (!text) {
    return '未配置'
  }
  if (text.length <= 8) {
    return '已配置'
  }
  return `${text.slice(0, 4)}****${text.slice(-4)}`
}

export function normalizeTestParams(input = {}) {
  const stage = input.stage === TENCENT_NAV_STAGE.DELIVERY ? TENCENT_NAV_STAGE.DELIVERY : TENCENT_NAV_STAGE.PICKUP
  return {
    stage,
    orderId: String(input.orderId || ''),
    riderLng: toNumber(input.riderLng),
    riderLat: toNumber(input.riderLat),
    merchantLng: toNumber(input.merchantLng),
    merchantLat: toNumber(input.merchantLat),
    customerLng: toNumber(input.customerLng),
    customerLat: toNumber(input.customerLat)
  }
}

export function buildTestSummary(input = {}) {
  const params = normalizeTestParams(input)
  const target = params.stage === TENCENT_NAV_STAGE.DELIVERY ? '送餐' : '取餐'
  return [
    `测试阶段：${target}`,
    `骑手坐标：${params.riderLng}, ${params.riderLat}`,
    `商家坐标：${params.merchantLng}, ${params.merchantLat}`,
    `用户坐标：${params.customerLng}, ${params.customerLat}`
  ]
}

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}
