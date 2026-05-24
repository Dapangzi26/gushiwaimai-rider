import { get, post } from '@/utils/request.js'

export function getTownRiderApplications(params = {}, options = {}) {
  return get('/town-station/rider-applications', params, options)
}

export function getTownRiderApplicationDetail(id) {
  return get(`/town-station/rider-applications/${id}`)
}

export function approveTownRiderApplication(id, data = {}) {
  return post(`/town-station/rider-applications/${id}/approve`, data)
}

export function rejectTownRiderApplication(id, data = {}) {
  return post(`/town-station/rider-applications/${id}/reject`, data)
}
