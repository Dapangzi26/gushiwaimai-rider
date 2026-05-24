import { normalizeTestParams } from '@/sdk/tencent-nav/core/nav-contract.js'

function getTencentNativeModule() {
  // #ifdef APP-PLUS
  try {
    return uni.requireNativePlugin('TencentNaviModule')
  } catch (error) {
    return null
  }
  // #endif
  return null
}

export function isTencentNativeModuleAvailable() {
  return !!getTencentNativeModule()
}

export function startTencentNativeNavigation(params = {}) {
  const normalized = normalizeTestParams(params)
  const module = getTencentNativeModule()

  if (!module) {
    return Promise.resolve({
      success: false,
      code: 'MODULE_UNAVAILABLE',
      message: '腾讯原生导航插件未注册，当前只能完成测试参数验证',
      params: normalized
    })
  }

  return new Promise((resolve) => {
    try {
      module.startNavigation(normalized, (result) => {
        resolve({
          success: !!(result && (result.success || result.code === 0)),
          code: result && result.code !== undefined ? result.code : 'UNKNOWN',
          message: result && result.message ? result.message : '腾讯原生导航已返回结果',
          raw: result || null,
          params: normalized
        })
      })
    } catch (error) {
      resolve({
        success: false,
        code: 'NATIVE_CALL_ERROR',
        message: error && error.message ? error.message : '调用腾讯原生导航插件异常',
        params: normalized
      })
    }
  })
}
