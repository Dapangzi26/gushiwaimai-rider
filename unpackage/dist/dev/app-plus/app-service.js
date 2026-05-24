if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function requireNativePlugin(name) {
    return weex.requireModule(name);
  }
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  const BASE_URL = "http://121.43.190.218:3000";
  const ORDER_STATUS = {
    0: { text: "待支付", color: "#FF6B35" },
    // 顾客还没付款
    1: { text: "待接单", color: "#1890FF" },
    // 等待骑手接单
    2: { text: "已接单", color: "#FAAD14" },
    // 骑手已接单
    3: { text: "备货中", color: "#FAAD14" },
    // 商家正在准备
    4: { text: "备货完成", color: "#2F54EB" },
    // 商家已准备好
    5: { text: "配送中", color: "#52C41A" },
    // 骑手正在送餐
    6: { text: "已完成", color: "#52C41A" },
    // 订单已完成
    7: { text: "已取消", color: "#999" }
    // 订单已取消
  };
  function canRiderCallConfirmDeliveryApi(status) {
    return Number(status) === 5;
  }
  function canRiderOfferSpecialComplete(status) {
    const s = Number(status);
    return s >= 2 && s <= 4;
  }
  const STORAGE_KEY$1 = {
    TOKEN: "token",
    USER_INFO: "userInfo",
    RIDER_STATUS: "riderStatus"
  };
  function reportStorageDebug(hypothesisId, location2, msg, data = {}) {
    {
      return;
    }
  }
  function setToken(token) {
    uni.setStorageSync(STORAGE_KEY$1.TOKEN, token);
  }
  function getToken() {
    return uni.getStorageSync(STORAGE_KEY$1.TOKEN) || "";
  }
  function removeToken() {
    reportStorageDebug("F", "utils/storage.js:39", "removeToken called", {
      hasTokenBefore: !!(uni.getStorageSync(STORAGE_KEY$1.TOKEN) || "")
    });
    uni.removeStorageSync(STORAGE_KEY$1.TOKEN);
  }
  function setUserInfo(userInfo) {
    uni.setStorageSync(STORAGE_KEY$1.USER_INFO, JSON.stringify(userInfo));
  }
  function getUserInfo$1() {
    const str = uni.getStorageSync(STORAGE_KEY$1.USER_INFO);
    if (!str) {
      return null;
    }
    try {
      return JSON.parse(str);
    } catch (error) {
      reportStorageDebug("F", "utils/storage.js:55", "userInfo cache parse failed and will be removed", {
        rawLength: String(str || "").length
      });
      formatAppLog("warn", "at utils/storage.js:68", "userInfo 缓存解析失败，已清理本地缓存", error);
      uni.removeStorageSync(STORAGE_KEY$1.USER_INFO);
      return null;
    }
  }
  function removeUserInfo() {
    reportStorageDebug("F", "utils/storage.js:64", "removeUserInfo called", {
      hasUserInfoBefore: !!uni.getStorageSync(STORAGE_KEY$1.USER_INFO)
    });
    uni.removeStorageSync(STORAGE_KEY$1.USER_INFO);
  }
  function setRiderStatus(status) {
    uni.setStorageSync(STORAGE_KEY$1.RIDER_STATUS, status);
  }
  function getRiderStatus() {
    return uni.getStorageSync(STORAGE_KEY$1.RIDER_STATUS) || 0;
  }
  function removeRiderStatus() {
    reportStorageDebug("F", "utils/storage.js:78", "removeRiderStatus called", {
      hadStatusBefore: uni.getStorageSync(STORAGE_KEY$1.RIDER_STATUS)
    });
    uni.removeStorageSync(STORAGE_KEY$1.RIDER_STATUS);
  }
  function clearRiderSession() {
    reportStorageDebug("F", "utils/storage.js:84", "clearRiderSession called", {
      hasTokenBefore: !!(uni.getStorageSync(STORAGE_KEY$1.TOKEN) || ""),
      hasUserInfoBefore: !!uni.getStorageSync(STORAGE_KEY$1.USER_INFO),
      riderStatusBefore: uni.getStorageSync(STORAGE_KEY$1.RIDER_STATUS) || 0
    });
    removeToken();
    removeUserInfo();
    removeRiderStatus();
  }
  const API_BASE_URL = BASE_URL + "/api";
  let logoutInProgress = false;
  function reportRequestDebug(hypothesisId, location2, msg, data = {}) {
    {
      return;
    }
  }
  function normalizeRoute$2(route = "") {
    if (!route) {
      return "";
    }
    return route.startsWith("/") ? route : `/${route}`;
  }
  function getCurrentRoutePath$1() {
    try {
      const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
      const currentPage = Array.isArray(pages) && pages.length ? pages[pages.length - 1] : null;
      return normalizeRoute$2((currentPage == null ? void 0 : currentPage.route) || "");
    } catch (error) {
      return "";
    }
  }
  function isLoginRoute() {
    return getCurrentRoutePath$1() === "/pages/login/index";
  }
  function showToast(title) {
    const safeTitle = String(title || "").trim();
    if (!safeTitle) {
      return;
    }
    uni.showToast({ title: safeTitle, icon: "none", duration: 2e3 });
  }
  function notifySessionCleared() {
    var _a;
    if (typeof getApp !== "function") {
      return;
    }
    try {
      const app = getApp();
      const hook = (_a = app == null ? void 0 : app.globalData) == null ? void 0 : _a.clearRiderSessionState;
      if (typeof hook === "function") {
        hook();
      }
    } catch (error) {
    }
  }
  function logoutOnce({ toastMessage = "", suppressToast = false } = {}) {
    if (logoutInProgress) {
      reportRequestDebug("A", "utils/request.js:74", "logoutOnce skipped because guard is active", {
        toastMessage,
        suppressToast,
        currentRoute: getCurrentRoutePath$1(),
        hasToken: !!(uni.getStorageSync("token") || "")
      });
      return;
    }
    reportRequestDebug("A", "utils/request.js:84", "logoutOnce triggered", {
      toastMessage,
      suppressToast,
      currentRoute: getCurrentRoutePath$1(),
      hasToken: !!(uni.getStorageSync("token") || "")
    });
    logoutInProgress = true;
    clearRiderSession();
    notifySessionCleared();
    if (!suppressToast && !isLoginRoute()) {
      showToast(toastMessage || "登录已失效，请重新登录");
    }
    if (!isLoginRoute()) {
      setTimeout(() => {
        uni.reLaunch({ url: "/pages/login/index" });
      }, 0);
    }
    setTimeout(() => {
      logoutInProgress = false;
    }, 1500);
  }
  function resetLogoutGuard() {
    logoutInProgress = false;
  }
  function request({
    url: url2,
    method = "GET",
    data = {},
    timeout = 3e4,
    silent = false,
    background = false,
    suppressToast = false,
    suppressAuthToast = false,
    suppressErrorToast = false,
    skipAuthLogout = false
  }) {
    return new Promise((resolve, reject) => {
      const token = uni.getStorageSync("token") || "";
      const muteAllToast = silent || background || suppressToast;
      const muteAuthToast = muteAllToast || suppressAuthToast;
      const muteErrorToast = muteAllToast || suppressErrorToast;
      uni.request({
        url: API_BASE_URL + url2,
        method,
        data,
        timeout,
        header: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        success: (res) => {
          const responseData = res.data || {};
          const msg = (responseData == null ? void 0 : responseData.msg) || (responseData == null ? void 0 : responseData.message) || (responseData == null ? void 0 : responseData.detail) || "请求失败";
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
            return;
          }
          if (res.statusCode === 401) {
            reportRequestDebug("A", "utils/request.js:140", "request received 401", {
              url: url2,
              method,
              hasToken: !!token,
              skipAuthLogout,
              background,
              silent,
              message: msg,
              currentRoute: getCurrentRoutePath$1()
            });
            if (token && !skipAuthLogout) {
              logoutOnce({
                toastMessage: msg || "登录已失效，请重新登录",
                suppressToast: muteAuthToast
              });
              reject({ code: 401, msg: msg || "请先登录" });
              return;
            }
            if (!muteAuthToast) {
              showToast(msg || "请先登录");
            }
            reject({ code: 401, msg: msg || "请先登录" });
            return;
          }
          if (res.statusCode === 403) {
            reportRequestDebug("A", "utils/request.js:166", "request received 403", {
              url: url2,
              method,
              hasToken: !!token,
              background,
              silent,
              message: msg,
              currentRoute: getCurrentRoutePath$1()
            });
            if (!muteAuthToast) {
              showToast(msg || "没有权限访问");
            }
            reject({ code: 403, msg: msg || "没有权限访问" });
            return;
          }
          if (!muteErrorToast) {
            showToast(msg);
          }
          reject({ code: res.statusCode, msg });
        },
        fail: (err) => {
          formatAppLog("error", "at utils/request.js:208", "网络请求失败:", err);
          if (!muteErrorToast) {
            showToast("网络错误，请检查网络");
          }
          reject({ code: 500, msg: "网络错误" });
        }
      });
    });
  }
  function get(url2, data, options = {}) {
    return request({ url: url2, method: "GET", data, ...options });
  }
  function post(url2, data, options = {}) {
    return request({ url: url2, method: "POST", data, ...options });
  }
  function login(data) {
    return post("/auth/login", {
      ...data,
      login_scene: "rider_app"
    });
  }
  function registerRider(data) {
    return post("/auth/register/rider", data);
  }
  function resolveMerchantBinding(data) {
    return post("/auth/merchant-binding/resolve", data);
  }
  function getTownServiceAreas() {
    return get("/common/service-areas", { area_type: "town" });
  }
  const RIDER_DELIVERY_SCOPE_OPTIONS = [
    {
      label: "固始县城外卖司机",
      value: "county_rider",
      delivery_scope: "county_delivery",
      rider_kind: "rider"
    },
    {
      label: "乡镇外卖站长",
      value: "town_stationmaster",
      delivery_scope: "town_delivery",
      rider_kind: "stationmaster"
    },
    {
      label: "乡镇外卖骑手",
      value: "town_rider",
      delivery_scope: "town_delivery",
      rider_kind: "rider"
    },
    {
      label: "商家自配送",
      value: "merchant_self_delivery",
      delivery_scope: "merchant_self_delivery",
      rider_kind: ""
    }
  ];
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const LOGIN_PAGE_MODE_KEY = "rider_login_page_mode";
  const MERCHANT_DELIVERY_SCOPE = "merchant_self_delivery";
  const MERCHANT_DELIVERY_ROLE = "merchant_delivery";
  function reportLoginDebug(hypothesisId, location2, msg, data = {}) {
    {
      return;
    }
  }
  const _sfc_main$i = {
    onLoad() {
      reportLoginDebug("G", "pages/login/index.vue:onLoad", "login page loaded", {
        hasToken: !!uni.getStorageSync("token"),
        hasUserInfo: !!uni.getStorageSync("userInfo"),
        pageStackDepth: typeof getCurrentPages === "function" ? getCurrentPages().length : 0
      });
      this.restoreMode();
    },
    onShow() {
      reportLoginDebug("G", "pages/login/index.vue:onShow", "login page shown", {
        hasToken: !!uni.getStorageSync("token"),
        hasUserInfo: !!uni.getStorageSync("userInfo"),
        pageStackDepth: typeof getCurrentPages === "function" ? getCurrentPages().length : 0
      });
      this.restoreMode();
    },
    data() {
      return {
        form: {
          phone: "",
          password: "",
          confirmPassword: "",
          nickname: "",
          register_type: "",
          delivery_scope: "",
          rider_kind: "",
          town_code: "",
          merchant_binding_code: ""
        },
        deliveryScopeOptions: RIDER_DELIVERY_SCOPE_OPTIONS,
        townOptions: [],
        townOptionsLoaded: false,
        townOptionsLoading: false,
        townOptionsLoadFailed: false,
        matchedMerchant: null,
        merchantBindingResolvedCode: "",
        merchantBindingResolving: false,
        merchantBindingHint: "",
        merchantBindingHintType: "",
        isRegisterMode: false,
        loading: false
      };
    },
    computed: {
      pageTitle() {
        if (!this.isRegisterMode) {
          return "骑手登录";
        }
        if (this.form.register_type === "town_stationmaster") {
          return "乡镇站长注册";
        }
        if (this.form.register_type === "town_rider") {
          return "乡镇骑手注册";
        }
        return this.isMerchantSelfDelivery ? "商家自配送注册" : "骑手注册";
      },
      isTownDelivery() {
        return this.form.delivery_scope === "town_delivery";
      },
      isMerchantSelfDelivery() {
        return this.form.delivery_scope === MERCHANT_DELIVERY_SCOPE;
      },
      selectedTownIndex() {
        return Math.max(this.townOptions.findIndex((item) => item.value === this.form.town_code), 0);
      },
      selectedTownLabel() {
        const selectedTown = this.townOptions.find((item) => item.value === this.form.town_code);
        return selectedTown ? selectedTown.label : "";
      },
      townPickerText() {
        if (this.selectedTownLabel) {
          return this.selectedTownLabel;
        }
        if (this.townOptionsLoading) {
          return "乡镇列表加载中...";
        }
        if (this.townOptionsLoadFailed) {
          return "乡镇列表加载失败，请重试";
        }
        return "请选择所属乡镇";
      },
      bindingHintClass() {
        return this.merchantBindingHintType ? `binding-hint-${this.merchantBindingHintType}` : "";
      },
      hasResolvedMerchantBinding() {
        if (!this.isMerchantSelfDelivery) {
          return true;
        }
        const currentCode = this.normalizeMerchantBindingCode(this.form.merchant_binding_code);
        return !!currentCode && this.isValidMerchantBindingCode(currentCode) && !!this.matchedMerchant && this.merchantBindingResolvedCode === currentCode;
      },
      isSubmitDisabled() {
        if (this.loading) {
          return true;
        }
        if (!this.isRegisterMode) {
          return false;
        }
        if (!this.isMerchantSelfDelivery) {
          return false;
        }
        return !this.hasResolvedMerchantBinding || this.merchantBindingResolving;
      }
    },
    methods: {
      handleSubmitWithKeyboard() {
        uni.hideKeyboard({
          complete: () => {
            this.handleSubmit();
          }
        });
      },
      restoreMode() {
        this.isRegisterMode = uni.getStorageSync(LOGIN_PAGE_MODE_KEY) === "register";
      },
      setMode(isRegisterMode) {
        this.isRegisterMode = !!isRegisterMode;
        uni.setStorageSync(LOGIN_PAGE_MODE_KEY, this.isRegisterMode ? "register" : "login");
      },
      getAuditPendingLoginMessage(error) {
        const msg = String((error == null ? void 0 : error.msg) || (error == null ? void 0 : error.message) || "").trim();
        if (!msg) {
          return "";
        }
        if (msg.includes("禁用") || msg.includes("停用") || msg.includes("审核") || msg.includes("未通过") || msg.includes("未启用")) {
          return "账号正在审核中，审核通过后才可登录接单";
        }
        return "";
      },
      toggleMode() {
        this.setMode(!this.isRegisterMode);
        this.form.confirmPassword = "";
        this.form.nickname = "";
        this.form.register_type = "";
        this.form.delivery_scope = "";
        this.form.rider_kind = "";
        this.form.town_code = "";
        this.resetMerchantBindingState();
      },
      resetRegisterForm() {
        this.form.password = "";
        this.form.confirmPassword = "";
        this.form.nickname = "";
        this.form.register_type = "";
        this.form.delivery_scope = "";
        this.form.rider_kind = "";
        this.form.town_code = "";
        this.form.merchant_binding_code = "";
        this.resetMerchantBindingState();
      },
      resetMerchantBindingState() {
        this.matchedMerchant = null;
        this.merchantBindingResolvedCode = "";
        this.merchantBindingHint = "";
        this.merchantBindingHintType = "";
      },
      setMerchantBindingHint(message = "", type = "") {
        this.merchantBindingHint = message;
        this.merchantBindingHintType = type;
      },
      normalizeMerchantBindingCode(value2 = "") {
        return String(value2 || "").replace(/\D/g, "").slice(0, 6);
      },
      isValidMerchantBindingCode(value2 = "") {
        return /^\d{6}$/.test(this.normalizeMerchantBindingCode(value2));
      },
      handleMerchantBindingInput(event) {
        var _a;
        const nextCode = this.normalizeMerchantBindingCode(((_a = event == null ? void 0 : event.detail) == null ? void 0 : _a.value) ?? this.form.merchant_binding_code);
        const previousResolvedCode = this.merchantBindingResolvedCode;
        this.form.merchant_binding_code = nextCode;
        if (!nextCode) {
          this.resetMerchantBindingState();
          return;
        }
        if (previousResolvedCode && previousResolvedCode !== nextCode) {
          this.resetMerchantBindingState();
        }
        if (!this.isValidMerchantBindingCode(nextCode)) {
          this.matchedMerchant = null;
          this.merchantBindingResolvedCode = "";
          this.setMerchantBindingHint("请输入6位商家ID", "error");
        }
      },
      async handleMerchantBindingBlur() {
        if (!this.isMerchantSelfDelivery) {
          return;
        }
        const code = this.normalizeMerchantBindingCode(this.form.merchant_binding_code);
        this.form.merchant_binding_code = code;
        if (!code) {
          this.resetMerchantBindingState();
          return;
        }
        if (!this.isValidMerchantBindingCode(code)) {
          this.resetMerchantBindingState();
          this.setMerchantBindingHint("请输入6位商家ID", "error");
          return;
        }
        await this.resolveMerchantBindingInfo(code, { silent: true });
      },
      async selectDeliveryScope(optionValue) {
        const selectedOption = this.deliveryScopeOptions.find((item) => item.value === optionValue) || {};
        this.form.register_type = optionValue;
        this.form.delivery_scope = selectedOption.delivery_scope || "";
        this.form.rider_kind = selectedOption.rider_kind || "";
        this.resetMerchantBindingState();
        this.form.merchant_binding_code = "";
        if (this.form.delivery_scope !== "town_delivery") {
          this.form.town_code = "";
        }
        if (this.form.delivery_scope === "town_delivery" && !this.townOptionsLoaded && !this.townOptionsLoading) {
          await this.loadTownOptions();
        }
      },
      handleTownChange(event) {
        const selectedTown = this.townOptions[Number(event.detail.value)];
        this.form.town_code = selectedTown ? selectedTown.value : "";
      },
      async loadTownOptions() {
        this.townOptionsLoading = true;
        try {
          const res = await getTownServiceAreas();
          const townOptions = Array.isArray(res.data) ? res.data.map((item) => ({
            value: item.area_code,
            label: item.area_name
          })) : [];
          this.townOptions = townOptions;
          this.townOptionsLoaded = townOptions.length > 0;
          this.townOptionsLoadFailed = false;
          if (this.form.town_code && !townOptions.some((item) => item.value === this.form.town_code)) {
            this.form.town_code = "";
          }
          if (!townOptions.length) {
            uni.showToast({ title: "暂无可选乡镇", icon: "none" });
          }
        } catch (e) {
          this.townOptions = [];
          this.townOptionsLoaded = false;
          this.townOptionsLoadFailed = true;
          formatAppLog("error", "at pages/login/index.vue:429", "乡镇列表加载失败:", e);
        } finally {
          this.townOptionsLoading = false;
        }
      },
      async resolveMerchantBindingInfo(bindingCode = "", { silent = false } = {}) {
        const normalizedCode = this.normalizeMerchantBindingCode(bindingCode || this.form.merchant_binding_code);
        this.form.merchant_binding_code = normalizedCode;
        if (!this.isValidMerchantBindingCode(normalizedCode)) {
          this.resetMerchantBindingState();
          if (!silent) {
            uni.showToast({ title: "请输入6位商家ID", icon: "none" });
          }
          return false;
        }
        if (this.merchantBindingResolvedCode === normalizedCode && this.matchedMerchant) {
          this.setMerchantBindingHint(`已匹配店铺：${this.matchedMerchant.merchant_name || "未命名店铺"}`, "success");
          return true;
        }
        this.merchantBindingResolving = true;
        try {
          const res = await resolveMerchantBinding({
            merchant_binding_code: normalizedCode
          });
          const merchant = (res == null ? void 0 : res.data) || {};
          if (!merchant || !merchant.merchant_id) {
            throw new Error("无商家，请检查商家ID");
          }
          this.matchedMerchant = merchant;
          this.merchantBindingResolvedCode = normalizedCode;
          this.setMerchantBindingHint(`已匹配店铺：${merchant.merchant_name || "未命名店铺"}`, "success");
          return true;
        } catch (error) {
          this.resetMerchantBindingState();
          this.setMerchantBindingHint("无商家，请检查商家ID", "error");
          if (!silent) {
            uni.showToast({ title: "无商家，请检查商家ID", icon: "none" });
          }
          return false;
        } finally {
          this.merchantBindingResolving = false;
        }
      },
      validateForm() {
        const {
          phone,
          password,
          confirmPassword,
          delivery_scope,
          rider_kind,
          town_code,
          merchant_binding_code
        } = this.form;
        if (!phone || phone.length !== 11) {
          uni.showToast({ title: "请输入正确的手机号", icon: "none" });
          return false;
        }
        if (!password || password.length < 6) {
          uni.showToast({ title: "密码至少 6 位", icon: "none" });
          return false;
        }
        if (this.isRegisterMode) {
          if (!delivery_scope) {
            uni.showToast({ title: "请选择配送业务线", icon: "none" });
            return false;
          }
          if (delivery_scope === "town_delivery" && !rider_kind) {
            uni.showToast({ title: "请选择乡镇账号类型", icon: "none" });
            return false;
          }
          if (delivery_scope === "town_delivery" && !town_code) {
            uni.showToast({ title: "请选择所属乡镇", icon: "none" });
            return false;
          }
          if (delivery_scope === MERCHANT_DELIVERY_SCOPE && !this.isValidMerchantBindingCode(merchant_binding_code)) {
            uni.showToast({ title: "请输入6位商家ID", icon: "none" });
            return false;
          }
          if (delivery_scope === MERCHANT_DELIVERY_SCOPE && !this.hasResolvedMerchantBinding) {
            uni.showToast({ title: "无商家，请检查商家ID", icon: "none" });
            return false;
          }
          if (password !== confirmPassword) {
            uni.showToast({ title: "两次密码不一致", icon: "none" });
            return false;
          }
        }
        return true;
      },
      async handleSubmit() {
        reportLoginDebug("G", "pages/login/index.vue:handleSubmit:start", "submit button clicked", {
          isRegisterMode: this.isRegisterMode,
          phoneLength: String(this.form.phone || "").length,
          passwordLength: String(this.form.password || "").length,
          loading: this.loading
        });
        if (!this.validateForm())
          return;
        this.loading = true;
        try {
          if (this.isRegisterMode) {
            await this.handleRegister();
          } else {
            await this.handleLogin();
          }
        } catch (e) {
          formatAppLog("error", "at pages/login/index.vue:549", "操作失败:", e);
        } finally {
          this.loading = false;
        }
      },
      async handleLogin() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const { phone, password } = this.form;
        let res;
        reportLoginDebug("G", "pages/login/index.vue:handleLogin:before-request", "login request about to start", {
          phoneLength: String(phone || "").length,
          hasPassword: !!password
        });
        try {
          res = await login({ phone, password });
          reportLoginDebug("G", "pages/login/index.vue:handleLogin:request-success", "login request resolved", {
            hasData: !!(res == null ? void 0 : res.data),
            hasToken: !!((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.token),
            hasUser: !!((_b = res == null ? void 0 : res.data) == null ? void 0 : _b.user),
            role: ((_d = (_c = res == null ? void 0 : res.data) == null ? void 0 : _c.user) == null ? void 0 : _d.role) || "",
            deliveryScope: ((_f = (_e = res == null ? void 0 : res.data) == null ? void 0 : _e.user) == null ? void 0 : _f.delivery_scope) || "",
            riderKind: ((_h = (_g = res == null ? void 0 : res.data) == null ? void 0 : _g.user) == null ? void 0 : _h.rider_kind) || ""
          });
        } catch (e) {
          reportLoginDebug("G", "pages/login/index.vue:handleLogin:request-failed", "login request rejected", {
            code: (e == null ? void 0 : e.code) || "",
            message: (e == null ? void 0 : e.msg) || (e == null ? void 0 : e.message) || ""
          });
          const auditPendingMessage = this.getAuditPendingLoginMessage(e);
          if (auditPendingMessage) {
            setTimeout(() => {
              uni.showToast({
                title: auditPendingMessage,
                icon: "none",
                duration: 2500
              });
            }, 100);
          }
          throw e;
        }
        if (res.data) {
          const loginToken = res.data.token || "";
          const loginUser = res.data.user || null;
          if (!loginToken || !loginUser) {
            clearRiderSession();
            uni.showToast({ title: "登录信息不完整，请重试", icon: "none" });
            return;
          }
          if (!["rider", "merchant_delivery"].includes(loginUser.role)) {
            reportLoginDebug("G", "pages/login/index.vue:handleLogin:role-rejected", "login user role rejected", {
              role: loginUser.role || ""
            });
            clearRiderSession();
            uni.showToast({
              title: "该账号不是配送账号",
              icon: "none",
              duration: 2e3
            });
            return;
          }
          resetLogoutGuard();
          setToken(loginToken);
          setUserInfo(loginUser);
          reportLoginDebug("G", "pages/login/index.vue:handleLogin:session-stored", "token and user saved locally", {
            hasTokenAfterSave: !!uni.getStorageSync("token"),
            hasUserInfoAfterSave: !!uni.getStorageSync("userInfo"),
            role: loginUser.role || ""
          });
          if (loginUser.delivery_scope === "county_delivery" && loginUser.rider_kind === "rider") {
            setRiderStatus(1);
          }
          uni.showToast({ title: "登录成功", icon: "success" });
          setTimeout(() => {
            uni.reLaunch({
              url: "/pages/index/index",
              success: () => {
                var _a2;
                reportLoginDebug("G", "pages/login/index.vue:handleLogin:relaunch-success", "reLaunch to workbench succeeded", {
                  hasTokenAfterLaunch: !!uni.getStorageSync("token"),
                  hasUserInfoAfterLaunch: !!uni.getStorageSync("userInfo")
                });
                const app = typeof getApp === "function" ? getApp() : null;
                const refreshSession = (_a2 = app == null ? void 0 : app.globalData) == null ? void 0 : _a2.refreshRiderSession;
                if (typeof refreshSession === "function") {
                  setTimeout(() => {
                    refreshSession(true);
                  }, 50);
                }
              }
            });
          }, 1500);
        }
      },
      async handleRegister() {
        const {
          phone,
          password,
          nickname,
          delivery_scope,
          rider_kind,
          town_code,
          merchant_binding_code
        } = this.form;
        const isMerchantDelivery = delivery_scope === MERCHANT_DELIVERY_SCOPE;
        if (isMerchantDelivery) {
          const bindingResolved = await this.resolveMerchantBindingInfo(merchant_binding_code);
          if (!bindingResolved) {
            return;
          }
        }
        const registerData = {
          phone,
          password,
          nickname: nickname || `${isMerchantDelivery ? "配送员" : "骑手"}${phone.slice(-4)}`
        };
        if (isMerchantDelivery) {
          registerData.role = MERCHANT_DELIVERY_ROLE;
          registerData.merchant_binding_code = this.normalizeMerchantBindingCode(merchant_binding_code);
        } else {
          registerData.delivery_scope = delivery_scope;
          if (rider_kind) {
            registerData.rider_kind = rider_kind;
          }
          if (delivery_scope === "town_delivery") {
            registerData.town_code = town_code;
          }
        }
        await registerRider(registerData);
        this.setMode(false);
        this.resetRegisterForm();
        uni.showModal({
          title: "申请已提交",
          content: isMerchantDelivery ? "注册申请已提交，请等待总后台审核。\n审核通过后才可登录配送。" : "注册申请已提交，请等待总后台审核。\n审核通过后才可登录接单。",
          showCancel: false,
          confirmText: "我知道了"
        });
      }
    }
  };
  function _sfc_render$h(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode(
          "text",
          { class: "title" },
          vue.toDisplayString($options.pageTitle),
          1
          /* TEXT */
        )
      ]),
      vue.createElementVNode("view", { class: "form-container" }, [
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "form-label" }, "手机号"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.form.phone = $event),
              type: "number",
              maxlength: "11",
              placeholder: "请输入手机号",
              class: "form-input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.phone]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "form-label" }, "密码"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.form.password = $event),
              type: "password",
              placeholder: "请输入密码（至少6位）",
              class: "form-input",
              "confirm-type": "done",
              onConfirm: _cache[2] || (_cache[2] = (...args) => $options.handleSubmit && $options.handleSubmit(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.password]
          ])
        ]),
        $data.isRegisterMode ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "form-item"
        }, [
          vue.createElementVNode("text", { class: "form-label" }, "确认密码"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.confirmPassword = $event),
              type: "password",
              placeholder: "请再次输入密码",
              class: "form-input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.confirmPassword]
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegisterMode ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "form-item"
        }, [
          vue.createElementVNode("text", { class: "form-label" }, "昵称（选填）"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.form.nickname = $event),
              type: "text",
              placeholder: "请输入昵称",
              class: "form-input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.nickname]
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegisterMode ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "form-item"
        }, [
          vue.createElementVNode("text", { class: "form-label" }, "配送业务线"),
          vue.createElementVNode("view", { class: "scope-options" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.deliveryScopeOptions, (item) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: item.value,
                  class: vue.normalizeClass(["scope-option", { active: $data.form.register_type === item.value }]),
                  onClick: ($event) => $options.selectDeliveryScope(item.value)
                }, [
                  vue.createElementVNode(
                    "text",
                    {
                      class: vue.normalizeClass(["scope-option-text", { active: $data.form.register_type === item.value }])
                    },
                    vue.toDisplayString(item.label),
                    3
                    /* TEXT, CLASS */
                  )
                ], 10, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegisterMode && $options.isTownDelivery ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 3,
          class: "form-item"
        }, [
          vue.createElementVNode("text", { class: "form-label" }, "所属乡镇"),
          vue.createElementVNode("picker", {
            mode: "selector",
            range: $data.townOptions,
            "range-key": "label",
            value: $options.selectedTownIndex,
            onChange: _cache[5] || (_cache[5] = (...args) => $options.handleTownChange && $options.handleTownChange(...args))
          }, [
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["picker-input", { placeholder: !$options.selectedTownLabel }])
              },
              vue.toDisplayString($options.townPickerText),
              3
              /* TEXT, CLASS */
            )
          ], 40, ["range", "value"])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegisterMode && $options.isMerchantSelfDelivery ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 4,
          class: "form-item"
        }, [
          vue.createElementVNode("text", { class: "form-label" }, "商家ID"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => $data.form.merchant_binding_code = $event),
              type: "number",
              maxlength: "6",
              placeholder: "请输入6位商家ID",
              class: "form-input",
              onInput: _cache[7] || (_cache[7] = (...args) => $options.handleMerchantBindingInput && $options.handleMerchantBindingInput(...args)),
              onBlur: _cache[8] || (_cache[8] = (...args) => $options.handleMerchantBindingBlur && $options.handleMerchantBindingBlur(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.merchant_binding_code]
          ]),
          $data.merchantBindingHint ? (vue.openBlock(), vue.createElementBlock(
            "text",
            {
              key: 0,
              class: vue.normalizeClass(["binding-hint", $options.bindingHintClass])
            },
            vue.toDisplayString($data.merchantBindingHint),
            3
            /* TEXT, CLASS */
          )) : vue.createCommentVNode("v-if", true),
          $data.matchedMerchant ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 1,
            class: "merchant-card"
          }, [
            vue.createElementVNode(
              "text",
              { class: "merchant-card-title" },
              "已匹配商家：" + vue.toDisplayString($data.matchedMerchant.merchant_name || "未命名店铺"),
              1
              /* TEXT */
            ),
            $data.matchedMerchant.merchant_address ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "merchant-card-desc"
              },
              " 地址：" + vue.toDisplayString($data.matchedMerchant.merchant_address),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ])) : vue.createCommentVNode("v-if", true)
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode("button", {
          class: vue.normalizeClass(["submit-btn", { disabled: $options.isSubmitDisabled }]),
          disabled: $options.isSubmitDisabled,
          onClick: _cache[9] || (_cache[9] = (...args) => $options.handleSubmitWithKeyboard && $options.handleSubmitWithKeyboard(...args))
        }, vue.toDisplayString($data.isRegisterMode ? "注册" : "登录"), 11, ["disabled"]),
        vue.createElementVNode("view", { class: "toggle-mode" }, [
          vue.createElementVNode(
            "text",
            { class: "tip-text" },
            vue.toDisplayString($data.isRegisterMode ? "已有账号？" : "没有账号？"),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            {
              class: "tip-link",
              onClick: _cache[10] || (_cache[10] = (...args) => $options.toggleMode && $options.toggleMode(...args))
            },
            vue.toDisplayString($data.isRegisterMode ? "立即登录" : "立即注册"),
            1
            /* TEXT */
          )
        ])
      ])
    ]);
  }
  const PagesLoginIndex = /* @__PURE__ */ _export_sfc(_sfc_main$i, [["render", _sfc_render$h], ["__scopeId", "data-v-d08ef7d4"], ["__file", "E:/固始县外卖骑手端/pages/login/index.vue"]]);
  function getTownMerchantApplications(params = {}, options = {}) {
    return get("/town-station/merchant-applications", params, options);
  }
  function getTownMerchantApplicationDetail(id) {
    return get(`/town-station/merchant-applications/${id}`);
  }
  function approveTownMerchantApplication(id, data = {}) {
    return post(`/town-station/merchant-applications/${id}/approve`, data);
  }
  function rejectTownMerchantApplication(id, data = {}) {
    return post(`/town-station/merchant-applications/${id}/reject`, data);
  }
  function getRiderOrders(params = {}, options = {}) {
    return get("/order/rider-orders", params, options);
  }
  function acceptTakeoutOrder(orderId) {
    return post("/order/accept-takeout", { order_id: orderId });
  }
  function getRiderTodaySummary(params = {}, options = {}) {
    return get("/rider/today-summary", params, options);
  }
  function getOrderDetail(id) {
    return get("/order/detail/" + id);
  }
  function getTransferStationmasters(params = {}) {
    return get("/order/transfer/stationmasters", params);
  }
  function submitOrderTransfer(data = {}) {
    return post("/order/transfer/to-stationmaster", data);
  }
  function revokeOrderTransfer(orderId) {
    return post("/order/transfer/revoke", { order_id: orderId });
  }
  function getTransferTownRiders(params = {}) {
    return get("/order/transfer/town-riders", params);
  }
  function submitOrderTransferToTownRider(data = {}) {
    return post("/order/transfer/to-town-rider", data);
  }
  function confirmDelivery(orderId) {
    return post("/order/confirm-delivery", { order_id: orderId });
  }
  function riderPickup(orderId) {
    return post("/rider/order/pickup", { order_id: orderId });
  }
  function confirmDeliverySpecial(orderId) {
    return post("/order/confirm-delivery-special", { order_id: orderId });
  }
  function updateRiderStatus(status) {
    return post("/order/rider-status", { status });
  }
  function startMerchantSelfDelivery(orderId) {
    return post("/order/deliver", { order_id: orderId });
  }
  function confirmMerchantSelfDelivery(orderId) {
    return post("/order/merchant-confirm-delivery", { order_id: orderId });
  }
  function getTownRiderApplications(params = {}, options = {}) {
    return get("/town-station/rider-applications", params, options);
  }
  function getTownRiderApplicationDetail(id) {
    return get(`/town-station/rider-applications/${id}`);
  }
  function approveTownRiderApplication(id, data = {}) {
    return post(`/town-station/rider-applications/${id}/approve`, data);
  }
  function rejectTownRiderApplication(id, data = {}) {
    return post(`/town-station/rider-applications/${id}/reject`, data);
  }
  function getErrandList(params = {}, options = {}) {
    return get("/order/errand/list", params, options);
  }
  function getTownErrandConversations(params = {}, options = {}) {
    return get("/town-errand/conversations", params, options);
  }
  function getTownErrandMessages(conversationId, params = {}, options = {}) {
    return get(`/town-errand/conversations/${conversationId}/messages`, params, options);
  }
  function sendTownErrandMessage(conversationId, content, options = {}) {
    return post(`/town-errand/conversations/${conversationId}/messages`, { content }, options);
  }
  function getUserInfo(options = {}) {
    return get("/auth/me", {}, options);
  }
  function bindStationTown(town) {
    return post("/rider/station/bind", { town });
  }
  function isMerchantDeliveryUser(user = {}) {
    return (user == null ? void 0 : user.role) === "merchant_delivery";
  }
  function isRiderAppUser(user = {}) {
    return (user == null ? void 0 : user.role) === "rider" || isMerchantDeliveryUser(user);
  }
  function isCountyRider(user = {}) {
    return (user == null ? void 0 : user.role) === "rider" && (user == null ? void 0 : user.delivery_scope) === "county_delivery" && (user == null ? void 0 : user.rider_kind) === "rider";
  }
  function isTownStationmaster(user = {}) {
    return (user == null ? void 0 : user.role) === "rider" && (user == null ? void 0 : user.rider_kind) === "stationmaster";
  }
  function isTownScopeUser(user = {}) {
    return (user == null ? void 0 : user.role) === "rider" && (user == null ? void 0 : user.delivery_scope) === "town_delivery";
  }
  const PACKET_TYPES = /* @__PURE__ */ Object.create(null);
  PACKET_TYPES["open"] = "0";
  PACKET_TYPES["close"] = "1";
  PACKET_TYPES["ping"] = "2";
  PACKET_TYPES["pong"] = "3";
  PACKET_TYPES["message"] = "4";
  PACKET_TYPES["upgrade"] = "5";
  PACKET_TYPES["noop"] = "6";
  const PACKET_TYPES_REVERSE = /* @__PURE__ */ Object.create(null);
  Object.keys(PACKET_TYPES).forEach((key) => {
    PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
  });
  const ERROR_PACKET = { type: "error", data: "parser error" };
  const withNativeBlob$1 = typeof Blob === "function" || typeof Blob !== "undefined" && Object.prototype.toString.call(Blob) === "[object BlobConstructor]";
  const withNativeArrayBuffer$2 = typeof ArrayBuffer === "function";
  const isView$1 = (obj) => {
    return typeof ArrayBuffer.isView === "function" ? ArrayBuffer.isView(obj) : obj && obj.buffer instanceof ArrayBuffer;
  };
  const encodePacket = ({ type, data }, supportsBinary, callback) => {
    if (withNativeBlob$1 && data instanceof Blob) {
      if (supportsBinary) {
        return callback(data);
      } else {
        return encodeBlobAsBase64(data, callback);
      }
    } else if (withNativeArrayBuffer$2 && (data instanceof ArrayBuffer || isView$1(data))) {
      if (supportsBinary) {
        return callback(data);
      } else {
        return encodeBlobAsBase64(new Blob([data]), callback);
      }
    }
    return callback(PACKET_TYPES[type] + (data || ""));
  };
  const encodeBlobAsBase64 = (data, callback) => {
    const fileReader = new FileReader();
    fileReader.onload = function() {
      const content = fileReader.result.split(",")[1];
      callback("b" + (content || ""));
    };
    return fileReader.readAsDataURL(data);
  };
  function toArray$1(data) {
    if (data instanceof Uint8Array) {
      return data;
    } else if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    } else {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
  }
  let TEXT_ENCODER;
  function encodePacketToBinary(packet, callback) {
    if (withNativeBlob$1 && packet.data instanceof Blob) {
      return packet.data.arrayBuffer().then(toArray$1).then(callback);
    } else if (withNativeArrayBuffer$2 && (packet.data instanceof ArrayBuffer || isView$1(packet.data))) {
      return callback(toArray$1(packet.data));
    }
    encodePacket(packet, false, (encoded) => {
      if (!TEXT_ENCODER) {
        TEXT_ENCODER = new TextEncoder();
      }
      callback(TEXT_ENCODER.encode(encoded));
    });
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup$1 = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup$1[chars.charCodeAt(i)] = i;
  }
  const decode$1 = (base64) => {
    let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }
    const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
    for (i = 0; i < len; i += 4) {
      encoded1 = lookup$1[base64.charCodeAt(i)];
      encoded2 = lookup$1[base64.charCodeAt(i + 1)];
      encoded3 = lookup$1[base64.charCodeAt(i + 2)];
      encoded4 = lookup$1[base64.charCodeAt(i + 3)];
      bytes[p++] = encoded1 << 2 | encoded2 >> 4;
      bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
      bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
    }
    return arraybuffer;
  };
  const withNativeArrayBuffer$1 = typeof ArrayBuffer === "function";
  const decodePacket = (encodedPacket, binaryType) => {
    if (typeof encodedPacket !== "string") {
      return {
        type: "message",
        data: mapBinary(encodedPacket, binaryType)
      };
    }
    const type = encodedPacket.charAt(0);
    if (type === "b") {
      return {
        type: "message",
        data: decodeBase64Packet(encodedPacket.substring(1), binaryType)
      };
    }
    const packetType = PACKET_TYPES_REVERSE[type];
    if (!packetType) {
      return ERROR_PACKET;
    }
    return encodedPacket.length > 1 ? {
      type: PACKET_TYPES_REVERSE[type],
      data: encodedPacket.substring(1)
    } : {
      type: PACKET_TYPES_REVERSE[type]
    };
  };
  const decodeBase64Packet = (data, binaryType) => {
    if (withNativeArrayBuffer$1) {
      const decoded = decode$1(data);
      return mapBinary(decoded, binaryType);
    } else {
      return { base64: true, data };
    }
  };
  const mapBinary = (data, binaryType) => {
    switch (binaryType) {
      case "blob":
        if (data instanceof Blob) {
          return data;
        } else {
          return new Blob([data]);
        }
      case "arraybuffer":
      default:
        if (data instanceof ArrayBuffer) {
          return data;
        } else {
          return data.buffer;
        }
    }
  };
  const SEPARATOR = String.fromCharCode(30);
  const encodePayload = (packets, callback) => {
    const length = packets.length;
    const encodedPackets = new Array(length);
    let count = 0;
    packets.forEach((packet, i) => {
      encodePacket(packet, false, (encodedPacket) => {
        encodedPackets[i] = encodedPacket;
        if (++count === length) {
          callback(encodedPackets.join(SEPARATOR));
        }
      });
    });
  };
  const decodePayload = (encodedPayload, binaryType) => {
    const encodedPackets = encodedPayload.split(SEPARATOR);
    const packets = [];
    for (let i = 0; i < encodedPackets.length; i++) {
      const decodedPacket = decodePacket(encodedPackets[i], binaryType);
      packets.push(decodedPacket);
      if (decodedPacket.type === "error") {
        break;
      }
    }
    return packets;
  };
  function createPacketEncoderStream() {
    return new TransformStream({
      transform(packet, controller) {
        encodePacketToBinary(packet, (encodedPacket) => {
          const payloadLength = encodedPacket.length;
          let header;
          if (payloadLength < 126) {
            header = new Uint8Array(1);
            new DataView(header.buffer).setUint8(0, payloadLength);
          } else if (payloadLength < 65536) {
            header = new Uint8Array(3);
            const view = new DataView(header.buffer);
            view.setUint8(0, 126);
            view.setUint16(1, payloadLength);
          } else {
            header = new Uint8Array(9);
            const view = new DataView(header.buffer);
            view.setUint8(0, 127);
            view.setBigUint64(1, BigInt(payloadLength));
          }
          if (packet.data && typeof packet.data !== "string") {
            header[0] |= 128;
          }
          controller.enqueue(header);
          controller.enqueue(encodedPacket);
        });
      }
    });
  }
  let TEXT_DECODER;
  function totalLength(chunks) {
    return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  }
  function concatChunks(chunks, size) {
    if (chunks[0].length === size) {
      return chunks.shift();
    }
    const buffer = new Uint8Array(size);
    let j = 0;
    for (let i = 0; i < size; i++) {
      buffer[i] = chunks[0][j++];
      if (j === chunks[0].length) {
        chunks.shift();
        j = 0;
      }
    }
    if (chunks.length && j < chunks[0].length) {
      chunks[0] = chunks[0].slice(j);
    }
    return buffer;
  }
  function createPacketDecoderStream(maxPayload, binaryType) {
    if (!TEXT_DECODER) {
      TEXT_DECODER = new TextDecoder();
    }
    const chunks = [];
    let state2 = 0;
    let expectedLength = -1;
    let isBinary2 = false;
    return new TransformStream({
      transform(chunk, controller) {
        chunks.push(chunk);
        while (true) {
          if (state2 === 0) {
            if (totalLength(chunks) < 1) {
              break;
            }
            const header = concatChunks(chunks, 1);
            isBinary2 = (header[0] & 128) === 128;
            expectedLength = header[0] & 127;
            if (expectedLength < 126) {
              state2 = 3;
            } else if (expectedLength === 126) {
              state2 = 1;
            } else {
              state2 = 2;
            }
          } else if (state2 === 1) {
            if (totalLength(chunks) < 2) {
              break;
            }
            const headerArray = concatChunks(chunks, 2);
            expectedLength = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length).getUint16(0);
            state2 = 3;
          } else if (state2 === 2) {
            if (totalLength(chunks) < 8) {
              break;
            }
            const headerArray = concatChunks(chunks, 8);
            const view = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length);
            const n = view.getUint32(0);
            if (n > Math.pow(2, 53 - 32) - 1) {
              controller.enqueue(ERROR_PACKET);
              break;
            }
            expectedLength = n * Math.pow(2, 32) + view.getUint32(4);
            state2 = 3;
          } else {
            if (totalLength(chunks) < expectedLength) {
              break;
            }
            const data = concatChunks(chunks, expectedLength);
            controller.enqueue(decodePacket(isBinary2 ? data : TEXT_DECODER.decode(data), binaryType));
            state2 = 0;
          }
          if (expectedLength === 0 || expectedLength > maxPayload) {
            controller.enqueue(ERROR_PACKET);
            break;
          }
        }
      }
    });
  }
  const protocol$1 = 4;
  function Emitter(obj) {
    if (obj)
      return mixin(obj);
  }
  function mixin(obj) {
    for (var key in Emitter.prototype) {
      obj[key] = Emitter.prototype[key];
    }
    return obj;
  }
  Emitter.prototype.on = Emitter.prototype.addEventListener = function(event, fn) {
    this._callbacks = this._callbacks || {};
    (this._callbacks["$" + event] = this._callbacks["$" + event] || []).push(fn);
    return this;
  };
  Emitter.prototype.once = function(event, fn) {
    function on2() {
      this.off(event, on2);
      fn.apply(this, arguments);
    }
    on2.fn = fn;
    this.on(event, on2);
    return this;
  };
  Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function(event, fn) {
    this._callbacks = this._callbacks || {};
    if (0 == arguments.length) {
      this._callbacks = {};
      return this;
    }
    var callbacks = this._callbacks["$" + event];
    if (!callbacks)
      return this;
    if (1 == arguments.length) {
      delete this._callbacks["$" + event];
      return this;
    }
    var cb;
    for (var i = 0; i < callbacks.length; i++) {
      cb = callbacks[i];
      if (cb === fn || cb.fn === fn) {
        callbacks.splice(i, 1);
        break;
      }
    }
    if (callbacks.length === 0) {
      delete this._callbacks["$" + event];
    }
    return this;
  };
  Emitter.prototype.emit = function(event) {
    this._callbacks = this._callbacks || {};
    var args = new Array(arguments.length - 1), callbacks = this._callbacks["$" + event];
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
    if (callbacks) {
      callbacks = callbacks.slice(0);
      for (var i = 0, len = callbacks.length; i < len; ++i) {
        callbacks[i].apply(this, args);
      }
    }
    return this;
  };
  Emitter.prototype.emitReserved = Emitter.prototype.emit;
  Emitter.prototype.listeners = function(event) {
    this._callbacks = this._callbacks || {};
    return this._callbacks["$" + event] || [];
  };
  Emitter.prototype.hasListeners = function(event) {
    return !!this.listeners(event).length;
  };
  const nextTick = (() => {
    const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
    if (isPromiseAvailable) {
      return (cb) => Promise.resolve().then(cb);
    } else {
      return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
    }
  })();
  const globalThisShim = (() => {
    if (typeof self !== "undefined") {
      return self;
    } else if (typeof window !== "undefined") {
      return window;
    } else {
      return Function("return this")();
    }
  })();
  const defaultBinaryType = "arraybuffer";
  function createCookieJar() {
  }
  function pick(obj, ...attr) {
    return attr.reduce((acc, k) => {
      if (obj.hasOwnProperty(k)) {
        acc[k] = obj[k];
      }
      return acc;
    }, {});
  }
  const NATIVE_SET_TIMEOUT = globalThisShim.setTimeout;
  const NATIVE_CLEAR_TIMEOUT = globalThisShim.clearTimeout;
  function installTimerFunctions(obj, opts) {
    if (opts.useNativeTimers) {
      obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThisShim);
      obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThisShim);
    } else {
      obj.setTimeoutFn = globalThisShim.setTimeout.bind(globalThisShim);
      obj.clearTimeoutFn = globalThisShim.clearTimeout.bind(globalThisShim);
    }
  }
  const BASE64_OVERHEAD = 1.33;
  function byteLength(obj) {
    if (typeof obj === "string") {
      return utf8Length(obj);
    }
    return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD);
  }
  function utf8Length(str) {
    let c = 0, length = 0;
    for (let i = 0, l = str.length; i < l; i++) {
      c = str.charCodeAt(i);
      if (c < 128) {
        length += 1;
      } else if (c < 2048) {
        length += 2;
      } else if (c < 55296 || c >= 57344) {
        length += 3;
      } else {
        i++;
        length += 4;
      }
    }
    return length;
  }
  function randomString() {
    return Date.now().toString(36).substring(3) + Math.random().toString(36).substring(2, 5);
  }
  function encode(obj) {
    let str = "";
    for (let i in obj) {
      if (obj.hasOwnProperty(i)) {
        if (str.length)
          str += "&";
        str += encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]);
      }
    }
    return str;
  }
  function decode(qs) {
    let qry = {};
    let pairs = qs.split("&");
    for (let i = 0, l = pairs.length; i < l; i++) {
      let pair = pairs[i].split("=");
      qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
    return qry;
  }
  class TransportError extends Error {
    constructor(reason, description, context) {
      super(reason);
      this.description = description;
      this.context = context;
      this.type = "TransportError";
    }
  }
  class Transport extends Emitter {
    /**
     * Transport abstract constructor.
     *
     * @param {Object} opts - options
     * @protected
     */
    constructor(opts) {
      super();
      this.writable = false;
      installTimerFunctions(this, opts);
      this.opts = opts;
      this.query = opts.query;
      this.socket = opts.socket;
      this.supportsBinary = !opts.forceBase64;
    }
    /**
     * Emits an error.
     *
     * @param {String} reason
     * @param description
     * @param context - the error context
     * @return {Transport} for chaining
     * @protected
     */
    onError(reason, description, context) {
      super.emitReserved("error", new TransportError(reason, description, context));
      return this;
    }
    /**
     * Opens the transport.
     */
    open() {
      this.readyState = "opening";
      this.doOpen();
      return this;
    }
    /**
     * Closes the transport.
     */
    close() {
      if (this.readyState === "opening" || this.readyState === "open") {
        this.doClose();
        this.onClose();
      }
      return this;
    }
    /**
     * Sends multiple packets.
     *
     * @param {Array} packets
     */
    send(packets) {
      if (this.readyState === "open") {
        this.write(packets);
      }
    }
    /**
     * Called upon open
     *
     * @protected
     */
    onOpen() {
      this.readyState = "open";
      this.writable = true;
      super.emitReserved("open");
    }
    /**
     * Called with data.
     *
     * @param {String} data
     * @protected
     */
    onData(data) {
      const packet = decodePacket(data, this.socket.binaryType);
      this.onPacket(packet);
    }
    /**
     * Called with a decoded packet.
     *
     * @protected
     */
    onPacket(packet) {
      super.emitReserved("packet", packet);
    }
    /**
     * Called upon close.
     *
     * @protected
     */
    onClose(details) {
      this.readyState = "closed";
      super.emitReserved("close", details);
    }
    /**
     * Pauses the transport, in order not to lose packets during an upgrade.
     *
     * @param onPause
     */
    pause(onPause) {
    }
    createUri(schema, query = {}) {
      return schema + "://" + this._hostname() + this._port() + this.opts.path + this._query(query);
    }
    _hostname() {
      const hostname = this.opts.hostname;
      return hostname.indexOf(":") === -1 ? hostname : "[" + hostname + "]";
    }
    _port() {
      if (this.opts.port && (this.opts.secure && Number(this.opts.port) !== 443 || !this.opts.secure && Number(this.opts.port) !== 80)) {
        return ":" + this.opts.port;
      } else {
        return "";
      }
    }
    _query(query) {
      const encodedQuery = encode(query);
      return encodedQuery.length ? "?" + encodedQuery : "";
    }
  }
  class Polling extends Transport {
    constructor() {
      super(...arguments);
      this._polling = false;
    }
    get name() {
      return "polling";
    }
    /**
     * Opens the socket (triggers polling). We write a PING message to determine
     * when the transport is open.
     *
     * @protected
     */
    doOpen() {
      this._poll();
    }
    /**
     * Pauses polling.
     *
     * @param {Function} onPause - callback upon buffers are flushed and transport is paused
     * @package
     */
    pause(onPause) {
      this.readyState = "pausing";
      const pause = () => {
        this.readyState = "paused";
        onPause();
      };
      if (this._polling || !this.writable) {
        let total = 0;
        if (this._polling) {
          total++;
          this.once("pollComplete", function() {
            --total || pause();
          });
        }
        if (!this.writable) {
          total++;
          this.once("drain", function() {
            --total || pause();
          });
        }
      } else {
        pause();
      }
    }
    /**
     * Starts polling cycle.
     *
     * @private
     */
    _poll() {
      this._polling = true;
      this.doPoll();
      this.emitReserved("poll");
    }
    /**
     * Overloads onData to detect payloads.
     *
     * @protected
     */
    onData(data) {
      const callback = (packet) => {
        if ("opening" === this.readyState && packet.type === "open") {
          this.onOpen();
        }
        if ("close" === packet.type) {
          this.onClose({ description: "transport closed by the server" });
          return false;
        }
        this.onPacket(packet);
      };
      decodePayload(data, this.socket.binaryType).forEach(callback);
      if ("closed" !== this.readyState) {
        this._polling = false;
        this.emitReserved("pollComplete");
        if ("open" === this.readyState) {
          this._poll();
        }
      }
    }
    /**
     * For polling, send a close packet.
     *
     * @protected
     */
    doClose() {
      const close = () => {
        this.write([{ type: "close" }]);
      };
      if ("open" === this.readyState) {
        close();
      } else {
        this.once("open", close);
      }
    }
    /**
     * Writes a packets payload.
     *
     * @param {Array} packets - data packets
     * @protected
     */
    write(packets) {
      this.writable = false;
      encodePayload(packets, (data) => {
        this.doWrite(data, () => {
          this.writable = true;
          this.emitReserved("drain");
        });
      });
    }
    /**
     * Generates uri for connection.
     *
     * @private
     */
    uri() {
      const schema = this.opts.secure ? "https" : "http";
      const query = this.query || {};
      if (false !== this.opts.timestampRequests) {
        query[this.opts.timestampParam] = randomString();
      }
      if (!this.supportsBinary && !query.sid) {
        query.b64 = 1;
      }
      return this.createUri(schema, query);
    }
  }
  let value = false;
  try {
    value = typeof XMLHttpRequest !== "undefined" && "withCredentials" in new XMLHttpRequest();
  } catch (err) {
  }
  const hasCORS = value;
  function empty() {
  }
  class BaseXHR extends Polling {
    /**
     * XHR Polling constructor.
     *
     * @param {Object} opts
     * @package
     */
    constructor(opts) {
      super(opts);
      if (typeof location !== "undefined") {
        const isSSL = "https:" === location.protocol;
        let port = location.port;
        if (!port) {
          port = isSSL ? "443" : "80";
        }
        this.xd = typeof location !== "undefined" && opts.hostname !== location.hostname || port !== opts.port;
      }
    }
    /**
     * Sends data.
     *
     * @param {String} data to send.
     * @param {Function} called upon flush.
     * @private
     */
    doWrite(data, fn) {
      const req = this.request({
        method: "POST",
        data
      });
      req.on("success", fn);
      req.on("error", (xhrStatus, context) => {
        this.onError("xhr post error", xhrStatus, context);
      });
    }
    /**
     * Starts a poll cycle.
     *
     * @private
     */
    doPoll() {
      const req = this.request();
      req.on("data", this.onData.bind(this));
      req.on("error", (xhrStatus, context) => {
        this.onError("xhr poll error", xhrStatus, context);
      });
      this.pollXhr = req;
    }
  }
  class Request extends Emitter {
    /**
     * Request constructor
     *
     * @param {Object} options
     * @package
     */
    constructor(createRequest, uri, opts) {
      super();
      this.createRequest = createRequest;
      installTimerFunctions(this, opts);
      this._opts = opts;
      this._method = opts.method || "GET";
      this._uri = uri;
      this._data = void 0 !== opts.data ? opts.data : null;
      this._create();
    }
    /**
     * Creates the XHR object and sends the request.
     *
     * @private
     */
    _create() {
      var _a;
      const opts = pick(this._opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
      opts.xdomain = !!this._opts.xd;
      const xhr = this._xhr = this.createRequest(opts);
      try {
        xhr.open(this._method, this._uri, true);
        try {
          if (this._opts.extraHeaders) {
            xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
            for (let i in this._opts.extraHeaders) {
              if (this._opts.extraHeaders.hasOwnProperty(i)) {
                xhr.setRequestHeader(i, this._opts.extraHeaders[i]);
              }
            }
          }
        } catch (e) {
        }
        if ("POST" === this._method) {
          try {
            xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
          } catch (e) {
          }
        }
        try {
          xhr.setRequestHeader("Accept", "*/*");
        } catch (e) {
        }
        (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.addCookies(xhr);
        if ("withCredentials" in xhr) {
          xhr.withCredentials = this._opts.withCredentials;
        }
        if (this._opts.requestTimeout) {
          xhr.timeout = this._opts.requestTimeout;
        }
        xhr.onreadystatechange = () => {
          var _a2;
          if (xhr.readyState === 3) {
            (_a2 = this._opts.cookieJar) === null || _a2 === void 0 ? void 0 : _a2.parseCookies(
              // @ts-ignore
              xhr.getResponseHeader("set-cookie")
            );
          }
          if (4 !== xhr.readyState)
            return;
          if (200 === xhr.status || 1223 === xhr.status) {
            this._onLoad();
          } else {
            this.setTimeoutFn(() => {
              this._onError(typeof xhr.status === "number" ? xhr.status : 0);
            }, 0);
          }
        };
        xhr.send(this._data);
      } catch (e) {
        this.setTimeoutFn(() => {
          this._onError(e);
        }, 0);
        return;
      }
      if (typeof document !== "undefined") {
        this._index = Request.requestsCount++;
        Request.requests[this._index] = this;
      }
    }
    /**
     * Called upon error.
     *
     * @private
     */
    _onError(err) {
      this.emitReserved("error", err, this._xhr);
      this._cleanup(true);
    }
    /**
     * Cleans up house.
     *
     * @private
     */
    _cleanup(fromError) {
      if ("undefined" === typeof this._xhr || null === this._xhr) {
        return;
      }
      this._xhr.onreadystatechange = empty;
      if (fromError) {
        try {
          this._xhr.abort();
        } catch (e) {
        }
      }
      if (typeof document !== "undefined") {
        delete Request.requests[this._index];
      }
      this._xhr = null;
    }
    /**
     * Called upon load.
     *
     * @private
     */
    _onLoad() {
      const data = this._xhr.responseText;
      if (data !== null) {
        this.emitReserved("data", data);
        this.emitReserved("success");
        this._cleanup();
      }
    }
    /**
     * Aborts the request.
     *
     * @package
     */
    abort() {
      this._cleanup();
    }
  }
  Request.requestsCount = 0;
  Request.requests = {};
  if (typeof document !== "undefined") {
    if (typeof attachEvent === "function") {
      attachEvent("onunload", unloadHandler);
    } else if (typeof addEventListener === "function") {
      const terminationEvent = "onpagehide" in globalThisShim ? "pagehide" : "unload";
      addEventListener(terminationEvent, unloadHandler, false);
    }
  }
  function unloadHandler() {
    for (let i in Request.requests) {
      if (Request.requests.hasOwnProperty(i)) {
        Request.requests[i].abort();
      }
    }
  }
  const hasXHR2 = function() {
    const xhr = newRequest({
      xdomain: false
    });
    return xhr && xhr.responseType !== null;
  }();
  class XHR extends BaseXHR {
    constructor(opts) {
      super(opts);
      const forceBase64 = opts && opts.forceBase64;
      this.supportsBinary = hasXHR2 && !forceBase64;
    }
    request(opts = {}) {
      Object.assign(opts, { xd: this.xd }, this.opts);
      return new Request(newRequest, this.uri(), opts);
    }
  }
  function newRequest(opts) {
    const xdomain = opts.xdomain;
    try {
      if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
        return new XMLHttpRequest();
      }
    } catch (e) {
    }
    if (!xdomain) {
      try {
        return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
      } catch (e) {
      }
    }
  }
  const isReactNative = typeof navigator !== "undefined" && typeof navigator.product === "string" && navigator.product.toLowerCase() === "reactnative";
  class BaseWS extends Transport {
    get name() {
      return "websocket";
    }
    doOpen() {
      const uri = this.uri();
      const protocols = this.opts.protocols;
      const opts = isReactNative ? {} : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
      if (this.opts.extraHeaders) {
        opts.headers = this.opts.extraHeaders;
      }
      try {
        this.ws = this.createSocket(uri, protocols, opts);
      } catch (err) {
        return this.emitReserved("error", err);
      }
      this.ws.binaryType = this.socket.binaryType;
      this.addEventListeners();
    }
    /**
     * Adds event listeners to the socket
     *
     * @private
     */
    addEventListeners() {
      this.ws.onopen = () => {
        if (this.opts.autoUnref) {
          this.ws._socket.unref();
        }
        this.onOpen();
      };
      this.ws.onclose = (closeEvent) => this.onClose({
        description: "websocket connection closed",
        context: closeEvent
      });
      this.ws.onmessage = (ev) => this.onData(ev.data);
      this.ws.onerror = (e) => this.onError("websocket error", e);
    }
    write(packets) {
      this.writable = false;
      for (let i = 0; i < packets.length; i++) {
        const packet = packets[i];
        const lastPacket = i === packets.length - 1;
        encodePacket(packet, this.supportsBinary, (data) => {
          try {
            this.doWrite(packet, data);
          } catch (e) {
          }
          if (lastPacket) {
            nextTick(() => {
              this.writable = true;
              this.emitReserved("drain");
            }, this.setTimeoutFn);
          }
        });
      }
    }
    doClose() {
      if (typeof this.ws !== "undefined") {
        this.ws.onerror = () => {
        };
        this.ws.close();
        this.ws = null;
      }
    }
    /**
     * Generates uri for connection.
     *
     * @private
     */
    uri() {
      const schema = this.opts.secure ? "wss" : "ws";
      const query = this.query || {};
      if (this.opts.timestampRequests) {
        query[this.opts.timestampParam] = randomString();
      }
      if (!this.supportsBinary) {
        query.b64 = 1;
      }
      return this.createUri(schema, query);
    }
  }
  const WebSocketCtor = globalThisShim.WebSocket || globalThisShim.MozWebSocket;
  class WS extends BaseWS {
    createSocket(uri, protocols, opts) {
      return !isReactNative ? protocols ? new WebSocketCtor(uri, protocols) : new WebSocketCtor(uri) : new WebSocketCtor(uri, protocols, opts);
    }
    doWrite(_packet, data) {
      this.ws.send(data);
    }
  }
  class WT extends Transport {
    get name() {
      return "webtransport";
    }
    doOpen() {
      try {
        this._transport = new WebTransport(this.createUri("https"), this.opts.transportOptions[this.name]);
      } catch (err) {
        return this.emitReserved("error", err);
      }
      this._transport.closed.then(() => {
        this.onClose();
      }).catch((err) => {
        this.onError("webtransport error", err);
      });
      this._transport.ready.then(() => {
        this._transport.createBidirectionalStream().then((stream) => {
          const decoderStream = createPacketDecoderStream(Number.MAX_SAFE_INTEGER, this.socket.binaryType);
          const reader = stream.readable.pipeThrough(decoderStream).getReader();
          const encoderStream = createPacketEncoderStream();
          encoderStream.readable.pipeTo(stream.writable);
          this._writer = encoderStream.writable.getWriter();
          const read = () => {
            reader.read().then(({ done, value: value2 }) => {
              if (done) {
                return;
              }
              this.onPacket(value2);
              read();
            }).catch((err) => {
            });
          };
          read();
          const packet = { type: "open" };
          if (this.query.sid) {
            packet.data = `{"sid":"${this.query.sid}"}`;
          }
          this._writer.write(packet).then(() => this.onOpen());
        });
      });
    }
    write(packets) {
      this.writable = false;
      for (let i = 0; i < packets.length; i++) {
        const packet = packets[i];
        const lastPacket = i === packets.length - 1;
        this._writer.write(packet).then(() => {
          if (lastPacket) {
            nextTick(() => {
              this.writable = true;
              this.emitReserved("drain");
            }, this.setTimeoutFn);
          }
        });
      }
    }
    doClose() {
      var _a;
      (_a = this._transport) === null || _a === void 0 ? void 0 : _a.close();
    }
  }
  const transports = {
    websocket: WS,
    webtransport: WT,
    polling: XHR
  };
  const re = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
  const parts = [
    "source",
    "protocol",
    "authority",
    "userInfo",
    "user",
    "password",
    "host",
    "port",
    "relative",
    "path",
    "directory",
    "file",
    "query",
    "anchor"
  ];
  function parse(str) {
    if (str.length > 8e3) {
      throw "URI too long";
    }
    const src = str, b = str.indexOf("["), e = str.indexOf("]");
    if (b != -1 && e != -1) {
      str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ";") + str.substring(e, str.length);
    }
    let m = re.exec(str || ""), uri = {}, i = 14;
    while (i--) {
      uri[parts[i]] = m[i] || "";
    }
    if (b != -1 && e != -1) {
      uri.source = src;
      uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ":");
      uri.authority = uri.authority.replace("[", "").replace("]", "").replace(/;/g, ":");
      uri.ipv6uri = true;
    }
    uri.pathNames = pathNames(uri, uri["path"]);
    uri.queryKey = queryKey(uri, uri["query"]);
    return uri;
  }
  function pathNames(obj, path) {
    const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
    if (path.slice(0, 1) == "/" || path.length === 0) {
      names.splice(0, 1);
    }
    if (path.slice(-1) == "/") {
      names.splice(names.length - 1, 1);
    }
    return names;
  }
  function queryKey(uri, query) {
    const data = {};
    query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function($0, $1, $2) {
      if ($1) {
        data[$1] = $2;
      }
    });
    return data;
  }
  const withEventListeners = typeof addEventListener === "function" && typeof removeEventListener === "function";
  const OFFLINE_EVENT_LISTENERS = [];
  if (withEventListeners) {
    addEventListener("offline", () => {
      OFFLINE_EVENT_LISTENERS.forEach((listener) => listener());
    }, false);
  }
  class SocketWithoutUpgrade extends Emitter {
    /**
     * Socket constructor.
     *
     * @param {String|Object} uri - uri or options
     * @param {Object} opts - options
     */
    constructor(uri, opts) {
      super();
      this.binaryType = defaultBinaryType;
      this.writeBuffer = [];
      this._prevBufferLen = 0;
      this._pingInterval = -1;
      this._pingTimeout = -1;
      this._maxPayload = -1;
      this._pingTimeoutTime = Infinity;
      if (uri && "object" === typeof uri) {
        opts = uri;
        uri = null;
      }
      if (uri) {
        const parsedUri = parse(uri);
        opts.hostname = parsedUri.host;
        opts.secure = parsedUri.protocol === "https" || parsedUri.protocol === "wss";
        opts.port = parsedUri.port;
        if (parsedUri.query)
          opts.query = parsedUri.query;
      } else if (opts.host) {
        opts.hostname = parse(opts.host).host;
      }
      installTimerFunctions(this, opts);
      this.secure = null != opts.secure ? opts.secure : typeof location !== "undefined" && "https:" === location.protocol;
      if (opts.hostname && !opts.port) {
        opts.port = this.secure ? "443" : "80";
      }
      this.hostname = opts.hostname || (typeof location !== "undefined" ? location.hostname : "localhost");
      this.port = opts.port || (typeof location !== "undefined" && location.port ? location.port : this.secure ? "443" : "80");
      this.transports = [];
      this._transportsByName = {};
      opts.transports.forEach((t) => {
        const transportName = t.prototype.name;
        this.transports.push(transportName);
        this._transportsByName[transportName] = t;
      });
      this.opts = Object.assign({
        path: "/engine.io",
        agent: false,
        withCredentials: false,
        upgrade: true,
        timestampParam: "t",
        rememberUpgrade: false,
        addTrailingSlash: true,
        rejectUnauthorized: true,
        perMessageDeflate: {
          threshold: 1024
        },
        transportOptions: {},
        closeOnBeforeunload: false
      }, opts);
      this.opts.path = this.opts.path.replace(/\/$/, "") + (this.opts.addTrailingSlash ? "/" : "");
      if (typeof this.opts.query === "string") {
        this.opts.query = decode(this.opts.query);
      }
      if (withEventListeners) {
        if (this.opts.closeOnBeforeunload) {
          this._beforeunloadEventListener = () => {
            if (this.transport) {
              this.transport.removeAllListeners();
              this.transport.close();
            }
          };
          addEventListener("beforeunload", this._beforeunloadEventListener, false);
        }
        if (this.hostname !== "localhost") {
          this._offlineEventListener = () => {
            this._onClose("transport close", {
              description: "network connection lost"
            });
          };
          OFFLINE_EVENT_LISTENERS.push(this._offlineEventListener);
        }
      }
      if (this.opts.withCredentials) {
        this._cookieJar = createCookieJar();
      }
      this._open();
    }
    /**
     * Creates transport of the given type.
     *
     * @param {String} name - transport name
     * @return {Transport}
     * @private
     */
    createTransport(name) {
      const query = Object.assign({}, this.opts.query);
      query.EIO = protocol$1;
      query.transport = name;
      if (this.id)
        query.sid = this.id;
      const opts = Object.assign({}, this.opts, {
        query,
        socket: this,
        hostname: this.hostname,
        secure: this.secure,
        port: this.port
      }, this.opts.transportOptions[name]);
      return new this._transportsByName[name](opts);
    }
    /**
     * Initializes transport to use and starts probe.
     *
     * @private
     */
    _open() {
      if (this.transports.length === 0) {
        this.setTimeoutFn(() => {
          this.emitReserved("error", "No transports available");
        }, 0);
        return;
      }
      const transportName = this.opts.rememberUpgrade && SocketWithoutUpgrade.priorWebsocketSuccess && this.transports.indexOf("websocket") !== -1 ? "websocket" : this.transports[0];
      this.readyState = "opening";
      const transport = this.createTransport(transportName);
      transport.open();
      this.setTransport(transport);
    }
    /**
     * Sets the current transport. Disables the existing one (if any).
     *
     * @private
     */
    setTransport(transport) {
      if (this.transport) {
        this.transport.removeAllListeners();
      }
      this.transport = transport;
      transport.on("drain", this._onDrain.bind(this)).on("packet", this._onPacket.bind(this)).on("error", this._onError.bind(this)).on("close", (reason) => this._onClose("transport close", reason));
    }
    /**
     * Called when connection is deemed open.
     *
     * @private
     */
    onOpen() {
      this.readyState = "open";
      SocketWithoutUpgrade.priorWebsocketSuccess = "websocket" === this.transport.name;
      this.emitReserved("open");
      this.flush();
    }
    /**
     * Handles a packet.
     *
     * @private
     */
    _onPacket(packet) {
      if ("opening" === this.readyState || "open" === this.readyState || "closing" === this.readyState) {
        this.emitReserved("packet", packet);
        this.emitReserved("heartbeat");
        switch (packet.type) {
          case "open":
            this.onHandshake(JSON.parse(packet.data));
            break;
          case "ping":
            this._sendPacket("pong");
            this.emitReserved("ping");
            this.emitReserved("pong");
            this._resetPingTimeout();
            break;
          case "error":
            const err = new Error("server error");
            err.code = packet.data;
            this._onError(err);
            break;
          case "message":
            this.emitReserved("data", packet.data);
            this.emitReserved("message", packet.data);
            break;
        }
      }
    }
    /**
     * Called upon handshake completion.
     *
     * @param {Object} data - handshake obj
     * @private
     */
    onHandshake(data) {
      this.emitReserved("handshake", data);
      this.id = data.sid;
      this.transport.query.sid = data.sid;
      this._pingInterval = data.pingInterval;
      this._pingTimeout = data.pingTimeout;
      this._maxPayload = data.maxPayload;
      this.onOpen();
      if ("closed" === this.readyState)
        return;
      this._resetPingTimeout();
    }
    /**
     * Sets and resets ping timeout timer based on server pings.
     *
     * @private
     */
    _resetPingTimeout() {
      this.clearTimeoutFn(this._pingTimeoutTimer);
      const delay = this._pingInterval + this._pingTimeout;
      this._pingTimeoutTime = Date.now() + delay;
      this._pingTimeoutTimer = this.setTimeoutFn(() => {
        this._onClose("ping timeout");
      }, delay);
      if (this.opts.autoUnref) {
        this._pingTimeoutTimer.unref();
      }
    }
    /**
     * Called on `drain` event
     *
     * @private
     */
    _onDrain() {
      this.writeBuffer.splice(0, this._prevBufferLen);
      this._prevBufferLen = 0;
      if (0 === this.writeBuffer.length) {
        this.emitReserved("drain");
      } else {
        this.flush();
      }
    }
    /**
     * Flush write buffers.
     *
     * @private
     */
    flush() {
      if ("closed" !== this.readyState && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
        const packets = this._getWritablePackets();
        this.transport.send(packets);
        this._prevBufferLen = packets.length;
        this.emitReserved("flush");
      }
    }
    /**
     * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
     * long-polling)
     *
     * @private
     */
    _getWritablePackets() {
      const shouldCheckPayloadSize = this._maxPayload && this.transport.name === "polling" && this.writeBuffer.length > 1;
      if (!shouldCheckPayloadSize) {
        return this.writeBuffer;
      }
      let payloadSize = 1;
      for (let i = 0; i < this.writeBuffer.length; i++) {
        const data = this.writeBuffer[i].data;
        if (data) {
          payloadSize += byteLength(data);
        }
        if (i > 0 && payloadSize > this._maxPayload) {
          return this.writeBuffer.slice(0, i);
        }
        payloadSize += 2;
      }
      return this.writeBuffer;
    }
    /**
     * Checks whether the heartbeat timer has expired but the socket has not yet been notified.
     *
     * Note: this method is private for now because it does not really fit the WebSocket API, but if we put it in the
     * `write()` method then the message would not be buffered by the Socket.IO client.
     *
     * @return {boolean}
     * @private
     */
    /* private */
    _hasPingExpired() {
      if (!this._pingTimeoutTime)
        return true;
      const hasExpired = Date.now() > this._pingTimeoutTime;
      if (hasExpired) {
        this._pingTimeoutTime = 0;
        nextTick(() => {
          this._onClose("ping timeout");
        }, this.setTimeoutFn);
      }
      return hasExpired;
    }
    /**
     * Sends a message.
     *
     * @param {String} msg - message.
     * @param {Object} options.
     * @param {Function} fn - callback function.
     * @return {Socket} for chaining.
     */
    write(msg, options, fn) {
      this._sendPacket("message", msg, options, fn);
      return this;
    }
    /**
     * Sends a message. Alias of {@link Socket#write}.
     *
     * @param {String} msg - message.
     * @param {Object} options.
     * @param {Function} fn - callback function.
     * @return {Socket} for chaining.
     */
    send(msg, options, fn) {
      this._sendPacket("message", msg, options, fn);
      return this;
    }
    /**
     * Sends a packet.
     *
     * @param {String} type: packet type.
     * @param {String} data.
     * @param {Object} options.
     * @param {Function} fn - callback function.
     * @private
     */
    _sendPacket(type, data, options, fn) {
      if ("function" === typeof data) {
        fn = data;
        data = void 0;
      }
      if ("function" === typeof options) {
        fn = options;
        options = null;
      }
      if ("closing" === this.readyState || "closed" === this.readyState) {
        return;
      }
      options = options || {};
      options.compress = false !== options.compress;
      const packet = {
        type,
        data,
        options
      };
      this.emitReserved("packetCreate", packet);
      this.writeBuffer.push(packet);
      if (fn)
        this.once("flush", fn);
      this.flush();
    }
    /**
     * Closes the connection.
     */
    close() {
      const close = () => {
        this._onClose("forced close");
        this.transport.close();
      };
      const cleanupAndClose = () => {
        this.off("upgrade", cleanupAndClose);
        this.off("upgradeError", cleanupAndClose);
        close();
      };
      const waitForUpgrade = () => {
        this.once("upgrade", cleanupAndClose);
        this.once("upgradeError", cleanupAndClose);
      };
      if ("opening" === this.readyState || "open" === this.readyState) {
        this.readyState = "closing";
        if (this.writeBuffer.length) {
          this.once("drain", () => {
            if (this.upgrading) {
              waitForUpgrade();
            } else {
              close();
            }
          });
        } else if (this.upgrading) {
          waitForUpgrade();
        } else {
          close();
        }
      }
      return this;
    }
    /**
     * Called upon transport error
     *
     * @private
     */
    _onError(err) {
      SocketWithoutUpgrade.priorWebsocketSuccess = false;
      if (this.opts.tryAllTransports && this.transports.length > 1 && this.readyState === "opening") {
        this.transports.shift();
        return this._open();
      }
      this.emitReserved("error", err);
      this._onClose("transport error", err);
    }
    /**
     * Called upon transport close.
     *
     * @private
     */
    _onClose(reason, description) {
      if ("opening" === this.readyState || "open" === this.readyState || "closing" === this.readyState) {
        this.clearTimeoutFn(this._pingTimeoutTimer);
        this.transport.removeAllListeners("close");
        this.transport.close();
        this.transport.removeAllListeners();
        if (withEventListeners) {
          if (this._beforeunloadEventListener) {
            removeEventListener("beforeunload", this._beforeunloadEventListener, false);
          }
          if (this._offlineEventListener) {
            const i = OFFLINE_EVENT_LISTENERS.indexOf(this._offlineEventListener);
            if (i !== -1) {
              OFFLINE_EVENT_LISTENERS.splice(i, 1);
            }
          }
        }
        this.readyState = "closed";
        this.id = null;
        this.emitReserved("close", reason, description);
        this.writeBuffer = [];
        this._prevBufferLen = 0;
      }
    }
  }
  SocketWithoutUpgrade.protocol = protocol$1;
  class SocketWithUpgrade extends SocketWithoutUpgrade {
    constructor() {
      super(...arguments);
      this._upgrades = [];
    }
    onOpen() {
      super.onOpen();
      if ("open" === this.readyState && this.opts.upgrade) {
        for (let i = 0; i < this._upgrades.length; i++) {
          this._probe(this._upgrades[i]);
        }
      }
    }
    /**
     * Probes a transport.
     *
     * @param {String} name - transport name
     * @private
     */
    _probe(name) {
      let transport = this.createTransport(name);
      let failed = false;
      SocketWithoutUpgrade.priorWebsocketSuccess = false;
      const onTransportOpen = () => {
        if (failed)
          return;
        transport.send([{ type: "ping", data: "probe" }]);
        transport.once("packet", (msg) => {
          if (failed)
            return;
          if ("pong" === msg.type && "probe" === msg.data) {
            this.upgrading = true;
            this.emitReserved("upgrading", transport);
            if (!transport)
              return;
            SocketWithoutUpgrade.priorWebsocketSuccess = "websocket" === transport.name;
            this.transport.pause(() => {
              if (failed)
                return;
              if ("closed" === this.readyState)
                return;
              cleanup();
              this.setTransport(transport);
              transport.send([{ type: "upgrade" }]);
              this.emitReserved("upgrade", transport);
              transport = null;
              this.upgrading = false;
              this.flush();
            });
          } else {
            const err = new Error("probe error");
            err.transport = transport.name;
            this.emitReserved("upgradeError", err);
          }
        });
      };
      function freezeTransport() {
        if (failed)
          return;
        failed = true;
        cleanup();
        transport.close();
        transport = null;
      }
      const onerror = (err) => {
        const error = new Error("probe error: " + err);
        error.transport = transport.name;
        freezeTransport();
        this.emitReserved("upgradeError", error);
      };
      function onTransportClose() {
        onerror("transport closed");
      }
      function onclose() {
        onerror("socket closed");
      }
      function onupgrade(to) {
        if (transport && to.name !== transport.name) {
          freezeTransport();
        }
      }
      const cleanup = () => {
        transport.removeListener("open", onTransportOpen);
        transport.removeListener("error", onerror);
        transport.removeListener("close", onTransportClose);
        this.off("close", onclose);
        this.off("upgrading", onupgrade);
      };
      transport.once("open", onTransportOpen);
      transport.once("error", onerror);
      transport.once("close", onTransportClose);
      this.once("close", onclose);
      this.once("upgrading", onupgrade);
      if (this._upgrades.indexOf("webtransport") !== -1 && name !== "webtransport") {
        this.setTimeoutFn(() => {
          if (!failed) {
            transport.open();
          }
        }, 200);
      } else {
        transport.open();
      }
    }
    onHandshake(data) {
      this._upgrades = this._filterUpgrades(data.upgrades);
      super.onHandshake(data);
    }
    /**
     * Filters upgrades, returning only those matching client transports.
     *
     * @param {Array} upgrades - server upgrades
     * @private
     */
    _filterUpgrades(upgrades) {
      const filteredUpgrades = [];
      for (let i = 0; i < upgrades.length; i++) {
        if (~this.transports.indexOf(upgrades[i]))
          filteredUpgrades.push(upgrades[i]);
      }
      return filteredUpgrades;
    }
  }
  let Socket$1 = class Socket extends SocketWithUpgrade {
    constructor(uri, opts = {}) {
      const o = typeof uri === "object" ? uri : opts;
      if (!o.transports || o.transports && typeof o.transports[0] === "string") {
        o.transports = (o.transports || ["polling", "websocket", "webtransport"]).map((transportName) => transports[transportName]).filter((t) => !!t);
      }
      super(uri, o);
    }
  };
  function url(uri, path = "", loc) {
    let obj = uri;
    loc = loc || typeof location !== "undefined" && location;
    if (null == uri)
      uri = loc.protocol + "//" + loc.host;
    if (typeof uri === "string") {
      if ("/" === uri.charAt(0)) {
        if ("/" === uri.charAt(1)) {
          uri = loc.protocol + uri;
        } else {
          uri = loc.host + uri;
        }
      }
      if (!/^(https?|wss?):\/\//.test(uri)) {
        if ("undefined" !== typeof loc) {
          uri = loc.protocol + "//" + uri;
        } else {
          uri = "https://" + uri;
        }
      }
      obj = parse(uri);
    }
    if (!obj.port) {
      if (/^(http|ws)$/.test(obj.protocol)) {
        obj.port = "80";
      } else if (/^(http|ws)s$/.test(obj.protocol)) {
        obj.port = "443";
      }
    }
    obj.path = obj.path || "/";
    const ipv6 = obj.host.indexOf(":") !== -1;
    const host = ipv6 ? "[" + obj.host + "]" : obj.host;
    obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
    obj.href = obj.protocol + "://" + host + (loc && loc.port === obj.port ? "" : ":" + obj.port);
    return obj;
  }
  const withNativeArrayBuffer = typeof ArrayBuffer === "function";
  const isView = (obj) => {
    return typeof ArrayBuffer.isView === "function" ? ArrayBuffer.isView(obj) : obj.buffer instanceof ArrayBuffer;
  };
  const toString = Object.prototype.toString;
  const withNativeBlob = typeof Blob === "function" || typeof Blob !== "undefined" && toString.call(Blob) === "[object BlobConstructor]";
  const withNativeFile = typeof File === "function" || typeof File !== "undefined" && toString.call(File) === "[object FileConstructor]";
  function isBinary(obj) {
    return withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj)) || withNativeBlob && obj instanceof Blob || withNativeFile && obj instanceof File;
  }
  function hasBinary(obj, toJSON) {
    if (!obj || typeof obj !== "object") {
      return false;
    }
    if (Array.isArray(obj)) {
      for (let i = 0, l = obj.length; i < l; i++) {
        if (hasBinary(obj[i])) {
          return true;
        }
      }
      return false;
    }
    if (isBinary(obj)) {
      return true;
    }
    if (obj.toJSON && typeof obj.toJSON === "function" && arguments.length === 1) {
      return hasBinary(obj.toJSON(), true);
    }
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
        return true;
      }
    }
    return false;
  }
  function deconstructPacket(packet) {
    const buffers = [];
    const packetData = packet.data;
    const pack = packet;
    pack.data = _deconstructPacket(packetData, buffers);
    pack.attachments = buffers.length;
    return { packet: pack, buffers };
  }
  function _deconstructPacket(data, buffers) {
    if (!data)
      return data;
    if (isBinary(data)) {
      const placeholder = { _placeholder: true, num: buffers.length };
      buffers.push(data);
      return placeholder;
    } else if (Array.isArray(data)) {
      const newData = new Array(data.length);
      for (let i = 0; i < data.length; i++) {
        newData[i] = _deconstructPacket(data[i], buffers);
      }
      return newData;
    } else if (typeof data === "object" && !(data instanceof Date)) {
      const newData = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          newData[key] = _deconstructPacket(data[key], buffers);
        }
      }
      return newData;
    }
    return data;
  }
  function reconstructPacket(packet, buffers) {
    packet.data = _reconstructPacket(packet.data, buffers);
    delete packet.attachments;
    return packet;
  }
  function _reconstructPacket(data, buffers) {
    if (!data)
      return data;
    if (data && data._placeholder === true) {
      const isIndexValid = typeof data.num === "number" && data.num >= 0 && data.num < buffers.length;
      if (isIndexValid) {
        return buffers[data.num];
      } else {
        throw new Error("illegal attachments");
      }
    } else if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        data[i] = _reconstructPacket(data[i], buffers);
      }
    } else if (typeof data === "object") {
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          data[key] = _reconstructPacket(data[key], buffers);
        }
      }
    }
    return data;
  }
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var browser = { exports: {} };
  var ms;
  var hasRequiredMs;
  function requireMs() {
    if (hasRequiredMs)
      return ms;
    hasRequiredMs = 1;
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    ms = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse2(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse2(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d) {
        return Math.round(ms2 / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms2 / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms2 / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms2 / s) + "s";
      }
      return ms2 + "ms";
    }
    function fmtLong(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d) {
        return plural(ms2, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms2, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms2, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms2, msAbs, s, "second");
      }
      return ms2 + " ms";
    }
    function plural(ms2, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms2 / n) + " " + name + (isPlural ? "s" : "");
    }
    return ms;
  }
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = requireMs();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0; i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug2(...args) {
        if (!debug2.enabled) {
          return;
        }
        const self2 = debug2;
        const curr = Number(/* @__PURE__ */ new Date());
        const ms2 = curr - (prevTime || curr);
        self2.diff = ms2;
        self2.prev = prevTime;
        self2.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self2, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self2, args);
        const logFn = self2.log || createDebug.log;
        logFn.apply(self2, args);
      }
      debug2.namespace = namespace;
      debug2.useColors = createDebug.useColors();
      debug2.color = createDebug.selectColor(namespace);
      debug2.extend = extend;
      debug2.destroy = createDebug.destroy;
      Object.defineProperty(debug2, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug2);
      }
      return debug2;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const ns of split) {
        if (ns[0] === "-") {
          createDebug.skips.push(ns.slice(1));
        } else {
          createDebug.names.push(ns);
        }
      }
    }
    function matchesTemplate(search, template) {
      let searchIndex = 0;
      let templateIndex = 0;
      let starIndex = -1;
      let matchIndex = 0;
      while (searchIndex < search.length) {
        if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
          if (template[templateIndex] === "*") {
            starIndex = templateIndex;
            matchIndex = searchIndex;
            templateIndex++;
          } else {
            searchIndex++;
            templateIndex++;
          }
        } else if (starIndex !== -1) {
          templateIndex = starIndex + 1;
          matchIndex++;
          searchIndex = matchIndex;
        } else {
          return false;
        }
      }
      while (templateIndex < template.length && template[templateIndex] === "*") {
        templateIndex++;
      }
      return templateIndex === template.length;
    }
    function disable() {
      const namespaces = [
        ...createDebug.names,
        ...createDebug.skips.map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      for (const skip of createDebug.skips) {
        if (matchesTemplate(name, skip)) {
          return false;
        }
      }
      for (const ns of createDebug.names) {
        if (matchesTemplate(name, ns)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      formatAppLog("warn", "at node_modules/debug/src/common.js:284", "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  var common = setup;
  (function(module, exports) {
    var define_process_env_default = {};
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          formatAppLog("warn", "at node_modules/debug/src/browser.js:18", "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = define_process_env_default.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = common(exports);
    const { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  })(browser, browser.exports);
  var browserExports = browser.exports;
  const debugModule = /* @__PURE__ */ getDefaultExportFromCjs(browserExports);
  const debug = debugModule("socket.io-parser");
  const RESERVED_EVENTS$1 = [
    "connect",
    // used on the client side
    "connect_error",
    // used on the client side
    "disconnect",
    // used on both sides
    "disconnecting",
    // used on the server side
    "newListener",
    // used by the Node.js EventEmitter
    "removeListener"
    // used by the Node.js EventEmitter
  ];
  const protocol = 5;
  var PacketType;
  (function(PacketType2) {
    PacketType2[PacketType2["CONNECT"] = 0] = "CONNECT";
    PacketType2[PacketType2["DISCONNECT"] = 1] = "DISCONNECT";
    PacketType2[PacketType2["EVENT"] = 2] = "EVENT";
    PacketType2[PacketType2["ACK"] = 3] = "ACK";
    PacketType2[PacketType2["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
    PacketType2[PacketType2["BINARY_EVENT"] = 5] = "BINARY_EVENT";
    PacketType2[PacketType2["BINARY_ACK"] = 6] = "BINARY_ACK";
  })(PacketType || (PacketType = {}));
  class Encoder {
    /**
     * Encoder constructor
     *
     * @param {function} replacer - custom replacer to pass down to JSON.parse
     */
    constructor(replacer) {
      this.replacer = replacer;
    }
    /**
     * Encode a packet as a single string if non-binary, or as a
     * buffer sequence, depending on packet type.
     *
     * @param {Object} obj - packet object
     */
    encode(obj) {
      debug("encoding packet %j", obj);
      if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
        if (hasBinary(obj)) {
          return this.encodeAsBinary({
            type: obj.type === PacketType.EVENT ? PacketType.BINARY_EVENT : PacketType.BINARY_ACK,
            nsp: obj.nsp,
            data: obj.data,
            id: obj.id
          });
        }
      }
      return [this.encodeAsString(obj)];
    }
    /**
     * Encode packet as string.
     */
    encodeAsString(obj) {
      let str = "" + obj.type;
      if (obj.type === PacketType.BINARY_EVENT || obj.type === PacketType.BINARY_ACK) {
        str += obj.attachments + "-";
      }
      if (obj.nsp && "/" !== obj.nsp) {
        str += obj.nsp + ",";
      }
      if (null != obj.id) {
        str += obj.id;
      }
      if (null != obj.data) {
        str += JSON.stringify(obj.data, this.replacer);
      }
      debug("encoded %j as %s", obj, str);
      return str;
    }
    /**
     * Encode packet as 'buffer sequence' by removing blobs, and
     * deconstructing packet into object with placeholders and
     * a list of buffers.
     */
    encodeAsBinary(obj) {
      const deconstruction = deconstructPacket(obj);
      const pack = this.encodeAsString(deconstruction.packet);
      const buffers = deconstruction.buffers;
      buffers.unshift(pack);
      return buffers;
    }
  }
  class Decoder extends Emitter {
    /**
     * Decoder constructor
     */
    constructor(opts) {
      super();
      this.opts = Object.assign({
        reviver: void 0,
        maxAttachments: 10
      }, typeof opts === "function" ? { reviver: opts } : opts);
    }
    /**
     * Decodes an encoded packet string into packet JSON.
     *
     * @param {String} obj - encoded packet
     */
    add(obj) {
      let packet;
      if (typeof obj === "string") {
        if (this.reconstructor) {
          throw new Error("got plaintext data when reconstructing a packet");
        }
        packet = this.decodeString(obj);
        const isBinaryEvent = packet.type === PacketType.BINARY_EVENT;
        if (isBinaryEvent || packet.type === PacketType.BINARY_ACK) {
          packet.type = isBinaryEvent ? PacketType.EVENT : PacketType.ACK;
          this.reconstructor = new BinaryReconstructor(packet);
          if (packet.attachments === 0) {
            super.emitReserved("decoded", packet);
          }
        } else {
          super.emitReserved("decoded", packet);
        }
      } else if (isBinary(obj) || obj.base64) {
        if (!this.reconstructor) {
          throw new Error("got binary data when not reconstructing a packet");
        } else {
          packet = this.reconstructor.takeBinaryData(obj);
          if (packet) {
            this.reconstructor = null;
            super.emitReserved("decoded", packet);
          }
        }
      } else {
        throw new Error("Unknown type: " + obj);
      }
    }
    /**
     * Decode a packet String (JSON data)
     *
     * @param {String} str
     * @return {Object} packet
     */
    decodeString(str) {
      let i = 0;
      const p = {
        type: Number(str.charAt(0))
      };
      if (PacketType[p.type] === void 0) {
        throw new Error("unknown packet type " + p.type);
      }
      if (p.type === PacketType.BINARY_EVENT || p.type === PacketType.BINARY_ACK) {
        const start = i + 1;
        while (str.charAt(++i) !== "-" && i != str.length) {
        }
        const buf = str.substring(start, i);
        if (buf != Number(buf) || str.charAt(i) !== "-") {
          throw new Error("Illegal attachments");
        }
        const n = Number(buf);
        if (!isInteger(n) || n < 0) {
          throw new Error("Illegal attachments");
        } else if (n > this.opts.maxAttachments) {
          throw new Error("too many attachments");
        }
        p.attachments = n;
      }
      if ("/" === str.charAt(i + 1)) {
        const start = i + 1;
        while (++i) {
          const c = str.charAt(i);
          if ("," === c)
            break;
          if (i === str.length)
            break;
        }
        p.nsp = str.substring(start, i);
      } else {
        p.nsp = "/";
      }
      const next = str.charAt(i + 1);
      if ("" !== next && Number(next) == next) {
        const start = i + 1;
        while (++i) {
          const c = str.charAt(i);
          if (null == c || Number(c) != c) {
            --i;
            break;
          }
          if (i === str.length)
            break;
        }
        p.id = Number(str.substring(start, i + 1));
      }
      if (str.charAt(++i)) {
        const payload = this.tryParse(str.substr(i));
        if (Decoder.isPayloadValid(p.type, payload)) {
          p.data = payload;
        } else {
          throw new Error("invalid payload");
        }
      }
      debug("decoded %s as %j", str, p);
      return p;
    }
    tryParse(str) {
      try {
        return JSON.parse(str, this.opts.reviver);
      } catch (e) {
        return false;
      }
    }
    static isPayloadValid(type, payload) {
      switch (type) {
        case PacketType.CONNECT:
          return isObject(payload);
        case PacketType.DISCONNECT:
          return payload === void 0;
        case PacketType.CONNECT_ERROR:
          return typeof payload === "string" || isObject(payload);
        case PacketType.EVENT:
        case PacketType.BINARY_EVENT:
          return Array.isArray(payload) && (typeof payload[0] === "number" || typeof payload[0] === "string" && RESERVED_EVENTS$1.indexOf(payload[0]) === -1);
        case PacketType.ACK:
        case PacketType.BINARY_ACK:
          return Array.isArray(payload);
      }
    }
    /**
     * Deallocates a parser's resources
     */
    destroy() {
      if (this.reconstructor) {
        this.reconstructor.finishedReconstruction();
        this.reconstructor = null;
      }
    }
  }
  class BinaryReconstructor {
    constructor(packet) {
      this.packet = packet;
      this.buffers = [];
      this.reconPack = packet;
    }
    /**
     * Method to be called when binary data received from connection
     * after a BINARY_EVENT packet.
     *
     * @param {Buffer | ArrayBuffer} binData - the raw binary data received
     * @return {null | Object} returns null if more binary data is expected or
     *   a reconstructed packet object if all buffers have been received.
     */
    takeBinaryData(binData) {
      this.buffers.push(binData);
      if (this.buffers.length === this.reconPack.attachments) {
        const packet = reconstructPacket(this.reconPack, this.buffers);
        this.finishedReconstruction();
        return packet;
      }
      return null;
    }
    /**
     * Cleans up binary packet reconstruction variables.
     */
    finishedReconstruction() {
      this.reconPack = null;
      this.buffers = [];
    }
  }
  function isNamespaceValid(nsp) {
    return typeof nsp === "string";
  }
  const isInteger = Number.isInteger || function(value2) {
    return typeof value2 === "number" && isFinite(value2) && Math.floor(value2) === value2;
  };
  function isAckIdValid(id) {
    return id === void 0 || isInteger(id);
  }
  function isObject(value2) {
    return Object.prototype.toString.call(value2) === "[object Object]";
  }
  function isDataValid(type, payload) {
    switch (type) {
      case PacketType.CONNECT:
        return payload === void 0 || isObject(payload);
      case PacketType.DISCONNECT:
        return payload === void 0;
      case PacketType.EVENT:
        return Array.isArray(payload) && (typeof payload[0] === "number" || typeof payload[0] === "string" && RESERVED_EVENTS$1.indexOf(payload[0]) === -1);
      case PacketType.ACK:
        return Array.isArray(payload);
      case PacketType.CONNECT_ERROR:
        return typeof payload === "string" || isObject(payload);
      default:
        return false;
    }
  }
  function isPacketValid(packet) {
    return isNamespaceValid(packet.nsp) && isAckIdValid(packet.id) && isDataValid(packet.type, packet.data);
  }
  const parser = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    Decoder,
    Encoder,
    get PacketType() {
      return PacketType;
    },
    isPacketValid,
    protocol
  }, Symbol.toStringTag, { value: "Module" }));
  function on(obj, ev, fn) {
    obj.on(ev, fn);
    return function subDestroy() {
      obj.off(ev, fn);
    };
  }
  const RESERVED_EVENTS = Object.freeze({
    connect: 1,
    connect_error: 1,
    disconnect: 1,
    disconnecting: 1,
    // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
    newListener: 1,
    removeListener: 1
  });
  class Socket extends Emitter {
    /**
     * `Socket` constructor.
     */
    constructor(io, nsp, opts) {
      super();
      this.connected = false;
      this.recovered = false;
      this.receiveBuffer = [];
      this.sendBuffer = [];
      this._queue = [];
      this._queueSeq = 0;
      this.ids = 0;
      this.acks = {};
      this.flags = {};
      this.io = io;
      this.nsp = nsp;
      if (opts && opts.auth) {
        this.auth = opts.auth;
      }
      this._opts = Object.assign({}, opts);
      if (this.io._autoConnect)
        this.open();
    }
    /**
     * Whether the socket is currently disconnected
     *
     * @example
     * const socket = io();
     *
     * socket.on("connect", () => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:129',socket.disconnected); // false
     * });
     *
     * socket.on("disconnect", () => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:133',socket.disconnected); // true
     * });
     */
    get disconnected() {
      return !this.connected;
    }
    /**
     * Subscribe to open, close and packet events
     *
     * @private
     */
    subEvents() {
      if (this.subs)
        return;
      const io = this.io;
      this.subs = [
        on(io, "open", this.onopen.bind(this)),
        on(io, "packet", this.onpacket.bind(this)),
        on(io, "error", this.onerror.bind(this)),
        on(io, "close", this.onclose.bind(this))
      ];
    }
    /**
     * Whether the Socket will try to reconnect when its Manager connects or reconnects.
     *
     * @example
     * const socket = io();
     *
     * __f__('log','at node_modules/socket.io-client/build/esm/socket.js:161',socket.active); // true
     *
     * socket.on("disconnect", (reason) => {
     *   if (reason === "io server disconnect") {
     *     // the disconnection was initiated by the server, you need to manually reconnect
     *     __f__('log','at node_modules/socket.io-client/build/esm/socket.js:166',socket.active); // false
     *   }
     *   // else the socket will automatically try to reconnect
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:169',socket.active); // true
     * });
     */
    get active() {
      return !!this.subs;
    }
    /**
     * "Opens" the socket.
     *
     * @example
     * const socket = io({
     *   autoConnect: false
     * });
     *
     * socket.connect();
     */
    connect() {
      if (this.connected)
        return this;
      this.subEvents();
      if (!this.io["_reconnecting"])
        this.io.open();
      if ("open" === this.io._readyState)
        this.onopen();
      return this;
    }
    /**
     * Alias for {@link connect()}.
     */
    open() {
      return this.connect();
    }
    /**
     * Sends a `message` event.
     *
     * This method mimics the WebSocket.send() method.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
     *
     * @example
     * socket.send("hello");
     *
     * // this is equivalent to
     * socket.emit("message", "hello");
     *
     * @return self
     */
    send(...args) {
      args.unshift("message");
      this.emit.apply(this, args);
      return this;
    }
    /**
     * Override `emit`.
     * If the event is in `events`, it's emitted normally.
     *
     * @example
     * socket.emit("hello", "world");
     *
     * // all serializable datastructures are supported (no need to call JSON.stringify)
     * socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
     *
     * // with an acknowledgement from the server
     * socket.emit("hello", "world", (val) => {
     *   // ...
     * });
     *
     * @return self
     */
    emit(ev, ...args) {
      var _a, _b, _c;
      if (RESERVED_EVENTS.hasOwnProperty(ev)) {
        throw new Error('"' + ev.toString() + '" is a reserved event name');
      }
      args.unshift(ev);
      if (this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) {
        this._addToQueue(args);
        return this;
      }
      const packet = {
        type: PacketType.EVENT,
        data: args
      };
      packet.options = {};
      packet.options.compress = this.flags.compress !== false;
      if ("function" === typeof args[args.length - 1]) {
        const id = this.ids++;
        const ack = args.pop();
        this._registerAckCallback(id, ack);
        packet.id = id;
      }
      const isTransportWritable = (_b = (_a = this.io.engine) === null || _a === void 0 ? void 0 : _a.transport) === null || _b === void 0 ? void 0 : _b.writable;
      const isConnected = this.connected && !((_c = this.io.engine) === null || _c === void 0 ? void 0 : _c._hasPingExpired());
      const discardPacket = this.flags.volatile && !isTransportWritable;
      if (discardPacket)
        ;
      else if (isConnected) {
        this.notifyOutgoingListeners(packet);
        this.packet(packet);
      } else {
        this.sendBuffer.push(packet);
      }
      this.flags = {};
      return this;
    }
    /**
     * @private
     */
    _registerAckCallback(id, ack) {
      var _a;
      const timeout = (_a = this.flags.timeout) !== null && _a !== void 0 ? _a : this._opts.ackTimeout;
      if (timeout === void 0) {
        this.acks[id] = ack;
        return;
      }
      const timer = this.io.setTimeoutFn(() => {
        delete this.acks[id];
        for (let i = 0; i < this.sendBuffer.length; i++) {
          if (this.sendBuffer[i].id === id) {
            this.sendBuffer.splice(i, 1);
          }
        }
        ack.call(this, new Error("operation has timed out"));
      }, timeout);
      const fn = (...args) => {
        this.io.clearTimeoutFn(timer);
        ack.apply(this, args);
      };
      fn.withError = true;
      this.acks[id] = fn;
    }
    /**
     * Emits an event and waits for an acknowledgement
     *
     * @example
     * // without timeout
     * const response = await socket.emitWithAck("hello", "world");
     *
     * // with a specific timeout
     * try {
     *   const response = await socket.timeout(1000).emitWithAck("hello", "world");
     * } catch (err) {
     *   // the server did not acknowledge the event in the given delay
     * }
     *
     * @return a Promise that will be fulfilled when the server acknowledges the event
     */
    emitWithAck(ev, ...args) {
      return new Promise((resolve, reject) => {
        const fn = (arg1, arg2) => {
          return arg1 ? reject(arg1) : resolve(arg2);
        };
        fn.withError = true;
        args.push(fn);
        this.emit(ev, ...args);
      });
    }
    /**
     * Add the packet to the queue.
     * @param args
     * @private
     */
    _addToQueue(args) {
      let ack;
      if (typeof args[args.length - 1] === "function") {
        ack = args.pop();
      }
      const packet = {
        id: this._queueSeq++,
        tryCount: 0,
        pending: false,
        args,
        flags: Object.assign({ fromQueue: true }, this.flags)
      };
      args.push((err, ...responseArgs) => {
        if (packet !== this._queue[0])
          ;
        const hasError = err !== null;
        if (hasError) {
          if (packet.tryCount > this._opts.retries) {
            this._queue.shift();
            if (ack) {
              ack(err);
            }
          }
        } else {
          this._queue.shift();
          if (ack) {
            ack(null, ...responseArgs);
          }
        }
        packet.pending = false;
        return this._drainQueue();
      });
      this._queue.push(packet);
      this._drainQueue();
    }
    /**
     * Send the first packet of the queue, and wait for an acknowledgement from the server.
     * @param force - whether to resend a packet that has not been acknowledged yet
     *
     * @private
     */
    _drainQueue(force = false) {
      if (!this.connected || this._queue.length === 0) {
        return;
      }
      const packet = this._queue[0];
      if (packet.pending && !force) {
        return;
      }
      packet.pending = true;
      packet.tryCount++;
      this.flags = packet.flags;
      this.emit.apply(this, packet.args);
    }
    /**
     * Sends a packet.
     *
     * @param packet
     * @private
     */
    packet(packet) {
      packet.nsp = this.nsp;
      this.io._packet(packet);
    }
    /**
     * Called upon engine `open`.
     *
     * @private
     */
    onopen() {
      if (typeof this.auth == "function") {
        this.auth((data) => {
          this._sendConnectPacket(data);
        });
      } else {
        this._sendConnectPacket(this.auth);
      }
    }
    /**
     * Sends a CONNECT packet to initiate the Socket.IO session.
     *
     * @param data
     * @private
     */
    _sendConnectPacket(data) {
      this.packet({
        type: PacketType.CONNECT,
        data: this._pid ? Object.assign({ pid: this._pid, offset: this._lastOffset }, data) : data
      });
    }
    /**
     * Called upon engine or manager `error`.
     *
     * @param err
     * @private
     */
    onerror(err) {
      if (!this.connected) {
        this.emitReserved("connect_error", err);
      }
    }
    /**
     * Called upon engine `close`.
     *
     * @param reason
     * @param description
     * @private
     */
    onclose(reason, description) {
      this.connected = false;
      delete this.id;
      this.emitReserved("disconnect", reason, description);
      this._clearAcks();
    }
    /**
     * Clears the acknowledgement handlers upon disconnection, since the client will never receive an acknowledgement from
     * the server.
     *
     * @private
     */
    _clearAcks() {
      Object.keys(this.acks).forEach((id) => {
        const isBuffered = this.sendBuffer.some((packet) => String(packet.id) === id);
        if (!isBuffered) {
          const ack = this.acks[id];
          delete this.acks[id];
          if (ack.withError) {
            ack.call(this, new Error("socket has been disconnected"));
          }
        }
      });
    }
    /**
     * Called with socket packet.
     *
     * @param packet
     * @private
     */
    onpacket(packet) {
      const sameNamespace = packet.nsp === this.nsp;
      if (!sameNamespace)
        return;
      switch (packet.type) {
        case PacketType.CONNECT:
          if (packet.data && packet.data.sid) {
            this.onconnect(packet.data.sid, packet.data.pid);
          } else {
            this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
          }
          break;
        case PacketType.EVENT:
        case PacketType.BINARY_EVENT:
          this.onevent(packet);
          break;
        case PacketType.ACK:
        case PacketType.BINARY_ACK:
          this.onack(packet);
          break;
        case PacketType.DISCONNECT:
          this.ondisconnect();
          break;
        case PacketType.CONNECT_ERROR:
          this.destroy();
          const err = new Error(packet.data.message);
          err.data = packet.data.data;
          this.emitReserved("connect_error", err);
          break;
      }
    }
    /**
     * Called upon a server event.
     *
     * @param packet
     * @private
     */
    onevent(packet) {
      const args = packet.data || [];
      if (null != packet.id) {
        args.push(this.ack(packet.id));
      }
      if (this.connected) {
        this.emitEvent(args);
      } else {
        this.receiveBuffer.push(Object.freeze(args));
      }
    }
    emitEvent(args) {
      if (this._anyListeners && this._anyListeners.length) {
        const listeners = this._anyListeners.slice();
        for (const listener of listeners) {
          listener.apply(this, args);
        }
      }
      super.emit.apply(this, args);
      if (this._pid && args.length && typeof args[args.length - 1] === "string") {
        this._lastOffset = args[args.length - 1];
      }
    }
    /**
     * Produces an ack callback to emit with an event.
     *
     * @private
     */
    ack(id) {
      const self2 = this;
      let sent = false;
      return function(...args) {
        if (sent)
          return;
        sent = true;
        self2.packet({
          type: PacketType.ACK,
          id,
          data: args
        });
      };
    }
    /**
     * Called upon a server acknowledgement.
     *
     * @param packet
     * @private
     */
    onack(packet) {
      const ack = this.acks[packet.id];
      if (typeof ack !== "function") {
        return;
      }
      delete this.acks[packet.id];
      if (ack.withError) {
        packet.data.unshift(null);
      }
      ack.apply(this, packet.data);
    }
    /**
     * Called upon server connect.
     *
     * @private
     */
    onconnect(id, pid) {
      this.id = id;
      this.recovered = pid && this._pid === pid;
      this._pid = pid;
      this.connected = true;
      this.emitBuffered();
      this._drainQueue(true);
      this.emitReserved("connect");
    }
    /**
     * Emit buffered events (received and emitted).
     *
     * @private
     */
    emitBuffered() {
      this.receiveBuffer.forEach((args) => this.emitEvent(args));
      this.receiveBuffer = [];
      this.sendBuffer.forEach((packet) => {
        this.notifyOutgoingListeners(packet);
        this.packet(packet);
      });
      this.sendBuffer = [];
    }
    /**
     * Called upon server disconnect.
     *
     * @private
     */
    ondisconnect() {
      this.destroy();
      this.onclose("io server disconnect");
    }
    /**
     * Called upon forced client/server side disconnections,
     * this method ensures the manager stops tracking us and
     * that reconnections don't get triggered for this.
     *
     * @private
     */
    destroy() {
      if (this.subs) {
        this.subs.forEach((subDestroy) => subDestroy());
        this.subs = void 0;
      }
      this.io["_destroy"](this);
    }
    /**
     * Disconnects the socket manually. In that case, the socket will not try to reconnect.
     *
     * If this is the last active Socket instance of the {@link Manager}, the low-level connection will be closed.
     *
     * @example
     * const socket = io();
     *
     * socket.on("disconnect", (reason) => {
     *   // __f__('log','at node_modules/socket.io-client/build/esm/socket.js:641',reason); prints "io client disconnect"
     * });
     *
     * socket.disconnect();
     *
     * @return self
     */
    disconnect() {
      if (this.connected) {
        this.packet({ type: PacketType.DISCONNECT });
      }
      this.destroy();
      if (this.connected) {
        this.onclose("io client disconnect");
      }
      return this;
    }
    /**
     * Alias for {@link disconnect()}.
     *
     * @return self
     */
    close() {
      return this.disconnect();
    }
    /**
     * Sets the compress flag.
     *
     * @example
     * socket.compress(false).emit("hello");
     *
     * @param compress - if `true`, compresses the sending data
     * @return self
     */
    compress(compress) {
      this.flags.compress = compress;
      return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
     * ready to send messages.
     *
     * @example
     * socket.volatile.emit("hello"); // the server may or may not receive it
     *
     * @returns self
     */
    get volatile() {
      this.flags.volatile = true;
      return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
     * given number of milliseconds have elapsed without an acknowledgement from the server:
     *
     * @example
     * socket.timeout(5000).emit("my-event", (err) => {
     *   if (err) {
     *     // the server did not acknowledge the event in the given delay
     *   }
     * });
     *
     * @returns self
     */
    timeout(timeout) {
      this.flags.timeout = timeout;
      return this;
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback.
     *
     * @example
     * socket.onAny((event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:717',`got ${event}`);
     * });
     *
     * @param listener
     */
    onAny(listener) {
      this._anyListeners = this._anyListeners || [];
      this._anyListeners.push(listener);
      return this;
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback. The listener is added to the beginning of the listeners array.
     *
     * @example
     * socket.prependAny((event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:733',`got event ${event}`);
     * });
     *
     * @param listener
     */
    prependAny(listener) {
      this._anyListeners = this._anyListeners || [];
      this._anyListeners.unshift(listener);
      return this;
    }
    /**
     * Removes the listener that will be fired when any event is emitted.
     *
     * @example
     * const catchAllListener = (event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:748',`got event ${event}`);
     * }
     *
     * socket.onAny(catchAllListener);
     *
     * // remove a specific listener
     * socket.offAny(catchAllListener);
     *
     * // or remove all listeners
     * socket.offAny();
     *
     * @param listener
     */
    offAny(listener) {
      if (!this._anyListeners) {
        return this;
      }
      if (listener) {
        const listeners = this._anyListeners;
        for (let i = 0; i < listeners.length; i++) {
          if (listener === listeners[i]) {
            listeners.splice(i, 1);
            return this;
          }
        }
      } else {
        this._anyListeners = [];
      }
      return this;
    }
    /**
     * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
     * e.g. to remove listeners.
     */
    listenersAny() {
      return this._anyListeners || [];
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback.
     *
     * Note: acknowledgements sent to the server are not included.
     *
     * @example
     * socket.onAnyOutgoing((event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:794',`sent event ${event}`);
     * });
     *
     * @param listener
     */
    onAnyOutgoing(listener) {
      this._anyOutgoingListeners = this._anyOutgoingListeners || [];
      this._anyOutgoingListeners.push(listener);
      return this;
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback. The listener is added to the beginning of the listeners array.
     *
     * Note: acknowledgements sent to the server are not included.
     *
     * @example
     * socket.prependAnyOutgoing((event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:812',`sent event ${event}`);
     * });
     *
     * @param listener
     */
    prependAnyOutgoing(listener) {
      this._anyOutgoingListeners = this._anyOutgoingListeners || [];
      this._anyOutgoingListeners.unshift(listener);
      return this;
    }
    /**
     * Removes the listener that will be fired when any event is emitted.
     *
     * @example
     * const catchAllListener = (event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:827',`sent event ${event}`);
     * }
     *
     * socket.onAnyOutgoing(catchAllListener);
     *
     * // remove a specific listener
     * socket.offAnyOutgoing(catchAllListener);
     *
     * // or remove all listeners
     * socket.offAnyOutgoing();
     *
     * @param [listener] - the catch-all listener (optional)
     */
    offAnyOutgoing(listener) {
      if (!this._anyOutgoingListeners) {
        return this;
      }
      if (listener) {
        const listeners = this._anyOutgoingListeners;
        for (let i = 0; i < listeners.length; i++) {
          if (listener === listeners[i]) {
            listeners.splice(i, 1);
            return this;
          }
        }
      } else {
        this._anyOutgoingListeners = [];
      }
      return this;
    }
    /**
     * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
     * e.g. to remove listeners.
     */
    listenersAnyOutgoing() {
      return this._anyOutgoingListeners || [];
    }
    /**
     * Notify the listeners for each packet sent
     *
     * @param packet
     *
     * @private
     */
    notifyOutgoingListeners(packet) {
      if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
        const listeners = this._anyOutgoingListeners.slice();
        for (const listener of listeners) {
          listener.apply(this, packet.data);
        }
      }
    }
  }
  function Backoff(opts) {
    opts = opts || {};
    this.ms = opts.min || 100;
    this.max = opts.max || 1e4;
    this.factor = opts.factor || 2;
    this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
    this.attempts = 0;
  }
  Backoff.prototype.duration = function() {
    var ms2 = this.ms * Math.pow(this.factor, this.attempts++);
    if (this.jitter) {
      var rand = Math.random();
      var deviation = Math.floor(rand * this.jitter * ms2);
      ms2 = (Math.floor(rand * 10) & 1) == 0 ? ms2 - deviation : ms2 + deviation;
    }
    return Math.min(ms2, this.max) | 0;
  };
  Backoff.prototype.reset = function() {
    this.attempts = 0;
  };
  Backoff.prototype.setMin = function(min) {
    this.ms = min;
  };
  Backoff.prototype.setMax = function(max) {
    this.max = max;
  };
  Backoff.prototype.setJitter = function(jitter) {
    this.jitter = jitter;
  };
  class Manager extends Emitter {
    constructor(uri, opts) {
      var _a;
      super();
      this.nsps = {};
      this.subs = [];
      if (uri && "object" === typeof uri) {
        opts = uri;
        uri = void 0;
      }
      opts = opts || {};
      opts.path = opts.path || "/socket.io";
      this.opts = opts;
      installTimerFunctions(this, opts);
      this.reconnection(opts.reconnection !== false);
      this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
      this.reconnectionDelay(opts.reconnectionDelay || 1e3);
      this.reconnectionDelayMax(opts.reconnectionDelayMax || 5e3);
      this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
      this.backoff = new Backoff({
        min: this.reconnectionDelay(),
        max: this.reconnectionDelayMax(),
        jitter: this.randomizationFactor()
      });
      this.timeout(null == opts.timeout ? 2e4 : opts.timeout);
      this._readyState = "closed";
      this.uri = uri;
      const _parser = opts.parser || parser;
      this.encoder = new _parser.Encoder();
      this.decoder = new _parser.Decoder();
      this._autoConnect = opts.autoConnect !== false;
      if (this._autoConnect)
        this.open();
    }
    reconnection(v) {
      if (!arguments.length)
        return this._reconnection;
      this._reconnection = !!v;
      if (!v) {
        this.skipReconnect = true;
      }
      return this;
    }
    reconnectionAttempts(v) {
      if (v === void 0)
        return this._reconnectionAttempts;
      this._reconnectionAttempts = v;
      return this;
    }
    reconnectionDelay(v) {
      var _a;
      if (v === void 0)
        return this._reconnectionDelay;
      this._reconnectionDelay = v;
      (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
      return this;
    }
    randomizationFactor(v) {
      var _a;
      if (v === void 0)
        return this._randomizationFactor;
      this._randomizationFactor = v;
      (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
      return this;
    }
    reconnectionDelayMax(v) {
      var _a;
      if (v === void 0)
        return this._reconnectionDelayMax;
      this._reconnectionDelayMax = v;
      (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
      return this;
    }
    timeout(v) {
      if (!arguments.length)
        return this._timeout;
      this._timeout = v;
      return this;
    }
    /**
     * Starts trying to reconnect if reconnection is enabled and we have not
     * started reconnecting yet
     *
     * @private
     */
    maybeReconnectOnOpen() {
      if (!this._reconnecting && this._reconnection && this.backoff.attempts === 0) {
        this.reconnect();
      }
    }
    /**
     * Sets the current transport `socket`.
     *
     * @param {Function} fn - optional, callback
     * @return self
     * @public
     */
    open(fn) {
      if (~this._readyState.indexOf("open"))
        return this;
      this.engine = new Socket$1(this.uri, this.opts);
      const socket2 = this.engine;
      const self2 = this;
      this._readyState = "opening";
      this.skipReconnect = false;
      const openSubDestroy = on(socket2, "open", function() {
        self2.onopen();
        fn && fn();
      });
      const onError = (err) => {
        this.cleanup();
        this._readyState = "closed";
        this.emitReserved("error", err);
        if (fn) {
          fn(err);
        } else {
          this.maybeReconnectOnOpen();
        }
      };
      const errorSub = on(socket2, "error", onError);
      if (false !== this._timeout) {
        const timeout = this._timeout;
        const timer = this.setTimeoutFn(() => {
          openSubDestroy();
          onError(new Error("timeout"));
          socket2.close();
        }, timeout);
        if (this.opts.autoUnref) {
          timer.unref();
        }
        this.subs.push(() => {
          this.clearTimeoutFn(timer);
        });
      }
      this.subs.push(openSubDestroy);
      this.subs.push(errorSub);
      return this;
    }
    /**
     * Alias for open()
     *
     * @return self
     * @public
     */
    connect(fn) {
      return this.open(fn);
    }
    /**
     * Called upon transport open.
     *
     * @private
     */
    onopen() {
      this.cleanup();
      this._readyState = "open";
      this.emitReserved("open");
      const socket2 = this.engine;
      this.subs.push(
        on(socket2, "ping", this.onping.bind(this)),
        on(socket2, "data", this.ondata.bind(this)),
        on(socket2, "error", this.onerror.bind(this)),
        on(socket2, "close", this.onclose.bind(this)),
        // @ts-ignore
        on(this.decoder, "decoded", this.ondecoded.bind(this))
      );
    }
    /**
     * Called upon a ping.
     *
     * @private
     */
    onping() {
      this.emitReserved("ping");
    }
    /**
     * Called with data.
     *
     * @private
     */
    ondata(data) {
      try {
        this.decoder.add(data);
      } catch (e) {
        this.onclose("parse error", e);
      }
    }
    /**
     * Called when parser fully decodes a packet.
     *
     * @private
     */
    ondecoded(packet) {
      nextTick(() => {
        this.emitReserved("packet", packet);
      }, this.setTimeoutFn);
    }
    /**
     * Called upon socket error.
     *
     * @private
     */
    onerror(err) {
      this.emitReserved("error", err);
    }
    /**
     * Creates a new socket for the given `nsp`.
     *
     * @return {Socket}
     * @public
     */
    socket(nsp, opts) {
      let socket2 = this.nsps[nsp];
      if (!socket2) {
        socket2 = new Socket(this, nsp, opts);
        this.nsps[nsp] = socket2;
      } else if (this._autoConnect && !socket2.active) {
        socket2.connect();
      }
      return socket2;
    }
    /**
     * Called upon a socket close.
     *
     * @param socket
     * @private
     */
    _destroy(socket2) {
      const nsps = Object.keys(this.nsps);
      for (const nsp of nsps) {
        const socket3 = this.nsps[nsp];
        if (socket3.active) {
          return;
        }
      }
      this._close();
    }
    /**
     * Writes a packet.
     *
     * @param packet
     * @private
     */
    _packet(packet) {
      const encodedPackets = this.encoder.encode(packet);
      for (let i = 0; i < encodedPackets.length; i++) {
        this.engine.write(encodedPackets[i], packet.options);
      }
    }
    /**
     * Clean up transport subscriptions and packet buffer.
     *
     * @private
     */
    cleanup() {
      this.subs.forEach((subDestroy) => subDestroy());
      this.subs.length = 0;
      this.decoder.destroy();
    }
    /**
     * Close the current socket.
     *
     * @private
     */
    _close() {
      this.skipReconnect = true;
      this._reconnecting = false;
      this.onclose("forced close");
    }
    /**
     * Alias for close()
     *
     * @private
     */
    disconnect() {
      return this._close();
    }
    /**
     * Called when:
     *
     * - the low-level engine is closed
     * - the parser encountered a badly formatted packet
     * - all sockets are disconnected
     *
     * @private
     */
    onclose(reason, description) {
      var _a;
      this.cleanup();
      (_a = this.engine) === null || _a === void 0 ? void 0 : _a.close();
      this.backoff.reset();
      this._readyState = "closed";
      this.emitReserved("close", reason, description);
      if (this._reconnection && !this.skipReconnect) {
        this.reconnect();
      }
    }
    /**
     * Attempt a reconnection.
     *
     * @private
     */
    reconnect() {
      if (this._reconnecting || this.skipReconnect)
        return this;
      const self2 = this;
      if (this.backoff.attempts >= this._reconnectionAttempts) {
        this.backoff.reset();
        this.emitReserved("reconnect_failed");
        this._reconnecting = false;
      } else {
        const delay = this.backoff.duration();
        this._reconnecting = true;
        const timer = this.setTimeoutFn(() => {
          if (self2.skipReconnect)
            return;
          this.emitReserved("reconnect_attempt", self2.backoff.attempts);
          if (self2.skipReconnect)
            return;
          self2.open((err) => {
            if (err) {
              self2._reconnecting = false;
              self2.reconnect();
              this.emitReserved("reconnect_error", err);
            } else {
              self2.onreconnect();
            }
          });
        }, delay);
        if (this.opts.autoUnref) {
          timer.unref();
        }
        this.subs.push(() => {
          this.clearTimeoutFn(timer);
        });
      }
    }
    /**
     * Called upon successful reconnect.
     *
     * @private
     */
    onreconnect() {
      const attempt = this.backoff.attempts;
      this._reconnecting = false;
      this.backoff.reset();
      this.emitReserved("reconnect", attempt);
    }
  }
  const cache = {};
  function lookup(uri, opts) {
    if (typeof uri === "object") {
      opts = uri;
      uri = void 0;
    }
    opts = opts || {};
    const parsed = url(uri, opts.path || "/socket.io");
    const source = parsed.source;
    const id = parsed.id;
    const path = parsed.path;
    const sameNamespace = cache[id] && path in cache[id]["nsps"];
    const newConnection = opts.forceNew || opts["force new connection"] || false === opts.multiplex || sameNamespace;
    let io;
    if (newConnection) {
      io = new Manager(source, opts);
    } else {
      if (!cache[id]) {
        cache[id] = new Manager(source, opts);
      }
      io = cache[id];
    }
    if (parsed.query && !opts.query) {
      opts.query = parsed.queryKey;
    }
    return io.socket(parsed.path, opts);
  }
  Object.assign(lookup, {
    Manager,
    Socket,
    io: lookup,
    connect: lookup
  });
  let socket = null;
  let socketToken = "";
  let currentSocketId = "";
  const listenerRegistry = /* @__PURE__ */ new Map();
  const coreEventHandlers = /* @__PURE__ */ new Map();
  const REMINDER_SOCKET_EVENTS = [
    "reminder_event",
    "new_delivery",
    "order_assigned",
    "order_transfer",
    "order_reassign",
    "order_cancelled",
    "order_timeout_warning",
    "merchant_ready",
    "dispatch_notice",
    "station_notice",
    "town_message_notice"
  ];
  function ensureListenerSet(eventName) {
    if (!listenerRegistry.has(eventName)) {
      listenerRegistry.set(eventName, /* @__PURE__ */ new Set());
    }
    return listenerRegistry.get(eventName);
  }
  function dispatchEvent(eventName, payload) {
    const listeners = listenerRegistry.get(eventName);
    if (!listeners || !listeners.size) {
      return;
    }
    listeners.forEach((callback) => {
      try {
        callback(payload, eventName);
      } catch (error) {
        formatAppLog("error", "at utils/socket.js:41", `[socket] 事件监听执行失败: ${eventName}`, error);
      }
    });
  }
  function isAppPlatform$1() {
    var _a;
    try {
      if (typeof uni !== "undefined" && typeof uni.getSystemInfoSync === "function") {
        const platform = String(((_a = uni.getSystemInfoSync()) == null ? void 0 : _a.uniPlatform) || "").toLowerCase();
        if (platform === "app" || platform === "app-plus") {
          return true;
        }
      }
    } catch (error) {
    }
    return typeof plus !== "undefined";
  }
  function sanitizeSocketUrl(url2) {
    return String(url2 || "").trim().replace(/^['"`]+|['"`]+$/g, "").replace(/\/+$/, "");
  }
  function buildSocketTransports() {
    return ["polling", "websocket"];
  }
  function buildSocketOptions(token) {
    const bearer = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    const baseOptions = {
      path: "/socket.io",
      auth: { token: bearer },
      transports: buildSocketTransports(),
      upgrade: true,
      tryAllTransports: true,
      autoConnect: true,
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1e3,
      reconnectionDelayMax: 5e3,
      timeout: 6e4,
      forceNew: true,
      rememberUpgrade: false,
      query: {
        token: bearer,
        role: "rider"
      },
      extraHeaders: {
        Authorization: bearer,
        token: bearer
      }
    };
    return baseOptions;
  }
  function cleanupCoreHandlers() {
    if (!socket) {
      coreEventHandlers.clear();
      return;
    }
    coreEventHandlers.forEach((handler, eventName) => {
      socket.off(eventName, handler);
    });
    coreEventHandlers.clear();
  }
  function bindCoreListeners() {
    if (!socket) {
      return;
    }
    const connectHandler = () => {
      var _a, _b, _c;
      currentSocketId = (socket == null ? void 0 : socket.id) || "";
      formatAppLog("log", "at utils/socket.js:118", "Socket 已连接", {
        socketId: currentSocketId,
        transport: ((_c = (_b = (_a = socket == null ? void 0 : socket.io) == null ? void 0 : _a.engine) == null ? void 0 : _b.transport) == null ? void 0 : _c.name) || ""
      });
      dispatchEvent("connect", {
        connected: true,
        socketId: currentSocketId
      });
    };
    const disconnectHandler = (reason) => {
      formatAppLog("log", "at utils/socket.js:129", "Socket 已断开", reason);
      dispatchEvent("disconnect", { connected: false, reason: reason || "" });
    };
    const connectErrorHandler = (error) => {
      const errorPayload = {
        message: (error == null ? void 0 : error.message) || "",
        description: (error == null ? void 0 : error.description) || "",
        context: (error == null ? void 0 : error.context) || "",
        type: (error == null ? void 0 : error.type) || "",
        tokenLength: socketToken ? socketToken.length : 0,
        baseUrl: BASE_URL
      };
      formatAppLog("error", "at utils/socket.js:142", "Socket 连接失败", errorPayload);
      dispatchEvent("connect_error", errorPayload);
    };
    socket.on("connect", connectHandler);
    socket.on("disconnect", disconnectHandler);
    socket.on("connect_error", connectErrorHandler);
    coreEventHandlers.set("connect", connectHandler);
    coreEventHandlers.set("disconnect", disconnectHandler);
    coreEventHandlers.set("connect_error", connectErrorHandler);
    REMINDER_SOCKET_EVENTS.forEach((eventName) => {
      const handler = (payload) => {
        dispatchEvent(eventName, payload);
      };
      socket.on(eventName, handler);
      coreEventHandlers.set(eventName, handler);
    });
  }
  function createSocket(token) {
    const safeToken = String(token || "").trim();
    if (!safeToken) {
      return null;
    }
    const socketBaseUrl = sanitizeSocketUrl(BASE_URL);
    formatAppLog("log", "at utils/socket.js:170", "[socket] 开始初始化连接", {
      baseUrl: BASE_URL,
      connectUrl: socketBaseUrl,
      tokenLength: safeToken.length,
      hasToken: !!safeToken,
      transports: buildSocketTransports()
    });
    socket = lookup(socketBaseUrl, buildSocketOptions(safeToken));
    bindCoreListeners();
    return socket;
  }
  function destroySocket() {
    if (socket) {
      cleanupCoreHandlers();
      socket.disconnect();
      socket = null;
    }
    socketToken = "";
    currentSocketId = "";
  }
  function initSocket(token) {
    const safeToken = String(token || "").trim();
    if (!safeToken) {
      formatAppLog("warn", "at utils/socket.js:196", "[socket] 跳过初始化：token 为空");
      return null;
    }
    if (isAppPlatform$1()) {
      if (socket) {
        destroySocket();
      }
      formatAppLog("log", "at utils/socket.js:204", "[socket] App 端已禁用实时 Socket，统一走 HTTP 轮询兜底");
      return null;
    }
    if (socket && socketToken === safeToken) {
      if (!socket.connected && typeof socket.connect === "function") {
        socket.connect();
      }
      return socket;
    }
    destroySocket();
    socketToken = safeToken;
    return createSocket(safeToken);
  }
  function disconnectSocket() {
    destroySocket();
  }
  function onSocketEvent(eventName, callback) {
    if (!eventName || typeof callback !== "function") {
      return () => {
      };
    }
    const listeners = ensureListenerSet(eventName);
    listeners.add(callback);
    return () => offSocketEvent(eventName, callback);
  }
  function offSocketEvent(eventName, callback) {
    const listeners = listenerRegistry.get(eventName);
    if (!listeners) {
      return;
    }
    if (typeof callback === "function") {
      listeners.delete(callback);
    } else {
      listeners.clear();
    }
  }
  function onReminderEvents(callback, eventNames = REMINDER_SOCKET_EVENTS) {
    const list = Array.isArray(eventNames) ? eventNames : REMINDER_SOCKET_EVENTS;
    const cleanups = list.map((eventName) => onSocketEvent(eventName, callback));
    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }
  const NOTICE_TEXT = "您有跑腿消息，请及时回复";
  const PLAYER_GAP_MS = 800;
  const LOG_PREFIX$1 = "[town-errand-voice]";
  const HIGH_PRIORITY_VALUES = ["high", "urgent", "critical", "p0", "p1"];
  let lastPlayAt = 0;
  let plusReadyListening = false;
  let plusReadyCallbacks = [];
  let androidTtsInstance = null;
  let androidTtsReady = false;
  let androidTtsInitializing = false;
  let androidTtsCallbacks = [];
  function logInfo$1(message, extra) {
    if (typeof extra === "undefined") {
      formatAppLog("log", "at utils/town-errand-voice.js:16", LOG_PREFIX$1, message);
      return;
    }
    formatAppLog("log", "at utils/town-errand-voice.js:19", LOG_PREFIX$1, message, extra);
  }
  function logWarn$1(message, extra) {
    if (typeof extra === "undefined") {
      formatAppLog("warn", "at utils/town-errand-voice.js:24", LOG_PREFIX$1, message);
      return;
    }
    formatAppLog("warn", "at utils/town-errand-voice.js:27", LOG_PREFIX$1, message, extra);
  }
  function logError$1(message, extra) {
    if (typeof extra === "undefined") {
      formatAppLog("error", "at utils/town-errand-voice.js:32", LOG_PREFIX$1, message);
      return;
    }
    formatAppLog("error", "at utils/town-errand-voice.js:35", LOG_PREFIX$1, message, extra);
  }
  function isAppPlusRuntime$1() {
    return true;
  }
  function vibrateNotice() {
    if (typeof uni.vibrateShort === "function") {
      uni.vibrateShort();
    }
  }
  function isHighPriority(value2) {
    const normalized = String(value2 || "").trim().toLowerCase();
    return HIGH_PRIORITY_VALUES.includes(normalized);
  }
  function getBeepCountBySoundType(soundType = "default") {
    const normalized = String(soundType || "").trim().toLowerCase();
    if (normalized === "urgent" || normalized === "alert_urgent" || normalized === "critical") {
      return 2;
    }
    if (normalized === "triple" || normalized === "alert_triple") {
      return 3;
    }
    return 1;
  }
  function playBeep(reason, soundType = "default") {
    logWarn$1("执行提示音提醒", reason);
    if (typeof plus !== "undefined" && plus.device && typeof plus.device.beep === "function") {
      plus.device.beep(getBeepCountBySoundType(soundType));
      return true;
    }
    return false;
  }
  function flushPlusReadyCallbacks() {
    const callbacks = plusReadyCallbacks.slice();
    plusReadyCallbacks = [];
    callbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        logError$1("执行 plusready 队列回调失败", error);
      }
    });
  }
  function ensurePlusReady$1(callback) {
    if (!isAppPlusRuntime$1()) {
      logWarn$1("当前不是 APP-PLUS 环境，跳过真机语音播报");
      return false;
    }
    if (typeof plus !== "undefined") {
      logInfo$1("plus 已就绪，可直接执行语音播报", {
        plusExists: true,
        windowPlusExists: typeof window !== "undefined" && !!window.plus,
        plusSpeechExists: !!plus.speech,
        plusSpeechSpeakExists: !!(plus.speech && typeof plus.speech.speak === "function")
      });
      callback();
      return true;
    }
    plusReadyCallbacks.push(callback);
    logWarn$1("plus 尚未就绪，等待 plusready 后再播报", {
      queueLength: plusReadyCallbacks.length
    });
    if (!plusReadyListening && typeof document !== "undefined" && document.addEventListener) {
      plusReadyListening = true;
      const onPlusReady = () => {
        document.removeEventListener("plusready", onPlusReady, false);
        plusReadyListening = false;
        logInfo$1("收到 plusready 事件，开始执行等待中的语音播报");
        flushPlusReadyCallbacks();
      };
      document.addEventListener("plusready", onPlusReady, false);
    }
    return false;
  }
  function flushAndroidTtsCallbacks(success, payload) {
    const callbacks = androidTtsCallbacks.slice();
    androidTtsCallbacks = [];
    callbacks.forEach((callback) => {
      try {
        callback(success, payload);
      } catch (error) {
        logError$1("执行 Android TTS 队列回调失败", error);
      }
    });
  }
  function ensureAndroidTtsReady(callback) {
    if (androidTtsReady && androidTtsInstance) {
      callback(true);
      return;
    }
    androidTtsCallbacks.push(callback);
    if (androidTtsInitializing) {
      logInfo$1("Android TTS 正在初始化，加入等待队列", {
        queueLength: androidTtsCallbacks.length
      });
      return;
    }
    androidTtsInitializing = true;
    try {
      if (!plus.os || plus.os.name !== "Android") {
        const reason = { message: "当前 APP 平台不是 Android，未接入原生 TextToSpeech" };
        logWarn$1("Android TTS 不可用", reason);
        androidTtsInitializing = false;
        flushAndroidTtsCallbacks(false, reason);
        return;
      }
      const mainActivity = plus.android.runtimeMainActivity();
      const TextToSpeech = plus.android.importClass("android.speech.tts.TextToSpeech");
      const Locale = plus.android.importClass("java.util.Locale");
      logInfo$1("开始初始化 Android TextToSpeech", {
        plusSpeechExists: !!plus.speech,
        plusSpeechSpeakExists: !!(plus.speech && typeof plus.speech.speak === "function")
      });
      const initListener = plus.android.implements("android.speech.tts.TextToSpeech$OnInitListener", {
        onInit: function(status) {
          try {
            const successCode = Number(TextToSpeech.SUCCESS);
            const initSuccess = Number(status) === successCode || Number(status) === 0;
            logInfo$1("Android TextToSpeech onInit 回调", {
              status: Number(status),
              successCode
            });
            if (!initSuccess) {
              androidTtsReady = false;
              androidTtsInitializing = false;
              flushAndroidTtsCallbacks(false, {
                message: "Android TextToSpeech 初始化失败",
                status: Number(status)
              });
              return;
            }
            androidTtsReady = true;
            androidTtsInitializing = false;
            try {
              const localeResult = androidTtsInstance.setLanguage(Locale.CHINA);
              logInfo$1("Android TextToSpeech 语言设置完成", {
                localeResult: Number(localeResult)
              });
            } catch (localeError) {
              logError$1("Android TextToSpeech 设置语言失败", localeError);
            }
            flushAndroidTtsCallbacks(true);
          } catch (callbackError) {
            androidTtsReady = false;
            androidTtsInitializing = false;
            logError$1("Android TextToSpeech onInit 处理失败", callbackError);
            flushAndroidTtsCallbacks(false, callbackError);
          }
        }
      });
      androidTtsInstance = new TextToSpeech(mainActivity, initListener);
      logInfo$1("已发起 Android TextToSpeech 初始化请求");
    } catch (error) {
      androidTtsReady = false;
      androidTtsInitializing = false;
      logError$1("初始化 Android TextToSpeech 异常", error);
      flushAndroidTtsCallbacks(false, error);
    }
  }
  function speakWithAndroidTts(text = NOTICE_TEXT) {
    try {
      const TextToSpeech = plus.android.importClass("android.speech.tts.TextToSpeech");
      const result = androidTtsInstance.speak(String(text || NOTICE_TEXT), TextToSpeech.QUEUE_FLUSH, null, "rider_reminder_notice");
      const errorCode = Number(TextToSpeech.ERROR);
      logInfo$1("已调用 Android TextToSpeech.speak", {
        result: Number(result),
        errorCode
      });
      if (Number(result) === errorCode) {
        throw new Error(`Android TextToSpeech.speak 返回错误码 ${result}`);
      }
      return true;
    } catch (error) {
      logError$1("Android TextToSpeech.speak 执行失败", error);
      return false;
    }
    return false;
  }
  function showTextToast(title = NOTICE_TEXT) {
    const safeTitle = String(title || "").trim() || NOTICE_TEXT;
    uni.showToast({
      title: safeTitle,
      icon: "none",
      duration: 2e3
    });
  }
  function playReminderAlert(options = {}) {
    const {
      title = NOTICE_TEXT,
      text = NOTICE_TEXT,
      toast = true,
      vibration = true,
      sound = true,
      voice = true,
      soundType = "default",
      priority = "normal"
    } = options;
    const now = Date.now();
    if (lastPlayAt > 0 && now - lastPlayAt < PLAYER_GAP_MS) {
      logWarn$1("提醒播放过于频繁，已跳过本次播报", {
        gap: now - lastPlayAt,
        playerGapMs: PLAYER_GAP_MS
      });
      return false;
    }
    lastPlayAt = now;
    if (toast) {
      showTextToast(title);
    }
    if (vibration) {
      if (isHighPriority(priority) && typeof uni.vibrateLong === "function") {
        uni.vibrateLong();
      } else {
        vibrateNotice();
      }
    }
    if (sound) {
      playBeep({ title, soundType }, soundType);
    }
    if (!voice) {
      return true;
    }
    if (!isAppPlusRuntime$1()) {
      logWarn$1("当前为非 APP 环境，仅保留文字/震动提示，不执行真机语音");
      return true;
    }
    ensurePlusReady$1(() => {
      ensureAndroidTtsReady((success, payload) => {
        if (!success) {
          logError$1("Android TTS 未就绪，无法执行语音播报", payload);
          if (!sound) {
            playBeep(payload, soundType);
          }
          return;
        }
        const speakSuccess = speakWithAndroidTts(text);
        if (!speakSuccess && !sound) {
          playBeep({ message: "Android TTS speak 调用失败" }, soundType);
        }
      });
    });
    return true;
  }
  const STORAGE_KEY = "riderReminderSettings";
  const REMINDER_CATEGORY_KEYS = [
    "newOrder",
    "transfer",
    "cancel",
    "timeout",
    "pickupReady",
    "stationNotice",
    "navigation"
  ];
  const DEFAULT_REMINDER_SETTINGS = {
    enabled: true,
    voiceEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    systemNotificationEnabled: true,
    navigationVoiceEnabled: false,
    categories: {
      newOrder: true,
      transfer: true,
      cancel: true,
      timeout: true,
      pickupReady: true,
      stationNotice: true,
      navigation: false
    }
  };
  function toBoolean$5(value2, fallback = false) {
    if (typeof value2 === "boolean") {
      return value2;
    }
    if (typeof value2 === "number") {
      return value2 === 1;
    }
    if (typeof value2 === "string") {
      const normalized = value2.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") {
        return true;
      }
      if (normalized === "false" || normalized === "0") {
        return false;
      }
    }
    return fallback;
  }
  function normalizeCategories(input = {}) {
    return REMINDER_CATEGORY_KEYS.reduce((result, key) => {
      result[key] = toBoolean$5(input[key], DEFAULT_REMINDER_SETTINGS.categories[key]);
      return result;
    }, {});
  }
  function normalizeReminderSettings(input = {}) {
    return {
      enabled: toBoolean$5(input.enabled, DEFAULT_REMINDER_SETTINGS.enabled),
      voiceEnabled: toBoolean$5(input.voiceEnabled, DEFAULT_REMINDER_SETTINGS.voiceEnabled),
      soundEnabled: toBoolean$5(input.soundEnabled, DEFAULT_REMINDER_SETTINGS.soundEnabled),
      vibrationEnabled: toBoolean$5(input.vibrationEnabled, DEFAULT_REMINDER_SETTINGS.vibrationEnabled),
      systemNotificationEnabled: toBoolean$5(input.systemNotificationEnabled, DEFAULT_REMINDER_SETTINGS.systemNotificationEnabled),
      navigationVoiceEnabled: toBoolean$5(input.navigationVoiceEnabled, DEFAULT_REMINDER_SETTINGS.navigationVoiceEnabled),
      categories: normalizeCategories(input.categories || {})
    };
  }
  function getReminderSettings() {
    const raw = uni.getStorageSync(STORAGE_KEY);
    if (!raw) {
      return normalizeReminderSettings(DEFAULT_REMINDER_SETTINGS);
    }
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return normalizeReminderSettings({
        ...DEFAULT_REMINDER_SETTINGS,
        ...parsed,
        categories: {
          ...DEFAULT_REMINDER_SETTINGS.categories,
          ...(parsed == null ? void 0 : parsed.categories) || {}
        }
      });
    } catch (error) {
      formatAppLog("warn", "at utils/reminder-settings.js:86", "[reminder-settings] 本地提醒设置解析失败，已回退默认值", error);
      return normalizeReminderSettings(DEFAULT_REMINDER_SETTINGS);
    }
  }
  function saveReminderSettings(settings = DEFAULT_REMINDER_SETTINGS) {
    const normalized = normalizeReminderSettings(settings);
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }
  function updateReminderSettings(patch = {}) {
    const current = getReminderSettings();
    const merged = normalizeReminderSettings({
      ...current,
      ...patch,
      categories: {
        ...current.categories,
        ...patch.categories || {}
      }
    });
    return saveReminderSettings(merged);
  }
  function resetReminderSettings() {
    uni.removeStorageSync(STORAGE_KEY);
    return saveReminderSettings(DEFAULT_REMINDER_SETTINGS);
  }
  function isReminderEnabledForType(type, settings = getReminderSettings()) {
    if (!settings.enabled) {
      return false;
    }
    const categoryMap = {
      new_order: "newOrder",
      transfer: "transfer",
      cancel: "cancel",
      timeout: "timeout",
      pickup_ready: "pickupReady",
      station_notice: "stationNotice",
      navigation: "navigation"
    };
    const categoryKey = categoryMap[type];
    if (!categoryKey) {
      return true;
    }
    if (type === "navigation" && !settings.navigationVoiceEnabled) {
      return false;
    }
    return !!settings.categories[categoryKey];
  }
  const LOG_PREFIX = "[reminder-center]";
  const ORDER_POLL_INTERVAL_FOREGROUND = 5e3;
  const ORDER_POLL_INTERVAL_BACKGROUND = 3e4;
  const TOWN_POLL_INTERVAL_FOREGROUND = 15e3;
  const TOWN_POLL_INTERVAL_BACKGROUND = 3e4;
  const DEDUPE_WINDOW_MS = 18e4;
  const REMINDER_EVENT_NAME = "rider-reminder:event";
  const ORDER_REFRESH_EVENT_NAME = "rider-reminder:order-refresh";
  const TOWN_UNREAD_EVENT_NAME = "rider-reminder:town-unread";
  const SETTINGS_CHANGED_EVENT_NAME = "rider-reminder:settings-changed";
  const TIMEOUT_WARNING_LEVELS = [600, 180];
  const TAB_PAGE_PREFIXES = ["/pages/index/index", "/pages/profile/index"];
  function isAppPlatform() {
    var _a;
    try {
      if (typeof uni !== "undefined" && typeof uni.getSystemInfoSync === "function") {
        const platform = String(((_a = uni.getSystemInfoSync()) == null ? void 0 : _a.uniPlatform) || "").toLowerCase();
        if (platform === "app" || platform === "app-plus") {
          return true;
        }
      }
    } catch (error) {
    }
    return typeof plus !== "undefined";
  }
  const state = {
    initialized: false,
    appVisible: true,
    token: "",
    userInfo: null,
    orderPollTimer: null,
    orderPollInFlight: false,
    townPollTimer: null,
    townPollInFlight: false,
    orderSnapshot: /* @__PURE__ */ new Map(),
    dedupeMap: /* @__PURE__ */ new Map(),
    townUnreadTotal: 0,
    townInitialized: false,
    socketCleanup: null,
    pushClickBound: false,
    plusReadyListening: false,
    plusReadyCallbacks: [],
    pollKickoffAt: 0
  };
  function logInfo(message, extra) {
    if (typeof extra === "undefined") {
      formatAppLog("log", "at utils/reminder-center.js:59", LOG_PREFIX, message);
      return;
    }
    formatAppLog("log", "at utils/reminder-center.js:62", LOG_PREFIX, message, extra);
  }
  function logWarn(message, extra) {
    if (typeof extra === "undefined") {
      formatAppLog("warn", "at utils/reminder-center.js:67", LOG_PREFIX, message);
      return;
    }
    formatAppLog("warn", "at utils/reminder-center.js:70", LOG_PREFIX, message, extra);
  }
  function logError(message, extra) {
    if (typeof extra === "undefined") {
      formatAppLog("error", "at utils/reminder-center.js:75", LOG_PREFIX, message);
      return;
    }
    formatAppLog("error", "at utils/reminder-center.js:78", LOG_PREFIX, message, extra);
  }
  function normalizeRoute$1(route = "") {
    if (!route) {
      return "";
    }
    return route.startsWith("/") ? route : `/${route}`;
  }
  function getCurrentRoutePath() {
    try {
      const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
      const currentPage = Array.isArray(pages) && pages.length ? pages[pages.length - 1] : null;
      return normalizeRoute$1((currentPage == null ? void 0 : currentPage.route) || "");
    } catch (error) {
      return "";
    }
  }
  function isAppPlusRuntime() {
    return true;
  }
  function ensurePlusReady(callback) {
    if (!isAppPlusRuntime()) {
      return false;
    }
    if (typeof plus !== "undefined") {
      callback();
      return true;
    }
    state.plusReadyCallbacks.push(callback);
    if (!state.plusReadyListening && typeof document !== "undefined" && document.addEventListener) {
      state.plusReadyListening = true;
      const onPlusReady = () => {
        document.removeEventListener("plusready", onPlusReady, false);
        state.plusReadyListening = false;
        const callbacks = state.plusReadyCallbacks.slice();
        state.plusReadyCallbacks = [];
        callbacks.forEach((fn) => {
          try {
            fn();
          } catch (error) {
            logError("执行 plusready 回调失败", error);
          }
        });
      };
      document.addEventListener("plusready", onPlusReady, false);
    }
    return false;
  }
  function toArray(payload) {
    if (Array.isArray(payload))
      return payload;
    if (Array.isArray(payload == null ? void 0 : payload.list))
      return payload.list;
    if (Array.isArray(payload == null ? void 0 : payload.rows))
      return payload.rows;
    if (Array.isArray(payload == null ? void 0 : payload.data))
      return payload.data;
    return [];
  }
  function toBoolean$4(value2) {
    return value2 === true || value2 === 1 || value2 === "1" || value2 === "true";
  }
  function safeText$4(value2) {
    if (value2 === void 0 || value2 === null) {
      return "";
    }
    if (typeof value2 === "number" && Number.isNaN(value2)) {
      return "";
    }
    return String(value2).trim();
  }
  function safeId(value2) {
    const text = safeText$4(value2);
    return text || "";
  }
  function parseJsonMaybe(value2, fallback = {}) {
    if (!value2) {
      return fallback;
    }
    if (typeof value2 === "object") {
      return value2;
    }
    try {
      return JSON.parse(String(value2));
    } catch (error) {
      return fallback;
    }
  }
  function pickPayloadValue(payload = {}, ...keys) {
    if (!payload || typeof payload !== "object") {
      return void 0;
    }
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!key) {
        continue;
      }
      const value2 = payload[key];
      if (value2 !== void 0 && value2 !== null && value2 !== "") {
        return value2;
      }
    }
    return void 0;
  }
  function normalizeReminderType(type = "") {
    const normalized = safeText$4(type).toLowerCase();
    if (!normalized) {
      return "";
    }
    const map = {
      rider_new_delivery: "new_order",
      rider_station_order_assigned: "new_order",
      rider_transfer_assigned: "transfer",
      rider_transfer_revoked: "transfer",
      rider_order_cancelled: "cancel",
      rider_timeout_warning: "timeout",
      rider_pickup_ready: "pickup_ready",
      rider_station_notice: "station_notice",
      rider_dispatch_notice: "station_notice"
    };
    return map[normalized] || normalized;
  }
  function pickOrder(payload = {}) {
    if (payload && typeof payload === "object" && payload.id) {
      return payload;
    }
    if ((payload == null ? void 0 : payload.data) && typeof payload.data === "object") {
      return payload.data;
    }
    if ((payload == null ? void 0 : payload.order) && typeof payload.order === "object") {
      return payload.order;
    }
    return {};
  }
  function getMerchantName(order = {}) {
    var _a;
    return safeText$4((_a = order == null ? void 0 : order.merchant) == null ? void 0 : _a.name) || "商家";
  }
  function isTransferOrder(order = {}) {
    return toBoolean$4(order.is_transfer_order) || !!safeText$4(order.transfer_tag);
  }
  function pickUnreadCount$1(item = {}) {
    const unread = item.unread_count ?? item.unreadCount ?? item.unread_num;
    return Number(unread) > 0 ? Number(unread) : 0;
  }
  function parseTimeValue(value2) {
    if (!value2 && value2 !== 0) {
      return 0;
    }
    if (typeof value2 === "number") {
      if (value2 > 1e12) {
        return value2;
      }
      if (value2 > 1e9) {
        return value2 * 1e3;
      }
      return 0;
    }
    const parsed = Date.parse(String(value2));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function getTimeoutRemainingSeconds(order = {}) {
    const directFields = [
      "timeout_warning_in",
      "timeout_warning_seconds",
      "remaining_seconds",
      "remaining_time_seconds",
      "delivery_remaining_seconds",
      "pickup_remaining_seconds",
      "rider_remaining_seconds"
    ];
    for (let i = 0; i < directFields.length; i += 1) {
      const value2 = Number(order[directFields[i]]);
      if (Number.isFinite(value2) && value2 > 0) {
        return Math.floor(value2);
      }
    }
    const deadlineFields = [
      "timeout_at",
      "delivery_timeout_at",
      "pickup_timeout_at",
      "delivery_deadline_at",
      "pickup_deadline_at",
      "deadline_at",
      "expire_at"
    ];
    for (let i = 0; i < deadlineFields.length; i += 1) {
      const timestamp = parseTimeValue(order[deadlineFields[i]]);
      if (!timestamp) {
        continue;
      }
      const remaining = Math.floor((timestamp - Date.now()) / 1e3);
      if (remaining > 0) {
        return remaining;
      }
    }
    return 0;
  }
  function getTimeoutBucket(order = {}) {
    const remainingSeconds = getTimeoutRemainingSeconds(order);
    if (!remainingSeconds) {
      return "";
    }
    if (remainingSeconds <= TIMEOUT_WARNING_LEVELS[1]) {
      return "warn_3m";
    }
    if (remainingSeconds <= TIMEOUT_WARNING_LEVELS[0]) {
      return "warn_10m";
    }
    return "";
  }
  function isActionableMerchantReady(order = {}) {
    const user = state.userInfo || getStoredUserInfo() || {};
    const status = Number(order.status || 0);
    return isMerchantDeliveryUser(user) ? status === 3 : status === 4;
  }
  function buildOrderSnapshot(order = {}) {
    var _a, _b, _c, _d;
    return {
      id: safeId(order.id),
      status: Number(order.status || 0),
      isTransferOrder: isTransferOrder(order),
      transferStatus: safeText$4(order.transfer_status),
      transferTag: safeText$4(order.transfer_tag),
      transferToUserId: safeId(((_a = order == null ? void 0 : order.transfer_to_user) == null ? void 0 : _a.id) || ((_b = order == null ? void 0 : order.transfer_to_user) == null ? void 0 : _b.user_id) || (order == null ? void 0 : order.transfer_to_user_id)),
      transferFromUserId: safeId(((_c = order == null ? void 0 : order.transfer_from_user) == null ? void 0 : _c.id) || ((_d = order == null ? void 0 : order.transfer_from_user) == null ? void 0 : _d.user_id) || (order == null ? void 0 : order.transfer_from_user_id)),
      timeoutBucket: getTimeoutBucket(order),
      updatedAt: safeText$4(order.updated_at || order.transfer_updated_at || order.status_updated_at || order.modified_at || ""),
      merchantReady: isActionableMerchantReady(order)
    };
  }
  function buildOrdersIndexTarget(scene, orderId = "") {
    const params = [];
    if (scene) {
      params.push(`scene=${encodeURIComponent(scene)}`);
    }
    if (orderId) {
      params.push(`orderId=${encodeURIComponent(orderId)}`);
    }
    return {
      type: "navigate",
      url: `/pages/orders/index${params.length ? `?${params.join("&")}` : ""}`
    };
  }
  function buildOrderDetailTarget(orderId = "") {
    return {
      type: "navigate",
      url: `/pages/orders/detail?id=${encodeURIComponent(String(orderId || ""))}`
    };
  }
  function appendQueryParams(url2 = "", params = {}) {
    const safeUrl = safeText$4(url2);
    if (!safeUrl) {
      return "";
    }
    const entries = Object.entries(params || {}).filter(([, value2]) => value2 !== void 0 && value2 !== null && value2 !== "");
    if (!entries.length) {
      return safeUrl;
    }
    const query = entries.map(([key, value2]) => `${encodeURIComponent(String(key))}=${encodeURIComponent(String(value2))}`).join("&");
    return `${safeUrl}${safeUrl.includes("?") ? "&" : "?"}${query}`;
  }
  function normalizeJumpPath(path = "") {
    const safePath = safeText$4(path);
    if (!safePath) {
      return "";
    }
    if (safePath.startsWith("/")) {
      return safePath;
    }
    if (safePath.startsWith("pages/")) {
      return `/${safePath}`;
    }
    if (safePath.startsWith("http://") || safePath.startsWith("https://")) {
      return safePath;
    }
    return `/${safePath}`;
  }
  function buildTargetFromJump(jumpPath = "", jumpParams = {}, fallbackOrderId = "") {
    const normalizedPath = normalizeJumpPath(jumpPath);
    const params = parseJsonMaybe(jumpParams, {});
    if (normalizedPath) {
      return {
        type: "navigate",
        url: appendQueryParams(normalizedPath, params)
      };
    }
    if (fallbackOrderId) {
      return buildOrderDetailTarget(fallbackOrderId);
    }
    return buildOrdersIndexTarget("", "");
  }
  function emitUniEvent(name, payload) {
    if (typeof (uni == null ? void 0 : uni.$emit) === "function") {
      uni.$emit(name, payload);
    }
  }
  function pruneDedupeCache(now = Date.now()) {
    state.dedupeMap.forEach((timestamp, key) => {
      if (now - Number(timestamp || 0) > DEDUPE_WINDOW_MS) {
        state.dedupeMap.delete(key);
      }
    });
  }
  function shouldSkipReminder(reminder = {}) {
    const key = safeText$4(reminder.dedupeKey);
    if (!key) {
      return false;
    }
    const now = Date.now();
    pruneDedupeCache(now);
    const previous = Number(state.dedupeMap.get(key) || 0);
    if (previous && now - previous < DEDUPE_WINDOW_MS) {
      return true;
    }
    state.dedupeMap.set(key, now);
    return false;
  }
  function getReminderSettingsSnapshot() {
    return getReminderSettings();
  }
  function shouldSendSystemNotification() {
    const settings = getReminderSettingsSnapshot();
    return !state.appVisible && settings.systemNotificationEnabled;
  }
  function createSystemNotification(reminder = {}) {
    const payload = {
      source: "local_notification",
      reminderType: reminder.type || "",
      target: reminder.target || null,
      orderId: reminder.orderId || "",
      dedupeKey: reminder.dedupeKey || "",
      title: reminder.title || "",
      text: reminder.text || reminder.body || "",
      soundType: reminder.soundType || "default",
      priority: reminder.priority || "normal"
    };
    ensurePlusReady(() => {
      try {
        if (!plus.push || typeof plus.push.createMessage !== "function") {
          logWarn("当前运行环境不支持 plus.push.createMessage，无法创建系统通知");
          return;
        }
        plus.push.createMessage(
          safeText$4(reminder.body || reminder.text || reminder.title),
          JSON.stringify(payload),
          {
            title: safeText$4(reminder.title || "骑手提醒"),
            cover: false,
            delay: false
          }
        );
      } catch (error) {
        logError("创建本地系统通知失败", error);
      }
    });
  }
  function normalizePushPayload(rawPayload) {
    if (!rawPayload) {
      return {};
    }
    if (typeof rawPayload === "object") {
      return rawPayload;
    }
    try {
      return JSON.parse(String(rawPayload));
    } catch (error) {
      return {};
    }
  }
  function isTabPageUrl(url2 = "") {
    const safeUrl = safeText$4(url2);
    if (!safeUrl) {
      return false;
    }
    return TAB_PAGE_PREFIXES.some((prefix) => safeUrl.startsWith(prefix));
  }
  function openReminderTarget(target = null) {
    if (!target || !target.url) {
      return false;
    }
    const url2 = String(target.url);
    if (!url2) {
      return false;
    }
    const isTabPage = isTabPageUrl(url2);
    if (isTabPage) {
      uni.switchTab({
        url: url2.split("?")[0],
        fail: () => {
          uni.reLaunch({ url: url2.split("?")[0] });
        }
      });
      return true;
    }
    uni.navigateTo({
      url: url2,
      fail: () => {
        uni.redirectTo({
          url: url2,
          fail: () => {
            uni.reLaunch({ url: url2 });
          }
        });
      }
    });
    return true;
  }
  function bindPushClickListeners() {
    if (state.pushClickBound || !isAppPlusRuntime()) {
      return;
    }
    ensurePlusReady(() => {
      if (!plus.push || typeof plus.push.addEventListener !== "function") {
        logWarn("当前运行环境不支持 plus.push 事件监听");
        return;
      }
      plus.push.addEventListener("click", (message) => {
        const payload = normalizePushPayload(message == null ? void 0 : message.payload);
        const target = (payload == null ? void 0 : payload.target) || null;
        if (target) {
          setTimeout(() => {
            openReminderTarget(target);
          }, 120);
        }
      });
      plus.push.addEventListener("receive", (message) => {
        const payload = normalizePushPayload(message == null ? void 0 : message.payload);
        if ((payload == null ? void 0 : payload.source) === "local_notification") {
          return;
        }
        if ((payload == null ? void 0 : payload.target) && (payload == null ? void 0 : payload.reminderType)) {
          handleReminder({
            type: safeText$4(payload.reminderType),
            title: safeText$4((message == null ? void 0 : message.title) || (payload == null ? void 0 : payload.title) || "骑手通知"),
            text: safeText$4((message == null ? void 0 : message.content) || (payload == null ? void 0 : payload.text) || ""),
            body: safeText$4((message == null ? void 0 : message.content) || (payload == null ? void 0 : payload.text) || ""),
            target: payload.target,
            dedupeKey: safeText$4((payload == null ? void 0 : payload.dedupeKey) || ""),
            soundType: safeText$4((payload == null ? void 0 : payload.soundType) || "default"),
            priority: safeText$4((payload == null ? void 0 : payload.priority) || "normal")
          }, { source: "push:receive" });
        }
      });
      state.pushClickBound = true;
    });
  }
  function buildReminderFromUnifiedEvent(payload = {}) {
    const targetRole = safeText$4(payload.target_role).toLowerCase();
    if (targetRole && targetRole !== "rider") {
      return null;
    }
    const jumpParams = parseJsonMaybe(payload.jump_params, {});
    const extraPayload = parseJsonMaybe(payload.extra, {});
    const order = pickOrder(payload);
    const orderId = safeId(
      order.id || extraPayload.order_id || jumpParams.id || jumpParams.orderId || jumpParams.order_id
    );
    const eventType = safeText$4(payload.event_type);
    const normalizedType = normalizeReminderType(eventType);
    const speechText = safeText$4(payload.speech_text);
    const content = safeText$4(payload.content);
    const title = safeText$4(payload.title) || "骑手提醒";
    const text = speechText || content || title;
    return {
      type: normalizedType || "station_notice",
      rawEventType: eventType,
      orderId,
      title,
      text,
      body: content || text,
      dedupeKey: safeText$4(payload.dedupe_key) || `${normalizedType || eventType}:${orderId || title}:${safeText$4(payload.created_at)}`,
      target: buildTargetFromJump(payload.jump_path, jumpParams, orderId),
      soundType: safeText$4(payload.sound_type || "default"),
      priority: safeText$4(payload.priority || "normal"),
      eventVersion: safeText$4(payload.event_version),
      meta: {
        payload,
        order,
        extra: extraPayload,
        eventName: "reminder_event"
      }
    };
  }
  function buildReminderFromSocket(eventName, payload = {}) {
    var _a;
    if (eventName === "reminder_event") {
      return buildReminderFromUnifiedEvent(payload);
    }
    const order = pickOrder(payload);
    const orderId = safeId(order.id);
    const eventType = safeText$4(pickPayloadValue(payload, "eventType", "event_type"));
    const normalizedType = normalizeReminderType(eventType);
    const speechText = safeText$4(pickPayloadValue(payload, "speechText", "speech_text"));
    const socketMessage = safeText$4(pickPayloadValue(payload, "message", "content"));
    const socketTitle = safeText$4(payload.title);
    const soundType = safeText$4(pickPayloadValue(payload, "soundType", "sound_type") || "default");
    const priority = safeText$4(payload.priority || "normal");
    const jumpPath = safeText$4(pickPayloadValue(payload, "jumpPath", "jump_path"));
    const jumpParams = pickPayloadValue(payload, "jumpParams", "jump_params");
    const dedupeKey = safeText$4(pickPayloadValue(payload, "dedupeKey", "dedupe_key"));
    const timestamp = safeText$4(pickPayloadValue(payload, "timestamp", "created_at"));
    if (eventName === "new_delivery" || eventName === "order_assigned") {
      const transfer = isTransferOrder(order);
      const type = normalizedType || (transfer ? "transfer" : "new_order");
      const fallbackTitle = transfer ? "收到转派订单" : "收到新派单";
      const fallbackText = transfer ? `订单${safeText$4(order.order_no || orderId)}已转到你这里，请尽快处理` : `${getMerchantName(order)}有新的配送任务，请及时接单`;
      return {
        type,
        orderId,
        rawEventType: eventType,
        title: socketTitle || fallbackTitle,
        text: speechText || socketMessage || fallbackText,
        body: socketMessage || speechText || fallbackText,
        dedupeKey: dedupeKey || `${type}:${orderId}:${timestamp || Number(order.status || 0)}`,
        target: buildTargetFromJump(
          jumpPath,
          jumpParams,
          orderId
        ) || (transfer ? buildOrderDetailTarget(orderId) : buildOrdersIndexTarget("new_delivery", orderId)),
        soundType,
        priority,
        meta: { order, payload, eventName }
      };
    }
    if (eventName === "order_transfer" || eventName === "order_reassign") {
      return {
        type: "transfer",
        orderId,
        title: socketTitle || "订单转派提醒",
        text: speechText || socketMessage || `订单${safeText$4(order.order_no || orderId)}转派信息有更新`,
        body: socketMessage || speechText || `订单${safeText$4(order.order_no || orderId)}转派信息有更新`,
        dedupeKey: dedupeKey || `transfer:${orderId}:${safeText$4(order.transfer_status || order.updated_at || "")}`,
        target: buildTargetFromJump(jumpPath, jumpParams, orderId),
        soundType,
        priority,
        meta: { order, payload, eventName }
      };
    }
    if (eventName === "order_cancelled") {
      return {
        type: "cancel",
        orderId,
        title: "订单已取消",
        text: `订单${safeText$4(order.order_no || orderId)}已取消，请停止配送`,
        body: `订单${safeText$4(order.order_no || orderId)}已取消，请停止配送`,
        dedupeKey: `cancel:${orderId}`,
        target: buildOrderDetailTarget(orderId),
        meta: { order, eventName }
      };
    }
    if (eventName === "merchant_ready") {
      return {
        type: "pickup_ready",
        orderId,
        title: "商家已出餐",
        text: `${getMerchantName(order)}已出餐，请尽快取餐`,
        body: `${getMerchantName(order)}已出餐，请尽快取餐`,
        dedupeKey: `pickup_ready:${orderId}`,
        target: buildOrdersIndexTarget("pickup_ready", orderId),
        meta: { order, eventName }
      };
    }
    if (eventName === "order_timeout_warning") {
      return {
        type: "timeout",
        orderId,
        title: "订单即将超时",
        text: `订单${safeText$4(order.order_no || orderId)}即将超时，请尽快处理`,
        body: `订单${safeText$4(order.order_no || orderId)}即将超时，请尽快处理`,
        dedupeKey: `timeout:${orderId}:${getTimeoutBucket(order) || "socket"}`,
        target: buildOrderDetailTarget(orderId),
        meta: { order, eventName }
      };
    }
    if (eventName === "dispatch_notice" || eventName === "station_notice" || eventName === "town_message_notice") {
      const title = safeText$4(payload.title || "站长/调度通知");
      const text = safeText$4(payload.content || payload.message || "您有新的站长或调度通知，请及时查看");
      return {
        type: "station_notice",
        title,
        text,
        body: text,
        dedupeKey: `station_notice:${safeText$4(payload.notice_id || payload.id || text)}`,
        target: ((_a = payload == null ? void 0 : payload.target) == null ? void 0 : _a.url) ? payload.target : { type: "navigate", url: "/pages/index/index" },
        meta: { payload, eventName }
      };
    }
    return null;
  }
  function emitRefreshEvents(reminder = {}) {
    emitUniEvent(REMINDER_EVENT_NAME, reminder);
    if (["new_order", "transfer", "cancel", "timeout", "pickup_ready"].includes(reminder.type)) {
      emitUniEvent(ORDER_REFRESH_EVENT_NAME, {
        type: reminder.type,
        orderId: reminder.orderId || "",
        meta: reminder.meta || {}
      });
    }
  }
  function handleReminder(reminder = {}, { source = "unknown" } = {}) {
    const type = safeText$4(reminder.type);
    if (!type) {
      return false;
    }
    emitRefreshEvents(reminder);
    const settings = getReminderSettingsSnapshot();
    if (!isReminderEnabledForType(type, settings)) {
      logInfo(`提醒类型已关闭，跳过播报: ${type}`, { source });
      return false;
    }
    if (shouldSkipReminder(reminder)) {
      logInfo(`命中去重，跳过重复提醒: ${type}`, { source, dedupeKey: reminder.dedupeKey });
      return false;
    }
    if (shouldSendSystemNotification()) {
      createSystemNotification(reminder);
    }
    playReminderAlert({
      title: reminder.title || "骑手提醒",
      text: reminder.text || reminder.body || reminder.title || "您有新的骑手提醒",
      voice: settings.voiceEnabled,
      sound: settings.soundEnabled,
      vibration: settings.vibrationEnabled,
      toast: state.appVisible,
      soundType: reminder.soundType || "default",
      priority: reminder.priority || "normal"
    });
    return true;
  }
  function evaluateOrderChanges(list = []) {
    const latestMap = /* @__PURE__ */ new Map();
    list.forEach((order) => {
      const id = safeId(order.id);
      if (id) {
        latestMap.set(id, {
          raw: order,
          snapshot: buildOrderSnapshot(order)
        });
      }
    });
    const isInitialLoad = !state.orderSnapshot.size;
    if (!isInitialLoad) {
      latestMap.forEach(({ raw, snapshot }, id) => {
        var _a;
        const previous = (_a = state.orderSnapshot.get(id)) == null ? void 0 : _a.snapshot;
        if (!previous) {
          handleReminder({
            type: isTransferOrder(raw) ? "transfer" : "new_order",
            orderId: id,
            title: isTransferOrder(raw) ? "收到转派订单" : "收到新派单",
            text: isTransferOrder(raw) ? `订单${safeText$4(raw.order_no || id)}已转到你这里，请及时处理` : `${getMerchantName(raw)}有新的配送任务，请及时接单`,
            body: isTransferOrder(raw) ? `订单${safeText$4(raw.order_no || id)}已转到你这里，请及时处理` : `${getMerchantName(raw)}有新的配送任务，请及时接单`,
            dedupeKey: `${isTransferOrder(raw) ? "transfer" : "new_order"}:${id}:${snapshot.status}`,
            target: isTransferOrder(raw) ? buildOrderDetailTarget(id) : buildOrdersIndexTarget("new_delivery", id),
            meta: { order: raw, source: "order_poll_new" }
          }, { source: "order-poll:new" });
          return;
        }
        if (previous.status !== 7 && snapshot.status === 7) {
          handleReminder({
            type: "cancel",
            orderId: id,
            title: "订单已取消",
            text: `订单${safeText$4(raw.order_no || id)}已取消，请停止配送`,
            body: `订单${safeText$4(raw.order_no || id)}已取消，请停止配送`,
            dedupeKey: `cancel:${id}`,
            target: buildOrderDetailTarget(id),
            meta: { order: raw, source: "order_poll_cancel" }
          }, { source: "order-poll:cancel" });
        }
        if (!previous.merchantReady && snapshot.merchantReady) {
          handleReminder({
            type: "pickup_ready",
            orderId: id,
            title: "商家已出餐",
            text: `${getMerchantName(raw)}已出餐，请尽快取餐`,
            body: `${getMerchantName(raw)}已出餐，请尽快取餐`,
            dedupeKey: `pickup_ready:${id}`,
            target: buildOrdersIndexTarget("pickup_ready", id),
            meta: { order: raw, source: "order_poll_pickup_ready" }
          }, { source: "order-poll:pickup-ready" });
        }
        const transferSignatureChanged = previous.isTransferOrder !== snapshot.isTransferOrder || previous.transferStatus !== snapshot.transferStatus || previous.transferTag !== snapshot.transferTag || previous.transferToUserId !== snapshot.transferToUserId || previous.transferFromUserId !== snapshot.transferFromUserId;
        if (transferSignatureChanged && snapshot.isTransferOrder) {
          handleReminder({
            type: "transfer",
            orderId: id,
            title: "订单转派提醒",
            text: `订单${safeText$4(raw.order_no || id)}转派信息有更新`,
            body: `订单${safeText$4(raw.order_no || id)}转派信息有更新`,
            dedupeKey: `transfer:${id}:${snapshot.transferStatus || snapshot.updatedAt || snapshot.transferTag}`,
            target: buildOrderDetailTarget(id),
            meta: { order: raw, source: "order_poll_transfer" }
          }, { source: "order-poll:transfer" });
        }
        if (snapshot.timeoutBucket && snapshot.timeoutBucket !== previous.timeoutBucket) {
          handleReminder({
            type: "timeout",
            orderId: id,
            title: "订单即将超时",
            text: `订单${safeText$4(raw.order_no || id)}即将超时，请尽快处理`,
            body: `订单${safeText$4(raw.order_no || id)}即将超时，请尽快处理`,
            dedupeKey: `timeout:${id}:${snapshot.timeoutBucket}`,
            target: buildOrderDetailTarget(id),
            meta: { order: raw, source: "order_poll_timeout" }
          }, { source: "order-poll:timeout" });
        }
      });
    }
    state.orderSnapshot = latestMap;
  }
  async function pollOrders() {
    if (!state.token || state.orderPollInFlight) {
      return;
    }
    state.orderPollInFlight = true;
    try {
      const res = await getRiderOrders();
      const user = state.userInfo || getStoredUserInfo() || {};
      let list = toArray((res == null ? void 0 : res.data) ?? res);
      if (!isMerchantDeliveryUser(user)) {
        list = list.filter((order = {}) => order.order_type !== "supermarket");
      }
      evaluateOrderChanges(list);
    } catch (error) {
      logError("订单提醒轮询失败", error);
    } finally {
      state.orderPollInFlight = false;
    }
  }
  async function pollTownMessages() {
    if (!state.token || state.townPollInFlight || !isTownStationmaster(state.userInfo || {})) {
      return;
    }
    if (getCurrentRoutePath() === "/pages/station-messages/index" || getCurrentRoutePath() === "/pages/station-messages/detail") {
      return;
    }
    state.townPollInFlight = true;
    try {
      const res = await getTownErrandConversations({}, {
        background: true,
        silent: true,
        suppressAuthToast: true,
        suppressErrorToast: true
      });
      const list = toArray((res == null ? void 0 : res.data) ?? res);
      const unreadTotal = list.reduce((sum, item = {}) => sum + pickUnreadCount$1(item), 0);
      emitUniEvent(TOWN_UNREAD_EVENT_NAME, { unreadTotal });
      if (!state.townInitialized) {
        state.townInitialized = true;
        state.townUnreadTotal = unreadTotal;
        return;
      }
      if (unreadTotal > state.townUnreadTotal) {
        handleReminder({
          type: "station_notice",
          title: "收到站长消息",
          text: "您有新的乡镇跑腿或站长消息，请及时查看",
          body: "您有新的乡镇跑腿或站长消息，请及时查看",
          dedupeKey: `station_notice:town_unread:${unreadTotal}`,
          target: { type: "navigate", url: "/pages/station-messages/index" },
          meta: { unreadTotal }
        }, { source: "town-message-poll" });
      }
      state.townUnreadTotal = unreadTotal;
    } catch (error) {
      logError("站长消息提醒轮询失败", error);
    } finally {
      state.townPollInFlight = false;
    }
  }
  function stopOrderPollTimer() {
    if (state.orderPollTimer) {
      clearInterval(state.orderPollTimer);
      state.orderPollTimer = null;
    }
  }
  function stopTownPollTimer() {
    if (state.townPollTimer) {
      clearInterval(state.townPollTimer);
      state.townPollTimer = null;
    }
  }
  function restartOrderPolling() {
    stopOrderPollTimer();
    if (!state.token || !state.userInfo || !isRiderAppUser(state.userInfo)) {
      return;
    }
    const interval = state.appVisible ? ORDER_POLL_INTERVAL_FOREGROUND : ORDER_POLL_INTERVAL_BACKGROUND;
    state.orderPollTimer = setInterval(() => {
      pollOrders();
    }, interval);
  }
  function restartTownPolling() {
    stopTownPollTimer();
    if (!state.token || !isTownStationmaster(state.userInfo || {})) {
      emitUniEvent(TOWN_UNREAD_EVENT_NAME, { unreadTotal: 0 });
      return;
    }
    const interval = state.appVisible ? TOWN_POLL_INTERVAL_FOREGROUND : TOWN_POLL_INTERVAL_BACKGROUND;
    state.townPollTimer = setInterval(() => {
      pollTownMessages();
    }, interval);
  }
  function bindSocketReminderEvents() {
    if (state.socketCleanup) {
      state.socketCleanup();
      state.socketCleanup = null;
    }
    if (isAppPlatform()) {
      disconnectSocket();
      logInfo("App 端关闭 Socket 提醒，统一使用轮询兜底");
      return;
    }
    if (!state.token) {
      return;
    }
    initSocket(state.token);
    state.socketCleanup = onReminderEvents((payload, eventName) => {
      const reminder = buildReminderFromSocket(eventName, payload);
      if (!reminder) {
        return;
      }
      handleReminder(reminder, { source: `socket:${eventName}` });
    });
  }
  function resetRuntimeState() {
    stopOrderPollTimer();
    stopTownPollTimer();
    if (state.socketCleanup) {
      state.socketCleanup();
      state.socketCleanup = null;
    }
    disconnectSocket();
    state.orderPollInFlight = false;
    state.townPollInFlight = false;
    state.orderSnapshot = /* @__PURE__ */ new Map();
    state.townUnreadTotal = 0;
    state.townInitialized = false;
  }
  function initReminderCenter() {
    if (state.initialized) {
      return;
    }
    state.initialized = true;
    bindPushClickListeners();
    logInfo("统一提醒中心已初始化");
  }
  function setReminderAppVisibility(visible = true) {
    state.appVisible = !!visible;
    restartOrderPolling();
    restartTownPolling();
  }
  function syncReminderCenterSession({ token = "", userInfo = null } = {}) {
    const safeToken = safeText$4(token);
    const safeUser = userInfo && typeof userInfo === "object" ? userInfo : null;
    const isReady = !!safeToken && !!safeUser && isRiderAppUser(safeUser);
    if (!isReady) {
      state.token = "";
      state.userInfo = null;
      resetRuntimeState();
      return false;
    }
    const tokenChanged = state.token !== safeToken;
    state.token = safeToken;
    state.userInfo = safeUser;
    if (tokenChanged) {
      state.orderSnapshot = /* @__PURE__ */ new Map();
      state.townInitialized = false;
      state.townUnreadTotal = 0;
    }
    bindSocketReminderEvents();
    restartOrderPolling();
    restartTownPolling();
    if (!state.pollKickoffAt || tokenChanged) {
      state.pollKickoffAt = Date.now();
      pollOrders();
      pollTownMessages();
    }
    return true;
  }
  function stopReminderCenter() {
    state.token = "";
    state.userInfo = null;
    resetRuntimeState();
  }
  const REMINDER_CENTER_EVENTS = {
    reminder: REMINDER_EVENT_NAME,
    orderRefresh: ORDER_REFRESH_EVENT_NAME,
    townUnread: TOWN_UNREAD_EVENT_NAME,
    settingsChanged: SETTINGS_CHANGED_EVENT_NAME
  };
  function notifyReminderSettingsChanged() {
    emitUniEvent(SETTINGS_CHANGED_EVENT_NAME, getReminderSettingsSnapshot());
  }
  function formatTime(time, format = "YYYY-MM-DD HH:mm") {
    if (!time)
      return "";
    const date = new Date(time);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return format.replace("YYYY", year).replace("MM", month).replace("DD", day).replace("HH", hours).replace("mm", minutes).replace("ss", seconds);
  }
  const _sfc_main$h = {
    data() {
      return {
        isOnline: true,
        nickname: "骑手",
        userProfile: null,
        stationMessageUnread: 0,
        merchantAuditPending: 0,
        riderAuditPending: 0,
        allOrders: [],
        errandOrders: [],
        stats: {
          todayDone: 0,
          delivering: 0,
          todayEarning: "0.00",
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
        workbenchRefreshTimer: null
      };
    },
    computed: {
      pendingOrders() {
        const profile = this.userProfile || getUserInfo$1() || {};
        if (isMerchantDeliveryUser(profile)) {
          return this.allOrders.filter((order) => Number(order.status) === 3);
        }
        if (isTownStationmaster(profile) || isTownScopeUser(profile)) {
          return this.allOrders.filter((order) => this.canShowTownPendingOrder(order));
        }
        if (isCountyRider(profile)) {
          return this.allOrders.filter((order) => this.canShowCountyPendingOrder(order));
        }
        return [];
      },
      isMerchantDeliveryMode() {
        const profile = this.userProfile || getUserInfo$1() || {};
        return isMerchantDeliveryUser(profile);
      },
      showStationMessageEntry() {
        const profile = this.userProfile || {};
        return !isMerchantDeliveryUser(profile) && isTownStationmaster(profile);
      },
      showMerchantAuditEntry() {
        const profile = this.userProfile || {};
        return !isMerchantDeliveryUser(profile) && isTownStationmaster(profile);
      },
      showRiderAuditEntry() {
        const profile = this.userProfile || {};
        return !isMerchantDeliveryUser(profile) && isTownStationmaster(profile);
      }
    },
    onLoad() {
      const savedStatus = getRiderStatus();
      this.isOnline = savedStatus === 1;
      const storedUser = getUserInfo$1();
      if (storedUser) {
        this.userProfile = storedUser;
        this.nickname = storedUser.nickname || (isMerchantDeliveryUser(storedUser) ? "配送员" : "骑手");
      }
      this.bindReminderEvents();
    },
    async onShow() {
      var _a;
      const app = typeof getApp === "function" ? getApp() : null;
      const refreshSession = (_a = app == null ? void 0 : app.globalData) == null ? void 0 : _a.refreshRiderSession;
      if (typeof refreshSession === "function") {
        try {
          await refreshSession(false);
        } catch (error) {
          formatAppLog("error", "at pages/index/index.vue:205", "工作台刷新骑手会话失败", error);
        }
      }
      this.loadData();
    },
    onUnload() {
      this.unbindReminderEvents();
      if (this.workbenchRefreshTimer) {
        clearTimeout(this.workbenchRefreshTimer);
        this.workbenchRefreshTimer = null;
      }
    },
    methods: {
      bindReminderEvents() {
        if (!this.reminderEventHandler) {
          this.reminderEventHandler = (payload = {}) => {
            if (payload.type === "station_notice") {
              this.loadStationMessageSummary();
            }
          };
        }
        if (!this.orderRefreshHandler) {
          this.orderRefreshHandler = () => {
            if (this.workbenchRefreshTimer) {
              clearTimeout(this.workbenchRefreshTimer);
            }
            this.workbenchRefreshTimer = setTimeout(() => {
              Promise.all([
                this.loadOrders(),
                this.loadTodaySummary(),
                this.loadErrands()
              ]).then(() => {
                this.calculateQueueStats();
              });
            }, 300);
          };
        }
        if (!this.townUnreadHandler) {
          this.townUnreadHandler = (payload = {}) => {
            this.stationMessageUnread = Number(payload.unreadTotal || 0);
          };
        }
        uni.$off(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler);
        uni.$off(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler);
        uni.$off(REMINDER_CENTER_EVENTS.townUnread, this.townUnreadHandler);
        uni.$on(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler);
        uni.$on(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler);
        uni.$on(REMINDER_CENTER_EVENTS.townUnread, this.townUnreadHandler);
      },
      unbindReminderEvents() {
        if (this.reminderEventHandler) {
          uni.$off(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler);
        }
        if (this.orderRefreshHandler) {
          uni.$off(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler);
        }
        if (this.townUnreadHandler) {
          uni.$off(REMINDER_CENTER_EVENTS.townUnread, this.townUnreadHandler);
        }
      },
      formatTime,
      formatBadgeCount(count) {
        return count > 99 ? "99+" : String(count);
      },
      getStatusText(status) {
        var _a;
        return ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.text) || "未知状态";
      },
      safeText(value2) {
        if (value2 === void 0 || value2 === null) {
          return "";
        }
        return String(value2).trim();
      },
      toBoolean(value2) {
        return value2 === true || value2 === 1 || value2 === "1" || value2 === "true";
      },
      isTransferOrder(order = {}) {
        return this.toBoolean(order.is_transfer_order) || !!this.safeText(order.transfer_tag);
      },
      getTransferTag(order = {}) {
        return this.safeText(order.transfer_tag) || (this.isTransferOrder(order) ? "转派单" : "");
      },
      getTransferToTownName(order = {}) {
        const targetTown = order.transfer_to_town;
        if (targetTown && typeof targetTown === "object") {
          return this.safeText(
            targetTown.area_name || targetTown.town_name || targetTown.label || targetTown.name || targetTown.value
          );
        }
        return this.safeText(targetTown);
      },
      getTransferFromUserName(order = {}) {
        const transferFromUser = order.transfer_from_user;
        if (transferFromUser && typeof transferFromUser === "object") {
          return this.safeText(
            transferFromUser.nickname || transferFromUser.real_name || transferFromUser.name || transferFromUser.username
          );
        }
        return this.safeText(transferFromUser) || "县城司机";
      },
      getTransferWorkbenchText(order = {}) {
        const targetTown = this.getTransferToTownName(order);
        const fromUser = this.getTransferFromUserName(order);
        const summary = this.safeText(order.transfer_chain_summary);
        if (summary) {
          return summary;
        }
        if (targetTown) {
          return `来源：${fromUser} · 目标乡镇：${targetTown}`;
        }
        return `来源：${fromUser}`;
      },
      isTownOrder(order = {}) {
        return order.order_type === "town" || order.delivery_scope === "town_delivery" || !!this.getTownName(order);
      },
      getTownName(order = {}) {
        return order.customer_town || order.town_name || order.rider_town || this.getTransferToTownName(order) || "";
      },
      normalizeIdentityValue(value2) {
        if (value2 === void 0 || value2 === null || value2 === "") {
          return "";
        }
        return String(value2);
      },
      getCurrentRiderId() {
        const profile = this.userProfile || getUserInfo$1() || {};
        return this.normalizeIdentityValue(profile.id || profile.user_id || profile.userId);
      },
      getOrderOwnerId(order = {}) {
        return this.normalizeIdentityValue(order.rider_id || order.riderId || order.user_id || order.userId);
      },
      getOrderResponsibleId(order = {}) {
        return this.normalizeIdentityValue(
          order.current_responsible_user_id || order.currentResponsibleUserId || order.rider_id || order.riderId
        );
      },
      isOwnedByCurrentRider(order = {}) {
        const currentRiderId = this.getCurrentRiderId();
        const orderOwnerId = this.getOrderOwnerId(order);
        return !!currentRiderId && !!orderOwnerId && currentRiderId === orderOwnerId;
      },
      isTownPoolOrder(order = {}) {
        if (!this.isTownOrder(order)) {
          return false;
        }
        const status = Number(order.status);
        if (![3, 4].includes(status)) {
          return false;
        }
        return !this.getOrderResponsibleId(order);
      },
      canShowTownPendingOrder(order = {}) {
        if (!this.isTownOrder(order) && !this.isTransferOrder(order)) {
          return false;
        }
        return this.isTownPoolOrder(order);
      },
      canShowCountyPendingOrder(order = {}) {
        if (this.isTownOrder(order) || this.isTransferOrder(order)) {
          return false;
        }
        const status = Number(order.status);
        return [4, 5].includes(status) && this.isOwnedByCurrentRider(order);
      },
      getPendingEmptyTip() {
        const profile = this.userProfile || getUserInfo$1() || {};
        if (isTownStationmaster(profile)) {
          return "当前没有本乡镇可见配送订单";
        }
        return "当前没有分配到你的配送任务";
      },
      async loadData() {
        await this.loadUserInfo();
        await this.loadOrders();
        await this.loadTodaySummary();
        await this.loadErrands();
        this.calculateQueueStats();
        this.loadWorkbenchSecondaryData();
      },
      async loadWorkbenchSecondaryData() {
        const tasks = [];
        if (this.showStationMessageEntry) {
          tasks.push(this.loadStationMessageSummary(true));
        }
        if (this.showMerchantAuditEntry) {
          tasks.push(this.loadMerchantAuditSummary());
        }
        if (this.showRiderAuditEntry) {
          tasks.push(this.loadRiderAuditSummary());
        }
        if (!tasks.length) {
          return;
        }
        await Promise.allSettled(tasks);
      },
      async loadUserInfo() {
        try {
          const res = await getUserInfo({
            background: true,
            silent: true,
            suppressAuthToast: true,
            suppressErrorToast: true
          });
          if (res.data) {
            this.userProfile = res.data;
            this.nickname = res.data.nickname || (isMerchantDeliveryUser(res.data) ? "配送员" : "骑手");
          }
        } catch (e) {
          formatAppLog("error", "at pages/index/index.vue:425", "加载用户信息失败", e);
        }
      },
      async loadOrders() {
        try {
          const res = await getRiderOrders({}, {
            background: true,
            silent: true,
            suppressAuthToast: true,
            suppressErrorToast: true
          });
          let list = res.data || [];
          const profile = this.userProfile || getUserInfo$1() || {};
          if (!isMerchantDeliveryUser(profile)) {
            list = list.filter((order) => order.order_type !== "supermarket");
          }
          this.allOrders = list;
        } catch (e) {
          formatAppLog("error", "at pages/index/index.vue:444", "加载订单失败", e);
          this.allOrders = [];
        }
      },
      async loadErrands() {
        if (this.isMerchantDeliveryMode) {
          this.errandOrders = [];
          return;
        }
        try {
          const res = await getErrandList({ status: 1 }, {
            background: true,
            silent: true,
            suppressAuthToast: true,
            suppressErrorToast: true
          });
          this.errandOrders = res.data || [];
        } catch (e) {
          formatAppLog("error", "at pages/index/index.vue:463", "加载跑腿订单失败", e);
          this.errandOrders = [];
        }
      },
      async loadStationMessageSummary(isFirstLoad = false) {
        var _a, _b, _c;
        if (!this.showStationMessageEntry) {
          this.stationMessageUnread = 0;
          return;
        }
        try {
          const res = await getTownErrandConversations({}, {
            background: true,
            silent: true,
            suppressAuthToast: true,
            suppressErrorToast: true
          });
          const source = Array.isArray(res == null ? void 0 : res.data) ? res.data : Array.isArray((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.list) ? res.data.list : Array.isArray((_b = res == null ? void 0 : res.data) == null ? void 0 : _b.rows) ? res.data.rows : Array.isArray((_c = res == null ? void 0 : res.data) == null ? void 0 : _c.data) ? res.data.data : Array.isArray(res) ? res : [];
          const unreadTotal = source.reduce((sum, item = {}) => {
            const unread = Number(item.unread_count ?? item.unreadCount ?? item.unread_num ?? 0);
            return sum + (unread > 0 ? unread : 0);
          }, 0);
          this.stationMessageUnread = unreadTotal;
        } catch (error) {
          formatAppLog("error", "at pages/index/index.vue:496", "加载站长消息未读数失败", error);
        }
      },
      async loadMerchantAuditSummary() {
        var _a, _b, _c, _d;
        if (!this.showMerchantAuditEntry) {
          this.merchantAuditPending = 0;
          return;
        }
        try {
          const res = await getTownMerchantApplications({
            status: "pending",
            page: 1,
            page_size: 1
          }, {
            background: true,
            silent: true,
            suppressAuthToast: true,
            suppressErrorToast: true
          });
          const payload = (res == null ? void 0 : res.data) ?? res ?? {};
          const list = Array.isArray(payload) ? payload : Array.isArray(payload == null ? void 0 : payload.list) ? payload.list : Array.isArray(payload == null ? void 0 : payload.rows) ? payload.rows : Array.isArray(payload == null ? void 0 : payload.data) ? payload.data : [];
          const total = Number(
            ((_a = payload == null ? void 0 : payload.summary) == null ? void 0 : _a.pending_count) ?? ((_b = payload == null ? void 0 : payload.stats) == null ? void 0 : _b.pending_count) ?? (payload == null ? void 0 : payload.pending_count) ?? (payload == null ? void 0 : payload.total) ?? ((_c = payload == null ? void 0 : payload.meta) == null ? void 0 : _c.total) ?? ((_d = payload == null ? void 0 : payload.pagination) == null ? void 0 : _d.total) ?? list.length
          );
          this.merchantAuditPending = Number.isFinite(total) ? total : list.length;
        } catch (error) {
          formatAppLog("error", "at pages/index/index.vue:536", "加载商家入驻待审核数失败", error);
          this.merchantAuditPending = 0;
        }
      },
      async loadRiderAuditSummary() {
        var _a, _b, _c, _d;
        if (!this.showRiderAuditEntry) {
          this.riderAuditPending = 0;
          return;
        }
        try {
          const res = await getTownRiderApplications({
            status: "pending",
            page: 1,
            page_size: 1
          }, {
            background: true,
            silent: true,
            suppressAuthToast: true,
            suppressErrorToast: true
          });
          const payload = (res == null ? void 0 : res.data) ?? res ?? {};
          const list = Array.isArray(payload) ? payload : Array.isArray(payload == null ? void 0 : payload.list) ? payload.list : Array.isArray(payload == null ? void 0 : payload.rows) ? payload.rows : Array.isArray(payload == null ? void 0 : payload.data) ? payload.data : [];
          const total = Number(
            ((_a = payload == null ? void 0 : payload.summary) == null ? void 0 : _a.pending_count) ?? ((_b = payload == null ? void 0 : payload.stats) == null ? void 0 : _b.pending_count) ?? (payload == null ? void 0 : payload.pending_count) ?? (payload == null ? void 0 : payload.total) ?? ((_c = payload == null ? void 0 : payload.meta) == null ? void 0 : _c.total) ?? ((_d = payload == null ? void 0 : payload.pagination) == null ? void 0 : _d.total) ?? list.length
          );
          this.riderAuditPending = Number.isFinite(total) ? total : list.length;
        } catch (error) {
          formatAppLog("error", "at pages/index/index.vue:577", "加载骑手待审核数失败", error);
          this.riderAuditPending = 0;
        }
      },
      async loadTodaySummary() {
        try {
          const res = await getRiderTodaySummary({}, {
            background: true,
            silent: true,
            suppressAuthToast: true,
            suppressErrorToast: true
          });
          const summary = (res == null ? void 0 : res.data) || {};
          this.stats.todayDone = Number(
            summary.today_completed_orders ?? summary.todayDone ?? summary.completed_orders ?? 0
          );
          this.stats.delivering = Number(
            summary.today_delivering_orders ?? summary.todayDeliveringOrders ?? summary.delivering_orders ?? 0
          );
          this.stats.todayEarning = (parseFloat(
            summary.today_rider_income ?? summary.today_settled_income ?? summary.todayIncome ?? 0
          ) || 0).toFixed(2);
        } catch (error) {
          formatAppLog("error", "at pages/index/index.vue:609", "加载今日订单统计失败", error);
          this.stats.todayDone = 0;
          this.stats.delivering = 0;
          this.stats.todayEarning = "0.00";
        }
      },
      calculateQueueStats() {
        this.stats.pending = this.pendingOrders.length;
        this.stats.errandPending = this.errandOrders.length;
      },
      async toggleOnline() {
        if (this.isMerchantDeliveryMode) {
          uni.showToast({ title: "自配送员无需切换接单状态", icon: "none" });
          return;
        }
        if (this.isOnline) {
          this.showConfirmDialog = true;
          this.countdown = 5;
          this.countdownTimer = setInterval(() => {
            this.countdown--;
            if (this.countdown <= 0) {
              clearInterval(this.countdownTimer);
            }
          }, 1e3);
        } else {
          try {
            const newStatus = 1;
            await updateRiderStatus(newStatus);
            this.isOnline = true;
            setRiderStatus(newStatus);
            uni.showToast({
              title: "已开始接单",
              icon: "none"
            });
          } catch (error) {
            formatAppLog("error", "at pages/index/index.vue:649", "切换接单状态失败", error);
          }
        }
      },
      // 确认下班
      async confirmOffWork() {
        if (this.countdown > 0) {
          uni.showToast({
            title: "请等待倒计时结束",
            icon: "none"
          });
          return;
        }
        try {
          const newStatus = 0;
          await updateRiderStatus(newStatus);
          setRiderStatus(newStatus);
          this.isOnline = false;
          this.showConfirmDialog = false;
          uni.showToast({
            title: "已暂停接单",
            icon: "none"
          });
        } catch (error) {
          formatAppLog("error", "at pages/index/index.vue:676", "切换休息状态失败", error);
        }
      },
      // 取消下班
      cancelOffWork() {
        this.showConfirmDialog = false;
        clearInterval(this.countdownTimer);
      },
      getBriefAddress(order) {
        try {
          const addr = typeof order.delivery_address === "string" ? JSON.parse(order.delivery_address) : order.delivery_address;
          return addr.detail || addr.address || `${addr.district || ""}${addr.street || ""}` || order.address || "未知地址";
        } catch (e) {
          return order.address || "未知地址";
        }
      },
      goOrders() {
        uni.navigateTo({ url: "/pages/orders/index" });
      },
      goErrands() {
        if (this.isMerchantDeliveryMode) {
          return;
        }
        uni.navigateTo({ url: "/pages/errands/index" });
      },
      goTodayOrders() {
        uni.navigateTo({ url: "/pages/today-orders/index" });
      },
      goStationMessages() {
        if (!this.showStationMessageEntry) {
          uni.showToast({ title: "仅乡镇站长可进入", icon: "none" });
          return;
        }
        uni.navigateTo({ url: "/pages/station-messages/index" });
      },
      goMerchantAudit() {
        if (!this.showMerchantAuditEntry) {
          uni.showToast({ title: "仅乡镇站长可进入", icon: "none" });
          return;
        }
        uni.navigateTo({ url: "/pages/merchant-audit/index" });
      },
      goRiderAudit() {
        if (!this.showRiderAuditEntry) {
          uni.showToast({ title: "仅乡镇站长可进入", icon: "none" });
          return;
        }
        uni.navigateTo({ url: "/pages/rider-audit/index" });
      },
      goOrderDetail(order) {
        const target = order.type === "errand" ? "errands" : "orders";
        uni.navigateTo({
          url: `/pages/${target}/detail?id=${order.id}`
        });
      }
    }
  };
  function _sfc_render$g(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("view", { class: "header-left" }, [
          vue.createElementVNode("text", { class: "header-emoji" }, "🛵"),
          vue.createElementVNode("view", { class: "header-info" }, [
            vue.createElementVNode(
              "text",
              { class: "header-title" },
              vue.toDisplayString($options.isMerchantDeliveryMode ? "自配送工作台" : "骑手工作台"),
              1
              /* TEXT */
            ),
            vue.createElementVNode(
              "text",
              { class: "header-sub" },
              vue.toDisplayString($options.isMerchantDeliveryMode ? `${$data.nickname}，请处理本店配送订单` : `${$data.nickname}，今天也辛苦了`),
              1
              /* TEXT */
            )
          ])
        ]),
        !$options.isMerchantDeliveryMode ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "status-switch",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.toggleOnline && $options.toggleOnline(...args))
        }, [
          vue.createElementVNode(
            "text",
            {
              class: vue.normalizeClass(["switch-text", { "highlight-online": $data.isOnline }])
            },
            vue.toDisplayString($data.isOnline ? "接单中" : "已休息"),
            3
            /* TEXT, CLASS */
          ),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["switch-dot", { online: $data.isOnline }])
            },
            null,
            2
            /* CLASS */
          )
        ])) : vue.createCommentVNode("v-if", true)
      ]),
      vue.createElementVNode("view", { class: "stats-grid" }, [
        vue.createElementVNode("view", { class: "stat-card" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            vue.toDisplayString($data.stats.todayDone),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "今日完成")
        ]),
        vue.createElementVNode("view", { class: "stat-card" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            vue.toDisplayString($data.stats.delivering),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "配送中")
        ]),
        vue.createElementVNode("view", { class: "stat-card" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            "¥" + vue.toDisplayString($data.stats.todayEarning),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "完成订单收入统计")
        ])
      ]),
      vue.createElementVNode("view", { class: "menu-section" }, [
        vue.createElementVNode("view", { class: "section-title-small" }, "📦 订单管理"),
        vue.createElementVNode("view", { class: "menu-grid" }, [
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[1] || (_cache[1] = (...args) => $options.goOrders && $options.goOrders(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#E6F7FF" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "📋")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "外卖订单"),
            $data.stats.pending > 0 ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "menu-badge"
              },
              vue.toDisplayString($data.stats.pending),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ]),
          !$options.isMerchantDeliveryMode ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "menu-item",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.goErrands && $options.goErrands(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#FFF7E6" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "🏃")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "跑腿订单"),
            $data.stats.errandPending > 0 ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "menu-badge"
              },
              vue.toDisplayString($data.stats.errandPending),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ])) : vue.createCommentVNode("v-if", true),
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[3] || (_cache[3] = (...args) => $options.goTodayOrders && $options.goTodayOrders(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#F0F5FF" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "📊")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "今日订单"),
            $data.stats.todayDone > 0 ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "menu-badge"
              },
              vue.toDisplayString($data.stats.todayDone),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "menu-section" }, [
        vue.createElementVNode("view", { class: "section-title-small" }, "🛠️ 我的服务"),
        vue.createElementVNode("view", { class: "menu-grid" }, [
          $options.showStationMessageEntry ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "menu-item",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.goStationMessages && $options.goStationMessages(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#FFF1F0" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "💬")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "跑腿代购消息"),
            $data.stationMessageUnread > 0 ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "menu-badge"
              },
              vue.toDisplayString($options.formatBadgeCount($data.stationMessageUnread)),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ])) : vue.createCommentVNode("v-if", true),
          $options.showMerchantAuditEntry ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 1,
            class: "menu-item",
            onClick: _cache[5] || (_cache[5] = (...args) => $options.goMerchantAudit && $options.goMerchantAudit(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#F6FFED" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "🏪")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "商家入驻审核"),
            $data.merchantAuditPending > 0 ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "menu-badge"
              },
              vue.toDisplayString($options.formatBadgeCount($data.merchantAuditPending)),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ])) : vue.createCommentVNode("v-if", true),
          $options.showRiderAuditEntry ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 2,
            class: "menu-item",
            onClick: _cache[6] || (_cache[6] = (...args) => $options.goRiderAudit && $options.goRiderAudit(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#F9F0FF" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "👤")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "骑手审核"),
            $data.riderAuditPending > 0 ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "menu-badge"
              },
              vue.toDisplayString($options.formatBadgeCount($data.riderAuditPending)),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ])) : vue.createCommentVNode("v-if", true)
        ])
      ]),
      $data.showConfirmDialog ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "confirm-dialog"
      }, [
        vue.createElementVNode("view", {
          class: "dialog-mask",
          onClick: _cache[7] || (_cache[7] = (...args) => $options.cancelOffWork && $options.cancelOffWork(...args))
        }),
        vue.createElementVNode("view", { class: "dialog-content" }, [
          vue.createElementVNode("view", { class: "dialog-title" }, "提示"),
          vue.createElementVNode("view", { class: "dialog-message" }, "确定现在下班吗？"),
          vue.createElementVNode("view", { class: "dialog-buttons" }, [
            vue.createElementVNode(
              "button",
              {
                class: vue.normalizeClass(["dialog-btn confirm-btn", { disabled: $data.countdown > 0 }]),
                onClick: _cache[8] || (_cache[8] = (...args) => $options.confirmOffWork && $options.confirmOffWork(...args))
              },
              vue.toDisplayString($data.countdown > 0 ? `确定 (${$data.countdown}s)` : "确定"),
              3
              /* TEXT, CLASS */
            ),
            vue.createElementVNode("button", {
              class: "dialog-btn cancel-btn",
              onClick: _cache[9] || (_cache[9] = (...args) => $options.cancelOffWork && $options.cancelOffWork(...args))
            }, " 取消 ")
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$h, [["render", _sfc_render$g], ["__scopeId", "data-v-1cf27b2a"], ["__file", "E:/固始县外卖骑手端/pages/index/index.vue"]]);
  const DELIVERY_DOMAIN = {
    PLATFORM: "platform_delivery",
    SELF: "self_delivery"
  };
  const DELIVERY_IDENTITY = {
    COUNTY_RIDER: "county_rider",
    TOWN_STATIONMASTER: "town_stationmaster",
    TOWN_RIDER: "town_rider",
    MERCHANT_SELF_DELIVERY: "merchant_self_delivery"
  };
  function getCurrentUserId(user = {}) {
    const rawId = (user == null ? void 0 : user.id) ?? (user == null ? void 0 : user.user_id) ?? (user == null ? void 0 : user.userId) ?? "";
    return rawId === null || typeof rawId === "undefined" ? "" : String(rawId);
  }
  function resolveDeliveryProfile(user = {}) {
    if (isMerchantDeliveryUser(user)) {
      return {
        accountRole: "merchant_delivery",
        deliveryDomain: DELIVERY_DOMAIN.SELF,
        deliveryIdentity: DELIVERY_IDENTITY.MERCHANT_SELF_DELIVERY,
        isMerchantSelfDelivery: true,
        isPlatformDelivery: false,
        isTownStationmaster: false,
        isTownScope: false,
        useSimplifiedTabs: true,
        canReportDispatchLocation: false,
        nicknameLabel: "配送员"
      };
    }
    const townStationmaster = isTownStationmaster(user);
    const townScope = isTownScopeUser(user);
    return {
      accountRole: (user == null ? void 0 : user.role) || "",
      deliveryDomain: DELIVERY_DOMAIN.PLATFORM,
      deliveryIdentity: townStationmaster ? DELIVERY_IDENTITY.TOWN_STATIONMASTER : townScope ? DELIVERY_IDENTITY.TOWN_RIDER : DELIVERY_IDENTITY.COUNTY_RIDER,
      isMerchantSelfDelivery: false,
      isPlatformDelivery: true,
      isTownStationmaster: townStationmaster,
      isTownScope: townScope,
      useSimplifiedTabs: true,
      canReportDispatchLocation: isCountyRider(user) || townStationmaster,
      nicknameLabel: "骑手"
    };
  }
  function canReportDispatchLocationByProfile(user = {}) {
    return resolveDeliveryProfile(user).canReportDispatchLocation;
  }
  function normalizeText(value2) {
    if (value2 === void 0 || value2 === null) {
      return "";
    }
    return String(value2).trim();
  }
  function normalizeAvailableActions(order = {}) {
    const list = Array.isArray(order.available_actions) ? order.available_actions : [];
    return list.map((item) => normalizeText(item)).filter(Boolean);
  }
  function getOrderOwnerId(order = {}) {
    const raw = (order == null ? void 0 : order.rider_id) ?? (order == null ? void 0 : order.riderId) ?? "";
    return raw === null || typeof raw === "undefined" ? "" : String(raw);
  }
  function getOrderResponsibleId(order = {}) {
    const raw = (order == null ? void 0 : order.current_responsible_user_id) ?? (order == null ? void 0 : order.currentResponsibleUserId) ?? (order == null ? void 0 : order.rider_id) ?? (order == null ? void 0 : order.riderId) ?? "";
    return raw === null || typeof raw === "undefined" ? "" : String(raw);
  }
  function getOrderStatusText(status, { profile = {}, order = {} } = {}) {
    var _a;
    const backendText = normalizeText(order.status_text);
    if (backendText) {
      return backendText;
    }
    if (profile.isMerchantSelfDelivery) {
      if (Number(status) === 3)
        return "待配送";
      if (Number(status) === 5)
        return "配送中";
    }
    return ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.text) || "未知";
  }
  function hasOrderOwnership(order = {}, user = {}, { allowMerchantPending = true } = {}) {
    const currentUserId = getCurrentUserId(user);
    const orderOwnerId = getOrderOwnerId(order);
    const responsibleId = getOrderResponsibleId(order);
    const isMerchantPending = allowMerchantPending && Number(order == null ? void 0 : order.status) === 3 && !orderOwnerId && !responsibleId;
    if (isMerchantPending) {
      return true;
    }
    if (!currentUserId) {
      return false;
    }
    return currentUserId === orderOwnerId || currentUserId === responsibleId;
  }
  function canStartSelfDelivery(order = {}, profile = {}, owned = false) {
    const actions = normalizeAvailableActions(order);
    if (actions.includes("start_delivery")) {
      return owned;
    }
    return profile.isMerchantSelfDelivery && Number(order.status) === 3 && owned;
  }
  function canCompleteSelfDelivery(order = {}, profile = {}, owned = false) {
    const actions = normalizeAvailableActions(order);
    if (actions.includes("complete_delivery")) {
      return owned;
    }
    return profile.isMerchantSelfDelivery && Number(order.status) === 5 && owned;
  }
  function getPrimaryDeliveryAction(order = {}, { profile = {}, owned = false } = {}) {
    if (canStartSelfDelivery(order, profile, owned)) {
      return {
        key: "start_delivery",
        text: "开始配送",
        visible: true
      };
    }
    if (canCompleteSelfDelivery(order, profile, owned)) {
      return {
        key: "complete_delivery",
        text: "确认送达",
        visible: true
      };
    }
    if (owned && canRiderCallConfirmDeliveryApi(order.status)) {
      return {
        key: "complete_delivery",
        text: "确认送达",
        visible: true
      };
    }
    return {
      key: "",
      text: "",
      visible: false
    };
  }
  function getConfirmDeliveryHint(order = {}, {
    profile = {},
    owned = false,
    distanceLoading = false,
    distanceMeters = null,
    distanceError = ""
  } = {}) {
    if (!owned) {
      return "";
    }
    if (profile.isMerchantSelfDelivery) {
      if (Number(order.status) === 3) {
        return "当前订单已出餐，可由自配送员开始配送";
      }
      if (Number(order.status) === 5) {
        return "确认订单已送达后即可完成本次自配送";
      }
      return "当前订单暂不可执行自配送操作";
    }
    if (!canRiderCallConfirmDeliveryApi(order.status)) {
      return "订单未进入配送中，暂不可确认送达";
    }
    {
      return "测试期间已放开距离限制，可直接确认送达";
    }
  }
  function canShowSpecialComplete(order = {}, owned = false) {
    return owned && canRiderOfferSpecialComplete(order.status) && !canRiderCallConfirmDeliveryApi(order.status);
  }
  const _sfc_main$g = {
    data() {
      return {
        hasPageAccess: false,
        currentStatus: "",
        statusTabs: [],
        orderList: [],
        reminderScene: "",
        reminderOrderId: "",
        page: 1,
        pageSize: 10,
        refreshing: false,
        loadingMore: false,
        acceptingOrderId: "",
        reminderEventHandler: null,
        orderRefreshHandler: null,
        orderRefreshTimer: null
      };
    },
    onLoad(options) {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      this.applyReminderRouteOptions(options);
      this.bindReminderEvents();
      this.resetStatusTabs();
      this.loadOrderList();
    },
    onShow() {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      this.resetStatusTabs();
      this.loadOrderList();
    },
    onUnload() {
      this.unbindReminderEvents();
      if (this.orderRefreshTimer) {
        clearTimeout(this.orderRefreshTimer);
        this.orderRefreshTimer = null;
      }
    },
    methods: {
      applyReminderRouteOptions(options = {}) {
        this.reminderScene = String(options.scene || "").trim();
        this.reminderOrderId = String(options.orderId || "").trim();
      },
      bindReminderEvents() {
        if (!this.reminderEventHandler) {
          this.reminderEventHandler = (payload = {}) => {
            if (payload.type === "pickup_ready" && payload.orderId) {
              this.reminderScene = "pickup_ready";
              this.reminderOrderId = String(payload.orderId);
            }
          };
        }
        if (!this.orderRefreshHandler) {
          this.orderRefreshHandler = () => {
            if (this.orderRefreshTimer) {
              clearTimeout(this.orderRefreshTimer);
            }
            this.orderRefreshTimer = setTimeout(() => {
              this.loadOrderList();
            }, 300);
          };
        }
        uni.$off(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler);
        uni.$off(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler);
        uni.$on(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler);
        uni.$on(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler);
      },
      unbindReminderEvents() {
        if (this.reminderEventHandler) {
          uni.$off(REMINDER_CENTER_EVENTS.reminder, this.reminderEventHandler);
        }
        if (this.orderRefreshHandler) {
          uni.$off(REMINDER_CENTER_EVENTS.orderRefresh, this.orderRefreshHandler);
        }
      },
      formatTime,
      canRiderCallConfirmDeliveryApi,
      canRiderOfferSpecialComplete,
      ensurePageAccess() {
        const user = getUserInfo$1() || {};
        if (isRiderAppUser(user)) {
          return true;
        }
        uni.showToast({ title: "请先使用骑手账号登录", icon: "none" });
        uni.reLaunch({ url: "/pages/login/index" });
        return false;
      },
      isTownStationmasterUser() {
        return this.getDeliveryProfile().isTownScope || this.getDeliveryProfile().isTownStationmaster;
      },
      isMerchantDeliveryMode() {
        return this.getDeliveryProfile().isMerchantSelfDelivery;
      },
      isActualTownStationmaster() {
        return this.getDeliveryProfile().isTownStationmaster;
      },
      useSimplifiedTabs() {
        return this.getDeliveryProfile().useSimplifiedTabs;
      },
      getDeliveryProfile() {
        const user = getUserInfo$1() || {};
        return resolveDeliveryProfile(user);
      },
      buildStatusTabs() {
        if (this.isMerchantDeliveryMode()) {
          return [
            { key: "merchant_delivery_pending", label: "待配送", count: 0 },
            { key: "merchant_delivery_delivering", label: "配送中", count: 0 },
            { key: "6", label: "已完成", count: 0 }
          ];
        }
        if (this.isTownStationmasterUser()) {
          return [
            { key: "town_pending", label: "未接单", count: 0 },
            { key: "town_delivering", label: "配送中", count: 0 },
            { key: "6", label: "已完成", count: 0 }
          ];
        }
        if (this.useSimplifiedTabs()) {
          return [
            { key: "county_pending", label: "未接单", count: 0 },
            { key: "county_delivering", label: "配送中", count: 0 },
            { key: "6", label: "已完成", count: 0 }
          ];
        }
        return [
          { key: "", label: "全部", count: 0 },
          { key: "1", label: "待处理", count: 0 },
          { key: "2", label: "已接单", count: 0 },
          { key: "3", label: "备货中", count: 0 },
          { key: "4", label: "备货完成", count: 0 },
          { key: "5", label: "配送中", count: 0 },
          { key: "6", label: "已完成", count: 0 },
          { key: "transfer", label: "转派单", count: 0 }
        ];
      },
      getDefaultCurrentStatus() {
        if (this.isMerchantDeliveryMode()) {
          return "merchant_delivery_pending";
        }
        if (this.isTownStationmasterUser()) {
          return "town_pending";
        }
        if (this.useSimplifiedTabs()) {
          return "county_pending";
        }
        return "";
      },
      resetStatusTabs() {
        this.statusTabs = this.buildStatusTabs();
        const validKeys = this.statusTabs.map((tab) => tab.key);
        if (!validKeys.includes(this.currentStatus)) {
          this.currentStatus = this.getDefaultCurrentStatus();
        }
      },
      getStatusText(status) {
        return getOrderStatusText(status, {
          profile: this.getDeliveryProfile()
        });
      },
      safeText(value2) {
        if (value2 === void 0 || value2 === null) {
          return "";
        }
        return String(value2).trim();
      },
      toBoolean(value2) {
        return value2 === true || value2 === 1 || value2 === "1" || value2 === "true";
      },
      isTransferOrder(order = {}) {
        return this.toBoolean(order.is_transfer_order) || !!this.safeText(order.transfer_tag);
      },
      getTransferTag(order = {}) {
        return this.safeText(order.transfer_tag) || (this.isTransferOrder(order) ? "转派单" : "");
      },
      getTransferToTownName(order = {}) {
        const directTargetTownName = this.safeText(order.target_town_name);
        if (directTargetTownName) {
          return directTargetTownName;
        }
        const targetTown = order.transfer_to_town;
        if (targetTown && typeof targetTown === "object") {
          return this.safeText(
            targetTown.area_name || targetTown.town_name || targetTown.label || targetTown.name || targetTown.value
          );
        }
        return this.safeText(targetTown);
      },
      getTransferChainSummaryText(order = {}) {
        const summary = order.transfer_chain_summary;
        if (summary && typeof summary === "object") {
          return this.safeText(
            summary.summary || summary.text || summary.label || summary.description
          );
        }
        return this.safeText(summary);
      },
      getTransferFromUserName(order = {}) {
        const transferFromUser = order.transfer_from_user;
        if (transferFromUser && typeof transferFromUser === "object") {
          return this.safeText(
            transferFromUser.nickname || transferFromUser.real_name || transferFromUser.name || transferFromUser.username
          );
        }
        return this.safeText(transferFromUser) || "县城司机";
      },
      getTransferCardSummary(order = {}) {
        if (this.safeText(order.transfer_status) === "assigned_to_town_rider") {
          const targetUser = order.transfer_to_user;
          const targetName = targetUser && typeof targetUser === "object" ? this.safeText(targetUser.nickname || targetUser.username || targetUser.name) : "";
          return targetName ? `已转给：${targetName}` : "已转给骑手";
        }
        const pieces = [`来源：${this.getTransferFromUserName(order)}`];
        const targetTown = this.getTransferToTownName(order);
        if (targetTown) {
          pieces.push(`目标乡镇：${targetTown}`);
        }
        return pieces.join(" · ");
      },
      getStatusColor(status, order = {}) {
        var _a, _b;
        if (this.isTownOrder(order)) {
          const townStatusColors = {
            4: "#1f6f43",
            5: "#2b8a57",
            6: "#2b8a57"
          };
          return townStatusColors[Number(status)] || ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.color) || "#999";
        }
        return ((_b = ORDER_STATUS[status]) == null ? void 0 : _b.color) || "#999";
      },
      isTownOrder(order = {}) {
        return order.order_type === "town" || order.delivery_scope === "town_delivery" || !!this.getTownName(order);
      },
      getTownName(order = {}) {
        return order.customer_town || order.town_name || order.rider_town || this.getTransferToTownName(order) || "";
      },
      getCoordinateByKeys(source = {}, keys = []) {
        for (let i = 0; i < keys.length; i++) {
          const value2 = source[keys[i]];
          if (value2 !== void 0 && value2 !== null && value2 !== "") {
            return value2;
          }
        }
        return "";
      },
      normalizeIdentityValue(value2) {
        if (value2 === void 0 || value2 === null || value2 === "") {
          return "";
        }
        return String(value2);
      },
      getCurrentRiderId() {
        const user = getUserInfo$1() || {};
        return this.normalizeIdentityValue(this.getCoordinateByKeys(user, ["id", "user_id", "userId"]));
      },
      getOrderOwnerId(order = {}) {
        return this.normalizeIdentityValue(this.getCoordinateByKeys(order, ["rider_id", "riderId"]));
      },
      getOrderResponsibleId(order = {}) {
        return this.normalizeIdentityValue(this.getCoordinateByKeys(order, [
          "current_responsible_user_id",
          "currentResponsibleUserId",
          "rider_id",
          "riderId"
        ]));
      },
      hasOrderOwnership(order = {}) {
        return hasOrderOwnership(order, getUserInfo$1() || {});
      },
      isTownPoolOrder(order = {}) {
        if (!this.isTownOrder(order)) {
          return false;
        }
        const status = Number(order.status);
        if (![3, 4].includes(status)) {
          return false;
        }
        return !this.getOrderResponsibleId(order);
      },
      isAcceptedTownOrderForCurrentUser(order = {}) {
        const currentRiderId = this.getCurrentRiderId();
        const responsibleId = this.getOrderResponsibleId(order);
        return !!currentRiderId && !!responsibleId && currentRiderId === responsibleId;
      },
      canAcceptTownOrder(order = {}) {
        return this.isTownStationmasterUser() && this.isTownPoolOrder(order);
      },
      getMerchantCoords(order = {}) {
        const merchant = order.merchant || {};
        return {
          lng: this.getCoordinateByKeys(order, ["merchant_lng", "merchantLng"]) || this.getCoordinateByKeys(merchant, ["longitude", "lng"]),
          lat: this.getCoordinateByKeys(order, ["merchant_lat", "merchantLat"]) || this.getCoordinateByKeys(merchant, ["latitude", "lat"])
        };
      },
      getCustomerCoords(order = {}) {
        return {
          lng: this.getCoordinateByKeys(order, ["customer_lng", "delivery_longitude", "longitude", "lng"]),
          lat: this.getCoordinateByKeys(order, ["customer_lat", "delivery_latitude", "latitude", "lat"])
        };
      },
      formatCoordinate(coords = {}) {
        if (coords.lng === "" || coords.lat === "") {
          return "未提供坐标";
        }
        return `${coords.lng}, ${coords.lat}`;
      },
      canPickup(status) {
        return Number(status) === 4;
      },
      isTownPendingTabOrder(order = {}) {
        return this.isTownPoolOrder(order);
      },
      isTownDeliveringTabOrder(order = {}) {
        const status = Number(order.status);
        if (![2, 3, 4, 5].includes(status)) {
          return false;
        }
        if (this.isActualTownStationmaster()) {
          return !this.isTownPoolOrder(order);
        }
        return this.isAcceptedTownOrderForCurrentUser(order);
      },
      isCountyPendingTabOrder(order = {}) {
        return Number(order.status) === 1;
      },
      isCountyDeliveringTabOrder(order = {}) {
        return [2, 3, 4, 5].includes(Number(order.status));
      },
      filterTownStationmasterOrders(list = []) {
        if (this.reminderScene === "pickup_ready") {
          return list.filter((order) => Number(order.status) === 4);
        }
        switch (this.currentStatus) {
          case "town_pending":
            return list.filter((order) => this.isTownPendingTabOrder(order));
          case "town_delivering":
            return list.filter((order) => this.isTownDeliveringTabOrder(order));
          case "6":
            return list.filter((order) => Number(order.status) === 6);
          default:
            return list;
        }
      },
      filterCountyOrders(list = []) {
        if (this.reminderScene === "pickup_ready") {
          return list.filter((order) => Number(order.status) === 4);
        }
        switch (this.currentStatus) {
          case "county_pending":
            return list.filter((order) => this.isCountyPendingTabOrder(order));
          case "county_delivering":
            return list.filter((order) => this.isCountyDeliveringTabOrder(order));
          case "6":
            return list.filter((order) => Number(order.status) === 6);
          default:
            return list;
        }
      },
      canOperateOrder(order = {}) {
        return this.hasOrderOwnership(order);
      },
      canStartMerchantSelfDelivery(order = {}) {
        return canStartSelfDelivery(order, this.getDeliveryProfile(), this.hasOrderOwnership(order));
      },
      canConfirmMerchantSelfDelivery(order = {}) {
        return canCompleteSelfDelivery(order, this.getDeliveryProfile(), this.hasOrderOwnership(order));
      },
      getFullAddress(order) {
        try {
          const addr = typeof order.delivery_address === "string" ? JSON.parse(order.delivery_address) : order.delivery_address;
          return addr.province + addr.city + addr.district + addr.street + addr.detail;
        } catch (e) {
          return "未知地址";
        }
      },
      getBriefAddress(order) {
        try {
          const addr = typeof order.delivery_address === "string" ? JSON.parse(order.delivery_address) : order.delivery_address;
          return this.safeText(
            (addr == null ? void 0 : addr.detail) || (addr == null ? void 0 : addr.address) || `${(addr == null ? void 0 : addr.district) || ""}${(addr == null ? void 0 : addr.street) || ""}` || order.address
          );
        } catch (e) {
          return this.safeText(order.address);
        }
      },
      switchStatus(status) {
        this.currentStatus = status;
        this.clearReminderScene();
        this.page = 1;
        this.loadOrderList();
      },
      clearReminderScene() {
        this.reminderScene = "";
        this.reminderOrderId = "";
      },
      async loadOrderList() {
        if (!this.hasPageAccess) {
          return;
        }
        try {
          const params = {};
          if (!this.isTownStationmasterUser() && !this.useSimplifiedTabs() && this.currentStatus !== "" && this.currentStatus !== "transfer") {
            params.status = this.currentStatus;
          }
          const res = await getRiderOrders(params);
          let list = Array.isArray(res == null ? void 0 : res.data) ? res.data : [];
          if (!this.isMerchantDeliveryMode()) {
            list = list.filter((order) => order.order_type !== "supermarket");
          }
          if (this.reminderOrderId) {
            list = list.slice().sort((left, right) => {
              const leftScore = String(left.id) === this.reminderOrderId ? 1 : 0;
              const rightScore = String(right.id) === this.reminderOrderId ? 1 : 0;
              return rightScore - leftScore;
            });
          }
          this.updateStatusCounts(list);
          if (this.isMerchantDeliveryMode()) {
            this.orderList = this.filterMerchantDeliveryOrders(list);
            return;
          }
          if (this.isTownStationmasterUser()) {
            this.orderList = this.filterTownStationmasterOrders(list);
            return;
          }
          if (this.useSimplifiedTabs()) {
            this.orderList = this.filterCountyOrders(list);
            return;
          }
          this.orderList = this.currentStatus === "transfer" ? list.filter((order) => this.isTransferOrder(order)) : list;
        } catch (e) {
          formatAppLog("error", "at pages/orders/index.vue:649", "加载订单失败", e);
          this.orderList = [];
        }
      },
      updateStatusCounts(sourceList = []) {
        if (this.isMerchantDeliveryMode()) {
          const pendingCount = sourceList.filter((order) => Number(order.status) === 3).length;
          const deliveringCount = sourceList.filter((order) => Number(order.status) === 5).length;
          const completedCount = sourceList.filter((order) => Number(order.status) === 6).length;
          this.statusTabs = this.buildStatusTabs().map((tab) => ({
            ...tab,
            count: tab.key === "merchant_delivery_pending" ? pendingCount : tab.key === "merchant_delivery_delivering" ? deliveringCount : completedCount
          }));
          return;
        }
        if (this.isTownStationmasterUser()) {
          const pendingCount = sourceList.filter((order) => this.isTownPendingTabOrder(order)).length;
          const deliveringCount = sourceList.filter((order) => this.isTownDeliveringTabOrder(order)).length;
          const completedCount = sourceList.filter((order) => Number(order.status) === 6).length;
          this.statusTabs = this.buildStatusTabs().map((tab) => ({
            ...tab,
            count: tab.key === "town_pending" ? pendingCount : tab.key === "town_delivering" ? deliveringCount : completedCount
          }));
          return;
        }
        if (this.useSimplifiedTabs()) {
          const pendingCount = sourceList.filter((order) => this.isCountyPendingTabOrder(order)).length;
          const deliveringCount = sourceList.filter((order) => this.isCountyDeliveringTabOrder(order)).length;
          const completedCount = sourceList.filter((order) => Number(order.status) === 6).length;
          this.statusTabs = this.buildStatusTabs().map((tab) => ({
            ...tab,
            count: tab.key === "county_pending" ? pendingCount : tab.key === "county_delivering" ? deliveringCount : completedCount
          }));
          return;
        }
        const counter = {};
        sourceList.forEach((order) => {
          counter[order.status] = (counter[order.status] || 0) + 1;
        });
        const transferCount = sourceList.filter((order) => this.isTransferOrder(order)).length;
        this.statusTabs = this.buildStatusTabs().map((tab) => ({
          ...tab,
          count: tab.key === "" ? sourceList.length : tab.key === "transfer" ? transferCount : counter[tab.key] || 0
        }));
      },
      getEmptyTip() {
        if (this.reminderScene === "pickup_ready") {
          return "当前没有待取餐订单";
        }
        if (this.isMerchantDeliveryMode()) {
          if (this.currentStatus === "merchant_delivery_pending") {
            return "当前暂无待配送的本店订单";
          }
          if (this.currentStatus === "merchant_delivery_delivering") {
            return "当前暂无配送中的本店订单";
          }
          return "当前暂无已完成的本店订单";
        }
        if (this.isTownStationmasterUser()) {
          if (this.currentStatus === "town_pending") {
            return "当前暂无可接单的乡镇订单";
          }
          if (this.currentStatus === "town_delivering") {
            return "当前暂无配送中的乡镇订单";
          }
          return "当前暂无已完成的乡镇订单";
        }
        if (this.useSimplifiedTabs()) {
          if (this.currentStatus === "county_pending") {
            return "当前暂无待接单的县城订单";
          }
          if (this.currentStatus === "county_delivering") {
            return "当前暂无配送中的县城订单";
          }
          return "当前暂无已完成的县城订单";
        }
        return this.currentStatus === "" ? "当前没有分配到你的配送订单" : this.currentStatus === "transfer" ? "暂无转派单" : "该状态下暂无订单";
      },
      async onRefresh() {
        this.refreshing = true;
        this.page = 1;
        await this.loadOrderList();
        this.refreshing = false;
      },
      loadMore() {
        if (this.loadingMore)
          return;
        this.loadingMore = true;
        this.page++;
        this.loadingMore = false;
      },
      filterMerchantDeliveryOrders(list = []) {
        switch (this.currentStatus) {
          case "merchant_delivery_pending":
            return list.filter((order) => Number(order.status) === 3);
          case "merchant_delivery_delivering":
            return list.filter((order) => Number(order.status) === 5);
          case "6":
            return list.filter((order) => Number(order.status) === 6);
          default:
            return list;
        }
      },
      handlePickup(order) {
        uni.showModal({
          title: "确认取餐",
          content: "确认已到店取餐并开始配送？",
          confirmText: "开始配送",
          cancelText: "取消",
          success: async (res) => {
            if (!res.confirm)
              return;
            const fresh = this.orderList.find((o) => o.id === order.id) || order;
            if (!this.canPickup(fresh.status)) {
              uni.showToast({ title: "订单状态已变更，请刷新后重试", icon: "none" });
              return;
            }
            try {
              await riderPickup(fresh.id);
              uni.showToast({ title: "已开始配送", icon: "success" });
              await this.loadOrderList();
            } catch (e) {
              formatAppLog("error", "at pages/orders/index.vue:785", "取餐失败", e);
            }
          }
        });
      },
      handleAcceptOrder(order) {
        if (!this.canAcceptTownOrder(order)) {
          uni.showToast({ title: "当前订单不能接单", icon: "none" });
          return;
        }
        uni.showModal({
          title: "确认接单",
          content: "确认接此订单？若其他骑手先提交成功，则该订单会被对方抢到。",
          confirmText: "立即接单",
          cancelText: "取消",
          success: async (res) => {
            if (!res.confirm)
              return;
            this.acceptingOrderId = String(order.id);
            try {
              await acceptTakeoutOrder(order.id);
              uni.showToast({ title: "接单成功", icon: "success" });
              await this.loadOrderList();
            } catch (e) {
              formatAppLog("error", "at pages/orders/index.vue:808", "接单失败", e);
            } finally {
              this.acceptingOrderId = "";
            }
          }
        });
      },
      handleStandardDelivery(order) {
        uni.showModal({
          title: "确认送达",
          content: "确认订单已送达？",
          confirmText: "确认送达",
          cancelText: "取消",
          success: async (res) => {
            var _a, _b, _c;
            if (!res.confirm)
              return;
            const fresh = this.orderList.find((o) => o.id === order.id) || order;
            if (!canRiderCallConfirmDeliveryApi(fresh.status)) {
              uni.showToast({ title: "订单状态已变更，请刷新后重试", icon: "none" });
              return;
            }
            try {
              await confirmDelivery(fresh.id);
              uni.showToast({ title: "送达成功", icon: "success" });
              await this.loadOrderList();
            } catch (e) {
              formatAppLog("error", "at pages/orders/index.vue:834", "确认送达失败", e);
              uni.showToast({
                title: (e == null ? void 0 : e.message) || ((_a = e == null ? void 0 : e.data) == null ? void 0 : _a.message) || ((_c = (_b = e == null ? void 0 : e.response) == null ? void 0 : _b.data) == null ? void 0 : _c.message) || "确认送达失败",
                icon: "none"
              });
            }
          }
        });
      },
      handleMerchantSelfDeliveryStart(order) {
        if (!this.canStartMerchantSelfDelivery(order)) {
          uni.showToast({ title: "当前订单不能开始配送", icon: "none" });
          return;
        }
        uni.showModal({
          title: "开始配送",
          content: "确认由当前自配送员开始配送该订单？",
          confirmText: "开始配送",
          cancelText: "取消",
          success: async (res) => {
            var _a, _b, _c;
            if (!res.confirm)
              return;
            try {
              await startMerchantSelfDelivery(order.id);
              uni.showToast({ title: "已开始配送", icon: "success" });
              await this.loadOrderList();
            } catch (e) {
              formatAppLog("error", "at pages/orders/index.vue:860", "自配送开始失败", e);
              uni.showToast({
                title: (e == null ? void 0 : e.message) || ((_a = e == null ? void 0 : e.data) == null ? void 0 : _a.message) || ((_c = (_b = e == null ? void 0 : e.response) == null ? void 0 : _b.data) == null ? void 0 : _c.message) || "开始配送失败",
                icon: "none"
              });
            }
          }
        });
      },
      handleMerchantSelfDeliveryConfirm(order) {
        if (!this.canConfirmMerchantSelfDelivery(order)) {
          uni.showToast({ title: "当前订单不能确认送达", icon: "none" });
          return;
        }
        uni.showModal({
          title: "确认送达",
          content: "确认该自配送订单已送达？",
          confirmText: "确认送达",
          cancelText: "取消",
          success: async (res) => {
            var _a, _b, _c;
            if (!res.confirm)
              return;
            try {
              await confirmMerchantSelfDelivery(order.id);
              uni.showToast({ title: "送达成功", icon: "success" });
              await this.loadOrderList();
            } catch (e) {
              formatAppLog("error", "at pages/orders/index.vue:886", "自配送确认送达失败", e);
              uni.showToast({
                title: (e == null ? void 0 : e.message) || ((_a = e == null ? void 0 : e.data) == null ? void 0 : _a.message) || ((_c = (_b = e == null ? void 0 : e.response) == null ? void 0 : _b.data) == null ? void 0 : _c.message) || "确认送达失败",
                icon: "none"
              });
            }
          }
        });
      },
      handleSpecialComplete(order) {
        uni.showModal({
          title: "特殊完结",
          content: "确认按「特殊完结」处理该订单？",
          confirmText: "特殊完结",
          cancelText: "取消",
          success: async (res) => {
            if (!res.confirm)
              return;
            const fresh = this.orderList.find((o) => o.id === order.id) || order;
            if (!canRiderOfferSpecialComplete(fresh.status)) {
              uni.showToast({ title: "订单状态已变更，请刷新后重试", icon: "none" });
              return;
            }
            try {
              await confirmDeliverySpecial(fresh.id);
              uni.showToast({ title: "操作成功", icon: "success" });
              await this.loadOrderList();
            } catch (e) {
              formatAppLog("error", "at pages/orders/index.vue:913", "特殊完结失败", e);
            }
          }
        });
      },
      callMerchant(phone) {
        if (phone) {
          uni.makePhoneCall({ phoneNumber: phone });
        }
      },
      goDetail(order) {
        uni.navigateTo({
          url: `/pages/orders/detail?id=${order.id}`
        });
      }
    }
  };
  function _sfc_render$f(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "status-tabs" }, [
        $options.useSimplifiedTabs() ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "tabs-scroll town-tabs-row"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.statusTabs, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.key,
                class: vue.normalizeClass(["tab-item town-tab-item", { active: $data.currentStatus === item.key }]),
                onClick: ($event) => $options.switchStatus(item.key)
              }, vue.toDisplayString(item.label), 11, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : (vue.openBlock(), vue.createElementBlock("scroll-view", {
          key: 1,
          "scroll-x": "",
          class: "tabs-scroll county-tabs-scroll"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.statusTabs, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.key,
                class: vue.normalizeClass(["tab-item", { "county-tab-item": true, active: $data.currentStatus === item.key }]),
                onClick: ($event) => $options.switchStatus(item.key)
              }, vue.toDisplayString(item.label), 11, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]))
      ]),
      $data.reminderScene === "pickup_ready" ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "reminder-banner"
      }, [
        vue.createElementVNode("text", { class: "reminder-banner-text" }, "当前展示待取餐提醒订单"),
        vue.createElementVNode("text", {
          class: "reminder-banner-action",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.clearReminderScene && $options.clearReminderScene(...args))
        }, "恢复默认列表")
      ])) : vue.createCommentVNode("v-if", true),
      vue.createElementVNode("scroll-view", {
        "scroll-y": "",
        class: "order-scroll",
        onScrolltolower: _cache[1] || (_cache[1] = (...args) => $options.loadMore && $options.loadMore(...args)),
        "refresher-enabled": true,
        "refresher-triggered": $data.refreshing,
        onRefresherrefresh: _cache[2] || (_cache[2] = (...args) => $options.onRefresh && $options.onRefresh(...args))
      }, [
        $data.orderList.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "order-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.orderList, (order) => {
              var _a;
              return vue.openBlock(), vue.createElementBlock("view", {
                key: order.id,
                class: vue.normalizeClass(["order-card", { "highlight-card": order.status === 1 || order.status === 4, "town-order-card": $options.isTownOrder(order), "transfer-order-card": $options.isTransferOrder(order) }]),
                onClick: ($event) => $options.goDetail(order)
              }, [
                vue.createElementVNode("view", { class: "order-header" }, [
                  vue.createElementVNode("view", { class: "header-left" }, [
                    vue.createElementVNode("view", { class: "order-info-row" }, [
                      vue.createElementVNode(
                        "text",
                        { class: "order-no" },
                        vue.toDisplayString(order.order_no),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode("view", { class: "header-tags" }, [
                        $options.isTownOrder(order) ? (vue.openBlock(), vue.createElementBlock("view", {
                          key: 0,
                          class: "scope-tag"
                        }, "乡镇订单")) : vue.createCommentVNode("v-if", true),
                        $options.isTransferOrder(order) ? (vue.openBlock(), vue.createElementBlock(
                          "view",
                          {
                            key: 1,
                            class: "transfer-tag"
                          },
                          vue.toDisplayString($options.getTransferTag(order)),
                          1
                          /* TEXT */
                        )) : vue.createCommentVNode("v-if", true),
                        vue.createElementVNode(
                          "view",
                          {
                            class: "status-tag",
                            style: vue.normalizeStyle({ backgroundColor: $options.getStatusColor(order.status, order) })
                          },
                          vue.toDisplayString($options.getStatusText(order.status)),
                          5
                          /* TEXT, STYLE */
                        )
                      ])
                    ]),
                    vue.createElementVNode(
                      "text",
                      { class: "order-time" },
                      vue.toDisplayString($options.formatTime(order.created_at)),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                vue.createElementVNode("view", { class: "delivery-fee-section" }, [
                  vue.createElementVNode("text", { class: "fee-label" }, "💰 配送费"),
                  vue.createElementVNode(
                    "text",
                    { class: "fee-num" },
                    "¥" + vue.toDisplayString(order.rider_fee || 0),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "simple-info" }, [
                  vue.createElementVNode("text", { class: "info-icon" }, "🏪"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-text order-main-text" },
                    vue.toDisplayString(((_a = order.merchant) == null ? void 0 : _a.name) || "未知商家"),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("text", {
                    class: "call-btn",
                    onClick: vue.withModifiers(($event) => {
                      var _a2;
                      return $options.callMerchant((_a2 = order.merchant) == null ? void 0 : _a2.phone);
                    }, ["stop"])
                  }, "📞 打电话", 8, ["onClick"])
                ]),
                $options.getBriefAddress(order) ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 0,
                  class: "simple-info"
                }, [
                  vue.createElementVNode("text", { class: "info-icon" }, "📍"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-text address-text order-main-text" },
                    vue.toDisplayString($options.getBriefAddress(order)),
                    1
                    /* TEXT */
                  )
                ])) : vue.createCommentVNode("v-if", true),
                $options.getTownName(order) ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 1,
                  class: "simple-info"
                }, [
                  vue.createElementVNode("text", { class: "info-icon" }, "🌲"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-text order-main-text" },
                    vue.toDisplayString($options.getTownName(order)),
                    1
                    /* TEXT */
                  )
                ])) : vue.createCommentVNode("v-if", true),
                $options.isTransferOrder(order) ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 2,
                  class: "simple-info transfer-info"
                }, [
                  vue.createElementVNode("text", { class: "info-icon" }, "🔁"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-text" },
                    vue.toDisplayString($options.getTransferCardSummary(order)),
                    1
                    /* TEXT */
                  )
                ])) : vue.createCommentVNode("v-if", true),
                vue.createElementVNode("view", { class: "order-actions" }, [
                  $options.canAcceptTownOrder(order) ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 0,
                    class: "btn btn-primary",
                    disabled: $data.acceptingOrderId === String(order.id),
                    onClick: vue.withModifiers(($event) => $options.handleAcceptOrder(order), ["stop"])
                  }, vue.toDisplayString($data.acceptingOrderId === String(order.id) ? "接单中..." : "接单"), 9, ["disabled", "onClick"])) : vue.createCommentVNode("v-if", true),
                  $options.canStartMerchantSelfDelivery(order) ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 1,
                    class: "btn btn-primary",
                    onClick: vue.withModifiers(($event) => $options.handleMerchantSelfDeliveryStart(order), ["stop"])
                  }, " 开始配送 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  $options.canConfirmMerchantSelfDelivery(order) ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 2,
                    class: "btn btn-success",
                    onClick: vue.withModifiers(($event) => $options.handleMerchantSelfDeliveryConfirm(order), ["stop"])
                  }, " 确认送达 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  !$options.isMerchantDeliveryMode() && $options.canRiderCallConfirmDeliveryApi(order.status) && $options.canOperateOrder(order) ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 3,
                    class: "btn btn-success",
                    onClick: vue.withModifiers(($event) => $options.handleStandardDelivery(order), ["stop"])
                  }, " 确认送达 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  vue.createElementVNode("button", {
                    class: "btn btn-default",
                    onClick: vue.withModifiers(($event) => $options.goDetail(order), ["stop"])
                  }, " 查看详情 ", 8, ["onClick"])
                ])
              ], 10, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "empty-state"
        }, [
          vue.createElementVNode("text", { class: "empty-icon" }, "📋"),
          vue.createElementVNode("text", { class: "empty-text" }, "暂无订单"),
          vue.createElementVNode(
            "text",
            { class: "empty-tip" },
            vue.toDisplayString($options.getEmptyTip()),
            1
            /* TEXT */
          )
        ])),
        $data.loadingMore ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "load-more"
        }, [
          vue.createElementVNode("text", null, "加载中...")
        ])) : vue.createCommentVNode("v-if", true)
      ], 40, ["refresher-triggered"])
    ]);
  }
  const PagesOrdersIndex = /* @__PURE__ */ _export_sfc(_sfc_main$g, [["render", _sfc_render$f], ["__scopeId", "data-v-e1e6274e"], ["__file", "E:/固始县外卖骑手端/pages/orders/index.vue"]]);
  const _sfc_main$f = {
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
        default: ""
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
        default: ""
      },
      defaultStationmaster: {
        type: String,
        default: ""
      }
    },
    data() {
      return {
        form: {
          transferToTown: "",
          transferToTownCode: "",
          transferToUserId: "",
          transferToUser: "",
          confirmed: false
        }
      };
    },
    computed: {
      selectedTownIndex() {
        if (!this.form.transferToTownCode) {
          return 0;
        }
        const index = this.townOptions.findIndex((item) => item.value === this.form.transferToTownCode);
        return index >= 0 ? index : 0;
      },
      selectedTownLabel() {
        return this.form.transferToTown || "";
      },
      selectedStationmasterIndex() {
        if (!this.form.transferToUser) {
          return 0;
        }
        const index = this.stationmasterOptions.findIndex((item) => item.label === this.form.transferToUser || item.value === this.form.transferToUser);
        return index >= 0 ? index : 0;
      },
      selectedStationmasterLabel() {
        return this.form.transferToUser || "";
      }
    },
    watch: {
      show: {
        immediate: true,
        handler(value2) {
          if (value2) {
            this.resetForm();
          }
        }
      },
      defaultTown() {
        if (this.show) {
          this.resetForm();
        }
      },
      defaultStationmaster() {
        if (this.show) {
          this.resetForm();
        }
      }
    },
    methods: {
      noop() {
      },
      resetForm() {
        this.form.transferToTown = this.defaultTown || "";
        this.form.transferToTownCode = "";
        this.form.transferToUserId = "";
        this.form.transferToUser = this.defaultStationmaster || "";
        this.form.confirmed = false;
        if (this.form.transferToTown) {
          const matchedTown = this.townOptions.find((item) => item.label === this.form.transferToTown || item.value === this.form.transferToTown);
          if (matchedTown) {
            this.form.transferToTown = matchedTown.label;
            this.form.transferToTownCode = matchedTown.value;
          }
        }
      },
      handleTownChange(event) {
        const selectedTown = this.townOptions[Number(event.detail.value)];
        this.form.transferToTown = selectedTown ? selectedTown.label : "";
        this.form.transferToTownCode = selectedTown ? selectedTown.value : "";
        this.form.transferToUserId = "";
        this.form.transferToUser = "";
        this.$emit("town-change", {
          target_town_name: this.form.transferToTown,
          target_town_code: this.form.transferToTownCode
        });
      },
      handleStationmasterChange(event) {
        const selectedStationmaster = this.stationmasterOptions[Number(event.detail.value)];
        this.form.transferToUserId = selectedStationmaster ? selectedStationmaster.value : "";
        this.form.transferToUser = selectedStationmaster ? selectedStationmaster.label : "";
      },
      toggleConfirm() {
        this.form.confirmed = !this.form.confirmed;
      },
      submit() {
        if (!this.form.transferToTown) {
          uni.showToast({ title: "请选择目标乡镇", icon: "none" });
          return;
        }
        if (!this.form.transferToUserId) {
          uni.showToast({ title: "请选择目标站长", icon: "none" });
          return;
        }
        if (!this.form.confirmed) {
          uni.showToast({ title: "请先完成二次确认", icon: "none" });
          return;
        }
        this.$emit("confirm", {
          target_town_name: this.form.transferToTown,
          target_town_code: this.form.transferToTownCode,
          target_user_id: this.form.transferToUserId,
          target_user_name: this.form.transferToUser
        });
      }
    }
  };
  function _sfc_render$e(_ctx, _cache, $props, $setup, $data, $options) {
    return $props.show ? (vue.openBlock(), vue.createElementBlock(
      "view",
      {
        key: 0,
        class: "transfer-dialog",
        onTouchmove: _cache[7] || (_cache[7] = vue.withModifiers((...args) => $options.noop && $options.noop(...args), ["stop", "prevent"]))
      },
      [
        vue.createElementVNode("view", {
          class: "dialog-mask",
          onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("close"))
        }),
        vue.createElementVNode("view", { class: "dialog-panel" }, [
          vue.createElementVNode("view", { class: "dialog-title" }, "转派给乡镇站长"),
          vue.createElementVNode(
            "view",
            { class: "dialog-subtitle" },
            "订单号：" + vue.toDisplayString($props.orderNo || "未提供"),
            1
            /* TEXT */
          ),
          vue.createElementVNode("view", { class: "form-row" }, [
            vue.createElementVNode("text", { class: "form-label" }, "目标乡镇"),
            vue.createElementVNode("picker", {
              class: "picker-wrap",
              mode: "selector",
              range: $props.townOptions,
              "range-key": "label",
              value: $options.selectedTownIndex,
              onChange: _cache[1] || (_cache[1] = (...args) => $options.handleTownChange && $options.handleTownChange(...args))
            }, [
              vue.createElementVNode(
                "view",
                { class: "picker-value" },
                vue.toDisplayString($options.selectedTownLabel || ($props.townOptions.length ? "请选择目标乡镇" : "暂无可选乡镇")),
                1
                /* TEXT */
              )
            ], 40, ["range", "value"])
          ]),
          vue.createElementVNode("view", { class: "form-row" }, [
            vue.createElementVNode("text", { class: "form-label" }, "目标站长"),
            $props.stationmasterOptions.length ? (vue.openBlock(), vue.createElementBlock("picker", {
              key: 0,
              class: "picker-wrap",
              mode: "selector",
              range: $props.stationmasterOptions,
              "range-key": "label",
              value: $options.selectedStationmasterIndex,
              onChange: _cache[2] || (_cache[2] = (...args) => $options.handleStationmasterChange && $options.handleStationmasterChange(...args))
            }, [
              vue.createElementVNode(
                "view",
                { class: "picker-value" },
                vue.toDisplayString($options.selectedStationmasterLabel || "请选择目标站长"),
                1
                /* TEXT */
              )
            ], 40, ["range", "value"])) : vue.withDirectives((vue.openBlock(), vue.createElementBlock("input", {
              key: 1,
              class: "text-input",
              type: "text",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.transferToUser = $event),
              placeholder: $props.stationmastersLoading ? "站长列表加载中..." : "请输入目标站长姓名/标识",
              maxlength: "30"
            }, null, 8, ["placeholder"])), [
              [
                vue.vModelText,
                $data.form.transferToUser,
                void 0,
                { trim: true }
              ]
            ])
          ]),
          vue.createElementVNode("view", {
            class: "confirm-row",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.toggleConfirm && $options.toggleConfirm(...args))
          }, [
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["confirm-check", { checked: $data.form.confirmed }])
              },
              vue.toDisplayString($data.form.confirmed ? "√" : ""),
              3
              /* TEXT, CLASS */
            ),
            vue.createElementVNode("text", { class: "confirm-text" }, "我已确认转派目标乡镇与目标站长无误")
          ]),
          vue.createElementVNode("view", { class: "action-row" }, [
            vue.createElementVNode("button", {
              class: "action-btn cancel-btn",
              disabled: $props.loading,
              onClick: _cache[5] || (_cache[5] = ($event) => _ctx.$emit("close"))
            }, "取消", 8, ["disabled"]),
            vue.createElementVNode("button", {
              class: "action-btn confirm-btn",
              disabled: $props.loading,
              onClick: _cache[6] || (_cache[6] = (...args) => $options.submit && $options.submit(...args))
            }, vue.toDisplayString($props.loading ? "提交中..." : "确认转派"), 9, ["disabled"])
          ])
        ])
      ],
      32
      /* NEED_HYDRATION */
    )) : vue.createCommentVNode("v-if", true);
  }
  const TransferOrderDialog = /* @__PURE__ */ _export_sfc(_sfc_main$f, [["render", _sfc_render$e], ["__scopeId", "data-v-e78946c9"], ["__file", "E:/固始县外卖骑手端/components/transfer-order-dialog.vue"]]);
  const _sfc_main$e = {
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
        default: ""
      },
      riderOptions: {
        type: Array,
        default: () => []
      }
    },
    data() {
      return {
        form: {
          targetRiderId: "",
          remark: "站长转交本乡镇骑手配送",
          confirmed: false
        }
      };
    },
    watch: {
      show: {
        immediate: true,
        handler(value2) {
          if (value2) {
            this.resetForm();
          }
        }
      }
    },
    methods: {
      noop() {
      },
      resetForm() {
        this.form.targetRiderId = "";
        this.form.remark = "站长转交本乡镇骑手配送";
        this.form.confirmed = false;
      },
      selectRider(item = {}) {
        this.form.targetRiderId = item.value || "";
      },
      toggleConfirm() {
        this.form.confirmed = !this.form.confirmed;
      },
      submit() {
        if (!this.form.targetRiderId) {
          uni.showToast({ title: "请选择目标骑手", icon: "none" });
          return;
        }
        if (!this.form.confirmed) {
          uni.showToast({ title: "请先完成二次确认", icon: "none" });
          return;
        }
        this.$emit("confirm", {
          target_rider_id: this.form.targetRiderId,
          remark: this.form.remark || "站长转交本乡镇骑手配送"
        });
      }
    }
  };
  function _sfc_render$d(_ctx, _cache, $props, $setup, $data, $options) {
    return $props.show ? (vue.openBlock(), vue.createElementBlock(
      "view",
      {
        key: 0,
        class: "transfer-dialog",
        onTouchmove: _cache[5] || (_cache[5] = vue.withModifiers((...args) => $options.noop && $options.noop(...args), ["stop", "prevent"]))
      },
      [
        vue.createElementVNode("view", {
          class: "dialog-mask",
          onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("close"))
        }),
        vue.createElementVNode("view", { class: "dialog-panel" }, [
          vue.createElementVNode("view", { class: "dialog-title" }, "转给骑手"),
          vue.createElementVNode(
            "view",
            { class: "dialog-subtitle" },
            "订单号：" + vue.toDisplayString($props.orderNo || "未提供"),
            1
            /* TEXT */
          ),
          vue.createElementVNode("view", { class: "form-row" }, [
            vue.createElementVNode("text", { class: "form-label" }, "目标骑手"),
            $props.riderOptions.length ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "rider-list"
            }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($props.riderOptions, (item) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: item.value,
                    class: vue.normalizeClass(["rider-item", { active: $data.form.targetRiderId === item.value }]),
                    onClick: ($event) => $options.selectRider(item)
                  }, [
                    vue.createElementVNode("view", { class: "rider-main" }, [
                      vue.createElementVNode(
                        "text",
                        { class: "rider-name" },
                        vue.toDisplayString(item.label || "骑手"),
                        1
                        /* TEXT */
                      ),
                      item.phone ? (vue.openBlock(), vue.createElementBlock(
                        "text",
                        {
                          key: 0,
                          class: "rider-phone"
                        },
                        vue.toDisplayString(item.phone),
                        1
                        /* TEXT */
                      )) : vue.createCommentVNode("v-if", true)
                    ]),
                    vue.createElementVNode("view", { class: "rider-side" }, [
                      vue.createElementVNode(
                        "text",
                        {
                          class: vue.normalizeClass(["rider-status", { online: Number(item.isOnline) === 1 }])
                        },
                        vue.toDisplayString(Number(item.isOnline) === 1 ? "在线" : "离线"),
                        3
                        /* TEXT, CLASS */
                      )
                    ])
                  ], 10, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : (vue.openBlock(), vue.createElementBlock(
              "view",
              {
                key: 1,
                class: "empty-text"
              },
              vue.toDisplayString($props.loading ? "骑手列表加载中..." : "当前没有可转交的乡镇骑手"),
              1
              /* TEXT */
            ))
          ]),
          vue.createElementVNode("view", { class: "form-row" }, [
            vue.createElementVNode("text", { class: "form-label" }, "备注"),
            vue.withDirectives(vue.createElementVNode(
              "input",
              {
                class: "text-input",
                type: "text",
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.form.remark = $event),
                placeholder: "站长转交本乡镇骑手配送",
                maxlength: "50"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [
                vue.vModelText,
                $data.form.remark,
                void 0,
                { trim: true }
              ]
            ])
          ]),
          vue.createElementVNode("view", {
            class: "confirm-row",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.toggleConfirm && $options.toggleConfirm(...args))
          }, [
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["confirm-check", { checked: $data.form.confirmed }])
              },
              vue.toDisplayString($data.form.confirmed ? "√" : ""),
              3
              /* TEXT, CLASS */
            ),
            vue.createElementVNode("text", { class: "confirm-text" }, "我已确认目标骑手无误")
          ]),
          vue.createElementVNode("view", { class: "action-row" }, [
            vue.createElementVNode("button", {
              class: "action-btn cancel-btn",
              disabled: $props.loading,
              onClick: _cache[3] || (_cache[3] = ($event) => _ctx.$emit("close"))
            }, "取消", 8, ["disabled"]),
            vue.createElementVNode("button", {
              class: "action-btn confirm-btn",
              disabled: $props.loading,
              onClick: _cache[4] || (_cache[4] = (...args) => $options.submit && $options.submit(...args))
            }, vue.toDisplayString($props.loading ? "提交中..." : "确认转单"), 9, ["disabled"])
          ])
        ])
      ],
      32
      /* NEED_HYDRATION */
    )) : vue.createCommentVNode("v-if", true);
  }
  const TransferTownRiderDialog = /* @__PURE__ */ _export_sfc(_sfc_main$e, [["render", _sfc_render$d], ["__scopeId", "data-v-f964f969"], ["__file", "E:/固始县外卖骑手端/components/transfer-town-rider-dialog.vue"]]);
  const PI = Math.PI;
  const A = 6378245;
  const EE = 0.006693421622965943;
  function transformLat(x, y) {
    let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    ret += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
    ret += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
    return ret;
  }
  function transformLng(x, y) {
    let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    ret += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
    ret += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
    return ret;
  }
  function outOfChina(lng, lat) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }
  function wgs84ToGcj02(lng, lat) {
    const parsedLng = Number(lng);
    const parsedLat = Number(lat);
    if (!Number.isFinite(parsedLng) || !Number.isFinite(parsedLat)) {
      return { lng: Number.NaN, lat: Number.NaN };
    }
    if (outOfChina(parsedLng, parsedLat)) {
      return { lng: parsedLng, lat: parsedLat };
    }
    let dLat = transformLat(parsedLng - 105, parsedLat - 35);
    let dLng = transformLng(parsedLng - 105, parsedLat - 35);
    const radLat = parsedLat / 180 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = dLat * 180 / (A * (1 - EE) / (magic * sqrtMagic) * PI);
    dLng = dLng * 180 / (A / sqrtMagic * Math.cos(radLat) * PI);
    return {
      lng: parsedLng + dLng,
      lat: parsedLat + dLat
    };
  }
  function hasValidCoords(coords = {}) {
    const lng = Number(coords.lng);
    const lat = Number(coords.lat);
    return Number.isFinite(lng) && Number.isFinite(lat) && lng !== 0 && lat !== 0;
  }
  function normalizeLocationCoords(location2 = {}, coordinateType = "gcj02") {
    const lng = Number(location2.longitude);
    const lat = Number(location2.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || !lng || !lat) {
      return { lng: "", lat: "" };
    }
    if (coordinateType === "wgs84") {
      const converted = wgs84ToGcj02(lng, lat);
      if (!hasValidCoords(converted)) {
        return { lng: "", lat: "" };
      }
      return converted;
    }
    return { lng, lat };
  }
  function requestNavigationLocation(type = "gcj02", extraOptions = {}) {
    return new Promise((resolve, reject) => {
      uni.getLocation({
        type,
        isHighAccuracy: true,
        highAccuracyExpireTime: 8e3,
        ...extraOptions,
        success: resolve,
        fail: reject
      });
    }).then((location2) => normalizeLocationCoords(location2, type));
  }
  function getCachedRiderCoords() {
    var _a, _b;
    try {
      const app = typeof getApp === "function" ? getApp() : null;
      const getter = (_a = app == null ? void 0 : app.globalData) == null ? void 0 : _a.getLatestRiderLocation;
      const sample = typeof getter === "function" ? getter() : (_b = app == null ? void 0 : app.globalData) == null ? void 0 : _b.latestRiderLocation;
      const lng = Number((sample == null ? void 0 : sample.longitude) ?? (sample == null ? void 0 : sample.lng) ?? 0);
      const lat = Number((sample == null ? void 0 : sample.latitude) ?? (sample == null ? void 0 : sample.lat) ?? 0);
      if (!hasValidCoords({ lng, lat })) {
        return { lng: "", lat: "" };
      }
      return { lng, lat };
    } catch (error) {
      return { lng: "", lat: "" };
    }
  }
  async function resolveNavigationStartCoords(fallbackCoords = null) {
    if (hasValidCoords(fallbackCoords || {})) {
      return fallbackCoords;
    }
    const cached = getCachedRiderCoords();
    if (hasValidCoords(cached)) {
      return cached;
    }
    try {
      const quickLocation = await requestNavigationLocation("wgs84", {
        isHighAccuracy: false,
        highAccuracyExpireTime: 4e3
      });
      if (hasValidCoords(quickLocation)) {
        return quickLocation;
      }
    } catch (error) {
    }
    try {
      const preciseLocation = await requestNavigationLocation("wgs84", {
        isHighAccuracy: true,
        highAccuracyExpireTime: 8e3
      });
      if (hasValidCoords(preciseLocation)) {
        return preciseLocation;
      }
    } catch (error) {
    }
    try {
      const gcjLocation = await requestNavigationLocation("gcj02");
      if (hasValidCoords(gcjLocation)) {
        return gcjLocation;
      }
    } catch (error) {
    }
    return { lng: "", lat: "" };
  }
  function reportDetailDebug(hypothesisId, location2, msg, data = {}) {
    {
      return;
    }
  }
  const _sfc_main$d = {
    components: {
      TransferOrderDialog,
      TransferTownRiderDialog
    },
    computed: {
      showGaodeSearchAssistCard() {
        return !this.isTownOrder(this.order) && !!this.getGaodeSearchAssistText();
      },
      canShowTransferButton() {
        var _a;
        return this.toBoolean((_a = this.order) == null ? void 0 : _a.can_transfer);
      },
      canShowTransferRevokeButton() {
        var _a;
        return this.toBoolean((_a = this.order) == null ? void 0 : _a.can_transfer_revoke);
      },
      canShowTownRiderTransferButton() {
        var _a;
        return this.toBoolean((_a = this.order) == null ? void 0 : _a.can_transfer_to_town_rider);
      },
      canShowTownRiderTransferRevokeButton() {
        var _a;
        return this.toBoolean((_a = this.order) == null ? void 0 : _a.can_transfer_to_town_rider_revoke);
      },
      canShowTransferRevokeAction() {
        return this.canShowTransferRevokeButton || this.canShowTownRiderTransferRevokeButton;
      },
      showDeliveryActionCard() {
        return this.hasOrderOwnership && (getPrimaryDeliveryAction(this.order, {
          profile: this.getDeliveryProfile(),
          owned: this.hasOrderOwnership
        }).visible || canShowSpecialComplete(this.order, this.hasOrderOwnership));
      },
      showPrimaryDeliveryAction() {
        return this.showDeliveryActionCard;
      },
      showSpecialCompleteAssistAction() {
        return canShowSpecialComplete(this.order, this.hasOrderOwnership);
      },
      isConfirmDeliveryDisabled() {
        if (!canRiderCallConfirmDeliveryApi(this.order.status) || !this.hasOrderOwnership) {
          return true;
        }
        {
          return false;
        }
      },
      isPrimaryDeliveryActionDisabled() {
        if (!this.showPrimaryDeliveryAction) {
          return true;
        }
        const action = getPrimaryDeliveryAction(this.order, {
          profile: this.getDeliveryProfile(),
          owned: this.hasOrderOwnership
        });
        if (!action.visible) {
          return true;
        }
        if (action.key === "start_delivery") {
          return false;
        }
        if (!canRiderCallConfirmDeliveryApi(this.order.status)) {
          return true;
        }
        return this.isConfirmDeliveryDisabled;
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
        deliveryDistanceError: "",
        deliveryDistanceTimer: null,
        navigationLaunching: false
      };
    },
    onLoad(options) {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      this.orderId = options.id;
      this.loadOrderDetail();
    },
    onShow() {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      if (this.orderId) {
        this.loadOrderDetail();
      }
    },
    onHide() {
      this.stopDeliveryDistancePolling();
    },
    onUnload() {
      this.stopDeliveryDistancePolling();
    },
    methods: {
      formatTime,
      canRiderCallConfirmDeliveryApi,
      canRiderOfferSpecialComplete,
      getDeliveryProfile() {
        const user = getUserInfo$1() || {};
        return resolveDeliveryProfile(user);
      },
      isMerchantDeliveryMode() {
        return this.getDeliveryProfile().isMerchantSelfDelivery;
      },
      getConfirmDeliveryHint() {
        return getConfirmDeliveryHint(this.order, {
          profile: this.getDeliveryProfile(),
          owned: this.hasOrderOwnership,
          distanceLoading: this.deliveryDistanceLoading,
          distanceMeters: this.deliveryDistanceMeters,
          distanceError: this.deliveryDistanceError
        });
      },
      getPrimaryDeliveryActionText() {
        return getPrimaryDeliveryAction(this.order, {
          profile: this.getDeliveryProfile(),
          owned: this.hasOrderOwnership
        }).text || "确认送达";
      },
      toRadians(value2) {
        return Number(value2) * Math.PI / 180;
      },
      calculateDistanceMeters(from = {}, to = {}) {
        const fromLng = Number(from.lng);
        const fromLat = Number(from.lat);
        const toLng = Number(to.lng);
        const toLat = Number(to.lat);
        if (![fromLng, fromLat, toLng, toLat].every(Number.isFinite)) {
          return Number.NaN;
        }
        const earthRadius = 6371e3;
        const latDiff = this.toRadians(toLat - fromLat);
        const lngDiff = this.toRadians(toLng - fromLng);
        const a = Math.sin(latDiff / 2) ** 2 + Math.cos(this.toRadians(fromLat)) * Math.cos(this.toRadians(toLat)) * Math.sin(lngDiff / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadius * c;
      },
      resetDeliveryDistanceState() {
        this.deliveryDistanceMeters = null;
        this.deliveryDistanceLoading = false;
        this.deliveryDistanceError = "";
      },
      stopDeliveryDistancePolling() {
        if (this.deliveryDistanceTimer) {
          clearInterval(this.deliveryDistanceTimer);
          this.deliveryDistanceTimer = null;
        }
      },
      syncDeliveryDistancePolling() {
        this.stopDeliveryDistancePolling();
        {
          this.resetDeliveryDistanceState();
          return;
        }
      },
      async refreshConfirmDeliveryDistance({ forceLocate = false, silent = true } = {}) {
        {
          this.resetDeliveryDistanceState();
          return true;
        }
      },
      ensurePageAccess() {
        const user = getUserInfo$1() || {};
        if (isRiderAppUser(user)) {
          return true;
        }
        reportDetailDebug("H", "pages/orders/detail.vue:ensurePageAccess", "detail page access denied and will redirect to login", {
          hasToken: !!uni.getStorageSync("token"),
          hasUserInfo: !!uni.getStorageSync("userInfo"),
          userRole: (user == null ? void 0 : user.role) || "",
          orderId: this.orderId || ""
        });
        uni.showToast({ title: "请先使用骑手账号登录", icon: "none" });
        uni.reLaunch({ url: "/pages/login/index" });
        return false;
      },
      getStatusText(status) {
        return getOrderStatusText(status, {
          profile: this.getDeliveryProfile(),
          order: this.order
        });
      },
      getStatusColor(status) {
        var _a, _b;
        if (this.isTownOrder(this.order)) {
          const townStatusColors = {
            4: "#1f6f43",
            5: "#2b8a57",
            6: "#2b8a57"
          };
          return townStatusColors[Number(status)] || ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.color) || "#999";
        }
        return ((_b = ORDER_STATUS[status]) == null ? void 0 : _b.color) || "#999";
      },
      isTownOrder(order = {}) {
        return order.order_type === "town" || order.delivery_scope === "town_delivery" || !!this.getTownName(order);
      },
      getTownName(order = {}) {
        return this.getCurrentOrderTownName(order);
      },
      getGaodeSearchAssist() {
        var _a;
        return ((_a = this.order) == null ? void 0 : _a.gaode_search_assist) || {};
      },
      getGaodeSearchAssistText() {
        const assist = this.getGaodeSearchAssist();
        return assist.search_text || assist.formatted_address || assist.location_summary || assist.original_address || "";
      },
      getGaodeSearchAssistCoordText() {
        return this.getGaodeSearchAssist().coord_text || "";
      },
      toBoolean(value2) {
        return value2 === true || value2 === 1 || value2 === "1" || value2 === "true";
      },
      safeText(value2) {
        if (value2 === void 0 || value2 === null) {
          return "";
        }
        if (typeof value2 === "number" && Number.isNaN(value2)) {
          return "";
        }
        return String(value2).trim();
      },
      isTransferOrder(order = {}) {
        return this.toBoolean(order.is_transfer_order) || !!this.safeText(order.transfer_tag);
      },
      getTransferTag(order = {}) {
        return this.safeText(order.transfer_tag) || (this.isTransferOrder(order) ? "转派单" : "");
      },
      getTransferStatusText(order = {}) {
        return this.safeText(order.transfer_status);
      },
      getTransferToTownName(order = {}) {
        const directTargetTownName = this.safeText(order.target_town_name);
        if (directTargetTownName) {
          return directTargetTownName;
        }
        const targetTown = order.transfer_to_town;
        if (targetTown && typeof targetTown === "object") {
          return this.safeText(
            targetTown.area_name || targetTown.town_name || targetTown.label || targetTown.name || targetTown.value
          );
        }
        return this.safeText(targetTown);
      },
      getCurrentOrderTownName(order = {}) {
        return this.safeText(order.target_town_name) || this.getTransferToTownName(order) || this.safeText(order.customer_town) || this.safeText(order.town_name) || this.safeText(order.rider_town) || "";
      },
      getTransferToUserName(order = {}) {
        const targetUser = order.transfer_to_user;
        if (targetUser && typeof targetUser === "object") {
          return this.safeText(
            targetUser.nickname || targetUser.real_name || targetUser.name || targetUser.username
          );
        }
        return this.safeText(targetUser);
      },
      getTransferFromUserName(order = {}) {
        const sourceUser = order.transfer_from_user;
        if (sourceUser && typeof sourceUser === "object") {
          return this.safeText(
            sourceUser.nickname || sourceUser.real_name || sourceUser.name || sourceUser.username
          );
        }
        return this.safeText(sourceUser) || "县城司机";
      },
      getTransferChainSummaryText(order = {}) {
        const summary = order.transfer_chain_summary;
        if (summary && typeof summary === "object") {
          return "";
        }
        return this.safeText(summary);
      },
      isAssignedToTownRider(order = {}) {
        return this.safeText(order.transfer_status) === "assigned_to_town_rider";
      },
      getAssignedTownRiderName(order = {}) {
        if (!this.isAssignedToTownRider(order)) {
          return "";
        }
        const targetUser = order.transfer_to_user;
        if (targetUser && typeof targetUser === "object") {
          return this.safeText(targetUser.nickname || targetUser.username || targetUser.name);
        }
        return "";
      },
      getTransferBannerText(order = {}) {
        if (this.isAssignedToTownRider(order)) {
          const riderName = this.getAssignedTownRiderName(order);
          const fromUser = this.getTransferFromUserName(order);
          if (riderName) {
            return `已转给：${riderName}${fromUser ? ` · 来源：${fromUser}` : ""}`;
          }
        }
        const pieces = [`来源：${this.getTransferFromUserName(order)}`];
        const targetTown = this.getTransferToTownName(order);
        if (targetTown) {
          pieces.push(`目标乡镇：${targetTown}`);
        }
        const targetUser = this.getTransferToUserName(order);
        if (targetUser) {
          pieces.push(`目标站长：${targetUser}`);
        }
        return pieces.join(" · ");
      },
      normalizeIdentityValue(value2) {
        if (value2 === void 0 || value2 === null || value2 === "") {
          return "";
        }
        return String(value2);
      },
      canPickup(status) {
        return Number(status) === 4;
      },
      canAccessNavigation(status) {
        return this.canAccessPickupNavigation(status) || this.canAccessDeliveryNavigation(status);
      },
      canAccessPickupNavigation(status) {
        if (this.isTownOrder(this.order)) {
          return Number(status) >= 2 && Number(status) <= 5;
        }
        return [4, 5].includes(Number(status));
      },
      canAccessDeliveryNavigation(status) {
        if (this.isTownOrder(this.order)) {
          return Number(status) >= 2 && Number(status) <= 5;
        }
        return Number(status) === 5;
      },
      getFullAddress(order) {
        try {
          const addr = typeof order.delivery_address === "string" ? JSON.parse(order.delivery_address) : order.delivery_address;
          const fullAddress = [
            this.safeText(addr == null ? void 0 : addr.province),
            this.safeText(addr == null ? void 0 : addr.city),
            this.safeText(addr == null ? void 0 : addr.district),
            this.safeText(addr == null ? void 0 : addr.street),
            this.safeText(addr == null ? void 0 : addr.detail)
          ].filter(Boolean).join("");
          return fullAddress || this.safeText(order.address) || "未知地址";
        } catch (e) {
          return this.safeText(order.address) || "未知地址";
        }
      },
      async loadOrderDetail() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!this.hasPageAccess || !this.orderId) {
          return;
        }
        try {
          const res = await getOrderDetail(this.orderId);
          this.order = res.data || {};
          this.syncOrderOwnershipState(this.order, false);
          await this.refreshConfirmDeliveryDistance({
            forceLocate: true,
            silent: true
          });
          this.syncDeliveryDistancePolling();
          formatAppLog("log", "at pages/orders/detail.vue:711", "[order-detail] loadOrderDetail success", {
            orderId: ((_a = this.order) == null ? void 0 : _a.id) ?? "",
            orderNo: ((_b = this.order) == null ? void 0 : _b.order_no) ?? "",
            status: ((_c = this.order) == null ? void 0 : _c.status) ?? "",
            hasOrderOwnership: this.hasOrderOwnership
          });
          formatAppLog("log", "at pages/orders/detail.vue:717", "[order-detail] debug transfer fields", {
            order_type: (_d = this.order) == null ? void 0 : _d.order_type,
            status: (_e = this.order) == null ? void 0 : _e.status,
            rider_id: (_f = this.order) == null ? void 0 : _f.rider_id,
            current_responsible_user_id: (_g = this.order) == null ? void 0 : _g.current_responsible_user_id,
            can_transfer: (_h = this.order) == null ? void 0 : _h.can_transfer
          });
        } catch (e) {
          formatAppLog("error", "at pages/orders/detail.vue:725", "加载订单详情失败", e);
        }
      },
      async loadTownOptions() {
        try {
          const res = await getTownServiceAreas();
          this.townOptions = Array.isArray(res == null ? void 0 : res.data) ? res.data.map((item) => ({
            value: item.area_code,
            label: item.area_name
          })) : [];
        } catch (error) {
          this.townOptions = [];
          formatAppLog("error", "at pages/orders/detail.vue:739", "加载转派乡镇列表失败", error);
        }
      },
      normalizeStationmasterOptions(source) {
        const list = Array.isArray(source) ? source : Array.isArray(source == null ? void 0 : source.list) ? source.list : Array.isArray(source == null ? void 0 : source.rows) ? source.rows : Array.isArray(source == null ? void 0 : source.data) ? source.data : [];
        return list.map((item) => {
          const value2 = this.safeText((item == null ? void 0 : item.id) || (item == null ? void 0 : item.user_id) || (item == null ? void 0 : item.userId) || (item == null ? void 0 : item.stationmaster_id) || (item == null ? void 0 : item.value));
          const label = this.safeText(
            (item == null ? void 0 : item.nickname) || (item == null ? void 0 : item.real_name) || (item == null ? void 0 : item.name) || (item == null ? void 0 : item.username) || (item == null ? void 0 : item.stationmaster_name) || (item == null ? void 0 : item.label)
          );
          return {
            value: value2 || label,
            label: label || value2
          };
        }).filter((item) => item.value || item.label);
      },
      async loadTransferStationmasters(townName = "") {
        const resolvedTownName = this.safeText(townName) || this.getCurrentOrderTownName(this.order);
        this.stationmastersLoading = true;
        try {
          const res = await getTransferStationmasters({
            town_name: resolvedTownName
          });
          this.stationmasterOptions = this.normalizeStationmasterOptions(res == null ? void 0 : res.data);
        } catch (error) {
          this.stationmasterOptions = [];
          formatAppLog("error", "at pages/orders/detail.vue:778", "加载转派站长列表失败", error);
        } finally {
          this.stationmastersLoading = false;
        }
      },
      normalizeTownRiderOptions(source) {
        const list = Array.isArray(source) ? source : Array.isArray(source == null ? void 0 : source.list) ? source.list : Array.isArray(source == null ? void 0 : source.rows) ? source.rows : Array.isArray(source == null ? void 0 : source.data) ? source.data : [];
        return list.map((item) => ({
          value: this.safeText((item == null ? void 0 : item.id) || (item == null ? void 0 : item.user_id) || (item == null ? void 0 : item.userId)),
          label: this.safeText((item == null ? void 0 : item.nickname) || (item == null ? void 0 : item.username) || (item == null ? void 0 : item.name)) || "骑手",
          phone: this.safeText(item == null ? void 0 : item.phone),
          isOnline: Number((item == null ? void 0 : item.is_online) || 0),
          canReceiveTransfer: this.toBoolean((item == null ? void 0 : item.can_receive_transfer) ?? 1)
        })).filter((item) => item.value);
      },
      getTransferOrderIdentifier() {
        var _a;
        return this.safeText((_a = this.order) == null ? void 0 : _a.order_no) || this.safeText(this.orderId);
      },
      async loadTownRiderOptions() {
        this.townRiderListLoading = true;
        try {
          const res = await getTransferTownRiders({
            order_id: this.getTransferOrderIdentifier()
          });
          this.townRiderOptions = this.normalizeTownRiderOptions(res == null ? void 0 : res.data);
        } catch (error) {
          this.townRiderOptions = [];
          formatAppLog("error", "at pages/orders/detail.vue:813", "加载乡镇骑手列表失败", error);
          uni.showToast({ title: this.getErrorMessage(error) || "加载骑手列表失败", icon: "none" });
        } finally {
          this.townRiderListLoading = false;
        }
      },
      async openTownRiderTransferDialog() {
        if (!this.canShowTownRiderTransferButton) {
          return;
        }
        await this.loadTownRiderOptions();
        this.showTownRiderTransferDialog = true;
      },
      closeTownRiderTransferDialog() {
        if (this.townRiderTransferSubmitting) {
          return;
        }
        this.showTownRiderTransferDialog = false;
      },
      async openTransferDialog() {
        if (!this.canShowTransferButton) {
          return;
        }
        if (!this.townOptions.length) {
          await this.loadTownOptions();
        }
        await this.loadTransferStationmasters(this.getCurrentOrderTownName(this.order));
        this.showTransferDialog = true;
      },
      closeTransferDialog() {
        if (this.transferSubmitting) {
          return;
        }
        this.showTransferDialog = false;
      },
      async handleTransferTownChange(payload = {}) {
        await this.loadTransferStationmasters(payload.target_town_name || "");
      },
      handleTransferSubmit(payload = {}) {
        uni.showModal({
          title: "确认转派",
          content: `确认转派到${payload.target_town_name || "目标乡镇"}，目标站长：${payload.target_user_name || "未选择"}？`,
          confirmText: "确认转派",
          cancelText: "取消",
          success: async (res) => {
            if (!res.confirm) {
              return;
            }
            this.transferSubmitting = true;
            try {
              await submitOrderTransfer({
                order_id: this.orderId,
                target_town_name: payload.target_town_name || "",
                target_user_id: payload.target_user_id || ""
              });
              uni.showToast({ title: "转派成功", icon: "success" });
              await this.loadOrderDetail();
              this.refreshOrderListPage();
            } finally {
              this.transferSubmitting = false;
              this.showTransferDialog = false;
            }
          }
        });
      },
      handleTownRiderTransferSubmit(payload = {}) {
        uni.showModal({
          title: "确认转单",
          content: "确认将当前订单转给所选骑手配送？",
          confirmText: "确认转单",
          cancelText: "取消",
          success: async (res) => {
            if (!res.confirm) {
              return;
            }
            this.townRiderTransferSubmitting = true;
            try {
              await submitOrderTransferToTownRider({
                order_id: this.getTransferOrderIdentifier(),
                target_rider_id: payload.target_rider_id || "",
                remark: payload.remark || "站长转交本乡镇骑手配送"
              });
              uni.showToast({ title: "转单成功", icon: "success" });
              await this.loadOrderDetail();
              this.refreshOrderListPage();
            } catch (error) {
              formatAppLog("error", "at pages/orders/detail.vue:899", "转给骑手失败", error);
              uni.showToast({ title: this.getErrorMessage(error) || "转单失败", icon: "none" });
            } finally {
              this.townRiderTransferSubmitting = false;
              this.showTownRiderTransferDialog = false;
            }
          }
        });
      },
      handleTransferRevoke() {
        uni.showModal({
          title: "撤回一次",
          content: "确认撤回本次转派？",
          confirmText: "确认撤回",
          cancelText: "取消",
          success: async (res) => {
            if (!res.confirm) {
              return;
            }
            await revokeOrderTransfer(this.getTransferOrderIdentifier());
            uni.showToast({ title: "已撤回转派", icon: "success" });
            await this.loadOrderDetail();
            this.refreshOrderListPage();
          }
        });
      },
      refreshOrderListPage() {
        const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
        const listPage = pages.find((page) => {
          var _a, _b;
          const route = (page == null ? void 0 : page.route) || ((_a = page == null ? void 0 : page.$page) == null ? void 0 : _a.fullPath) || ((_b = page == null ? void 0 : page.$page) == null ? void 0 : _b.route) || "";
          return String(route).includes("pages/orders/index");
        });
        const vm = (listPage == null ? void 0 : listPage.$vm) || listPage;
        if (vm && typeof vm.loadOrderList === "function") {
          vm.loadOrderList();
        }
      },
      getCurrentRiderId() {
        const userInfo = getUserInfo$1() || {};
        return this.normalizeIdentityValue(this.getCoordinateByKeys(userInfo, ["id", "user_id", "userId"]));
      },
      getOrderOwnerId(order = this.order) {
        return this.normalizeIdentityValue(this.getCoordinateByKeys(order || {}, ["rider_id", "riderId"]));
      },
      syncOrderOwnershipState(order = this.order, notify = false) {
        const currentRiderId = this.getCurrentRiderId();
        const orderOwnerId = this.getOrderOwnerId(order);
        const responsibleId = this.normalizeIdentityValue(this.getCoordinateByKeys(order || {}, ["current_responsible_user_id", "currentResponsibleUserId"]));
        const isMerchantDeliveryPending = this.isMerchantDeliveryMode() && Number(order == null ? void 0 : order.status) === 3 && !orderOwnerId && !responsibleId;
        const checkable = isMerchantDeliveryPending || !!currentRiderId && !!orderOwnerId;
        const owned = isMerchantDeliveryPending || hasOrderOwnership(order, getUserInfo$1() || {});
        this.orderOwnershipCheckable = checkable;
        this.hasOrderOwnership = owned;
        if (!notify) {
          return owned;
        }
        if (!checkable) {
          uni.showToast({ title: "当前订单暂不可执行配送操作", icon: "none" });
          return false;
        }
        if (!owned) {
          uni.showToast({ title: "当前订单暂不可执行配送操作", icon: "none" });
          return false;
        }
        return true;
      },
      ensureOrderOwnership(actionName = "当前操作") {
        if (this.syncOrderOwnershipState(this.order, false)) {
          return true;
        }
        if (!this.orderOwnershipCheckable) {
          uni.showToast({ title: "当前订单暂不可执行配送操作", icon: "none" });
          return false;
        }
        uni.showToast({ title: "当前订单暂不可执行配送操作", icon: "none" });
        return false;
      },
      handleStandardDelivery() {
        if (!this.ensureOrderOwnership("确认送达")) {
          return;
        }
        this.refreshConfirmDeliveryDistance({
          forceLocate: true,
          silent: false
        }).then((canConfirm) => {
          if (!canConfirm) {
            return;
          }
          uni.showModal({
            title: "确认送达",
            content: "确认订单已送达？",
            confirmText: "确认送达",
            cancelText: "取消",
            success: async (res) => {
              if (!res.confirm)
                return;
              if (!this.ensureOrderOwnership("确认送达")) {
                return;
              }
              if (!canRiderCallConfirmDeliveryApi(this.order.status)) {
                uni.showToast({ title: "订单状态已变更，请刷新后重试", icon: "none" });
                return;
              }
              const stillValid = await this.refreshConfirmDeliveryDistance({
                forceLocate: true,
                silent: false
              });
              if (!stillValid) {
                return;
              }
              try {
                await confirmDelivery(this.orderId);
                uni.showToast({ title: "送达成功", icon: "success" });
                await this.loadOrderDetail();
              } catch (e) {
                formatAppLog("error", "at pages/orders/detail.vue:1017", "确认送达失败", e);
              }
            }
          });
        });
      },
      handlePrimaryDeliveryAction() {
        const primaryAction = getPrimaryDeliveryAction(this.order, {
          profile: this.getDeliveryProfile(),
          owned: this.hasOrderOwnership
        });
        if (primaryAction.key === "start_delivery") {
          if (!this.ensureOrderOwnership("自配送操作")) {
            return;
          }
          uni.showModal({
            title: "开始配送",
            content: "确认由当前自配送员开始配送该订单？",
            confirmText: "开始配送",
            cancelText: "取消",
            success: async (res) => {
              if (!res.confirm)
                return;
              try {
                await startMerchantSelfDelivery(this.orderId);
                uni.showToast({ title: "已开始配送", icon: "success" });
                await this.loadOrderDetail();
              } catch (e) {
                formatAppLog("error", "at pages/orders/detail.vue:1044", "自配送开始失败", e);
                uni.showToast({ title: this.getErrorMessage(e) || "开始配送失败", icon: "none" });
              }
            }
          });
          return;
        }
        if (this.isMerchantDeliveryMode()) {
          if (!this.ensureOrderOwnership("自配送操作")) {
            return;
          }
          if (primaryAction.key === "complete_delivery") {
            uni.showModal({
              title: "确认送达",
              content: "确认该自配送订单已送达？",
              confirmText: "确认送达",
              cancelText: "取消",
              success: async (res) => {
                if (!res.confirm)
                  return;
                try {
                  await confirmMerchantSelfDelivery(this.orderId);
                  uni.showToast({ title: "送达成功", icon: "success" });
                  await this.loadOrderDetail();
                } catch (e) {
                  formatAppLog("error", "at pages/orders/detail.vue:1068", "自配送确认送达失败", e);
                  uni.showToast({ title: this.getErrorMessage(e) || "确认送达失败", icon: "none" });
                }
              }
            });
            return;
          }
        }
        if (!canRiderCallConfirmDeliveryApi(this.order.status)) {
          uni.showToast({ title: "订单未进入配送中，暂不可确认送达", icon: "none" });
          return;
        }
        this.handleStandardDelivery();
      },
      handleSpecialComplete() {
        if (!this.ensureOrderOwnership("特殊完结")) {
          return;
        }
        uni.showModal({
          title: "特殊完结",
          content: "确认按「特殊完结」处理该订单？",
          confirmText: "特殊完结",
          cancelText: "取消",
          success: async (res) => {
            if (!res.confirm)
              return;
            if (!this.ensureOrderOwnership("特殊完结")) {
              return;
            }
            if (!canRiderOfferSpecialComplete(this.order.status)) {
              uni.showToast({ title: "订单状态已变更，请刷新后重试", icon: "none" });
              return;
            }
            try {
              await confirmDeliverySpecial(this.orderId);
              uni.showToast({ title: "操作成功", icon: "success" });
              await this.loadOrderDetail();
            } catch (e) {
              formatAppLog("error", "at pages/orders/detail.vue:1105", "特殊完结失败", e);
            }
          }
        });
      },
      getRiderId() {
        return this.getCurrentRiderId();
      },
      parseAddress() {
        try {
          return typeof this.order.delivery_address === "string" ? JSON.parse(this.order.delivery_address) : this.order.delivery_address || {};
        } catch (e) {
          return {};
        }
      },
      getCoordinateByKeys(source, keys) {
        for (let i = 0; i < keys.length; i++) {
          const value2 = source[keys[i]];
          if (value2 !== void 0 && value2 !== null && value2 !== "") {
            return value2;
          }
        }
        return "";
      },
      getMerchantCoords() {
        const address = this.parseAddress();
        const merchant = this.order.merchant || {};
        const lng = this.getCoordinateByKeys(merchant, ["lng", "lat_lng", "longitude", "lon", "map_lng", "merchant_lng", "merchantLng"]) || this.getCoordinateByKeys(this.order || {}, ["merchant_lng", "merchantLng", "shop_lng", "shopLng", "store_lng", "storeLng", "pickup_lng", "pickupLng", "from_lng", "fromLng"]) || this.getCoordinateByKeys(address, ["merchant_lng", "shop_lng", "store_lng", "pickup_lng", "from_lng"]);
        const lat = this.getCoordinateByKeys(merchant, ["lat", "latitude", "map_lat", "merchant_lat", "merchantLat"]) || this.getCoordinateByKeys(this.order || {}, ["merchant_lat", "merchantLat", "shop_lat", "shopLat", "store_lat", "storeLat", "pickup_lat", "pickupLat", "from_lat", "fromLat"]) || this.getCoordinateByKeys(address, ["merchant_lat", "shop_lat", "store_lat", "pickup_lat", "from_lat"]);
        return { lng, lat };
      },
      getPickupMerchantCoords() {
        const address = this.parseAddress();
        const orderSnapshot = this.order || {};
        const merchant = orderSnapshot.merchant || {};
        const lng = this.getCoordinateByKeys(orderSnapshot, ["merchant_lng", "merchantLng", "shop_lng", "shopLng", "store_lng", "storeLng", "pickup_lng", "pickupLng", "from_lng", "fromLng"]) || this.getCoordinateByKeys(merchant, ["merchant_lng", "merchantLng", "lng", "lat_lng", "longitude", "lon", "map_lng"]) || this.getCoordinateByKeys(address, ["merchant_lng", "shop_lng", "store_lng", "pickup_lng", "from_lng"]);
        const lat = this.getCoordinateByKeys(orderSnapshot, ["merchant_lat", "merchantLat", "shop_lat", "shopLat", "store_lat", "storeLat", "pickup_lat", "pickupLat", "from_lat", "fromLat"]) || this.getCoordinateByKeys(merchant, ["merchant_lat", "merchantLat", "lat", "latitude", "map_lat"]) || this.getCoordinateByKeys(address, ["merchant_lat", "shop_lat", "store_lat", "pickup_lat", "from_lat"]);
        return { lng, lat };
      },
      getCachedRiderCoords() {
        var _a, _b;
        try {
          const cached = getCachedRiderCoords();
          if (hasValidCoords(cached)) {
            return cached;
          }
          const app = typeof getApp === "function" ? getApp() : null;
          const sample = (_a = app == null ? void 0 : app.globalData) == null ? void 0 : _a.latestRiderLocation;
          const lng = this.getCoordinateByKeys(sample || {}, ["longitude", "lng"]);
          const lat = this.getCoordinateByKeys(sample || {}, ["latitude", "lat"]);
          if (this.hasValidCoords({ lng, lat })) {
            return { lng, lat };
          }
          const orderRider = ((_b = this.order) == null ? void 0 : _b.rider) || {};
          const orderRiderLng = this.getCoordinateByKeys(orderRider, ["rider_longitude", "longitude", "lng"]);
          const orderRiderLat = this.getCoordinateByKeys(orderRider, ["rider_latitude", "latitude", "lat"]);
          if (this.hasValidCoords({ lng: orderRiderLng, lat: orderRiderLat })) {
            return { lng: orderRiderLng, lat: orderRiderLat };
          }
          const storedUser = getUserInfo$1() || {};
          const storedLng = this.getCoordinateByKeys(storedUser, ["rider_longitude", "longitude", "lng"]);
          const storedLat = this.getCoordinateByKeys(storedUser, ["rider_latitude", "latitude", "lat"]);
          return { lng: storedLng, lat: storedLat };
        } catch (error) {
          return { lng: "", lat: "" };
        }
      },
      hasValidCoords(coords = {}) {
        return hasValidCoords(coords);
      },
      async requestNavigationLocation(type = "gcj02", extraOptions = {}) {
        return requestNavigationLocation(type, extraOptions);
      },
      async resolveNavigationStartCoords() {
        return resolveNavigationStartCoords(this.getCachedRiderCoords());
      },
      getCustomerCoords() {
        const address = this.parseAddress();
        const fallback = this.order || {};
        const lng = this.getCoordinateByKeys(fallback, ["customer_lng", "delivery_longitude", "longitude", "delivery_lng", "deliveryLng", "user_lng", "userLng", "contact_lng", "receiver_lng", "to_lng", "dest_lng", "customerLng"]) || this.getCoordinateByKeys(address, ["customer_lng", "delivery_longitude", "longitude", "lng", "delivery_lng", "deliveryLng", "user_lng", "receiver_lng", "to_lng", "dest_lng", "customerLng"]);
        const lat = this.getCoordinateByKeys(fallback, ["customer_lat", "delivery_latitude", "latitude", "delivery_lat", "deliveryLat", "user_lat", "userLat", "contact_lat", "receiver_lat", "to_lat", "dest_lat", "customerLat"]) || this.getCoordinateByKeys(address, ["customer_lat", "delivery_latitude", "latitude", "lat", "delivery_lat", "deliveryLat", "user_lat", "receiver_lat", "to_lat", "dest_lat", "customerLat"]);
        return { lng, lat };
      },
      async navigateToMap(payload) {
        if (this.navigationLaunching) {
          return;
        }
        if (!this.ensureOrderOwnership("导航")) {
          return;
        }
        if (!this.canAccessNavigation(this.order.status)) {
          uni.showToast({ title: "当前订单状态不可导航", icon: "none" });
          return;
        }
        const riderId = this.getRiderId();
        if (!riderId) {
          uni.showToast({ title: "当前骑手信息缺失，无法导航", icon: "none" });
          return;
        }
        const token = uni.getStorageSync("token") || "";
        const stage = payload && payload.stage === "delivery" ? "delivery" : "pickup";
        const targetCoords = stage === "delivery" ? { lng: payload == null ? void 0 : payload.customerLng, lat: payload == null ? void 0 : payload.customerLat } : { lng: payload == null ? void 0 : payload.merchantLng, lat: payload == null ? void 0 : payload.merchantLat };
        const missingTargets = [];
        if (!this.hasValidCoords(targetCoords)) {
          missingTargets.push(stage === "delivery" ? "用户" : "商家");
        }
        if (missingTargets.length) {
          formatAppLog("warn", "at pages/orders/detail.vue:1225", "[order-detail] navigation coords missing", {
            stage,
            missingTargets,
            merchantLng: (payload == null ? void 0 : payload.merchantLng) || "",
            merchantLat: (payload == null ? void 0 : payload.merchantLat) || "",
            customerLng: (payload == null ? void 0 : payload.customerLng) || "",
            customerLat: (payload == null ? void 0 : payload.customerLat) || ""
          });
          uni.showToast({
            title: `${missingTargets.join("、")}坐标缺失`,
            icon: "none"
          });
          return;
        }
        this.navigationLaunching = true;
        uni.showLoading({
          title: "正在获取定位",
          mask: true
        });
        const rider = await this.resolveNavigationStartCoords();
        if (!this.hasValidCoords(rider)) {
          this.navigationLaunching = false;
          uni.hideLoading();
          uni.showToast({
            title: "定位超时，请打开定位后重试",
            icon: "none"
          });
          return;
        }
        const safeRiderLng = rider.lng !== void 0 && rider.lng !== null && rider.lng !== "" ? String(rider.lng) : "";
        const safeRiderLat = rider.lat !== void 0 && rider.lat !== null && rider.lat !== "" ? String(rider.lat) : "";
        const safeMerchantLng = payload && payload.merchantLng !== void 0 && payload.merchantLng !== null && payload.merchantLng !== "" ? String(payload.merchantLng) : "";
        const safeMerchantLat = payload && payload.merchantLat !== void 0 && payload.merchantLat !== null && payload.merchantLat !== "" ? String(payload.merchantLat) : "";
        const safeCustomerLng = payload && payload.customerLng !== void 0 && payload.customerLng !== null && payload.customerLng !== "" ? String(payload.customerLng) : "";
        const safeCustomerLat = payload && payload.customerLat !== void 0 && payload.customerLat !== null && payload.customerLat !== "" ? String(payload.customerLat) : "";
        uni.showLoading({
          title: "正在进入导航",
          mask: true
        });
        uni.navigateTo({
          url: `/pages/map/nav?riderId=${encodeURIComponent(riderId)}&token=${encodeURIComponent(token)}&stage=${encodeURIComponent(stage)}&riderLng=${encodeURIComponent(safeRiderLng)}&riderLat=${encodeURIComponent(safeRiderLat)}&merchantLng=${encodeURIComponent(safeMerchantLng)}&merchantLat=${encodeURIComponent(safeMerchantLat)}&customerLng=${encodeURIComponent(safeCustomerLng)}&customerLat=${encodeURIComponent(safeCustomerLat)}`,
          complete: () => {
            this.navigationLaunching = false;
            uni.hideLoading();
          }
        });
      },
      goPickup() {
        const merchant = this.getPickupMerchantCoords();
        const customer = this.getCustomerCoords();
        this.navigateToMap({
          stage: "pickup",
          merchantLng: merchant.lng,
          merchantLat: merchant.lat,
          customerLng: customer.lng,
          customerLat: customer.lat
        });
      },
      goDelivery() {
        const merchant = this.getMerchantCoords();
        const customer = this.getCustomerCoords();
        this.navigateToMap({
          stage: "delivery",
          merchantLng: merchant.lng,
          merchantLat: merchant.lat,
          customerLng: customer.lng,
          customerLat: customer.lat
        });
      },
      callUser(phone) {
        if (phone) {
          uni.makePhoneCall({ phoneNumber: phone });
        }
      },
      formatCoordinate(coords = {}) {
        if (coords.lng === "" || coords.lat === "") {
          return "未提供坐标";
        }
        return `${coords.lng}, ${coords.lat}`;
      },
      getErrorStatusCode(error) {
        var _a, _b, _c;
        return (error == null ? void 0 : error.statusCode) ?? (error == null ? void 0 : error.status) ?? ((_a = error == null ? void 0 : error.response) == null ? void 0 : _a.status) ?? ((_b = error == null ? void 0 : error.data) == null ? void 0 : _b.statusCode) ?? ((_c = error == null ? void 0 : error.data) == null ? void 0 : _c.status) ?? "";
      },
      getErrorMessage(error) {
        var _a, _b, _c, _d, _e, _f;
        return (error == null ? void 0 : error.message) ?? (error == null ? void 0 : error.msg) ?? ((_a = error == null ? void 0 : error.data) == null ? void 0 : _a.message) ?? ((_b = error == null ? void 0 : error.data) == null ? void 0 : _b.msg) ?? ((_d = (_c = error == null ? void 0 : error.response) == null ? void 0 : _c.data) == null ? void 0 : _d.message) ?? ((_f = (_e = error == null ? void 0 : error.response) == null ? void 0 : _e.data) == null ? void 0 : _f.msg) ?? "";
      },
      copyGaodeSearchAssist() {
        const searchText = this.getGaodeSearchAssistText();
        if (!searchText) {
          uni.showToast({ title: "复制失败，请重试", icon: "none" });
          return;
        }
        const coordText = this.getGaodeSearchAssistCoordText();
        const copyText = coordText ? `${searchText}
${coordText}` : searchText;
        uni.setClipboardData({
          data: copyText,
          success: () => {
            uni.showToast({ title: "已复制到剪贴板", icon: "success" });
          },
          fail: () => {
            uni.showToast({ title: "复制失败，请重试", icon: "none" });
          }
        });
      },
      async handlePickup() {
        var _a, _b;
        if (!this.ensureOrderOwnership("取餐")) {
          return;
        }
        formatAppLog("log", "at pages/orders/detail.vue:1344", "[order-detail] handlePickup before confirm", {
          requestOrderId: this.orderId,
          orderStatus: ((_a = this.order) == null ? void 0 : _a.status) ?? "",
          canPickup: this.canPickup((_b = this.order) == null ? void 0 : _b.status)
        });
        if (!this.canPickup(this.order.status)) {
          uni.showToast({ title: "当前订单不可取餐", icon: "none" });
          return;
        }
        uni.showModal({
          title: "确认取餐",
          content: "确认已取餐并开始配送？",
          confirmText: "开始配送",
          cancelText: "取消",
          success: async (res) => {
            var _a2;
            if (!res.confirm)
              return;
            if (!this.ensureOrderOwnership("取餐")) {
              return;
            }
            try {
              await riderPickup(this.orderId);
              uni.showToast({ title: "已开始配送", icon: "success" });
              await this.loadOrderDetail();
            } catch (e) {
              formatAppLog("error", "at pages/orders/detail.vue:1368", "[order-detail] riderPickup failed", {
                httpStatus: this.getErrorStatusCode(e),
                message: this.getErrorMessage(e),
                data: (e == null ? void 0 : e.data) ?? ((_a2 = e == null ? void 0 : e.response) == null ? void 0 : _a2.data) ?? null
              });
              formatAppLog("error", "at pages/orders/detail.vue:1373", "取餐失败", e);
            }
          }
        });
      }
    }
  };
  function _sfc_render$c(_ctx, _cache, $props, $setup, $data, $options) {
    var _a;
    const _component_transfer_order_dialog = vue.resolveComponent("transfer-order-dialog");
    const _component_transfer_town_rider_dialog = vue.resolveComponent("transfer-town-rider-dialog");
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("text", { class: "section-title" }, "订单信息"),
        $options.isTransferOrder($data.order) ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "transfer-banner"
        }, [
          vue.createElementVNode(
            "text",
            { class: "transfer-banner-tag" },
            vue.toDisplayString($options.getTransferTag($data.order)),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "transfer-banner-text" },
            vue.toDisplayString($options.getTransferBannerText($data.order)),
            1
            /* TEXT */
          )
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "订单号"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($data.order.order_no),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "订单状态"),
          vue.createElementVNode(
            "text",
            {
              class: "value status",
              style: vue.normalizeStyle({ color: $options.getStatusColor($data.order.status) })
            },
            vue.toDisplayString($options.getStatusText($data.order.status)),
            5
            /* TEXT, STYLE */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "下单时间"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($options.formatTime($data.order.created_at)),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("text", { class: "section-title" }, "配送信息"),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "商家名称"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString(((_a = $data.order.merchant) == null ? void 0 : _a.name) || "未知商家"),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "配送地址"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($options.getFullAddress($data.order)),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "联系人"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($data.order.contact_name),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "联系电话"),
          vue.createElementVNode(
            "text",
            {
              class: "value",
              onClick: _cache[0] || (_cache[0] = ($event) => $options.callUser($data.order.contact_phone))
            },
            vue.toDisplayString($data.order.contact_phone),
            1
            /* TEXT */
          )
        ])
      ]),
      $options.showDeliveryActionCard ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "delivery-distance-card"
      }, [
        vue.createElementVNode(
          "text",
          { class: "delivery-distance-text" },
          vue.toDisplayString($options.getConfirmDeliveryHint()),
          1
          /* TEXT */
        )
      ])) : vue.createCommentVNode("v-if", true),
      $data.hasOrderOwnership && ($options.canPickup($data.order.status) || $options.canAccessPickupNavigation($data.order.status) || $options.canAccessDeliveryNavigation($data.order.status)) ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "detail-inline-actions"
      }, [
        $options.canAccessPickupNavigation($data.order.status) ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 0,
          class: "btn btn-primary",
          onClick: _cache[1] || (_cache[1] = (...args) => $options.goPickup && $options.goPickup(...args))
        }, " 去取餐 ")) : vue.createCommentVNode("v-if", true),
        $options.canAccessDeliveryNavigation($data.order.status) ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 1,
          class: "btn btn-primary",
          onClick: _cache[2] || (_cache[2] = (...args) => $options.goDelivery && $options.goDelivery(...args))
        }, " 去送货 ")) : vue.createCommentVNode("v-if", true),
        $options.canPickup($data.order.status) ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 2,
          class: "btn btn-primary",
          onClick: _cache[3] || (_cache[3] = (...args) => $options.handlePickup && $options.handlePickup(...args))
        }, " 确认取餐 ")) : vue.createCommentVNode("v-if", true)
      ])) : vue.createCommentVNode("v-if", true),
      $options.isTransferOrder($data.order) ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "card"
      }, [
        vue.createElementVNode("text", { class: "section-title" }, "转派信息"),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "转派单"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($options.toBoolean($data.order.is_transfer_order) ? "是" : "否"),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "转派状态"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($options.getTransferStatusText($data.order) || "未提供"),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "目标乡镇"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($options.getTransferToTownName($data.order) || "未提供"),
            1
            /* TEXT */
          )
        ]),
        $options.getAssignedTownRiderName($data.order) ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "info-row"
        }, [
          vue.createElementVNode("text", { class: "label" }, "当前配送人"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($options.getAssignedTownRiderName($data.order)),
            1
            /* TEXT */
          )
        ])) : vue.createCommentVNode("v-if", true),
        $options.getTransferFromUserName($data.order) ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "info-row"
        }, [
          vue.createElementVNode("text", { class: "label" }, "转派来源"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($options.getTransferFromUserName($data.order)),
            1
            /* TEXT */
          )
        ])) : vue.createCommentVNode("v-if", true)
      ])) : vue.createCommentVNode("v-if", true),
      $options.showGaodeSearchAssistCard ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 3,
        class: "card"
      }, [
        vue.createElementVNode("text", { class: "section-title" }, "高德搜索辅助"),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "可搜地址"),
          vue.createElementVNode(
            "text",
            { class: "value gaode-search-text" },
            vue.toDisplayString($options.getGaodeSearchAssistText()),
            1
            /* TEXT */
          )
        ]),
        $options.getGaodeSearchAssistCoordText() ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "info-row"
        }, [
          vue.createElementVNode("text", { class: "label" }, "辅助坐标"),
          vue.createElementVNode(
            "text",
            { class: "value gaode-coord-text" },
            vue.toDisplayString($options.getGaodeSearchAssistCoordText()),
            1
            /* TEXT */
          )
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode("button", {
          class: "gaode-copy-btn",
          onClick: _cache[4] || (_cache[4] = (...args) => $options.copyGaodeSearchAssist && $options.copyGaodeSearchAssist(...args))
        }, " 复制到高德搜索 ")
      ])) : vue.createCommentVNode("v-if", true),
      vue.createElementVNode("view", { class: "action-bar" }, [
        $options.canShowTownRiderTransferButton ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 0,
          class: "btn btn-transfer",
          onClick: _cache[5] || (_cache[5] = (...args) => $options.openTownRiderTransferDialog && $options.openTownRiderTransferDialog(...args))
        }, " 转给骑手 ")) : vue.createCommentVNode("v-if", true),
        $options.canShowTransferButton ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 1,
          class: "btn btn-transfer",
          onClick: _cache[6] || (_cache[6] = (...args) => $options.openTransferDialog && $options.openTransferDialog(...args))
        }, " 转派给乡镇站长 ")) : vue.createCommentVNode("v-if", true),
        $options.canShowTransferRevokeAction ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 2,
          class: "btn btn-revoke",
          onClick: _cache[7] || (_cache[7] = (...args) => $options.handleTransferRevoke && $options.handleTransferRevoke(...args))
        }, " 撤回一次 ")) : vue.createCommentVNode("v-if", true),
        $options.showPrimaryDeliveryAction ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 3,
          class: "btn btn-success",
          disabled: $options.isPrimaryDeliveryActionDisabled,
          onClick: _cache[8] || (_cache[8] = (...args) => $options.handlePrimaryDeliveryAction && $options.handlePrimaryDeliveryAction(...args))
        }, vue.toDisplayString($options.getPrimaryDeliveryActionText()), 9, ["disabled"])) : vue.createCommentVNode("v-if", true),
        $options.showSpecialCompleteAssistAction ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 4,
          class: "btn btn-special btn-full-width",
          onClick: _cache[9] || (_cache[9] = (...args) => $options.handleSpecialComplete && $options.handleSpecialComplete(...args))
        }, " 特殊完结 ")) : vue.createCommentVNode("v-if", true)
      ]),
      vue.createVNode(_component_transfer_order_dialog, {
        show: $data.showTransferDialog,
        loading: $data.transferSubmitting,
        "order-no": $data.order.order_no || "",
        "town-options": $data.townOptions,
        "stationmaster-options": $data.stationmasterOptions,
        "stationmasters-loading": $data.stationmastersLoading,
        "default-town": $options.getCurrentOrderTownName($data.order),
        "default-stationmaster": $options.getTransferToUserName($data.order),
        onClose: $options.closeTransferDialog,
        onTownChange: $options.handleTransferTownChange,
        onConfirm: $options.handleTransferSubmit
      }, null, 8, ["show", "loading", "order-no", "town-options", "stationmaster-options", "stationmasters-loading", "default-town", "default-stationmaster", "onClose", "onTownChange", "onConfirm"]),
      vue.createVNode(_component_transfer_town_rider_dialog, {
        show: $data.showTownRiderTransferDialog,
        loading: $data.townRiderTransferSubmitting || $data.townRiderListLoading,
        "order-no": $data.order.order_no || "",
        "rider-options": $data.townRiderOptions,
        onClose: $options.closeTownRiderTransferDialog,
        onConfirm: $options.handleTownRiderTransferSubmit
      }, null, 8, ["show", "loading", "order-no", "rider-options", "onClose", "onConfirm"])
    ]);
  }
  const PagesOrdersDetail = /* @__PURE__ */ _export_sfc(_sfc_main$d, [["render", _sfc_render$c], ["__scopeId", "data-v-bc4602bd"], ["__file", "E:/固始县外卖骑手端/pages/orders/detail.vue"]]);
  const TENCENT_NAV_STAGE = {
    PICKUP: "pickup",
    DELIVERY: "delivery"
  };
  function normalizeTestParams(input = {}) {
    const stage = input.stage === TENCENT_NAV_STAGE.DELIVERY ? TENCENT_NAV_STAGE.DELIVERY : TENCENT_NAV_STAGE.PICKUP;
    return {
      stage,
      orderId: String(input.orderId || ""),
      riderLng: toNumber(input.riderLng),
      riderLat: toNumber(input.riderLat),
      merchantLng: toNumber(input.merchantLng),
      merchantLat: toNumber(input.merchantLat),
      customerLng: toNumber(input.customerLng),
      customerLat: toNumber(input.customerLat)
    };
  }
  function toNumber(value2) {
    const num = Number(value2);
    return Number.isFinite(num) ? num : 0;
  }
  function getTencentNativeModule() {
    try {
      return requireNativePlugin("TencentNaviModule");
    } catch (error) {
      return null;
    }
    return null;
  }
  function startTencentNativeNavigation(params = {}) {
    const normalized = normalizeTestParams(params);
    const module = getTencentNativeModule();
    if (!module) {
      return Promise.resolve({
        success: false,
        code: "MODULE_UNAVAILABLE",
        message: "腾讯原生导航插件未注册，当前只能完成测试参数验证",
        params: normalized
      });
    }
    return new Promise((resolve) => {
      try {
        module.startNavigation(normalized, (result) => {
          resolve({
            success: !!(result && (result.success || result.code === 0)),
            code: result && result.code !== void 0 ? result.code : "UNKNOWN",
            message: result && result.message ? result.message : "腾讯原生导航已返回结果",
            raw: result || null,
            params: normalized
          });
        });
      } catch (error) {
        resolve({
          success: false,
          code: "NATIVE_CALL_ERROR",
          message: error && error.message ? error.message : "调用腾讯原生导航插件异常",
          params: normalized
        });
      }
    });
  }
  function startTencentNavigation(params = {}) {
    return startTencentNativeNavigation(params);
  }
  const _sfc_main$c = {
    data() {
      return {
        stage: "pickup",
        riderLng: "",
        riderLat: "",
        merchantLng: "",
        merchantLat: "",
        customerLng: "",
        customerLat: "",
        failed: false,
        launching: false,
        launchFinished: false,
        statusText: "正在进入配送界面..."
      };
    },
    computed: {
      stageLabel() {
        return this.stage === "delivery" ? "送餐" : "取餐";
      },
      pageTitle() {
        return this.stage === "delivery" ? "正在进入送货导航" : "正在进入取餐导航";
      }
    },
    onLoad(options) {
      const payload = options || {};
      this.stage = payload.stage === "delivery" ? "delivery" : "pickup";
      this.riderLng = payload.startLng || payload.riderLng || "";
      this.riderLat = payload.startLat || payload.riderLat || "";
      this.merchantLng = payload.merchantLng || "";
      this.merchantLat = payload.merchantLat || "";
      this.customerLng = payload.customerLng || "";
      this.customerLat = payload.customerLat || "";
      this.startNavigation();
    },
    methods: {
      async startNavigation() {
        if (this.launching) {
          return;
        }
        this.launching = true;
        this.failed = false;
        this.statusText = "正在进入配送界面...";
        const riderPosition = await this.resolveRiderPosition();
        const result = await startTencentNavigation({
          stage: this.stage,
          riderLng: riderPosition.lng,
          riderLat: riderPosition.lat,
          merchantLng: this.merchantLng,
          merchantLat: this.merchantLat,
          customerLng: this.customerLng,
          customerLat: this.customerLat
        });
        this.launching = false;
        this.launchFinished = true;
        if (result && result.success) {
          this.statusText = this.stage === "delivery" ? "送货配送界面已打开" : "取餐配送界面已打开";
          setTimeout(() => {
            uni.navigateBack({
              delta: 1
            });
          }, 80);
          return;
        }
        this.failed = true;
        this.statusText = result && result.message ? result.message : "进入配送界面失败，请重试";
        uni.showToast({
          title: this.statusText,
          icon: "none"
        });
      },
      async resolveRiderPosition() {
        const existingLng = Number(this.riderLng);
        const existingLat = Number(this.riderLat);
        if (hasValidCoords({ lng: existingLng, lat: existingLat })) {
          return {
            lng: existingLng,
            lat: existingLat
          };
        }
        const cachedSample = this.getCachedRiderPosition();
        if (cachedSample) {
          this.riderLng = cachedSample.lng;
          this.riderLat = cachedSample.lat;
          this.statusText = "已读取骑手最近一次真实定位，正在进入配送界面...";
          return cachedSample;
        }
        try {
          const gcj02Location = await this.requestNavigationLocation("gcj02");
          if (this.hasValidCoords(gcj02Location)) {
            this.riderLng = gcj02Location.lng;
            this.riderLat = gcj02Location.lat;
            return gcj02Location;
          }
        } catch (error) {
          formatAppLog("warn", "at pages/map/nav.vue:124", "[nav] gcj02 rider location failed", error);
        }
        try {
          const wgs84Location = await this.requestNavigationLocation("wgs84");
          if (this.hasValidCoords(wgs84Location)) {
            this.riderLng = wgs84Location.lng;
            this.riderLat = wgs84Location.lat;
            return wgs84Location;
          }
        } catch (error) {
          formatAppLog("warn", "at pages/map/nav.vue:134", "[nav] wgs84 high-accuracy rider location failed", error);
        }
        try {
          const lowAccuracyLocation = await this.requestNavigationLocation("wgs84", {
            isHighAccuracy: false,
            highAccuracyExpireTime: 15e3
          });
          if (this.hasValidCoords(lowAccuracyLocation)) {
            this.riderLng = lowAccuracyLocation.lng;
            this.riderLat = lowAccuracyLocation.lat;
            return lowAccuracyLocation;
          }
        } catch (error) {
          formatAppLog("warn", "at pages/map/nav.vue:147", "[nav] wgs84 low-accuracy rider location failed", error);
        }
        return {
          lng: 0,
          lat: 0
        };
      },
      getCachedRiderPosition() {
        const cached = getCachedRiderCoords();
        return hasValidCoords(cached) ? cached : null;
      }
    }
  };
  function _sfc_render$b(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "status-card" }, [
        vue.createElementVNode(
          "text",
          { class: "title" },
          vue.toDisplayString($options.pageTitle),
          1
          /* TEXT */
        ),
        vue.createElementVNode(
          "text",
          { class: "desc" },
          vue.toDisplayString($data.statusText),
          1
          /* TEXT */
        ),
        vue.createElementVNode(
          "text",
          { class: "meta" },
          "阶段：" + vue.toDisplayString($options.stageLabel),
          1
          /* TEXT */
        ),
        vue.createElementVNode(
          "text",
          { class: "meta" },
          "商家：" + vue.toDisplayString($data.merchantLng || "未传") + ", " + vue.toDisplayString($data.merchantLat || "未传"),
          1
          /* TEXT */
        ),
        vue.createElementVNode(
          "text",
          { class: "meta" },
          "用户：" + vue.toDisplayString($data.customerLng || "未传") + ", " + vue.toDisplayString($data.customerLat || "未传"),
          1
          /* TEXT */
        )
      ]),
      $data.failed ? (vue.openBlock(), vue.createElementBlock("button", {
        key: 0,
        class: "btn primary",
        onClick: _cache[0] || (_cache[0] = (...args) => $options.startNavigation && $options.startNavigation(...args))
      }, "重新进入配送界面")) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesMapNav = /* @__PURE__ */ _export_sfc(_sfc_main$c, [["render", _sfc_render$b], ["__scopeId", "data-v-0827d2c9"], ["__file", "E:/固始县外卖骑手端/pages/map/nav.vue"]]);
  const _sfc_main$b = {
    data() {
      return {};
    }
  };
  function _sfc_render$a(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "empty-state" }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "🏃"),
        vue.createElementVNode("text", { class: "empty-text" }, "跑腿订单"),
        vue.createElementVNode("text", { class: "empty-tip" }, "功能开发中，敬请期待...")
      ])
    ]);
  }
  const PagesErrandsIndex = /* @__PURE__ */ _export_sfc(_sfc_main$b, [["render", _sfc_render$a], ["__scopeId", "data-v-04967d3f"], ["__file", "E:/固始县外卖骑手端/pages/errands/index.vue"]]);
  const _sfc_main$a = {
    data() {
      return {};
    }
  };
  function _sfc_render$9(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "empty-state" }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "📝"),
        vue.createElementVNode("text", { class: "empty-text" }, "跑腿订单详情"),
        vue.createElementVNode("text", { class: "empty-tip" }, "功能开发中，敬请期待...")
      ])
    ]);
  }
  const PagesErrandsDetail = /* @__PURE__ */ _export_sfc(_sfc_main$a, [["render", _sfc_render$9], ["__scopeId", "data-v-bf14a200"], ["__file", "E:/固始县外卖骑手端/pages/errands/detail.vue"]]);
  function toDateText(value2) {
    if (!value2) {
      return "";
    }
    const date = new Date(value2);
    if (Number.isNaN(date.getTime())) {
      return String(value2).slice(0, 10);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const _sfc_main$9 = {
    data() {
      return {
        loading: false,
        allOrders: [],
        todayOrders: [],
        stats: {
          totalOrders: 0,
          completedOrders: 0,
          todayRiderIncome: "0.00",
          todaySettledIncome: "0.00",
          deliveringOrders: 0,
          hasTodayRiderIncome: false,
          hasTodaySettledIncome: false
        }
      };
    },
    computed: {
      incomeCardValue() {
        if (this.stats.hasTodayRiderIncome) {
          return this.stats.todayRiderIncome;
        }
        if (this.stats.hasTodaySettledIncome) {
          return this.stats.todaySettledIncome;
        }
        return "0.00";
      },
      incomeCardLabel() {
        if (this.stats.hasTodayRiderIncome) {
          return "今日配送收入";
        }
        if (this.stats.hasTodaySettledIncome) {
          return "今日已结算收入";
        }
        return "今日配送收入";
      },
      showSettledIncomeHint() {
        return this.stats.hasTodayRiderIncome && this.stats.hasTodaySettledIncome;
      }
    },
    onLoad() {
      this.loadTodayOrders();
    },
    onPullDownRefresh() {
      this.loadTodayOrders();
    },
    methods: {
      formatTime,
      async loadTodayOrders() {
        this.loading = true;
        try {
          await Promise.all([
            this.loadTodaySummary(),
            this.loadTodayOrderList()
          ]);
        } catch (error) {
          formatAppLog("error", "at pages/today-orders/index.vue:147", "加载今日订单失败", error);
          this.allOrders = [];
          this.todayOrders = [];
          this.resetStats();
        } finally {
          this.loading = false;
          uni.stopPullDownRefresh();
        }
      },
      resetStats() {
        this.stats = {
          totalOrders: 0,
          completedOrders: 0,
          todayRiderIncome: "0.00",
          todaySettledIncome: "0.00",
          deliveringOrders: 0,
          hasTodayRiderIncome: false,
          hasTodaySettledIncome: false
        };
      },
      async loadTodaySummary() {
        const res = await getRiderTodaySummary();
        const summary = (res == null ? void 0 : res.data) || {};
        const rawTodayRiderIncome = summary.today_rider_income ?? summary.todayRiderIncome;
        const rawTodaySettledIncome = summary.today_settled_income ?? summary.todaySettledIncome;
        this.stats.totalOrders = Number(
          summary.today_total_orders ?? summary.total_orders ?? summary.todayTotalOrders ?? 0
        );
        this.stats.completedOrders = Number(
          summary.today_completed_orders ?? summary.completed_orders ?? summary.todayCompletedOrders ?? 0
        );
        this.stats.hasTodayRiderIncome = rawTodayRiderIncome !== void 0 && rawTodayRiderIncome !== null && rawTodayRiderIncome !== "";
        this.stats.hasTodaySettledIncome = rawTodaySettledIncome !== void 0 && rawTodaySettledIncome !== null && rawTodaySettledIncome !== "";
        this.stats.todayRiderIncome = (parseFloat(rawTodayRiderIncome ?? 0) || 0).toFixed(2);
        this.stats.todaySettledIncome = (parseFloat(rawTodaySettledIncome ?? 0) || 0).toFixed(2);
        this.stats.deliveringOrders = Number(
          summary.today_delivering_orders ?? summary.delivering_orders ?? summary.todayDeliveringOrders ?? 0
        );
      },
      async loadTodayOrderList() {
        const res = await getRiderOrders();
        this.allOrders = Array.isArray(res == null ? void 0 : res.data) ? res.data : [];
        const today = toDateText(/* @__PURE__ */ new Date());
        const todayFilteredOrders = this.allOrders.filter((order) => {
          const createdToday = toDateText(order.created_at) === today;
          const updatedToday = toDateText(order.updated_at || order.settled_at || order.completed_at) === today;
          return createdToday || updatedToday;
        });
        this.todayOrders = [...todayFilteredOrders].sort((a, b) => {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
      },
      getStatusText(status) {
        var _a;
        return ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.text) || "未知状态";
      },
      getStatusColor(status) {
        var _a;
        return ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.color) || "#999999";
      },
      formatFee(value2) {
        return (parseFloat(value2) || 0).toFixed(2);
      },
      getBriefAddress(order = {}) {
        try {
          const addr = typeof order.delivery_address === "string" ? JSON.parse(order.delivery_address) : order.delivery_address;
          return (addr == null ? void 0 : addr.detail) || (addr == null ? void 0 : addr.address) || `${(addr == null ? void 0 : addr.district) || ""}${(addr == null ? void 0 : addr.street) || ""}` || order.address || "未知地址";
        } catch (error) {
          return order.address || "未知地址";
        }
      },
      goOrderDetail(order) {
        uni.navigateTo({
          url: `/pages/orders/detail?id=${order.id}`
        });
      }
    }
  };
  function _sfc_render$8(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "summary-grid" }, [
        vue.createElementVNode("view", { class: "summary-card" }, [
          vue.createElementVNode(
            "text",
            { class: "summary-value" },
            vue.toDisplayString($data.stats.totalOrders),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "summary-label" }, "今日总订单")
        ]),
        vue.createElementVNode("view", { class: "summary-card" }, [
          vue.createElementVNode(
            "text",
            { class: "summary-value" },
            vue.toDisplayString($data.stats.completedOrders),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "summary-label" }, "今日已完成")
        ]),
        vue.createElementVNode("view", { class: "summary-card" }, [
          vue.createElementVNode(
            "text",
            { class: "summary-value" },
            "¥" + vue.toDisplayString($options.incomeCardValue),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "summary-label" },
            vue.toDisplayString($options.incomeCardLabel),
            1
            /* TEXT */
          ),
          $options.showSettledIncomeHint ? (vue.openBlock(), vue.createElementBlock(
            "text",
            {
              key: 0,
              class: "summary-subvalue"
            },
            "已结算 ¥" + vue.toDisplayString($data.stats.todaySettledIncome),
            1
            /* TEXT */
          )) : vue.createCommentVNode("v-if", true)
        ]),
        vue.createElementVNode("view", { class: "summary-card" }, [
          vue.createElementVNode(
            "text",
            { class: "summary-value" },
            vue.toDisplayString($data.stats.deliveringOrders),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "summary-label" }, "当前配送中")
        ])
      ]),
      vue.createElementVNode("view", { class: "panel" }, [
        vue.createElementVNode("view", { class: "panel-header" }, [
          vue.createElementVNode("text", { class: "panel-title" }, "今日订单明细"),
          vue.createElementVNode("text", { class: "panel-subtitle" }, "顶部统计以后端 today-summary 为准，明细按下单时间展示")
        ]),
        $data.todayOrders.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "order-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.todayOrders, (order) => {
              var _a;
              return vue.openBlock(), vue.createElementBlock("view", {
                key: order.id,
                class: "order-card",
                onClick: ($event) => $options.goOrderDetail(order)
              }, [
                vue.createElementVNode("view", { class: "order-top" }, [
                  vue.createElementVNode("view", { class: "order-top-left" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "order-no" },
                      vue.toDisplayString(order.order_no || "订单 #" + order.id),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "order-time" },
                      vue.toDisplayString($options.formatTime(order.created_at)),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode(
                    "text",
                    {
                      class: "order-status",
                      style: vue.normalizeStyle({ color: $options.getStatusColor(order.status) })
                    },
                    vue.toDisplayString($options.getStatusText(order.status)),
                    5
                    /* TEXT, STYLE */
                  )
                ]),
                vue.createElementVNode("view", { class: "order-row" }, [
                  vue.createElementVNode("text", { class: "row-label" }, "商家"),
                  vue.createElementVNode(
                    "text",
                    { class: "row-value" },
                    vue.toDisplayString(((_a = order.merchant) == null ? void 0 : _a.name) || "未知商家"),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "order-row" }, [
                  vue.createElementVNode("text", { class: "row-label" }, "地址"),
                  vue.createElementVNode(
                    "text",
                    { class: "row-value address-text" },
                    vue.toDisplayString($options.getBriefAddress(order)),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "order-bottom" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "income-text" },
                    "配送费 ¥" + vue.toDisplayString($options.formatFee(order.rider_fee)),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("text", { class: "detail-link" }, "查看详情")
                ])
              ], 8, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "empty-state"
        }, [
          vue.createElementVNode("text", { class: "empty-icon" }, "📊"),
          vue.createElementVNode("text", { class: "empty-text" }, "暂无今日明细订单"),
          vue.createElementVNode("text", { class: "empty-tip" }, "明细按下单时间展示，顶部统计仍以后端 today-summary 为准")
        ]))
      ])
    ]);
  }
  const PagesTodayOrdersIndex = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["render", _sfc_render$8], ["__scopeId", "data-v-2c2deae4"], ["__file", "E:/固始县外卖骑手端/pages/today-orders/index.vue"]]);
  function pickList$3(payload) {
    if (Array.isArray(payload))
      return payload;
    if (Array.isArray(payload == null ? void 0 : payload.list))
      return payload.list;
    if (Array.isArray(payload == null ? void 0 : payload.rows))
      return payload.rows;
    if (Array.isArray(payload == null ? void 0 : payload.data))
      return payload.data;
    return [];
  }
  function pickConversationId(item = {}) {
    return item.id || item.conversation_id || item.conversationId || "";
  }
  function pickUserName(item = {}) {
    var _a, _b;
    return item.user_nickname || item.userName || item.user_name || ((_a = item.user) == null ? void 0 : _a.nickname) || ((_b = item.user) == null ? void 0 : _b.name) || "用户";
  }
  function pickTownName(item = {}) {
    return item.town_name || item.townName || item.town || item.delivery_town || item.user_town || "未标注乡镇";
  }
  function pickPreview(item = {}) {
    const lastMessage = item.last_message || item.latest_message || {};
    return item.last_message_content || item.lastContent || lastMessage.content || "";
  }
  function pickLastTime(item = {}) {
    const lastMessage = item.last_message || item.latest_message || {};
    return item.last_message_time || item.updated_at || item.lastTime || lastMessage.created_at || item.created_at || "";
  }
  function pickUnreadCount(item = {}) {
    const unread = item.unread_count ?? item.unreadCount ?? item.unread_num;
    return Number(unread) > 0 ? Number(unread) : 0;
  }
  const _sfc_main$8 = {
    data() {
      return {
        hasPageAccess: false,
        loading: false,
        conversations: [],
        conversationPollTimer: null,
        conversationsLoading: false
      };
    },
    onLoad() {
      this.hasPageAccess = this.ensurePageAccess();
    },
    onShow() {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      this.initConversationPolling();
    },
    onHide() {
      this.stopConversationPolling();
    },
    onUnload() {
      this.stopConversationPolling();
    },
    onPullDownRefresh() {
      this.loadConversations(false);
    },
    methods: {
      formatTime,
      ensurePageAccess() {
        const user = getUserInfo$1() || {};
        if (isTownStationmaster(user)) {
          return true;
        }
        this.stopConversationPolling();
        uni.showToast({ title: "仅乡镇站长可进入", icon: "none" });
        if (typeof uni.navigateBack === "function") {
          uni.navigateBack({
            fail: () => {
              uni.switchTab({ url: "/pages/index/index" });
            }
          });
        }
        return false;
      },
      async initConversationPolling() {
        if (!this.hasPageAccess) {
          return;
        }
        await this.loadConversations(true);
        this.startConversationPolling();
      },
      async loadConversations(showLoading = true) {
        if (!this.hasPageAccess) {
          return;
        }
        if (this.conversationsLoading) {
          return;
        }
        if (showLoading) {
          this.loading = true;
        }
        this.conversationsLoading = true;
        try {
          const res = await getTownErrandConversations();
          const source = pickList$3((res == null ? void 0 : res.data) ?? res);
          this.conversations = source.map((item) => {
            const id = pickConversationId(item);
            if (!id) {
              return null;
            }
            return {
              id,
              raw: item,
              userName: pickUserName(item),
              townName: pickTownName(item),
              preview: pickPreview(item),
              lastTime: pickLastTime(item),
              unreadCount: pickUnreadCount(item)
            };
          }).filter(Boolean);
        } catch (error) {
          formatAppLog("error", "at pages/station-messages/index.vue:166", "加载镇上跑腿代购会话失败", error);
          this.conversations = [];
        } finally {
          this.conversationsLoading = false;
          this.loading = false;
          uni.stopPullDownRefresh();
        }
      },
      startConversationPolling() {
        if (!this.hasPageAccess) {
          return;
        }
        this.stopConversationPolling();
        this.conversationPollTimer = setInterval(() => {
          this.loadConversations(false);
        }, 2e3);
      },
      stopConversationPolling() {
        if (this.conversationPollTimer) {
          clearInterval(this.conversationPollTimer);
          this.conversationPollTimer = null;
        }
      },
      openConversation(item) {
        if (!this.hasPageAccess) {
          return;
        }
        const title = encodeURIComponent(item.userName || "会话详情");
        uni.navigateTo({
          url: `/pages/station-messages/detail?id=${item.id}&title=${title}`
        });
      }
    }
  };
  function _sfc_render$7(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "page-header" }, [
        vue.createElementVNode("text", { class: "page-title" }, "跑腿代购消息"),
        vue.createElementVNode("text", { class: "page-tip" }, "仅显示当前乡镇站长的真实会话")
      ]),
      $data.loading && $data.conversations.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "state-wrap"
      }, [
        vue.createElementVNode("text", { class: "state-text" }, "加载中...")
      ])) : $data.conversations.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "state-wrap"
      }, [
        vue.createElementVNode("text", { class: "state-text" }, "暂无跑腿代购消息")
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "conversation-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.conversations, (item) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: item.id,
              class: "conversation-card",
              onClick: ($event) => $options.openConversation(item)
            }, [
              vue.createElementVNode("view", { class: "conversation-top" }, [
                vue.createElementVNode("view", { class: "conversation-meta" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "user-name" },
                    vue.toDisplayString(item.userName),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "town-name" },
                    vue.toDisplayString(item.townName),
                    1
                    /* TEXT */
                  )
                ]),
                item.lastTime ? (vue.openBlock(), vue.createElementBlock(
                  "text",
                  {
                    key: 0,
                    class: "time-text"
                  },
                  vue.toDisplayString($options.formatTime(item.lastTime)),
                  1
                  /* TEXT */
                )) : vue.createCommentVNode("v-if", true)
              ]),
              vue.createElementVNode("view", { class: "conversation-bottom" }, [
                vue.createElementVNode(
                  "text",
                  { class: "preview-text" },
                  vue.toDisplayString(item.preview || "暂无消息内容"),
                  1
                  /* TEXT */
                ),
                item.unreadCount > 0 ? (vue.openBlock(), vue.createElementBlock(
                  "text",
                  {
                    key: 0,
                    class: "unread-badge"
                  },
                  vue.toDisplayString(item.unreadCount),
                  1
                  /* TEXT */
                )) : vue.createCommentVNode("v-if", true)
              ])
            ], 8, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]))
    ]);
  }
  const PagesStationMessagesIndex = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["render", _sfc_render$7], ["__scopeId", "data-v-b1eca758"], ["__file", "E:/固始县外卖骑手端/pages/station-messages/index.vue"]]);
  function pickList$2(payload) {
    if (Array.isArray(payload))
      return payload;
    if (Array.isArray(payload == null ? void 0 : payload.list))
      return payload.list;
    if (Array.isArray(payload == null ? void 0 : payload.rows))
      return payload.rows;
    if (Array.isArray(payload == null ? void 0 : payload.data))
      return payload.data;
    return [];
  }
  function pickMessageId(item = {}, index = 0) {
    return item.id || item.message_id || item.messageId || `${index}-${item.created_at || Date.now()}`;
  }
  function pickMessageContent(item = {}) {
    return item.content || item.message || item.text || "";
  }
  function pickMessageTime(item = {}) {
    return item.created_at || item.createdAt || item.sent_at || item.updated_at || "";
  }
  function pickSenderId(item = {}) {
    return item.sender_id || item.user_id || item.from_user_id || item.fromUserId || "";
  }
  function pickSenderRole(item = {}) {
    return String(item.sender_role || item.role || item.sender_type || item.user_role || "").toLowerCase();
  }
  const _sfc_main$7 = {
    data() {
      return {
        hasPageAccess: false,
        conversationId: "",
        pageTitle: "会话详情",
        draft: "",
        loading: false,
        sending: false,
        messages: [],
        currentUserId: "",
        scrollAnchor: "",
        messagePollTimer: null,
        messagesLoading: false
      };
    },
    onLoad(options) {
      this.hasPageAccess = this.ensurePageAccess();
      this.conversationId = options.id || "";
      this.pageTitle = decodeURIComponent(options.title || "会话详情");
      const storedUser = getUserInfo$1();
      this.currentUserId = (storedUser == null ? void 0 : storedUser.id) || "";
    },
    onShow() {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      this.initMessagePolling();
    },
    onHide() {
      this.stopMessagePolling();
    },
    onUnload() {
      this.stopMessagePolling();
    },
    methods: {
      formatTime,
      ensurePageAccess() {
        const user = getUserInfo$1() || {};
        if (isTownStationmaster(user)) {
          return true;
        }
        this.stopMessagePolling();
        uni.showToast({ title: "仅乡镇站长可进入", icon: "none" });
        if (typeof uni.navigateBack === "function") {
          uni.navigateBack({
            fail: () => {
              uni.switchTab({ url: "/pages/index/index" });
            }
          });
        }
        return false;
      },
      async initMessagePolling() {
        if (!this.hasPageAccess) {
          return;
        }
        await this.loadMessages(true);
        this.startMessagePolling();
      },
      isMineMessage(item = {}) {
        const senderId = pickSenderId(item);
        const senderRole = pickSenderRole(item);
        if (this.currentUserId && String(senderId) === String(this.currentUserId)) {
          return true;
        }
        return senderRole === "stationmaster" || senderRole === "rider";
      },
      async loadMessages(showLoading = true) {
        if (!this.hasPageAccess) {
          return;
        }
        if (!this.conversationId) {
          uni.showToast({ title: "会话不存在", icon: "none" });
          return;
        }
        if (this.messagesLoading) {
          return;
        }
        if (showLoading) {
          this.loading = true;
        }
        this.messagesLoading = true;
        try {
          const res = await getTownErrandMessages(this.conversationId);
          const source = pickList$2((res == null ? void 0 : res.data) ?? res);
          this.messages = source.map((item, index) => ({
            id: pickMessageId(item, index),
            content: pickMessageContent(item),
            createdAt: pickMessageTime(item),
            isMine: this.isMineMessage(item)
          })).filter((item) => item.content);
          this.scrollToBottom();
        } catch (error) {
          formatAppLog("error", "at pages/station-messages/detail.vue:189", "加载镇上跑腿代购消息失败", error);
          this.messages = [];
        } finally {
          this.messagesLoading = false;
          this.loading = false;
        }
      },
      startMessagePolling() {
        if (!this.hasPageAccess) {
          return;
        }
        this.stopMessagePolling();
        this.messagePollTimer = setInterval(() => {
          this.loadMessages(false);
        }, 1500);
      },
      stopMessagePolling() {
        if (this.messagePollTimer) {
          clearInterval(this.messagePollTimer);
          this.messagePollTimer = null;
        }
      },
      scrollToBottom() {
        if (!this.messages.length) {
          this.scrollAnchor = "";
          return;
        }
        this.$nextTick(() => {
          this.scrollAnchor = `msg-${this.messages[this.messages.length - 1].id}`;
        });
      },
      async handleSend() {
        if (!this.hasPageAccess) {
          return;
        }
        const content = String(this.draft || "").trim();
        if (!content || this.sending) {
          if (!content) {
            uni.showToast({ title: "请输入回复内容", icon: "none" });
          }
          return;
        }
        try {
          this.sending = true;
          await sendTownErrandMessage(this.conversationId, content);
          this.draft = "";
          await this.loadMessages(false);
        } catch (error) {
          formatAppLog("error", "at pages/station-messages/detail.vue:237", "发送镇上跑腿代购消息失败", error);
        } finally {
          this.sending = false;
        }
      }
    }
  };
  function _sfc_render$6(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "chat-header" }, [
        vue.createElementVNode(
          "text",
          { class: "chat-title" },
          vue.toDisplayString($data.pageTitle),
          1
          /* TEXT */
        ),
        vue.createElementVNode("text", { class: "chat-tip" }, "仅支持文字回复，消息均来自真实接口")
      ]),
      vue.createElementVNode("scroll-view", {
        class: "message-scroll",
        "scroll-y": "",
        "scroll-into-view": $data.scrollAnchor
      }, [
        $data.loading && $data.messages.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "state-wrap"
        }, [
          vue.createElementVNode("text", { class: "state-text" }, "加载中...")
        ])) : $data.messages.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "state-wrap"
        }, [
          vue.createElementVNode("text", { class: "state-text" }, "暂无消息")
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "message-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.messages, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                id: `msg-${item.id}`,
                key: item.id,
                class: vue.normalizeClass(["message-row", { mine: item.isMine }])
              }, [
                vue.createElementVNode(
                  "view",
                  {
                    class: vue.normalizeClass(["message-bubble", { mine: item.isMine }])
                  },
                  [
                    vue.createElementVNode(
                      "text",
                      { class: "message-content" },
                      vue.toDisplayString(item.content),
                      1
                      /* TEXT */
                    )
                  ],
                  2
                  /* CLASS */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "message-time" },
                  vue.toDisplayString($options.formatTime(item.createdAt)),
                  1
                  /* TEXT */
                )
              ], 10, ["id"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]))
      ], 8, ["scroll-into-view"]),
      vue.createElementVNode("view", { class: "composer" }, [
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.draft = $event),
            class: "composer-input",
            type: "text",
            maxlength: "500",
            placeholder: "请输入回复内容",
            "confirm-type": "send",
            onConfirm: _cache[1] || (_cache[1] = (...args) => $options.handleSend && $options.handleSend(...args))
          },
          null,
          544
          /* NEED_HYDRATION, NEED_PATCH */
        ), [
          [vue.vModelText, $data.draft]
        ]),
        vue.createElementVNode("button", {
          class: "send-btn",
          disabled: $data.sending,
          onClick: _cache[2] || (_cache[2] = (...args) => $options.handleSend && $options.handleSend(...args))
        }, vue.toDisplayString($data.sending ? "发送中" : "发送"), 9, ["disabled"])
      ])
    ]);
  }
  const PagesStationMessagesDetail = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["render", _sfc_render$6], ["__scopeId", "data-v-b080f879"], ["__file", "E:/固始县外卖骑手端/pages/station-messages/detail.vue"]]);
  function pickList$1(payload) {
    if (Array.isArray(payload))
      return payload;
    if (Array.isArray(payload == null ? void 0 : payload.list))
      return payload.list;
    if (Array.isArray(payload == null ? void 0 : payload.rows))
      return payload.rows;
    if (Array.isArray(payload == null ? void 0 : payload.data))
      return payload.data;
    return [];
  }
  function safeText$3(value2) {
    if (value2 === void 0 || value2 === null) {
      return "";
    }
    return String(value2).trim();
  }
  function toBoolean$3(value2) {
    return value2 === true || value2 === 1 || value2 === "1" || value2 === "true";
  }
  function normalizeStatusKey$3(item = {}) {
    const raw = safeText$3(item.apply_status || item.status || item.audit_status).toLowerCase();
    if (raw === "approved" || raw === "pass" || raw === "passed" || raw === "success")
      return "approved";
    if (raw === "rejected" || raw === "reject" || raw === "failed")
      return "rejected";
    if (raw === "all")
      return "all";
    return "pending";
  }
  function normalizeStatusText$3(item = {}, statusKey = "pending") {
    const text = safeText$3(item.apply_status_text || item.status_text || item.audit_status_text);
    if (text)
      return text;
    if (statusKey === "approved")
      return "已通过";
    if (statusKey === "rejected")
      return "已驳回";
    return "待审核";
  }
  function normalizeApplication$3(item = {}) {
    const statusKey = normalizeStatusKey$3(item);
    return {
      id: item.id || item.application_id || item.apply_id || "",
      merchantName: safeText$3(item.merchant_name || item.shop_name || item.store_name || item.name),
      contactName: safeText$3(item.contact_name || item.owner_name || item.manager_name),
      contactPhone: safeText$3(item.contact_phone || item.phone || item.mobile),
      address: safeText$3(item.address || item.detail_address || item.shop_address),
      townName: safeText$3(item.town_name || item.target_town_name || item.service_town_name),
      statusKey,
      statusText: normalizeStatusText$3(item, statusKey),
      submittedAt: item.submitted_at || item.created_at || item.apply_time || "",
      auditedAt: item.audited_at || item.audit_time || item.updated_at || "",
      auditedByRole: safeText$3(item.audited_by_role || item.audit_role),
      auditedByName: safeText$3(item.audited_by_name || item.audit_user_name || item.auditor_name),
      lockedReason: safeText$3(item.audit_locked_reason || item.audit_locked_msg || item.audit_locked_reason_text || item.locked_reason),
      canAudit: toBoolean$3(item.can_stationmaster_audit)
    };
  }
  function extractTotal$1(payload, fallbackLength = 0) {
    var _a, _b;
    const maybeTotal = Number(
      (payload == null ? void 0 : payload.total) ?? (payload == null ? void 0 : payload.count) ?? ((_a = payload == null ? void 0 : payload.meta) == null ? void 0 : _a.total) ?? ((_b = payload == null ? void 0 : payload.pagination) == null ? void 0 : _b.total) ?? fallbackLength
    );
    return Number.isFinite(maybeTotal) ? maybeTotal : fallbackLength;
  }
  function extractSummaryCount$1(payload, key, fallback = 0) {
    var _a, _b;
    const maybeCount = Number(
      ((_a = payload == null ? void 0 : payload.summary) == null ? void 0 : _a[key]) ?? ((_b = payload == null ? void 0 : payload.stats) == null ? void 0 : _b[key]) ?? (payload == null ? void 0 : payload[key]) ?? fallback
    );
    return Number.isFinite(maybeCount) ? maybeCount : fallback;
  }
  const _sfc_main$6 = {
    data() {
      return {
        hasPageAccess: false,
        loading: false,
        refreshing: false,
        loadingMore: false,
        page: 1,
        pageSize: 10,
        hasMore: true,
        currentStatus: "pending",
        applications: [],
        statusTabs: [
          { key: "pending", label: "待审核", count: 0 },
          { key: "approved", label: "已通过", count: 0 },
          { key: "rejected", label: "已驳回", count: 0 }
        ],
        statusClassMap: {
          pending: "status-pending",
          approved: "status-approved",
          rejected: "status-rejected"
        }
      };
    },
    onLoad() {
      this.hasPageAccess = this.ensurePageAccess();
    },
    onShow() {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      this.reloadList();
    },
    methods: {
      formatTime,
      ensurePageAccess() {
        const user = getUserInfo$1() || {};
        if (isTownStationmaster(user)) {
          return true;
        }
        uni.showToast({ title: "仅乡镇站长可进入", icon: "none" });
        if (typeof uni.navigateBack === "function") {
          uni.navigateBack({
            fail: () => {
              uni.switchTab({ url: "/pages/index/index" });
            }
          });
        }
        return false;
      },
      async reloadList() {
        this.page = 1;
        this.hasMore = true;
        await this.loadApplications(true);
      },
      getQueryStatus() {
        return this.currentStatus;
      },
      async loadApplications(replace = false) {
        if (!this.hasPageAccess) {
          return;
        }
        if (replace) {
          this.loading = true;
        } else {
          this.loadingMore = true;
        }
        try {
          const params = {
            status: this.getQueryStatus(),
            page: this.page,
            page_size: this.pageSize
          };
          const res = await getTownMerchantApplications(params);
          const payload = (res == null ? void 0 : res.data) ?? res ?? {};
          const source = pickList$1(payload);
          const normalized = source.map(normalizeApplication$3).filter((item) => item.id);
          if (replace) {
            this.applications = normalized;
          } else {
            this.applications = this.applications.concat(normalized);
          }
          const total = extractTotal$1(payload, normalized.length);
          const currentLength = replace ? normalized.length : this.applications.length;
          this.hasMore = currentLength < total && normalized.length >= this.pageSize;
          this.updateTabCounts(payload, source);
        } catch (error) {
          formatAppLog("error", "at pages/merchant-audit/index.vue:253", "加载商家入驻申请失败", error);
          if (replace) {
            this.applications = [];
          }
        } finally {
          this.loading = false;
          this.refreshing = false;
          this.loadingMore = false;
          uni.stopPullDownRefresh();
        }
      },
      updateTabCounts(payload = {}, source = []) {
        const pendingCount = extractSummaryCount$1(
          payload,
          "pending_count",
          source.filter((item) => normalizeStatusKey$3(item) === "pending").length
        );
        const approvedCount = extractSummaryCount$1(
          payload,
          "approved_count",
          source.filter((item) => normalizeStatusKey$3(item) === "approved").length
        );
        const rejectedCount = extractSummaryCount$1(
          payload,
          "rejected_count",
          source.filter((item) => normalizeStatusKey$3(item) === "rejected").length
        );
        this.statusTabs = [
          { key: "pending", label: "待审核", count: pendingCount },
          { key: "approved", label: "已通过", count: approvedCount },
          { key: "rejected", label: "已驳回", count: rejectedCount }
        ];
      },
      buildAuditSummary(item = {}) {
        if (item.lockedReason) {
          return item.lockedReason;
        }
        const pieces = [];
        if (item.auditedByName) {
          pieces.push(`审核人：${item.auditedByName}`);
        }
        if (item.auditedAt) {
          pieces.push(`审核时间：${this.formatTime(item.auditedAt)}`);
        }
        return pieces.join(" · ");
      },
      switchStatus(status) {
        if (this.currentStatus === status) {
          return;
        }
        this.currentStatus = status;
        this.reloadList();
      },
      getEmptyTip() {
        if (this.currentStatus === "approved") {
          return "当前乡镇暂无已通过的入驻申请";
        }
        if (this.currentStatus === "rejected") {
          return "当前乡镇暂无已驳回的入驻申请";
        }
        return "当前乡镇暂无待审核的商家申请";
      },
      onRefresh() {
        this.refreshing = true;
        this.reloadList();
      },
      loadMore() {
        if (!this.hasMore || this.loadingMore || this.loading) {
          return;
        }
        this.page += 1;
        this.loadApplications(false);
      },
      openDetail(item = {}) {
        uni.navigateTo({
          url: `/pages/merchant-audit/detail?id=${item.id}`
        });
      }
    }
  };
  function _sfc_render$5(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "page-header" }, [
        vue.createElementVNode("text", { class: "page-title" }, "商家入驻审核"),
        vue.createElementVNode("text", { class: "page-tip" }, "仅允许审核当前乡镇的真实商家申请")
      ]),
      vue.createElementVNode("view", { class: "status-tabs" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.statusTabs, (item) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: item.key,
              class: vue.normalizeClass(["tab-item", { active: $data.currentStatus === item.key }]),
              onClick: ($event) => $options.switchStatus(item.key)
            }, [
              vue.createElementVNode(
                "text",
                { class: "tab-text" },
                vue.toDisplayString(item.label),
                1
                /* TEXT */
              ),
              item.count > 0 ? (vue.openBlock(), vue.createElementBlock(
                "text",
                {
                  key: 0,
                  class: "tab-badge"
                },
                vue.toDisplayString(item.count > 99 ? "99+" : item.count),
                1
                /* TEXT */
              )) : vue.createCommentVNode("v-if", true)
            ], 10, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      vue.createElementVNode("scroll-view", {
        "scroll-y": "",
        class: "list-scroll",
        "refresher-enabled": true,
        "refresher-triggered": $data.refreshing,
        onRefresherrefresh: _cache[0] || (_cache[0] = (...args) => $options.onRefresh && $options.onRefresh(...args)),
        onScrolltolower: _cache[1] || (_cache[1] = (...args) => $options.loadMore && $options.loadMore(...args))
      }, [
        $data.loading && $data.applications.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "state-wrap"
        }, [
          vue.createElementVNode("text", { class: "state-text" }, "加载中...")
        ])) : $data.applications.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "state-wrap"
        }, [
          vue.createElementVNode("text", { class: "state-text" }, "暂无商家入驻申请"),
          vue.createElementVNode(
            "text",
            { class: "state-tip" },
            vue.toDisplayString($options.getEmptyTip()),
            1
            /* TEXT */
          )
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "card-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.applications, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.id,
                class: "merchant-card",
                onClick: ($event) => $options.openDetail(item)
              }, [
                vue.createElementVNode("view", { class: "card-top" }, [
                  vue.createElementVNode("view", { class: "merchant-meta" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "merchant-name" },
                      vue.toDisplayString(item.merchantName),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "town-name" },
                      vue.toDisplayString(item.townName || "未标注乡镇"),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode(
                    "text",
                    {
                      class: vue.normalizeClass(["status-tag", $data.statusClassMap[item.statusKey] || "status-pending"])
                    },
                    vue.toDisplayString(item.statusText),
                    3
                    /* TEXT, CLASS */
                  )
                ]),
                vue.createElementVNode("view", { class: "info-row" }, [
                  vue.createElementVNode("text", { class: "info-label" }, "联系人"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-value" },
                    vue.toDisplayString(item.contactName || "未提供") + " " + vue.toDisplayString(item.contactPhone || ""),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "info-row" }, [
                  vue.createElementVNode("text", { class: "info-label" }, "申请地址"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-value address-text" },
                    vue.toDisplayString(item.address || "未提供"),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "info-row" }, [
                  vue.createElementVNode("text", { class: "info-label" }, "提交时间"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-value" },
                    vue.toDisplayString($options.formatTime(item.submittedAt) || "未提供"),
                    1
                    /* TEXT */
                  )
                ]),
                item.auditedByName || item.auditedAt || item.lockedReason ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 0,
                  class: "audit-summary"
                }, [
                  vue.createElementVNode(
                    "text",
                    { class: "audit-summary-text" },
                    vue.toDisplayString($options.buildAuditSummary(item)),
                    1
                    /* TEXT */
                  )
                ])) : vue.createCommentVNode("v-if", true)
              ], 8, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])),
        $data.loadingMore ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 3,
          class: "load-more"
        }, [
          vue.createElementVNode("text", null, "加载中...")
        ])) : $data.applications.length > 0 && !$data.hasMore ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 4,
          class: "load-more"
        }, [
          vue.createElementVNode("text", null, "没有更多了")
        ])) : vue.createCommentVNode("v-if", true)
      ], 40, ["refresher-triggered"])
    ]);
  }
  const PagesMerchantAuditIndex = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["render", _sfc_render$5], ["__scopeId", "data-v-e636315c"], ["__file", "E:/固始县外卖骑手端/pages/merchant-audit/index.vue"]]);
  function safeText$2(value2) {
    if (value2 === void 0 || value2 === null) {
      return "";
    }
    return String(value2).trim();
  }
  function toBoolean$2(value2) {
    return value2 === true || value2 === 1 || value2 === "1" || value2 === "true";
  }
  function normalizeStatusKey$2(item = {}) {
    const raw = safeText$2(item.apply_status || item.status || item.audit_status).toLowerCase();
    if (raw === "approved" || raw === "pass" || raw === "passed" || raw === "success")
      return "approved";
    if (raw === "rejected" || raw === "reject" || raw === "failed")
      return "rejected";
    return "pending";
  }
  function normalizeStatusText$2(item = {}, statusKey = "pending") {
    const text = safeText$2(item.apply_status_text || item.status_text || item.audit_status_text);
    if (text)
      return text;
    if (statusKey === "approved")
      return "已通过";
    if (statusKey === "rejected")
      return "已驳回";
    return "待审核";
  }
  function normalizeApplication$2(item = {}) {
    const statusKey = normalizeStatusKey$2(item);
    return {
      id: item.id || item.application_id || item.apply_id || "",
      merchantName: safeText$2(item.merchant_name || item.shop_name || item.store_name || item.name),
      contactName: safeText$2(item.contact_name || item.owner_name || item.manager_name),
      contactPhone: safeText$2(item.contact_phone || item.phone || item.mobile),
      address: safeText$2(item.address || item.detail_address || item.shop_address),
      townName: safeText$2(item.town_name || item.target_town_name || item.service_town_name),
      statusKey,
      statusText: normalizeStatusText$2(item, statusKey),
      submittedAt: item.submitted_at || item.created_at || item.apply_time || "",
      auditedAt: item.audited_at || item.audit_time || item.updated_at || "",
      auditedByRole: safeText$2(item.audited_by_role || item.audit_role),
      auditedByName: safeText$2(item.audited_by_name || item.audit_user_name || item.auditor_name),
      rejectReason: safeText$2(item.reject_reason || item.audit_reject_reason || item.refuse_reason),
      auditLocked: toBoolean$2(item.audit_locked),
      auditLockedReason: safeText$2(item.audit_locked_reason || item.audit_locked_msg || item.locked_reason),
      canAudit: toBoolean$2(item.can_stationmaster_audit),
      remark: safeText$2(item.remark || item.apply_remark || item.description),
      businessScope: safeText$2(item.business_scope || item.biz_scope),
      licenseNo: safeText$2(item.license_no || item.business_license_no)
    };
  }
  const _sfc_main$5 = {
    data() {
      return {
        hasPageAccess: false,
        loading: false,
        submitting: false,
        showRejectDialog: false,
        rejectReason: "",
        applicationId: "",
        application: {},
        statusClassMap: {
          pending: "status-pending",
          approved: "status-approved",
          rejected: "status-rejected"
        }
      };
    },
    computed: {
      canShowActionBar() {
        return this.application.id && this.application.canAudit && !this.application.auditLocked;
      }
    },
    onLoad(options) {
      this.hasPageAccess = this.ensurePageAccess();
      this.applicationId = options.id || "";
    },
    onShow() {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      this.loadDetail();
    },
    methods: {
      formatTime,
      ensurePageAccess() {
        const user = getUserInfo$1() || {};
        if (isTownStationmaster(user)) {
          return true;
        }
        uni.showToast({ title: "仅乡镇站长可进入", icon: "none" });
        if (typeof uni.navigateBack === "function") {
          uni.navigateBack({
            fail: () => {
              uni.switchTab({ url: "/pages/index/index" });
            }
          });
        }
        return false;
      },
      async loadDetail() {
        if (!this.hasPageAccess || !this.applicationId) {
          return;
        }
        this.loading = true;
        try {
          const res = await getTownMerchantApplicationDetail(this.applicationId);
          this.application = normalizeApplication$2((res == null ? void 0 : res.data) || res || {});
        } catch (error) {
          formatAppLog("error", "at pages/merchant-audit/detail.vue:250", "加载商家入驻申请详情失败", error);
          uni.showToast({ title: this.getErrorMessage(error) || "加载详情失败", icon: "none" });
        } finally {
          this.loading = false;
        }
      },
      callPhone(phone) {
        const value2 = safeText$2(phone);
        if (!value2) {
          return;
        }
        uni.makePhoneCall({ phoneNumber: value2 });
      },
      openRejectDialog() {
        if (!this.canShowActionBar || this.submitting) {
          return;
        }
        this.rejectReason = "";
        this.showRejectDialog = true;
      },
      closeRejectDialog() {
        if (this.submitting) {
          return;
        }
        this.showRejectDialog = false;
      },
      async handleApprove() {
        if (!this.canShowActionBar || this.submitting) {
          return;
        }
        uni.showModal({
          title: "同意入驻",
          content: "确认同意该商家入驻当前乡镇？",
          confirmText: "确认同意",
          cancelText: "取消",
          success: async (res) => {
            if (!res.confirm) {
              return;
            }
            this.submitting = true;
            try {
              await approveTownMerchantApplication(this.applicationId);
              uni.showToast({ title: "审核通过", icon: "success" });
              await this.loadDetail();
              this.notifyListRefresh();
            } catch (error) {
              formatAppLog("error", "at pages/merchant-audit/detail.vue:296", "同意商家入驻失败", error);
              uni.showToast({ title: this.getErrorMessage(error) || "审核失败", icon: "none" });
            } finally {
              this.submitting = false;
            }
          }
        });
      },
      async handleReject() {
        if (!this.canShowActionBar || this.submitting) {
          return;
        }
        const reason = safeText$2(this.rejectReason);
        if (!reason) {
          uni.showToast({ title: "请填写驳回原因", icon: "none" });
          return;
        }
        this.submitting = true;
        try {
          await rejectTownMerchantApplication(this.applicationId, { reject_reason: reason });
          uni.showToast({ title: "已驳回", icon: "success" });
          this.showRejectDialog = false;
          await this.loadDetail();
          this.notifyListRefresh();
        } catch (error) {
          formatAppLog("error", "at pages/merchant-audit/detail.vue:321", "驳回商家入驻失败", error);
          uni.showToast({ title: this.getErrorMessage(error) || "驳回失败", icon: "none" });
        } finally {
          this.submitting = false;
        }
      },
      notifyListRefresh() {
        const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
        const listPage = pages.find((page) => {
          var _a, _b;
          const route = (page == null ? void 0 : page.route) || ((_a = page == null ? void 0 : page.$page) == null ? void 0 : _a.fullPath) || ((_b = page == null ? void 0 : page.$page) == null ? void 0 : _b.route) || "";
          return String(route).includes("pages/merchant-audit/index");
        });
        const vm = (listPage == null ? void 0 : listPage.$vm) || listPage;
        if (vm && typeof vm.reloadList === "function") {
          vm.reloadList();
        }
      },
      getErrorMessage(error) {
        var _a, _b, _c, _d, _e, _f;
        return (error == null ? void 0 : error.message) ?? (error == null ? void 0 : error.msg) ?? ((_a = error == null ? void 0 : error.data) == null ? void 0 : _a.message) ?? ((_b = error == null ? void 0 : error.data) == null ? void 0 : _b.msg) ?? ((_d = (_c = error == null ? void 0 : error.response) == null ? void 0 : _c.data) == null ? void 0 : _d.message) ?? ((_f = (_e = error == null ? void 0 : error.response) == null ? void 0 : _e.data) == null ? void 0 : _f.msg) ?? "";
      }
    }
  };
  function _sfc_render$4(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      $data.loading && !$data.application.id ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "state-wrap"
      }, [
        vue.createElementVNode("text", { class: "state-text" }, "加载中...")
      ])) : (vue.openBlock(), vue.createElementBlock(
        vue.Fragment,
        { key: 1 },
        [
          vue.createElementVNode("view", { class: "card" }, [
            vue.createElementVNode("text", { class: "section-title" }, "申请信息"),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "商家名称"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.merchantName || "未提供"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "申请状态"),
              vue.createElementVNode(
                "text",
                {
                  class: vue.normalizeClass(["value status-text", $data.statusClassMap[$data.application.statusKey] || "status-pending"])
                },
                vue.toDisplayString($data.application.statusText),
                3
                /* TEXT, CLASS */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "所属乡镇"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.townName || "未标注乡镇"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "提交时间"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($options.formatTime($data.application.submittedAt) || "未提供"),
                1
                /* TEXT */
              )
            ])
          ]),
          vue.createElementVNode("view", { class: "card" }, [
            vue.createElementVNode("text", { class: "section-title" }, "联系信息"),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "联系人"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.contactName || "未提供"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "联系电话"),
              vue.createElementVNode(
                "text",
                {
                  class: "value phone-value",
                  onClick: _cache[0] || (_cache[0] = ($event) => $options.callPhone($data.application.contactPhone))
                },
                vue.toDisplayString($data.application.contactPhone || "未提供"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "申请地址"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.address || "未提供"),
                1
                /* TEXT */
              )
            ])
          ]),
          $data.application.remark || $data.application.businessScope || $data.application.licenseNo ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "card"
          }, [
            vue.createElementVNode("text", { class: "section-title" }, "补充信息"),
            $data.application.businessScope ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "经营范围"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.businessScope),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.licenseNo ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "执照编号"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.licenseNo),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.remark ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 2,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "申请备注"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.remark),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true)
          ])) : vue.createCommentVNode("v-if", true),
          vue.createElementVNode("view", { class: "card" }, [
            vue.createElementVNode("text", { class: "section-title" }, "审核信息"),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "可否审核"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.canAudit ? "可审核" : "不可审核"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "锁定状态"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.auditLocked ? "已锁定" : "未锁定"),
                1
                /* TEXT */
              )
            ]),
            $data.application.auditLockedReason ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "锁定原因"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.auditLockedReason),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.auditedByName ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "审核人"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.auditedByName),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.auditedByRole ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 2,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "审核角色"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.auditedByRole),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.auditedAt ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 3,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "审核时间"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($options.formatTime($data.application.auditedAt)),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.rejectReason ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 4,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "驳回原因"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.rejectReason),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true)
          ])
        ],
        64
        /* STABLE_FRAGMENT */
      )),
      $options.canShowActionBar ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "action-bar"
      }, [
        vue.createElementVNode("button", {
          class: "btn btn-reject",
          disabled: $data.submitting,
          onClick: _cache[1] || (_cache[1] = (...args) => $options.openRejectDialog && $options.openRejectDialog(...args))
        }, " 驳回 ", 8, ["disabled"]),
        vue.createElementVNode("button", {
          class: "btn btn-approve",
          disabled: $data.submitting,
          onClick: _cache[2] || (_cache[2] = (...args) => $options.handleApprove && $options.handleApprove(...args))
        }, vue.toDisplayString($data.submitting ? "提交中" : "同意入驻"), 9, ["disabled"])
      ])) : vue.createCommentVNode("v-if", true),
      $data.showRejectDialog ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 3,
        class: "dialog-wrap"
      }, [
        vue.createElementVNode("view", {
          class: "dialog-mask",
          onClick: _cache[3] || (_cache[3] = (...args) => $options.closeRejectDialog && $options.closeRejectDialog(...args))
        }),
        vue.createElementVNode("view", { class: "dialog-card" }, [
          vue.createElementVNode("text", { class: "dialog-title" }, "填写驳回原因"),
          vue.withDirectives(vue.createElementVNode(
            "textarea",
            {
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.rejectReason = $event),
              class: "dialog-textarea",
              maxlength: "200",
              placeholder: "请填写驳回原因，商家与后台都会看到"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.rejectReason]
          ]),
          vue.createElementVNode("view", { class: "dialog-actions" }, [
            vue.createElementVNode("button", {
              class: "dialog-btn dialog-cancel",
              disabled: $data.submitting,
              onClick: _cache[5] || (_cache[5] = (...args) => $options.closeRejectDialog && $options.closeRejectDialog(...args))
            }, "取消", 8, ["disabled"]),
            vue.createElementVNode("button", {
              class: "dialog-btn dialog-confirm",
              disabled: $data.submitting,
              onClick: _cache[6] || (_cache[6] = (...args) => $options.handleReject && $options.handleReject(...args))
            }, vue.toDisplayString($data.submitting ? "提交中" : "确认驳回"), 9, ["disabled"])
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesMerchantAuditDetail = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render$4], ["__scopeId", "data-v-bc172432"], ["__file", "E:/固始县外卖骑手端/pages/merchant-audit/detail.vue"]]);
  function pickList(payload) {
    if (Array.isArray(payload))
      return payload;
    if (Array.isArray(payload == null ? void 0 : payload.list))
      return payload.list;
    if (Array.isArray(payload == null ? void 0 : payload.rows))
      return payload.rows;
    if (Array.isArray(payload == null ? void 0 : payload.data))
      return payload.data;
    return [];
  }
  function safeText$1(value2) {
    if (value2 === void 0 || value2 === null) {
      return "";
    }
    return String(value2).trim();
  }
  function toBoolean$1(value2) {
    return value2 === true || value2 === 1 || value2 === "1" || value2 === "true";
  }
  function normalizeStatusKey$1(item = {}) {
    const raw = safeText$1(item.apply_status || item.status || item.audit_status || item.rider_audit_status).toLowerCase();
    if (raw === "1" || raw === "approved" || raw === "pass" || raw === "passed" || raw === "success")
      return "approved";
    if (raw === "2" || raw === "rejected" || raw === "reject" || raw === "failed")
      return "rejected";
    if (raw === "all")
      return "all";
    return "pending";
  }
  function normalizeStatusText$1(item = {}, statusKey = "pending") {
    const text = safeText$1(item.apply_status_text || item.status_text || item.audit_status_text);
    if (text)
      return text;
    if (statusKey === "approved")
      return "已通过";
    if (statusKey === "rejected")
      return "已驳回";
    return "待审核";
  }
  function normalizeRiderKindText$1(item = {}) {
    const riderKind = safeText$1(item.rider_kind || item.riderKind).toLowerCase();
    if (riderKind === "stationmaster") {
      return "乡镇站长";
    }
    if (safeText$1(item.delivery_scope || item.deliveryScope).toLowerCase() === "town_delivery") {
      return "乡镇骑手";
    }
    return "骑手";
  }
  function normalizeApplication$1(item = {}) {
    const statusKey = normalizeStatusKey$1(item);
    return {
      id: item.id || item.application_id || item.apply_id || item.user_id || "",
      riderName: safeText$1(item.nickname || item.real_name || item.name || item.username),
      phone: safeText$1(item.phone || item.mobile),
      townName: safeText$1(item.town_name || item.target_town_name || item.service_town_name),
      riderKindText: normalizeRiderKindText$1(item),
      statusKey,
      statusText: normalizeStatusText$1(item, statusKey),
      submittedAt: item.submitted_at || item.created_at || item.apply_time || "",
      auditedAt: item.audited_at || item.audit_time || item.updated_at || "",
      auditedByName: safeText$1(item.audited_by_name || item.audit_user_name || item.auditor_name),
      lockedReason: safeText$1(item.audit_locked_reason || item.audit_locked_msg || item.locked_reason),
      canAudit: toBoolean$1(item.can_stationmaster_audit || item.can_audit)
    };
  }
  function extractTotal(payload, fallbackLength = 0) {
    var _a, _b;
    const maybeTotal = Number(
      (payload == null ? void 0 : payload.total) ?? (payload == null ? void 0 : payload.count) ?? ((_a = payload == null ? void 0 : payload.meta) == null ? void 0 : _a.total) ?? ((_b = payload == null ? void 0 : payload.pagination) == null ? void 0 : _b.total) ?? fallbackLength
    );
    return Number.isFinite(maybeTotal) ? maybeTotal : fallbackLength;
  }
  function extractSummaryCount(payload, key, fallback = 0) {
    var _a, _b;
    const maybeCount = Number(
      ((_a = payload == null ? void 0 : payload.summary) == null ? void 0 : _a[key]) ?? ((_b = payload == null ? void 0 : payload.stats) == null ? void 0 : _b[key]) ?? (payload == null ? void 0 : payload[key]) ?? fallback
    );
    return Number.isFinite(maybeCount) ? maybeCount : fallback;
  }
  const _sfc_main$4 = {
    data() {
      return {
        hasPageAccess: false,
        loading: false,
        refreshing: false,
        loadingMore: false,
        page: 1,
        pageSize: 10,
        hasMore: true,
        currentStatus: "pending",
        applications: [],
        statusTabs: [
          { key: "pending", label: "待审核", count: 0 },
          { key: "approved", label: "已通过", count: 0 },
          { key: "rejected", label: "已驳回", count: 0 }
        ],
        statusClassMap: {
          pending: "status-pending",
          approved: "status-approved",
          rejected: "status-rejected"
        }
      };
    },
    onLoad() {
      this.hasPageAccess = this.ensurePageAccess();
    },
    onShow() {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      this.reloadList();
    },
    methods: {
      formatTime,
      ensurePageAccess() {
        const user = getUserInfo$1() || {};
        if (isTownStationmaster(user)) {
          return true;
        }
        uni.showToast({ title: "仅乡镇站长可进入", icon: "none" });
        if (typeof uni.navigateBack === "function") {
          uni.navigateBack({
            fail: () => {
              uni.switchTab({ url: "/pages/index/index" });
            }
          });
        }
        return false;
      },
      async reloadList() {
        this.page = 1;
        this.hasMore = true;
        await this.loadApplications(true);
      },
      getQueryStatus() {
        return this.currentStatus;
      },
      async loadApplications(replace = false) {
        if (!this.hasPageAccess) {
          return;
        }
        if (replace) {
          this.loading = true;
        } else {
          this.loadingMore = true;
        }
        try {
          const params = {
            status: this.getQueryStatus(),
            page: this.page,
            page_size: this.pageSize
          };
          const res = await getTownRiderApplications(params);
          const payload = (res == null ? void 0 : res.data) ?? res ?? {};
          const source = pickList(payload);
          const normalized = source.map(normalizeApplication$1).filter((item) => item.id);
          if (replace) {
            this.applications = normalized;
          } else {
            this.applications = this.applications.concat(normalized);
          }
          const total = extractTotal(payload, normalized.length);
          const currentLength = replace ? normalized.length : this.applications.length;
          this.hasMore = currentLength < total && normalized.length >= this.pageSize;
          this.updateTabCounts(payload, source);
        } catch (error) {
          formatAppLog("error", "at pages/rider-audit/index.vue:262", "加载骑手申请失败", error);
          if (replace) {
            this.applications = [];
          }
        } finally {
          this.loading = false;
          this.refreshing = false;
          this.loadingMore = false;
          uni.stopPullDownRefresh();
        }
      },
      updateTabCounts(payload = {}, source = []) {
        const pendingCount = extractSummaryCount(
          payload,
          "pending_count",
          source.filter((item) => normalizeStatusKey$1(item) === "pending").length
        );
        const approvedCount = extractSummaryCount(
          payload,
          "approved_count",
          source.filter((item) => normalizeStatusKey$1(item) === "approved").length
        );
        const rejectedCount = extractSummaryCount(
          payload,
          "rejected_count",
          source.filter((item) => normalizeStatusKey$1(item) === "rejected").length
        );
        this.statusTabs = [
          { key: "pending", label: "待审核", count: pendingCount },
          { key: "approved", label: "已通过", count: approvedCount },
          { key: "rejected", label: "已驳回", count: rejectedCount }
        ];
      },
      buildAuditSummary(item = {}) {
        if (item.lockedReason) {
          return item.lockedReason;
        }
        const pieces = [];
        if (item.auditedByName) {
          pieces.push(`审核人：${item.auditedByName}`);
        }
        if (item.auditedAt) {
          pieces.push(`审核时间：${this.formatTime(item.auditedAt)}`);
        }
        return pieces.join(" · ");
      },
      switchStatus(status) {
        if (this.currentStatus === status) {
          return;
        }
        this.currentStatus = status;
        this.reloadList();
      },
      getEmptyTip() {
        if (this.currentStatus === "approved") {
          return "当前乡镇暂无已通过的骑手申请";
        }
        if (this.currentStatus === "rejected") {
          return "当前乡镇暂无已驳回的骑手申请";
        }
        return "当前乡镇暂无待审核的骑手申请";
      },
      onRefresh() {
        this.refreshing = true;
        this.reloadList();
      },
      loadMore() {
        if (!this.hasMore || this.loadingMore || this.loading) {
          return;
        }
        this.page += 1;
        this.loadApplications(false);
      },
      openDetail(item = {}) {
        uni.navigateTo({
          url: `/pages/rider-audit/detail?id=${item.id}`
        });
      }
    }
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "page-header" }, [
        vue.createElementVNode("text", { class: "page-title" }, "骑手审核"),
        vue.createElementVNode("text", { class: "page-tip" }, "仅允许审核当前乡镇的骑手注册申请")
      ]),
      vue.createElementVNode("view", { class: "status-tabs" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.statusTabs, (item) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: item.key,
              class: vue.normalizeClass(["tab-item", { active: $data.currentStatus === item.key }]),
              onClick: ($event) => $options.switchStatus(item.key)
            }, [
              vue.createElementVNode(
                "text",
                { class: "tab-text" },
                vue.toDisplayString(item.label),
                1
                /* TEXT */
              ),
              item.count > 0 ? (vue.openBlock(), vue.createElementBlock(
                "text",
                {
                  key: 0,
                  class: "tab-badge"
                },
                vue.toDisplayString(item.count > 99 ? "99+" : item.count),
                1
                /* TEXT */
              )) : vue.createCommentVNode("v-if", true)
            ], 10, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      vue.createElementVNode("scroll-view", {
        "scroll-y": "",
        class: "list-scroll",
        "refresher-enabled": true,
        "refresher-triggered": $data.refreshing,
        onRefresherrefresh: _cache[0] || (_cache[0] = (...args) => $options.onRefresh && $options.onRefresh(...args)),
        onScrolltolower: _cache[1] || (_cache[1] = (...args) => $options.loadMore && $options.loadMore(...args))
      }, [
        $data.loading && $data.applications.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "state-wrap"
        }, [
          vue.createElementVNode("text", { class: "state-text" }, "加载中...")
        ])) : $data.applications.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "state-wrap"
        }, [
          vue.createElementVNode("text", { class: "state-text" }, "暂无骑手申请"),
          vue.createElementVNode(
            "text",
            { class: "state-tip" },
            vue.toDisplayString($options.getEmptyTip()),
            1
            /* TEXT */
          )
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "card-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.applications, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.id,
                class: "rider-card",
                onClick: ($event) => $options.openDetail(item)
              }, [
                vue.createElementVNode("view", { class: "card-top" }, [
                  vue.createElementVNode("view", { class: "rider-meta" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "rider-name" },
                      vue.toDisplayString(item.riderName),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "town-name" },
                      vue.toDisplayString(item.townName || "未标注乡镇"),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode(
                    "text",
                    {
                      class: vue.normalizeClass(["status-tag", $data.statusClassMap[item.statusKey] || "status-pending"])
                    },
                    vue.toDisplayString(item.statusText),
                    3
                    /* TEXT, CLASS */
                  )
                ]),
                vue.createElementVNode("view", { class: "info-row" }, [
                  vue.createElementVNode("text", { class: "info-label" }, "手机号"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-value" },
                    vue.toDisplayString(item.phone || "未提供"),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "info-row" }, [
                  vue.createElementVNode("text", { class: "info-label" }, "账号类型"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-value" },
                    vue.toDisplayString(item.riderKindText),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "info-row" }, [
                  vue.createElementVNode("text", { class: "info-label" }, "提交时间"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-value" },
                    vue.toDisplayString($options.formatTime(item.submittedAt) || "未提供"),
                    1
                    /* TEXT */
                  )
                ]),
                item.auditedByName || item.auditedAt || item.lockedReason ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 0,
                  class: "audit-summary"
                }, [
                  vue.createElementVNode(
                    "text",
                    { class: "audit-summary-text" },
                    vue.toDisplayString($options.buildAuditSummary(item)),
                    1
                    /* TEXT */
                  )
                ])) : vue.createCommentVNode("v-if", true)
              ], 8, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])),
        $data.loadingMore ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 3,
          class: "load-more"
        }, [
          vue.createElementVNode("text", null, "加载中...")
        ])) : $data.applications.length > 0 && !$data.hasMore ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 4,
          class: "load-more"
        }, [
          vue.createElementVNode("text", null, "没有更多了")
        ])) : vue.createCommentVNode("v-if", true)
      ], 40, ["refresher-triggered"])
    ]);
  }
  const PagesRiderAuditIndex = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__scopeId", "data-v-c49b62eb"], ["__file", "E:/固始县外卖骑手端/pages/rider-audit/index.vue"]]);
  function safeText(value2) {
    if (value2 === void 0 || value2 === null) {
      return "";
    }
    return String(value2).trim();
  }
  function toBoolean(value2) {
    return value2 === true || value2 === 1 || value2 === "1" || value2 === "true";
  }
  function normalizeStatusKey(item = {}) {
    const raw = safeText(item.apply_status || item.status || item.audit_status || item.rider_audit_status).toLowerCase();
    if (raw === "1" || raw === "approved" || raw === "pass" || raw === "passed" || raw === "success")
      return "approved";
    if (raw === "2" || raw === "rejected" || raw === "reject" || raw === "failed")
      return "rejected";
    return "pending";
  }
  function normalizeStatusText(item = {}, statusKey = "pending") {
    const text = safeText(item.apply_status_text || item.status_text || item.audit_status_text);
    if (text)
      return text;
    if (statusKey === "approved")
      return "已通过";
    if (statusKey === "rejected")
      return "已驳回";
    return "待审核";
  }
  function normalizeRiderKindText(item = {}) {
    const riderKind = safeText(item.rider_kind || item.riderKind).toLowerCase();
    if (riderKind === "stationmaster") {
      return "乡镇站长";
    }
    if (safeText(item.delivery_scope || item.deliveryScope).toLowerCase() === "town_delivery") {
      return "乡镇骑手";
    }
    return "骑手";
  }
  function normalizeApplication(item = {}) {
    const statusKey = normalizeStatusKey(item);
    return {
      id: item.id || item.application_id || item.apply_id || item.user_id || "",
      riderName: safeText(item.nickname || item.real_name || item.name || item.username),
      username: safeText(item.username || item.account),
      phone: safeText(item.phone || item.mobile),
      townName: safeText(item.town_name || item.target_town_name || item.service_town_name),
      riderKindText: normalizeRiderKindText(item),
      statusKey,
      statusText: normalizeStatusText(item, statusKey),
      submittedAt: item.submitted_at || item.created_at || item.apply_time || "",
      auditedAt: item.audited_at || item.audit_time || item.updated_at || "",
      auditedByRole: safeText(item.audited_by_role || item.audit_role),
      auditedByName: safeText(item.audited_by_name || item.audit_user_name || item.auditor_name),
      rejectReason: safeText(item.reject_reason || item.audit_reject_reason || item.refuse_reason),
      auditLocked: toBoolean(item.audit_locked),
      auditLockedReason: safeText(item.audit_locked_reason || item.audit_locked_msg || item.locked_reason),
      canAudit: toBoolean(item.can_stationmaster_audit || item.can_audit),
      remark: safeText(item.remark || item.apply_remark || item.description),
      idCardNo: safeText(item.id_card_no || item.idCardNo),
      vehicleInfo: safeText(item.vehicle_info || item.vehicleInfo)
    };
  }
  const _sfc_main$3 = {
    data() {
      return {
        hasPageAccess: false,
        loading: false,
        submitting: false,
        showRejectDialog: false,
        rejectReason: "",
        applicationId: "",
        application: {},
        statusClassMap: {
          pending: "status-pending",
          approved: "status-approved",
          rejected: "status-rejected"
        }
      };
    },
    computed: {
      canShowActionBar() {
        return this.application.id && this.application.canAudit && !this.application.auditLocked;
      }
    },
    onLoad(options) {
      this.hasPageAccess = this.ensurePageAccess();
      this.applicationId = options.id || "";
    },
    onShow() {
      this.hasPageAccess = this.ensurePageAccess();
      if (!this.hasPageAccess) {
        return;
      }
      this.loadDetail();
    },
    methods: {
      formatTime,
      ensurePageAccess() {
        const user = getUserInfo$1() || {};
        if (isTownStationmaster(user)) {
          return true;
        }
        uni.showToast({ title: "仅乡镇站长可进入", icon: "none" });
        if (typeof uni.navigateBack === "function") {
          uni.navigateBack({
            fail: () => {
              uni.switchTab({ url: "/pages/index/index" });
            }
          });
        }
        return false;
      },
      async loadDetail() {
        if (!this.hasPageAccess || !this.applicationId) {
          return;
        }
        this.loading = true;
        try {
          const res = await getTownRiderApplicationDetail(this.applicationId);
          this.application = normalizeApplication((res == null ? void 0 : res.data) || res || {});
        } catch (error) {
          formatAppLog("error", "at pages/rider-audit/detail.vue:261", "加载骑手申请详情失败", error);
          uni.showToast({ title: this.getErrorMessage(error) || "加载详情失败", icon: "none" });
        } finally {
          this.loading = false;
        }
      },
      callPhone(phone) {
        const value2 = safeText(phone);
        if (!value2) {
          return;
        }
        uni.makePhoneCall({ phoneNumber: value2 });
      },
      openRejectDialog() {
        if (!this.canShowActionBar || this.submitting) {
          return;
        }
        this.rejectReason = "";
        this.showRejectDialog = true;
      },
      closeRejectDialog() {
        if (this.submitting) {
          return;
        }
        this.showRejectDialog = false;
      },
      async handleApprove() {
        if (!this.canShowActionBar || this.submitting) {
          return;
        }
        uni.showModal({
          title: "审核通过",
          content: "确认通过该骑手注册申请？",
          confirmText: "确认通过",
          cancelText: "取消",
          success: async (res) => {
            if (!res.confirm) {
              return;
            }
            this.submitting = true;
            try {
              await approveTownRiderApplication(this.applicationId);
              uni.showToast({ title: "审核通过", icon: "success" });
              await this.loadDetail();
              this.notifyListRefresh();
            } catch (error) {
              formatAppLog("error", "at pages/rider-audit/detail.vue:307", "同意骑手申请失败", error);
              uni.showToast({ title: this.getErrorMessage(error) || "审核失败", icon: "none" });
            } finally {
              this.submitting = false;
            }
          }
        });
      },
      async handleReject() {
        if (!this.canShowActionBar || this.submitting) {
          return;
        }
        const reason = safeText(this.rejectReason);
        if (!reason) {
          uni.showToast({ title: "请填写驳回原因", icon: "none" });
          return;
        }
        this.submitting = true;
        try {
          await rejectTownRiderApplication(this.applicationId, { reject_reason: reason });
          uni.showToast({ title: "已驳回", icon: "success" });
          this.showRejectDialog = false;
          await this.loadDetail();
          this.notifyListRefresh();
        } catch (error) {
          formatAppLog("error", "at pages/rider-audit/detail.vue:332", "驳回骑手申请失败", error);
          uni.showToast({ title: this.getErrorMessage(error) || "驳回失败", icon: "none" });
        } finally {
          this.submitting = false;
        }
      },
      notifyListRefresh() {
        const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
        const listPage = pages.find((page) => {
          var _a, _b;
          const route = (page == null ? void 0 : page.route) || ((_a = page == null ? void 0 : page.$page) == null ? void 0 : _a.fullPath) || ((_b = page == null ? void 0 : page.$page) == null ? void 0 : _b.route) || "";
          return String(route).includes("pages/rider-audit/index");
        });
        const vm = (listPage == null ? void 0 : listPage.$vm) || listPage;
        if (vm && typeof vm.reloadList === "function") {
          vm.reloadList();
        }
      },
      getErrorMessage(error) {
        var _a, _b, _c, _d, _e, _f;
        return (error == null ? void 0 : error.message) ?? (error == null ? void 0 : error.msg) ?? ((_a = error == null ? void 0 : error.data) == null ? void 0 : _a.message) ?? ((_b = error == null ? void 0 : error.data) == null ? void 0 : _b.msg) ?? ((_d = (_c = error == null ? void 0 : error.response) == null ? void 0 : _c.data) == null ? void 0 : _d.message) ?? ((_f = (_e = error == null ? void 0 : error.response) == null ? void 0 : _e.data) == null ? void 0 : _f.msg) ?? "";
      }
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      $data.loading && !$data.application.id ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "state-wrap"
      }, [
        vue.createElementVNode("text", { class: "state-text" }, "加载中...")
      ])) : (vue.openBlock(), vue.createElementBlock(
        vue.Fragment,
        { key: 1 },
        [
          vue.createElementVNode("view", { class: "card" }, [
            vue.createElementVNode("text", { class: "section-title" }, "申请信息"),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "骑手昵称"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.riderName || "未提供"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "申请状态"),
              vue.createElementVNode(
                "text",
                {
                  class: vue.normalizeClass(["value status-text", $data.statusClassMap[$data.application.statusKey] || "status-pending"])
                },
                vue.toDisplayString($data.application.statusText),
                3
                /* TEXT, CLASS */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "账号类型"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.riderKindText),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "所属乡镇"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.townName || "未标注乡镇"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "提交时间"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($options.formatTime($data.application.submittedAt) || "未提供"),
                1
                /* TEXT */
              )
            ])
          ]),
          vue.createElementVNode("view", { class: "card" }, [
            vue.createElementVNode("text", { class: "section-title" }, "联系信息"),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "手机号"),
              vue.createElementVNode(
                "text",
                {
                  class: "value phone-value",
                  onClick: _cache[0] || (_cache[0] = ($event) => $options.callPhone($data.application.phone))
                },
                vue.toDisplayString($data.application.phone || "未提供"),
                1
                /* TEXT */
              )
            ]),
            $data.application.username ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "账号"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.username),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true)
          ]),
          $data.application.remark || $data.application.idCardNo || $data.application.vehicleInfo ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "card"
          }, [
            vue.createElementVNode("text", { class: "section-title" }, "补充信息"),
            $data.application.idCardNo ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "身份证号"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.idCardNo),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.vehicleInfo ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "车辆信息"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.vehicleInfo),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.remark ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 2,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "申请备注"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.remark),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true)
          ])) : vue.createCommentVNode("v-if", true),
          vue.createElementVNode("view", { class: "card" }, [
            vue.createElementVNode("text", { class: "section-title" }, "审核信息"),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "可否审核"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.canAudit ? "可审核" : "不可审核"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "info-row" }, [
              vue.createElementVNode("text", { class: "label" }, "锁定状态"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.auditLocked ? "已锁定" : "未锁定"),
                1
                /* TEXT */
              )
            ]),
            $data.application.auditLockedReason ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "锁定原因"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.auditLockedReason),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.auditedByName ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "审核人"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.auditedByName),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.auditedByRole ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 2,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "审核角色"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($data.application.auditedByRole),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.auditedAt ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 3,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "审核时间"),
              vue.createElementVNode(
                "text",
                { class: "value" },
                vue.toDisplayString($options.formatTime($data.application.auditedAt)),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.application.rejectReason ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 4,
              class: "info-row"
            }, [
              vue.createElementVNode("text", { class: "label" }, "驳回原因"),
              vue.createElementVNode(
                "text",
                { class: "value multiline-value" },
                vue.toDisplayString($data.application.rejectReason),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true)
          ])
        ],
        64
        /* STABLE_FRAGMENT */
      )),
      $options.canShowActionBar ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "action-bar"
      }, [
        vue.createElementVNode("button", {
          class: "btn btn-reject",
          disabled: $data.submitting,
          onClick: _cache[1] || (_cache[1] = (...args) => $options.openRejectDialog && $options.openRejectDialog(...args))
        }, " 驳回 ", 8, ["disabled"]),
        vue.createElementVNode("button", {
          class: "btn btn-approve",
          disabled: $data.submitting,
          onClick: _cache[2] || (_cache[2] = (...args) => $options.handleApprove && $options.handleApprove(...args))
        }, vue.toDisplayString($data.submitting ? "提交中" : "同意通过"), 9, ["disabled"])
      ])) : vue.createCommentVNode("v-if", true),
      $data.showRejectDialog ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 3,
        class: "dialog-wrap"
      }, [
        vue.createElementVNode("view", {
          class: "dialog-mask",
          onClick: _cache[3] || (_cache[3] = (...args) => $options.closeRejectDialog && $options.closeRejectDialog(...args))
        }),
        vue.createElementVNode("view", { class: "dialog-card" }, [
          vue.createElementVNode("text", { class: "dialog-title" }, "填写驳回原因"),
          vue.withDirectives(vue.createElementVNode(
            "textarea",
            {
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.rejectReason = $event),
              class: "dialog-textarea",
              maxlength: "200",
              placeholder: "请填写驳回原因，骑手与后台都会看到"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.rejectReason]
          ]),
          vue.createElementVNode("view", { class: "dialog-actions" }, [
            vue.createElementVNode("button", {
              class: "dialog-btn dialog-cancel",
              disabled: $data.submitting,
              onClick: _cache[5] || (_cache[5] = (...args) => $options.closeRejectDialog && $options.closeRejectDialog(...args))
            }, "取消", 8, ["disabled"]),
            vue.createElementVNode("button", {
              class: "dialog-btn dialog-confirm",
              disabled: $data.submitting,
              onClick: _cache[6] || (_cache[6] = (...args) => $options.handleReject && $options.handleReject(...args))
            }, vue.toDisplayString($data.submitting ? "提交中" : "确认驳回"), 9, ["disabled"])
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesRiderAuditDetail = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__scopeId", "data-v-7eee4710"], ["__file", "E:/固始县外卖骑手端/pages/rider-audit/detail.vue"]]);
  const _sfc_main$2 = {
    data() {
      return {
        userInfo: {},
        balance: "0.00",
        showStationPanel: false,
        stationTown: "",
        reminderSettings: getReminderSettings()
      };
    },
    computed: {
      isTownStationRole() {
        return isTownStationmaster(this.userInfo);
      },
      deliveryScopeLabel() {
        const townName = String(
          this.userInfo.rider_town || this.userInfo.town_name || this.userInfo.customer_town || ""
        ).trim();
        const riderKind = String(this.userInfo.rider_kind || "").trim();
        const deliveryScope = String(this.userInfo.delivery_scope || "").trim();
        if (deliveryScope === "county_delivery") {
          return "县城骑手";
        }
        if (deliveryScope === "town_delivery") {
          if (riderKind === "stationmaster") {
            return townName ? `${townName}站长` : "乡镇站长";
          }
          return townName ? `${townName}骑手` : "乡镇骑手";
        }
        if (isMerchantDeliveryUser(this.userInfo)) {
          return townName ? `${townName}商家自配送员` : "商家自配送员";
        }
        return townName || "未绑定";
      },
      reminderStatusText() {
        return this.reminderSettings.enabled ? "已开启" : "已关闭";
      }
    },
    onLoad() {
      this.loadUserInfo();
    },
    onShow() {
      this.reminderSettings = getReminderSettings();
    },
    methods: {
      async loadUserInfo() {
        const stored = getUserInfo$1();
        if (stored) {
          this.userInfo = stored;
        }
        try {
          const res = await getUserInfo();
          if (res.data) {
            this.userInfo = res.data;
            this.balance = res.data.rider_balance || "0.00";
            this.stationTown = res.data.rider_town || "";
            if (!this.isTownStationRole) {
              this.showStationPanel = false;
            }
          }
        } catch (e) {
          formatAppLog("error", "at pages/profile/index.vue:125", "加载用户信息失败", e);
        }
      },
      async bindTown() {
        if (!this.isTownStationRole) {
          this.showStationPanel = false;
          uni.showToast({ title: "仅乡镇站长可绑定", icon: "none" });
          return;
        }
        const town = String(this.stationTown || "").trim();
        if (!town) {
          uni.showToast({ title: "请填写乡镇名称", icon: "none" });
          return;
        }
        try {
          await bindStationTown(town);
          uni.showToast({ title: "绑定成功", icon: "success" });
          this.loadUserInfo();
        } catch (e) {
          formatAppLog("error", "at pages/profile/index.vue:145", "绑定失败", e);
        }
      },
      goReminderSettings() {
        uni.navigateTo({ url: "/pages/reminder-settings/index" });
      },
      handleLogout() {
        uni.showModal({
          title: "确认退出",
          content: "确定要退出登录吗？",
          success: (res) => {
            if (res.confirm) {
              removeToken();
              removeUserInfo();
              uni.reLaunch({ url: "/pages/login/index" });
            }
          }
        });
      }
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "user-card" }, [
        vue.createElementVNode("view", { class: "avatar-wrap" }, [
          vue.createElementVNode("text", { class: "avatar-text" }, "🛵")
        ]),
        vue.createElementVNode("view", { class: "user-info" }, [
          vue.createElementVNode(
            "text",
            { class: "nickname" },
            vue.toDisplayString($data.userInfo.nickname || "骑手"),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "phone" },
            vue.toDisplayString($data.userInfo.phone || "未绑定"),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "menu-list" }, [
        vue.createElementVNode("view", { class: "menu-item readonly-item" }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "💰"),
          vue.createElementVNode("text", { class: "menu-text" }, "账户余额"),
          vue.createElementVNode(
            "text",
            { class: "menu-value" },
            "¥" + vue.toDisplayString($data.balance),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goReminderSettings && $options.goReminderSettings(...args))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "🔔"),
          vue.createElementVNode("text", { class: "menu-text" }, "提醒设置"),
          vue.createElementVNode(
            "text",
            { class: "menu-value reminder-value" },
            vue.toDisplayString($options.reminderStatusText),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        $options.isTownStationRole ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "menu-item",
          onClick: _cache[1] || (_cache[1] = ($event) => $data.showStationPanel = !$data.showStationPanel)
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "📍"),
          vue.createElementVNode("text", { class: "menu-text" }, "配送范围"),
          vue.createElementVNode(
            "text",
            { class: "menu-value" },
            vue.toDisplayString($options.deliveryScopeLabel),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "menu-item readonly-item"
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "📍"),
          vue.createElementVNode("text", { class: "menu-text" }, "配送范围"),
          vue.createElementVNode(
            "text",
            { class: "menu-value" },
            vue.toDisplayString($options.deliveryScopeLabel),
            1
            /* TEXT */
          )
        ]))
      ]),
      $data.showStationPanel ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "station-panel"
      }, [
        vue.createElementVNode("view", { class: "station-row" }, [
          vue.createElementVNode("text", { class: "station-label" }, "乡镇名称"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "station-input",
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.stationTown = $event),
              placeholder: "例如：陈淋子镇"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.stationTown]
          ])
        ]),
        vue.createElementVNode("button", {
          class: "station-btn",
          onClick: _cache[3] || (_cache[3] = (...args) => $options.bindTown && $options.bindTown(...args))
        }, "绑定为站长"),
        vue.createElementVNode("text", { class: "station-tip" }, "每个乡镇只允许一个站长账号绑定")
      ])) : vue.createCommentVNode("v-if", true),
      vue.createElementVNode("view", {
        class: "logout-btn",
        onClick: _cache[4] || (_cache[4] = (...args) => $options.handleLogout && $options.handleLogout(...args))
      }, [
        vue.createElementVNode("text", { class: "logout-text" }, "退出登录")
      ])
    ]);
  }
  const PagesProfileIndex = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__scopeId", "data-v-201c0da5"], ["__file", "E:/固始县外卖骑手端/pages/profile/index.vue"]]);
  const _sfc_main$1 = {
    data() {
      return {
        settings: getReminderSettings(),
        categoryItems: [
          { key: "newOrder", title: "新派单", desc: "县城调度派单、乡镇新配送任务" },
          { key: "transfer", title: "转派/改派", desc: "转派到你、改派更新、转单链路变化" },
          { key: "cancel", title: "订单取消", desc: "配送中或待处理订单被取消时提醒" },
          { key: "timeout", title: "即将超时", desc: "仅在后端给出明确剩余秒数或超时点时提醒" },
          { key: "pickupReady", title: "商家已出餐", desc: "订单进入备货完成，可立即去取餐" },
          { key: "stationNotice", title: "站长/调度通知", desc: "乡镇消息、站长通知、调度通知统一走这里" },
          { key: "navigation", title: "导航关键提醒", desc: "导航中临近到店、临近送达提醒" }
        ]
      };
    },
    methods: {
      saveSettings(patch = {}) {
        this.settings = updateReminderSettings(patch);
        notifyReminderSettingsChanged();
      },
      toggleRoot(key, event) {
        this.saveSettings({ [key]: !!event.detail.value });
      },
      toggleCategory(key, event) {
        this.saveSettings({
          categories: {
            [key]: !!event.detail.value
          }
        });
      },
      handleReset() {
        uni.showModal({
          title: "恢复默认",
          content: "确认恢复默认提醒设置吗？",
          success: (res) => {
            if (!res.confirm) {
              return;
            }
            this.settings = resetReminderSettings();
            notifyReminderSettingsChanged();
            uni.showToast({ title: "已恢复默认", icon: "success" });
          }
        });
      }
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "section-title" }, "统一提醒总开关"),
        vue.createElementVNode("view", { class: "setting-row" }, [
          vue.createElementVNode("view", { class: "setting-text" }, [
            vue.createElementVNode("text", { class: "setting-name" }, "启用提醒中心"),
            vue.createElementVNode("text", { class: "setting-desc" }, "统一管理新派单、转派、取消、超时、出餐和站长通知")
          ]),
          vue.createElementVNode("switch", {
            checked: $data.settings.enabled,
            color: "#1890FF",
            onChange: _cache[0] || (_cache[0] = ($event) => $options.toggleRoot("enabled", $event))
          }, null, 40, ["checked"])
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "section-title" }, "提醒方式"),
        vue.createElementVNode("view", { class: "setting-row" }, [
          vue.createElementVNode("view", { class: "setting-text" }, [
            vue.createElementVNode("text", { class: "setting-name" }, "语音播报"),
            vue.createElementVNode("text", { class: "setting-desc" }, "前台在线时使用语音播报订单与通知内容")
          ]),
          vue.createElementVNode("switch", {
            checked: $data.settings.voiceEnabled,
            color: "#1890FF",
            disabled: !$data.settings.enabled,
            onChange: _cache[1] || (_cache[1] = ($event) => $options.toggleRoot("voiceEnabled", $event))
          }, null, 40, ["checked", "disabled"])
        ]),
        vue.createElementVNode("view", { class: "setting-row" }, [
          vue.createElementVNode("view", { class: "setting-text" }, [
            vue.createElementVNode("text", { class: "setting-name" }, "提示音"),
            vue.createElementVNode("text", { class: "setting-desc" }, "前台在线时先响提示音，再播报语音")
          ]),
          vue.createElementVNode("switch", {
            checked: $data.settings.soundEnabled,
            color: "#1890FF",
            disabled: !$data.settings.enabled,
            onChange: _cache[2] || (_cache[2] = ($event) => $options.toggleRoot("soundEnabled", $event))
          }, null, 40, ["checked", "disabled"])
        ]),
        vue.createElementVNode("view", { class: "setting-row" }, [
          vue.createElementVNode("view", { class: "setting-text" }, [
            vue.createElementVNode("text", { class: "setting-name" }, "震动提醒"),
            vue.createElementVNode("text", { class: "setting-desc" }, "前台在线时配合短震动，避免只听声音漏单")
          ]),
          vue.createElementVNode("switch", {
            checked: $data.settings.vibrationEnabled,
            color: "#1890FF",
            disabled: !$data.settings.enabled,
            onChange: _cache[3] || (_cache[3] = ($event) => $options.toggleRoot("vibrationEnabled", $event))
          }, null, 40, ["checked", "disabled"])
        ]),
        vue.createElementVNode("view", { class: "setting-row" }, [
          vue.createElementVNode("view", { class: "setting-text" }, [
            vue.createElementVNode("text", { class: "setting-name" }, "后台系统通知"),
            vue.createElementVNode("text", { class: "setting-desc" }, "APP 进入后台或息屏后，优先走本地系统通知栏提醒")
          ]),
          vue.createElementVNode("switch", {
            checked: $data.settings.systemNotificationEnabled,
            color: "#1890FF",
            disabled: !$data.settings.enabled,
            onChange: _cache[4] || (_cache[4] = ($event) => $options.toggleRoot("systemNotificationEnabled", $event))
          }, null, 40, ["checked", "disabled"])
        ]),
        vue.createElementVNode("view", { class: "setting-row" }, [
          vue.createElementVNode("view", { class: "setting-text" }, [
            vue.createElementVNode("text", { class: "setting-name" }, "导航关键提醒"),
            vue.createElementVNode("text", { class: "setting-desc" }, "导航页可选播报临近到店、临近送达提醒，默认关闭")
          ]),
          vue.createElementVNode("switch", {
            checked: $data.settings.navigationVoiceEnabled,
            color: "#1890FF",
            disabled: !$data.settings.enabled,
            onChange: _cache[5] || (_cache[5] = ($event) => $options.toggleRoot("navigationVoiceEnabled", $event))
          }, null, 40, ["checked", "disabled"])
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "section-title" }, "提醒类型"),
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.categoryItems, (item) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              class: "setting-row",
              key: item.key
            }, [
              vue.createElementVNode("view", { class: "setting-text" }, [
                vue.createElementVNode(
                  "text",
                  { class: "setting-name" },
                  vue.toDisplayString(item.title),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "setting-desc" },
                  vue.toDisplayString(item.desc),
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode("switch", {
                checked: $data.settings.categories[item.key],
                color: "#1890FF",
                disabled: !$data.settings.enabled || item.key === "navigation" && !$data.settings.navigationVoiceEnabled,
                onChange: ($event) => $options.toggleCategory(item.key, $event)
              }, null, 40, ["checked", "disabled", "onChange"])
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      vue.createElementVNode("view", { class: "card tips-card" }, [
        vue.createElementVNode("view", { class: "section-title" }, "系统边界说明"),
        vue.createElementVNode("text", { class: "tip-line" }, "前台在线：语音 + 提示音 + 震动可以完整生效。"),
        vue.createElementVNode("text", { class: "tip-line" }, "后台/息屏：当前前端已补本地系统通知，但若系统已挂起或杀掉进程，仍需要后端真正的 push 才能稳定唤醒。"),
        vue.createElementVNode("text", { class: "tip-line" }, "超时提醒：只有后端返回明确超时剩余时间或超时时间字段时，系统才会播报，不会前端瞎猜。")
      ]),
      vue.createElementVNode("button", {
        class: "reset-btn",
        onClick: _cache[6] || (_cache[6] = (...args) => $options.handleReset && $options.handleReset(...args))
      }, "恢复默认设置")
    ]);
  }
  const PagesReminderSettingsIndex = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-7a97bdd7"], ["__file", "E:/固始县外卖骑手端/pages/reminder-settings/index.vue"]]);
  __definePage("pages/login/index", PagesLoginIndex);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/orders/index", PagesOrdersIndex);
  __definePage("pages/orders/detail", PagesOrdersDetail);
  __definePage("pages/map/nav", PagesMapNav);
  __definePage("pages/errands/index", PagesErrandsIndex);
  __definePage("pages/errands/detail", PagesErrandsDetail);
  __definePage("pages/today-orders/index", PagesTodayOrdersIndex);
  __definePage("pages/station-messages/index", PagesStationMessagesIndex);
  __definePage("pages/station-messages/detail", PagesStationMessagesDetail);
  __definePage("pages/merchant-audit/index", PagesMerchantAuditIndex);
  __definePage("pages/merchant-audit/detail", PagesMerchantAuditDetail);
  __definePage("pages/rider-audit/index", PagesRiderAuditIndex);
  __definePage("pages/rider-audit/detail", PagesRiderAuditDetail);
  __definePage("pages/profile/index", PagesProfileIndex);
  __definePage("pages/reminder-settings/index", PagesReminderSettingsIndex);
  let locationTimer = null;
  let locationPermissionPrompted = false;
  let lastLocationSample = null;
  let locationReportInFlight = false;
  let navigationLocationReportingActive = false;
  let gcj02Unsupported = false;
  let locationHintToastUntil = 0;
  let sessionValidationPromise = null;
  let validatedSessionToken = "";
  let validatedSessionUserId = "";
  let validatedSessionUser = null;
  function reportSessionDebug(hypothesisId, location2, msg, data = {}) {
    {
      return;
    }
  }
  function reportLocationDebug(hypothesisId, location2, msg, data = {}) {
    {
      return;
    }
  }
  function canReportDispatchLocation(userInfo = {}) {
    return canReportDispatchLocationByProfile(userInfo);
  }
  function shouldPauseBackgroundLocationReport(userInfo = {}, navigationActive = false) {
    if (!navigationActive) {
      return false;
    }
    return !isCountyRider(userInfo);
  }
  function normalizeRoute(route = "") {
    if (!route) {
      return "";
    }
    return route.startsWith("/") ? route : `/${route}`;
  }
  function getUserId(userInfo = {}) {
    const rawId = userInfo.id ?? userInfo.user_id ?? userInfo.userId ?? "";
    return rawId === null || typeof rawId === "undefined" ? "" : String(rawId);
  }
  function requestUniLocation(type = "wgs84", extraOptions = {}) {
    return new Promise((resolve, reject) => {
      uni.getLocation({
        type,
        isHighAccuracy: true,
        highAccuracyExpireTime: 1e4,
        geocode: false,
        ...extraOptions,
        success: (res) => resolve(res),
        fail: (err) => reject(err)
      });
    });
  }
  function isGcj02NotSupportedError(error) {
    const errMsg = String((error == null ? void 0 : error.errMsg) || (error == null ? void 0 : error.message) || "");
    return errMsg.includes("not support gcj02");
  }
  function normalizeReportLocation(res, requestTs, coordinateType = "gcj02", source = coordinateType) {
    const latitude = Number(res == null ? void 0 : res.latitude);
    const longitude = Number(res == null ? void 0 : res.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    let normalizedLng = longitude;
    let normalizedLat = latitude;
    if (coordinateType === "wgs84") {
      const converted = wgs84ToGcj02(longitude, latitude);
      normalizedLng = converted.lng;
      normalizedLat = converted.lat;
    }
    if (!Number.isFinite(normalizedLat) || !Number.isFinite(normalizedLng)) {
      return null;
    }
    return {
      latitude: normalizedLat,
      longitude: normalizedLng,
      accuracy: Number.isFinite(Number(res == null ? void 0 : res.accuracy)) ? Number(res.accuracy) : null,
      altitude: Number.isFinite(Number(res == null ? void 0 : res.altitude)) ? Number(res.altitude) : null,
      speed: Number.isFinite(Number(res == null ? void 0 : res.speed)) ? Number(res.speed) : null,
      provider: (res == null ? void 0 : res.provider) || (res == null ? void 0 : res.verticalAccuracy) || source || "unknown",
      ts: requestTs,
      locationSource: source
    };
  }
  function isNearlySameLocation(current = {}, previous = {}) {
    const latDiff = Math.abs(Number(current.latitude || 0) - Number(previous.latitude || 0));
    const lngDiff = Math.abs(Number(current.longitude || 0) - Number(previous.longitude || 0));
    return latDiff + lngDiff <= 1e-5;
  }
  function buildLocationFailureMeta(error) {
    const errMsg = String((error == null ? void 0 : error.errMsg) || (error == null ? void 0 : error.message) || "");
    const lower = errMsg.toLowerCase();
    if (lower.includes("position retrieval timed out") || lower.includes("timeout")) {
      return {
        type: "timeout",
        text: "定位超时",
        detail: "手机长时间没有拿到 GPS 位置，未执行位置上报"
      };
    }
    if (lower.includes("auth deny") || lower.includes("authorize no response") || lower.includes("auth denied")) {
      return {
        type: "permission",
        text: "定位权限未开启",
        detail: "需要开启定位权限，县城司机才能出现在调度地图"
      };
    }
    if (lower.includes("system permission denied") || lower.includes("location service is disabled") || lower.includes("system location")) {
      return {
        type: "service_disabled",
        text: "系统定位未开启",
        detail: "手机系统定位服务未开启，未执行位置上报"
      };
    }
    return {
      type: "unknown",
      text: "定位失败",
      detail: errMsg || "未知原因，未执行位置上报"
    };
  }
  const _sfc_main = {
    globalData: {},
    onLaunch() {
      formatAppLog("log", "at App.vue:188", "App Launch - 骑手端启动");
      reportSessionDebug("B", "App.vue:157", "app launch lifecycle entered", {
        hasToken: !!getToken(),
        hasUserInfo: !!getUserInfo$1(),
        currentRoute: this.getCurrentRoutePath()
      });
      initReminderCenter();
      this.registerGlobalActions();
      setReminderAppVisibility(true);
      this.handleAppVisible("launch");
    },
    onShow() {
      formatAppLog("log", "at App.vue:200", "App Show - 骑手端显示");
      reportSessionDebug("B", "App.vue:164", "app show lifecycle entered", {
        hasToken: !!getToken(),
        hasUserInfo: !!getUserInfo$1(),
        currentRoute: this.getCurrentRoutePath()
      });
      this.registerGlobalActions();
      setReminderAppVisibility(true);
      this.handleAppVisible("show");
    },
    onHide() {
      formatAppLog("log", "at App.vue:211", "App Hide - 骑手端隐藏");
      reportSessionDebug("B", "App.vue:170", "app hide lifecycle entered", {
        hasToken: !!getToken(),
        hasUserInfo: !!getUserInfo$1(),
        currentRoute: this.getCurrentRoutePath()
      });
      setReminderAppVisibility(false);
      this.stopLocationReport();
    },
    methods: {
      registerGlobalActions() {
        if (!this.globalData) {
          this.globalData = {};
        }
        this.globalData.latestRiderLocation = lastLocationSample ? { ...lastLocationSample } : null;
        this.globalData.refreshRiderSession = async (forceValidation = false) => {
          return this.refreshBackgroundJobs(forceValidation, "external");
        };
        this.globalData.clearRiderSessionState = () => {
          this.resetValidatedSession("登录态已清理");
          this.stopAllBackgroundJobs();
        };
        this.globalData.setNavigationLocationReportingActive = (active = false) => {
          navigationLocationReportingActive = !!active;
          const storedUser = getUserInfo$1() || {};
          if (shouldPauseBackgroundLocationReport(storedUser, navigationLocationReportingActive)) {
            this.stopLocationReport();
            return;
          }
          this.refreshBackgroundJobs(false, "nav-location-reporting-changed");
        };
        this.globalData.getLatestRiderLocation = () => {
          return lastLocationSample ? { ...lastLocationSample } : null;
        };
      },
      getCurrentRoutePath() {
        try {
          const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
          const currentPage = Array.isArray(pages) && pages.length ? pages[pages.length - 1] : null;
          return normalizeRoute((currentPage == null ? void 0 : currentPage.route) || "");
        } catch (error) {
          return "";
        }
      },
      isBootingOrLoginPage() {
        const route = this.getCurrentRoutePath();
        return !route || route === "/pages/login/index";
      },
      isNavigationLocationReportingActive() {
        return navigationLocationReportingActive || this.getCurrentRoutePath() === "/pages/map/nav";
      },
      shouldPauseLocationReportForNavigation(userInfo = getUserInfo$1() || {}) {
        return shouldPauseBackgroundLocationReport(userInfo, this.isNavigationLocationReportingActive());
      },
      getLocalSessionSnapshot() {
        return {
          token: getToken(),
          userInfo: getUserInfo$1()
        };
      },
      resetValidatedSession(reason = "") {
        if (reason) {
          formatAppLog("log", "at App.vue:273", "重置骑手端会话校验状态:", reason);
        }
        sessionValidationPromise = null;
        validatedSessionToken = "";
        validatedSessionUserId = "";
        validatedSessionUser = null;
      },
      hasLocalRiderSession(snapshot = this.getLocalSessionSnapshot()) {
        return !!snapshot.token && !!snapshot.userInfo && isRiderAppUser(snapshot.userInfo);
      },
      hasValidatedRiderSession(snapshot = this.getLocalSessionSnapshot()) {
        if (!this.hasLocalRiderSession(snapshot)) {
          return false;
        }
        if (!validatedSessionToken || !validatedSessionUser || !isRiderAppUser(validatedSessionUser)) {
          return false;
        }
        if (validatedSessionToken !== snapshot.token) {
          return false;
        }
        const localUserId = getUserId(snapshot.userInfo);
        if (localUserId && validatedSessionUserId && localUserId !== validatedSessionUserId) {
          return false;
        }
        return true;
      },
      canStartBackgroundJobs() {
        if (this.isBootingOrLoginPage()) {
          return false;
        }
        return this.hasValidatedRiderSession();
      },
      async handleAppVisible(source = "show") {
        await this.refreshBackgroundJobs(false, source);
      },
      async refreshBackgroundJobs(forceValidation = false, source = "manual") {
        const snapshot = this.getLocalSessionSnapshot();
        reportSessionDebug("B", "App.vue:262", "refreshBackgroundJobs start", {
          source,
          forceValidation,
          hasToken: !!snapshot.token,
          hasUserInfo: !!snapshot.userInfo,
          isRiderUser: !!(snapshot.userInfo && isRiderAppUser(snapshot.userInfo)),
          currentRoute: this.getCurrentRoutePath()
        });
        if (snapshot.token && (!snapshot.userInfo || !isRiderAppUser(snapshot.userInfo))) {
          reportSessionDebug("B", "App.vue:272", "local session is invalid before remote validation", {
            source,
            hasToken: !!snapshot.token,
            hasUserInfo: !!snapshot.userInfo,
            isRiderUser: !!(snapshot.userInfo && isRiderAppUser(snapshot.userInfo)),
            currentRoute: this.getCurrentRoutePath()
          });
          this.clearInvalidLocalSession("检测到本地残留的非骑手或损坏登录态", { redirect: !this.isBootingOrLoginPage() });
          return false;
        }
        if (this.isBootingOrLoginPage()) {
          formatAppLog("log", "at App.vue:332", `当前处于启动/登录页，不启动后台任务: ${source}`);
          this.stopAllBackgroundJobs();
          return false;
        }
        if (!snapshot.token) {
          reportSessionDebug("C", "App.vue:289", "refreshBackgroundJobs stopped because token is missing", {
            source,
            currentRoute: this.getCurrentRoutePath()
          });
          this.resetValidatedSession("本地无 token，不启动后台任务");
          this.stopAllBackgroundJobs();
          return false;
        }
        const sessionReady = await this.ensureRiderSessionReady(forceValidation);
        if (!sessionReady || !this.canStartBackgroundJobs()) {
          this.stopAllBackgroundJobs();
          return false;
        }
        this.startAuthorizedBackgroundJobs();
        return true;
      },
      async ensureRiderSessionReady(forceValidation = false) {
        const snapshot = this.getLocalSessionSnapshot();
        reportSessionDebug("D", "App.vue:306", "ensureRiderSessionReady start", {
          forceValidation,
          hasToken: !!snapshot.token,
          hasUserInfo: !!snapshot.userInfo,
          isRiderUser: !!(snapshot.userInfo && isRiderAppUser(snapshot.userInfo)),
          currentRoute: this.getCurrentRoutePath()
        });
        if (!this.hasLocalRiderSession(snapshot)) {
          return false;
        }
        if (!forceValidation && this.hasValidatedRiderSession(snapshot)) {
          return true;
        }
        if (sessionValidationPromise) {
          return sessionValidationPromise;
        }
        sessionValidationPromise = (async () => {
          try {
            const res = await get("/auth/me", {}, {
              background: true,
              silent: true,
              suppressAuthToast: true,
              suppressErrorToast: true
            });
            const remoteUser = (res == null ? void 0 : res.data) || null;
            reportSessionDebug("D", "App.vue:329", "auth/me returned", {
              hasRemoteUser: !!remoteUser,
              remoteRole: (remoteUser == null ? void 0 : remoteUser.role) || "",
              remoteUserId: getUserId(remoteUser),
              deliveryScope: (remoteUser == null ? void 0 : remoteUser.delivery_scope) || "",
              riderKind: (remoteUser == null ? void 0 : remoteUser.rider_kind) || ""
            });
            if (!remoteUser || !isRiderAppUser(remoteUser)) {
              this.clearInvalidLocalSession("服务端会话校验失败：当前账号不是 rider", { redirect: true });
              return false;
            }
            setUserInfo(remoteUser);
            validatedSessionToken = snapshot.token;
            validatedSessionUserId = getUserId(remoteUser);
            validatedSessionUser = remoteUser;
            formatAppLog("log", "at App.vue:402", "骑手端会话校验通过，允许启动后台任务");
            return true;
          } catch (error) {
            const code = Number((error == null ? void 0 : error.code) || 0);
            reportSessionDebug("D", "App.vue:343", "auth/me validation failed", {
              code,
              message: (error == null ? void 0 : error.msg) || (error == null ? void 0 : error.message) || "",
              currentRoute: this.getCurrentRoutePath()
            });
            if (code === 401 || code === 403) {
              this.clearInvalidLocalSession(`服务端会话校验失败，状态码: ${code}`, { redirect: !this.isBootingOrLoginPage() });
              return false;
            }
            formatAppLog("error", "at App.vue:415", "骑手端会话校验失败，暂不启动后台任务", error);
            this.resetValidatedSession("会话校验未通过");
            return false;
          } finally {
            sessionValidationPromise = null;
          }
        })();
        return sessionValidationPromise;
      },
      clearInvalidLocalSession(reason, { redirect = false } = {}) {
        reportSessionDebug("E", "App.vue:359", "clearInvalidLocalSession called", {
          reason,
          redirect,
          currentRoute: this.getCurrentRoutePath(),
          hasToken: !!getToken(),
          hasUserInfo: !!getUserInfo$1()
        });
        formatAppLog("warn", "at App.vue:433", reason);
        clearRiderSession();
        this.resetValidatedSession(reason);
        this.stopAllBackgroundJobs();
        if (redirect && !this.isBootingOrLoginPage()) {
          uni.reLaunch({ url: "/pages/login/index" });
        }
      },
      startAuthorizedBackgroundJobs() {
        this.startLocationReport();
        this.syncCountyDriverOnlineStatus();
        this.syncReminderCenterState();
      },
      stopAllBackgroundJobs() {
        this.stopLocationReport();
        stopReminderCenter();
      },
      syncReminderCenterState() {
        const snapshot = this.getLocalSessionSnapshot();
        const userInfo = validatedSessionUser || snapshot.userInfo || getUserInfo$1() || null;
        syncReminderCenterSession({
          token: snapshot.token,
          userInfo
        });
      },
      startLocationReport() {
        var _a;
        this.stopLocationReport();
        if (!this.canStartBackgroundJobs()) {
          reportLocationDebug("A", "App.vue:startLocationReport:not-ready", "位置上报未启动，会话未就绪", {
            route: ((_a = getCurrentPages().slice(-1)[0]) == null ? void 0 : _a.route) || ""
          });
          formatAppLog("log", "at App.vue:465", "会话未就绪，不启动位置上报");
          return;
        }
        const storedUser = getUserInfo$1() || {};
        reportLocationDebug("C", "App.vue:startLocationReport:entry", "进入位置上报启动判定", {
          role: storedUser.role || "",
          delivery_scope: storedUser.delivery_scope || "",
          rider_kind: storedUser.rider_kind || "",
          user_id: getUserId(storedUser),
          can_report: canReportDispatchLocation(storedUser),
          navigation_reporting_active: navigationLocationReportingActive
        });
        if (!canReportDispatchLocation(storedUser)) {
          reportLocationDebug("C", "App.vue:startLocationReport:skip-role", "当前账号不属于定位上报角色", {
            role: storedUser.role || "",
            delivery_scope: storedUser.delivery_scope || "",
            rider_kind: storedUser.rider_kind || "",
            user_id: getUserId(storedUser)
          });
          formatAppLog("log", "at App.vue:485", "当前账号不属于调度定位上报角色，不启动位置上报");
          return;
        }
        if (this.shouldPauseLocationReportForNavigation(storedUser)) {
          reportLocationDebug("A", "App.vue:startLocationReport:paused-nav", "导航态暂停后台位置上报", {
            role: storedUser.role || "",
            delivery_scope: storedUser.delivery_scope || "",
            rider_kind: storedUser.rider_kind || "",
            user_id: getUserId(storedUser)
          });
          formatAppLog("log", "at App.vue:495", "当前处于导航态，后台位置上报让位暂停");
          return;
        }
        reportLocationDebug("A", "App.vue:startLocationReport:started", "位置上报定时器已启动", {
          interval_ms: 1e4,
          role: storedUser.role || "",
          delivery_scope: storedUser.delivery_scope || "",
          rider_kind: storedUser.rider_kind || "",
          user_id: getUserId(storedUser)
        });
        formatAppLog("log", "at App.vue:506", "启动位置上报定时器，间隔 10 秒");
        locationTimer = setInterval(() => {
          const latestUser2 = getUserInfo$1() || {};
          if (!this.canStartBackgroundJobs() || !canReportDispatchLocation(latestUser2) || this.shouldPauseLocationReportForNavigation(latestUser2)) {
            this.stopLocationReport();
            return;
          }
          this.doReportLocation();
        }, 1e4);
        const latestUser = getUserInfo$1() || {};
        if (this.canStartBackgroundJobs() && canReportDispatchLocation(latestUser) && !this.shouldPauseLocationReportForNavigation(latestUser)) {
          this.doReportLocation();
        }
      },
      stopLocationReport() {
        if (locationTimer) {
          clearInterval(locationTimer);
          locationTimer = null;
          formatAppLog("log", "at App.vue:540", "位置上报定时器已停止");
        }
        locationReportInFlight = false;
      },
      doReportLocation() {
        const storedUser = getUserInfo$1() || {};
        if (!this.canStartBackgroundJobs() || !canReportDispatchLocation(storedUser) || this.shouldPauseLocationReportForNavigation(storedUser)) {
          this.stopLocationReport();
          return;
        }
        if (locationReportInFlight) {
          return;
        }
        locationReportInFlight = true;
        const requestTs = Date.now();
        (async () => {
          var _a, _b, _c, _d, _e;
          try {
            reportLocationDebug("A", "App.vue:doReportLocation:begin", "开始一次位置上报尝试", {
              role: storedUser.role || "",
              delivery_scope: storedUser.delivery_scope || "",
              rider_kind: storedUser.rider_kind || "",
              user_id: getUserId(storedUser),
              gcj02_unsupported: gcj02Unsupported
            });
            let res = null;
            let sample = null;
            if (!gcj02Unsupported) {
              try {
                reportLocationDebug("B", "App.vue:doReportLocation:gcj02", "尝试 gcj02 定位", {
                  high_accuracy: true
                });
                res = await requestUniLocation("gcj02");
                sample = normalizeReportLocation(res, requestTs, "gcj02", "gcj02");
              } catch (error) {
                reportLocationDebug("B", "App.vue:doReportLocation:gcj02-fail", "gcj02 定位失败", {
                  errMsg: String((error == null ? void 0 : error.errMsg) || (error == null ? void 0 : error.message) || ""),
                  unsupported: isGcj02NotSupportedError(error)
                });
                if (isGcj02NotSupportedError(error)) {
                  gcj02Unsupported = true;
                  formatAppLog("warn", "at App.vue:585", "当前环境不支持 gcj02，改用 wgs84 定位并本地转换为 gcj02 上报");
                } else {
                  formatAppLog("warn", "at App.vue:587", "gcj02 定位失败，改用 wgs84 定位兜底:", error);
                }
              }
            }
            if (!sample) {
              try {
                reportLocationDebug("B", "App.vue:doReportLocation:wgs84-high", "尝试 wgs84 高精度定位", {
                  high_accuracy: true
                });
                res = await requestUniLocation("wgs84");
                sample = normalizeReportLocation(res, requestTs, "wgs84", "wgs84_to_gcj02");
              } catch (error) {
                reportLocationDebug("B", "App.vue:doReportLocation:wgs84-high-fail", "wgs84 高精度定位失败", {
                  errMsg: String((error == null ? void 0 : error.errMsg) || (error == null ? void 0 : error.message) || "")
                });
                formatAppLog("warn", "at App.vue:602", "wgs84 高精度定位失败，改用普通定位兜底:", error);
              }
            }
            if (!sample) {
              reportLocationDebug("B", "App.vue:doReportLocation:wgs84-low", "尝试 wgs84 普通精度兜底", {
                high_accuracy: false,
                high_accuracy_expire_time: 15e3
              });
              res = await requestUniLocation("wgs84", {
                isHighAccuracy: false,
                highAccuracyExpireTime: 15e3
              });
              sample = normalizeReportLocation(res, requestTs, "wgs84", "wgs84_low_accuracy_fallback");
            }
            locationPermissionPrompted = false;
            reportLocationDebug("B", "App.vue:doReportLocation:location-ok", "已获取原始定位结果", {
              latitude: sample == null ? void 0 : sample.latitude,
              longitude: sample == null ? void 0 : sample.longitude,
              accuracy: sample == null ? void 0 : sample.accuracy,
              locationSource: sample == null ? void 0 : sample.locationSource,
              provider: (sample == null ? void 0 : sample.provider) || ""
            });
            const nearlySameAsLast = !!lastLocationSample && isNearlySameLocation(sample, lastLocationSample);
            formatAppLog("log", "at App.vue:625", "位置上报原始定位结果:", {
              latitude: sample.latitude,
              longitude: sample.longitude,
              accuracy: sample.accuracy,
              altitude: sample.altitude,
              speed: sample.speed,
              provider: sample.provider,
              timestamp: sample.ts,
              locationSource: sample.locationSource,
              nearlySameAsLast
            });
            if (!Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude)) {
              formatAppLog("warn", "at App.vue:638", "本次定位结果无效，不上报旧点");
              return;
            }
            const payload = {
              latitude: sample.latitude,
              longitude: sample.longitude
            };
            formatAppLog("log", "at App.vue:646", "位置上报请求体:", {
              ...payload,
              timestamp: sample.ts,
              locationSource: sample.locationSource,
              nearlySameAsLast
            });
            lastLocationSample = sample;
            if (this.globalData) {
              this.globalData.latestRiderLocation = { ...sample };
            }
            const reportRes = await post("/rider/location/report", payload, {
              background: true,
              silent: true,
              suppressAuthToast: true,
              suppressErrorToast: true
            }).catch((err) => {
              reportLocationDebug("D", "App.vue:doReportLocation:report-fail", "位置上报接口失败", {
                errMsg: String((err == null ? void 0 : err.message) || (err == null ? void 0 : err.errMsg) || ""),
                latitude: payload.latitude,
                longitude: payload.longitude
              });
              formatAppLog("log", "at App.vue:668", "真实位置上报接口失败:", err);
              return null;
            });
            if ((_a = reportRes == null ? void 0 : reportRes.data) == null ? void 0 : _a.throttled) {
              reportLocationDebug("D", "App.vue:doReportLocation:report-throttled", "位置已获取但后端限频忽略写入", {
                latitude: payload.latitude,
                longitude: payload.longitude,
                rider_location_updated_at: ((_b = reportRes == null ? void 0 : reportRes.data) == null ? void 0 : _b.rider_location_updated_at) || ""
              });
              formatAppLog("warn", "at App.vue:678", "位置已获取，但后端本次限频忽略写入:", {
                latitude: payload.latitude,
                longitude: payload.longitude,
                rider_location_updated_at: ((_c = reportRes == null ? void 0 : reportRes.data) == null ? void 0 : _c.rider_location_updated_at) || "",
                reason: "位置上报过于频繁，已忽略本次写入"
              });
            } else if (reportRes) {
              reportLocationDebug("D", "App.vue:doReportLocation:report-ok", "位置已成功提交到后端", {
                latitude: payload.latitude,
                longitude: payload.longitude,
                rider_location_updated_at: ((_d = reportRes == null ? void 0 : reportRes.data) == null ? void 0 : _d.rider_location_updated_at) || ""
              });
              formatAppLog("log", "at App.vue:690", "位置上报成功，已提交到后端:", {
                latitude: payload.latitude,
                longitude: payload.longitude,
                rider_location_updated_at: ((_e = reportRes == null ? void 0 : reportRes.data) == null ? void 0 : _e.rider_location_updated_at) || ""
              });
            }
          } catch (err) {
            const failureMeta = buildLocationFailureMeta(err);
            reportLocationDebug("E", "App.vue:doReportLocation:catch", "位置上报总流程失败", {
              errMsg: String((err == null ? void 0 : err.errMsg) || (err == null ? void 0 : err.message) || ""),
              failure_type: failureMeta.type,
              failure_text: failureMeta.text,
              failure_detail: failureMeta.detail
            });
            formatAppLog("warn", "at App.vue:704", `[定位上报失败] ${failureMeta.text}: ${failureMeta.detail}`, err);
            if (Date.now() >= locationHintToastUntil && failureMeta.type !== "permission") {
              locationHintToastUntil = Date.now() + 12e3;
              uni.showToast({
                title: failureMeta.text,
                icon: "none",
                duration: 2200
              });
            }
            this.handleLocationPermissionError(err);
          } finally {
            locationReportInFlight = false;
          }
        })();
      },
      handleLocationPermissionError(err) {
        const storedUser = getUserInfo$1() || {};
        if (!this.canStartBackgroundJobs() || !canReportDispatchLocation(storedUser)) {
          return;
        }
        const failureMeta = buildLocationFailureMeta(err);
        const isPermissionDenied = failureMeta.type === "permission";
        if (!isPermissionDenied || locationPermissionPrompted) {
          if (failureMeta.type === "service_disabled" && Date.now() >= locationHintToastUntil) {
            locationHintToastUntil = Date.now() + 12e3;
            uni.showToast({
              title: "请先打开系统定位",
              icon: "none",
              duration: 2200
            });
          }
          return;
        }
        locationPermissionPrompted = true;
        uni.showModal({
          title: "需要定位权限",
          content: "县城司机要出现在调度台，必须允许定位权限并成功上报当前位置。请前往授权。",
          confirmText: "去授权",
          cancelText: "稍后",
          success: (res) => {
            if (res.confirm && typeof uni.openSetting === "function") {
              uni.openSetting({
                success: () => {
                  locationPermissionPrompted = false;
                  this.doReportLocation();
                },
                fail: () => {
                  locationPermissionPrompted = false;
                }
              });
            } else {
              locationPermissionPrompted = false;
            }
          },
          fail: () => {
            locationPermissionPrompted = false;
          }
        });
      },
      async syncCountyDriverOnlineStatus() {
        const storedUser = getUserInfo$1() || {};
        if (!this.canStartBackgroundJobs() || !isCountyRider(storedUser)) {
          return;
        }
        const rawStatus = uni.getStorageSync("riderStatus");
        const hasSavedStatus = rawStatus !== "" && rawStatus !== null && typeof rawStatus !== "undefined";
        const nextStatus = hasSavedStatus ? Number(rawStatus) === 1 ? 1 : 0 : 1;
        if (!hasSavedStatus) {
          setRiderStatus(nextStatus);
        }
        try {
          await post("/order/rider-status", { status: nextStatus }, {
            background: true,
            silent: true,
            suppressAuthToast: true,
            suppressErrorToast: true
          });
          formatAppLog("log", "at App.vue:788", "县城司机在线状态已同步到后端:", nextStatus);
        } catch (error) {
          formatAppLog("error", "at App.vue:790", "县城司机在线状态同步失败:", error);
        }
      }
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "E:/固始县外卖骑手端/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return { app };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
