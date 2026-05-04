(function () {
  "use strict";

  const OLD_ADMIN_KEY = "pikmin_admin";
  const PLAYER_NICKNAME_KEY = "pikmin_player_nickname";
  const INVITE_CODE_KEY = "pikmin_invite_code_ok";

  try { localStorage.removeItem(OLD_ADMIN_KEY); } catch (error) {}

  function getAdminUids() {
    const list = window.PIKMIN_ADMIN_UIDS;
    return Array.isArray(list) && list.length ? list.filter(Boolean) : ["am42ZiJikLNEt8RSsWipgBDj4h32"];
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

  /** 保留函式名稱，避免舊碼呼叫錯誤 */
  function isAdminMode() {
    return isFirebaseAdmin();
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

  function setStatus(message) {
    const el = document.getElementById("v37AuthStatus");
    if (el) el.textContent = message || "";
  }

  function refreshCards() {
    setTimeout(() => location.reload(), 450);
  }

  /**
   * 登入鈕：固定掛在 document.body，圖示依 Firebase 與解鎖狀態。
   * 未登入 🌱｜玩家已解鎖 🍀｜管理員 🏵️
   */
  function createLoginButton() {
    let btn = document.getElementById("v37LoginBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "v37LoginBtn";
      btn.type = "button";
      document.body.appendChild(btn);
      btn.addEventListener("click", () => openPanel());
    }

    const user = getFirebaseUser();
    const admin = Boolean(user && !user.isAnonymous && getAdminUids().includes(user.uid));
    const playerUnlocked = isPlayerUnlocked();

    if (admin) {
      btn.textContent = "🏵️";
      btn.title = "管理員已登入";
      btn.setAttribute("aria-label", "管理員已登入");
      btn.classList.add("v37-unlocked");
    } else if (playerUnlocked) {
      btn.textContent = "🍀";
      btn.title = "已登入，圖片與 GPS 已解鎖";
      btn.setAttribute("aria-label", "已登入，圖片與 GPS 已解鎖");
      btn.classList.add("v37-unlocked");
    } else {
      btn.textContent = "🌱";
      btn.title = "登入解鎖蘑菇";
      btn.setAttribute("aria-label", "登入解鎖蘑菇");
      btn.classList.remove("v37-unlocked");
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
  }

  function closePanel() {
    const panel = document.getElementById("v37AuthPanelBackdrop");
    if (panel) panel.classList.remove("show");
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
      setStatus("👑 管理員已登入：可查看所有卡片。");
    } else if (isPlayerUnlocked()) {
      setStatus("🍄 已登入解鎖：圖片與 GPS 已開放。");
    } else {
      const missing = [];
      if (!hasNickname()) missing.push("暱稱");
      if (!inviteOk) missing.push("遊戲邀請碼");
      if (!user || user.isAnonymous) missing.push("Google 登入");
      setStatus(`🌫️ 尚未解鎖，還需要：${missing.join("、")}`);
    }
    createLoginButton();
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
      setStatus("🌱 邀請碼需為 12 碼（每位 0–9）");
      return false;
    }

    const whitelist = getOptionalInviteWhitelist();
    if (whitelist && !whitelist.includes(inviteDigits)) {
      localStorage.removeItem(INVITE_CODE_KEY);
      setStatus("🌱 邀請碼不符，請再確認一次。");
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
      refreshCards();
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
    refreshCards();
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
        <div id="v37AuthStatus" class="v37-auth-status"></div>
      </section>
    `;
    document.body.appendChild(wrap);

    document.getElementById("v37AuthCloseBtn")?.addEventListener("click", closePanel);
    document.getElementById("v37GoogleLoginBtn")?.addEventListener("click", signInWithGoogle);
    document.getElementById("v37LogoutBtn")?.addEventListener("click", signOut);
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap) closePanel();
    });
    bindInviteCodeFormatter();
  }

  function initFirebaseAuthObserver() {
    try {
      if (window.firebase && firebase.apps && firebase.apps.length === 0 && window.PIKMIN_FIREBASE_CONFIG) {
        firebase.initializeApp(window.PIKMIN_FIREBASE_CONFIG);
      }
      if (window.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged(() => {
          createLoginButton();
          updatePanelStatus();
        });
      }
    } catch (error) {
      console.warn("V37 auth init skipped:", error);
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.shiftKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      openPanel();
    }
  });

  window.PikminAuthGate = {
    isUnlocked,
    isAdminMode,
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
    createLoginButton();
    updatePanelStatus();
  });
})();
