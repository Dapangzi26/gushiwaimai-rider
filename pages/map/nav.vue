<template>
  <view class="page">
    <web-view v-if="overviewUrl" class="overview-webview" :src="overviewUrl" @message="handleOverviewMessage"></web-view>
    <view v-else class="error-wrap">
      <text class="error-title">腾讯地图总览页未准备好</text>
      <text class="error-desc">请先检查 `key(地图密钥)` 配置和本地 `html(静态页面)` 路径。</text>
    </view>

    <view class="overlay-card">
      <text class="title">{{ pageTitle }}</text>
      <text class="desc">{{ statusText }}</text>
      <view class="chip-row">
        <text class="chip chip-primary">当前选中 {{ currentOrderLabel }}</text>
        <text class="chip">阶段 {{ stageLabel }}</text>
        <text class="chip">活跃订单 {{ activeOrderCount }} 个</text>
      </view>
      <text class="hint">{{ hintText }}</text>
    </view>

    <view class="bottom-bar">
      <view class="bottom-tools-row">
        <button class="btn btn-ghost btn-tool" @click="goBack">返回订单</button>
        <button class="btn btn-ghost btn-tool" :disabled="refreshing" @click="refreshOverview">
          刷新总览
        </button>
      </view>
      <button
        v-if="showStartNavigationButton"
        class="btn btn-primary btn-full"
        :disabled="launching"
        @click="startNavigation"
      >
        {{ launching ? '正在打开导航...' : startButtonText }}
      </button>
      <view v-else class="selection-placeholder">
        <text class="selection-placeholder-text">点红色或紫色用户点位后，底部白卡片里会出现操作按钮</text>
      </view>
    </view>
  </view>
</template>

<script>
// 这个页面现在专门做“骑手多订单地图总览”。
// 入口页只告诉这里“当前是从哪一单点进来的”，真正的活跃订单统一由这里拉。
// 这样不管骑手从哪一单点进去，地图看到的都会是“当前手里全部活跃订单”的用户点位。
import { startTencentNavigation } from '@/sdk/tencent-nav/bridge/index.js'
import { confirmDelivery, getRiderOrders } from '@/api/order.js'
import { canRiderCallConfirmDeliveryApi } from '@/config/index.js'
import { getToken, getUserInfo as getStoredUserInfo } from '@/utils/storage.js'
import {
  getCachedRiderCoords,
  hasValidCoords,
  requestNavigationLocation
} from '@/utils/navigation-service.js'
import { REMINDER_CENTER_EVENTS } from '@/utils/reminder-center.js'
import { BASE_URL } from '@/config/index.js'
import { TENCENT_MAP_WEB_KEY } from '@/utils/map-keys.js'
import { resolveDeliveryProfile } from '@/utils/delivery-identity.js'
import { wgs84ToGcj02 } from '@/utils/coord-transform.js'
import {
  buildRiderOverviewOrders,
  extractRiderOrderList,
  findOverviewOrder,
  safeText as safeOverviewText
} from '@/utils/map-overview.js'

const OVERVIEW_BRIDGE_STORAGE_KEY = '__rider_overview_bridge_message__'
const OVERVIEW_HOST_PAYLOAD_STORAGE_KEY = '__rider_overview_host_payload__'

function safeText(value) {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

function normalizeTencentTargetCoords(lng, lat, coordType = 'wgs84') {
  const parsedLng = Number(lng)
  const parsedLat = Number(lat)
  if (!hasValidCoords({ lng: parsedLng, lat: parsedLat })) {
    return { lng: '', lat: '' }
  }
  // 订单里的商家 / 用户坐标现在统一按 WGS84 进业务层。
  // 但腾讯地图 JS 和腾讯原生导航都更适合直接吃 GCJ02，
  // 所以这里只在真正调用腾讯能力前做一次显式转换，别再让各页面自己猜。
  if (safeText(coordType).toLowerCase() === 'gcj02') {
    return { lng: parsedLng, lat: parsedLat }
  }
  const converted = wgs84ToGcj02(parsedLng, parsedLat)
  if (!hasValidCoords(converted)) {
    return { lng: '', lat: '' }
  }
  return converted
}

function getAppPlusBridge() {
  // uni-app 页面脚本里不能假设一定有 window。
  // 真机 App 里更稳的取法是优先拿全局 plus，没有再退回 window.plus。
  if (typeof plus !== 'undefined') {
    return plus
  }
  if (typeof window !== 'undefined' && window.plus) {
    return window.plus
  }
  return null
}

function encodeQueryValue(value) {
  return encodeURIComponent(value == null ? '' : String(value))
}

export default {
  onBackPress(options = {}) {
    // 这里拦的是手机系统返回键。
    // 地图页的上一个页面通常是订单详情页，所以这里要明确把系统返回收过来，
    // 统一走 goBack，避免 web-view 或页面栈自己处理后，返回层级出现飘忽不定。
    if (options.from === 'navigateBack') {
      return false
    }
    this.goBack()
    return true
  },
  data() {
    return {
      stage: 'pickup',
      entryOrderId: '',
      orderId: '',
      orderNo: '',
      riderLng: '',
      riderLat: '',
      merchantLng: '',
      merchantLat: '',
      customerLng: '',
      customerLat: '',
      currentMerchantName: '',
      currentPrivacyContactName: '',
      currentPrivacyContactPhone: '',
      currentGoodsSummaryList: [],
      overviewOrders: [],
      selectedOrderId: '',
      selectedOrderRecord: null,
      overviewUrl: '',
      refreshing: false,
      launching: false,
      confirmSubmitting: false,
      backingToOrders: false,
      hasManualSelection: false,
      statusText: '正在准备腾讯地图总览...',
      bridgePollTimer: null,
      lastBridgeToken: '',
      overviewReadyAt: 0
    }
  },
  computed: {
    stageLabel() {
      return this.stage === 'delivery' ? '去送货' : '去取餐'
    },
    pageTitle() {
      return this.stage === 'delivery' ? '腾讯配送总览' : '腾讯导航'
    },
    currentOrderLabel() {
      const orderNo = safeText((this.selectedOrder && this.selectedOrder.orderNo) || this.orderNo)
      return orderNo ? `尾号${orderNo.slice(-4)}` : '当前订单'
    },
    activeOrderCount() {
      return Array.isArray(this.overviewOrders) ? this.overviewOrders.length : 0
    },
    selectedOrder() {
      return this.selectedOrderRecord
        || findOverviewOrder(this.overviewOrders, this.selectedOrderId)
        || findOverviewOrder(this.overviewOrders, this.orderId)
        || null
    },
    showStartNavigationButton() {
      // 送货总览按你现在的新要求改成“先点点位，再点下方开始导航”。
      // 也就是说，只有骑手明确点过某个用户点位，底部才显示开始导航按钮。
      if (this.stage !== 'delivery') {
        return true
      }
      return this.hasManualSelection && !!this.selectedOrder
    },
    startButtonText() {
      if (this.stage !== 'delivery') {
        return '导航当前单'
      }
      return this.selectedOrder ? `开始导航 ${this.currentOrderLabel}` : '开始导航'
    },
    hintText() {
      if (this.stage !== 'delivery') {
        return '取餐阶段直接进入当前商家导航，这里不展示多用户送货总览。'
      }
      if (!this.activeOrderCount) {
        return '当前还没拉到配送中的订单，先点右下角刷新总览。'
      }
      if (this.hasManualSelection && this.selectedOrder) {
        return `当前已选中 ${this.currentOrderLabel}，底部白卡片里可以确认送达或开始导航。`
      }
      if (this.selectedOrder) {
        return '地图上只显示该骑手已取餐、配送中的订单，先点红色或紫色用户点位，再用底部白卡片操作。'
      }
      return '地图上只显示该骑手已取餐、配送中的订单，点任意红色或紫色用户点位后，底部白卡片里会出现操作按钮。'
    }
  },
  async onLoad(options = {}) {
    this.applyOverviewPayload(options)
    this.setNavigationLocationReportingActive(true)
    this.primeOverviewShell()
    this.initializeOverview()
    this.startOverviewBridgePolling()
  },
  onReady() {
    this.startOverviewBridgePolling()
  },
  onShow() {
    // 这个页面首次进入时，本身已经在 onLoad 里拉过一次总览了。
    // 如果这里再立刻 refreshOverview，就会出现“刚进地图页，同一个接口马上再打一遍”。
    // 所以这里只在页面已经稳定展示一小段时间之后，再把 onShow 当作“从外部导航返回”的刷新入口。
    if (this.stage === 'delivery') {
      if (Date.now() - this.overviewReadyAt < 1500) {
        return
      }
      this.refreshOverview()
    }
  },
  onUnload() {
    this.setNavigationLocationReportingActive(false)
    this.stopOverviewBridgePolling()
  },
  methods: {
    setNavigationLocationReportingActive(active = false) {
      // 地图总览页存活期间，前台会频繁读取骑手当前位置、点位和导航终点。
      // 这里显式通知 App 暂停后台 10 秒一次的位置上报，避免两套定位同时抢系统资源。
      try {
        const app = typeof getApp === 'function' ? getApp() : null
        const setter = app?.globalData?.setNavigationLocationReportingActive
        if (typeof setter === 'function') {
          setter(!!active)
        }
      } catch (error) {}
    },
    startOverviewBridgePolling() {
      // 远程 H5 总览页在真机里未必总能稳定走 web-view 的标准消息桥。
      // 这里保留一条共享存储兜底，只负责把 H5 写进来的“选中订单 / 开始导航”命令捞回来。
      if (this.bridgePollTimer) {
        return
      }
      this.bridgePollTimer = setInterval(() => {
        this.consumeOverviewBridgeStorage()
      }, 280)
      this.consumeOverviewBridgeStorage()
    },
    stopOverviewBridgePolling() {
      if (!this.bridgePollTimer) {
        return
      }
      clearInterval(this.bridgePollTimer)
      this.bridgePollTimer = null
    },
    consumeOverviewBridgeStorage() {
      try {
        const appPlus = getAppPlusBridge()
        if (!appPlus || !appPlus.storage) {
          return
        }
        const rawText = appPlus.storage.getItem(OVERVIEW_BRIDGE_STORAGE_KEY)
        if (!rawText) {
          return
        }
        const message = JSON.parse(rawText)
        const token = safeOverviewText(message && message.token)
        if (!token || token === this.lastBridgeToken) {
          return
        }
        this.lastBridgeToken = token
        appPlus.storage.removeItem(OVERVIEW_BRIDGE_STORAGE_KEY)
        this.processOverviewMessage(message)
      } catch (error) {}
    },
    applyOverviewPayload(options = {}) {
      let payload = {}
      try {
        payload = options.payload ? JSON.parse(decodeURIComponent(options.payload)) : {}
      } catch (error) {
        payload = {}
      }
      this.stage = payload.stage === 'delivery' ? 'delivery' : 'pickup'
      // 这里单独记住“最开始是从哪一单的详情页点进来的”。
      // 后面地图里切换别的用户点位时，this.orderId 会跟着当前选中订单变化，
      // 但手动点返回时，用户要回到的仍然是入口那张详情页，不是后来切到的别的单。
      this.entryOrderId = safeText(payload.orderId)
      this.orderId = safeText(payload.orderId)
      this.orderNo = safeText(payload.orderNo)
      this.riderLng = safeText(payload.riderLng)
      this.riderLat = safeText(payload.riderLat)
      this.merchantLng = safeText(payload.merchantLng)
      this.merchantLat = safeText(payload.merchantLat)
      this.customerLng = safeText(payload.customerLng)
      this.customerLat = safeText(payload.customerLat)
      this.currentMerchantName = safeText(payload.merchantName)
      this.currentPrivacyContactName = safeText(payload.privacyContactName)
      this.currentPrivacyContactPhone = safeText(payload.privacyContactPhone)
      this.currentGoodsSummaryList = Array.isArray(payload.goodsSummaryList)
        ? payload.goodsSummaryList
          .map(item => safeText(item))
          .filter(Boolean)
        : []
      this.selectedOrderId = safeText(payload.orderId)
      // 这里故意把“手动选择状态”默认关掉。
      // 页面初次进来虽然可能有默认订单，但不算骑手真的点过地图，所以先不显示“开始导航”按钮。
      this.hasManualSelection = false
    },
    getDeliveryListStatusKey() {
      // 地图总览页现在按“配送中总作业页”处理。
      // 所以不管是手动返回，还是从原生导航拉起成功后退出这里，
      // 都应该统一落回“配送中”列表，而不是回最早点进来的订单详情页。
      const user = getStoredUserInfo() || {}
      const profile = resolveDeliveryProfile(user)
      if (profile?.isMerchantSelfDelivery) {
        return 'merchant_delivery_delivering'
      }
      if (profile?.isTownScope || profile?.isTownStationmaster) {
        return 'town_delivering'
      }
      if (profile?.useSimplifiedTabs) {
        return 'county_delivering'
      }
      return '5'
    },
    buildDeliveringListUrl() {
      const status = safeText(this.getDeliveryListStatusKey())
      return status
        ? `/pages/orders/index?status=${encodeURIComponent(status)}`
        : '/pages/orders/index'
    },
    async initializeOverview() {
      try {
        const rider = await this.resolveRiderPosition()
        if (hasValidCoords(rider)) {
          this.riderLng = String(rider.lng)
          this.riderLat = String(rider.lat)
        }
      } catch (error) {}
      await this.loadOverviewOrders()
      this.buildOverviewUrl()
      this.overviewReadyAt = Date.now()
    },
    primeOverviewShell() {
      // 地图总览页首屏先用入口带进来的当前单坐标秒开，不等后台订单接口和定位都跑完。
      // 真机上“点去送货后要等 2-3 秒才看到地图”的主要体感，往往就卡在这里。
      this.overviewOrders = this.applyOverviewOrderFallback([], [])
      this.syncSelectionAfterLoad()
      this.updateStatusText()
      this.buildOverviewUrl()
      this.overviewReadyAt = Date.now()
    },
    async loadOverviewOrders() {
      const user = getStoredUserInfo() || {}
      try {
        const res = await getRiderOrders({}, { silent: true })
        const list = extractRiderOrderList(res)
        const overviewOrders = buildRiderOverviewOrders(list, {
          currentOrderId: this.orderId,
          user,
          stage: this.stage
        })
        this.overviewOrders = this.applyOverviewOrderFallback(overviewOrders, list)
        this.syncSelectionAfterLoad()
        this.updateStatusText()
      } catch (error) {
        console.error('加载骑手地图总览订单失败', error)
        // 接口偶发失败时，先不要让“配送中总作业页”直接变成整页空白。
        // 这里只要入口带进来的当前单坐标还在，就先拿当前单兜底，
        // 至少保证骑手还能先看到一张可用地图，再决定后续操作。
        this.overviewOrders = this.applyOverviewOrderFallback([], [])
        this.syncSelectionAfterLoad()
        this.updateStatusText(error?.message || '活跃订单加载失败')
      }
    },
    buildCurrentOrderFallbackRecord() {
      // 这个兜底对象专门解决一种真机场景：
      // 订单详情页明明还能点“去送货”，但总览页重新拉配送中列表时偶发拿到空结果，
      // 如果这里不兜底，骑手就会看到“活跃订单 0 个”的空白页，当前单也没法继续送。
      const fallbackOrder = {
        id: safeText(this.orderId),
        orderNo: safeText(this.orderNo),
        label: '',
        status: this.stage === 'delivery' ? 5 : 4,
        statusText: this.stage === 'delivery' ? '配送中' : '待取餐',
        merchantName: safeText(this.currentMerchantName),
        privacyContactName: safeText(this.currentPrivacyContactName),
        privacyContactPhone: safeText(this.currentPrivacyContactPhone),
        goodsSummaryList: Array.isArray(this.currentGoodsSummaryList)
          ? this.currentGoodsSummaryList
          : [],
        merchantLng: safeText(this.merchantLng),
        merchantLat: safeText(this.merchantLat),
        customerLng: safeText(this.customerLng),
        customerLat: safeText(this.customerLat),
        isCurrent: true
      }
      if (!fallbackOrder.id) {
        return null
      }
      const targetCoords = this.stage === 'delivery'
        ? { lng: fallbackOrder.customerLng, lat: fallbackOrder.customerLat }
        : { lng: fallbackOrder.merchantLng, lat: fallbackOrder.merchantLat }
      if (!hasValidCoords(targetCoords)) {
        console.warn('[map-nav] 当前单兜底失败：入口坐标无效', {
          stage: this.stage,
          orderId: fallbackOrder.id,
          orderNo: fallbackOrder.orderNo,
          merchantLng: fallbackOrder.merchantLng,
          merchantLat: fallbackOrder.merchantLat,
          customerLng: fallbackOrder.customerLng,
          customerLat: fallbackOrder.customerLat
        })
        return null
      }
      fallbackOrder.label = fallbackOrder.orderNo ? `尾号${fallbackOrder.orderNo.slice(-4)}` : '当前订单'
      return fallbackOrder
    },
    applyOverviewOrderFallback(overviewOrders = [], rawOrderList = []) {
      if (Array.isArray(overviewOrders) && overviewOrders.length > 0) {
        console.log('[map-nav] 总览订单加载完成', {
          stage: this.stage,
          currentOrderId: this.orderId,
          rawOrderCount: Array.isArray(rawOrderList) ? rawOrderList.length : 0,
          overviewOrderCount: overviewOrders.length,
          statuses: Array.isArray(rawOrderList)
            ? rawOrderList.map(item => Number(item?.status || 0))
            : []
        })
        return overviewOrders
      }
      const fallbackOrder = this.buildCurrentOrderFallbackRecord()
      if (!fallbackOrder) {
        console.warn('[map-nav] 总览订单为空，且当前单无法兜底', {
          stage: this.stage,
          currentOrderId: this.orderId,
          currentOrderNo: this.orderNo,
          rawOrderCount: Array.isArray(rawOrderList) ? rawOrderList.length : 0,
          statuses: Array.isArray(rawOrderList)
            ? rawOrderList.map(item => Number(item?.status || 0))
            : []
        })
        return []
      }
      console.warn('[map-nav] 总览订单为空，已回退到当前单兜底显示', {
        stage: this.stage,
        currentOrderId: fallbackOrder.id,
        currentOrderNo: fallbackOrder.orderNo,
        rawOrderCount: Array.isArray(rawOrderList) ? rawOrderList.length : 0,
        statuses: Array.isArray(rawOrderList)
          ? rawOrderList.map(item => Number(item?.status || 0))
          : []
      })
      return [fallbackOrder]
    },
    syncSelectionAfterLoad() {
      // 刷新订单列表时，只用最新列表补齐文案等信息，不要把骑手刚刚手动点中的那组坐标覆盖掉。
      // 否则如果列表里存在串单、旧缓存、或同 id 但字段不一致，就会出现“点红色却拿成另一单坐标”的问题。
      if (this.selectedOrderRecord && this.selectedOrderId) {
        const latest = findOverviewOrder(this.overviewOrders, this.selectedOrderId)
        if (latest) {
          this.applySelectedOrder({
            ...latest,
            customerLng: this.selectedOrderRecord.customerLng || latest.customerLng,
            customerLat: this.selectedOrderRecord.customerLat || latest.customerLat,
            merchantLng: this.selectedOrderRecord.merchantLng || latest.merchantLng,
            merchantLat: this.selectedOrderRecord.merchantLat || latest.merchantLat
          })
          return
        }
      }
      const selected = findOverviewOrder(this.overviewOrders, this.selectedOrderId)
        || findOverviewOrder(this.overviewOrders, this.orderId)
        || this.overviewOrders[0]
        || null
      if (!selected) {
        return
      }
      this.applySelectedOrder(selected)
    },
    applySelectedOrder(order = {}) {
      // 这里单独存一份“当前确认要导航的订单快照”。
      // 原因是送货总览点位点击以后，真正该进导航的是“这次点击带回来的坐标”，
      // 不能再只靠本地订单列表按 id 回查，不然一旦列表字段串了，就会导航到别的点位。
      const normalizedOrder = {
        id: safeOverviewText(order.id),
        orderNo: safeOverviewText(order.orderNo),
        label: safeOverviewText(order.label),
        status: Number(order.status || 0),
        statusText: safeOverviewText(order.statusText),
        merchantName: safeOverviewText(order.merchantName),
        privacyContactName: safeOverviewText(order.privacyContactName),
        privacyContactPhone: safeOverviewText(order.privacyContactPhone),
        goodsSummaryList: Array.isArray(order.goodsSummaryList)
          ? order.goodsSummaryList.map(item => safeOverviewText(item)).filter(Boolean)
          : [],
        merchantLng: safeOverviewText(order.merchantLng),
        merchantLat: safeOverviewText(order.merchantLat),
        merchantCoordType: safeOverviewText(order.merchantCoordType || 'wgs84') || 'wgs84',
        customerLng: safeOverviewText(order.customerLng),
        customerLat: safeOverviewText(order.customerLat),
        customerCoordType: safeOverviewText(order.customerCoordType || 'wgs84') || 'wgs84',
        isCurrent: !!order.isCurrent
      }
      this.selectedOrderRecord = normalizedOrder
      this.selectedOrderId = normalizedOrder.id
      this.orderId = normalizedOrder.id
      this.orderNo = normalizedOrder.orderNo
      this.currentMerchantName = normalizedOrder.merchantName
      this.currentPrivacyContactName = normalizedOrder.privacyContactName
      this.currentPrivacyContactPhone = normalizedOrder.privacyContactPhone
      this.currentGoodsSummaryList = Array.isArray(normalizedOrder.goodsSummaryList)
        ? normalizedOrder.goodsSummaryList
        : []
      if (normalizedOrder.customerLng) {
        this.customerLng = normalizedOrder.customerLng
      }
      if (normalizedOrder.customerLat) {
        this.customerLat = normalizedOrder.customerLat
      }
      if (normalizedOrder.merchantLng) {
        this.merchantLng = normalizedOrder.merchantLng
      }
      if (normalizedOrder.merchantLat) {
        this.merchantLat = normalizedOrder.merchantLat
      }
    },
    buildSelectedOrderFromPayload(payload = {}) {
      const fallbackOrder = this.buildFallbackSelectedOrder(payload)
      if (!fallbackOrder) {
        return null
      }
      const latestOrder = findOverviewOrder(this.overviewOrders, payload.orderId)
      // 点位点击时，优先信任 H5 当前点位带回来的坐标；
      // 本地列表如果能匹配上，就只拿它补文案，不允许反过来把坐标覆盖掉。
      return {
        ...(latestOrder || {}),
        ...fallbackOrder,
        customerLng: fallbackOrder.customerLng || safeOverviewText(latestOrder && latestOrder.customerLng),
        customerLat: fallbackOrder.customerLat || safeOverviewText(latestOrder && latestOrder.customerLat),
        merchantLng: fallbackOrder.merchantLng || safeOverviewText(latestOrder && latestOrder.merchantLng),
        merchantLat: fallbackOrder.merchantLat || safeOverviewText(latestOrder && latestOrder.merchantLat)
      }
    },
    updateStatusText(fallback = '') {
      if (fallback) {
        this.statusText = fallback
        return
      }
      if (!this.activeOrderCount) {
        this.statusText = this.stage === 'delivery'
          ? '当前没有可展示的配送中订单'
          : '当前没有可展示的取餐订单'
        return
      }
      if (this.stage === 'delivery' && this.hasManualSelection && this.selectedOrder) {
        this.statusText = `已选中 ${this.currentOrderLabel}，请点下方开始导航`
        return
      }
      if (this.selectedOrder) {
        this.statusText = this.stage === 'delivery'
          ? `当前共 ${this.activeOrderCount} 个配送中订单，请先点地图上的用户点位`
          : `当前共 ${this.activeOrderCount} 个可导航订单，地图已默认选中 ${this.currentOrderLabel}`
        return
      }
      this.statusText = this.stage === 'delivery'
        ? `当前共 ${this.activeOrderCount} 个配送中订单，请先点地图上的用户点位`
        : `当前共 ${this.activeOrderCount} 个可导航订单，请先点地图上的点位`
    },
    buildOverviewPayload() {
      return {
        stage: this.stage,
        orderId: this.orderId,
        orderNo: this.orderNo,
        riderLng: this.riderLng,
        riderLat: this.riderLat,
        riderCoordType: 'gcj02',
        merchantLng: this.merchantLng,
        merchantLat: this.merchantLat,
        merchantCoordType: 'wgs84',
        customerLng: this.customerLng,
        customerLat: this.customerLat,
        customerCoordType: 'wgs84',
        selectedOrderId: this.selectedOrderId || this.orderId,
        orders: this.overviewOrders
      }
    },
    pushOverviewPayloadToEmbeddedPage() {
      // 地图页第一次进来以后，后续刷新订单、刷新骑手定位、确认送达删单，
      // 都尽量不要再改 web-view 的 src。
      // 原因是每次改 src，真机里的 H5 都会新增一层内部历史，
      // 骑手按一次返回时，就会先退 H5 自己那层，再退页面，体感上像“要按两次返回”。
      try {
        const appPlus = getAppPlusBridge()
        if (!appPlus || !appPlus.storage) {
          return false
        }
        appPlus.storage.setItem(OVERVIEW_HOST_PAYLOAD_STORAGE_KEY, JSON.stringify({
          token: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          payload: this.buildOverviewPayload()
        }))
        return true
      } catch (error) {
        return false
      }
    },
    buildOverviewUrl(forceReload = false) {
      const mapKey = safeText(TENCENT_MAP_WEB_KEY)
      const remoteOverviewBaseUrl = `${safeText(BASE_URL).replace(/\/$/, '')}/rider-map-overview/index.html`
      if (!mapKey) {
        this.overviewUrl = ''
        return
      }
      if (!safeText(BASE_URL)) {
        this.overviewUrl = ''
        return
      }
      const payload = this.buildOverviewPayload()
      this.pushOverviewPayloadToEmbeddedPage()
      if (!forceReload && this.overviewUrl) {
        return
      }
      const query = [
        `key=${encodeQueryValue(mapKey)}`,
        `payload=${encodeQueryValue(JSON.stringify(payload))}`
      ]
      // 这里必须走 http 页面，不能再走本地 file:// 静态页。
      // 腾讯 JS 地图明确不支持 file 协议，所以总览页统一挂到后端静态目录。
      this.overviewUrl = `${remoteOverviewBaseUrl}?${query.join('&')}`
    },
    async refreshOverview() {
      if (this.refreshing) {
        return
      }
      this.refreshing = true
      try {
        const rider = await this.resolveRiderPosition()
        if (hasValidCoords(rider)) {
          this.riderLng = String(rider.lng)
          this.riderLat = String(rider.lat)
        }
        await this.loadOverviewOrders()
        this.buildOverviewUrl()
      } catch (error) {
        uni.showToast({
          title: error?.message || '刷新总览失败',
          icon: 'none'
        })
      } finally {
        this.refreshing = false
      }
    },
    notifyOrderRefresh(orderId = '') {
      // 送达成功后，不只地图要刷新，订单列表和工作台也要一起刷新。
      // 这里复用项目里已经在用的全局事件，避免总览页改完了，别的页还停留在旧状态。
      uni.$emit(REMINDER_CENTER_EVENTS.orderRefresh, {
        source: 'map-nav-confirm-delivery',
        orderId: safeText(orderId)
      })
    },
    clearConfirmedSelection(confirmedOrderId = '') {
      const normalizedId = safeText(confirmedOrderId)
      if (!normalizedId) {
        return
      }
      if (safeText(this.selectedOrderId) === normalizedId || safeText(this.orderId) === normalizedId) {
        // 当前选中的单子既然已经送达，就不要再自动拿下一单顶上来继续显示操作按钮。
        // 虽然地图页现在按“总作业页”处理，但这里仍然要求骑手重新点下一单，
        // 避免刚送完订单 A，底部按钮又突然切成订单 B，造成误操作。
        this.selectedOrderId = ''
        this.selectedOrderRecord = null
        this.orderId = ''
        this.orderNo = ''
        this.hasManualSelection = false
      }
    },
    async submitConfirmDeliveryForOrder(targetOrder = {}) {
      if (this.confirmSubmitting) {
        return
      }
      const normalizedOrder = targetOrder && typeof targetOrder === 'object' ? targetOrder : {}
      const confirmedOrderId = safeText(normalizedOrder.id || this.orderId)
      if (!confirmedOrderId) {
        uni.showToast({
          title: '请先点一个用户坐标',
          icon: 'none'
        })
        return
      }
      if (!canRiderCallConfirmDeliveryApi(normalizedOrder.status)) {
        uni.showToast({
          title: '订单未处于配送中，暂不能确认送达',
          icon: 'none'
        })
        return
      }
      this.confirmSubmitting = true
      try {
        await confirmDelivery(confirmedOrderId)
        this.clearConfirmedSelection(confirmedOrderId)
        await this.loadOverviewOrders()
        this.notifyOrderRefresh(confirmedOrderId)
        uni.showToast({
          title: '已确认送达',
          icon: 'success'
        })
      } catch (error) {
        console.error('总览页确认送达失败', error)
        uni.showToast({
          title: error?.message || '确认送达失败',
          icon: 'none'
        })
      } finally {
        this.confirmSubmitting = false
      }
    },
    async resolveRiderPosition() {
      const existing = {
        lng: Number(this.riderLng),
        lat: Number(this.riderLat)
      }
      if (hasValidCoords(existing)) {
        return existing
      }
      const cached = getCachedRiderCoords()
      if (hasValidCoords(cached)) {
        return cached
      }
      const gcj02Location = await requestNavigationLocation('gcj02')
      if (hasValidCoords(gcj02Location)) {
        return gcj02Location
      }
      throw new Error('骑手定位未就绪')
    },
    normalizeMessageList(event) {
      const rawData = event && event.detail ? event.detail.data : null
      if (Array.isArray(rawData)) return rawData
      if (rawData && typeof rawData === 'object') return [rawData]
      return []
    },
    extractOverviewMessage(event) {
      const messageList = this.normalizeMessageList(event)
      for (const item of messageList) {
        // 这里多兜一层 data，是因为不同端的 web-view 回传结构偶尔会有一层包裹差异。
        // 只要最终拿到的是 orderSelected，就继续往下走，不让消息结构的小差异把派送链路卡死。
        const candidate = item && item.data && typeof item.data === 'object' ? item.data : item
        const normalized = candidate && candidate.data && typeof candidate.data === 'object' ? candidate.data : candidate
        if (normalized && normalized.action && normalized.payload) {
          return normalized
        }
      }
      return null
    },
    buildFallbackSelectedOrder(payload = {}) {
      const fallbackOrderId = safeOverviewText(payload.orderId)
      if (!fallbackOrderId) {
        return null
      }
      // 这个兜底对象只在“消息到了，但本地列表暂时没匹配上”时使用。
      // H5 点位本身已经带回了完整坐标，所以这里直接复用消息里的字段，避免明明点到了用户却因为列表没命中而不能直接派送。
      return {
        id: fallbackOrderId,
        orderNo: safeOverviewText(payload.orderNo),
        label: safeOverviewText(payload.label),
        status: Number(payload.status || 0),
        statusText: safeOverviewText(payload.statusText),
        merchantName: safeOverviewText(payload.merchantName),
        privacyContactName: safeOverviewText(payload.privacyContactName),
        privacyContactPhone: safeOverviewText(payload.privacyContactPhone),
        goodsSummaryList: Array.isArray(payload.goodsSummaryList)
          ? payload.goodsSummaryList.map(item => safeOverviewText(item)).filter(Boolean)
          : [],
        merchantLng: safeOverviewText(payload.merchantLng),
        merchantLat: safeOverviewText(payload.merchantLat),
        merchantCoordType: safeOverviewText(payload.merchantCoordType || 'wgs84') || 'wgs84',
        customerLng: safeOverviewText(payload.customerLng),
        customerLat: safeOverviewText(payload.customerLat),
        customerCoordType: safeOverviewText(payload.customerCoordType || 'wgs84') || 'wgs84',
        isCurrent: false
      }
    },
    processOverviewMessage(message) {
      const { action, payload } = message
      const selected = this.buildSelectedOrderFromPayload(payload)
        || findOverviewOrder(this.overviewOrders, payload.orderId)
        || this.buildFallbackSelectedOrder(payload)
      if (!selected) {
        return
      }
      this.applySelectedOrder(selected)
      // 地图点位点击只负责“选中目标订单”。
      // 真正进入原生导航，交给底部按钮再触发，这样骑手能先确认再进入真实导航界面。
      this.hasManualSelection = true
      this.updateStatusText()
      if (action === 'confirmSelectedDelivery' && this.stage === 'delivery') {
        this.submitConfirmDeliveryForOrder(selected)
        return
      }
      if (action === 'startSelectedNavigation' && this.stage === 'delivery') {
        this.startNavigation()
        return
      }
      // 如果以后还有取餐等别的阶段复用这个消息链路，
      // 这里仍然保留原来的“只切选中，不自动导航”兜底逻辑。
      if (this.stage !== 'delivery') {
        this.buildOverviewUrl()
      }
    },
    handleOverviewMessage(event) {
      const message = this.extractOverviewMessage(event)
      if (!message || !message.payload) {
        return
      }
      this.processOverviewMessage(message)
    },
    async startNavigation() {
      if (this.launching) {
        return
      }
      if (!this.selectedOrder) {
        uni.showToast({
          title: '请先点一个用户坐标',
          icon: 'none'
        })
        return
      }
      this.launching = true
      try {
        const riderPosition = await this.resolveRiderPosition()
        const rawMerchantLng = this.stage === 'delivery' ? '' : (this.selectedOrder.merchantLng || this.merchantLng)
        const rawMerchantLat = this.stage === 'delivery' ? '' : (this.selectedOrder.merchantLat || this.merchantLat)
        const rawCustomerLng = this.selectedOrder.customerLng || this.customerLng
        const rawCustomerLat = this.selectedOrder.customerLat || this.customerLat
        const merchantCoords = this.stage === 'delivery'
          ? { lng: '', lat: '' }
          : normalizeTencentTargetCoords(
            rawMerchantLng,
            rawMerchantLat,
            this.selectedOrder?.merchantCoordType || 'wgs84'
          )
        const customerCoords = normalizeTencentTargetCoords(
          rawCustomerLng,
          rawCustomerLat,
          this.selectedOrder?.customerCoordType || 'wgs84'
        )
        // 送货阶段这里只允许“骑手当前位置 -> 当前点中的用户”这一条直达链路。
        // 商家坐标在送货阶段已经没有用了，如果继续把商家坐标也传给原生层，
        // 插件内部就可能把它当成额外途经点或参与算路，出现“点红色却绕去别的点”的错觉。
        // 所以这里直接把商家坐标清空，只保留当前点击用户的终点坐标。
        const navigationParams = {
          stage: this.stage,
          orderId: this.selectedOrder.id || this.orderId,
          token: getToken(),
          baseUrl: BASE_URL,
          riderLng: riderPosition.lng,
          riderLat: riderPosition.lat,
          merchantLng: merchantCoords.lng,
          merchantLat: merchantCoords.lat,
          customerLng: customerCoords.lng,
          customerLat: customerCoords.lat
        }
        const result = await startTencentNavigation(navigationParams)
        if (result && result.success) {
          // 地图页现在按“配送中总作业页”处理，不再属于某一单的详情子页。
          // 所以原生导航已经成功拉起后，这里直接退出到“配送中列表”就行，
          // 骑手从导航返回 App 时，也应该直接看到配送中订单，而不是回某一单详情页。
          if (this.stage === 'delivery') {
            this.notifyOrderRefresh(this.selectedOrder && this.selectedOrder.id ? this.selectedOrder.id : this.orderId)
            this.goBack()
          }
          return
        }
        console.error('腾讯原生导航返回失败结果', result)
        uni.showToast({
          title: result?.message || '打开腾讯导航失败',
          icon: 'none'
        })
      } catch (error) {
        uni.showToast({
          title: error?.message || '打开腾讯导航失败',
          icon: 'none'
        })
      } finally {
        this.launching = false
      }
    },
    goBack() {
      if (this.backingToOrders) {
        return
      }
      this.backingToOrders = true
      const fallbackOrderId = safeText(this.entryOrderId || this.orderId)

      // 这里改回“原路返回”。
      // 用户是从订单详情页点进来的，手动点返回就应该先回那张详情页，
      // 不能直接把人丢回配送中列表，不然会把当前查看上下文打断。
      uni.navigateBack({
        delta: 1,
        fail: () => {
          // 少数真机上如果页面栈异常，navigateBack 可能退不回去。
          // 这时再兜底重开入口订单的详情页，保证结果仍然是“回详情”，不是回列表。
          if (fallbackOrderId) {
            uni.redirectTo({
              url: `/pages/orders/detail?id=${encodeURIComponent(fallbackOrderId)}`,
              complete: () => {
                this.backingToOrders = false
              }
            })
            return
          }
          uni.redirectTo({
            url: '/pages/orders/index',
            complete: () => {
              this.backingToOrders = false
            }
          })
        },
        success: () => {
          this.backingToOrders = false
        }
      })
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #0f172a;
  position: relative;
}

.overview-webview {
  width: 100%;
  height: 100vh;
}

.error-wrap {
  min-height: 100vh;
  padding: 140rpx 36rpx 220rpx;
  box-sizing: border-box;
  background: #0f172a;
}

.error-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #ffffff;
}

.error-desc {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.74);
}

.overlay-card {
  position: absolute;
  top: 24rpx;
  left: 24rpx;
  right: 24rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(15, 23, 42, 0.84);
  box-shadow: 0 12rpx 36rpx rgba(15, 23, 42, 0.2);
}

.title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
}

.desc {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.88);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.chip {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
  font-size: 22rpx;
  color: #ffffff;
}

.chip-primary {
  background: rgba(255, 106, 0, 0.24);
}

.hint {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.74);
}

.bottom-bar {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.bottom-tools-row {
  display: flex;
  gap: 12rpx;
}

.btn {
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 18rpx;
  font-size: 28rpx;
}

.btn-tool {
  flex: 1;
}

.btn-full {
  width: 100%;
}

.btn-ghost {
  background: rgba(15, 23, 42, 0.84);
  color: #ffffff;
}

.btn-primary {
  background: #1677ff;
  color: #ffffff;
}

.selection-placeholder {
  width: 100%;
  min-height: 84rpx;
  padding: 0 20rpx;
  border-radius: 18rpx;
  background: rgba(15, 23, 42, 0.84);
  display: flex;
  align-items: center;
  justify-content: center;
}

.selection-placeholder-text {
  font-size: 24rpx;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.74);
  text-align: center;
}
</style>
