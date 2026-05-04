(function () {
  "use strict";

  /** 與 app.js 公告／管理後台相同：僅此 Google UID 視為網站管理員（無 localStorage 捷徑） */
  const ADMIN_UID = "am42ZiJikLNEt8RSsWipgBDj4h32";

  const PLAYER_NICKNAME_KEY = "pikmin_player_nickname";
  const INVITE_CODE_KEY = "pikmin_invite_code_ok";

  // ✅ 你可以在這裡改邀請碼。玩家輸入其中一組才會解鎖需登入的卡片內容。
  const VALID_INVITE_CODES = ["PIKMIN", "MUSHROOM", "ANN2026"];

  function getFirebaseUser() {
    try {
      return window.firebase && firebase.auth ? firebase.auth().currentUser : null;
    } catch (error) {
      return null;
    }
  }

  function isFirebaseAdmin() {
    const user = getFirebaseUser();
    return Boolean(user && !user.isAnonymous && user.uid === ADMIN_UID);
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

  /**
   * 蘑菇：預設鎖定，除非管理員設 publicUnlock。
   * 其他卡片：預設不鎖，除非管理員設 requirePlayerUnlock。
   */
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

  function updateButtonState() {
    const btn = document.getElementById("v37LoginFabBtn");
    if (!btn) return;
    const unlocked = isUnlocked();
    btn.classList.toggle("v37-unlocked", unlocked);
    btn.title = unlocked ? "已登入／已解鎖 GPS 與圖片" : "登入以解鎖 GPS 與圖片";
    btn.textContent = unlocked ? "🍄" : "👤";
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
    const isAdm = isFirebaseAdmin();
    wrap.style.display = isAdm ? "block" : "none";
    if (!isAdm) return;
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
      setStatus("👑 已以管理員身分登入：可查看所有卡片，並可在下方設定「需解鎖」規則。");
    } else if (isPlayerUnlocked()) {
      setStatus("🍄 玩家登入完成：圖片與 GPS 已解鎖。");
    } else {
      const missing = [];
      if (!hasNickname()) missing.push("暱稱");
      if (!inviteOk) missing.push("邀請碼");
      if (!user || user.isAnonymous) missing.push("Google 登入");
      setStatus(`🌫️ 尚未解鎖，還需要：${missing.join("、")}`);
    }
    updateButtonState();
    syncAdminUnlockForm();
  }

  function saveNicknameAndInvite() {
    const nickname = (document.getElementById("v37NicknameInput")?.value || "").trim();
    const inviteCode = (document.getElementById("v37InviteCodeInput")?.value || "").trim();

    if (!nickname) {
      setStatus("請先填寫暱稱。");
      return false;
    }
    localStorage.setItem(PLAYER_NICKNAME_KEY, nickname);

    if (!inviteCode) {
      setStatus("請輸入邀請碼。");
      return false;
    }

    const ok = VALID_INVITE_CODES.map(code => code.toUpperCase()).includes(inviteCode.toUpperCase());
    if (!ok) {
      localStorage.removeItem(INVITE_CODE_KEY);
      setStatus("邀請碼不正確，尚未解鎖。");
      return false;
    }

    localStorage.setItem(INVITE_CODE_KEY, "true");
    setStatus("暱稱與邀請碼已確認，接著請用 Google 登入。");
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
      <section class="v37-auth-panel" role="dialog" aria-modal="true" aria-label="登入與解鎖">
        <div class="v37-auth-header">
          <div>
            <h2 class="v37-auth-title">👤 登入解鎖</h2>
            <p class="v37-auth-subtitle">蘑菇卡片預設鎖定圖片與 GPS；管理員可為單卡覆蓋或加入其他需解鎖卡片。玩家須完成：暱稱、邀請碼、Google 登入。</p>
          </div>
          <button class="v37-auth-close" id="v37AuthCloseBtn" type="button">×</button>
        </div>
        <div class="v37-auth-field">
          <label for="v37NicknameInput">暱稱（必填）</label>
          <input id="v37NicknameInput" type="text" placeholder="例如：ANN" autocomplete="nickname">
        </div>
        <div class="v37-auth-field">
          <label for="v37InviteCodeInput">邀請碼</label>
          <input id="v37InviteCodeInput" type="text" placeholder="請輸入邀請碼" autocomplete="off">
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
    document.body.appendChild(wrap);

    document.getElementById("v37AuthCloseBtn")?.addEventListener("click", closePanel);
    document.getElementById("v37GoogleLoginBtn")?.addEventListener("click", signInWithGoogle);
    document.getElementById("v37LogoutBtn")?.addEventListener("click", signOut);
    document.getElementById("v37AdminApplyUnlockBtn")?.addEventListener("click", adminApplyCardUnlockFlags);
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap) closePanel();
    });
  }

  function createFloatingButton() {
    if (document.getElementById("v37LoginFabBtn")) return;
    const btn = document.createElement("button");
    btn.id = "v37LoginFabBtn";
    btn.type = "button";
    btn.textContent = "👤";
    btn.addEventListener("click", openPanel);
    document.body.appendChild(btn);
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
  };

  window.addEventListener("DOMContentLoaded", () => {
    initFirebaseAuthObserver();
    createAuthPanel();
    createFloatingButton();
    updatePanelStatus();
  });
})();
