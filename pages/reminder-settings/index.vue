<template>
  <view class="container">
    <view class="card">
      <view class="section-title">统一提醒总开关</view>
      <view class="setting-row">
        <view class="setting-text">
          <text class="setting-name">启用提醒中心</text>
          <text class="setting-desc">统一管理新派单、转派、取消、超时、出餐和站长通知</text>
        </view>
        <switch :checked="settings.enabled" color="#1890FF" @change="toggleRoot('enabled', $event)" />
      </view>
    </view>

    <view class="card">
      <view class="section-title">提醒方式</view>
      <view class="setting-row">
        <view class="setting-text">
          <text class="setting-name">语音播报</text>
          <text class="setting-desc">前台在线时使用语音播报订单与通知内容</text>
        </view>
        <switch :checked="settings.voiceEnabled" color="#1890FF" :disabled="!settings.enabled" @change="toggleRoot('voiceEnabled', $event)" />
      </view>
      <view class="setting-row">
        <view class="setting-text">
          <text class="setting-name">提示音</text>
          <text class="setting-desc">前台在线时先响提示音，再播报语音</text>
        </view>
        <switch :checked="settings.soundEnabled" color="#1890FF" :disabled="!settings.enabled" @change="toggleRoot('soundEnabled', $event)" />
      </view>
      <view class="setting-row">
        <view class="setting-text">
          <text class="setting-name">震动提醒</text>
          <text class="setting-desc">前台在线时配合短震动，避免只听声音漏单</text>
        </view>
        <switch :checked="settings.vibrationEnabled" color="#1890FF" :disabled="!settings.enabled" @change="toggleRoot('vibrationEnabled', $event)" />
      </view>
      <view class="setting-row">
        <view class="setting-text">
          <text class="setting-name">后台系统通知</text>
          <text class="setting-desc">APP 进入后台或息屏后，优先走本地系统通知栏提醒</text>
        </view>
        <switch :checked="settings.systemNotificationEnabled" color="#1890FF" :disabled="!settings.enabled" @change="toggleRoot('systemNotificationEnabled', $event)" />
      </view>
      <view class="setting-row">
        <view class="setting-text">
          <text class="setting-name">导航关键提醒</text>
          <text class="setting-desc">导航页可选播报临近到店、临近送达提醒，默认关闭</text>
        </view>
        <switch :checked="settings.navigationVoiceEnabled" color="#1890FF" :disabled="!settings.enabled" @change="toggleRoot('navigationVoiceEnabled', $event)" />
      </view>
    </view>

    <view class="card">
      <view class="section-title">提醒类型</view>
      <view class="setting-row" v-for="item in categoryItems" :key="item.key">
        <view class="setting-text">
          <text class="setting-name">{{ item.title }}</text>
          <text class="setting-desc">{{ item.desc }}</text>
        </view>
        <switch
          :checked="settings.categories[item.key]"
          color="#1890FF"
          :disabled="!settings.enabled || (item.key === 'navigation' && !settings.navigationVoiceEnabled)"
          @change="toggleCategory(item.key, $event)"
        />
      </view>
    </view>

    <view class="card tips-card">
      <view class="section-title">系统边界说明</view>
      <text class="tip-line">前台在线：语音 + 提示音 + 震动可以完整生效。</text>
      <text class="tip-line">后台/息屏：当前前端已补本地系统通知，但若系统已挂起或杀掉进程，仍需要后端真正的 push 才能稳定唤醒。</text>
      <text class="tip-line">超时提醒：只有后端返回明确超时剩余时间或超时时间字段时，系统才会播报，不会前端瞎猜。</text>
    </view>

    <button class="reset-btn" @click="handleReset">恢复默认设置</button>
  </view>
</template>

<script>
import { getReminderSettings, resetReminderSettings, updateReminderSettings } from '@/utils/reminder-settings.js'
import { notifyReminderSettingsChanged } from '@/utils/reminder-center.js'

export default {
  data() {
    return {
      settings: getReminderSettings(),
      categoryItems: [
        { key: 'newOrder', title: '新派单', desc: '县城调度派单、乡镇新配送任务' },
        { key: 'transfer', title: '转派/改派', desc: '转派到你、改派更新、转单链路变化' },
        { key: 'cancel', title: '订单取消', desc: '配送中或待处理订单被取消时提醒' },
        { key: 'timeout', title: '即将超时', desc: '仅在后端给出明确剩余秒数或超时点时提醒' },
        { key: 'pickupReady', title: '商家已出餐', desc: '订单进入备货完成，可立即去取餐' },
        { key: 'stationNotice', title: '站长/调度通知', desc: '乡镇消息、站长通知、调度通知统一走这里' },
        { key: 'navigation', title: '导航关键提醒', desc: '导航中临近到店、临近送达提醒' }
      ]
    }
  },
  methods: {
    saveSettings(patch = {}) {
      this.settings = updateReminderSettings(patch)
      notifyReminderSettingsChanged()
    },
    toggleRoot(key, event) {
      this.saveSettings({ [key]: !!event.detail.value })
    },
    toggleCategory(key, event) {
      this.saveSettings({
        categories: {
          [key]: !!event.detail.value
        }
      })
    },
    handleReset() {
      uni.showModal({
        title: '恢复默认',
        content: '确认恢复默认提醒设置吗？',
        success: (res) => {
          if (!res.confirm) {
            return
          }
          this.settings = resetReminderSettings()
          notifyReminderSettingsChanged()
          uni.showToast({ title: '已恢复默认', icon: 'success' })
        }
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
  box-sizing: border-box;
}

.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #222;
  margin-bottom: 20rpx;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f2f2f2;
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.setting-name {
  font-size: 28rpx;
  color: #222;
  font-weight: 600;
}

.setting-desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #888;
  line-height: 1.5;
}

.tips-card {
  background: #fffbe6;
}

.tip-line {
  display: block;
  font-size: 24rpx;
  color: #8a6d3b;
  line-height: 1.7;
  margin-bottom: 10rpx;
}

.tip-line:last-child {
  margin-bottom: 0;
}

.reset-btn {
  margin-top: 20rpx;
  background: linear-gradient(135deg, #ff7875, #ff4d4f);
  color: #fff;
  border-radius: 14rpx;
  font-size: 28rpx;
}
</style>
