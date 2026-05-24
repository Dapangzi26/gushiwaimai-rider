<template>
  <view class="page">
    <view v-if="loading && !application.id" class="state-wrap">
      <text class="state-text">加载中...</text>
    </view>

    <template v-else>
      <view class="card">
        <text class="section-title">申请信息</text>
        <view class="info-row">
          <text class="label">骑手昵称</text>
          <text class="value">{{ application.riderName || '未提供' }}</text>
        </view>
        <view class="info-row">
          <text class="label">申请状态</text>
          <text class="value status-text" :class="statusClassMap[application.statusKey] || 'status-pending'">
            {{ application.statusText }}
          </text>
        </view>
        <view class="info-row">
          <text class="label">账号类型</text>
          <text class="value">{{ application.riderKindText }}</text>
        </view>
        <view class="info-row">
          <text class="label">所属乡镇</text>
          <text class="value">{{ application.townName || '未标注乡镇' }}</text>
        </view>
        <view class="info-row">
          <text class="label">提交时间</text>
          <text class="value">{{ formatTime(application.submittedAt) || '未提供' }}</text>
        </view>
      </view>

      <view class="card">
        <text class="section-title">联系信息</text>
        <view class="info-row">
          <text class="label">手机号</text>
          <text class="value phone-value" @click="callPhone(application.phone)">
            {{ application.phone || '未提供' }}
          </text>
        </view>
        <view v-if="application.username" class="info-row">
          <text class="label">账号</text>
          <text class="value">{{ application.username }}</text>
        </view>
      </view>

      <view v-if="application.remark || application.idCardNo || application.vehicleInfo" class="card">
        <text class="section-title">补充信息</text>
        <view v-if="application.idCardNo" class="info-row">
          <text class="label">身份证号</text>
          <text class="value multiline-value">{{ application.idCardNo }}</text>
        </view>
        <view v-if="application.vehicleInfo" class="info-row">
          <text class="label">车辆信息</text>
          <text class="value multiline-value">{{ application.vehicleInfo }}</text>
        </view>
        <view v-if="application.remark" class="info-row">
          <text class="label">申请备注</text>
          <text class="value multiline-value">{{ application.remark }}</text>
        </view>
      </view>

      <view class="card">
        <text class="section-title">审核信息</text>
        <view class="info-row">
          <text class="label">可否审核</text>
          <text class="value">{{ application.canAudit ? '可审核' : '不可审核' }}</text>
        </view>
        <view class="info-row">
          <text class="label">锁定状态</text>
          <text class="value">{{ application.auditLocked ? '已锁定' : '未锁定' }}</text>
        </view>
        <view v-if="application.auditLockedReason" class="info-row">
          <text class="label">锁定原因</text>
          <text class="value multiline-value">{{ application.auditLockedReason }}</text>
        </view>
        <view v-if="application.auditedByName" class="info-row">
          <text class="label">审核人</text>
          <text class="value">{{ application.auditedByName }}</text>
        </view>
        <view v-if="application.auditedByRole" class="info-row">
          <text class="label">审核角色</text>
          <text class="value">{{ application.auditedByRole }}</text>
        </view>
        <view v-if="application.auditedAt" class="info-row">
          <text class="label">审核时间</text>
          <text class="value">{{ formatTime(application.auditedAt) }}</text>
        </view>
        <view v-if="application.rejectReason" class="info-row">
          <text class="label">驳回原因</text>
          <text class="value multiline-value">{{ application.rejectReason }}</text>
        </view>
      </view>
    </template>

    <view
      v-if="canShowActionBar"
      class="action-bar"
    >
      <button class="btn btn-reject" :disabled="submitting" @click="openRejectDialog">
        驳回
      </button>
      <button class="btn btn-approve" :disabled="submitting" @click="handleApprove">
        {{ submitting ? '提交中' : '同意通过' }}
      </button>
    </view>

    <view v-if="showRejectDialog" class="dialog-wrap">
      <view class="dialog-mask" @click="closeRejectDialog"></view>
      <view class="dialog-card">
        <text class="dialog-title">填写驳回原因</text>
        <textarea
          v-model="rejectReason"
          class="dialog-textarea"
          maxlength="200"
          placeholder="请填写驳回原因，骑手与后台都会看到"
        />
        <view class="dialog-actions">
          <button class="dialog-btn dialog-cancel" :disabled="submitting" @click="closeRejectDialog">取消</button>
          <button class="dialog-btn dialog-confirm" :disabled="submitting" @click="handleReject">
            {{ submitting ? '提交中' : '确认驳回' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import {
  approveTownRiderApplication,
  getTownRiderApplicationDetail,
  rejectTownRiderApplication
} from '@/api/rider-audit.js'
import { formatTime } from '@/utils/index.js'
import { isTownStationmaster } from '@/utils/rider-auth.js'
import { getUserInfo as getStoredUserInfo } from '@/utils/storage.js'

function safeText(value) {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function normalizeStatusKey(item = {}) {
  const raw = safeText(item.apply_status || item.status || item.audit_status || item.rider_audit_status).toLowerCase()
  if (raw === '1' || raw === 'approved' || raw === 'pass' || raw === 'passed' || raw === 'success') return 'approved'
  if (raw === '2' || raw === 'rejected' || raw === 'reject' || raw === 'failed') return 'rejected'
  return 'pending'
}

function normalizeStatusText(item = {}, statusKey = 'pending') {
  const text = safeText(item.apply_status_text || item.status_text || item.audit_status_text)
  if (text) return text
  if (statusKey === 'approved') return '已通过'
  if (statusKey === 'rejected') return '已驳回'
  return '待审核'
}

function normalizeRiderKindText(item = {}) {
  const riderKind = safeText(item.rider_kind || item.riderKind).toLowerCase()
  if (riderKind === 'stationmaster') {
    return '乡镇站长'
  }
  if (safeText(item.delivery_scope || item.deliveryScope).toLowerCase() === 'town_delivery') {
    return '乡镇骑手'
  }
  return '骑手'
}

function normalizeApplication(item = {}) {
  const statusKey = normalizeStatusKey(item)
  return {
    id: item.id || item.application_id || item.apply_id || item.user_id || '',
    riderName: safeText(item.nickname || item.real_name || item.name || item.username),
    username: safeText(item.username || item.account),
    phone: safeText(item.phone || item.mobile),
    townName: safeText(item.town_name || item.target_town_name || item.service_town_name),
    riderKindText: normalizeRiderKindText(item),
    statusKey,
    statusText: normalizeStatusText(item, statusKey),
    submittedAt: item.submitted_at || item.created_at || item.apply_time || '',
    auditedAt: item.audited_at || item.audit_time || item.updated_at || '',
    auditedByRole: safeText(item.audited_by_role || item.audit_role),
    auditedByName: safeText(item.audited_by_name || item.audit_user_name || item.auditor_name),
    rejectReason: safeText(item.reject_reason || item.audit_reject_reason || item.refuse_reason),
    auditLocked: toBoolean(item.audit_locked),
    auditLockedReason: safeText(item.audit_locked_reason || item.audit_locked_msg || item.locked_reason),
    canAudit: toBoolean(item.can_stationmaster_audit || item.can_audit),
    remark: safeText(item.remark || item.apply_remark || item.description),
    idCardNo: safeText(item.id_card_no || item.idCardNo),
    vehicleInfo: safeText(item.vehicle_info || item.vehicleInfo)
  }
}

export default {
  data() {
    return {
      hasPageAccess: false,
      loading: false,
      submitting: false,
      showRejectDialog: false,
      rejectReason: '',
      applicationId: '',
      application: {},
      statusClassMap: {
        pending: 'status-pending',
        approved: 'status-approved',
        rejected: 'status-rejected'
      }
    }
  },
  computed: {
    canShowActionBar() {
      return this.application.id && this.application.canAudit && !this.application.auditLocked
    }
  },
  onLoad(options) {
    this.hasPageAccess = this.ensurePageAccess()
    this.applicationId = options.id || ''
  },
  onShow() {
    this.hasPageAccess = this.ensurePageAccess()
    if (!this.hasPageAccess) {
      return
    }
    this.loadDetail()
  },
  methods: {
    formatTime,
    ensurePageAccess() {
      const user = getStoredUserInfo() || {}
      if (isTownStationmaster(user)) {
        return true
      }
      uni.showToast({ title: '仅乡镇站长可进入', icon: 'none' })
      if (typeof uni.navigateBack === 'function') {
        uni.navigateBack({
          fail: () => {
            uni.switchTab({ url: '/pages/index/index' })
          }
        })
      }
      return false
    },
    async loadDetail() {
      if (!this.hasPageAccess || !this.applicationId) {
        return
      }
      this.loading = true
      try {
        const res = await getTownRiderApplicationDetail(this.applicationId)
        this.application = normalizeApplication(res?.data || res || {})
      } catch (error) {
        console.error('加载骑手申请详情失败', error)
        uni.showToast({ title: this.getErrorMessage(error) || '加载详情失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    callPhone(phone) {
      const value = safeText(phone)
      if (!value) {
        return
      }
      uni.makePhoneCall({ phoneNumber: value })
    },
    openRejectDialog() {
      if (!this.canShowActionBar || this.submitting) {
        return
      }
      this.rejectReason = ''
      this.showRejectDialog = true
    },
    closeRejectDialog() {
      if (this.submitting) {
        return
      }
      this.showRejectDialog = false
    },
    async handleApprove() {
      if (!this.canShowActionBar || this.submitting) {
        return
      }
      uni.showModal({
        title: '审核通过',
        content: '确认通过该骑手注册申请？',
        confirmText: '确认通过',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) {
            return
          }
          this.submitting = true
          try {
            await approveTownRiderApplication(this.applicationId)
            uni.showToast({ title: '审核通过', icon: 'success' })
            await this.loadDetail()
            this.notifyListRefresh()
          } catch (error) {
            console.error('同意骑手申请失败', error)
            uni.showToast({ title: this.getErrorMessage(error) || '审核失败', icon: 'none' })
          } finally {
            this.submitting = false
          }
        }
      })
    },
    async handleReject() {
      if (!this.canShowActionBar || this.submitting) {
        return
      }
      const reason = safeText(this.rejectReason)
      if (!reason) {
        uni.showToast({ title: '请填写驳回原因', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        await rejectTownRiderApplication(this.applicationId, { reject_reason: reason })
        uni.showToast({ title: '已驳回', icon: 'success' })
        this.showRejectDialog = false
        await this.loadDetail()
        this.notifyListRefresh()
      } catch (error) {
        console.error('驳回骑手申请失败', error)
        uni.showToast({ title: this.getErrorMessage(error) || '驳回失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
    },
    notifyListRefresh() {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const listPage = pages.find(page => {
        const route = page?.route || page?.$page?.fullPath || page?.$page?.route || ''
        return String(route).includes('pages/rider-audit/index')
      })
      const vm = listPage?.$vm || listPage
      if (vm && typeof vm.reloadList === 'function') {
        vm.reloadList()
      }
    },
    getErrorMessage(error) {
      return error?.message
        ?? error?.msg
        ?? error?.data?.message
        ?? error?.data?.msg
        ?? error?.response?.data?.message
        ?? error?.response?.data?.msg
        ?? ''
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx 24rpx 180rpx;
  box-sizing: border-box;
}

.state-wrap {
  padding: 180rpx 24rpx;
  text-align: center;
}

.state-text {
  font-size: 30rpx;
  color: #666666;
}

.card {
  margin-bottom: 20rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #ffffff;
}

.section-title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #222222;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f3f3f3;
}

.info-row:last-child {
  border-bottom: none;
}

.label {
  width: 140rpx;
  font-size: 27rpx;
  color: #999999;
}

.value {
  flex: 1;
  text-align: right;
  font-size: 28rpx;
  line-height: 1.6;
  color: #333333;
  word-break: break-all;
}

.multiline-value {
  white-space: pre-wrap;
}

.status-text {
  font-weight: 700;
}

.status-pending {
  color: #faad14;
}

.status-approved {
  color: #52c41a;
}

.status-rejected {
  color: #ff4d4f;
}

.phone-value {
  color: #1890ff;
}

.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1rpx solid #f0f0f0;
}

.btn {
  flex: 1;
  height: 92rpx;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 700;
  border: none;
}

.btn-approve {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #ffffff;
}

.btn-reject {
  background: linear-gradient(135deg, #ff7875, #ff4d4f);
  color: #ffffff;
}

.dialog-wrap {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.dialog-card {
  position: relative;
  width: 650rpx;
  padding: 30rpx;
  border-radius: 24rpx;
  background: #ffffff;
}

.dialog-title {
  display: block;
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #222222;
  text-align: center;
}

.dialog-textarea {
  width: 100%;
  height: 220rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: #f7f7f7;
  font-size: 28rpx;
  box-sizing: border-box;
}

.dialog-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}

.dialog-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 14rpx;
  font-size: 28rpx;
  border: none;
}

.dialog-cancel {
  background: #f3f3f3;
  color: #666666;
}

.dialog-confirm {
  background: #ff4d4f;
  color: #ffffff;
}
</style>
