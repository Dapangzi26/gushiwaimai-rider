import { wgs84ToGcj02 } from '@/utils/coord-transform.js'

export function hasValidCoords(coords = {}) {
  const lng = Number(coords.lng)
  const lat = Number(coords.lat)
  return Number.isFinite(lng) && Number.isFinite(lat) && lng !== 0 && lat !== 0
}

export function normalizeLocationCoords(location = {}, coordinateType = 'gcj02') {
  const lng = Number(location.longitude)
  const lat = Number(location.latitude)
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !lng || !lat) {
    return { lng: '', lat: '' }
  }
  if (coordinateType === 'wgs84') {
    const converted = wgs84ToGcj02(lng, lat)
    if (!hasValidCoords(converted)) {
      return { lng: '', lat: '' }
    }
    return converted
  }
  return { lng, lat }
}

export function requestNavigationLocation(type = 'gcj02', extraOptions = {}) {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type,
      isHighAccuracy: true,
      highAccuracyExpireTime: 8000,
      ...extraOptions,
      success: resolve,
      fail: reject
    })
  }).then((location) => normalizeLocationCoords(location, type))
}

export function getCachedRiderCoords() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null
    const getter = app?.globalData?.getLatestRiderLocation
    const sample = typeof getter === 'function' ? getter() : app?.globalData?.latestRiderLocation
    const lng = Number(sample?.longitude ?? sample?.lng ?? 0)
    const lat = Number(sample?.latitude ?? sample?.lat ?? 0)
    if (!hasValidCoords({ lng, lat })) {
      return { lng: '', lat: '' }
    }
    return { lng, lat }
  } catch (error) {
    return { lng: '', lat: '' }
  }
}

export async function resolveNavigationStartCoords(fallbackCoords = null) {
  if (hasValidCoords(fallbackCoords || {})) {
    return fallbackCoords
  }

  const cached = getCachedRiderCoords()
  if (hasValidCoords(cached)) {
    return cached
  }

  try {
    const quickLocation = await requestNavigationLocation('wgs84', {
      isHighAccuracy: false,
      highAccuracyExpireTime: 4000
    })
    if (hasValidCoords(quickLocation)) {
      return quickLocation
    }
  } catch (error) {}

  try {
    const preciseLocation = await requestNavigationLocation('wgs84', {
      isHighAccuracy: true,
      highAccuracyExpireTime: 8000
    })
    if (hasValidCoords(preciseLocation)) {
      return preciseLocation
    }
  } catch (error) {}

  try {
    const gcjLocation = await requestNavigationLocation('gcj02')
    if (hasValidCoords(gcjLocation)) {
      return gcjLocation
    }
  } catch (error) {}

  return { lng: '', lat: '' }
}
