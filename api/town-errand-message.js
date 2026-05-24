/**
 * 镇上跑腿代购消息 API
 */
import { get, post } from '@/utils/request.js'

export function getTownErrandConversations(params = {}, options = {}) {
  return get('/town-errand/conversations', params, options)
}

export function getTownErrandMessages(conversationId, params = {}, options = {}) {
  return get(`/town-errand/conversations/${conversationId}/messages`, params, options)
}

export function sendTownErrandMessage(conversationId, content, options = {}) {
  return post(`/town-errand/conversations/${conversationId}/messages`, { content }, options)
}
