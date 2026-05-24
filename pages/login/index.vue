<template>
  <view class="container">
    <view class="header">
      <text class="title">{{ pageTitle }}</text>
    </view>

    <view class="form-container">
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input 
          v-model="form.phone" 
          type="number" 
          maxlength="11" 
          placeholder="请输入手机号" 
          class="form-input" 
        />
      </view>

      <view class="form-item">
        <text class="form-label">密码</text>
        <input 
          v-model="form.password" 
          type="password" 
          placeholder="请输入密码（至少6位）" 
          class="form-input" 
          confirm-type="done"
          @confirm="handleSubmit"
        />
      </view>

      <view class="form-item" v-if="isRegisterMode">
        <text class="form-label">确认密码</text>
        <input 
          v-model="form.confirmPassword" 
          type="password" 
          placeholder="请再次输入密码" 
          class="form-input" 
        />
      </view>

      <view class="form-item" v-if="isRegisterMode">
        <text class="form-label">昵称（选填）</text>
        <input 
          v-model="form.nickname" 
          type="text" 
          placeholder="请输入昵称" 
          class="form-input" 
        />
      </view>

      <view class="form-item" v-if="isRegisterMode">
        <text class="form-label">配送业务线</text>
        <view class="scope-options">
          <view
            v-for="item in deliveryScopeOptions"
            :key="item.value"
            class="scope-option"
            :class="{ active: form.register_type === item.value }"
            @click="selectDeliveryScope(item.value)"
          >
            <text
              class="scope-option-text"
              :class="{ active: form.register_type === item.value }"
            >
              {{ item.label }}
            </text>
          </view>
        </view>
      </view>

      <view class="form-item" v-if="isRegisterMode && isTownDelivery">
        <text class="form-label">所属乡镇</text>
        <picker
          mode="selector"
          :range="townOptions"
          range-key="label"
          :value="selectedTownIndex"
          @change="handleTownChange"
        >
          <view class="picker-input" :class="{ placeholder: !selectedTownLabel }">
            {{ townPickerText }}
          </view>
        </picker>
      </view>

      <view class="form-item" v-if="isRegisterMode && isMerchantSelfDelivery">
        <text class="form-label">商家ID</text>
        <input
          v-model="form.merchant_binding_code"
          type="number"
          maxlength="6"
          placeholder="请输入6位商家ID"
          class="form-input"
          @input="handleMerchantBindingInput"
          @blur="handleMerchantBindingBlur"
        />
        <text v-if="merchantBindingHint" class="binding-hint" :class="bindingHintClass">
          {{ merchantBindingHint }}
        </text>
        <view v-if="matchedMerchant" class="merchant-card">
          <text class="merchant-card-title">已匹配商家：{{ matchedMerchant.merchant_name || '未命名店铺' }}</text>
          <text v-if="matchedMerchant.merchant_address" class="merchant-card-desc">
            地址：{{ matchedMerchant.merchant_address }}
          </text>
        </view>
      </view>

      <button
        class="submit-btn"
        :class="{ disabled: isSubmitDisabled }"
        :disabled="isSubmitDisabled"
        @tap="handleSubmitWithKeyboard"
      >
        {{ isRegisterMode ? '注册' : '登录' }}
      </button>

      <view class="toggle-mode">
        <text class="tip-text">{{ isRegisterMode ? '已有账号？' : '没有账号？' }}</text>
        <text class="tip-link" @click="toggleMode">{{ isRegisterMode ? '立即登录' : '立即注册' }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { login, registerRider, resolveMerchantBinding } from '@/api/auth.js'
import { getTownServiceAreas } from '@/api/common.js'
import { resetLogoutGuard } from '@/utils/request.js'
import { clearRiderSession, setToken, setUserInfo, setRiderStatus } from '@/utils/storage.js'
import { RIDER_DELIVERY_SCOPE_OPTIONS } from './rider-register-options.js'

const LOGIN_PAGE_MODE_KEY = 'rider_login_page_mode'
const MERCHANT_DELIVERY_SCOPE = 'merchant_self_delivery'
const MERCHANT_DELIVERY_ROLE = 'merchant_delivery'
const DEBUG_SERVER_URL = 'http://198.18.0.1:7777/event'
const DEBUG_SESSION_ID = 'rider-login-failure'
const ENABLE_DEBUG_EVENT_REPORT = false

function reportLoginDebug(hypothesisId, location, msg, data = {}) {
  if (!ENABLE_DEBUG_EVENT_REPORT) {
    return
  }
  // #region debug-point G:login-page
  uni.request({
    url: DEBUG_SERVER_URL,
    method: 'POST',
    data: {
      sessionId: DEBUG_SESSION_ID,
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now()
    },
    header: { 'Content-Type': 'application/json' },
    fail: () => {}
  })
  // #endregion
}

export default {
  onLoad() {
    reportLoginDebug('G', 'pages/login/index.vue:onLoad', 'login page loaded', {
      hasToken: !!uni.getStorageSync('token'),
      hasUserInfo: !!uni.getStorageSync('userInfo'),
      pageStackDepth: (typeof getCurrentPages === 'function' ? getCurrentPages().length : 0)
    })
    this.restoreMode()
  },
  onShow() {
    reportLoginDebug('G', 'pages/login/index.vue:onShow', 'login page shown', {
      hasToken: !!uni.getStorageSync('token'),
      hasUserInfo: !!uni.getStorageSync('userInfo'),
      pageStackDepth: (typeof getCurrentPages === 'function' ? getCurrentPages().length : 0)
    })
    this.restoreMode()
  },
  data() {
    return {
      form: {
        phone: '',
        password: '',
        confirmPassword: '',
        nickname: '',
        register_type: '',
        delivery_scope: '',
        rider_kind: '',
        town_code: '',
        merchant_binding_code: ''
      },
      deliveryScopeOptions: RIDER_DELIVERY_SCOPE_OPTIONS,
      townOptions: [],
      townOptionsLoaded: false,
      townOptionsLoading: false,
      townOptionsLoadFailed: false,
      matchedMerchant: null,
      merchantBindingResolvedCode: '',
      merchantBindingResolving: false,
      merchantBindingHint: '',
      merchantBindingHintType: '',
      isRegisterMode: false,
      loading: false
    }
  },
  computed: {
    pageTitle() {
      if (!this.isRegisterMode) {
        return '骑手登录'
      }
      if (this.form.register_type === 'town_stationmaster') {
        return '乡镇站长注册'
      }
      if (this.form.register_type === 'town_rider') {
        return '乡镇骑手注册'
      }
      return this.isMerchantSelfDelivery ? '商家自配送注册' : '骑手注册'
    },
    isTownDelivery() {
      return this.form.delivery_scope === 'town_delivery'
    },
    isMerchantSelfDelivery() {
      return this.form.delivery_scope === MERCHANT_DELIVERY_SCOPE
    },
    selectedTownIndex() {
      return Math.max(this.townOptions.findIndex(item => item.value === this.form.town_code), 0)
    },
    selectedTownLabel() {
      const selectedTown = this.townOptions.find(item => item.value === this.form.town_code)
      return selectedTown ? selectedTown.label : ''
    },
    townPickerText() {
      if (this.selectedTownLabel) {
        return this.selectedTownLabel
      }
      if (this.townOptionsLoading) {
        return '乡镇列表加载中...'
      }
      if (this.townOptionsLoadFailed) {
        return '乡镇列表加载失败，请重试'
      }
      return '请选择所属乡镇'
    },
    bindingHintClass() {
      return this.merchantBindingHintType ? `binding-hint-${this.merchantBindingHintType}` : ''
    },
    hasResolvedMerchantBinding() {
      if (!this.isMerchantSelfDelivery) {
        return true
      }
      const currentCode = this.normalizeMerchantBindingCode(this.form.merchant_binding_code)
      return !!currentCode &&
        this.isValidMerchantBindingCode(currentCode) &&
        !!this.matchedMerchant &&
        this.merchantBindingResolvedCode === currentCode
    },
    isSubmitDisabled() {
      if (this.loading) {
        return true
      }
      if (!this.isRegisterMode) {
        return false
      }
      if (!this.isMerchantSelfDelivery) {
        return false
      }
      return !this.hasResolvedMerchantBinding || this.merchantBindingResolving
    }
  },
  methods: {
    handleSubmitWithKeyboard() {
      uni.hideKeyboard({
        complete: () => {
          this.handleSubmit()
        }
      })
    },
    restoreMode() {
      this.isRegisterMode = uni.getStorageSync(LOGIN_PAGE_MODE_KEY) === 'register'
    },
    setMode(isRegisterMode) {
      this.isRegisterMode = !!isRegisterMode
      uni.setStorageSync(LOGIN_PAGE_MODE_KEY, this.isRegisterMode ? 'register' : 'login')
    },
    getAuditPendingLoginMessage(error) {
      const msg = String(error?.msg || error?.message || '').trim()
      if (!msg) {
        return ''
      }
      if (
        msg.includes('禁用') ||
        msg.includes('停用') ||
        msg.includes('审核') ||
        msg.includes('未通过') ||
        msg.includes('未启用')
      ) {
        return '账号正在审核中，审核通过后才可登录接单'
      }
      return ''
    },
    toggleMode() {
      this.setMode(!this.isRegisterMode)
      this.form.confirmPassword = ''
      this.form.nickname = ''
      this.form.register_type = ''
      this.form.delivery_scope = ''
      this.form.rider_kind = ''
      this.form.town_code = ''
      this.resetMerchantBindingState()
    },

    resetRegisterForm() {
      this.form.password = ''
      this.form.confirmPassword = ''
      this.form.nickname = ''
      this.form.register_type = ''
      this.form.delivery_scope = ''
      this.form.rider_kind = ''
      this.form.town_code = ''
      this.form.merchant_binding_code = ''
      this.resetMerchantBindingState()
    },

    resetMerchantBindingState() {
      this.matchedMerchant = null
      this.merchantBindingResolvedCode = ''
      this.merchantBindingHint = ''
      this.merchantBindingHintType = ''
    },

    setMerchantBindingHint(message = '', type = '') {
      this.merchantBindingHint = message
      this.merchantBindingHintType = type
    },

    normalizeMerchantBindingCode(value = '') {
      return String(value || '').replace(/\D/g, '').slice(0, 6)
    },

    isValidMerchantBindingCode(value = '') {
      return /^\d{6}$/.test(this.normalizeMerchantBindingCode(value))
    },

    handleMerchantBindingInput(event) {
      const nextCode = this.normalizeMerchantBindingCode(event?.detail?.value ?? this.form.merchant_binding_code)
      const previousResolvedCode = this.merchantBindingResolvedCode
      this.form.merchant_binding_code = nextCode

      if (!nextCode) {
        this.resetMerchantBindingState()
        return
      }

      if (previousResolvedCode && previousResolvedCode !== nextCode) {
        this.resetMerchantBindingState()
      }

      if (!this.isValidMerchantBindingCode(nextCode)) {
        this.matchedMerchant = null
        this.merchantBindingResolvedCode = ''
        this.setMerchantBindingHint('请输入6位商家ID', 'error')
      }
    },

    async handleMerchantBindingBlur() {
      if (!this.isMerchantSelfDelivery) {
        return
      }
      const code = this.normalizeMerchantBindingCode(this.form.merchant_binding_code)
      this.form.merchant_binding_code = code
      if (!code) {
        this.resetMerchantBindingState()
        return
      }
      if (!this.isValidMerchantBindingCode(code)) {
        this.resetMerchantBindingState()
        this.setMerchantBindingHint('请输入6位商家ID', 'error')
        return
      }
      await this.resolveMerchantBindingInfo(code, { silent: true })
    },

    async selectDeliveryScope(optionValue) {
      const selectedOption = this.deliveryScopeOptions.find(item => item.value === optionValue) || {}
      this.form.register_type = optionValue
      this.form.delivery_scope = selectedOption.delivery_scope || ''
      this.form.rider_kind = selectedOption.rider_kind || ''
      this.resetMerchantBindingState()
      this.form.merchant_binding_code = ''
      if (this.form.delivery_scope !== 'town_delivery') {
        this.form.town_code = ''
      }
      if (this.form.delivery_scope === 'town_delivery' && !this.townOptionsLoaded && !this.townOptionsLoading) {
        await this.loadTownOptions()
      }
    },

    handleTownChange(event) {
      const selectedTown = this.townOptions[Number(event.detail.value)]
      this.form.town_code = selectedTown ? selectedTown.value : ''
    },

    async loadTownOptions() {
      this.townOptionsLoading = true
      try {
        const res = await getTownServiceAreas()
        const townOptions = Array.isArray(res.data)
          ? res.data.map(item => ({
              value: item.area_code,
              label: item.area_name
            }))
          : []

        this.townOptions = townOptions
        this.townOptionsLoaded = townOptions.length > 0
        this.townOptionsLoadFailed = false

        if (this.form.town_code && !townOptions.some(item => item.value === this.form.town_code)) {
          this.form.town_code = ''
        }

        if (!townOptions.length) {
          uni.showToast({ title: '暂无可选乡镇', icon: 'none' })
        }
      } catch (e) {
        this.townOptions = []
        this.townOptionsLoaded = false
        this.townOptionsLoadFailed = true
        console.error('乡镇列表加载失败:', e)
      } finally {
        this.townOptionsLoading = false
      }
    },

    async resolveMerchantBindingInfo(bindingCode = '', { silent = false } = {}) {
      const normalizedCode = this.normalizeMerchantBindingCode(bindingCode || this.form.merchant_binding_code)
      this.form.merchant_binding_code = normalizedCode
      if (!this.isValidMerchantBindingCode(normalizedCode)) {
        this.resetMerchantBindingState()
        if (!silent) {
          uni.showToast({ title: '请输入6位商家ID', icon: 'none' })
        }
        return false
      }
      if (this.merchantBindingResolvedCode === normalizedCode && this.matchedMerchant) {
        this.setMerchantBindingHint(`已匹配店铺：${this.matchedMerchant.merchant_name || '未命名店铺'}`, 'success')
        return true
      }

      this.merchantBindingResolving = true
      try {
        const res = await resolveMerchantBinding({
          merchant_binding_code: normalizedCode
        })
        const merchant = res?.data || {}
        if (!merchant || !merchant.merchant_id) {
          throw new Error('无商家，请检查商家ID')
        }
        this.matchedMerchant = merchant
        this.merchantBindingResolvedCode = normalizedCode
        this.setMerchantBindingHint(`已匹配店铺：${merchant.merchant_name || '未命名店铺'}`, 'success')
        return true
      } catch (error) {
        this.resetMerchantBindingState()
        this.setMerchantBindingHint('无商家，请检查商家ID', 'error')
        if (!silent) {
          uni.showToast({ title: '无商家，请检查商家ID', icon: 'none' })
        }
        return false
      } finally {
        this.merchantBindingResolving = false
      }
    },
    
    validateForm() {
      const {
        phone,
        password,
        confirmPassword,
        delivery_scope,
        rider_kind,
        town_code,
        merchant_binding_code
      } = this.form
      
      if (!phone || phone.length !== 11) {
        uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return false
      }
      
      if (!password || password.length < 6) {
        uni.showToast({ title: '密码至少 6 位', icon: 'none' })
        return false
      }
      
      if (this.isRegisterMode) {
        if (!delivery_scope) {
          uni.showToast({ title: '请选择配送业务线', icon: 'none' })
          return false
        }

        if (delivery_scope === 'town_delivery' && !rider_kind) {
          uni.showToast({ title: '请选择乡镇账号类型', icon: 'none' })
          return false
        }

        if (delivery_scope === 'town_delivery' && !town_code) {
          uni.showToast({ title: '请选择所属乡镇', icon: 'none' })
          return false
        }

        if (delivery_scope === MERCHANT_DELIVERY_SCOPE && !this.isValidMerchantBindingCode(merchant_binding_code)) {
          uni.showToast({ title: '请输入6位商家ID', icon: 'none' })
          return false
        }

        if (delivery_scope === MERCHANT_DELIVERY_SCOPE && !this.hasResolvedMerchantBinding) {
          uni.showToast({ title: '无商家，请检查商家ID', icon: 'none' })
          return false
        }

        if (password !== confirmPassword) {
          uni.showToast({ title: '两次密码不一致', icon: 'none' })
          return false
        }
      }
      
      return true
    },
    
    async handleSubmit() {
      reportLoginDebug('G', 'pages/login/index.vue:handleSubmit:start', 'submit button clicked', {
        isRegisterMode: this.isRegisterMode,
        phoneLength: String(this.form.phone || '').length,
        passwordLength: String(this.form.password || '').length,
        loading: this.loading
      })
      if (!this.validateForm()) return
      
      this.loading = true
      
      try {
        if (this.isRegisterMode) {
          await this.handleRegister()
        } else {
          await this.handleLogin()
        }
      } catch (e) {
        console.error('操作失败:', e)
      } finally {
        this.loading = false
      }
    },
    
    async handleLogin() {
      const { phone, password } = this.form
      let res
      reportLoginDebug('G', 'pages/login/index.vue:handleLogin:before-request', 'login request about to start', {
        phoneLength: String(phone || '').length,
        hasPassword: !!password
      })
      try {
        res = await login({ phone, password })
        reportLoginDebug('G', 'pages/login/index.vue:handleLogin:request-success', 'login request resolved', {
          hasData: !!res?.data,
          hasToken: !!res?.data?.token,
          hasUser: !!res?.data?.user,
          role: res?.data?.user?.role || '',
          deliveryScope: res?.data?.user?.delivery_scope || '',
          riderKind: res?.data?.user?.rider_kind || ''
        })
      } catch (e) {
        reportLoginDebug('G', 'pages/login/index.vue:handleLogin:request-failed', 'login request rejected', {
          code: e?.code || '',
          message: e?.msg || e?.message || ''
        })
        const auditPendingMessage = this.getAuditPendingLoginMessage(e)
        if (auditPendingMessage) {
          setTimeout(() => {
            uni.showToast({
              title: auditPendingMessage,
              icon: 'none',
              duration: 2500
            })
          }, 100)
        }
        throw e
      }
      
      if (res.data) {
        const loginToken = res.data.token || ''
        const loginUser = res.data.user || null

        if (!loginToken || !loginUser) {
          reportLoginDebug('G', 'pages/login/index.vue:handleLogin:incomplete-data', 'login response missing token or user', {
            hasToken: !!loginToken,
            hasUser: !!loginUser
          })
          clearRiderSession()
          uni.showToast({ title: '登录信息不完整，请重试', icon: 'none' })
          return
        }

        if (!['rider', 'merchant_delivery'].includes(loginUser.role)) {
          reportLoginDebug('G', 'pages/login/index.vue:handleLogin:role-rejected', 'login user role rejected', {
            role: loginUser.role || ''
          })
          clearRiderSession()
          uni.showToast({ 
            title: '该账号不是配送账号', 
            icon: 'none',
            duration: 2000
          })
          return
        }

        resetLogoutGuard()
        setToken(loginToken)
        setUserInfo(loginUser)
        reportLoginDebug('G', 'pages/login/index.vue:handleLogin:session-stored', 'token and user saved locally', {
          hasTokenAfterSave: !!uni.getStorageSync('token'),
          hasUserInfoAfterSave: !!uni.getStorageSync('userInfo'),
          role: loginUser.role || ''
        })
        if (loginUser.delivery_scope === 'county_delivery' && loginUser.rider_kind === 'rider') {
          setRiderStatus(1)
        }

        uni.showToast({ title: '登录成功', icon: 'success' })
        
        setTimeout(() => {
          uni.reLaunch({
            url: '/pages/index/index',
            success: () => {
              reportLoginDebug('G', 'pages/login/index.vue:handleLogin:relaunch-success', 'reLaunch to workbench succeeded', {
                hasTokenAfterLaunch: !!uni.getStorageSync('token'),
                hasUserInfoAfterLaunch: !!uni.getStorageSync('userInfo')
              })
              const app = typeof getApp === 'function' ? getApp() : null
              const refreshSession = app?.globalData?.refreshRiderSession
              if (typeof refreshSession === 'function') {
                setTimeout(() => {
                  refreshSession(true)
                }, 50)
              }
            }
          })
        }, 1500)
      }
    },
    
    async handleRegister() {
      const {
        phone,
        password,
        nickname,
        delivery_scope,
        rider_kind,
        town_code,
        merchant_binding_code
      } = this.form

      const isMerchantDelivery = delivery_scope === MERCHANT_DELIVERY_SCOPE
      if (isMerchantDelivery) {
        const bindingResolved = await this.resolveMerchantBindingInfo(merchant_binding_code)
        if (!bindingResolved) {
          return
        }
      }

      const registerData = {
        phone,
        password,
        nickname: nickname || `${isMerchantDelivery ? '配送员' : '骑手'}${phone.slice(-4)}`
      }

      if (isMerchantDelivery) {
        registerData.role = MERCHANT_DELIVERY_ROLE
        registerData.merchant_binding_code = this.normalizeMerchantBindingCode(merchant_binding_code)
      } else {
        registerData.delivery_scope = delivery_scope
        if (rider_kind) {
          registerData.rider_kind = rider_kind
        }
        if (delivery_scope === 'town_delivery') {
          registerData.town_code = town_code
        }
      }
      
      await registerRider(registerData)

      this.setMode(false)
      this.resetRegisterForm()
      uni.showModal({
        title: '申请已提交',
        content: isMerchantDelivery ? '注册申请已提交，请等待总后台审核。\n审核通过后才可登录配送。' : '注册申请已提交，请等待总后台审核。\n审核通过后才可登录接单。',
        showCancel: false,
        confirmText: '我知道了'
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%);
  padding: 80rpx 40rpx 40rpx;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 60rpx;
}

.title {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
}

.form-container {
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 12rpx;
  display: block;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.scope-options {
  display: flex;
  flex-direction: column;
}

.scope-option + .scope-option {
  margin-top: 20rpx;
}

.scope-option {
  background: #f5f5f5;
  border: 2rpx solid transparent;
  border-radius: 12rpx;
  padding: 24rpx;
}

.scope-option.active {
  background: rgba(24, 144, 255, 0.08);
  border-color: #1890ff;
}

.scope-option-text {
  font-size: 28rpx;
  color: #333;
}

.scope-option-text.active {
  color: #1890ff;
  font-weight: bold;
}

.picker-input {
  height: 88rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #333;
}

.picker-input.placeholder {
  color: #999;
}

.binding-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
}

.binding-hint-success {
  color: #1f8a4c;
}

.binding-hint-error {
  color: #ff4d4f;
}

.merchant-card {
  margin-top: 16rpx;
  padding: 20rpx 24rpx;
  background: #f6ffed;
  border: 2rpx solid #b7eb8f;
  border-radius: 12rpx;
}

.merchant-card-title {
  display: block;
  font-size: 26rpx;
  color: #1f8a4c;
  font-weight: 600;
}

.merchant-card-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #666;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 12rpx;
  border: none;
  margin-top: 24rpx;
}

.submit-btn.disabled {
  background: #9ecbff;
  color: rgba(255, 255, 255, 0.9);
}

.toggle-mode {
  display: flex;
  justify-content: center;
  margin-top: 32rpx;
}

.tip-text {
  font-size: 26rpx;
  color: #999;
}

.tip-link {
  font-size: 26rpx;
  color: #1890ff;
  margin-left: 8rpx;
}
</style>
