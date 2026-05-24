const STORAGE_KEY = 'riderReminderSettings'

export const REMINDER_CATEGORY_KEYS = [
  'newOrder',
  'transfer',
  'cancel',
  'timeout',
  'pickupReady',
  'stationNotice',
  'navigation'
]

export const DEFAULT_REMINDER_SETTINGS = {
  enabled: true,
  voiceEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  systemNotificationEnabled: true,
  navigationVoiceEnabled: false,
  categories: {
    newOrder: true,
    transfer: true,
    cancel: true,
    timeout: true,
    pickupReady: true,
    stationNotice: true,
    navigation: false
  }
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value === 1
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }
  return fallback
}

function normalizeCategories(input = {}) {
  return REMINDER_CATEGORY_KEYS.reduce((result, key) => {
    result[key] = toBoolean(input[key], DEFAULT_REMINDER_SETTINGS.categories[key])
    return result
  }, {})
}

export function normalizeReminderSettings(input = {}) {
  return {
    enabled: toBoolean(input.enabled, DEFAULT_REMINDER_SETTINGS.enabled),
    voiceEnabled: toBoolean(input.voiceEnabled, DEFAULT_REMINDER_SETTINGS.voiceEnabled),
    soundEnabled: toBoolean(input.soundEnabled, DEFAULT_REMINDER_SETTINGS.soundEnabled),
    vibrationEnabled: toBoolean(input.vibrationEnabled, DEFAULT_REMINDER_SETTINGS.vibrationEnabled),
    systemNotificationEnabled: toBoolean(input.systemNotificationEnabled, DEFAULT_REMINDER_SETTINGS.systemNotificationEnabled),
    navigationVoiceEnabled: toBoolean(input.navigationVoiceEnabled, DEFAULT_REMINDER_SETTINGS.navigationVoiceEnabled),
    categories: normalizeCategories(input.categories || {})
  }
}

export function getReminderSettings() {
  const raw = uni.getStorageSync(STORAGE_KEY)
  if (!raw) {
    return normalizeReminderSettings(DEFAULT_REMINDER_SETTINGS)
  }

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return normalizeReminderSettings({
      ...DEFAULT_REMINDER_SETTINGS,
      ...parsed,
      categories: {
        ...DEFAULT_REMINDER_SETTINGS.categories,
        ...(parsed?.categories || {})
      }
    })
  } catch (error) {
    console.warn('[reminder-settings] 本地提醒设置解析失败，已回退默认值', error)
    return normalizeReminderSettings(DEFAULT_REMINDER_SETTINGS)
  }
}

export function saveReminderSettings(settings = DEFAULT_REMINDER_SETTINGS) {
  const normalized = normalizeReminderSettings(settings)
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function updateReminderSettings(patch = {}) {
  const current = getReminderSettings()
  const merged = normalizeReminderSettings({
    ...current,
    ...patch,
    categories: {
      ...current.categories,
      ...(patch.categories || {})
    }
  })
  return saveReminderSettings(merged)
}

export function resetReminderSettings() {
  uni.removeStorageSync(STORAGE_KEY)
  return saveReminderSettings(DEFAULT_REMINDER_SETTINGS)
}

export function isReminderEnabledForType(type, settings = getReminderSettings()) {
  if (!settings.enabled) {
    return false
  }

  const categoryMap = {
    new_order: 'newOrder',
    transfer: 'transfer',
    cancel: 'cancel',
    timeout: 'timeout',
    pickup_ready: 'pickupReady',
    station_notice: 'stationNotice',
    navigation: 'navigation'
  }

  const categoryKey = categoryMap[type]
  if (!categoryKey) {
    return true
  }

  if (type === 'navigation' && !settings.navigationVoiceEnabled) {
    return false
  }

  return !!settings.categories[categoryKey]
}
