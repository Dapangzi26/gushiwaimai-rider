<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">商家入驻审核</text>
      <text class="page-tip">仅允许审核当前乡镇的真实商家申请</text>
    </view>

    <view class="status-tabs">
      <view
        v-for="item in statusTabs"
        :key="item.key"
        class="tab-item"
        :class="{ active: currentStatus === item.key }"
        @click="switchStatus(item.key)"
      >
        <text class="tab-text">{{ item.label }}</text>
        <text v-if="item.count > 0" class="tab-badge">{{ item.count > 99 ? '99+' : item.count }}</text>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="list-scroll"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <view v-if="loading && applications.length === 0" class="state-wrap">
        <text class="state-text">加载中...</text>
      </view>

      <view v-else-if="applications.length === 0" class="state-wrap">
        <text class="state-text">暂无商家入驻申请</text>
        <text class="state-tip">{{ getEmptyTip() }}</text>
      </view>

      <view v-else class="card-list">
        <view
          v-for="item in applications"
          :key="item.id"
          class="merchant-card"
          @click="openDetail(item)"
        >
          <view class="card-top">
            <view class="merchant-meta">
              <text class="merchant-name">{{ item.merchantName }}</text>
              <text class="town-name">{{ item.townName || '未标注乡镇' }}</text>
            </view>
            <text class="status-tag" :class="statusClassMap[item.statusKey] || 'status-pending'">
              {{ item.statusText }}
            </text>
          </view>

          <view class="info-row">
            <text class="info-label">联系人</text>
            <text class="info-value">{{ item.contactName || '未提供' }} {{ item.contactPhone || '' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">申请地址</text>
            <text class="info-value address-text">{{ item.address || '未提供' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">提交时间</text>
            <text class="info-value">{{ formatTime(item.submittedAt) || '未提供' }}</text>
          </view>
          <view v-if="item.auditedByName || item.auditedAt || item.lockedReason" class="audit-summary">
            <text class="audit-summary-text">{{ buildAuditSummary(item) }}</text>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="load-more">
        <text>加载中...</text>
      </view>
      <view v-else-if="applications.length > 0 && !hasMore" class="load-more">
        <text>没有更多了</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getTownMerchantApplications } from '@/api/merchant-audit.js'
import { formatTime } from '@/utils/index.js'
import { isTownStationmaster } from '@/utils/rider-auth.js'
import { getUserInfo as getStoredUserInfo } from '@/utils/storage.js'

function pickList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

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
  const raw = safeText(item.apply_status || item.status || item.audit_status).toLowerCase()
  if (raw === 'approved' || raw === 'pass' || raw === 'passed' || raw === 'success') return 'approved'
  if (raw === 'rejected' || raw === 'reject' || raw === 'failed') return 'rejected'
  if (raw === 'all') return 'all'
  return 'pending'
}

function normalizeStatusText(item = {}, statusKey = 'pending') {
  const text = safeText(item.apply_status_text || item.status_text || item.audit_status_text)
  if (text) return text
  if (statusKey === 'approved') return '已通过'
  if (statusKey === 'rejected') return '已驳回'
  return '待审核'
}

function normalizeApplication(item = {}) {
  const statusKey = normalizeStatusKey(item)
  return {
    id: item.id || item.application_id || item.apply_id || '',
    merchantName: safeText(item.merchant_name || item.shop_name || item.store_name || item.name),
    contactName: safeText(item.contact_name || item.owner_name || item.manager_name),
    contactPhone: safeText(item.contact_phone || item.phone || item.mobile),
    address: safeText(item.address || item.detail_address || item.shop_address),
    townName: safeText(item.town_name || item.target_town_name || item.service_town_name),
    statusKey,
    statusText: normalizeStatusText(item, statusKey),
    submittedAt: item.submitted_at || item.created_at || item.apply_time || '',
    auditedAt: item.audited_at || item.audit_time || item.updated_at || '',
    auditedByRole: safeText(item.audited_by_role || item.audit_role),
    auditedByName: safeText(item.audited_by_name || item.audit_user_name || item.auditor_name),
    lockedReason: safeText(item.audit_locked_reason || item.audit_locked_msg || item.audit_locked_reason_text || item.locked_reason),
    canAudit: toBoolean(item.can_stationmaster_audit)
  }
}

function extractTotal(payload, fallbackLength = 0) {
  const maybeTotal = Number(
    payload?.total
    ?? payload?.count
    ?? payload?.meta?.total
    ?? payload?.pagination?.total
    ?? fallbackLength
  )
  return Number.isFinite(maybeTotal) ? maybeTotal : fallbackLength
}

function extractSummaryCount(payload, key, fallback = 0) {
  const maybeCount = Number(
    payload?.summary?.[key]
    ?? payload?.stats?.[key]
    ?? payload?.[key]
    ?? fallback
  )
  return Number.isFinite(maybeCount) ? maybeCount : fallback
}

export default {
  data() {
    return {
      hasPageAccess: false,
      loading: false,
      refreshing: false,
      loadingMore: false,
      page: 1,
      pageSize: 10,
      hasMore: true,
      currentStatus: 'pending',
      applications: [],
      statusTabs: [
        { key: 'pending', label: '待审核', count: 0 },
        { key: 'approved', label: '已通过', count: 0 },
        { key: 'rejected', label: '已驳回', count: 0 }
      ],
      statusClassMap: {
        pending: 'status-pending',
        approved: 'status-approved',
        rejected: 'status-rejected'
      }
    }
  },
  onLoad() {
    this.hasPageAccess = this.ensurePageAccess()
  },
  onShow() {
    this.hasPageAccess = this.ensurePageAccess()
    if (!this.hasPageAccess) {
      return
    }
    this.reloadList()
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
    async reloadList() {
      this.page = 1
      this.hasMore = true
      await this.loadApplications(true)
    },
    getQueryStatus() {
      return this.currentStatus
    },
    async loadApplications(replace = false) {
      if (!this.hasPageAccess) {
        return
      }
      if (replace) {
        this.loading = true
      } else {
        this.loadingMore = true
      }
      try {
        const params = {
          status: this.getQueryStatus(),
          page: this.page,
          page_size: this.pageSize
        }
        const res = await getTownMerchantApplications(params)
        const payload = res?.data ?? res ?? {}
        const source = pickList(payload)
        const normalized = source.map(normalizeApplication).filter(item => item.id)
        if (replace) {
          this.applications = normalized
        } else {
          this.applications = this.applications.concat(normalized)
        }
        const total = extractTotal(payload, normalized.length)
        const currentLength = replace ? normalized.length : this.applications.length
        this.hasMore = currentLength < total && normalized.length >= this.pageSize
        this.updateTabCounts(payload, source)
      } catch (error) {
        console.error('加载商家入驻申请失败', error)
        if (replace) {
          this.applications = []
        }
      } finally {
        this.loading = false
        this.refreshing = false
        this.loadingMore = false
        uni.stopPullDownRefresh()
      }
    },
    updateTabCounts(payload = {}, source = []) {
      const pendingCount = extractSummaryCount(
        payload,
        'pending_count',
        source.filter(item => normalizeStatusKey(item) === 'pending').length
      )
      const approvedCount = extractSummaryCount(
        payload,
        'approved_count',
        source.filter(item => normalizeStatusKey(item) === 'approved').length
      )
      const rejectedCount = extractSummaryCount(
        payload,
        'rejected_count',
        source.filter(item => normalizeStatusKey(item) === 'rejected').length
      )
      this.statusTabs = [
        { key: 'pending', label: '待审核', count: pendingCount },
        { key: 'approved', label: '已通过', count: approvedCount },
        { key: 'rejected', label: '已驳回', count: rejectedCount }
      ]
    },
    buildAuditSummary(item = {}) {
      if (item.lockedReason) {
        return item.lockedReason
      }
      const pieces = []
      if (item.auditedByName) {
        pieces.push(`审核人：${item.auditedByName}`)
      }
      if (item.auditedAt) {
        pieces.push(`审核时间：${this.formatTime(item.auditedAt)}`)
      }
      return pieces.join(' · ')
    },
    switchStatus(status) {
      if (this.currentStatus === status) {
        return
      }
      this.currentStatus = status
      this.reloadList()
    },
    getEmptyTip() {
      if (this.currentStatus === 'approved') {
        return '当前乡镇暂无已通过的入驻申请'
      }
      if (this.currentStatus === 'rejected') {
        return '当前乡镇暂无已驳回的入驻申请'
      }
      return '当前乡镇暂无待审核的商家申请'
    },
    onRefresh() {
      this.refreshing = true
      this.reloadList()
    },
    loadMore() {
      if (!this.hasMore || this.loadingMore || this.loading) {
        return
      }
      this.page += 1
      this.loadApplications(false)
    },
    openDetail(item = {}) {
      uni.navigateTo({
        url: `/pages/merchant-audit/detail?id=${item.id}`
      })
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
  box-sizing: border-box;
}

.page-header,
.status-tabs,
.merchant-card {
  background: #ffffff;
  border-radius: 20rpx;
}

.page-header {
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
}

.page-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: #333333;
}

.page-tip {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #999999;
}

.status-tabs {
  display: flex;
  gap: 16rpx;
  padding: 14rpx;
  margin-bottom: 20rpx;
}

.tab-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background: #f6f7fb;
}

.tab-item.active {
  background: #e6f4ff;
}

.tab-text {
  font-size: 28rpx;
  color: #666666;
  font-weight: 500;
}

.tab-item.active .tab-text {
  color: #1890ff;
}

.tab-badge {
  min-width: 32rpx;
  padding: 0 10rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 16rpx;
  font-size: 20rpx;
  color: #ffffff;
  background: #ff4d4f;
}

.list-scroll {
  height: calc(100vh - 280rpx);
}

.state-wrap {
  padding: 180rpx 24rpx;
  text-align: center;
}

.state-text {
  font-size: 30rpx;
  color: #666666;
}

.state-tip {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #999999;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding-bottom: 24rpx;
}

.merchant-card {
  padding: 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.04);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.merchant-meta {
  flex: 1;
  min-width: 0;
}

.merchant-name {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #222222;
}

.town-name {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #666666;
}

.status-tag {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #ffffff;
}

.status-pending {
  background: #faad14;
}

.status-approved {
  background: #52c41a;
}

.status-rejected {
  background: #ff4d4f;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding-top: 14rpx;
}

.info-label {
  width: 120rpx;
  font-size: 26rpx;
  color: #999999;
}

.info-value {
  flex: 1;
  text-align: right;
  font-size: 27rpx;
  line-height: 1.5;
  color: #333333;
  word-break: break-all;
}

.address-text {
  color: #666666;
}

.audit-summary {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: #fafafa;
}

.audit-summary-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #666666;
}

.load-more {
  text-align: center;
  padding: 24rpx 0 40rpx;
  font-size: 24rpx;
  color: #999999;
}
</style>
