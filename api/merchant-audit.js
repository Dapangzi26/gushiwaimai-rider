import { get, post } from '@/utils/request.js'

export function getTownMerchantApplications(params = {}, options = {}) {
  return get('/town-station/merchant-applications', params, options)
}

export function getTownMerchantApplicationDetail(id) {
  return get(`/town-station/merchant-applications/${id}`)
}

export function approveTownMerchantApplication(id, data = {}) {
  return post(`/town-station/merchant-applications/${id}/approve`, data)
}

export function rejectTownMerchantApplication(id, data = {}) {
  return post(`/town-station/merchant-applications/${id}/reject`, data)
}
