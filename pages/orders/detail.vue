<template>
  <view class="container">
    <view class="card">
      <text class="section-title">订单信息</text>
      <view v-if="isTransferOrder(order)" class="transfer-banner">
        <text class="transfer-banner-tag">{{ getTransferTag(order) }}</text>
        <text class="transfer-banner-text">{{ getTransferBannerText(order) }}</text>
      </view>
      <view class="info-row">
        <text class="label">订单号</text>
        <text class="value">{{ order.order_no }}</text>
      </view>
      <view class="info-row">
        <text class="label">订单状态</text>
        <text class="value status" :style="{ color: getStatusColor(order.status) }">
          {{ getStatusText(order.status) }}
        </text>
      </view>
      <view class="info-row">
        <text class="label">下单时间</text>
        <text class="value">{{ formatTime(order.created_at) }}</text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">配送信息</text>
      <view class="info-row">
        <text class="label">商家名称</text>
        <text class="value">{{ order.merchant?.name || '未知商家' }}</text>
      </view>
      <view class="info-row">
        <text class="label">配送地址</text>
        <text class="value">{{ getFullAddress(order) }}</text>
      </view>
      <view class="info-row">
        <text class="label">联系人</text>
        <text class="value">{{ order.contact_name }}</text>
      </view>
      <view class="info-row">
        <text class="label">联系电话</text>
        <text class="value" @click="callUser(order.contact_phone)">{{ order.contact_phone }}</text>
      </view>
    </view>

    <view
      v-if="showDeliveryActionCard"
      class="delivery-distance-card"
    >
      <text class="delivery-distance-text">{{ getConfirmDeliveryHint() }}</text>
    </view>

    <view
      v-if="hasOrderOwnership && (canPickup(order.status) || canAccessPickupNavigation(order.status) || canAccessDeliveryNavigation(order.status))"
      class="detail-inline-actions"
    >
      <button
        v-if="canAccessPickupNavigation(order.status)"
        class="btn btn-primary"
        @click="goPickup"
      >
        去取餐
      </button>
      <button
        v-if="canAccessDeliveryNavigation(order.status)"
        class="btn btn-primary"
        @click="goDelivery"
      >
        去送货
      </button>
      <button
        v-if="canPickup(order.status)"
        class="btn btn-primary"
        @click="handlePickup"
      >
        确认取餐
      </button>
    </view>

    <view v-if="isTransferOrder(order)" class="card">
      <text class="section-title">转派信息</text>
      <view class="info-row">
        <text class="label">转派单</text>
        <text class="value">{{ toBoolean(order.is_transfer_order) ? '是' : '否' }}</text>
      </view>
      <view class="info-row">
        <text class="label">转派状态</text>
        <text class="value">{{ getTransferStatusText(order) || '未提供' }}</text>
      </view>
      <view class="info-row">
        <text class="label">目标乡镇</text>
        <text class="value">{{ getTransferToTownName(order) || '未提供' }}</text>
      </view>
      <view v-if="getAssignedTownRiderName(order)" class="info-row">
        <text class="label">当前配送人</text>
        <text class="value">{{ getAssignedTownRiderName(order) }}</text>
      </view>
      <view v-if="getTransferFromUserName(order)" class="info-row">
        <text class="label">转派来源</text>
        <text class="value">{{ getTransferFromUserName(order) }}</text>
      </view>
    </view>

    <view v-if="showGaodeSearchAssistCard" class="card">
      <text class="section-title">高德搜索辅助</text>
      <view class="info-row">
        <text class="label">可搜地址</text>
        <text class="value gaode-search-text">{{ getGaodeSearchAssistText() }}</text>
      </view>
      <view v-if="getGaodeSearchAssistCoordText()" class="info-row">
        <text class="label">辅助坐标</text>
        <text class="value gaode-coord-text">{{ getGaodeSearchAssistCoordText() }}</text>
      </view>
      <button class="gaode-copy-btn" @click="copyGaodeSearchAssist">
        复制到高德搜索
      </button>
    </view>

    <view class="action-bar">
      <button
        v-if="canShowTownRiderTransferButton"
        class="btn btn-transfer"
        @click="openTownRiderTransferDialog"
      >
        转给骑手
      </button>
      <button
        v-if="canShowTransferButton"
        class="btn btn-transfer"
        @click="openTransferDialog"
      >
        转派给乡镇站长
      </button>
      <button
        v-if="canShowTransferRevokeAction"
        class="btn btn-revoke"
        @click="handleTransferRevoke"
      >
        撤回一次
      </button>
      <button
        v-if="showPrimaryDeliveryAction"
        class="btn btn-success"
        :disabled="isPrimaryDeliveryActionDisabled"
        @click="handlePrimaryDeliveryAction"
      >
        {{ getPrimaryDeliveryActionText() }}
      </button>
      <button
        v-if="showSpecialCompleteAssistAction"
        class="btn btn-special btn-full-width"
        @click="handleSpecialComplete"
      >
        特殊完结
      </button>
    </view>
    <transfer-order-dialog
      :show="showTransferDialog"
      :loading="transferSubmitting"
      :order-no="order.order_no || ''"
      :town-options="townOptions"
      :stationmaster-options="stationmasterOptions"
      :stationmasters-loading="stationmastersLoading"
      :default-town="getCurrentOrderTownName(order)"
      :default-stationmaster="getTransferToUserName(order)"
      @close="closeTransferDialog"
      @town-change="handleTransferTownChange"
      @confirm="handleTransferSubmit"
    />
    <transfer-town-rider-dialog
      :show="showTownRiderTransferDialog"
      :loading="townRiderTransferSubmitting || townRiderListLoading"
      :order-no="order.order_no || ''"
      :rider-options="townRiderOptions"
      @close="closeTownRiderTransferDialog"
      @confirm="handleTownRiderTransferSubmit"
    />
  </view>
</template>

<script>
import {
  getOrderDetail,
  getTransferStationmasters,
  getTransferTownRiders,
  submitOrderTransfer,
  submitOrderTransferToTownRider,
  revokeOrderTransfer,
  riderPickup,
  confirmDelivery,
  confirmDeliverySpecial,
  startMerchantSelfDelivery,
  confirmMerchantSelfDelivery
} from '@/api/order.js'
import { getTownServiceAreas } from '@/api/common.js'
import {
  ORDER_STATUS,
  canRiderCallConfirmDeliveryApi,
  canRiderOfferSpecialComplete
} from '@/config/index.js'
import { formatTime } from '@/utils/index.js'
import { isRiderAppUser } from '@/utils/rider-auth.js'
import { getUserInfo as getStoredUserInfo } from '@/utils/storage.js'
import TransferOrderDialog from '@/components/transfer-order-dialog.vue'
import TransferTownRiderDialog from '@/components/transfer-town-rider-dialog.vue'
import {
  canShowSpecialComplete,
  DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED,
  DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS,
  getConfirmDeliveryHint,
  getOrderStatusText,
  getPrimaryDeliveryAction,
  hasOrderOwnership
} from '@/utils/delivery-order.js'
import { resolveDeliveryProfile } from '@/utils/delivery-identity.js'
import {
  getCachedRiderCoords as getCachedRiderCoordsFromService,
  hasValidCoords as hasValidCoordsFromService,
  requestNavigationLocation as requestNavigationLocationFromService,
  resolveNavigationStartCoords as resolveNavigationStartCoordsFromService
} from '@/utils/navigation-service.js'
const DELIVERY_DISTANCE_REFRESH_INTERVAL = 10000
const DEBUG_SERVER_URL = 'http://198.18.0.1:7777/event'
const DEBUG_SESSION_ID = 'rider-random-logout'
const ENABLE_DEBUG_EVENT_REPORT = false

function reportDetailDebug(hypothesisId, location, msg, data = {}) {
  if (!ENABLE_DEBUG_EVENT_REPORT) {
    return
  }
  // #region debug-point H:detail-auth-guard
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
  components: {
    TransferOrderDialog,
    TransferTownRiderDialog
  },
  computed: {
    showGaodeSearchAssistCard() {
      return !this.isTownOrder(this.order) && !!this.getGaodeSearchAssistText()
    },
    canShowTransferButton() {
      return this.toBoolean(this.order?.can_transfer)
    },
    canShowTransferRevokeButton() {
      return this.toBoolean(this.order?.can_transfer_revoke)
    },
    canShowTownRiderTransferButton() {
      return this.toBoolean(this.order?.can_transfer_to_town_rider)
    },
    canShowTownRiderTransferRevokeButton() {
      return this.toBoolean(this.order?.can_transfer_to_town_rider_revoke)
    },
    canShowTransferRevokeAction() {
      return this.canShowTransferRevokeButton || this.canShowTownRiderTransferRevokeButton
    },
    showDeliveryActionCard() {
      return this.hasOrderOwnership && (
        getPrimaryDeliveryAction(this.order, {
          profile: this.getDeliveryProfile(),
          owned: this.hasOrderOwnership
        }).visible || canShowSpecialComplete(this.order, this.hasOrderOwnership)
      )
    },
    showPrimaryDeliveryAction() {
      return this.showDeliveryActionCard
    },
    showSpecialCompleteAssistAction() {
      return canShowSpecialComplete(this.order, this.hasOrderOwnership)
    },
    isConfirmDeliveryDisabled() {
      if (!canRiderCallConfirmDeliveryApi(this.order.status) || !this.hasOrderOwnership) {
        return true
      }
      if (!DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED) {
        return false
      }
      if (this.deliveryDistanceLoading) {
        return true
      }
      if (typeof this.deliveryDistanceMeters !== 'number') {
        return true
      }
      return this.deliveryDistanceMeters > DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS
    },
    isPrimaryDeliveryActionDisabled() {
      if (!this.showPrimaryDeliveryAction) {
        return true
      }
      const action = getPrimaryDeliveryAction(this.order, {
        profile: this.getDeliveryProfile(),
        owned: this.hasOrderOwnership
      })
      if (!action.visible) {
        return true
      }
      if (action.key === 'start_delivery') {
        return false
      }
      if (!canRiderCallConfirmDeliveryApi(this.order.status)) {
        return true
      }
      return this.isConfirmDeliveryDisabled
    }
  },
  data() {
    return {
      hasPageAccess: false,
      orderId: null,
      order: {},
      hasOrderOwnership: false,
      orderOwnershipCheckable: false,
      showTransferDialog: false,
      transferSubmitting: false,
      townOptions: [],
      stationmasterOptions: [],
      stationmastersLoading: false,
      showTownRiderTransferDialog: false,
      townRiderTransferSubmitting: false,
      townRiderListLoading: false,
      townRiderOptions: [],
      deliveryDistanceMeters: null,
      deliveryDistanceLoading: false,
      deliveryDistanceError: '',
      deliveryDistanceTimer: null,
      navigationLaunching: false
    }
  },
  onLoad(options) {
    this.hasPageAccess = this.ensurePageAccess()
    if (!this.hasPageAccess) {
      return
    }
    this.orderId = options.id
    this.loadOrderDetail()
  },
  onShow() {
    this.hasPageAccess = this.ensurePageAccess()
    if (!this.hasPageAccess) {
      return
    }
    if (this.orderId) {
      this.loadOrderDetail()
    }
  },
  onHide() {
    this.stopDeliveryDistancePolling()
  },
  onUnload() {
    this.stopDeliveryDistancePolling()
  },
  methods: {
    formatTime,
    canRiderCallConfirmDeliveryApi,
    canRiderOfferSpecialComplete,
    getDeliveryProfile() {
      const user = getStoredUserInfo() || {}
      return resolveDeliveryProfile(user)
    },
    isMerchantDeliveryMode() {
      return this.getDeliveryProfile().isMerchantSelfDelivery
    },
    getConfirmDeliveryHint() {
      return getConfirmDeliveryHint(this.order, {
        profile: this.getDeliveryProfile(),
        owned: this.hasOrderOwnership,
        distanceLoading: this.deliveryDistanceLoading,
        distanceMeters: this.deliveryDistanceMeters,
        distanceError: this.deliveryDistanceError
      })
    },
    getPrimaryDeliveryActionText() {
      return getPrimaryDeliveryAction(this.order, {
        profile: this.getDeliveryProfile(),
        owned: this.hasOrderOwnership
      }).text || '确认送达'
    },
    toRadians(value) {
      return Number(value) * Math.PI / 180
    },
    calculateDistanceMeters(from = {}, to = {}) {
      const fromLng = Number(from.lng)
      const fromLat = Number(from.lat)
      const toLng = Number(to.lng)
      const toLat = Number(to.lat)
      if (![fromLng, fromLat, toLng, toLat].every(Number.isFinite)) {
        return Number.NaN
      }
      const earthRadius = 6371000
      const latDiff = this.toRadians(toLat - fromLat)
      const lngDiff = this.toRadians(toLng - fromLng)
      const a = Math.sin(latDiff / 2) ** 2
        + Math.cos(this.toRadians(fromLat)) * Math.cos(this.toRadians(toLat)) * Math.sin(lngDiff / 2) ** 2
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return earthRadius * c
    },
    resetDeliveryDistanceState() {
      this.deliveryDistanceMeters = null
      this.deliveryDistanceLoading = false
      this.deliveryDistanceError = ''
    },
    stopDeliveryDistancePolling() {
      if (this.deliveryDistanceTimer) {
        clearInterval(this.deliveryDistanceTimer)
        this.deliveryDistanceTimer = null
      }
    },
    syncDeliveryDistancePolling() {
      this.stopDeliveryDistancePolling()
      if (!DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED) {
        this.resetDeliveryDistanceState()
        return
      }
      if (!canRiderCallConfirmDeliveryApi(this.order.status) || !this.hasOrderOwnership) {
        return
      }
      this.deliveryDistanceTimer = setInterval(() => {
        this.refreshConfirmDeliveryDistance({
          forceLocate: false,
          silent: true
        })
      }, DELIVERY_DISTANCE_REFRESH_INTERVAL)
    },
    async refreshConfirmDeliveryDistance({ forceLocate = false, silent = true } = {}) {
      if (!DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED) {
        this.resetDeliveryDistanceState()
        return true
      }
      if (!canRiderCallConfirmDeliveryApi(this.order.status) || !this.hasOrderOwnership) {
        this.resetDeliveryDistanceState()
        return false
      }
      const customer = this.getCustomerCoords()
      if (!this.hasValidCoords(customer)) {
        this.deliveryDistanceMeters = null
        this.deliveryDistanceLoading = false
        this.deliveryDistanceError = '用户坐标缺失，暂时不能确认送达'
        if (!silent) {
          uni.showToast({ title: '用户坐标缺失', icon: 'none' })
        }
        return false
      }
      this.deliveryDistanceLoading = true
      this.deliveryDistanceError = ''
      const rider = forceLocate
        ? await this.resolveNavigationStartCoords()
        : this.getCachedRiderCoords()
      this.deliveryDistanceLoading = false
      if (!this.hasValidCoords(rider)) {
        this.deliveryDistanceMeters = null
        this.deliveryDistanceError = '骑手定位未就绪，暂时不能确认送达'
        if (!silent) {
          uni.showToast({ title: '骑手定位未就绪', icon: 'none' })
        }
        return false
      }
      const distance = this.calculateDistanceMeters(rider, customer)
      if (!Number.isFinite(distance)) {
        this.deliveryDistanceMeters = null
        this.deliveryDistanceError = '距离计算失败，请稍后重试'
        if (!silent) {
          uni.showToast({ title: '距离计算失败', icon: 'none' })
        }
        return false
      }
      this.deliveryDistanceMeters = distance
      if (distance > DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS) {
        this.deliveryDistanceError = ''
        if (!silent) {
          uni.showToast({
            title: `距用户${Math.round(distance)}米，需在${DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS}米内`,
            icon: 'none'
          })
        }
        return false
      }
      this.deliveryDistanceError = ''
      return true
    },
    ensurePageAccess() {
      const user = getStoredUserInfo() || {}
      if (isRiderAppUser(user)) {
        return true
      }
      reportDetailDebug('H', 'pages/orders/detail.vue:ensurePageAccess', 'detail page access denied and will redirect to login', {
        hasToken: !!uni.getStorageSync('token'),
        hasUserInfo: !!uni.getStorageSync('userInfo'),
        userRole: user?.role || '',
        orderId: this.orderId || ''
      })
      uni.showToast({ title: '请先使用骑手账号登录', icon: 'none' })
      uni.reLaunch({ url: '/pages/login/index' })
      return false
    },
    getStatusText(status) {
      return getOrderStatusText(status, {
        profile: this.getDeliveryProfile(),
        order: this.order
      })
    },
    getStatusColor(status) {
      if (this.isTownOrder(this.order)) {
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
      return this.getCurrentOrderTownName(order)
    },
    getGaodeSearchAssist() {
      return this.order?.gaode_search_assist || {}
    },
    getGaodeSearchAssistText() {
      const assist = this.getGaodeSearchAssist()
      return assist.search_text
        || assist.formatted_address
        || assist.location_summary
        || assist.original_address
        || ''
    },
    getGaodeSearchAssistCoordText() {
      return this.getGaodeSearchAssist().coord_text || ''
    },
    toBoolean(value) {
      return value === true || value === 1 || value === '1' || value === 'true'
    },
    safeText(value) {
      if (value === undefined || value === null) {
        return ''
      }
      if (typeof value === 'number' && Number.isNaN(value)) {
        return ''
      }
      return String(value).trim()
    },
    isTransferOrder(order = {}) {
      return this.toBoolean(order.is_transfer_order) || !!this.safeText(order.transfer_tag)
    },
    getTransferTag(order = {}) {
      return this.safeText(order.transfer_tag) || (this.isTransferOrder(order) ? '转派单' : '')
    },
    getTransferStatusText(order = {}) {
      return this.safeText(order.transfer_status)
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
    getCurrentOrderTownName(order = {}) {
      return this.safeText(order.target_town_name)
        || this.getTransferToTownName(order)
        || this.safeText(order.customer_town)
        || this.safeText(order.town_name)
        || this.safeText(order.rider_town)
        || ''
    },
    getTransferToUserName(order = {}) {
      const targetUser = order.transfer_to_user
      if (targetUser && typeof targetUser === 'object') {
        return this.safeText(
          targetUser.nickname
          || targetUser.real_name
          || targetUser.name
          || targetUser.username
        )
      }
      return this.safeText(targetUser)
    },
    getTransferFromUserName(order = {}) {
      const sourceUser = order.transfer_from_user
      if (sourceUser && typeof sourceUser === 'object') {
        return this.safeText(
          sourceUser.nickname
          || sourceUser.real_name
          || sourceUser.name
          || sourceUser.username
        )
      }
      return this.safeText(sourceUser) || '县城司机'
    },
    getTransferChainSummaryText(order = {}) {
      const summary = order.transfer_chain_summary
      if (summary && typeof summary === 'object') {
        return ''
      }
      return this.safeText(summary)
    },
    isAssignedToTownRider(order = {}) {
      return this.safeText(order.transfer_status) === 'assigned_to_town_rider'
    },
    getAssignedTownRiderName(order = {}) {
      if (!this.isAssignedToTownRider(order)) {
        return ''
      }
      const targetUser = order.transfer_to_user
      if (targetUser && typeof targetUser === 'object') {
        return this.safeText(targetUser.nickname || targetUser.username || targetUser.name)
      }
      return ''
    },
    getTransferBannerText(order = {}) {
      if (this.isAssignedToTownRider(order)) {
        const riderName = this.getAssignedTownRiderName(order)
        const fromUser = this.getTransferFromUserName(order)
        if (riderName) {
          return `已转给：${riderName}${fromUser ? ` · 来源：${fromUser}` : ''}`
        }
      }
      const pieces = [`来源：${this.getTransferFromUserName(order)}`]
      const targetTown = this.getTransferToTownName(order)
      if (targetTown) {
        pieces.push(`目标乡镇：${targetTown}`)
      }
      const targetUser = this.getTransferToUserName(order)
      if (targetUser) {
        pieces.push(`目标站长：${targetUser}`)
      }
      return pieces.join(' · ')
    },
    normalizeIdentityValue(value) {
      if (value === undefined || value === null || value === '') {
        return ''
      }
      return String(value)
    },
    canPickup(status) {
      return Number(status) === 4
    },
    canAccessNavigation(status) {
      return this.canAccessPickupNavigation(status) || this.canAccessDeliveryNavigation(status)
    },
    canAccessPickupNavigation(status) {
      if (this.isTownOrder(this.order)) {
        return Number(status) >= 2 && Number(status) <= 5
      }
      return [4, 5].includes(Number(status))
    },
    canAccessDeliveryNavigation(status) {
      if (this.isTownOrder(this.order)) {
        return Number(status) >= 2 && Number(status) <= 5
      }
      return Number(status) === 5
    },
    getFullAddress(order) {
      try {
        const addr = typeof order.delivery_address === 'string' 
          ? JSON.parse(order.delivery_address) 
          : order.delivery_address
        const fullAddress = [
          this.safeText(addr?.province),
          this.safeText(addr?.city),
          this.safeText(addr?.district),
          this.safeText(addr?.street),
          this.safeText(addr?.detail)
        ].filter(Boolean).join('')
        return fullAddress || this.safeText(order.address) || '未知地址'
      } catch (e) {
        return this.safeText(order.address) || '未知地址'
      }
    },
    async loadOrderDetail() {
      if (!this.hasPageAccess || !this.orderId) {
        return
      }
      try {
        const res = await getOrderDetail(this.orderId)
        this.order = res.data || {}
        this.syncOrderOwnershipState(this.order, false)
        await this.refreshConfirmDeliveryDistance({
          forceLocate: true,
          silent: true
        })
        this.syncDeliveryDistancePolling()
        console.log('[order-detail] loadOrderDetail success', {
          orderId: this.order?.id ?? '',
          orderNo: this.order?.order_no ?? '',
          status: this.order?.status ?? '',
          hasOrderOwnership: this.hasOrderOwnership
        })
        console.log('[order-detail] debug transfer fields', {
          order_type: this.order?.order_type,
          status: this.order?.status,
          rider_id: this.order?.rider_id,
          current_responsible_user_id: this.order?.current_responsible_user_id,
          can_transfer: this.order?.can_transfer
        })
      } catch (e) {
        console.error('加载订单详情失败', e)
      }
    },
    async loadTownOptions() {
      try {
        const res = await getTownServiceAreas()
        this.townOptions = Array.isArray(res?.data)
          ? res.data.map(item => ({
              value: item.area_code,
              label: item.area_name
            }))
          : []
      } catch (error) {
        this.townOptions = []
        console.error('加载转派乡镇列表失败', error)
      }
    },
    normalizeStationmasterOptions(source) {
      const list = Array.isArray(source)
        ? source
        : Array.isArray(source?.list)
          ? source.list
          : Array.isArray(source?.rows)
            ? source.rows
            : Array.isArray(source?.data)
              ? source.data
              : []
      return list.map(item => {
        const value = this.safeText(item?.id || item?.user_id || item?.userId || item?.stationmaster_id || item?.value)
        const label = this.safeText(
          item?.nickname
          || item?.real_name
          || item?.name
          || item?.username
          || item?.stationmaster_name
          || item?.label
        )
        return {
          value: value || label,
          label: label || value
        }
      }).filter(item => item.value || item.label)
    },
    async loadTransferStationmasters(townName = '') {
      const resolvedTownName = this.safeText(townName) || this.getCurrentOrderTownName(this.order)
      this.stationmastersLoading = true
      try {
        const res = await getTransferStationmasters({
          town_name: resolvedTownName
        })
        this.stationmasterOptions = this.normalizeStationmasterOptions(res?.data)
      } catch (error) {
        this.stationmasterOptions = []
        console.error('加载转派站长列表失败', error)
      } finally {
        this.stationmastersLoading = false
      }
    },
    normalizeTownRiderOptions(source) {
      const list = Array.isArray(source)
        ? source
        : Array.isArray(source?.list)
          ? source.list
          : Array.isArray(source?.rows)
            ? source.rows
            : Array.isArray(source?.data)
              ? source.data
              : []
      return list.map(item => ({
        value: this.safeText(item?.id || item?.user_id || item?.userId),
        label: this.safeText(item?.nickname || item?.username || item?.name) || '骑手',
        phone: this.safeText(item?.phone),
        isOnline: Number(item?.is_online || 0),
        canReceiveTransfer: this.toBoolean(item?.can_receive_transfer ?? 1)
      })).filter(item => item.value)
    },
    getTransferOrderIdentifier() {
      return this.safeText(this.order?.order_no) || this.safeText(this.orderId)
    },
    async loadTownRiderOptions() {
      this.townRiderListLoading = true
      try {
        const res = await getTransferTownRiders({
          order_id: this.getTransferOrderIdentifier()
        })
        this.townRiderOptions = this.normalizeTownRiderOptions(res?.data)
      } catch (error) {
        this.townRiderOptions = []
        console.error('加载乡镇骑手列表失败', error)
        uni.showToast({ title: this.getErrorMessage(error) || '加载骑手列表失败', icon: 'none' })
      } finally {
        this.townRiderListLoading = false
      }
    },
    async openTownRiderTransferDialog() {
      if (!this.canShowTownRiderTransferButton) {
        return
      }
      await this.loadTownRiderOptions()
      this.showTownRiderTransferDialog = true
    },
    closeTownRiderTransferDialog() {
      if (this.townRiderTransferSubmitting) {
        return
      }
      this.showTownRiderTransferDialog = false
    },
    async openTransferDialog() {
      if (!this.canShowTransferButton) {
        return
      }
      if (!this.townOptions.length) {
        await this.loadTownOptions()
      }
      await this.loadTransferStationmasters(this.getCurrentOrderTownName(this.order))
      this.showTransferDialog = true
    },
    closeTransferDialog() {
      if (this.transferSubmitting) {
        return
      }
      this.showTransferDialog = false
    },
    async handleTransferTownChange(payload = {}) {
      await this.loadTransferStationmasters(payload.target_town_name || '')
    },
    handleTransferSubmit(payload = {}) {
      uni.showModal({
        title: '确认转派',
        content: `确认转派到${payload.target_town_name || '目标乡镇'}，目标站长：${payload.target_user_name || '未选择'}？`,
        confirmText: '确认转派',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) {
            return
          }
          this.transferSubmitting = true
          try {
            await submitOrderTransfer({
              order_id: this.orderId,
              target_town_name: payload.target_town_name || '',
              target_user_id: payload.target_user_id || ''
            })
            uni.showToast({ title: '转派成功', icon: 'success' })
            await this.loadOrderDetail()
            this.refreshOrderListPage()
          } finally {
            this.transferSubmitting = false
            this.showTransferDialog = false
          }
        }
      })
    },
    handleTownRiderTransferSubmit(payload = {}) {
      uni.showModal({
        title: '确认转单',
        content: '确认将当前订单转给所选骑手配送？',
        confirmText: '确认转单',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) {
            return
          }
          this.townRiderTransferSubmitting = true
          try {
            await submitOrderTransferToTownRider({
              order_id: this.getTransferOrderIdentifier(),
              target_rider_id: payload.target_rider_id || '',
              remark: payload.remark || '站长转交本乡镇骑手配送'
            })
            uni.showToast({ title: '转单成功', icon: 'success' })
            await this.loadOrderDetail()
            this.refreshOrderListPage()
          } catch (error) {
            console.error('转给骑手失败', error)
            uni.showToast({ title: this.getErrorMessage(error) || '转单失败', icon: 'none' })
          } finally {
            this.townRiderTransferSubmitting = false
            this.showTownRiderTransferDialog = false
          }
        }
      })
    },
    handleTransferRevoke() {
      uni.showModal({
        title: '撤回一次',
        content: '确认撤回本次转派？',
        confirmText: '确认撤回',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) {
            return
          }
          await revokeOrderTransfer(this.getTransferOrderIdentifier())
          uni.showToast({ title: '已撤回转派', icon: 'success' })
          await this.loadOrderDetail()
          this.refreshOrderListPage()
        }
      })
    },
    refreshOrderListPage() {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const listPage = pages.find(page => {
        const route = page?.route || page?.$page?.fullPath || page?.$page?.route || ''
        return String(route).includes('pages/orders/index')
      })
      const vm = listPage?.$vm || listPage
      if (vm && typeof vm.loadOrderList === 'function') {
        vm.loadOrderList()
      }
    },
    getCurrentRiderId() {
      const userInfo = getStoredUserInfo() || {}
      return this.normalizeIdentityValue(this.getCoordinateByKeys(userInfo, ['id', 'user_id', 'userId']))
    },
    getOrderOwnerId(order = this.order) {
      return this.normalizeIdentityValue(this.getCoordinateByKeys(order || {}, ['rider_id', 'riderId']))
    },
    syncOrderOwnershipState(order = this.order, notify = false) {
      const currentRiderId = this.getCurrentRiderId()
      const orderOwnerId = this.getOrderOwnerId(order)
      const responsibleId = this.normalizeIdentityValue(this.getCoordinateByKeys(order || {}, ['current_responsible_user_id', 'currentResponsibleUserId']))
      const isMerchantDeliveryPending =
        this.isMerchantDeliveryMode() &&
        Number(order?.status) === 3 &&
        !orderOwnerId &&
        !responsibleId
      const checkable = isMerchantDeliveryPending || (!!currentRiderId && !!orderOwnerId)
      const owned = isMerchantDeliveryPending || hasOrderOwnership(order, getStoredUserInfo() || {})
      this.orderOwnershipCheckable = checkable
      this.hasOrderOwnership = owned
      if (!notify) {
        return owned
      }
      if (!checkable) {
        uni.showToast({ title: '当前订单暂不可执行配送操作', icon: 'none' })
        return false
      }
      if (!owned) {
        uni.showToast({ title: '当前订单暂不可执行配送操作', icon: 'none' })
        return false
      }
      return true
    },
    ensureOrderOwnership(actionName = '当前操作') {
      if (this.syncOrderOwnershipState(this.order, false)) {
        return true
      }
      if (!this.orderOwnershipCheckable) {
        uni.showToast({ title: '当前订单暂不可执行配送操作', icon: 'none' })
        return false
      }
      uni.showToast({ title: '当前订单暂不可执行配送操作', icon: 'none' })
      return false
    },
    handleStandardDelivery() {
      if (!this.ensureOrderOwnership('确认送达')) {
        return
      }
      this.refreshConfirmDeliveryDistance({
        forceLocate: true,
        silent: false
      }).then(canConfirm => {
        if (!canConfirm) {
          return
        }
        uni.showModal({
        title: '确认送达',
        content: '确认订单已送达？',
        confirmText: '确认送达',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          if (!this.ensureOrderOwnership('确认送达')) {
            return
          }
          if (!canRiderCallConfirmDeliveryApi(this.order.status)) {
            uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
            return
          }
          const stillValid = await this.refreshConfirmDeliveryDistance({
            forceLocate: true,
            silent: false
          })
          if (!stillValid) {
            return
          }
          try {
            await confirmDelivery(this.orderId)
            uni.showToast({ title: '送达成功', icon: 'success' })
            await this.loadOrderDetail()
          } catch (e) {
            console.error('确认送达失败', e)
          }
        }
        })
      })
    },
    handlePrimaryDeliveryAction() {
      const primaryAction = getPrimaryDeliveryAction(this.order, {
        profile: this.getDeliveryProfile(),
        owned: this.hasOrderOwnership
      })
      if (primaryAction.key === 'start_delivery') {
        if (!this.ensureOrderOwnership('自配送操作')) {
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
              await startMerchantSelfDelivery(this.orderId)
              uni.showToast({ title: '已开始配送', icon: 'success' })
              await this.loadOrderDetail()
            } catch (e) {
              console.error('自配送开始失败', e)
              uni.showToast({ title: this.getErrorMessage(e) || '开始配送失败', icon: 'none' })
            }
          }
        })
        return
      }
      if (this.isMerchantDeliveryMode()) {
        if (!this.ensureOrderOwnership('自配送操作')) {
          return
        }
        if (primaryAction.key === 'complete_delivery') {
          uni.showModal({
            title: '确认送达',
            content: '确认该自配送订单已送达？',
            confirmText: '确认送达',
            cancelText: '取消',
            success: async (res) => {
              if (!res.confirm) return
              try {
                await confirmMerchantSelfDelivery(this.orderId)
                uni.showToast({ title: '送达成功', icon: 'success' })
                await this.loadOrderDetail()
              } catch (e) {
                console.error('自配送确认送达失败', e)
                uni.showToast({ title: this.getErrorMessage(e) || '确认送达失败', icon: 'none' })
              }
            }
          })
          return
        }
      }
      if (!canRiderCallConfirmDeliveryApi(this.order.status)) {
        uni.showToast({ title: '订单未进入配送中，暂不可确认送达', icon: 'none' })
        return
      }
      this.handleStandardDelivery()
    },
    handleSpecialComplete() {
      if (!this.ensureOrderOwnership('特殊完结')) {
        return
      }
      uni.showModal({
        title: '特殊完结',
        content: '确认按「特殊完结」处理该订单？',
        confirmText: '特殊完结',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          if (!this.ensureOrderOwnership('特殊完结')) {
            return
          }
          if (!canRiderOfferSpecialComplete(this.order.status)) {
            uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
            return
          }
          try {
            await confirmDeliverySpecial(this.orderId)
            uni.showToast({ title: '操作成功', icon: 'success' })
            await this.loadOrderDetail()
          } catch (e) {
            console.error('特殊完结失败', e)
          }
        }
      })
    },
    getRiderId() {
      return this.getCurrentRiderId()
    },
    parseAddress() {
      try {
        return typeof this.order.delivery_address === 'string'
          ? JSON.parse(this.order.delivery_address)
          : (this.order.delivery_address || {})
      } catch (e) {
        return {}
      }
    },
    getCoordinateByKeys(source, keys) {
      for (let i = 0; i < keys.length; i++) {
        const value = source[keys[i]]
        if (value !== undefined && value !== null && value !== '') {
          return value
        }
      }
      return ''
    },
    getMerchantCoords() {
      const address = this.parseAddress()
      const merchant = this.order.merchant || {}
      const lng = this.getCoordinateByKeys(merchant, ['lng', 'lat_lng', 'longitude', 'lon', 'map_lng', 'merchant_lng', 'merchantLng'])
        || this.getCoordinateByKeys(this.order || {}, ['merchant_lng', 'merchantLng', 'shop_lng', 'shopLng', 'store_lng', 'storeLng', 'pickup_lng', 'pickupLng', 'from_lng', 'fromLng'])
        || this.getCoordinateByKeys(address, ['merchant_lng', 'shop_lng', 'store_lng', 'pickup_lng', 'from_lng'])
      const lat = this.getCoordinateByKeys(merchant, ['lat', 'latitude', 'map_lat', 'merchant_lat', 'merchantLat'])
        || this.getCoordinateByKeys(this.order || {}, ['merchant_lat', 'merchantLat', 'shop_lat', 'shopLat', 'store_lat', 'storeLat', 'pickup_lat', 'pickupLat', 'from_lat', 'fromLat'])
        || this.getCoordinateByKeys(address, ['merchant_lat', 'shop_lat', 'store_lat', 'pickup_lat', 'from_lat'])
      return { lng, lat }
    },
    getPickupMerchantCoords() {
      const address = this.parseAddress()
      const orderSnapshot = this.order || {}
      const merchant = orderSnapshot.merchant || {}
      const lng = this.getCoordinateByKeys(orderSnapshot, ['merchant_lng', 'merchantLng', 'shop_lng', 'shopLng', 'store_lng', 'storeLng', 'pickup_lng', 'pickupLng', 'from_lng', 'fromLng'])
        || this.getCoordinateByKeys(merchant, ['merchant_lng', 'merchantLng', 'lng', 'lat_lng', 'longitude', 'lon', 'map_lng'])
        || this.getCoordinateByKeys(address, ['merchant_lng', 'shop_lng', 'store_lng', 'pickup_lng', 'from_lng'])
      const lat = this.getCoordinateByKeys(orderSnapshot, ['merchant_lat', 'merchantLat', 'shop_lat', 'shopLat', 'store_lat', 'storeLat', 'pickup_lat', 'pickupLat', 'from_lat', 'fromLat'])
        || this.getCoordinateByKeys(merchant, ['merchant_lat', 'merchantLat', 'lat', 'latitude', 'map_lat'])
        || this.getCoordinateByKeys(address, ['merchant_lat', 'shop_lat', 'store_lat', 'pickup_lat', 'from_lat'])
      return { lng, lat }
    },
    getCachedRiderCoords() {
      try {
        const cached = getCachedRiderCoordsFromService()
        if (hasValidCoordsFromService(cached)) {
          return cached
        }
        const app = typeof getApp === 'function' ? getApp() : null
        const sample = app?.globalData?.latestRiderLocation
        const lng = this.getCoordinateByKeys(sample || {}, ['longitude', 'lng'])
        const lat = this.getCoordinateByKeys(sample || {}, ['latitude', 'lat'])
        if (this.hasValidCoords({ lng, lat })) {
          return { lng, lat }
        }
        const orderRider = this.order?.rider || {}
        const orderRiderLng = this.getCoordinateByKeys(orderRider, ['rider_longitude', 'longitude', 'lng'])
        const orderRiderLat = this.getCoordinateByKeys(orderRider, ['rider_latitude', 'latitude', 'lat'])
        if (this.hasValidCoords({ lng: orderRiderLng, lat: orderRiderLat })) {
          return { lng: orderRiderLng, lat: orderRiderLat }
        }
        const storedUser = getStoredUserInfo() || {}
        const storedLng = this.getCoordinateByKeys(storedUser, ['rider_longitude', 'longitude', 'lng'])
        const storedLat = this.getCoordinateByKeys(storedUser, ['rider_latitude', 'latitude', 'lat'])
        return { lng: storedLng, lat: storedLat }
      } catch (error) {
        return { lng: '', lat: '' }
      }
    },
    hasValidCoords(coords = {}) {
      return hasValidCoordsFromService(coords)
    },
    async requestNavigationLocation(type = 'gcj02', extraOptions = {}) {
      return requestNavigationLocationFromService(type, extraOptions)
    },
    async resolveNavigationStartCoords() {
      return resolveNavigationStartCoordsFromService(this.getCachedRiderCoords())
    },
    getCustomerCoords() {
      const address = this.parseAddress()
      const fallback = this.order || {}
      const lng = this.getCoordinateByKeys(fallback, ['customer_lng', 'delivery_longitude', 'longitude', 'delivery_lng', 'deliveryLng', 'user_lng', 'userLng', 'contact_lng', 'receiver_lng', 'to_lng', 'dest_lng', 'customerLng'])
        || this.getCoordinateByKeys(address, ['customer_lng', 'delivery_longitude', 'longitude', 'lng', 'delivery_lng', 'deliveryLng', 'user_lng', 'receiver_lng', 'to_lng', 'dest_lng', 'customerLng'])
      const lat = this.getCoordinateByKeys(fallback, ['customer_lat', 'delivery_latitude', 'latitude', 'delivery_lat', 'deliveryLat', 'user_lat', 'userLat', 'contact_lat', 'receiver_lat', 'to_lat', 'dest_lat', 'customerLat'])
        || this.getCoordinateByKeys(address, ['customer_lat', 'delivery_latitude', 'latitude', 'lat', 'delivery_lat', 'deliveryLat', 'user_lat', 'receiver_lat', 'to_lat', 'dest_lat', 'customerLat'])
      return { lng, lat }
    },
    async navigateToMap(payload) {
      if (this.navigationLaunching) {
        return
      }
      if (!this.ensureOrderOwnership('导航')) {
        return
      }
      if (!this.canAccessNavigation(this.order.status)) {
        uni.showToast({ title: '当前订单状态不可导航', icon: 'none' })
        return
      }
      const riderId = this.getRiderId()
      if (!riderId) {
        uni.showToast({ title: '当前骑手信息缺失，无法导航', icon: 'none' })
        return
      }
      const token = uni.getStorageSync('token') || ''
      const stage = payload && payload.stage === 'delivery' ? 'delivery' : 'pickup'
      const targetCoords = stage === 'delivery'
        ? { lng: payload?.customerLng, lat: payload?.customerLat }
        : { lng: payload?.merchantLng, lat: payload?.merchantLat }
      const missingTargets = []
      if (!this.hasValidCoords(targetCoords)) {
        missingTargets.push(stage === 'delivery' ? '用户' : '商家')
      }
      if (missingTargets.length) {
        console.warn('[order-detail] navigation coords missing', {
          stage,
          missingTargets,
          merchantLng: payload?.merchantLng || '',
          merchantLat: payload?.merchantLat || '',
          customerLng: payload?.customerLng || '',
          customerLat: payload?.customerLat || ''
        })
        uni.showToast({
          title: `${missingTargets.join('、')}坐标缺失`,
          icon: 'none'
        })
        return
      }
      this.navigationLaunching = true
      uni.showLoading({
        title: '正在获取定位',
        mask: true
      })
      const rider = await this.resolveNavigationStartCoords()
      if (!this.hasValidCoords(rider)) {
        this.navigationLaunching = false
        uni.hideLoading()
        uni.showToast({
          title: '定位超时，请打开定位后重试',
          icon: 'none'
        })
        return
      }
      const safeRiderLng = rider.lng !== undefined && rider.lng !== null && rider.lng !== '' ? String(rider.lng) : ''
      const safeRiderLat = rider.lat !== undefined && rider.lat !== null && rider.lat !== '' ? String(rider.lat) : ''
      const safeMerchantLng = payload && payload.merchantLng !== undefined && payload.merchantLng !== null && payload.merchantLng !== '' ? String(payload.merchantLng) : ''
      const safeMerchantLat = payload && payload.merchantLat !== undefined && payload.merchantLat !== null && payload.merchantLat !== '' ? String(payload.merchantLat) : ''
      const safeCustomerLng = payload && payload.customerLng !== undefined && payload.customerLng !== null && payload.customerLng !== '' ? String(payload.customerLng) : ''
      const safeCustomerLat = payload && payload.customerLat !== undefined && payload.customerLat !== null && payload.customerLat !== '' ? String(payload.customerLat) : ''
      uni.showLoading({
        title: '正在进入导航',
        mask: true
      })
      uni.navigateTo({
        url: `/pages/map/nav?riderId=${encodeURIComponent(riderId)}&token=${encodeURIComponent(token)}&stage=${encodeURIComponent(stage)}&riderLng=${encodeURIComponent(safeRiderLng)}&riderLat=${encodeURIComponent(safeRiderLat)}&merchantLng=${encodeURIComponent(safeMerchantLng)}&merchantLat=${encodeURIComponent(safeMerchantLat)}&customerLng=${encodeURIComponent(safeCustomerLng)}&customerLat=${encodeURIComponent(safeCustomerLat)}`,
        complete: () => {
          this.navigationLaunching = false
          uni.hideLoading()
        }
      })
    },
    goPickup() {
      const merchant = this.getPickupMerchantCoords()
      const customer = this.getCustomerCoords()
      this.navigateToMap({
        stage: 'pickup',
        merchantLng: merchant.lng,
        merchantLat: merchant.lat,
        customerLng: customer.lng,
        customerLat: customer.lat
      })
    },
    goDelivery() {
      const merchant = this.getMerchantCoords()
      const customer = this.getCustomerCoords()
      this.navigateToMap({
        stage: 'delivery',
        merchantLng: merchant.lng,
        merchantLat: merchant.lat,
        customerLng: customer.lng,
        customerLat: customer.lat
      })
    },
    callUser(phone) {
      if (phone) {
        uni.makePhoneCall({ phoneNumber: phone })
      }
    },
    formatCoordinate(coords = {}) {
      if (coords.lng === '' || coords.lat === '') {
        return '未提供坐标'
      }
      return `${coords.lng}, ${coords.lat}`
    },
    getErrorStatusCode(error) {
      return error?.statusCode
        ?? error?.status
        ?? error?.response?.status
        ?? error?.data?.statusCode
        ?? error?.data?.status
        ?? ''
    },
    getErrorMessage(error) {
      return error?.message
        ?? error?.msg
        ?? error?.data?.message
        ?? error?.data?.msg
        ?? error?.response?.data?.message
        ?? error?.response?.data?.msg
        ?? ''
    },
    copyGaodeSearchAssist() {
      const searchText = this.getGaodeSearchAssistText()
      if (!searchText) {
        uni.showToast({ title: '复制失败，请重试', icon: 'none' })
        return
      }
      const coordText = this.getGaodeSearchAssistCoordText()
      const copyText = coordText ? `${searchText}\n${coordText}` : searchText
      uni.setClipboardData({
        data: copyText,
        success: () => {
          uni.showToast({ title: '已复制到剪贴板', icon: 'success' })
        },
        fail: () => {
          uni.showToast({ title: '复制失败，请重试', icon: 'none' })
        }
      })
    },
    async handlePickup() {
      if (!this.ensureOrderOwnership('取餐')) {
        return
      }
      console.log('[order-detail] handlePickup before confirm', {
        requestOrderId: this.orderId,
        orderStatus: this.order?.status ?? '',
        canPickup: this.canPickup(this.order?.status)
      })
      if (!this.canPickup(this.order.status)) {
        uni.showToast({ title: '当前订单不可取餐', icon: 'none' })
        return
      }
      uni.showModal({
        title: '确认取餐',
        content: '确认已取餐并开始配送？',
        confirmText: '开始配送',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          if (!this.ensureOrderOwnership('取餐')) {
            return
          }
          try {
            await riderPickup(this.orderId)
            uni.showToast({ title: '已开始配送', icon: 'success' })
            await this.loadOrderDetail()
          } catch (e) {
            console.error('[order-detail] riderPickup failed', {
              httpStatus: this.getErrorStatusCode(e),
              message: this.getErrorMessage(e),
              data: e?.data ?? e?.response?.data ?? null
            })
            console.error('取餐失败', e)
          }
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
  padding: 20rpx;
}

.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}


.section-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #222;
  margin-bottom: 20rpx;
  display: block;
}

.scope-banner {
  margin-bottom: 20rpx;
  background: #f0f5ff;
  color: #1890ff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  font-weight: 500;
}

.scope-banner.town-banner {
  background: rgba(31, 111, 67, 0.12);
  color: #1f6f43;
}

.transfer-banner {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 20rpx;
  padding: 18rpx 20rpx;
  background: #fff7e6;
  border-radius: 12rpx;
}

.transfer-banner-tag {
  flex-shrink: 0;
  font-size: 28rpx;
  font-weight: 700;
  color: #8a5a00;
  background: #ffe7ba;
  border-radius: 8rpx;
  padding: 6rpx 12rpx;
}

.transfer-banner-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #8a5a00;
  line-height: 1.5;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.info-row:last-child {
  border-bottom: none;
}

.label {
  font-size: 30rpx;
  font-weight: 600;
  color: #666;
}

.value {
  font-size: 31rpx;
  font-weight: 700;
  color: #222;
  max-width: 60%;
}

.value.transfer-summary {
  white-space: pre-wrap;
  word-break: break-all;
  text-align: right;
}

.value.status {
  font-weight: 700;
}

.value.highlight {
  color: #FF6B35;
  font-weight: bold;
  font-size: 30rpx;
}

.gaode-search-text,
.gaode-coord-text {
  text-align: right;
  white-space: pre-wrap;
  word-break: break-all;
}

.gaode-copy-btn {
  margin-top: 20rpx;
  width: 100%;
  padding: 22rpx 24rpx;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: none;
  background: #f0f5ff;
  color: #1890ff;
}

.detail-inline-actions {
  display: flex;
  gap: 20rpx;
  margin: -4rpx 0 20rpx;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  padding: 20rpx;
  background-color: #fff;
  border-top: 1rpx solid #f0f0f0;
  gap: 20rpx;
}

.btn {
  flex: 1 1 calc(50% - 10rpx);
  padding: 24rpx;
  font-size: 32rpx;
  font-weight: 700;
  border-radius: 12rpx;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
}

.btn-transfer {
  background: linear-gradient(135deg, #722ed1, #9254de);
  color: #fff;
}

.btn-revoke {
  background: linear-gradient(135deg, #faad14, #ffc53d);
  color: #fff;
}

.btn-success {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #fff;
}

.btn[disabled] {
  opacity: 0.55;
}

.btn-special {
  background: linear-gradient(135deg, #fa8c16, #ffb020);
  color: #fff;
}

.btn-full-width {
  flex-basis: 100%;
}

.delivery-distance-card {
  margin: -4rpx 0 20rpx;
  padding: 18rpx 22rpx;
  border-radius: 14rpx;
  background: #f6ffed;
}

.delivery-distance-text {
  font-size: 26rpx;
  line-height: 1.6;
  color: #2b8a3e;
}
</style>
