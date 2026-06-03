/*
 * 这个文件专门负责把“当前登录账号到底属于哪种配送身份”统一算出来。
 * App 全局后台任务、订单页分支、导航页分支都会依赖这里的判定结果，
 * 所以这里一旦放宽或收紧角色范围，会直接影响定位上报、列表分类和页面展示。
 */
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
    // 后台定位上报不能只给县城司机。
    // 乡镇配送账号进入“去送货/地图总览”时，也要依赖这条链路把骑手当前点位喂给地图页，
    // 否则地图上只能看到商家/用户点，看不到骑手自己的当前位置。
    // 这里按“县城司机 + 全部乡镇配送账号”放开，先保证送货地图主链路完整。
    canReportDispatchLocation: isCountyRider(user) || townScope,
    nicknameLabel: '骑手'
  }
}

export function canReportDispatchLocationByProfile(user = {}) {
  return resolveDeliveryProfile(user).canReportDispatchLocation
}

export function isSelfDeliveryProfile(user = {}) {
  return resolveDeliveryProfile(user).isMerchantSelfDelivery
}
