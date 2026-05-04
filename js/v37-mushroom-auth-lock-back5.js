(function () {
  "use strict";

  const OLD_ADMIN_KEY = "pikmin_admin"; // 舊版用的本機管理開關，V37.1 起停用
  const PLAYER_NICKNAME_KEY = "pikmin_player_nickname";
  const INVITE_CODE_KEY = "pikmin_invite_code_ok";

  // ✅ 你可以在這裡改邀請碼。玩家輸入其中一組 + Google 登入才會解鎖蘑菇 GPS。
  const VALID_INVITE_CODES = ["PIKMIN", "MUSHROOM", "ANN2026"];

  // ✅ V37.1 重要修正：管理員權限不再用 localStorage 開啟。
  // 舊版若曾經開過 pikmin_admin，這裡會主動清掉，避免任何人靠 Console 解鎖。
  try { localStorage.removeItem(OLD_ADMIN_KEY); } catch (error) {}

  function getFirebaseUser() {
    try {
      return window.firebase && firebase.auth ? firebase.auth().currentUser : null;
    } catch (error) {
      return null;
    }
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

  // ✅ 現在「解鎖」只認登入玩家，不認本機管理開關。
  function isUnlocked() {
    return isPlayerUnlocked();
  }

  // 保留這個函式名稱，避免其他檔案呼叫時報錯；但它不再代表本機管理模式。
  function isAdminMode() {
    return false;
  }

  function isMushroomItem(item) {
    return String(item && item.tag || "").trim() === "蘑菇";
  }

  function shouldLockItem(item) {
    return isMushroomItem(item) && !isUnlocked();
  }

  function setStatus(message) {
    const el = document.getElementById("v37AuthStatus");
    if (el) el.textContent = message || "";
  }

  function refreshCards() {
    // 你的卡片是動態 render，解鎖狀態改變後直接重整最穩。
    setTimeout(() => location.reload(), 450);
  }

  function updateButtonState() {
    const btn = document.getElementById("v37AdminToggleBtn");
    if (!btn) return;
    const unlocked = isUnlocked();
    btn.classList.toggle("v37-unlocked", unlocked);
    btn.title = unlocked ? "蘑菇 GPS 已登入解鎖" : "登入解鎖蘑菇 GPS";
    btn.textContent = unlocked ? "🍄" : "🌱";
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
        ? `已登入：${user.displayName || user.email || "Google 玩家"}`
        : "用 Google 登入解鎖";
    }
    if (logoutBtn) logoutBtn.style.display = (user && !user.isAnonymous) ? "block" : "none";

    if (isPlayerUnlocked()) {
      setStatus("🍄 已登入解鎖：蘑菇 GPS 與圖片已開放查看。");
    } else {
      const missing = [];
      if (!hasNickname()) missing.push("暱稱");
      if (!inviteOk) missing.push("邀請碼");
      if (!user || user.isAnonymous) missing.push("Google 登入");
      setStatus(`🌫️ 尚未解鎖，還需要：${missing.join("、")}`);
    }
    updateButtonState();
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
      setStatus("邀請碼不正確，蘑菇 GPS 尚未解鎖。");
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
      setStatus("🍄 Google 登入成功，蘑菇 GPS 已解鎖。");
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
    setStatus("已登出，蘑菇 GPS 重新鎖定。");
    refreshCards();
  }

  function createAuthPanel() {
    if (document.getElementById("v37AuthPanelBackdrop")) return;

    const wrap = document.createElement("div");
    wrap.id = "v37AuthPanelBackdrop";
    wrap.innerHTML = `
      <section class="v37-auth-panel" role="dialog" aria-modal="true" aria-label="登入解鎖蘑菇 GPS">
        <div class="v37-auth-header">
          <div>
            <h2 class="v37-auth-title">🌱 登入解鎖蘑菇 GPS</h2>
            <p class="v37-auth-subtitle">只有「蘑菇」標籤會鎖住。填暱稱、邀請碼，並用 Google 登入後即可查看。</p>
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
          <button id="v37GoogleLoginBtn" class="v37-auth-primary" type="button">用 Google 登入解鎖</button>
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
  }

  function createFloatingButton() {
    if (document.getElementById("v37AdminToggleBtn")) return;
    const btn = document.createElement("button");
    btn.id = "v37AdminToggleBtn";
    btn.type = "button";
    btn.textContent = "🌱";
    btn.addEventListener("click", openPanel);
    document.body.appendChild(btn);

    // V37.1.1：用 inline style 再保險一次，避免舊版 FAB CSS 或 breakpoint 影響登入按鈕位置
    Object.assign(btn.style, {
      position: "fixed",
      top: "auto",
      left: "auto",
      right: "calc(18px + env(safe-area-inset-right, 0px))",
      bottom: "calc(92px + env(safe-area-inset-bottom, 0px))",
      margin: "0",
      transform: "none",
      zIndex: "10080"
    });

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
      console.warn("V37.1 auth init skipped:", error);
    }
  }

  // ✅ Shift + P 不再開管理模式，只打開登入解鎖面板。
  document.addEventListener("keydown", (event) => {
    if (event.shiftKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      openPanel();
    }
  });

  window.PikminAuthGate = {
    isUnlocked,
    isAdminMode,
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
