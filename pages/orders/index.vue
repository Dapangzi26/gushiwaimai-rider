<template>
  <view class="container">
    <!-- 状态筛选 -->
    <view class="status-tabs">
      <view v-if="simplifiedTabs" class="tabs-scroll town-tabs-row">
        <view 
          v-for="item in statusTabs" 
          :key="item.key"
          class="tab-item town-tab-item"
          :class="{ active: currentStatus === item.key }"
          @click="switchStatus(item.key)"
        >
          {{ item.label }}
        </view>
      </view>
      <scroll-view v-else scroll-x class="tabs-scroll county-tabs-scroll">
        <view 
          v-for="item in statusTabs" 
          :key="item.key"
          class="tab-item"
          :class="{ 'county-tab-item': true, active: currentStatus === item.key }"
          @click="switchStatus(item.key)"
        >
          {{ item.label }}
        </view>
      </scroll-view>
    </view>

    <view v-if="reminderScene === 'pickup_ready'" class="reminder-banner">
      <text class="reminder-banner-text">当前展示待取餐提醒订单</text>
      <text class="reminder-banner-action" @click="clearReminderScene">恢复默认列表</text>
    </view>

    <!-- 订单列表 -->
    <scroll-view 
      scroll-y 
      class="order-scroll"
      @scrolltolower="loadMore"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view v-if="orderList.length" class="order-list">
        <view 
          v-for="order in orderList" 
          :key="order.id"
          class="order-card"
          :class="{ 'highlight-card': order.__view.highlightCard, 'town-order-card': order.__view.isTownOrder, 'transfer-order-card': order.__view.isTransferOrder }"
          @click="goDetail(order)"
        >
          <!-- 订单头部 -->
          <view class="order-header">
            <view class="header-left">
              <view class="order-info-row">
                <text class="order-no">{{ order.order_no }}</text>
                <view class="header-tags">
                  <view v-if="order.__view.isTownOrder" class="scope-tag">乡镇订单</view>
                  <view v-if="order.__view.isTransferOrder" class="transfer-tag">{{ order.__view.transferTag }}</view>
                  <view class="status-tag" :style="{ backgroundColor: order.__view.statusColor }">
                    {{ order.__view.statusText }}
                  </view>
                </view>
              </view>
              <text class="order-time">{{ formatTime(order.created_at) }}</text>
            </view>
          </view>

          <!-- 配送费（突出显示） -->
          <view class="delivery-fee-section">
            <text class="fee-label">💰 配送费</text>
            <text class="fee-num">¥{{ order.rider_fee || 0 }}</text>
          </view>

          <!-- 商家信息 -->
          <view class="simple-info">
            <text class="info-icon">🏪</text>
            <text class="info-text order-main-text">{{ order.merchant?.name || '未知商家' }}</text>
            <text class="call-btn" @click.stop="callMerchant(order.merchant?.phone)">📞 打电话</text>
          </view>

          <!-- 配送地址（简化） -->
          <view v-if="order.__view.briefAddress" class="simple-info">
            <text class="info-icon">📍</text>
            <text class="info-text address-text order-main-text">{{ order.__view.briefAddress }}</text>
          </view>

          <view class="simple-info" v-if="order.__view.townName">
            <text class="info-icon">🌲</text>
            <text class="info-text order-main-text">{{ order.__view.townName }}</text>
          </view>

          <view v-if="order.__view.isTransferOrder" class="simple-info transfer-info">
            <text class="info-icon">🔁</text>
            <text class="info-text">{{ order.__view.transferCardSummary }}</text>
          </view>

          <!-- 操作按钮 -->
          <view class="order-actions">
            <button
              v-if="order.__view.canAcceptTownOrder"
              class="btn btn-primary"
              :disabled="acceptingOrderId === String(order.id)"
              @click.stop="handleAcceptOrder(order)"
            >
              {{ acceptingOrderId === String(order.id) ? '接单中...' : '接单' }}
            </button>
            <button
              v-if="order.__view.canStartMerchantSelfDelivery"
              class="btn btn-primary"
              @click.stop="handleMerchantSelfDeliveryStart(order)"
            >
              开始配送
            </button>
            <!-- 订单列表页现在只负责“看有哪些单、先点进详情或地图再操作”。 -->
            <!-- 确认送达已经统一收口到详情页和地图总览页，这里不再放列表级送达按钮，避免同一张卡片出现重复送达入口。 -->
            <button 
              class="btn btn-default"
              @click.stop="goDetail(order)"
            >
              查看详情
            </button>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无订单</text>
        <text class="empty-tip">
          {{ getEmptyTip() }}
        </text>
      </view>

      <!-- 加载更多 -->
      <view v-if="loadingMore" class="load-more">
        <text>加载中...</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import {
  getRiderOrders,
  acceptTakeoutOrder as acceptTakeoutOrderApi,
  riderPickup as riderPickupApi,
  confirmDelivery as confirmDeliveryApi,
  confirmDeliverySpecial as confirmDeliverySpecialApi,
  startMerchantSelfDelivery as startMerchantSelfDeliveryApi,
  confirmMerchantSelfDelivery as confirmMerchantSelfDeliveryApi
} from '@/api/order.js'
import {
  ORDER_STATUS,
  canRiderCallConfirmDeliveryApi,
  canRiderOfferSpecialComplete
} from '@/config/index.js'
import { REMINDER_CENTER_EVENTS } from '@/utils/reminder-center.js'
import { isRiderAppUser } from '@/utils/rider-auth.js'
import {
  canCompleteSelfDelivery,
  canStartSelfDelivery,
  getOrderStatusText,
  hasOrderOwnership as hasDeliveryOrderOwnership
} from '@/utils/delivery-order.js'
import { resolveDeliveryProfile } from '@/utils/delivery-identity.js'
import { formatTime } from '@/utils/index.js'
import { getUserInfo as getStoredUserInfo } from '@/utils/storage.js'

export default {
  data() {
    return {
      hasPageAccess: false,
      currentStatus: '',
      statusTabs: [],
      orderList: [],
      reminderScene: '',
      reminderOrderId: '',
      page: 1,
      pageSize: 10,
      refreshing: false,
      loadingMore: false,
      acceptingOrderId: '',
      reminderEventHandler: null,
      orderRefreshHandler: null,
      orderRefreshTimer: null,
      orderListRequestPromise: null,
      orderListRequestKey: '',
      lastOrderListLoadedAt: 0,
      deliveryProfileSnapshot: null,
      navigatingOrderId: '',
      switchingStatus: false
    }
  },
  computed: {
    deliveryProfile() {
      return this.deliveryProfileSnapshot || resolveDeliveryProfile(getStoredUserInfo() || {})
    },
    simplifiedTabs() {
      return this.deliveryProfile.useSimplifiedTabs
    }
  },
  onLoad(options) {
    this.hasPageAccess = this.ensurePageAccess()
    if (!this.hasPageAccess) {
      return
    }
    this.applyReminderRouteOptions(options)
    this.bindReminderEvents()
    this.resetStatusTabs()
    this.loadOrderList()
  },
  onShow() {
    this.hasPageAccess = this.ensurePageAccess()
    if (!this.hasPageAccess) {
      return
    }
    this.resetStatusTabs()
    this.loadOrderList()
  },
  onUnload() {
    this.unbindReminderEvents()
    if (this.orderRefreshTimer) {
      clearTimeout(this.orderRefreshTimer)
      this.orderRefreshTimer = null
    }
    this.orderListRequestPromise = null
  },
  async onPullDownRefresh() {
    // 这里是“页面原生下拉刷新”的收口点。
    // pages.json(页面配置) 已经开了 enablePullDownRefresh(允许下拉刷新)，
    // 如果这里只触发加载、不主动 stopPullDownRefresh()，顶部转圈就会一直挂着不结束。
    try {
      this.page = 1
      await this.loadOrderList({ force: true })
    } finally {
      uni.stopPullDownRefresh()
    }
  },
  methods: {
    applyReminderRouteOptions(options = {}) {
      this.reminderScene = String(options.scene || '').trim()
      this.reminderOrderId = String(options.orderId || '').trim()
      // 地图总览页现在会按“总作业页”口径退出到订单列表，
      // 并把目标标签页通过路由参数带回来。
      // 这里先记下来，等状态标签初始化完以后，再校验这个值是否真的是当前账号可用的“配送中”标签。
      this.currentStatus = String(options.status || this.currentStatus || '').trim()
    },
    bindReminderEvents() {
      if (!this.reminderEventHandler) {
        this.reminderEventHandler = (payload = {}) => {
          if (payload.type === 'pickup_ready' && payload.orderId) {
            this.reminderScene = 'pickup_ready'
            this.reminderOrderId = String(payload.orderId)
          }
        }
      }
      if (!this.orderRefreshHandler) {
        this.orderRefreshHandler = (payload = {}) => {
          if (this.orderRefreshTimer) {
            clearTimeout(this.orderRefreshTimer)
          }
          this.orderRefreshTimer = setTimeout(() => {
            this.loadOrderList()
          }, 300)
        }
      }
      uni.$off(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler)
      uni.$off(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler)
      uni.$on(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler)
      uni.$on(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler)
    },
    unbindReminderEvents() {
      if (this.reminderEventHandler) {
        uni.$off(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler)
      }
      if (this.orderRefreshHandler) {
        uni.$off(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler)
      }
    },
    formatTime,
    canRiderCallConfirmDeliveryApi,
    canRiderOfferSpecialComplete,
    ensurePageAccess() {
      const user = getStoredUserInfo() || {}
      if (isRiderAppUser(user)) {
        return true
      }
      uni.showToast({ title: '请先使用骑手账号登录', icon: 'none' })
      uni.reLaunch({ url: '/pages/login/index' })
      return false
    },
    isTownStationmasterUser() {
      return this.getDeliveryProfile().isTownScope || this.getDeliveryProfile().isTownStationmaster
    },
    isMerchantDeliveryMode() {
      return this.getDeliveryProfile().isMerchantSelfDelivery
    },
    isActualTownStationmaster() {
      return this.getDeliveryProfile().isTownStationmaster
    },
    useSimplifiedTabs() {
      return this.getDeliveryProfile().useSimplifiedTabs
    },
    getDeliveryProfile() {
      if (!this.deliveryProfileSnapshot) {
        this.deliveryProfileSnapshot = resolveDeliveryProfile(getStoredUserInfo() || {})
      }
      return this.deliveryProfileSnapshot
    },
    refreshDeliveryProfile() {
      this.deliveryProfileSnapshot = resolveDeliveryProfile(getStoredUserInfo() || {})
      return this.deliveryProfileSnapshot
    },
    buildStatusTabs() {
      if (this.isMerchantDeliveryMode()) {
        return [
          { key: 'merchant_delivery_pending', label: '待配送', count: 0 },
          { key: 'merchant_delivery_delivering', label: '配送中', count: 0 },
          { key: '6', label: '已完成', count: 0 }
        ]
      }
      if (this.isTownStationmasterUser()) {
        // 乡镇站长这里现在拆成 4 个分组：
        // 1. 原生乡镇待接单
        // 2. 原生乡镇配送中
        // 3. 县城转入乡镇的独立转入池
        // 4. 已完成
        // 这样县城转入单就不会再混进乡镇原生池里串台。
        return [
          { key: 'town_pending', label: '未接单', count: 0 },
          { key: 'town_delivering', label: '配送中', count: 0 },
          { key: 'transfer', label: '转入单', count: 0 },
          { key: '6', label: '已完成', count: 0 }
        ]
      }
      if (this.useSimplifiedTabs()) {
        return [
          { key: 'county_pending', label: '未接单', count: 0 },
          { key: 'county_delivering', label: '配送中', count: 0 },
          { key: '6', label: '已完成', count: 0 }
        ]
      }
      return [
        { key: '', label: '全部', count: 0 },
        { key: '1', label: '待处理', count: 0 },
        { key: '2', label: '已接单', count: 0 },
        { key: '3', label: '备货中', count: 0 },
        { key: '4', label: '备货完成', count: 0 },
        { key: '5', label: '配送中', count: 0 },
        { key: '6', label: '已完成', count: 0 },
        { key: 'transfer', label: '转派单', count: 0 }
      ]
    },
    getDefaultCurrentStatus() {
      if (this.isMerchantDeliveryMode()) {
        return 'merchant_delivery_pending'
      }
      if (this.isTownStationmasterUser()) {
        return 'town_pending'
      }
      if (this.useSimplifiedTabs()) {
        return 'county_pending'
      }
      return ''
    },
    resetStatusTabs() {
      this.refreshDeliveryProfile()
      this.statusTabs = this.buildStatusTabs()
      const validKeys = this.statusTabs.map(tab => tab.key)
      // 如果是别的页面显式带着 status 进来，并且这个状态在当前账号口径下是合法的，
      // 就优先落到指定标签。这样地图总览页返回时，能稳定回到“配送中”而不是默认第一页。
      if (this.currentStatus && validKeys.includes(this.currentStatus)) {
        return
      }
      if (!validKeys.includes(this.currentStatus)) {
        this.currentStatus = this.getDefaultCurrentStatus()
      }
    },
    decorateOrderForCard(order = {}) {
      const isTownOrder = this.isTownOrder(order)
      const isTransferOrder = this.isTransferOrder(order)
      return {
        ...order,
        __view: {
          highlightCard: Number(order.status) === 1 || Number(order.status) === 4,
          isTownOrder,
          isTransferOrder,
          transferTag: this.getTransferTag(order),
          statusText: this.getStatusText(order),
          statusColor: this.getStatusColor(order.status, order),
          briefAddress: this.getBriefAddress(order),
          townName: this.getTownName(order),
          transferCardSummary: isTransferOrder ? this.getTransferCardSummary(order) : '',
          canAcceptTownOrder: this.canAcceptTownOrder(order),
          canStartMerchantSelfDelivery: this.canStartMerchantSelfDelivery(order)
        }
      }
    },

    getStatusText(orderOrStatus) {
      const status = typeof orderOrStatus === 'object' && orderOrStatus !== null
        ? orderOrStatus.status
        : orderOrStatus
      const order = typeof orderOrStatus === 'object' && orderOrStatus !== null
        ? orderOrStatus
        : {}
      return getOrderStatusText(status, {
        profile: this.getDeliveryProfile(),
        order
      })
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
      const directTargetTownName = this.safeText(order.target_town_name)
      if (directTargetTownName) {
        return directTargetTownName
      }
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
    getTransferChainSummaryText(order = {}) {
      const summary = order.transfer_chain_summary
      if (summary && typeof summary === 'object') {
        return this.safeText(
          summary.summary
          || summary.text
          || summary.label
          || summary.description
        )
      }
      return this.safeText(summary)
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
    getTransferCardSummary(order = {}) {
      const transferStageText = this.safeText(order.transfer_stage_text)
      if (this.safeText(order.transfer_status) === 'assigned_to_town_rider') {
        const targetUser = order.transfer_to_user
        const targetName = targetUser && typeof targetUser === 'object'
          ? this.safeText(targetUser.nickname || targetUser.username || targetUser.name)
          : ''
        return targetName ? `已转给：${targetName}` : '已转给骑手'
      }
      const pieces = [transferStageText || `来源：${this.getTransferFromUserName(order)}`]
      if (!transferStageText) {
        pieces[0] = `来源：${this.getTransferFromUserName(order)}`
      } else {
        pieces.push(`来源：${this.getTransferFromUserName(order)}`)
      }
      const targetTown = this.getTransferToTownName(order)
      if (targetTown) {
        pieces.push(`目标乡镇：${targetTown}`)
      }
      return pieces.join(' · ')
    },
    isCountyTransferPoolOrder(order = {}) {
      const poolKey = this.safeText(order.transfer_pool_key)
      if (poolKey.startsWith('county_to_town_')) {
        return true
      }
      return this.isTransferOrder(order)
        && this.safeText(order.origin_delivery_domain) === 'county_dispatch'
        && this.safeText(order.current_delivery_domain) === 'county_to_town_transfer'
    },
    isStationmasterTransferTabOrder(order = {}) {
      if (!this.isCountyTransferPoolOrder(order)) {
        return false
      }
      return Number(order.status) !== 6
    },
    
    getStatusColor(status, order = {}) {
      if (this.isTownOrder(order)) {
        const townStatusColors = {
          4: '#1f6f43',
          5: '#2b8a57',
          6: '#2b8a57'
        }
        return townStatusColors[Number(status)] || ORDER_STATUS[status]?.color || '#999'
      }
      return ORDER_STATUS[status]?.color || '#999'
    },
    isTownOrder(order = {}) {
      return order.order_type === 'town' || order.delivery_scope === 'town_delivery' || !!this.getTownName(order)
    },
    getTownName(order = {}) {
      return order.customer_town || order.town_name || order.rider_town || this.getTransferToTownName(order) || ''
    },
    getCoordinateByKeys(source = {}, keys = []) {
      for (let i = 0; i < keys.length; i++) {
        const value = source[keys[i]]
        if (value !== undefined && value !== null && value !== '') {
          return value
        }
      }
      return ''
    },
    normalizeIdentityValue(value) {
      if (value === undefined || value === null || value === '') {
        return ''
      }
      return String(value)
    },
    getCurrentRiderId() {
      const user = getStoredUserInfo() || {}
      return this.normalizeIdentityValue(this.getCoordinateByKeys(user, ['id', 'user_id', 'userId']))
    },
    getOrderOwnerId(order = {}) {
      return this.normalizeIdentityValue(this.getCoordinateByKeys(order, ['rider_id', 'riderId']))
    },
    getOrderResponsibleId(order = {}) {
      return this.normalizeIdentityValue(this.getCoordinateByKeys(order, [
        'current_responsible_user_id',
        'currentResponsibleUserId',
        'rider_id',
        'riderId'
      ]))
    },
    hasOrderOwnership(order = {}) {
      return hasDeliveryOrderOwnership(order, getStoredUserInfo() || {})
    },
    isTownPoolOrder(order = {}) {
      if (!this.isTownOrder(order)) {
        return false
      }
      const status = Number(order.status)
      // 乡镇未接单栏现在统一承接“商家已接单后的待接手订单”：
      // - 2: 备货中
      // - 3: 出餐完成
      // - 4: 兼容历史残留状态
      // 只要还没被具体骑手接走，就继续留在未接单，不要提前跑到配送中。
      if (![2, 3, 4].includes(status)) {
        return false
      }
      return !this.getOrderResponsibleId(order)
    },
    isAcceptedTownOrderForCurrentUser(order = {}) {
      const currentRiderId = this.getCurrentRiderId()
      const responsibleId = this.getOrderResponsibleId(order)
      return !!currentRiderId && !!responsibleId && currentRiderId === responsibleId
    },
    canAcceptTownOrder(order = {}) {
      return this.isTownStationmasterUser() && this.isTownPoolOrder(order)
    },
    getMerchantCoords(order = {}) {
      const merchant = order.merchant || {}
      return {
        lng: this.getCoordinateByKeys(order, ['merchant_lng', 'merchantLng']) || this.getCoordinateByKeys(merchant, ['longitude', 'lng']),
        lat: this.getCoordinateByKeys(order, ['merchant_lat', 'merchantLat']) || this.getCoordinateByKeys(merchant, ['latitude', 'lat'])
      }
    },
    getCustomerCoords(order = {}) {
      return {
        lng: this.getCoordinateByKeys(order, ['customer_lng', 'delivery_longitude', 'longitude', 'lng']),
        lat: this.getCoordinateByKeys(order, ['customer_lat', 'delivery_latitude', 'latitude', 'lat'])
      }
    },
    formatCoordinate(coords = {}) {
      if (coords.lng === '' || coords.lat === '') {
        return '未提供坐标'
      }
      return `${coords.lng}, ${coords.lat}`
    },
    canPickup(status) {
      return Number(status) === 4
    },
    isTownPendingTabOrder(order = {}) {
      if (this.isCountyTransferPoolOrder(order)) {
        return false
      }
      return this.isTownPoolOrder(order)
    },
    isTownDeliveringTabOrder(order = {}) {
      if (this.isCountyTransferPoolOrder(order)) {
        return false
      }
      const status = Number(order.status)
      // 乡镇配送中现在只认真正已经开始派送的单。
      // 前面的备货中/出餐完成都应该留在未接单栏，只有骑手点击接单后进入 status=5 才进配送中。
      if (status !== 5) {
        return false
      }
      if (this.isActualTownStationmaster()) {
        return !this.isTownPoolOrder(order)
      }
      return this.isAcceptedTownOrderForCurrentUser(order)
    },
    isCountyPendingTabOrder(order = {}) {
      return Number(order.status) === 1
    },
    isCountyDeliveringTabOrder(order = {}) {
      return [2, 3, 4, 5].includes(Number(order.status))
    },
    filterTownStationmasterOrders(list = []) {
      if (this.reminderScene === 'pickup_ready') {
        return list.filter(order => Number(order.status) === 4)
      }
      switch (this.currentStatus) {
        case 'town_pending':
          return list.filter(order => this.isTownPendingTabOrder(order))
        case 'town_delivering':
          return list.filter(order => this.isTownDeliveringTabOrder(order))
        case 'transfer':
          return list.filter(order => this.isStationmasterTransferTabOrder(order))
        case '6':
          return list.filter(order => Number(order.status) === 6)
        default:
          return list
      }
    },
    filterCountyOrders(list = []) {
      if (this.reminderScene === 'pickup_ready') {
        return list.filter(order => Number(order.status) === 4)
      }
      switch (this.currentStatus) {
        case 'county_pending':
          return list.filter(order => this.isCountyPendingTabOrder(order))
        case 'county_delivering':
          return list.filter(order => this.isCountyDeliveringTabOrder(order))
        case '6':
          return list.filter(order => Number(order.status) === 6)
        default:
          return list
      }
    },
    canOperateOrder(order = {}) {
      return this.hasOrderOwnership(order)
    },
    canStartMerchantSelfDelivery(order = {}) {
      return canStartSelfDelivery(order, this.getDeliveryProfile(), this.hasOrderOwnership(order))
    },
    canConfirmMerchantSelfDelivery(order = {}) {
      return canCompleteSelfDelivery(order, this.getDeliveryProfile(), this.hasOrderOwnership(order))
    },
    
    getFullAddress(order) {
      try {
        const addr = typeof order.delivery_address === 'string' 
          ? JSON.parse(order.delivery_address) 
          : order.delivery_address
        return addr.province + addr.city + addr.district + addr.street + addr.detail
      } catch (e) {
        return '未知地址'
      }
    },
    
    getBriefAddress(order) {
      try {
        const addr = typeof order.delivery_address === 'string' 
          ? JSON.parse(order.delivery_address) 
          : order.delivery_address
        return this.safeText(
          addr?.detail
          || addr?.address
          || `${addr?.district || ''}${addr?.street || ''}`
          || order.address
        )
      } catch (e) {
        return this.safeText(order.address)
      }
    },
    
    async switchStatus(status) {
      if (this.switchingStatus || (this.currentStatus === status && !this.reminderScene)) {
        return
      }
      this.switchingStatus = true
      this.currentStatus = status
      this.clearReminderScene()
      this.page = 1
      try {
        await this.loadOrderList({ force: true })
      } catch (error) {
        console.error('切换订单状态失败', error)
      } finally {
        this.switchingStatus = false
      }
    },
    clearReminderScene() {
      this.reminderScene = ''
      this.reminderOrderId = ''
    },
    
    buildOrderListRequestKey(params = {}) {
      // 这个 key 专门用来识别“当前页面想拿的是不是同一份列表数据”。
      // 这样 onLoad/onShow 连着触发，或者全局刷新事件和页面初始化撞在一起时，
      // 就不会把同一批订单重复请求两三遍。
      return JSON.stringify({
        status: this.currentStatus,
        reminderScene: this.reminderScene,
        reminderOrderId: this.reminderOrderId,
        params
      })
    },

    async loadOrderList({ force = false } = {}) {
      if (!this.hasPageAccess) {
        return
      }
      this.refreshDeliveryProfile()
      const params = {}
      if (!this.isTownStationmasterUser() && !this.useSimplifiedTabs() && this.currentStatus !== '' && this.currentStatus !== 'transfer') {
        params.status = this.currentStatus
      }

      const requestKey = this.buildOrderListRequestKey(params)
      const now = Date.now()

      // 这里先挡掉“同一个页面刚进来就连续请求同一份列表”的情况。
      // uni-app 页面常见现象是 onLoad 和 onShow 紧挨着触发，如果都直连接口，
      // 高峰期一个骑手点进配送页就可能白白打两次同一个热接口。
      if (!force && this.orderListRequestPromise && this.orderListRequestKey === requestKey) {
        return this.orderListRequestPromise
      }

      // 这里再补一层短时间缓存，专门收掉刚加载成功后 1 秒内的重复刷新。
      // 这样既能减掉初始化抖动，又不会影响骑手手动刷新和切 tab 后要马上看最新数据。
      if (!force && this.orderListRequestKey === requestKey && now - this.lastOrderListLoadedAt < 1000) {
        return this.orderList
      }

      const requestPromise = (async () => {
        try {
          const res = await getRiderOrders(params)
          let list = Array.isArray(res?.data) ? res.data : []
          if (!this.isMerchantDeliveryMode()) {
            list = list.filter(order => order.order_type !== 'supermarket')
          }
          if (this.reminderOrderId) {
            list = list.slice().sort((left, right) => {
              const leftScore = String(left.id) === this.reminderOrderId ? 1 : 0
              const rightScore = String(right.id) === this.reminderOrderId ? 1 : 0
              return rightScore - leftScore
            })
          }

          this.updateStatusCounts(list)
          let visibleList = []
          if (this.isMerchantDeliveryMode()) {
            visibleList = this.filterMerchantDeliveryOrders(list)
          } else if (this.isTownStationmasterUser()) {
            visibleList = this.filterTownStationmasterOrders(list)
          } else if (this.useSimplifiedTabs()) {
            visibleList = this.filterCountyOrders(list)
          } else {
            visibleList = this.currentStatus === 'transfer'
              ? list.filter(order => this.isTransferOrder(order))
              : list
          }
          this.orderList = visibleList.map(order => this.decorateOrderForCard(order))

          this.lastOrderListLoadedAt = Date.now()
          return this.orderList
        } catch (e) {
          console.error('加载订单失败', e)
          this.orderList = []
          throw e
        } finally {
          if (this.orderListRequestPromise === requestPromise) {
            this.orderListRequestPromise = null
          }
        }
      })()

      this.orderListRequestKey = requestKey
      this.orderListRequestPromise = requestPromise
      return requestPromise
    },
    
    updateStatusCounts(sourceList = []) {
      if (this.isMerchantDeliveryMode()) {
        const pendingCount = sourceList.filter(order => Number(order.status) === 3).length
        const deliveringCount = sourceList.filter(order => Number(order.status) === 5).length
        const completedCount = sourceList.filter(order => Number(order.status) === 6).length
        this.statusTabs = this.buildStatusTabs().map(tab => ({
          ...tab,
          count: tab.key === 'merchant_delivery_pending'
            ? pendingCount
            : (tab.key === 'merchant_delivery_delivering' ? deliveringCount : completedCount)
        }))
        return
      }
      if (this.isTownStationmasterUser()) {
        const pendingCount = sourceList.filter(order => this.isTownPendingTabOrder(order)).length
        const deliveringCount = sourceList.filter(order => this.isTownDeliveringTabOrder(order)).length
        const transferCount = sourceList.filter(order => this.isStationmasterTransferTabOrder(order)).length
        const completedCount = sourceList.filter(order => Number(order.status) === 6).length
        this.statusTabs = this.buildStatusTabs().map(tab => ({
          ...tab,
          count: tab.key === 'town_pending'
            ? pendingCount
            : (tab.key === 'town_delivering'
              ? deliveringCount
              : (tab.key === 'transfer' ? transferCount : completedCount))
        }))
        return
      }
      if (this.useSimplifiedTabs()) {
        const pendingCount = sourceList.filter(order => this.isCountyPendingTabOrder(order)).length
        const deliveringCount = sourceList.filter(order => this.isCountyDeliveringTabOrder(order)).length
        const completedCount = sourceList.filter(order => Number(order.status) === 6).length
        this.statusTabs = this.buildStatusTabs().map(tab => ({
          ...tab,
          count: tab.key === 'county_pending'
            ? pendingCount
            : (tab.key === 'county_delivering' ? deliveringCount : completedCount)
        }))
        return
      }

      const counter = {}
      sourceList.forEach(order => {
        counter[order.status] = (counter[order.status] || 0) + 1
      })
      const transferCount = sourceList.filter(order => this.isTransferOrder(order)).length
      
      this.statusTabs = this.buildStatusTabs().map(tab => ({
        ...tab,
        count: tab.key === ''
          ? sourceList.length
          : (tab.key === 'transfer' ? transferCount : (counter[tab.key] || 0))
      }))
    },
    getEmptyTip() {
      if (this.reminderScene === 'pickup_ready') {
        return '当前没有待取餐订单'
      }
      if (this.isMerchantDeliveryMode()) {
        if (this.currentStatus === 'merchant_delivery_pending') {
          return '当前暂无待配送的本店订单'
        }
        if (this.currentStatus === 'merchant_delivery_delivering') {
          return '当前暂无配送中的本店订单'
        }
        return '当前暂无已完成的本店订单'
      }
      if (this.isTownStationmasterUser()) {
        if (this.currentStatus === 'town_pending') {
          return '当前暂无可接单的乡镇订单'
        }
        if (this.currentStatus === 'town_delivering') {
          return '当前暂无配送中的乡镇订单'
        }
        if (this.currentStatus === 'transfer') {
          return '当前暂无县城转入的乡镇订单'
        }
        return '当前暂无已完成的乡镇订单'
      }
      if (this.useSimplifiedTabs()) {
        if (this.currentStatus === 'county_pending') {
          return '当前暂无待接单的县城订单'
        }
        if (this.currentStatus === 'county_delivering') {
          return '当前暂无配送中的县城订单'
        }
        return '当前暂无已完成的县城订单'
      }
      return this.currentStatus === ''
        ? '当前没有分配到你的配送订单'
        : (this.currentStatus === 'transfer' ? '暂无转派单' : '该状态下暂无订单')
    },
    
    async onRefresh() {
      // 这里收的是 scroll-view(滚动容器) 自己那套下拉刷新状态。
      // 它和页面原生下拉刷新不是同一个开关，所以要分别关闭，避免一边停了另一边还在转。
      // 下拉刷新是骑手主动要求“立刻拿最新数据”，这里不能继续复用旧请求。
      // 否则如果页面刚好还有一个列表请求在路上，手动下拉只会傻等那个旧请求结束，
      // 用户体感上就会像“明明已经下拉了，却还要卡十几二十秒才刷新出来”。
      this.refreshing = true
      try {
        this.page = 1
        await this.loadOrderList({ force: true })
      } finally {
        this.refreshing = false
      }
    },
    
    loadMore() {
      if (this.loadingMore) return
      this.loadingMore = true
      this.page++
      // TODO: 实现分页加载
      this.loadingMore = false
    },
    filterMerchantDeliveryOrders(list = []) {
      switch (this.currentStatus) {
        case 'merchant_delivery_pending':
          return list.filter(order => Number(order.status) === 3)
        case 'merchant_delivery_delivering':
          return list.filter(order => Number(order.status) === 5)
        case '6':
          return list.filter(order => Number(order.status) === 6)
        default:
          return list
      }
    },
    handlePickup(order) {
      uni.showModal({
        title: '确认取餐',
        content: '确认已到店取餐并开始配送？',
        confirmText: '开始配送',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          const fresh = this.orderList.find((o) => o.id === order.id) || order
          if (!this.canPickup(fresh.status)) {
            uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
            return
          }
          try {
            await riderPickupApi(fresh.id)
            uni.showToast({ title: '已开始配送', icon: 'success' })
            await this.loadOrderList()
          } catch (e) {
            console.error('取餐失败', e)
          }
        }
      })
    },
    handleAcceptOrder(order) {
      if (!this.canAcceptTownOrder(order)) {
        uni.showToast({ title: '当前订单不能接单', icon: 'none' })
        return
      }
      uni.showModal({
        title: '确认接单',
        content: '确认接此订单？若其他骑手先提交成功，则该订单会被对方抢到。',
        confirmText: '立即接单',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          this.acceptingOrderId = String(order.id)
          try {
            await acceptTakeoutOrderApi(order.id)
            uni.showToast({ title: '接单成功', icon: 'success' })
            await this.loadOrderList()
          } catch (e) {
            console.error('接单失败', e)
          } finally {
            this.acceptingOrderId = ''
          }
        }
      })
    },
    
    handleStandardDelivery(order) {
      uni.showModal({
        title: '确认送达',
        content: '确认订单已送达？',
        confirmText: '确认送达',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          const fresh = this.orderList.find((o) => o.id === order.id) || order
          if (!canRiderCallConfirmDeliveryApi(fresh.status)) {
            uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
            return
          }
          try {
            await confirmDeliveryApi(fresh.id)
            uni.showToast({ title: '送达成功', icon: 'success' })
            await this.loadOrderList()
          } catch (e) {
            console.error('确认送达失败', e)
            uni.showToast({
              title: e?.message || e?.data?.message || e?.response?.data?.message || '确认送达失败',
              icon: 'none'
            })
          }
        }
      })
    },
    handleMerchantSelfDeliveryStart(order) {
      if (!this.canStartMerchantSelfDelivery(order)) {
        uni.showToast({ title: '当前订单不能开始配送', icon: 'none' })
        return
      }
      uni.showModal({
        title: '开始配送',
        content: '确认由当前自配送员开始配送该订单？',
        confirmText: '开始配送',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await startMerchantSelfDeliveryApi(order.id)
            uni.showToast({ title: '已开始配送', icon: 'success' })
            await this.loadOrderList()
          } catch (e) {
            console.error('自配送开始失败', e)
            uni.showToast({
              title: e?.message || e?.data?.message || e?.response?.data?.message || '开始配送失败',
              icon: 'none'
            })
          }
        }
      })
    },
    handleMerchantSelfDeliveryConfirm(order) {
      if (!this.canConfirmMerchantSelfDelivery(order)) {
        uni.showToast({ title: '当前订单不能确认送达', icon: 'none' })
        return
      }
      uni.showModal({
        title: '确认送达',
        content: '确认该自配送订单已送达？',
        confirmText: '确认送达',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await confirmMerchantSelfDeliveryApi(order.id)
            uni.showToast({ title: '送达成功', icon: 'success' })
            await this.loadOrderList()
          } catch (e) {
            console.error('自配送确认送达失败', e)
            uni.showToast({
              title: e?.message || e?.data?.message || e?.response?.data?.message || '确认送达失败',
              icon: 'none'
            })
          }
        }
      })
    },
    handleSpecialComplete(order) {
      uni.showModal({
        title: '特殊完结',
        content: '确认按「特殊完结」处理该订单？',
        confirmText: '特殊完结',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          const fresh = this.orderList.find((o) => o.id === order.id) || order
          if (!canRiderOfferSpecialComplete(fresh.status)) {
            uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
            return
          }
          try {
            await confirmDeliverySpecialApi(fresh.id)
            uni.showToast({ title: '操作成功', icon: 'success' })
            await this.loadOrderList()
          } catch (e) {
            console.error('特殊完结失败', e)
          }
        }
      })
    },
    
    callMerchant(phone) {
      if (phone) {
        uni.makePhoneCall({ phoneNumber: phone })
      }
    },
    
    goDetail(order) {
      const orderId = String(order?.id || '')
      if (!orderId || this.navigatingOrderId === orderId) {
        return
      }
      this.navigatingOrderId = orderId
      uni.navigateTo({ 
        url: `/pages/orders/detail?id=${encodeURIComponent(orderId)}`,
        complete: () => {
          setTimeout(() => {
            this.navigatingOrderId = ''
          }, 500)
        }
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.status-tabs {
  background-color: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.tabs-scroll {
  white-space: nowrap;
  padding: 0 20rpx;
}

.county-tabs-scroll {
  padding: 0 16rpx;
}

.town-tabs-row {
  display: flex;
  padding: 0;
  background-color: #fff;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  padding: 24rpx 20rpx;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.tab-item.county-tab-item {
  padding: 28rpx 22rpx 24rpx;
  font-size: 31rpx;
  font-weight: 600;
  color: #555;
}

.tab-item.town-tab-item {
  flex: 1;
  justify-content: center;
  padding: 28rpx 0 24rpx;
  font-size: 34rpx;
  font-weight: 700;
  border-right: 1rpx solid #e8e8e8;
  box-sizing: border-box;
}

.tab-item.town-tab-item:last-child {
  border-right: none;
}

.tab-item.active {
  color: #1890ff;
  font-weight: 500;
}

.tab-item.county-tab-item.active {
  font-weight: 700;
}

.tab-item.town-tab-item.active {
  font-weight: 700;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20rpx;
  right: 20rpx;
  height: 4rpx;
  background: #1890ff;
  border-radius: 2rpx;
}

.tab-item.town-tab-item.active::after {
  left: 28rpx;
  right: 28rpx;
  height: 5rpx;
}

.order-scroll {
  height: calc(100vh - 100rpx);
}

.reminder-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18rpx 24rpx;
  background: #fff7e6;
  border-bottom: 1rpx solid #ffe7ba;
}

.reminder-banner-text {
  font-size: 24rpx;
  color: #ad6800;
}

.reminder-banner-action {
  font-size: 24rpx;
  color: #1890ff;
}

.order-list {
  padding: 20rpx;
}

.order-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  border-left: 8rpx solid transparent;
}

.order-card.highlight-card {
  border-left-color: #ff6b35;
  background: linear-gradient(135deg, #fff 0%, #fff7f5 100%);
}

.order-card.town-order-card {
  border-left-color: #1f6f43;
  background: linear-gradient(135deg, #fff 0%, #f2fbf5 100%);
}

.order-card.transfer-order-card {
  border-left-color: #faad14;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20rpx;
}

.header-left {
  flex: 1;
}

.order-info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12rpx;
  gap: 12rpx;
}

.header-tags {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12rpx;
  flex-shrink: 0;
  max-width: 46%;
}

.scope-tag {
  font-size: 24rpx;
  color: #fff;
  background: #1f6f43;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
}

.transfer-tag {
  font-size: 24rpx;
  color: #8a5a00;
  background: #fff3cd;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
}

.order-no {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  flex: 1;
  min-width: 0;
  word-break: break-all;
}

.order-time {
  font-size: 22rpx;
  color: #999;
  display: block;
}

.status-tag {
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  color: #fff;
  font-weight: 500;
  flex-shrink: 0;
}

/* 配送费区域（突出显示） */
.delivery-fee-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #fff7e6, #fff);
  padding: 24rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  border: 2rpx solid #ffd591;
}

.fee-label {
  font-size: 28rpx;
  color: #666;
  font-weight: 500;
}

.fee-num {
  font-size: 44rpx;
  color: #ff6b35;
  font-weight: bold;
}

/* 简化信息区域 */
.simple-info {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.simple-info:last-child {
  border-bottom: none;
}

.info-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.info-text {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
  word-break: break-all;
}

.order-main-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #111;
}

.transfer-info {
  background: rgba(250, 173, 20, 0.08);
  border-radius: 12rpx;
  padding: 18rpx 16rpx;
  margin-top: 4rpx;
}

.address-text {
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-btn {
  font-size: 26rpx;
  color: #1890ff;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.merchant-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.merchant-name {
  font-size: 28rpx;
  color: #333;
  flex: 1;
}

.merchant-phone {
  font-size: 32rpx;
  color: #1890ff;
  padding: 8rpx 16rpx;
}

.delivery-info {
  margin-bottom: 16rpx;
}

.info-label {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
}

.info-value {
  font-size: 26rpx;
  color: #333;
  line-height: 1.5;
}

.order-amount {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.amount-label {
  font-size: 26rpx;
  color: #666;
  margin-right: 12rpx;
}

.amount-num {
  font-size: 32rpx;
  color: #FF6B35;
  font-weight: bold;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
}

.btn {
  padding: 16rpx 32rpx;
  font-size: 26rpx;
  border-radius: 8rpx;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
}

.btn-success {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #fff;
}

.btn-special {
  background: linear-gradient(135deg, #fa8c16, #ffc069);
  color: #fff;
}

.btn-default {
  background: #f5f5f5;
  color: #666;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.empty-tip {
  font-size: 26rpx;
  color: #999;
}

.load-more {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #999;
}
</style>
