const NOTICE_TEXT = '您有跑腿消息，请及时回复'
const PLAYER_GAP_MS = 800
const LOG_PREFIX = '[town-errand-voice]'
const HIGH_PRIORITY_VALUES = ['high', 'urgent', 'critical', 'p0', 'p1']

let lastPlayAt = 0
let plusReadyListening = false
let plusReadyCallbacks = []
let androidTtsInstance = null
let androidTtsReady = false
let androidTtsInitializing = false
let androidTtsCallbacks = []

function logInfo(message, extra) {
  if (typeof extra === 'undefined') {
    console.log(LOG_PREFIX, message)
    return
  }
  console.log(LOG_PREFIX, message, extra)
}

function logWarn(message, extra) {
  if (typeof extra === 'undefined') {
    console.warn(LOG_PREFIX, message)
    return
  }
  console.warn(LOG_PREFIX, message, extra)
}

function logError(message, extra) {
  if (typeof extra === 'undefined') {
    console.error(LOG_PREFIX, message)
    return
  }
  console.error(LOG_PREFIX, message, extra)
}

function isAppPlusRuntime() {
  // #ifdef APP-PLUS
  return true
  // #endif
  return false
}

function showVisualNotice() {
  uni.showToast({
    title: NOTICE_TEXT,
    icon: 'none',
    duration: 2000
  })

  if (typeof uni.vibrateShort === 'function') {
    uni.vibrateShort()
  }
}

function vibrateNotice() {
  if (typeof uni.vibrateShort === 'function') {
    uni.vibrateShort()
  }
}

function isHighPriority(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return HIGH_PRIORITY_VALUES.includes(normalized)
}

function getBeepCountBySoundType(soundType = 'default') {
  const normalized = String(soundType || '').trim().toLowerCase()
  if (normalized === 'urgent' || normalized === 'alert_urgent' || normalized === 'critical') {
    return 2
  }
  if (normalized === 'triple' || normalized === 'alert_triple') {
    return 3
  }
  return 1
}

function playBeep(reason, soundType = 'default') {
  logWarn('执行提示音提醒', reason)
  // #ifdef APP-PLUS
  if (typeof plus !== 'undefined' && plus.device && typeof plus.device.beep === 'function') {
    plus.device.beep(getBeepCountBySoundType(soundType))
    return true
  }
  // #endif
  return false
}

function flushPlusReadyCallbacks() {
  const callbacks = plusReadyCallbacks.slice()
  plusReadyCallbacks = []
  callbacks.forEach((callback) => {
    try {
      callback()
    } catch (error) {
      logError('执行 plusready 队列回调失败', error)
    }
  })
}

function ensurePlusReady(callback) {
  if (!isAppPlusRuntime()) {
    logWarn('当前不是 APP-PLUS 环境，跳过真机语音播报')
    return false
  }

  if (typeof plus !== 'undefined') {
    logInfo('plus 已就绪，可直接执行语音播报', {
      plusExists: true,
      windowPlusExists: typeof window !== 'undefined' && !!window.plus,
      plusSpeechExists: !!plus.speech,
      plusSpeechSpeakExists: !!(plus.speech && typeof plus.speech.speak === 'function')
    })
    callback()
    return true
  }

  plusReadyCallbacks.push(callback)
  logWarn('plus 尚未就绪，等待 plusready 后再播报', {
    queueLength: plusReadyCallbacks.length
  })

  if (!plusReadyListening && typeof document !== 'undefined' && document.addEventListener) {
    plusReadyListening = true
    const onPlusReady = () => {
      document.removeEventListener('plusready', onPlusReady, false)
      plusReadyListening = false
      logInfo('收到 plusready 事件，开始执行等待中的语音播报')
      flushPlusReadyCallbacks()
    }
    document.addEventListener('plusready', onPlusReady, false)
  }

  return false
}

function flushAndroidTtsCallbacks(success, payload) {
  const callbacks = androidTtsCallbacks.slice()
  androidTtsCallbacks = []
  callbacks.forEach((callback) => {
    try {
      callback(success, payload)
    } catch (error) {
      logError('执行 Android TTS 队列回调失败', error)
    }
  })
}

function ensureAndroidTtsReady(callback) {
  if (androidTtsReady && androidTtsInstance) {
    callback(true)
    return
  }

  androidTtsCallbacks.push(callback)
  if (androidTtsInitializing) {
    logInfo('Android TTS 正在初始化，加入等待队列', {
      queueLength: androidTtsCallbacks.length
    })
    return
  }

  androidTtsInitializing = true

  try {
    // #ifdef APP-PLUS
    if (!plus.os || plus.os.name !== 'Android') {
      const reason = { message: '当前 APP 平台不是 Android，未接入原生 TextToSpeech' }
      logWarn('Android TTS 不可用', reason)
      androidTtsInitializing = false
      flushAndroidTtsCallbacks(false, reason)
      return
    }

    const mainActivity = plus.android.runtimeMainActivity()
    const TextToSpeech = plus.android.importClass('android.speech.tts.TextToSpeech')
    const Locale = plus.android.importClass('java.util.Locale')

    logInfo('开始初始化 Android TextToSpeech', {
      plusSpeechExists: !!plus.speech,
      plusSpeechSpeakExists: !!(plus.speech && typeof plus.speech.speak === 'function')
    })

    const initListener = plus.android.implements('android.speech.tts.TextToSpeech$OnInitListener', {
      onInit: function(status) {
        try {
          const successCode = Number(TextToSpeech.SUCCESS)
          const initSuccess = Number(status) === successCode || Number(status) === 0
          logInfo('Android TextToSpeech onInit 回调', {
            status: Number(status),
            successCode
          })

          if (!initSuccess) {
            androidTtsReady = false
            androidTtsInitializing = false
            flushAndroidTtsCallbacks(false, {
              message: 'Android TextToSpeech 初始化失败',
              status: Number(status)
            })
            return
          }

          androidTtsReady = true
          androidTtsInitializing = false

          try {
            const localeResult = androidTtsInstance.setLanguage(Locale.CHINA)
            logInfo('Android TextToSpeech 语言设置完成', {
              localeResult: Number(localeResult)
            })
          } catch (localeError) {
            logError('Android TextToSpeech 设置语言失败', localeError)
          }

          flushAndroidTtsCallbacks(true)
        } catch (callbackError) {
          androidTtsReady = false
          androidTtsInitializing = false
          logError('Android TextToSpeech onInit 处理失败', callbackError)
          flushAndroidTtsCallbacks(false, callbackError)
        }
      }
    })

    androidTtsInstance = new TextToSpeech(mainActivity, initListener)
    logInfo('已发起 Android TextToSpeech 初始化请求')
    // #endif
  } catch (error) {
    androidTtsReady = false
    androidTtsInitializing = false
    logError('初始化 Android TextToSpeech 异常', error)
    flushAndroidTtsCallbacks(false, error)
  }
}

function speakWithAndroidTts(text = NOTICE_TEXT) {
  try {
    // #ifdef APP-PLUS
    const TextToSpeech = plus.android.importClass('android.speech.tts.TextToSpeech')
    const result = androidTtsInstance.speak(String(text || NOTICE_TEXT), TextToSpeech.QUEUE_FLUSH, null, 'rider_reminder_notice')
    const errorCode = Number(TextToSpeech.ERROR)

    logInfo('已调用 Android TextToSpeech.speak', {
      result: Number(result),
      errorCode
    })

    if (Number(result) === errorCode) {
      throw new Error(`Android TextToSpeech.speak 返回错误码 ${result}`)
    }

    return true
    // #endif
  } catch (error) {
    logError('Android TextToSpeech.speak 执行失败', error)
    return false
  }

  return false
}

function showTextToast(title = NOTICE_TEXT) {
  const safeTitle = String(title || '').trim() || NOTICE_TEXT
  uni.showToast({
    title: safeTitle,
    icon: 'none',
    duration: 2000
  })
}

export function playReminderAlert(options = {}) {
  const {
    title = NOTICE_TEXT,
    text = NOTICE_TEXT,
    toast = true,
    vibration = true,
    sound = true,
    voice = true,
    soundType = 'default',
    priority = 'normal'
  } = options

  const now = Date.now()
  if (lastPlayAt > 0 && now - lastPlayAt < PLAYER_GAP_MS) {
    logWarn('提醒播放过于频繁，已跳过本次播报', {
      gap: now - lastPlayAt,
      playerGapMs: PLAYER_GAP_MS
    })
    return false
  }

  lastPlayAt = now

  if (toast) {
    showTextToast(title)
  }
  if (vibration) {
    if (isHighPriority(priority) && typeof uni.vibrateLong === 'function') {
      uni.vibrateLong()
    } else {
      vibrateNotice()
    }
  }
  if (sound) {
    playBeep({ title, soundType }, soundType)
  }

  if (!voice) {
    return true
  }

  if (!isAppPlusRuntime()) {
    logWarn('当前为非 APP 环境，仅保留文字/震动提示，不执行真机语音')
    return true
  }

  ensurePlusReady(() => {
    ensureAndroidTtsReady((success, payload) => {
      if (!success) {
        logError('Android TTS 未就绪，无法执行语音播报', payload)
        if (!sound) {
          playBeep(payload, soundType)
        }
        return
      }

      const speakSuccess = speakWithAndroidTts(text)
      if (!speakSuccess && !sound) {
        playBeep({ message: 'Android TTS speak 调用失败' }, soundType)
      }
    })
  })

  return true
}

export function speakTownErrandIncomingMessage() {
  return playReminderAlert({
    title: NOTICE_TEXT,
    text: NOTICE_TEXT,
    toast: true,
    vibration: true,
    sound: true,
    voice: true
  })
}
