<template>
  <view v-if="show" class="transfer-dialog" @touchmove.stop.prevent="noop">
    <view class="dialog-mask" @click="$emit('close')"></view>
    <view class="dialog-panel">
      <view class="dialog-title">转给骑手</view>
      <view class="dialog-subtitle">订单号：{{ orderNo || '未提供' }}</view>

      <view class="form-row">
        <text class="form-label">目标骑手</text>
        <view v-if="riderOptions.length" class="rider-list">
          <view
            v-for="item in riderOptions"
            :key="item.value"
            class="rider-item"
            :class="{ active: form.targetRiderId === item.value }"
            @click="selectRider(item)"
          >
            <view class="rider-main">
              <text class="rider-name">{{ item.label || '骑手' }}</text>
              <text class="rider-phone" v-if="item.phone">{{ item.phone }}</text>
            </view>
            <view class="rider-side">
              <text class="rider-status" :class="{ online: Number(item.isOnline) === 1 }">
                {{ Number(item.isOnline) === 1 ? '在线' : '离线' }}
              </text>
            </view>
          </view>
        </view>
        <view v-else class="empty-text">
          {{ loading ? '骑手列表加载中...' : '当前没有可转交的乡镇骑手' }}
        </view>
      </view>

      <view class="form-row">
        <text class="form-label">备注</text>
        <input
          class="text-input"
          type="text"
          v-model.trim="form.remark"
          placeholder="站长转交本乡镇骑手配送"
          maxlength="50"
        />
      </view>

      <view class="confirm-row" @click="toggleConfirm">
        <view class="confirm-check" :class="{ checked: form.confirmed }">{{ form.confirmed ? '√' : '' }}</view>
        <text class="confirm-text">我已确认目标骑手无误</text>
      </view>

      <view class="action-row">
        <button class="action-btn cancel-btn" :disabled="loading" @click="$emit('close')">取消</button>
        <button class="action-btn confirm-btn" :disabled="loading" @click="submit">
          {{ loading ? '提交中...' : '确认转单' }}
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
    riderOptions: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      form: {
        targetRiderId: '',
        remark: '站长转交本乡镇骑手配送',
        confirmed: false
      }
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
    }
  },
  methods: {
    noop() {},
    resetForm() {
      this.form.targetRiderId = ''
      this.form.remark = '站长转交本乡镇骑手配送'
      this.form.confirmed = false
    },
    selectRider(item = {}) {
      this.form.targetRiderId = item.value || ''
    },
    toggleConfirm() {
      this.form.confirmed = !this.form.confirmed
    },
    submit() {
      if (!this.form.targetRiderId) {
        uni.showToast({ title: '请选择目标骑手', icon: 'none' })
        return
      }
      if (!this.form.confirmed) {
        uni.showToast({ title: '请先完成二次确认', icon: 'none' })
        return
      }
      this.$emit('confirm', {
        target_rider_id: this.form.targetRiderId,
        remark: this.form.remark || '站长转交本乡镇骑手配送'
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
  font-weight: 700;
  color: #333;
}

.dialog-subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #999;
}

.form-row {
  margin-top: 28rpx;
}

.form-label {
  display: block;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.rider-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.rider-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 20rpx;
  border: 2rpx solid #f0f0f0;
  border-radius: 16rpx;
  background: #fafafa;
}

.rider-item.active {
  border-color: #1890ff;
  background: #f0f7ff;
}

.rider-main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.rider-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #222;
}

.rider-phone {
  font-size: 24rpx;
  color: #666;
}

.rider-side {
  margin-left: 20rpx;
}

.rider-status {
  font-size: 24rpx;
  font-weight: 600;
  color: #999;
}

.rider-status.online {
  color: #2b8a57;
}

.empty-text {
  padding: 24rpx 20rpx;
  border-radius: 16rpx;
  background: #fafafa;
  font-size: 26rpx;
  color: #999;
}

.text-input {
  width: 100%;
  height: 88rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  border: 2rpx solid #f0f0f0;
  background: #fafafa;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.confirm-row {
  display: flex;
  align-items: center;
  margin-top: 28rpx;
}

.confirm-check {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 2rpx solid #d9d9d9;
  margin-right: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22rpx;
}

.confirm-check.checked {
  border-color: #1890ff;
  background: #1890ff;
}

.confirm-text {
  flex: 1;
  font-size: 26rpx;
  color: #666;
}

.action-row {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  border: none;
  border-radius: 14rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.confirm-btn {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
}
</style>
