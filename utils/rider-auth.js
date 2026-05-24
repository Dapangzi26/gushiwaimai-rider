export function isMerchantDeliveryUser(user = {}) {
  return user?.role === 'merchant_delivery'
}

export function isRiderAppUser(user = {}) {
  return user?.role === 'rider' || isMerchantDeliveryUser(user)
}

export function isCountyRider(user = {}) {
  return user?.role === 'rider' &&
    user?.delivery_scope === 'county_delivery' &&
    user?.rider_kind === 'rider'
}

export function isTownStationmaster(user = {}) {
  return user?.role === 'rider' &&
    user?.rider_kind === 'stationmaster'
}

export function isTownScopeUser(user = {}) {
  return user?.role === 'rider' &&
    user?.delivery_scope === 'town_delivery'
}
