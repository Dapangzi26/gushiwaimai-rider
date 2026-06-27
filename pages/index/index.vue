<template>
  <view class="container">
    <!-- 顶部状态栏 -->
    <view class="header">
      <view class="header-left">
        <text class="header-emoji">🛵</text>
        <view class="header-info">
          <text class="header-title">{{ isMerchantDeliveryMode ? '自配送工作台' : '骑手工作台' }}</text>
          <text class="header-sub">{{ isMerchantDeliveryMode ? `${nickname}，请处理本店配送订单` : `${nickname}，今天也辛苦了` }}</text>
        </view>
      </view>
      <view v-if="!isMerchantDeliveryMode" class="status-switch" @click="toggleOnline">
        <text class="switch-text" :class="{ 'highlight-online': isOnline }">{{ isOnline ? '接单中' : '已休息' }}</text>
        <view class="switch-dot" :class="{online: isOnline}"></view>
      </view>
    </view>

    <!-- 数据统计 -->
    <view class="stats-grid">
      <view class="stat-card">
        <text class="stat-num">{{ stats.todayDone }}</text>
        <text class="stat-label">今日完成</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">{{ stats.delivering }}</text>
        <text class="stat-label">配送中</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">¥{{ stats.todayEarning }}</text>
        <text class="stat-label">完成订单收入统计</text>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="section-title-small">📦 订单管理</view>
      <view class="menu-grid">
        <view class="menu-item" @click="goOrders">
          <view class="menu-icon-wrap" style="background-color: #E6F7FF;">
            <text class="menu-icon">📋</text>
          </view>
          <text class="menu-text">外卖订单</text>
          <text class="menu-badge" v-if="stats.pending > 0">{{ stats.pending }}</text>
        </view>
        <view v-if="!isMerchantDeliveryMode" class="menu-item" @click="goErrands">
          <view class="menu-icon-wrap" style="background-color: #FFF7E6;">
            <text class="menu-icon">🏃</text>
          </view>
          <text class="menu-text">跑腿订单</text>
          <text class="menu-badge" v-if="stats.errandPending > 0">{{ stats.errandPending }}</text>
        </view>
        <view class="menu-item" @click="goTodayOrders">
          <view class="menu-icon-wrap" style="background-color: #F0F5FF;">
            <text class="menu-icon">📊</text>
          </view>
          <text class="menu-text">今日订单</text>
          <text class="menu-badge" v-if="stats.todayDone > 0">{{ stats.todayDone }}</text>
        </view>
      </view>
    </view>

    <view class="menu-section">
      <view class="section-title-small">🛠️ 我的服务</view>
      <view class="menu-grid">
        <view v-if="showStationMessageEntry" class="menu-item" @click="goStationMessages">
          <view class="menu-icon-wrap" style="background-color: #FFF1F0;">
            <text class="menu-icon">💬</text>
          </view>
          <text class="menu-text">跑腿代购消息</text>
          <text class="menu-badge" v-if="stationMessageUnread > 0">{{ formatBadgeCount(stationMessageUnread) }}</text>
        </view>
        <view v-if="showMerchantAuditEntry" class="menu-item" @click="goMerchantAudit">
          <view class="menu-icon-wrap" style="background-color: #F6FFED;">
            <text class="menu-icon">🏪</text>
          </view>
          <text class="menu-text">商家入驻审核</text>
          <text class="menu-badge" v-if="merchantAuditPending > 0">{{ formatBadgeCount(merchantAuditPending) }}</text>
        </view>
        <view v-if="showRiderAuditEntry" class="menu-item" @click="goRiderAudit">
          <view class="menu-icon-wrap" style="background-color: #F9F0FF;">
            <text class="menu-icon">👤</text>
          </view>
          <text class="menu-text">骑手审核</text>
          <text class="menu-badge" v-if="riderAuditPending > 0">{{ formatBadgeCount(riderAuditPending) }}</text>
        </view>
      </view>
    </view>

    <!-- 自定义确认弹窗 -->
    <view class="confirm-dialog" v-if="showConfirmDialog">
      <view class="dialog-mask" @click="cancelOffWork"></view>
      <view class="dialog-content">
        <view class="dialog-title">提示</view>
        <view class="dialog-message">确定现在下班吗？</view>
        <view class="dialog-buttons">
          <button 
            class="dialog-btn confirm-btn" 
            :class="{ disabled: countdown > 0 }"
            @click="confirmOffWork"
          >
            {{ countdown > 0 ? `确定 (${countdown}s)` : '确定' }}
          </button>
          <button 
            class="dialog-btn cancel-btn" 
            @click="cancelOffWork"
          >
            取消
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getTownMerchantApplications } from '@/api/merchant-audit.js'
import { getRiderOrders, getRiderTodaySummary, updateRiderStatus } from '@/api/order.js'
import { getTownRiderApplications } from '@/api/rider-audit.js'
import { getErrandList } from '@/api/errand.js'
import { getTownErrandConversations } from '@/api/town-errand-message.js'
import { getUserInfo } from '@/api/user.js'
import { ORDER_STATUS } from '@/config/index.js'
import { REMINDER_CENTER_EVENTS } from '@/utils/reminder-center.js'
import { isCountyRider, isMerchantDeliveryUser, isTownScopeUser, isTownStationmaster } from '@/utils/rider-auth.js'
import { getRiderStatus, getUserInfo as getStoredUserInfo, setRiderStatus } from '@/utils/storage.js'
import { formatTime } from '@/utils/index.js'

export default {
  data() {
    return {
      isOnline: true,
      nickname: '骑手',
      userProfile: null,
      stationMessageUnread: 0,
      merchantAuditPending: 0,
      riderAuditPending: 0,
      allOrders: [],
      errandOrders: [],
      stats: {
        todayDone: 0,
        delivering: 0,
        todayEarning: '0.00',
        pending: 0,
        errandPending: 0
      },
      // 确认弹窗相关
      showConfirmDialog: false,
      countdown: 5,
      countdownTimer: null,
      reminderEventHandler: null,
      orderRefreshHandler: null,
      townUnreadHandler: null,
      workbenchRefreshTimer: null,
      workbenchLoadPromise: null,
      navigatingUrl: ''
    }
  },
  computed: {
    pendingOrders() {
      const profile = this.userProfile || getStoredUserInfo() || {}
      if (isMerchantDeliveryUser(profile)) {
        return this.allOrders.filter(order => Number(order.status) === 3)
      }
      if (isTownStationmaster(profile) || isTownScopeUser(profile)) {
        return this.allOrders.filter(order => this.canShowTownPendingOrder(order))
      }
      if (isCountyRider(profile)) {
        return this.allOrders.filter(order => this.canShowCountyPendingOrder(order))
      }
      return []
    },
    isMerchantDeliveryMode() {
      const profile = this.userProfile || getStoredUserInfo() || {}
      return isMerchantDeliveryUser(profile)
    },
    showStationMessageEntry() {
      const profile = this.userProfile || {}
      return !isMerchantDeliveryUser(profile) && isTownStationmaster(profile)
    },
    showMerchantAuditEntry() {
      const profile = this.userProfile || {}
      return !isMerchantDeliveryUser(profile) && isTownStationmaster(profile)
    },
    showRiderAuditEntry() {
      const profile = this.userProfile || {}
      return !isMerchantDeliveryUser(profile) && isTownStationmaster(profile)
    }
  },
  onLoad() {
    // 加载骑手状态
    const savedStatus = getRiderStatus()
    this.isOnline = savedStatus === 1
    const storedUser = getStoredUserInfo()
    if (storedUser) {
      this.userProfile = storedUser
      this.nickname = storedUser.nickname || (isMerchantDeliveryUser(storedUser) ? '配送员' : '骑手')
    }
    this.bindReminderEvents()
  },
  onShow() {
    const app = typeof getApp === 'function' ? getApp() : null
    const refreshSession = app?.globalData?.refreshRiderSession
    if (typeof refreshSession === 'function') {
      refreshSession(false).catch((error) => {
        console.error('工作台刷新骑手会话失败', error)
      })
    }
    this.loadData()
  },
  onUnload() {
    this.unbindReminderEvents()
    if (this.workbenchRefreshTimer) {
      clearTimeout(this.workbenchRefreshTimer)
      this.workbenchRefreshTimer = null
    }
  },
  methods: {
    bindReminderEvents() {
      if (!this.reminderEventHandler) {
        this.reminderEventHandler = (payload = {}) => {
          if (payload.type === 'station_notice') {
            this.loadStationMessageSummary()
          }
        }
      }
      if (!this.orderRefreshHandler) {
        this.orderRefreshHandler = () => {
          if (this.workbenchRefreshTimer) {
            clearTimeout(this.workbenchRefreshTimer)
          }
          this.workbenchRefreshTimer = setTimeout(() => {
            Promise.all([
              this.loadOrders(),
              this.loadTodaySummary(),
              this.loadErrands()
            ]).then(() => {
              this.calculateQueueStats()
            })
          }, 300)
        }
      }
      if (!this.townUnreadHandler) {
        this.townUnreadHandler = (payload = {}) => {
          this.stationMessageUnread = Number(payload.unreadTotal || 0)
        }
      }
      uni.$off(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler)
      uni.$off(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler)
      uni.$off(REMINDER_CENTER_EVENTS.townUnread, this.townUnreadHandler)
      uni.$on(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler)
      uni.$on(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler)
      uni.$on(REMINDER_CENTER_EVENTS.townUnread, this.townUnreadHandler)
    },
    unbindReminderEvents() {
      if (this.reminderEventHandler) {
        uni.$off(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler)
      }
      if (this.orderRefreshHandler) {
        uni.$off(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler)
      }
      if (this.townUnreadHandler) {
        uni.$off(REMINDER_CENTER_EVENTS.townUnread, this.townUnreadHandler)
      }
    },
    formatTime,
    formatBadgeCount(count) {
      return count > 99 ? '99+' : String(count)
    },
    getStatusText(status) {
      return ORDER_STATUS[status]?.text || '未知状态'
    },
    safeText(value) {
      if (value === undefined || value === null) {
        return ''
      }
      return String(value).trim()
    },
    toBoolean(value) {
      return value === true || value === 1 || value === '1' || value === 'true'
    },
    isTransferOrder(order = {}) {
      return this.toBoolean(order.is_transfer_order) || !!this.safeText(order.transfer_tag)
    },
    getTransferTag(order = {}) {
      return this.safeText(order.transfer_tag) || (this.isTransferOrder(order) ? '转派单' : '')
    },
    getTransferToTownName(order = {}) {
      const targetTown = order.transfer_to_town
      if (targetTown && typeof targetTown === 'object') {
        return this.safeText(
          targetTown.area_name
          || targetTown.town_name
          || targetTown.label
          || targetTown.name
          || targetTown.value
        )
      }
      return this.safeText(targetTown)
    },
    getTransferFromUserName(order = {}) {
      const transferFromUser = order.transfer_from_user
      if (transferFromUser && typeof transferFromUser === 'object') {
        return this.safeText(
          transferFromUser.nickname
          || transferFromUser.real_name
          || transferFromUser.name
          || transferFromUser.username
        )
      }
      return this.safeText(transferFromUser) || '县城司机'
    },
    getTransferWorkbenchText(order = {}) {
      const targetTown = this.getTransferToTownName(order)
      const fromUser = this.getTransferFromUserName(order)
      const summary = this.safeText(order.transfer_chain_summary)
      if (summary) {
        return summary
      }
      if (targetTown) {
        return `来源：${fromUser} · 目标乡镇：${targetTown}`
      }
      return `来源：${fromUser}`
    },
    isTownOrder(order = {}) {
      return order.order_type === 'town' || order.delivery_scope === 'town_delivery' || !!this.getTownName(order)
    },
    getTownName(order = {}) {
      return order.customer_town || order.town_name || order.rider_town || this.getTransferToTownName(order) || ''
    },
    normalizeIdentityValue(value) {
      if (value === undefined || value === null || value === '') {
        return ''
      }
      return String(value)
    },
    getCurrentRiderId() {
      const profile = this.userProfile || getStoredUserInfo() || {}
      return this.normalizeIdentityValue(profile.id || profile.user_id || profile.userId)
    },
    getOrderOwnerId(order = {}) {
      return this.normalizeIdentityValue(order.rider_id || order.riderId || order.user_id || order.userId)
    },
    getOrderResponsibleId(order = {}) {
      return this.normalizeIdentityValue(
        order.current_responsible_user_id
        || order.currentResponsibleUserId
        || order.rider_id
        || order.riderId
      )
    },
    isOwnedByCurrentRider(order = {}) {
      const currentRiderId = this.getCurrentRiderId()
      const orderOwnerId = this.getOrderOwnerId(order)
      return !!currentRiderId && !!orderOwnerId && currentRiderId === orderOwnerId
    },
    isTownPoolOrder(order = {}) {
      if (!this.isTownOrder(order)) {
        return false
      }
      const status = Number(order.status)
      if (![3, 4].includes(status)) {
        return false
      }
      return !this.getOrderResponsibleId(order)
    },
    canShowTownPendingOrder(order = {}) {
      if (!this.isTownOrder(order) && !this.isTransferOrder(order)) {
        return false
      }
      return this.isTownPoolOrder(order)
    },
    canShowCountyPendingOrder(order = {}) {
      if (this.isTownOrder(order) || this.isTransferOrder(order)) {
        return false
      }
      const status = Number(order.status)
      return [4, 5].includes(status) && this.isOwnedByCurrentRider(order)
    },
    getPendingEmptyTip() {
      const profile = this.userProfile || getStoredUserInfo() || {}
      if (isTownStationmaster(profile)) {
        return '当前没有本乡镇可见配送订单'
      }
      return '当前没有分配到你的配送任务'
    },
    navigateOnce(url = '') {
      if (!url || this.navigatingUrl === url) {
        return
      }
      this.navigatingUrl = url
      uni.navigateTo({
        url,
        complete: () => {
          setTimeout(() => {
            this.navigatingUrl = ''
          }, 500)
        }
      })
    },
    
    async loadData() {
      if (this.workbenchLoadPromise) {
        return this.workbenchLoadPromise
      }

      this.workbenchLoadPromise = (async () => {
        await this.loadUserInfo()
        await Promise.allSettled([
          this.loadOrders(),
          this.loadTodaySummary(),
          this.loadErrands()
        ])
        this.calculateQueueStats()
        await this.loadWorkbenchSecondaryData()
      })()

      try {
        return await this.workbenchLoadPromise
      } finally {
        this.workbenchLoadPromise = null
      }
    },
    async loadWorkbenchSecondaryData() {
      const tasks = []
      if (this.showStationMessageEntry) {
        tasks.push(this.loadStationMessageSummary(true))
      }
      if (this.showMerchantAuditEntry) {
        tasks.push(this.loadMerchantAuditSummary())
      }
      if (this.showRiderAuditEntry) {
        tasks.push(this.loadRiderAuditSummary())
      }
      if (!tasks.length) {
        return
      }
      await Promise.allSettled(tasks)
    },
    
    async loadUserInfo() {
      try {
        const res = await getUserInfo({
          background: true,
          silent: true,
          suppressAuthToast: true,
          suppressErrorToast: true
        })
        if (res.data) {
          this.userProfile = res.data
          this.nickname = res.data.nickname || (isMerchantDeliveryUser(res.data) ? '配送员' : '骑手')
        }
      } catch (e) {
        console.error('加载用户信息失败', e)
      }
    },
    
    async loadOrders() {
      try {
        const res = await getRiderOrders({}, {
          background: true,
          silent: true,
          suppressAuthToast: true,
          suppressErrorToast: true
        })
        let list = res.data || []
        const profile = this.userProfile || getStoredUserInfo() || {}
        if (!isMerchantDeliveryUser(profile)) {
          list = list.filter(order => order.order_type !== 'supermarket')
        }
        this.allOrders = list
      } catch (e) {
        console.error('加载订单失败', e)
        this.allOrders = []
      }
    },
    
    async loadErrands() {
      if (this.isMerchantDeliveryMode) {
        this.errandOrders = []
        return
      }
      try {
        const res = await getErrandList({ status: 1 }, {
          background: true,
          silent: true,
          suppressAuthToast: true,
          suppressErrorToast: true
        })
        this.errandOrders = res.data || []
      } catch (e) {
        console.error('加载跑腿订单失败', e)
        this.errandOrders = []
      }
    },
    async loadStationMessageSummary(isFirstLoad = false) {
      if (!this.showStationMessageEntry) {
        this.stationMessageUnread = 0
        return
      }
      try {
        const res = await getTownErrandConversations({}, {
          background: true,
          silent: true,
          suppressAuthToast: true,
          suppressErrorToast: true
        })
        const source = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.list)
            ? res.data.list
            : Array.isArray(res?.data?.rows)
              ? res.data.rows
              : Array.isArray(res?.data?.data)
                ? res.data.data
                : Array.isArray(res)
                  ? res
                  : []
        const unreadTotal = source.reduce((sum, item = {}) => {
          const unread = Number(item.unread_count ?? item.unreadCount ?? item.unread_num ?? 0)
          return sum + (unread > 0 ? unread : 0)
        }, 0)
        this.stationMessageUnread = unreadTotal
      } catch (error) {
        console.error('加载站长消息未读数失败', error)
      }
    },
    async loadMerchantAuditSummary() {
      if (!this.showMerchantAuditEntry) {
        this.merchantAuditPending = 0
        return
      }
      try {
        const res = await getTownMerchantApplications({
          status: 'pending',
          page: 1,
          page_size: 1
        }, {
          background: true,
          silent: true,
          suppressAuthToast: true,
          suppressErrorToast: true
        })
        const payload = res?.data ?? res ?? {}
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.list)
            ? payload.list
            : Array.isArray(payload?.rows)
              ? payload.rows
              : Array.isArray(payload?.data)
                ? payload.data
                : []
        const total = Number(
          payload?.summary?.pending_count
          ?? payload?.stats?.pending_count
          ?? payload?.pending_count
          ?? payload?.total
          ?? payload?.meta?.total
          ?? payload?.pagination?.total
          ?? list.length
        )
        this.merchantAuditPending = Number.isFinite(total) ? total : list.length
      } catch (error) {
        console.error('加载商家入驻待审核数失败', error)
        this.merchantAuditPending = 0
      }
    },
    async loadRiderAuditSummary() {
      if (!this.showRiderAuditEntry) {
        this.riderAuditPending = 0
        return
      }
      try {
        const res = await getTownRiderApplications({
          status: 'pending',
          page: 1,
          page_size: 1
        }, {
          background: true,
          silent: true,
          suppressAuthToast: true,
          suppressErrorToast: true
        })
        const payload = res?.data ?? res ?? {}
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.list)
            ? payload.list
            : Array.isArray(payload?.rows)
              ? payload.rows
              : Array.isArray(payload?.data)
                ? payload.data
                : []
        const total = Number(
          payload?.summary?.pending_count
          ?? payload?.stats?.pending_count
          ?? payload?.pending_count
          ?? payload?.total
          ?? payload?.meta?.total
          ?? payload?.pagination?.total
          ?? list.length
        )
        this.riderAuditPending = Number.isFinite(total) ? total : list.length
      } catch (error) {
        console.error('加载骑手待审核数失败', error)
        this.riderAuditPending = 0
      }
    },
    async loadTodaySummary() {
      try {
        const res = await getRiderTodaySummary({}, {
          background: true,
          silent: true,
          suppressAuthToast: true,
          suppressErrorToast: true
        })
        const summary = res?.data || {}
        this.stats.todayDone = Number(
          summary.today_completed_orders
          ?? summary.todayDone
          ?? summary.completed_orders
          ?? 0
        )
        this.stats.delivering = Number(
          summary.today_delivering_orders
          ?? summary.todayDeliveringOrders
          ?? summary.delivering_orders
          ?? 0
        )
        this.stats.todayEarning = (parseFloat(
          summary.today_rider_income
          ?? summary.today_settled_income
          ?? summary.todayIncome
          ?? 0
        ) || 0).toFixed(2)
      } catch (error) {
        console.error('加载今日订单统计失败', error)
        this.stats.todayDone = 0
        this.stats.delivering = 0
        this.stats.todayEarning = '0.00'
      }
    },
    
    calculateQueueStats() {
      this.stats.pending = this.pendingOrders.length
      this.stats.errandPending = this.errandOrders.length
    },
    
    async toggleOnline() {
      if (this.isMerchantDeliveryMode) {
        uni.showToast({ title: '自配送员无需切换接单状态', icon: 'none' })
        return
      }
      // 如果是从接单中切换到休息，弹出确认框
      if (this.isOnline) {
        this.showConfirmDialog = true
        this.countdown = 5
        
        // 启动倒计时
        this.countdownTimer = setInterval(() => {
          this.countdown--
          if (this.countdown <= 0) {
            clearInterval(this.countdownTimer)
          }
        }, 1000)
      } else {
        try {
          const newStatus = 1
          await updateRiderStatus(newStatus)
          this.isOnline = true
          setRiderStatus(newStatus)
          uni.showToast({ 
            title: '已开始接单', 
            icon: 'none' 
          })
        } catch (error) {
          console.error('切换接单状态失败', error)
        }
      }
    },
    
    // 确认下班
    async confirmOffWork() {
      if (this.countdown > 0) {
        uni.showToast({
          title: '请等待倒计时结束',
          icon: 'none'
        })
        return
      }
      
      try {
        const newStatus = 0
        await updateRiderStatus(newStatus)
        setRiderStatus(newStatus)
        this.isOnline = false
        this.showConfirmDialog = false
        
        uni.showToast({ 
          title: '已暂停接单', 
          icon: 'none' 
        })
      } catch (error) {
        console.error('切换休息状态失败', error)
      }
    },
    
    // 取消下班
    cancelOffWork() {
      this.showConfirmDialog = false
      clearInterval(this.countdownTimer)
    },
    
    getBriefAddress(order) {
      try {
        const addr = typeof order.delivery_address === 'string' 
          ? JSON.parse(order.delivery_address) 
          : order.delivery_address
        return addr.detail || addr.address || `${addr.district || ''}${addr.street || ''}` || order.address || '未知地址'
      } catch (e) {
        return order.address || '未知地址'
      }
    },
    goOrders() {
      this.navigateOnce('/pages/orders/index')
    },
    
    goErrands() {
      if (this.isMerchantDeliveryMode) {
        return
      }
      this.navigateOnce('/pages/errands/index')
    },
    
    goTodayOrders() {
      this.navigateOnce('/pages/today-orders/index')
    },
    
    goStationMessages() {
      if (!this.showStationMessageEntry) {
        uni.showToast({ title: '仅乡镇站长可进入', icon: 'none' })
        return
      }
      this.navigateOnce('/pages/station-messages/index')
    },
    goMerchantAudit() {
      if (!this.showMerchantAuditEntry) {
        uni.showToast({ title: '仅乡镇站长可进入', icon: 'none' })
        return
      }
      this.navigateOnce('/pages/merchant-audit/index')
    },
    goRiderAudit() {
      if (!this.showRiderAuditEntry) {
        uni.showToast({ title: '仅乡镇站长可进入', icon: 'none' })
        return
      }
      this.navigateOnce('/pages/rider-audit/index')
    },
    
    goOrderDetail(order) {
      const target = order.type === 'errand' ? 'errands' : 'orders'
      this.navigateOnce(`/pages/${target}/detail?id=${encodeURIComponent(order.id)}`)
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 20rpx;
}

.header {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  padding: 40rpx 30rpx 36rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-emoji {
  font-size: 50rpx;
  margin-right: 16rpx;
}

.header-info {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
}

.header-sub {
  font-size: 22rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 6rpx;
}

.status-switch {
  display: flex;
  align-items: center;
  background-color: rgba(255,255,255,0.2);
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
}

.switch-text {
  font-size: 28rpx;
  color: #fff;
  margin-right: 10rpx;
  font-weight: 500;
}

.switch-text.highlight-online {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 10rpx rgba(255, 255, 255, 0.8);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.9;
  }
}

.switch-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background-color: #999;
}

.switch-dot.online {
  background-color: #52c41a;
}

.stats-grid {
  display: flex;
  margin: 20rpx;
  gap: 16rpx;
}

.stat-card {
  flex: 1;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx 16rpx;
  text-align: center;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}

.stat-num {
  font-size: 40rpx;
  font-weight: bold;
  color: #1890ff;
  display: block;
}

.stat-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
  display: block;
}

.menu-section {
  background-color: #fff;
  margin: 0 20rpx 20rpx;
  border-radius: 20rpx;
  padding: 24rpx 20rpx 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.section-title-small {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.menu-grid {
  display: flex;
  gap: 10rpx;
}

.menu-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 16rpx 8rpx;
}

.menu-icon-wrap {
  width: 100rpx;
  height: 100rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08);
}

.menu-icon {
  font-size: 48rpx;
}

.menu-text {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.menu-badge {
  position: absolute;
  top: -6rpx;
  right: 20rpx;
  background-color: #ff3b30;
  color: #fff;
  font-size: 20rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 16rpx;
  padding: 0 8rpx;
}

.section {
  background-color: #fff;
  margin: 0 20rpx 20rpx;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.section-action {
  font-size: 24rpx;
  color: #1890ff;
}

.order-card {
  padding: 20rpx;
  background-color: #FAFAFA;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
  border-left: 6rpx solid #1890ff;
}

.order-tags {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.order-card:last-child {
  margin-bottom: 0;
}

.order-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.order-type {
  font-size: 24rpx;
  color: #fff;
  background: #1890ff;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.order-type.town-type {
  background: #1f6f43;
}

.order-town {
  font-size: 22rpx;
  color: #1f6f43;
  background: rgba(31, 111, 67, 0.12);
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.transfer-tag {
  font-size: 22rpx;
  color: #8a5a00;
  background: #fff3cd;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.order-price {
  font-size: 30rpx;
  color: #FF6B35;
  font-weight: bold;
}

.order-merchant {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.merchant-icon {
  font-size: 24rpx;
  margin-right: 8rpx;
}

.merchant-text {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.order-addr {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10rpx;
}

.addr-icon {
  font-size: 24rpx;
  margin-right: 8rpx;
}

.addr-text {
  font-size: 26rpx;
  color: #333;
  flex: 1;
}

.order-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-time {
  font-size: 22rpx;
  color: #ccc;
}

.order-status {
  font-size: 24rpx;
  color: #1890ff;
  font-weight: 500;
}

.order-status.town-status {
  color: #1f6f43;
}

.take-btn {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  padding: 10rpx 28rpx;
  border-radius: 30rpx;
}

.take-btn-text {
  color: #fff;
  font-size: 24rpx;
  font-weight: bold;
}

.empty-section, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
}

.empty-icon {
  font-size: 80rpx;
}

.empty-text {
  font-size: 30rpx;
  color: #999;
  margin-top: 20rpx;
}

.empty-tip {
  font-size: 24rpx;
  color: #ccc;
  margin-top: 10rpx;
}

/* 自定义确认弹窗样式 */
.confirm-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
}

.dialog-content {
  position: relative;
  background-color: #fff;
  border-radius: 24rpx;
  width: 600rpx;
  padding: 48rpx 40rpx;
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.3);
  animation: dialogFadeIn 0.3s ease;
}

@keyframes dialogFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: 24rpx;
}

.dialog-message {
  font-size: 32rpx;
  color: #666;
  text-align: center;
  margin-bottom: 48rpx;
  line-height: 1.6;
}

.dialog-buttons {
  display: flex;
  gap: 24rpx;
}

.dialog-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 12rpx;
  font-size: 32rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-btn {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  color: #fff;
}

.confirm-btn.disabled {
  background: #cccccc;
  color: #999999;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}
</style>
