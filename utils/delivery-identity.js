import {
  isCountyRider,
  isMerchantDeliveryUser,
  isTownScopeUser,
  isTownStationmaster
} from '@/utils/rider-auth.js'

export const DELIVERY_DOMAIN = {
  PLATFORM: 'platform_delivery',
  SELF: 'self_delivery'
}

export const DELIVERY_IDENTITY = {
  COUNTY_RIDER: 'county_rider',
  TOWN_STATIONMASTER: 'town_stationmaster',
  TOWN_RIDER: 'town_rider',
  MERCHANT_SELF_DELIVERY: 'merchant_self_delivery'
}

export function getCurrentUserId(user = {}) {
  const rawId = user?.id ?? user?.user_id ?? user?.userId ?? ''
  return rawId === null || typeof rawId === 'undefined' ? '' : String(rawId)
}

export function resolveDeliveryProfile(user = {}) {
  if (isMerchantDeliveryUser(user)) {
    return {
      accountRole: 'merchant_delivery',
      deliveryDomain: DELIVERY_DOMAIN.SELF,
      deliveryIdentity: DELIVERY_IDENTITY.MERCHANT_SELF_DELIVERY,
      isMerchantSelfDelivery: true,
      isPlatformDelivery: false,
      isTownStationmaster: false,
      isTownScope: false,
      useSimplifiedTabs: true,
      canReportDispatchLocation: false,
      nicknameLabel: '配送员'
    }
  }

  const townStationmaster = isTownStationmaster(user)
  const townScope = isTownScopeUser(user)
  return {
    accountRole: user?.role || '',
    deliveryDomain: DELIVERY_DOMAIN.PLATFORM,
    deliveryIdentity: townStationmaster
      ? DELIVERY_IDENTITY.TOWN_STATIONMASTER
      : (townScope ? DELIVERY_IDENTITY.TOWN_RIDER : DELIVERY_IDENTITY.COUNTY_RIDER),
    isMerchantSelfDelivery: false,
    isPlatformDelivery: true,
    isTownStationmaster: townStationmaster,
    isTownScope: townScope,
    useSimplifiedTabs: true,
    canReportDispatchLocation: isCountyRider(user) || townStationmaster,
    nicknameLabel: '骑手'
  }
}

export function canReportDispatchLocationByProfile(user = {}) {
  return resolveDeliveryProfile(user).canReportDispatchLocation
}

export function isSelfDeliveryProfile(user = {}) {
  return resolveDeliveryProfile(user).isMerchantSelfDelivery
}
