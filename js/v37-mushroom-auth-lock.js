(function () {
  "use strict";

  const OLD_ADMIN_KEY = "pikmin_admin";
  const PLAYER_NICKNAME_KEY = "pikmin_player_nickname";
  const INVITE_CODE_KEY = "pikmin_invite_code_ok";
  /** Firestore：與 Google UID 綁定的解鎖資料（暱稱 + 邀請碼 12 碼） */
  const UNLOCK_DOC_COLLECTION = "pikminV37Unlocks";

  try { localStorage.removeItem(OLD_ADMIN_KEY); } catch (error) {}

  /** @type {{ nickname: string, inviteDigits: string } | null} null = 尚未載入（僅限已 Google 登入） */
  let cachedUnlockProfile = null;

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

  function getStoredNicknameForForm() {
    const user = getFirebaseUser();
    if (user && !user.isAnonymous && cachedUnlockProfile) {
      return (cachedUnlockProfile.nickname || "").trim();
    }
    return (localStorage.getItem(PLAYER_NICKNAME_KEY) || "").trim();
  }

  function getStoredInviteDigitsForForm() {
    const user = getFirebaseUser();
    if (user && !user.isAnonymous && cachedUnlockProfile) {
      return normalizeInviteDigits(cachedUnlockProfile.inviteDigits || "");
    }
    if (localStorage.getItem(INVITE_CODE_KEY) === "true") return "";
    return "";
  }

  function hasNickname() {
    const user = getFirebaseUser();
    if (user && !user.isAnonymous) {
      if (cachedUnlockProfile === null) return false;
      return Boolean((cachedUnlockProfile.nickname || "").trim());
    }
    return Boolean((localStorage.getItem(PLAYER_NICKNAME_KEY) || "").trim());
  }

  function inviteDigitsAreValid(inviteDigits) {
    if (inviteDigits.length !== 12) return false;
    const whitelist = getOptionalInviteWhitelist();
    if (whitelist && !whitelist.includes(inviteDigits)) return false;
    return true;
  }

  function hasInviteCode() {
    const user = getFirebaseUser();
    if (user && !user.isAnonymous) {
      if (cachedUnlockProfile === null) return false;
      return inviteDigitsAreValid(normalizeInviteDigits(cachedUnlockProfile.inviteDigits || ""));
    }
    return localStorage.getItem(INVITE_CODE_KEY) === "true";
  }

  function isPlayerUnlocked() {
    const user = getFirebaseUser();
    return Boolean(user && !user.isAnonymous && hasNickname() && hasInviteCode());
  }

  function getFirestore() {
    try {
      return window.firebase && firebase.firestore ? firebase.firestore() : null;
    } catch (error) {
      return null;
    }
  }

  async function loadUnlockProfileFromCloud(uid) {
    const db = getFirestore();
    if (!db || !uid) return { nickname: "", inviteDigits: "" };
    const snap = await db.collection(UNLOCK_DOC_COLLECTION).doc(uid).get();
    if (!snap.exists) return { nickname: "", inviteDigits: "" };
    const d = snap.data() || {};
    return {
      nickname: String(d.nickname || "").trim(),
      inviteDigits: normalizeInviteDigits(String(d.inviteDigits || ""))
    };
  }

  async function saveUnlockProfileToCloud(uid, nickname, inviteDigits) {
    const db = getFirestore();
    if (!db) throw new Error("Firestore 未載入");
    await db.collection(UNLOCK_DOC_COLLECTION).doc(uid).set(
      {
        nickname: String(nickname || "").trim(),
        inviteDigits: normalizeInviteDigits(inviteDigits),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  async function patchUnlockProfileToCloud(uid, patch) {
    const db = getFirestore();
    if (!db) throw new Error("Firestore 未載入");
    await db.collection(UNLOCK_DOC_COLLECTION).doc(uid).set(
      Object.assign({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, patch),
      { merge: true }
    );
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

  const LOGIN_BTN_HOST_ID = "v37SidebarAuthRow";

  /**
   * 確保宿主容器存在：改為指向 HTML 中預設好的側邊欄掛載點
   */
  function ensureLoginButtonHost() {
    let host = document.getElementById(LOGIN_BTN_HOST_ID);
    if (!host) {
      // 降級方案：如果 HTML 沒更新，則在 body 建立一個
      host = document.createElement("div");
      host.id = LOGIN_BTN_HOST_ID;
      document.body.appendChild(host);
    }
    return host;
  }

  /**
   * 登入鈕：置於側邊欄底部掛載點，圖示依 Firebase 與解鎖狀態。
   * 未登入 🌱｜玩家已解鎖 🍀｜管理員 🏵️
   */
  function createLoginButton() {
    v37UpdateLoginBtnHost();
    const user = getFirebaseUser();
    const admin = Boolean(user && !user.isAnonymous && getAdminUids().includes(user.uid));
    const playerUnlocked = isPlayerUnlocked();
    const btn = document.getElementById("v37LoginBtn");
    if (!btn) return;

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

  /**
   * 切換按鈕掛載點：窄螢幕移出側邊欄
   */
  function v37UpdateLoginBtnHost() {
    const isMobile = window.innerWidth <= 1024;
    let btn = document.getElementById("v37LoginBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "v37LoginBtn";
      btn.type = "button";
      btn.addEventListener("click", () => openPanel());
    }
    
    const headerHost = document.querySelector('.main-header');
    const sidebarHost = document.getElementById(LOGIN_BTN_HOST_ID) || ensureLoginButtonHost();
    const targetHost = isMobile ? (headerHost || document.body) : sidebarHost;
    
    if (targetHost && btn.parentNode !== targetHost) {
      targetHost.appendChild(btn);
    }
  }

  function v37UpdateUploadFab() {
    // 移除 FAB 邏輯，不再移動按鈕位置
    return;
  }

  function injectForcedStyles() {
    const styleId = "v37-forced-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
        /* 核心修正：當側邊欄收合時，顯示原本就存在的小懸浮按鈕組 (但在彈窗開啟時需隱藏) */
        body:not(.modal-open):not(.v37-modal-open):not(.modal-open-mushroom) #sidebar.collapsed ~ .mobile-upload-fab,
        body:not(.modal-open):not(.v37-modal-open):not(.modal-open-mushroom) #sidebar.collapsed ~ .mobile-scroll-top-fab {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
        }

        /* 確保懸浮按鈕的位置與小圓球樣式（對齊原生樣式） */
        .mobile-scroll-top-fab {
            position: fixed !important;
            bottom: 25px !important;
            right: 20px !important;
            width: 44px !important;
            height: 44px !important;
            border-radius: 50% !important;
            z-index: 9999 !important;
        }
        .mobile-upload-fab {
            position: fixed !important;
            bottom: 79px !important; /* 位於回到頂部按鈕上方 */
            right: 20px !important;
            width: 44px !important;
            height: 44px !important;
            border-radius: 50% !important;
            z-index: 9999 !important;
        }

        /* 登入面板背景色修正：與網頁背景色 (#f9fbf7) 一致 */
        .v37-auth-panel {
            background: #f9fbf7 !important;
            backdrop-filter: none !important;
            border: 1px solid rgba(120, 201, 107, 0.3) !important;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1) !important;
        }

        /* 強制修正登入視窗佈局：標籤在上，輸入框在下 */
        .v37-auth-field, 
        #v37AuthPanel .v37-auth-field {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 6px !important;
            width: 100% !important;
            margin: 14px 0 !important;
        }
        .v37-auth-input,
        #v37AuthPanel .v37-auth-input,
        #v37AuthPlayerFields input {
            width: 100% !important;
            display: block !important;
            border-radius: 999px !important;
            background: #ffffff !important; 
            border: 1px solid #d1d5db !important;
            box-sizing: border-box !important;
            min-height: 46px !important;
            padding: 12px 22px !important;
            font-size: 15px !important;
            color: #1a2e1f !important;
            outline: none !important;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.03) !important;
            transition: all 0.2s ease !important;
            margin-top: 5px !important;
        }
        .v37-auth-input:focus,
        #v37AuthPlayerFields input:focus {
            border-color: #78c96b !important;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.03), 0 0 0 3px rgba(120, 201, 107, 0.1) !important;
        }
    `;
    document.head.appendChild(style);
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
    document.body.classList.add("v37-modal-open");
    
    // 每次打開面板都強制重刷一次佈局與 FAB
    v37UpdateUploadFab();
    
    // 強制修正：直接操作 DOM 樣式以抵抗其他 CSS 干擾
    setTimeout(() => {
        const fields = document.querySelectorAll('.v37-auth-field');
        fields.forEach(f => {
            f.style.setProperty('display', 'flex', 'important');
            f.style.setProperty('flex-direction', 'column', 'important');
            f.style.setProperty('align-items', 'stretch', 'important');
            f.style.setProperty('gap', '6px', 'important');
            f.style.setProperty('text-align', 'left', 'important');
        });
        const labels = document.querySelectorAll('.v37-auth-field label');
        labels.forEach(l => {
            l.style.setProperty('display', 'block', 'important');
            l.style.setProperty('margin-bottom', '4px', 'important');
        });
        const inputs = document.querySelectorAll('.v37-auth-input');
        inputs.forEach(i => {
            i.style.setProperty('width', '100%', 'important');
            i.style.setProperty('border-radius', '999px', 'important');
            i.style.setProperty('margin-top', '2px', 'important');
            i.style.setProperty('display', 'block', 'important');
            i.style.setProperty('background', 'rgba(255, 255, 255, 0.42)', 'important');
            i.style.setProperty('box-sizing', 'border-box', 'important');
        });
    }, 30);
    updatePanelStatus();
  }

  function closePanel() {
    const panel = document.getElementById("v37AuthPanelBackdrop");
    if (panel) panel.classList.remove("show");
    document.body.classList.remove("v37-modal-open");
  }

  function validateNicknameAndInviteInputs() {
    const nickname = (document.getElementById("v37NicknameInput")?.value || "").trim();
    const inviteRaw = document.getElementById("v37InviteCodeInput")?.value || "";
    const inviteDigits = digitsOnly(inviteRaw);

    if (!nickname) {
      return { ok: false, error: "🌱 請先填寫暱稱。" };
    }
    if (!inviteDigits) {
      return { ok: false, error: "🌱 請填寫遊戲邀請碼。" };
    }
    if (inviteDigits.length !== 12) {
      return { ok: false, error: "🌱 邀請碼需為 12 碼（每位 0–9）" };
    }
    const whitelist = getOptionalInviteWhitelist();
    if (whitelist && !whitelist.includes(inviteDigits)) {
      return { ok: false, error: "🌱 邀請碼不符，請再確認一次。" };
    }
    return { ok: true, nickname, inviteDigits };
  }

  /**
   * Google 已登入：僅顯示唯讀暱稱／邀請碼（無輸入框、無取消、無儲存）。
   * 未登入 Google：顯示可編輯欄位。
   */
  function setAuthPlayerFieldsMode(googleLinked) {
    const nickEdit = document.getElementById("v37NicknameEditBlock");
    const nickRead = document.getElementById("v37NicknameReadonlyBlock");
    const invEdit = document.getElementById("v37InviteEditBlock");
    const invRead = document.getElementById("v37InviteReadonlyBlock");
    const nickDisp = document.getElementById("v37NicknameDisplay");
    const invDisp = document.getElementById("v37InviteDisplay");

    if (!nickEdit || !nickRead || !invEdit || !invRead) return;

    if (googleLinked) {
      const prof = cachedUnlockProfile;
      const nickCloud = prof ? (prof.nickname || "").trim() : "";
      const invCloud = prof ? normalizeInviteDigits(prof.inviteDigits || "") : "";

      nickEdit.hidden = true;
      invEdit.hidden = true;
      nickRead.hidden = false;
      invRead.hidden = false;
      if (nickDisp) nickDisp.textContent = nickCloud || "—";
      if (invDisp) invDisp.textContent = invCloud ? formatInviteDisplay(invCloud) : "—";
    } else {
      nickRead.hidden = true;
      invRead.hidden = true;
      nickEdit.hidden = false;
      invEdit.hidden = false;
    }
  }

  function updatePanelStatus() {
    const user = getFirebaseUser();
    const googleLinked = Boolean(user && !user.isAnonymous);
    const nicknameInput = document.getElementById("v37NicknameInput");
    const inviteInput = document.getElementById("v37InviteCodeInput");
    const loginBtn = document.getElementById("v37GoogleLoginBtn");
    const logoutBtn = document.getElementById("v37LogoutBtn");
    const playerFields = document.getElementById("v37AuthPlayerFields");

    if (playerFields) playerFields.hidden = isFirebaseAdmin();

    const titleEl = document.getElementById("v37AuthTitle");
    const subtitleEl = document.getElementById("v37AuthSubtitle");
    if (titleEl && subtitleEl) {
      if (isUnlocked()) {
        titleEl.textContent = "已登入";
        subtitleEl.textContent = "解鎖隱藏的蘑菇與座標";
      } else {
        titleEl.textContent = "🌱 解鎖蘑菇位置";
        subtitleEl.textContent = "登入後即可探索隱藏的蘑菇與座標";
      }
    }

    if (!googleLinked) {
      if (nicknameInput && !nicknameInput.value.trim()) {
        nicknameInput.value = getStoredNicknameForForm();
      }
      if (inviteInput && !inviteInput.value.trim()) {
        const d = getStoredInviteDigitsForForm();
        inviteInput.value = d ? formatInviteDisplay(d) : "";
      }
    }

    setAuthPlayerFieldsMode(googleLinked);

    if (loginBtn) {
      loginBtn.style.display = googleLinked ? "none" : "";
      loginBtn.textContent = "GOOGLE 登入";
    }
    if (logoutBtn) {
      logoutBtn.style.display = googleLinked ? "block" : "none";
      logoutBtn.textContent = "登出";
    }

    if (isFirebaseAdmin()) {
      setStatus("👑 管理員已登入：可查看所有卡片。");
    } else if (isPlayerUnlocked()) {
      setStatus("歡迎 !");
    } else {
      const user = getFirebaseUser();
      // 如果已登入 Google 但沒解鎖 (沒填暱稱或邀請碼)，或是完全沒登入
      if (user && !user.isAnonymous) {
          setStatus(`✖︎ 尚未完成解鎖 (UID: ${user.uid})`);
      } else {
          setStatus("✖︎ 還沒有登入哦 !");
      }
    }
    createLoginButton();
  }

  async function signInWithGoogle() {
    const v = validateNicknameAndInviteInputs();
    if (!v.ok) {
      setStatus(v.error);
      return;
    }
    if (!window.firebase || !firebase.auth) {
      setStatus("Firebase Auth 尚未載入，請確認 index.html 有載入 Firebase。");
      return;
    }
    if (!getFirestore()) {
      setStatus("Firestore 未載入，請確認 index.html 已加入 firebase-firestore-compat.js。");
      return;
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
      const u = firebase.auth().currentUser;
      if (u && !u.isAnonymous) {
        await saveUnlockProfileToCloud(u.uid, v.nickname, v.inviteDigits);
        cachedUnlockProfile = { nickname: v.nickname, inviteDigits: v.inviteDigits };
        try {
          localStorage.removeItem(PLAYER_NICKNAME_KEY);
          localStorage.removeItem(INVITE_CODE_KEY);
        } catch (e) {}
      }
      setStatus("🍄 Google 登入成功，暱稱與邀請碼已綁定此帳號。");
      refreshCards();
    } catch (error) {
      setStatus(`Google 登入或儲存失敗：${error.message || error}`);
    }
  }

  async function signOut() {
    try {
      if (window.firebase && firebase.auth) await firebase.auth().signOut();
    } catch (error) {}
    cachedUnlockProfile = null;
    try {
      localStorage.removeItem(INVITE_CODE_KEY);
      localStorage.removeItem(PLAYER_NICKNAME_KEY);
    } catch (e) {}
    setStatus("已登出，圖片與 GPS 重新鎖定。");
    refreshCards();
  }

  function createAuthPanel() {
    if (document.getElementById("v37AuthPanelBackdrop")) return;

    const wrap = document.createElement("div");
    wrap.id = "v37AuthPanelBackdrop";
    wrap.innerHTML = `
      <section class="v37-auth-panel" role="dialog" aria-modal="true" aria-labelledby="v37AuthTitle">
        <div class="v37-auth-header">
          <div>
            <h2 class="v37-auth-title" id="v37AuthTitle">🌱 解鎖蘑菇位置</h2>
            <p class="v37-auth-subtitle" id="v37AuthSubtitle">登入後即可探索隱藏的蘑菇與座標</p>
          </div>
          <button class="v37-auth-close" id="v37AuthCloseBtn" type="button">×</button>
        </div>
        <div id="v37AuthPlayerFields">
          <div class="v37-auth-field">
            <div id="v37NicknameEditBlock">
              <label for="v37NicknameInput">暱稱（必填）</label>
              <input id="v37NicknameInput" class="v37-auth-input" type="text" placeholder="" autocomplete="nickname">
            </div>
            <div id="v37NicknameReadonlyBlock" class="v37-auth-readonly-block" hidden>
              <span class="v37-auth-bound-label">暱稱：</span>
              <strong id="v37NicknameDisplay" class="v37-auth-bound-value"></strong>
            </div>
          </div>
          <div class="v37-auth-field">
            <div id="v37InviteEditBlock">
              <label for="v37InviteCodeInput">遊戲邀請碼</label>
              <input id="v37InviteCodeInput" class="v37-auth-input" type="text" placeholder="**** **** ****" autocomplete="off" inputmode="numeric" maxlength="14">
            </div>
            <div id="v37InviteReadonlyBlock" class="v37-auth-readonly-block" hidden>
              <span class="v37-auth-bound-label">遊戲邀請碼：</span>
              <strong id="v37InviteDisplay" class="v37-auth-bound-value"></strong>
            </div>
          </div>
        </div>
        <div class="v37-auth-actions">
          <button id="v37GoogleLoginBtn" class="v37-auth-primary" type="button">GOOGLE 登入</button>
          <button id="v37LogoutBtn" class="v37-auth-danger" type="button" style="display:none;">登出</button>
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

  async function syncUnlockProfileCacheForUser(user) {
    if (!user || user.isAnonymous) {
      cachedUnlockProfile = null;
      return;
    }
    if (!getFirestore()) {
      cachedUnlockProfile = { nickname: "", inviteDigits: "" };
      return;
    }
    try {
      let p = await loadUnlockProfileFromCloud(user.uid);
      const lsNick = (localStorage.getItem(PLAYER_NICKNAME_KEY) || "").trim();
      if (!p.nickname && lsNick) {
        await patchUnlockProfileToCloud(user.uid, { nickname: lsNick });
        p = Object.assign({}, p, { nickname: lsNick });
      }
      cachedUnlockProfile = p;
    } catch (error) {
      console.warn("V37 unlock profile load failed:", error);
      cachedUnlockProfile = { nickname: "", inviteDigits: "" };
    }
  }

  function initFirebaseAuthObserver() {
    try {
      if (window.firebase && firebase.apps && firebase.apps.length === 0 && window.PIKMIN_FIREBASE_CONFIG) {
        firebase.initializeApp(window.PIKMIN_FIREBASE_CONFIG);
      }
      if (window.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
          syncUnlockProfileCacheForUser(user).finally(() => {
            createLoginButton();
            updatePanelStatus();
          });
        });
      }
    } catch (error) {
      console.warn("V37 auth init skipped:", error);
    }
  }



  window.PikminAuthGate = {
    isUnlocked,
    isAdminMode,
    isFirebaseAdmin,
    isPlayerUnlocked,
    isMushroomItem,
    shouldLockItem,
    openPanel,
    getAdminUids,
    getStoredNicknameForForm
  };

  window.addEventListener("DOMContentLoaded", () => {
    injectForcedStyles();
    initFirebaseAuthObserver();
    createAuthPanel();
    v37UpdateLoginBtnHost();
    v37UpdateUploadFab();
    createLoginButton();
    updatePanelStatus();
    
    // 監聽側邊欄切換按鈕，切換時也要重算 FAB
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            // 延遲一下確保 class 已經切換完成
            setTimeout(v37UpdateUploadFab, 50);
        });
    }
  });

  window.addEventListener("resize", () => {
    v37UpdateLoginBtnHost();
    v37UpdateUploadFab();
  });
})();
