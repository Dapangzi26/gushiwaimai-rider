<template>
  <view class="container">
    <view class="summary-grid">
      <view class="summary-card">
        <text class="summary-value">{{ stats.totalOrders }}</text>
        <text class="summary-label">今日总订单</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">{{ stats.completedOrders }}</text>
        <text class="summary-label">今日已完成</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">¥{{ incomeCardValue }}</text>
        <text class="summary-label">{{ incomeCardLabel }}</text>
        <text v-if="showSettledIncomeHint" class="summary-subvalue">已结算 ¥{{ stats.todaySettledIncome }}</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">{{ stats.deliveringOrders }}</text>
        <text class="summary-label">当前配送中</text>
      </view>
    </view>

    <view class="panel">
      <view class="panel-header">
        <text class="panel-title">今日订单明细</text>
        <text class="panel-subtitle">顶部统计以后端 today-summary 为准，明细按下单时间展示</text>
      </view>

      <view v-if="todayOrders.length" class="order-list">
        <view
          v-for="order in todayOrders"
          :key="order.id"
          class="order-card"
          @click="goOrderDetail(order)"
        >
          <view class="order-top">
            <view class="order-top-left">
              <text class="order-no">{{ order.order_no || ('订单 #' + order.id) }}</text>
              <text class="order-time">{{ formatTime(order.created_at) }}</text>
            </view>
            <text class="order-status" :style="{ color: getStatusColor(order.status) }">
              {{ getStatusText(order.status) }}
            </text>
          </view>

          <view class="order-row">
            <text class="row-label">商家</text>
            <text class="row-value">{{ order.merchant?.name || '未知商家' }}</text>
          </view>

          <view class="order-row">
            <text class="row-label">地址</text>
            <text class="row-value address-text">{{ getBriefAddress(order) }}</text>
          </view>

          <view class="order-bottom">
            <text class="income-text">配送费 ¥{{ formatFee(order.rider_fee) }}</text>
            <text class="detail-link">查看详情</text>
          </view>
        </view>
      </view>

      <view v-else class="empty-state">
        <text class="empty-icon">📊</text>
        <text class="empty-text">暂无今日明细订单</text>
        <text class="empty-tip">明细按下单时间展示，顶部统计仍以后端 today-summary 为准</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getRiderOrders, getRiderTodaySummary } from '@/api/order.js'
import { ORDER_STATUS } from '@/config/index.js'
import { formatTime } from '@/utils/index.js'

function toDateText(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default {
  data() {
    return {
      loading: false,
      allOrders: [],
      todayOrders: [],
      stats: {
        totalOrders: 0,
        completedOrders: 0,
        todayRiderIncome: '0.00',
        todaySettledIncome: '0.00',
        deliveringOrders: 0,
        hasTodayRiderIncome: false,
        hasTodaySettledIncome: false
      }
    }
  },
  computed: {
    incomeCardValue() {
      if (this.stats.hasTodayRiderIncome) {
        return this.stats.todayRiderIncome
      }
      if (this.stats.hasTodaySettledIncome) {
        return this.stats.todaySettledIncome
      }
      return '0.00'
    },
    incomeCardLabel() {
      if (this.stats.hasTodayRiderIncome) {
        return '今日配送收入'
      }
      if (this.stats.hasTodaySettledIncome) {
        return '今日已结算收入'
      }
      return '今日配送收入'
    },
    showSettledIncomeHint() {
      return this.stats.hasTodayRiderIncome && this.stats.hasTodaySettledIncome
    }
  },
  onLoad() {
    this.loadTodayOrders()
  },
  onPullDownRefresh() {
    this.loadTodayOrders()
  },
  methods: {
    formatTime,
    async loadTodayOrders() {
      this.loading = true
      try {
        await Promise.all([
          this.loadTodaySummary(),
          this.loadTodayOrderList()
        ])
      } catch (error) {
        console.error('加载今日订单失败', error)
        this.allOrders = []
        this.todayOrders = []
        this.resetStats()
      } finally {
        this.loading = false
        uni.stopPullDownRefresh()
      }
    },
    resetStats() {
      this.stats = {
        totalOrders: 0,
        completedOrders: 0,
        todayRiderIncome: '0.00',
        todaySettledIncome: '0.00',
        deliveringOrders: 0,
        hasTodayRiderIncome: false,
        hasTodaySettledIncome: false
      }
    },
    async loadTodaySummary() {
      const res = await getRiderTodaySummary()
      const summary = res?.data || {}
      const rawTodayRiderIncome = summary.today_rider_income ?? summary.todayRiderIncome
      const rawTodaySettledIncome = summary.today_settled_income ?? summary.todaySettledIncome
      this.stats.totalOrders = Number(
        summary.today_total_orders
        ?? summary.total_orders
        ?? summary.todayTotalOrders
        ?? 0
      )
      this.stats.completedOrders = Number(
        summary.today_completed_orders
        ?? summary.completed_orders
        ?? summary.todayCompletedOrders
        ?? 0
      )
      this.stats.hasTodayRiderIncome = rawTodayRiderIncome !== undefined && rawTodayRiderIncome !== null && rawTodayRiderIncome !== ''
      this.stats.hasTodaySettledIncome = rawTodaySettledIncome !== undefined && rawTodaySettledIncome !== null && rawTodaySettledIncome !== ''
      this.stats.todayRiderIncome = (parseFloat(rawTodayRiderIncome ?? 0) || 0).toFixed(2)
      this.stats.todaySettledIncome = (parseFloat(rawTodaySettledIncome ?? 0) || 0).toFixed(2)
      this.stats.deliveringOrders = Number(
        summary.today_delivering_orders
        ?? summary.delivering_orders
        ?? summary.todayDeliveringOrders
        ?? 0
      )
    },
    async loadTodayOrderList() {
      const res = await getRiderOrders()
      this.allOrders = Array.isArray(res?.data) ? res.data : []
      const today = toDateText(new Date())
      const todayFilteredOrders = this.allOrders.filter(order => {
        const createdToday = toDateText(order.created_at) === today
        const updatedToday = toDateText(order.updated_at || order.settled_at || order.completed_at) === today
        return createdToday || updatedToday
      })

      this.todayOrders = [...todayFilteredOrders].sort((a, b) => {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      })
    },
    getStatusText(status) {
      return ORDER_STATUS[status]?.text || '未知状态'
    },
    getStatusColor(status) {
      return ORDER_STATUS[status]?.color || '#999999'
    },
    formatFee(value) {
      return (parseFloat(value) || 0).toFixed(2)
    },
    getBriefAddress(order = {}) {
      try {
        const addr = typeof order.delivery_address === 'string'
          ? JSON.parse(order.delivery_address)
          : order.delivery_address
        return addr?.detail || addr?.address || `${addr?.district || ''}${addr?.street || ''}` || order.address || '未知地址'
      } catch (error) {
        return order.address || '未知地址'
      }
    },
    goOrderDetail(order) {
      uni.navigateTo({
        url: `/pages/orders/detail?id=${order.id}`
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.summary-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 28rpx 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.summary-value {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #1890ff;
}

.summary-label {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #666666;
}

.summary-subvalue {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #999999;
}

.panel {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.panel-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
}

.panel-subtitle {
  font-size: 22rpx;
  color: #999999;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.order-card {
  background: #fafafa;
  border-radius: 16rpx;
  padding: 20rpx;
}

.order-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.order-top-left {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.order-no {
  font-size: 26rpx;
  font-weight: 600;
  color: #333333;
}

.order-time {
  font-size: 22rpx;
  color: #999999;
}

.order-status {
  font-size: 24rpx;
  font-weight: 600;
}

.order-row {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.row-label {
  width: 72rpx;
  font-size: 24rpx;
  color: #999999;
}

.row-value {
  flex: 1;
  font-size: 24rpx;
  color: #333333;
}

.address-text {
  line-height: 1.5;
}

.order-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20rpx;
}

.income-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #ff6b35;
}

.detail-link {
  font-size: 24rpx;
  color: #1890ff;
}

.empty-state {
  padding: 120rpx 0;
  text-align: center;
}

.empty-icon {
  display: block;
  font-size: 88rpx;
}

.empty-text {
  display: block;
  margin-top: 20rpx;
  font-size: 30rpx;
  color: #666666;
}

.empty-tip {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #aaaaaa;
}
</style>
