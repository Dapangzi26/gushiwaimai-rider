import { maskKey, normalizeTestParams, buildTestSummary } from '@/sdk/tencent-nav/core/nav-contract.js'
import { isTencentNativeModuleAvailable, startTencentNativeNavigation } from '@/sdk/tencent-nav/bridge/native-bridge.js'

/**
 * 腾讯导航测试桥接层。
 * 第一轮只负责整理测试参数与状态说明，不直接接原生导航。
 */

export function getTencentNavSupport() {
  return {
    map: true,
    location: true,
    navigation: true,
    riding: true,
    nativeModuleReady: isTencentNativeModuleAvailable(),
    source: 'official-docs'
  }
}

export function getMaskedTencentKey(key = '') {
  return maskKey(key)
}

export function createTencentNavTestParams(input = {}) {
  return normalizeTestParams(input)
}

export function getTencentNavTestSummary(input = {}) {
  const params = normalizeTestParams(input)
  return buildTestSummary(params)
}

export function startTencentNavigation(params = {}) {
  return startTencentNativeNavigation(params)
}
