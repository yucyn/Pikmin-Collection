(function () {
  "use strict";

  /** 掛在 html 上，避免 body 為 flex 時子元素定位異常 */
  function mountToViewportRoot(node) {
    (document.documentElement || document.body).appendChild(node);
  }

  /**
   * 主內容在 .main { overflow:auto } 內捲動時，單一 fixed 按鈕在部分瀏覽器仍會跟著動。
   * 用「全視窗 fixed + 內層 absolute」當視窗錨點，不依賴 .main 的捲動層。
   */
  function ensureFixedUiRoot() {
    let root = document.getElementById("v37FixedUiRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "v37FixedUiRoot";
      root.setAttribute("aria-hidden", "true");
      mountToViewportRoot(root);
    }
    return root;
  }

  const PLAYER_NICKNAME_KEY = "pikmin_player_nickname";
  const INVITE_CODE_KEY = "pikmin_invite_code_ok";

  function getAdminUids() {
    const list = window.PIKMIN_ADMIN_UIDS;
    return Array.isArray(list) && list.length ? list.filter(Boolean) : ["am42ZiJikLNEt8RSsWipgBDj4h32"];
  }

  /** 若回傳 null 表示不限制，任意 12 碼數字（0–9）皆可 */
  function getOptionalInviteWhitelist() {
    const list = window.PIKMIN_GAME_INVITE_CODES;
    if (!Array.isArray(list) || !list.length) return null;
    const codes = list
      .map((c) => String(c || "").replace(/\D/g, ""))
      .filter((d) => /^\d{12}$/.test(d));
    return codes.length ? codes : null;
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizeInviteDigits(value) {
    return digitsOnly(value).slice(0, 12);
  }

  function formatInviteDisplay(digits) {
    const d = normalizeInviteDigits(digits);
    const parts = [];
    if (d.length > 0) parts.push(d.slice(0, 4));
    if (d.length > 4) parts.push(d.slice(4, 8));
    if (d.length > 8) parts.push(d.slice(8, 12));
    return parts.join(" ");
  }

  function getFirebaseUser() {
    try {
      return window.firebase && firebase.auth ? firebase.auth().currentUser : null;
    } catch (error) {
      return null;
    }
  }

  function isFirebaseAdmin() {
    const user = getFirebaseUser();
    return Boolean(user && !user.isAnonymous && getAdminUids().includes(user.uid));
  }

  function hasNickname() {
    return Boolean((localStorage.getItem(PLAYER_NICKNAME_KEY) || "").trim());
  }

  function hasInviteCode() {
    return localStorage.getItem(INVITE_CODE_KEY) === "true";
  }

  function isPlayerUnlocked() {
    const user = getFirebaseUser();
    return Boolean(user && !user.isAnonymous && hasNickname() && hasInviteCode());
  }

  function isUnlocked() {
    return isPlayerUnlocked() || isFirebaseAdmin();
  }

  function isMushroomItem(item) {
    return String(item && item.tag || "").trim() === "蘑菇";
  }

  function shouldLockItem(item) {
    if (!item) return false;
    if (isUnlocked()) return false;
    if (item.publicUnlock === true) return false;
    if (item.requirePlayerUnlock === true) return true;
    if (isMushroomItem(item)) return true;
    return false;
  }

  function setStatus(message) {
    const el = document.getElementById("v37AuthStatus");
    if (el) el.textContent = message || "";
  }

  let lastDevConsoleUid = null;

  function updateDeveloperModeStrip() {
    const root = ensureFixedUiRoot();
    let el = document.getElementById("v37DeveloperModeStrip");
    if (!el) {
      el = document.createElement("div");
      el.id = "v37DeveloperModeStrip";
      el.className = "v37-developer-mode-strip";
      el.setAttribute("role", "status");
      root.appendChild(el);
    } else if (el.parentElement !== root) {
      root.appendChild(el);
    }
    const user = getFirebaseUser();
    if (isFirebaseAdmin()) {
      el.style.display = "flex";
      el.innerHTML = `
        <span class="v37-dev-mode-title">🌿 Developer Mode</span>
        <span class="v37-dev-mode-hint">管理員已登入 · 除錯請開啟 Console 查看 <code>UID</code></span>
      `;
      if (user && lastDevConsoleUid !== user.uid) {
        console.log("UID:", user.uid);
        lastDevConsoleUid = user.uid;
      }
    } else {
      el.style.display = "none";
      lastDevConsoleUid = null;
    }
  }

  function updateButtonState() {
    const btn = document.getElementById("v37LoginFabBtn");
    if (!btn) return;
    const unlocked = isUnlocked();
    const admin = isFirebaseAdmin();
    btn.classList.toggle("v37-unlocked", unlocked);
    if (admin) {
      btn.title = "管理員已登入";
      btn.textContent = "🏵️";
      btn.setAttribute("aria-label", "管理員已登入");
    } else if (unlocked) {
      btn.title = "已登入／已解鎖圖片與 GPS";
      btn.textContent = "🍀";
      btn.setAttribute("aria-label", "已登入，圖片與 GPS 已解鎖");
    } else {
      btn.title = "解鎖蘑菇 · 登入";
      btn.textContent = "🌱";
      btn.setAttribute("aria-label", "解鎖蘑菇 · 登入");
    }
  }

  function bindInviteCodeFormatter() {
    const el = document.getElementById("v37InviteCodeInput");
    if (!el || el.dataset.formatBound === "true") return;
    el.dataset.formatBound = "true";
    el.addEventListener("input", () => {
      const formatted = formatInviteDisplay(el.value);
      if (el.value !== formatted) el.value = formatted;
    });
  }

  function openPanel() {
    const panel = document.getElementById("v37AuthPanelBackdrop");
    if (!panel) return;
    panel.classList.add("show");
    updatePanelStatus();
    syncAdminUnlockForm();
  }

  function closePanel() {
    const panel = document.getElementById("v37AuthPanelBackdrop");
    if (panel) panel.classList.remove("show");
  }

  function syncAdminUnlockForm() {
    const wrap = document.getElementById("v37AdminUnlockSection");
    if (!wrap) return;
    wrap.style.display = isFirebaseAdmin() ? "block" : "none";
    if (!isFirebaseAdmin()) return;
    const idInput = document.getElementById("v37AdminCardIdInput");
    if (idInput && !idInput.placeholder) idInput.placeholder = "Firestore 文件 ID";
  }

  function updatePanelStatus() {
    const user = getFirebaseUser();
    const nickname = localStorage.getItem(PLAYER_NICKNAME_KEY) || "";
    const inviteOk = hasInviteCode();

    const nicknameInput = document.getElementById("v37NicknameInput");
    if (nicknameInput && !nicknameInput.value) nicknameInput.value = nickname;

    const loginBtn = document.getElementById("v37GoogleLoginBtn");
    const logoutBtn = document.getElementById("v37LogoutBtn");

    if (loginBtn) {
      loginBtn.textContent = (user && !user.isAnonymous)
        ? `已登入：${user.displayName || user.email || "Google"}`
        : "用 Google 登入";
    }
    if (logoutBtn) logoutBtn.style.display = (user && !user.isAnonymous) ? "block" : "none";

    if (isFirebaseAdmin()) {
      setStatus("👑 管理員已登入：可查看所有卡片，並可在下方設定「需解鎖」規則。");
    } else if (isPlayerUnlocked()) {
      setStatus("🍄 登入完成：圖片與 GPS 已解鎖。");
    } else {
      const missing = [];
      if (!hasNickname()) missing.push("暱稱");
      if (!inviteOk) missing.push("遊戲邀請碼");
      if (!user || user.isAnonymous) missing.push("Google 登入");
      setStatus(`🌫️ 尚未解鎖，還需要：${missing.join("、")}`);
    }
    updateButtonState();
    syncAdminUnlockForm();
    updateDeveloperModeStrip();
  }

  function saveNicknameAndInvite() {
    const nickname = (document.getElementById("v37NicknameInput")?.value || "").trim();
    const inviteRaw = document.getElementById("v37InviteCodeInput")?.value || "";

    if (!nickname) {
      setStatus("🌱 請先填寫暱稱。");
      return false;
    }
    localStorage.setItem(PLAYER_NICKNAME_KEY, nickname);

    const inviteDigits = digitsOnly(inviteRaw);
    if (!inviteDigits) {
      setStatus("🌱 請填寫遊戲邀請碼。");
      return false;
    }
    if (inviteDigits.length !== 12) {
      setStatus("🌱 邀請碼需為 12 碼（每位 0–9，例如 012345678901）");
      return false;
    }
    if (!/^\d{12}$/.test(inviteDigits)) {
      setStatus("🌱 邀請碼僅能為數字 0–9");
      return false;
    }

    const whitelist = getOptionalInviteWhitelist();
    if (whitelist && !whitelist.includes(inviteDigits)) {
      localStorage.removeItem(INVITE_CODE_KEY);
      setStatus("🌱 這組號碼不在開通名單內，請向管理員索取邀請碼。");
      return false;
    }

    localStorage.setItem(INVITE_CODE_KEY, "true");
    setStatus("🌱 暱稱與邀請碼已確認，接著請用 Google 登入。");
    updatePanelStatus();
    return true;
  }

  async function signInWithGoogle() {
    if (!saveNicknameAndInvite()) return;
    if (!window.firebase || !firebase.auth) {
      setStatus("Firebase Auth 尚未載入，請確認 index.html 有載入 Firebase。");
      return;
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
      setStatus("🍄 Google 登入成功。");
      setTimeout(() => location.reload(), 450);
    } catch (error) {
      setStatus(`Google 登入失敗：${error.message || error}`);
    }
  }

  async function signOut() {
    try {
      if (window.firebase && firebase.auth) await firebase.auth().signOut();
    } catch (error) {}
    localStorage.removeItem(INVITE_CODE_KEY);
    setStatus("已登出，圖片與 GPS 重新鎖定。");
    setTimeout(() => location.reload(), 350);
  }

  async function adminApplyCardUnlockFlags() {
    if (!isFirebaseAdmin()) {
      setStatus("僅管理員可套用此設定。");
      return;
    }
    const rawId = (document.getElementById("v37AdminCardIdInput")?.value || "").trim();
    const req = Boolean(document.getElementById("v37AdminRequireUnlock")?.checked);
    const pub = Boolean(document.getElementById("v37AdminPublicUnlock")?.checked);

    if (!rawId) {
      setStatus("請貼上明信片文件 ID。");
      return;
    }
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      setStatus("Firebase 尚未初始化。");
      return;
    }

    try {
      const coll = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
      const db = firebase.firestore();
      await db.collection(coll).doc(rawId).update({
        requirePlayerUnlock: req,
        publicUnlock: pub,
        updatedAt: new Date().toISOString()
      });
      setStatus(`✅ 已更新卡片 ${rawId}：需登入解鎖=${req ? "是" : "否"}、公開覆蓋=${pub ? "是" : "否"}`);
    } catch (error) {
      setStatus(`更新失敗：${error.message || error}`);
    }
  }

  function createAuthPanel() {
    if (document.getElementById("v37AuthPanelBackdrop")) return;

    const wrap = document.createElement("div");
    wrap.id = "v37AuthPanelBackdrop";
    wrap.innerHTML = `
      <section class="v37-auth-panel" role="dialog" aria-modal="true" aria-label="解鎖蘑菇">
        <div class="v37-auth-header">
          <div>
            <h2 class="v37-auth-title">解鎖蘑菇</h2>
            <p class="v37-auth-subtitle">解鎖圖片與 GPS</p>
          </div>
          <button class="v37-auth-close" id="v37AuthCloseBtn" type="button">×</button>
        </div>
        <div class="v37-auth-field">
          <label for="v37NicknameInput">暱稱 (必填)</label>
          <input id="v37NicknameInput" type="text" placeholder="" autocomplete="nickname">
        </div>
        <div class="v37-auth-field">
          <label for="v37InviteCodeInput">遊戲邀請碼 </label>
          <input id="v37InviteCodeInput" type="text" placeholder="**** **** ****" autocomplete="off" inputmode="numeric" maxlength="14">
        </div>
        <div class="v37-auth-actions">
          <button id="v37GoogleLoginBtn" class="v37-auth-primary" type="button">用 Google 登入</button>
          <button id="v37LogoutBtn" class="v37-auth-danger" type="button" style="display:none;">登出並重新鎖定</button>
        </div>
        <div id="v37AdminUnlockSection" class="v37-admin-unlock-section" style="display:none;">
          <hr class="v37-auth-divider" />
          <h3 class="v37-admin-title">🌱 管理員：需解鎖卡片</h3>
          <p class="v37-admin-hint">須以管理員 Google 帳號登入。可在此快速寫入 Firestore，或於「編輯明信片」內勾選相同選項。</p>
          <div class="v37-auth-field">
            <label for="v37AdminCardIdInput">明信片文件 ID</label>
            <input id="v37AdminCardIdInput" type="text" placeholder="Firestore 文件 ID" autocomplete="off">
          </div>
          <label class="v37-auth-check">
            <input type="checkbox" id="v37AdminRequireUnlock" />
            標記為「須完成玩家登入」才顯示圖片與 GPS（非蘑菇也可用）
          </label>
          <label class="v37-auth-check">
            <input type="checkbox" id="v37AdminPublicUnlock" />
            公開顯示（覆蓋蘑菇預設鎖定；訪客不需登入即可看）
          </label>
          <button type="button" id="v37AdminApplyUnlockBtn" class="v37-auth-secondary">套用至該卡片</button>
        </div>
        <div id="v37AuthStatus" class="v37-auth-status"></div>
      </section>
    `;
    mountToViewportRoot(wrap);

    document.getElementById("v37AuthCloseBtn")?.addEventListener("click", closePanel);
    document.getElementById("v37GoogleLoginBtn")?.addEventListener("click", signInWithGoogle);
    document.getElementById("v37LogoutBtn")?.addEventListener("click", signOut);
    document.getElementById("v37AdminApplyUnlockBtn")?.addEventListener("click", adminApplyCardUnlockFlags);
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap) closePanel();
    });
    bindInviteCodeFormatter();
  }

  function createFloatingButton() {
    const root = ensureFixedUiRoot();
    let btn = document.getElementById("v37LoginFabBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "v37LoginFabBtn";
      btn.type = "button";
      btn.textContent = "🌱";
      btn.setAttribute("aria-label", "解鎖蘑菇 · 登入");
      btn.addEventListener("click", openPanel);
      root.appendChild(btn);
    } else if (btn.parentElement !== root) {
      root.appendChild(btn);
    }
    updateButtonState();
  }

  function initFirebaseAuthObserver() {
    try {
      if (window.firebase && firebase.apps && firebase.apps.length === 0 && window.PIKMIN_FIREBASE_CONFIG) {
        firebase.initializeApp(window.PIKMIN_FIREBASE_CONFIG);
      }
      if (window.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged(() => {
          updatePanelStatus();
          updateButtonState();
          updateDeveloperModeStrip();
        });
      }
    } catch (error) {
      console.warn("V37 auth init skipped:", error);
    }
  }

  window.PikminAuthGate = {
    isUnlocked,
    isFirebaseAdmin,
    isPlayerUnlocked,
    isMushroomItem,
    shouldLockItem,
    openPanel,
    getAdminUids
  };

  window.addEventListener("DOMContentLoaded", () => {
    initFirebaseAuthObserver();
    createAuthPanel();
    createFloatingButton();
    updatePanelStatus();
    updateDeveloperModeStrip();
  });
})();
