<template>
  <view class="page">
    <view class="status-card">
      <text class="title">{{ pageTitle }}</text>
      <text class="desc">{{ statusText }}</text>
      <text class="meta">阶段：{{ stageLabel }}</text>
      <text class="meta">商家：{{ merchantLng || '未传' }}, {{ merchantLat || '未传' }}</text>
      <text class="meta">用户：{{ customerLng || '未传' }}, {{ customerLat || '未传' }}</text>
    </view>

    <button v-if="failed" class="btn primary" @click="startNavigation">重新进入配送界面</button>
  </view>
</template>

<script>
import { startTencentNavigation } from '@/sdk/tencent-nav/bridge/index.js'
import {
  getCachedRiderCoords,
  hasValidCoords,
  requestNavigationLocation
} from '@/utils/navigation-service.js'

export default {
  data() {
    return {
      stage: 'pickup',
      riderLng: '',
      riderLat: '',
      merchantLng: '',
      merchantLat: '',
      customerLng: '',
      customerLat: '',
      failed: false,
      launching: false,
      launchFinished: false,
      statusText: '正在进入配送界面...'
    }
  },
  computed: {
    stageLabel() {
      return this.stage === 'delivery' ? '送餐' : '取餐'
    },
    pageTitle() {
      return this.stage === 'delivery' ? '正在进入送货导航' : '正在进入取餐导航'
    }
  },
  onLoad(options) {
    const payload = options || {}
    this.stage = payload.stage === 'delivery' ? 'delivery' : 'pickup'
    this.riderLng = payload.startLng || payload.riderLng || ''
    this.riderLat = payload.startLat || payload.riderLat || ''
    this.merchantLng = payload.merchantLng || ''
    this.merchantLat = payload.merchantLat || ''
    this.customerLng = payload.customerLng || ''
    this.customerLat = payload.customerLat || ''
    this.startNavigation()
  },
  methods: {
    async startNavigation() {
      if (this.launching) {
        return
      }
      this.launching = true
      this.failed = false
      this.statusText = '正在进入配送界面...'

      const riderPosition = await this.resolveRiderPosition()
      const result = await startTencentNavigation({
        stage: this.stage,
        riderLng: riderPosition.lng,
        riderLat: riderPosition.lat,
        merchantLng: this.merchantLng,
        merchantLat: this.merchantLat,
        customerLng: this.customerLng,
        customerLat: this.customerLat
      })

      this.launching = false
      this.launchFinished = true

      if (result && result.success) {
        this.statusText = this.stage === 'delivery' ? '送货配送界面已打开' : '取餐配送界面已打开'
        setTimeout(() => {
          uni.navigateBack({
            delta: 1
          })
        }, 80)
        return
      }

      this.failed = true
      this.statusText = result && result.message ? result.message : '进入配送界面失败，请重试'
      uni.showToast({
        title: this.statusText,
        icon: 'none'
      })
    },
    async resolveRiderPosition() {
      const existingLng = Number(this.riderLng)
      const existingLat = Number(this.riderLat)
      if (hasValidCoords({ lng: existingLng, lat: existingLat })) {
        return {
          lng: existingLng,
          lat: existingLat
        }
      }

      const cachedSample = this.getCachedRiderPosition()
      if (cachedSample) {
        this.riderLng = cachedSample.lng
        this.riderLat = cachedSample.lat
        this.statusText = '已读取骑手最近一次真实定位，正在进入配送界面...'
        return cachedSample
      }

      try {
        const gcj02Location = await this.requestNavigationLocation('gcj02')
        if (this.hasValidCoords(gcj02Location)) {
          this.riderLng = gcj02Location.lng
          this.riderLat = gcj02Location.lat
          return gcj02Location
        }
      } catch (error) {
        console.warn('[nav] gcj02 rider location failed', error)
      }
      try {
        const wgs84Location = await this.requestNavigationLocation('wgs84')
        if (this.hasValidCoords(wgs84Location)) {
          this.riderLng = wgs84Location.lng
          this.riderLat = wgs84Location.lat
          return wgs84Location
        }
      } catch (error) {
        console.warn('[nav] wgs84 high-accuracy rider location failed', error)
      }
      try {
        const lowAccuracyLocation = await this.requestNavigationLocation('wgs84', {
          isHighAccuracy: false,
          highAccuracyExpireTime: 15000
        })
        if (this.hasValidCoords(lowAccuracyLocation)) {
          this.riderLng = lowAccuracyLocation.lng
          this.riderLat = lowAccuracyLocation.lat
          return lowAccuracyLocation
        }
      } catch (error) {
        console.warn('[nav] wgs84 low-accuracy rider location failed', error)
      }
      return {
        lng: 0,
        lat: 0
      }
    },
    getCachedRiderPosition() {
      const cached = getCachedRiderCoords()
      return hasValidCoords(cached) ? cached : null
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #0f172a;
  padding: 32rpx 24rpx;
  box-sizing: border-box;
}

.status-card {
  background: rgba(255, 255, 255, 0.96);
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 12rpx 40rpx rgba(15, 23, 42, 0.16);
}

.title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 14rpx;
}

.desc {
  display: block;
  font-size: 28rpx;
  line-height: 1.7;
  color: #475569;
  margin-bottom: 20rpx;
}

.meta {
  display: block;
  font-size: 26rpx;
  line-height: 1.8;
  color: #334155;
}

.btn {
  margin-top: 28rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 18rpx;
  font-size: 30rpx;
  height: 88rpx;
  line-height: 88rpx;
}

.btn.primary {
  margin-top: 24rpx;
}
</style>
