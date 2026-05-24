<template>
  <view v-if="show" class="transfer-dialog" @touchmove.stop.prevent="noop">
    <view class="dialog-mask" @click="$emit('close')"></view>
    <view class="dialog-panel">
      <view class="dialog-title">转派给乡镇站长</view>
      <view class="dialog-subtitle">订单号：{{ orderNo || '未提供' }}</view>

      <view class="form-row">
        <text class="form-label">目标乡镇</text>
        <picker
          class="picker-wrap"
          mode="selector"
          :range="townOptions"
          range-key="label"
          :value="selectedTownIndex"
          @change="handleTownChange"
        >
          <view class="picker-value">
            {{ selectedTownLabel || (townOptions.length ? '请选择目标乡镇' : '暂无可选乡镇') }}
          </view>
        </picker>
      </view>

      <view class="form-row">
        <text class="form-label">目标站长</text>
        <picker
          v-if="stationmasterOptions.length"
          class="picker-wrap"
          mode="selector"
          :range="stationmasterOptions"
          range-key="label"
          :value="selectedStationmasterIndex"
          @change="handleStationmasterChange"
        >
          <view class="picker-value">
            {{ selectedStationmasterLabel || '请选择目标站长' }}
          </view>
        </picker>
        <input
          v-else
          class="text-input"
          type="text"
          v-model.trim="form.transferToUser"
          :placeholder="stationmastersLoading ? '站长列表加载中...' : '请输入目标站长姓名/标识'"
          maxlength="30"
        />
      </view>

      <view class="confirm-row" @click="toggleConfirm">
        <view class="confirm-check" :class="{ checked: form.confirmed }">{{ form.confirmed ? '√' : '' }}</view>
        <text class="confirm-text">我已确认转派目标乡镇与目标站长无误</text>
      </view>

      <view class="action-row">
        <button class="action-btn cancel-btn" :disabled="loading" @click="$emit('close')">取消</button>
        <button class="action-btn confirm-btn" :disabled="loading" @click="submit">
          {{ loading ? '提交中...' : '确认转派' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    show: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    orderNo: {
      type: String,
      default: ''
    },
    townOptions: {
      type: Array,
      default: () => []
    },
    stationmasterOptions: {
      type: Array,
      default: () => []
    },
    stationmastersLoading: {
      type: Boolean,
      default: false
    },
    defaultTown: {
      type: String,
      default: ''
    },
    defaultStationmaster: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      form: {
        transferToTown: '',
        transferToTownCode: '',
        transferToUserId: '',
        transferToUser: '',
        confirmed: false
      }
    }
  },
  computed: {
    selectedTownIndex() {
      if (!this.form.transferToTownCode) {
        return 0
      }
      const index = this.townOptions.findIndex(item => item.value === this.form.transferToTownCode)
      return index >= 0 ? index : 0
    },
    selectedTownLabel() {
      return this.form.transferToTown || ''
    },
    selectedStationmasterIndex() {
      if (!this.form.transferToUser) {
        return 0
      }
      const index = this.stationmasterOptions.findIndex(item => item.label === this.form.transferToUser || item.value === this.form.transferToUser)
      return index >= 0 ? index : 0
    },
    selectedStationmasterLabel() {
      return this.form.transferToUser || ''
    }
  },
  watch: {
    show: {
      immediate: true,
      handler(value) {
        if (value) {
          this.resetForm()
        }
      }
    },
    defaultTown() {
      if (this.show) {
        this.resetForm()
      }
    },
    defaultStationmaster() {
      if (this.show) {
        this.resetForm()
      }
    }
  },
  methods: {
    noop() {},
    resetForm() {
      this.form.transferToTown = this.defaultTown || ''
      this.form.transferToTownCode = ''
      this.form.transferToUserId = ''
      this.form.transferToUser = this.defaultStationmaster || ''
      this.form.confirmed = false

      if (this.form.transferToTown) {
        const matchedTown = this.townOptions.find(item => item.label === this.form.transferToTown || item.value === this.form.transferToTown)
        if (matchedTown) {
          this.form.transferToTown = matchedTown.label
          this.form.transferToTownCode = matchedTown.value
        }
      }
    },
    handleTownChange(event) {
      const selectedTown = this.townOptions[Number(event.detail.value)]
      this.form.transferToTown = selectedTown ? selectedTown.label : ''
      this.form.transferToTownCode = selectedTown ? selectedTown.value : ''
      this.form.transferToUserId = ''
      this.form.transferToUser = ''
      this.$emit('town-change', {
        target_town_name: this.form.transferToTown,
        target_town_code: this.form.transferToTownCode
      })
    },
    handleStationmasterChange(event) {
      const selectedStationmaster = this.stationmasterOptions[Number(event.detail.value)]
      this.form.transferToUserId = selectedStationmaster ? selectedStationmaster.value : ''
      this.form.transferToUser = selectedStationmaster ? selectedStationmaster.label : ''
    },
    toggleConfirm() {
      this.form.confirmed = !this.form.confirmed
    },
    submit() {
      if (!this.form.transferToTown) {
        uni.showToast({ title: '请选择目标乡镇', icon: 'none' })
        return
      }
      if (!this.form.transferToUserId) {
        uni.showToast({ title: '请选择目标站长', icon: 'none' })
        return
      }
      if (!this.form.confirmed) {
        uni.showToast({ title: '请先完成二次确认', icon: 'none' })
        return
      }
      this.$emit('confirm', {
        target_town_name: this.form.transferToTown,
        target_town_code: this.form.transferToTownCode,
        target_user_id: this.form.transferToUserId,
        target_user_name: this.form.transferToUser
      })
    }
  }
}
</script>

<style scoped>
.transfer-dialog {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
  box-sizing: border-box;
}

.dialog-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.48);
}

.dialog-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 680rpx;
  max-height: 80vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  box-sizing: border-box;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.18);
}

.dialog-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.dialog-subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #999;
}

.form-row {
  margin-top: 24rpx;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.picker-wrap,
.text-input {
  width: 100%;
  height: 88rpx;
  border-radius: 12rpx;
  background: #f7f8fa;
  padding: 0 20rpx;
  box-sizing: border-box;
  font-size: 28rpx;
  color: #333;
  display: flex;
  align-items: center;
}

.picker-value {
  width: 100%;
  line-height: 88rpx;
  color: #333;
}

.confirm-row {
  margin-top: 28rpx;
  display: flex;
  align-items: center;
}

.confirm-check {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 2rpx solid #1890ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  margin-right: 14rpx;
}

.confirm-check.checked {
  background: #1890ff;
}

.confirm-text {
  flex: 1;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}

.action-row {
  display: flex;
  gap: 16rpx;
  margin-top: 32rpx;
}

.action-btn {
  flex: 1;
  border: none;
  border-radius: 12rpx;
  font-size: 28rpx;
  padding: 22rpx 0;
}

.cancel-btn {
  background: #f3f4f6;
  color: #666;
}

.confirm-btn {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
}
</style>
