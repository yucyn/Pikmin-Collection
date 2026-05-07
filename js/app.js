/* =========================================================
   Pikmin Collection app.js - V38 Speed Optimize
   重點：留言一次讀取 / presence 低頻讀取 / refreshViews 節流 / 避免重複綁定
========================================================= */
document.addEventListener("DOMContentLoaded", function () {
  const modeFileBtn = document.getElementById("modeFileBtn");
  const modeDragBtn = document.getElementById("modeDragBtn");
  const modePasteBtn = document.getElementById("modePasteBtn");

  const filePanel = document.getElementById("filePanel");
  const dragPanel = document.getElementById("dragPanel");
  const pastePanel = document.getElementById("pastePanel");

  const fileInput = document.getElementById("fileInput");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const dropZone = document.getElementById("dropZone");
  const pasteZone = document.getElementById("pasteZone");

  const uploadMessage = document.getElementById("uploadMessage");
  const previewBox = document.getElementById("previewBox");
  const previewImage = document.getElementById("previewImage");
  const clearImageBtn = document.getElementById("clearImageBtn");

  const locationInput = document.getElementById("locationInput");
  const categoryInput = document.getElementById("categoryInput");
  const tagInput = document.getElementById("tagInput");
  const authorInput = document.getElementById("authorInput");
  const sourceInput = document.getElementById("sourceInput");
  const websiteInput = document.getElementById("websiteInput");
  const noteInput = document.getElementById("noteInput");
  const addCardBtn = document.getElementById("addCardBtn");
  const publicUnlockInput = document.getElementById("publicUnlockInput");
  const grid = document.getElementById("grid");
  const emptyState = document.getElementById("emptyState");

  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const mobileTagFilterBtn = document.getElementById("mobileTagFilterBtn");
  const mobileTagMenu = document.getElementById("mobileTagMenu");

  const browseModeBtn = document.getElementById("browseModeBtn");
  const randomCardBtn = document.getElementById("randomCardBtn"); // V38: 隨機按鈕
  const collectionViewBtn = document.getElementById("collectionViewBtn");
  const mapViewBtn = document.getElementById("mapViewBtn");
  const previewModeBtn = document.getElementById("previewModeBtn");
  const previewModeBanner = document.getElementById("previewModeBanner");
  const collectionView = document.getElementById("collectionView");
  const mapView = document.getElementById("mapView");
  const mapList = document.getElementById("mapList");
  const mapFrame = document.getElementById("mapFrame");
  const mapEmpty = document.getElementById("mapEmpty");

  const cardModal = document.getElementById("cardModal");
  const cardModalBackdrop = document.getElementById("cardModalBackdrop");
  const closeCardModalBtn = document.getElementById("closeCardModalBtn");
  const modalCardImage = document.getElementById("modalCardImage");
  const modalCardTitle = document.getElementById("modalCardTitle");
  const modalCardLocation = document.getElementById("modalCardLocation");
  const modalMapLink = document.getElementById("modalMapLink");
  const modalShareCardBtn = document.getElementById("modalShareCardBtn");
  const modalPrevBtn = document.getElementById("modalPrevBtn");
  const modalNextBtn = document.getElementById("modalNextBtn");
  const modalCardAuthor = document.getElementById("modalCardAuthor");
  const modalCardSource = document.getElementById("modalCardSource");
  const modalCardWebsite = document.getElementById("modalCardWebsite");
  const modalCardAuthorRow = document.getElementById("modalCardAuthorRow");
  const modalCardSourceRow = document.getElementById("modalCardSourceRow");
  const modalCardWebsiteRow = document.getElementById("modalCardWebsiteRow");
  const modalEditBtn = document.getElementById("modalEditBtn");

  let isPreviewMode = false; 
  let currentModalCardId = null;
  let currentTagFilter = "";
  let currentPage = 1;

  // V38：集中刷新節流，避免 Firebase / 搜尋 / 篩選連續觸發時整頁重繪多次
  let refreshTimer = null;
  function safeRefreshViews(delay = 120) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshViews();
    }, delay);
  }

  // --- 公共與管理功能 (Firestore) ---
  let isFeaturesInitialized = false;
  let isAdmin = false; 
  let hasStartedPresenceListener = false;

  function initAppFeatures() {
    if (isFeaturesInitialized || !db) return;
    isFeaturesInitialized = true;
    console.log("Initializing App Features...");

    const settingsDoc = db.collection("settings").doc("bulletin");
    const configDoc = db.collection("settings").doc("config");
    const statsDoc = db.collection("stats").doc("visitors");
    const guestbookColl = db.collection("guestbook");

    const bulletinContent = document.getElementById("bulletinContent");

    // --- 全域工具：點擊複製 ---
    window.copyToClipboard = function(text, el) {
      if (!text || text.includes("解鎖")) return;
      navigator.clipboard.writeText(text).then(() => {
        if (el) {
          el.classList.add('copied-feedback');
          setTimeout(() => el.classList.remove('copied-feedback'), 1500);
        }
      }).catch(err => {
        console.error('複製失敗:', err);
      });
    };
    const mobileBulletinContent = document.getElementById("mobileBulletinContent");
    const bulletinInput = document.getElementById("bulletinInput");
    const bulletinEditArea = document.getElementById("bulletinEditArea");
    const editBulletinBtn = document.getElementById("editBulletinBtn");
    const saveBulletinBtn = document.getElementById("saveBulletinBtn");
    const visitorStats = document.getElementById("visitorStats");
    const viewCountEl = document.getElementById("viewCount");
    const guestNameInput = document.getElementById("guestNameInput");
    const guestMsgInput = document.getElementById("guestMsgInput");
    const sendMsgBtn = document.getElementById("sendMsgBtn");
    const guestbookList = document.getElementById("guestbookList");

    function getAdminUids() {
      const list = window.PIKMIN_ADMIN_UIDS;
      return Array.isArray(list) && list.length ? list.filter(Boolean) : ["am42ZiJikLNEt8RSsWipgBDj4h32"];
    }

    // 0. 監測登入狀態
    auth.onAuthStateChanged((user) => {
      const admin = Boolean(user && getAdminUids().includes(user.uid));
      isAdmin = admin;
      if (admin) {
        enableAdminUI();
        if (typeof startPresenceListener === "function") startPresenceListener();
        console.log("Admin authenticated 👑");
      } else {
        disableAdminUI();
      }
      
      // 更新上傳表單中的管理員選項可見性
      document.querySelectorAll(".admin-only-option").forEach(opt => {
        opt.style.display = admin ? "block" : "none";
      });
      const publicUnlockWrapper = document.getElementById("publicUnlockWrapper");
      const userUploadNotice = document.getElementById("userUploadNotice");
      if (publicUnlockWrapper) publicUnlockWrapper.style.display = admin ? "block" : "none";
      if (userUploadNotice) userUploadNotice.style.display = admin ? "none" : "block";

      refreshGuestbookUI(); // 根據身分重新渲染留言板（顯示/隱藏刪除鈕）
    });

    function enableAdminUI() {
      if (editBulletinBtn) editBulletinBtn.style.display = "inline-block";
      const fixGpsBtn = document.getElementById("fixGpsBtn");
      if (fixGpsBtn) fixGpsBtn.style.display = "inline-block";
      if (visitorStats) visitorStats.style.display = "flex";
      document.body.classList.add("admin-mode-active");
      
      document.querySelectorAll("#bulletinContent").forEach(el => {
        el.contentEditable = "true";
        el.style.border = "1px dashed #78c96b";
        el.style.padding = "2px 5px";
        el.style.borderRadius = "4px";
      });
    }

    function disableAdminUI() {
      if (editBulletinBtn) editBulletinBtn.style.display = "none";
      const fixGpsBtn = document.getElementById("fixGpsBtn");
      if (fixGpsBtn) fixGpsBtn.style.display = "none";
      if (visitorStats) visitorStats.style.display = "none";
      document.body.classList.remove("admin-mode-active");
      
      document.querySelectorAll("#bulletinContent").forEach(el => {
        el.contentEditable = "false";
        el.style.border = "none";
      });
    }

    async function fetchLinkPreview(url) {
      const encoded = encodeURIComponent(url);

      // 1. 優先用站內 API（Vercel 部署時可正常使用）
      try {
        const res = await fetch(`/api/link-preview?url=${encoded}`);
        if (res.ok) {
          const data = await res.json();
          if (data && (data.title || data.image)) return data;
        }
      } catch (e) { /* continue */ }

      // 2. 備用：microlink.io（瀏覽器端直接呼叫，支援 CORS，不需伺服器中轉）
      try {
        const mlRes = await fetch(
          `https://api.microlink.io/?url=${encoded}&meta=false`,
          { headers: { "Accept": "application/json" } }
        );
        if (mlRes.ok) {
          const json = await mlRes.json();
          const d = json && json.data ? json.data : null;
          if (d && (d.title || (d.image && d.image.url))) {
            return {
              url: d.url || url,
              title: d.title || "",
              description: d.description || "",
              image: d.image && d.image.url ? d.image.url : ""
            };
          }
        }
      } catch (e) { /* continue */ }

      return null;
    }

    // 🔗 公告：連結預覽 + 顯示
    async function renderBulletinWithPreview(text) {
      if (!text) return "";

      const urlMatch = text.match(/https?:\/\/[^\s]+/);

      // 沒有網址 → 正常顯示
      if (!urlMatch) {
        return text.replace(/\n/g, "<br>");
      }

      const url = urlMatch[0];
      const preview = await fetchLinkPreview(url);

      // 抓不到 preview → 不顯示任何內容（不顯示 URL、不顯示錯誤）
      if (!preview || (!preview.title && !preview.image)) {
        return "";
      }

      // 有 preview 才顯示卡片，且卡片內不顯示連結網址文字
      return `
    <div style="margin-top:6px;">
      <a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
        <div style="
          border:1px solid #dcead3;
          background:#f4f8ef;
          border-radius:12px;
          overflow:hidden;
        ">
          ${preview.image ? `
            <img
              src="${preview.image}"
              onerror="this.style.display='none';"
              style="width:100%; height:120px; object-fit:cover; display:block; background:#e9efe2;"
            >
          ` : ""}
          <div style="padding:8px;">
            <div style="font-weight:700; color:#2f7438; font-size:13px;">
              ${preview.title || ""}
            </div>
            ${preview.description ? `
            <div style="font-size:11px; color:#666; margin-top:4px;">
              ${preview.description}
            </div>` : ""}
          </div>
        </div>
      </a>
    </div>
  `;
    }

    // 1. 公告欄 (每個人都看得到)
    let bulletinLines = [];
    let currentLineIndex = 0;
    let bulletinInterval;

    function setBulletinHTML(html) {
      if (bulletinContent) bulletinContent.innerHTML = html;
      if (mobileBulletinContent) mobileBulletinContent.innerHTML = html;
    }

    const startCarousel = () => {
      if (bulletinLines.length <= 1) return;
      clearInterval(bulletinInterval);
      bulletinInterval = setInterval(() => {
        bulletinContent.style.opacity = 0;
        if (mobileBulletinContent) mobileBulletinContent.style.opacity = 0;
        setTimeout(() => {
          currentLineIndex = (currentLineIndex + 1) % bulletinLines.length;
          renderBulletinWithPreview(bulletinLines[currentLineIndex]).then(html => {
            setBulletinHTML(html);
            bulletinContent.style.opacity = 1; // 確保內容更新完畢後才淡入
            if (mobileBulletinContent) mobileBulletinContent.style.opacity = 1;
          });
        }, 500);
      }, 12000); // 調整為 12 秒切換一次
    };

    settingsDoc.onSnapshot((doc) => {
      if (doc.exists) {
        const text = doc.data().text || "歡迎來到皮克敏收藏站！";
        bulletinLines = text.split("\n").filter(l => l.trim());
        renderBulletinWithPreview(bulletinLines[0] || "歡迎！").then(html => {
          setBulletinHTML(html);
        });
        bulletinInput.value = text;
        startCarousel();
      } else {
        setBulletinHTML("歡迎來到皮克敏收藏站！");
      }
    }, err => console.warn("公告讀取受限:", err));

    // 2. 網站標題載入
    configDoc.onSnapshot((doc) => {
      if (doc.exists) {
        const config = doc.data();
        if (config.siteTitle) document.getElementById("siteTitle").innerText = config.siteTitle;
        if (config.siteSubtitle) document.getElementById("siteSubtitle").innerText = config.siteSubtitle;
      }
    });

    // 3. 訪客計數
    statsDoc.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    statsDoc.onSnapshot((doc) => {
      if (doc.exists && viewCountEl) viewCountEl.innerText = doc.data().count || 0;
    });

    // 3.1 在線人數統計 (V38 優化：改回即時監聽但維持低頻處理)
    const onlineCountEl = document.getElementById("onlineCount");
    const presenceColl = db.collection("presence");
    
    const updatePresence = () => {
      const user = auth.currentUser;
      const uid = user ? user.uid : "anonymous_" + Math.random().toString(36).substring(7);
      // 寫入自己的在線時間
      presenceColl.doc(uid).set({ 
        lastSeen: Date.now(),
        isAdmin: isAdmin 
      }, { merge: true }).catch(e => {
        console.warn("Presence write failed:", e);
      });
    };

    // 初始寫入一次
    updatePresence();
    setInterval(updatePresence, 60000); // 每分鐘更新一次

    // 監聽在線人數 (管理員專屬，節省讀取量)
    window.startPresenceListener = () => {
      if (hasStartedPresenceListener || !isAdmin || !onlineCountEl) return;
      hasStartedPresenceListener = true;
      console.log("Starting presence listener (Admin Only)...");
      
      presenceColl.onSnapshot((snapshot) => {
        const now = Date.now();
        const fiveMinsAgo = now - 300000;
        let onlineCount = 0;
        
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.lastSeen && data.lastSeen > fiveMinsAgo) {
            onlineCount++;
          }
        });
        
        onlineCountEl.innerText = Math.max(1, onlineCount);
        
        if (isAdmin && visitorStats && visitorStats.style.display === "none") {
          visitorStats.style.display = "flex";
        }
      }, err => {
        console.warn("在線人數監聽失敗:", err);
        if (onlineCountEl) onlineCountEl.innerText = "1";
        hasStartedPresenceListener = false;
      });
    };

    // 如果初始化時已經是管理員，直接啟動
    if (isAdmin) window.startPresenceListener();

    // 4. 留言板
    let guestbookMessages = [];
    const refreshGuestbookUI = () => {
      guestbookList.innerHTML = guestbookMessages.map(m => `
        <div class="guest-msg" style="margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid #f0f0f0; position:relative;">
          <b style="color:var(--green-dark);">${m.name || "匿名"}</b>: <span>${m.text}</span>
          <div style="font-size:10px; color:#ccc;">${new Date(m.time).toLocaleString()}</div>
          ${isAdmin ? `<button onclick="deleteGuestMsg('${m.id}')" style="position:absolute; right:0; top:0; border:0; background:transparent; cursor:pointer;">🗑️</button>` : ""}
        </div>
      `).join("");
    };

    // V38：留言板改成一次讀取，避免留言更新造成其他裝置 reload 時整頁等待即時監聽
    async function loadGuestbookOnce() {
      if (!guestbookList) return;
      try {
        const snapshot = await guestbookColl.orderBy("time", "desc").limit(20).get();
        guestbookMessages = [];
        snapshot.forEach(doc => guestbookMessages.push({ id: doc.id, ...doc.data() }));
        refreshGuestbookUI();
      } catch (err) {
        console.warn("留言讀取失敗:", err);
      }
    }
    loadGuestbookOnce();

    window.deleteGuestMsg = (id) => {
      if (!isAdmin) return;
      if (confirm("確定要刪除這則留言嗎？")) guestbookColl.doc(id).delete();
    };

    if (guestMsgInput) {
      guestMsgInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sendMsgBtn.click();
        }
      });
    }

    if (sendMsgBtn) {
      sendMsgBtn.addEventListener("click", () => {
        const name = guestNameInput.value.trim() || "匿名";
        const text = guestMsgInput.value.trim();
        if (!text) return;
        
        sendMsgBtn.disabled = true;
        guestbookColl.add({ name, text, time: Date.now() })
          .then(() => { guestMsgInput.value = ""; return loadGuestbookOnce(); })
          .catch(err => alert("留言失敗：" + err.message))
          .finally(() => { sendMsgBtn.disabled = false; });
      });
    }

    // 5. 編輯儲存功能
    if (editBulletinBtn) {
      editBulletinBtn.addEventListener("click", () => {
        if (!isAdmin) return;
        const isEditing = bulletinEditArea.style.display === "block";
        bulletinEditArea.style.display = isEditing ? "none" : "block";
        bulletinContent.parentElement.style.display = isEditing ? "block" : "none";
      });
    }

    if (saveBulletinBtn) {
      saveBulletinBtn.addEventListener("click", async () => {
        if (!isAdmin) return;
        try {
          await settingsDoc.set({ text: bulletinInput.value }, { merge: true });
          alert("公告已更新！✨");
          bulletinEditArea.style.display = "none";
          bulletinContent.parentElement.style.display = "block";
        } catch (e) { alert("儲存失敗：" + e.message); }
      });
    }

    window.saveTitleUpdate = async (id, val) => {
      if (!isAdmin) return;
      try {
        if (id === "bulletinContent") await settingsDoc.set({ text: val }, { merge: true });
        else await configDoc.set({ [id]: val }, { merge: true });
        console.log(`${id} auto-saved`);
      } catch (e) { console.error("Auto-save failed", e); }
    };

    // --- 一鍵修正 GPS 國家功能 ---
    window.handleFixGPSErrors = async () => {
      if (!isAdmin) return;
      const cards = getPostcards();
      if (!cards || cards.length === 0) {
        alert("目前沒有載入任何明信片資料。");
        return;
      }

      // 找出所有需要修正的卡片
      const updates = [];
      cards.forEach(card => {
        const detected = detectCountryFromCoordinates(card.lat, card.lng);
        if (detected !== "全球" && card.category !== detected) {
          updates.push({ id: card.id, newCategory: detected, oldCategory: card.category });
        }
      });

      if (updates.length === 0) {
        alert("✨ 檢查完成！目前所有明信片的國家判定都正確，無須修正。");
        return;
      }

      const confirmMsg = `發現 ${updates.length} 張明信片的國家標籤與最新 GPS 規則不符（例如：${updates[0].oldCategory} -> ${updates[0].newCategory}）。\n\n確定要一鍵修正所有標籤嗎？`;
      if (!confirm(confirmMsg)) return;

      const btn = document.getElementById("fixGpsBtn");
      const originalText = btn.innerText;
      btn.disabled = true;
      btn.innerText = "⏳ 修正中...";

      try {
        let count = 0;
        // 批次更新 (Firestore batch 或逐一 update，這裡採用逐一以確保穩定)
        for (const up of updates) {
          await updatePostcard(up.id, { category: up.newCategory });
          count++;
          btn.innerText = `⏳ 修正中 (${count}/${updates.length})...`;
        }
        alert(`🎉 修正完成！共更新了 ${count} 張明信片的國家標籤。`);
      } catch (err) {
        console.error("Batch update failed:", err);
        alert("修正過程中發生錯誤，請查看 Console。");
      } finally {
        btn.disabled = false;
        btn.innerText = originalText;
      }
    };
  }
  // --- 管理邏輯結束 ---

  function updateNoteSuggestions() {
    const noteSuggestions = document.getElementById("noteSuggestions");
    if (!noteSuggestions) return;

    const postcards = getPostcards();
    const uniqueNotes = new Set();
    postcards.forEach(item => {
      if (item.note) {
        // 支援多個標籤，例如 "#風景 #日常"
        const tags = item.note.match(/#[\w\u4e00-\u9fa5]+/g);
        if (tags) {
          tags.forEach(t => uniqueNotes.add(t));
        } else {
          // 如果沒有 # 開頭，也記錄整個 note 做為建議（若不長的話）
          const trimmed = item.note.trim();
          if (trimmed.length < 20) uniqueNotes.add(trimmed);
        }
      }
    });

    noteSuggestions.innerHTML = Array.from(uniqueNotes)
      .filter(n => n)
      .map(n => `<option value="${n}"></option>`)
      .join("");
  }

  function getFilters() {
    return { query: searchInput.value, category: categoryFilter.value, tag: currentTagFilter };
  }

  function setMessage(text, isError = false) {
    uploadMessage.textContent = text || "";
    uploadMessage.classList.toggle("error", isError);
  }

  function setUploadLoading(isLoading, text = "圖片處理中…") {
    if (dropZone) dropZone.classList.toggle("upload-loading", Boolean(isLoading));
    if (addCardBtn) addCardBtn.disabled = Boolean(isLoading);
    if (isLoading) setMessage(text);
  }

  function applyPreviewMode() {
    // V38: 強制登入檢查 (非匿名登入才可使用預覽模式)
    let user = null;
    try {
      if (window.firebase && typeof firebase.auth === "function") {
        user = firebase.auth().currentUser;
      }
    } catch (e) {}

    if (isPreviewMode && (!user || user.isAnonymous)) {
      isPreviewMode = false;
      // 如果是從 URL 參數開啟的，則清除參數並警告
      const url = new URL(window.location.href);
      if (url.searchParams.get("mode") === "preview") {
        url.searchParams.delete("mode");
        url.searchParams.delete("card");
        window.history.replaceState({}, "", url);
        alert("瀏覽功能須登入後才能開啟唷！🌱");
      }
    }

    document.body.classList.toggle("is-browse-mode", isPreviewMode);
    if (previewModeBanner) previewModeBanner.classList.toggle("hidden", !isPreviewMode);
    if (browseModeBtn) browseModeBtn.classList.toggle("active", isPreviewMode);
    
    // 瀏覽模式下，預設關閉標籤選單
    if (mobileTagMenu) mobileTagMenu.classList.add("hidden");
    
    safeRefreshViews();
  }

  function togglePreviewMode() {
    // 檢查登入狀態：只有真正登入 (非匿名) 後才能開啟瀏覽功能
    const user = firebase.auth().currentUser;
    if (!user || user.isAnonymous) {
      alert("請先登入後才能開啟瀏覽功能唷！🌱");
      if (window.PikminAuthGate) window.PikminAuthGate.openPanel();
      return;
    }

    isPreviewMode = !isPreviewMode;
    // 不在此重複呼叫 bindTagFilterButtons / initScrollTopFab
    // 那兩個只需在 DOMContentLoaded 初始化一次即可
    applyPreviewMode();

    const url = new URL(window.location.href);
    if (isPreviewMode) {
      url.searchParams.set("mode", "preview");
      navigator.clipboard?.writeText(url.toString()).catch(() => {});
      alert("已切換為預覽模式。網址已嘗試複製，可分享給別人閱覽。");
    } else {
      url.searchParams.delete("mode");
      url.searchParams.delete("card");
    }

    window.history.replaceState({}, "", url);
    safeRefreshViews();
  }

  if (browseModeBtn) {
    browseModeBtn.addEventListener("click", togglePreviewMode);
  }

  function setUploadMode(mode) {
    const modes = [
      { name: "file", btn: modeFileBtn, panel: filePanel },
      { name: "drag", btn: modeDragBtn, panel: dragPanel },
      { name: "paste", btn: modePasteBtn, panel: pastePanel }
    ];

    modes.forEach(item => {
      if (item.btn) item.btn.classList.toggle("active", item.name === mode);
      if (item.panel) item.panel.classList.toggle("hidden", item.name !== mode);
    });

    if (mode === "paste") {
      pasteZone.focus();
      setMessage("貼上模式已啟用。");
    } else if (mode === "drag") {
      setMessage("拖曳模式已啟用。");
    } else {
      setMessage("");
    }
  }

  function setView(view) {
    if (view !== "collection" && view !== "map") view = "collection";
    const isCollection = view === "collection";
    const isMap = view === "map";
    collectionView.classList.toggle("hidden", !isCollection);
    mapView.classList.toggle("hidden", !isMap);
    document.body.classList.toggle("map-mode", isMap);
    collectionViewBtn.classList.toggle("active", isCollection);
    mapViewBtn.classList.toggle("active", isMap);
    if (isMap) {
      safeRefreshViews();
      const list = getFilteredPostcards(getFilters());
      if (list.length > 0) {
        selectMapItem(list[0]);
      } else {
        mapFrame.src = "";
        mapEmpty.classList.remove("hidden");
      }
    }
  }

  function showPreview(imageData) {
    setCurrentImageData(imageData);
    previewImage.src = imageData;
    previewBox.classList.remove("hidden");
    dropZone?.classList.add("has-image");
    setUploadLoading(false);
    setMessage("✅ 圖片已載入，正在自動分析樣式...");
    
    // 自動判定標籤
    autoDetectTagFromImage(imageData);
  }

  /**
   * 自動判定明信片樣式：蘑菇 / 花 / 隱藏
   * 邏輯：分析明信片右側 30% 的區塊
   */
  async function autoDetectTagFromImage(imageData) {
    try {
      const img = new Image();
      img.src = imageData;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      
      // 使用小尺寸進行高效分析
      canvas.width = 300;
      canvas.height = 200;
      ctx.drawImage(img, 0, 0, 300, 200);

      // 取得右側 30% 的像素資料
      const rightWidth = 90; 
      const startY = 70; // 避開郵票
      const analysisHeight = 200 - startY;
      const imageDataObj = ctx.getImageData(300 - rightWidth, startY, rightWidth, analysisHeight);
      const pixels = imageDataObj.data;

      let middleYellow = 0; 
      let bottomYellow = 0; 
      let colorfulPixels = 0; 
      let pureWhiteInBottom = 0; 
      let greenStampCount = 0; // 偵測蘑菇專有的綠色 "CLEARED!" 蓋章
      let sampleCount = 0;

      const midBoundary = 50; 

      for (let i = 0; i < pixels.length; i += 16) { 
        const pixelIndex = i / 4;
        const x = pixelIndex % rightWidth;
        const y = Math.floor(pixelIndex / rightWidth);
        
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        sampleCount++;

        // 偵測黃色 (更嚴格的星星偵測)
        const isYellow = (r > 210 && g > 180 && b < 130);
        if (isYellow) {
          if (y < midBoundary) middleYellow++;
          else bottomYellow++;
        }

        // 偵測綠色蓋章 (蘑菇特徵)
        // 修正：增加對 R 的限制，避免誤判花朵的亮綠色葉子
        // 蓋章的綠色通常比較深且飽和 (G > 80, G > R * 2, G 與 B 接近)
        if (g > 80 && g > r * 2 && Math.abs(g - b) < 60 && y > midBoundary && x > rightWidth * 0.4) {
          greenStampCount++;
        }

        // 偵測彩度
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if ((max - min) > 15 && max > 60) {
          colorfulPixels++;
        }

        // 偵測純白像素 (大朵白花的顯著特徵)
        if (y > midBoundary && r > 245 && g > 245 && b > 245) {
          pureWhiteInBottom++;
        }
      }

      let finalTag = "隱藏";
      
      // 判定邏輯優化：
      const totalYellow = middleYellow + bottomYellow;

      // 1. 如果有綠色蓋章，絕對是蘑菇
      if (greenStampCount > 10) {
        finalTag = "蘑菇";
      } 
      // 2. 如果背景極度花俏 (高彩度像素佔比高)，通常是裝飾邊框 -> 花
      // 蘑菇挑戰的背景通常相對單純 (金/褐/固定底紋)
      else if (colorfulPixels > sampleCount * 0.25) {
        finalTag = "花";
      }
      // 3. 如果黃色像素過多 (大黃花)，判定為花
      else if (totalYellow > 120) {
        finalTag = "花";
      }
      // 4. 如果右下角有大面積純白 (大白花)
      else if (pureWhiteInBottom > (sampleCount / 2) * 0.20) {
        finalTag = "花";
      }
      // 5. 如果有適量的中段黃色 (星星)，判定為蘑菇
      else if (middleYellow > 8) {
        finalTag = "蘑菇";
      }
      // 6. 其他特徵 (普通彩度底紋)
      else if (colorfulPixels > sampleCount * 0.12) {
        finalTag = "花";
      } else {
        finalTag = "隱藏";
      }

      // 更新 UI
      if (tagInput) {
        tagInput.value = finalTag;
        setMessage(`✅ 圖片已載入，自動判定標籤：${finalTag}`);
      }

    } catch (err) {
      console.error("Auto detect failed:", err);
      setMessage("✅ 圖片已載入 (樣式分析失敗，請手動選擇)");
    }
  }

  function clearPreview() {
    clearCurrentImageData();
    previewImage.removeAttribute("src");
    previewBox.classList.add("hidden");
    dropZone?.classList.remove("has-image");
    setMessage("");
  }

  function autoFillCountryFromLocation() {
    const location = parseLocation(locationInput.value);
    if (!location) return;

    const detectedCountry = location.country || "全球";

    if (!categoryInput.value || categoryInput.value === "全球") {
      categoryInput.value = detectedCountry;
    }

    if (detectedCountry !== "全球") {
      setMessage(`已自動判定國家：${detectedCountry}`);
    }
  }

  function createCardShareUrl(cardId) {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "preview");
    url.searchParams.set("card", cardId);
    return url.toString();
  }

  function updateModalNavState() {
    const list = getFilteredPostcards(getFilters());
    const hasMultiple = list.length > 1;
    if (modalPrevBtn) modalPrevBtn.dataset.hidden = hasMultiple ? "false" : "true";
    if (modalNextBtn) modalNextBtn.dataset.hidden = hasMultiple ? "false" : "true";
  }



  function openCardModal(item) {
    currentModalCardId = item.id;
    const index = getPostcards().findIndex(card => card.id === item.id);

    // 圖片淡入淡出切換動畫
    const doUpdate = () => {
      const isV37Locked = Boolean(window.PikminAuthGate && window.PikminAuthGate.shouldLockItem(item));
      modalCardImage.src = item.image;
      
      // 檢查管理權限
      let currentUser = null;
      try { if (window.firebase && firebase.auth) currentUser = firebase.auth().currentUser; } catch(e){}
      const isRealUser = !!(currentUser && !currentUser.isAnonymous);
      const isFirebaseAdmin = window.PikminAuthGate && typeof window.PikminAuthGate.isFirebaseAdmin === "function" && window.PikminAuthGate.isFirebaseAdmin();
      const isOwner = typeof isOwnedByCurrentUser === "function" && isOwnedByCurrentUser(item);
      const canManage = isFirebaseAdmin || isOwner; // 修正：允許匿名擁有者也能管理自己的卡片

      const adminRarity = (isFirebaseAdmin && item.rarity && item.rarity !== "0") 
        ? `<span class="admin-rarity-badge" title="管理員專屬標註">💎 ${"⭐".repeat(parseInt(item.rarity))}</span>` 
        : "";
      modalCardTitle.innerHTML = `No.${String(index + 1).padStart(3, "0")} ${adminRarity}`;
      
      const noteSuffix = item.note ? `｜${item.note}` : "";
      const locationText = isV37Locked ? "待解鎖" : item.locationText;
      const displayLocation = isV37Locked 
        ? locationText 
        : `<span class="copyable-coords" title="點擊複製座標" onclick="copyToClipboard('${item.lat}, ${item.lng}', this)">${locationText}</span>`;
      
      modalCardLocation.innerHTML = `${item.category || "全球"}｜${displayLocation}${noteSuffix}`;
      cardModal.classList.toggle("v37-modal-locked", isV37Locked);
      modalMapLink.href = isV37Locked ? "javascript:void(0)" : createGoogleMapUrl(item.lat, item.lng);
      modalMapLink.textContent = isV37Locked ? "解鎖開啟地圖" : "Open Google Map";
      modalMapLink.onclick = isV37Locked ? function(event) { event.preventDefault(); if (window.PikminAuthGate) window.PikminAuthGate.openPanel(); } : null;

      // 自動抓取地點資訊並顯示
      const infoContainer = document.getElementById("modalCardInfoContainer") || createInfoSection();
      renderLocationDetails(item, infoContainer);

      if (modalEditBtn) {
        modalEditBtn.style.display = (canManage && !isPreviewMode) ? "block" : "none";
        modalEditBtn.onclick = (e) => {
          e.stopPropagation();
          closeCardModal();
          if (typeof handleEditClick === "function") {
            handleEditClick(item);
          } else {
            // Fallback
            const editModal = ensureEditModal();
            openEditModal(item);
          }
        };
      }

      // 更新新增欄位
      if (modalCardAuthor) {
        modalCardAuthor.textContent = item.author || "";
        if (modalCardAuthorRow) modalCardAuthorRow.style.display = item.author ? "flex" : "none";
      }
      if (modalCardSource) {
        modalCardSource.textContent = item.source || "";
        if (modalCardSourceRow) modalCardSourceRow.style.display = item.source ? "flex" : "none";
      }
      if (modalCardWebsite) {
        if (item.websiteUrl) {
          modalCardWebsite.innerHTML = `<a href="${item.websiteUrl}" target="_blank" class="visit-website-link">造訪網站</a>`;
        } else {
          modalCardWebsite.innerHTML = "";
        }
        if (modalCardWebsiteRow) modalCardWebsiteRow.style.display = item.websiteUrl ? "flex" : "none";
      }

        
      const modalLikeBtn = document.getElementById("modalLikeBtn");
      if (modalLikeBtn) {
        const isLiked = typeof isLikedByCurrentUser === "function" ? isLikedByCurrentUser(item) : false;
        const initialCount = Number(item.likeCount || 0);
        modalLikeBtn.innerHTML = `${isLiked ? "❤️" : "🤍"} <span class="modal-like-count">${formatLikeCount(initialCount)}</span>`;
        modalLikeBtn.classList.toggle("active", isLiked);

        modalLikeBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (modalLikeBtn.dataset.busy === "true") return;
          modalLikeBtn.dataset.busy = "true";

          const oldLiked = modalLikeBtn.classList.contains("active");
          const oldCountEl = modalLikeBtn.querySelector(".modal-like-count");
          const oldCount = parseInt(oldCountEl?.textContent || "0", 10) || 0;

          // 樂觀更新：立即反應 UI
          const nextLiked = !oldLiked;
          const nextCount = Math.max(0, oldCount + (nextLiked ? 1 : -1));
          modalLikeBtn.innerHTML = `${nextLiked ? "❤️" : "🤍"} <span class="modal-like-count">${formatLikeCount(nextCount)}</span>`;
          modalLikeBtn.classList.toggle("active", nextLiked);

          try {
            await togglePostcardLike(item.id);
            const updatedItem = getPostcardById(item.id);
            if (updatedItem) {
              const finalLiked = isLikedByCurrentUser(updatedItem);
              const finalCount = Number(updatedItem.likeCount || 0);
              modalLikeBtn.innerHTML = `${finalLiked ? "❤️" : "🤍"} <span class="modal-like-count">${formatLikeCount(finalCount)}</span>`;
              modalLikeBtn.classList.toggle("active", finalLiked);
            }
            safeRefreshViews(0);
          } catch (error) {
            console.error("內頁愛心更新失敗：", error);
            // 失敗就還原
            modalLikeBtn.innerHTML = `${oldLiked ? "❤️" : "🤍"} <span class="modal-like-count">${formatLikeCount(oldCount)}</span>`;
            modalLikeBtn.classList.toggle("active", oldLiked);
            alert("愛心操作失敗：" + (error.message || "請稍後再試"));
          } finally {
            modalLikeBtn.dataset.busy = "false";
          }
        };
      }


      requestAnimationFrame(() => modalCardImage.classList.remove("img-fade"));
    };

    if (!cardModal.classList.contains("hidden")) {
      // 已開啟時切換：先淡出再更新
      modalCardImage.classList.add("img-fade");
      setTimeout(doUpdate, 180);
    } else {
      doUpdate();
    }

    const url = new URL(window.location.href);
    url.searchParams.set("card", item.id);
    window.history.replaceState({}, "", url);

    cardModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    updateModalNavState();
  }

  function closeCardModal() {
    currentModalCardId = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("card");
    window.history.replaceState({}, "", url);
    cardModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function navigateModal(direction) {
    if (!currentModalCardId) return;
    const list = getFilteredPostcards(getFilters());
    if (list.length <= 1) return;
    const idx = list.findIndex(c => String(c.id) === String(currentModalCardId));
    if (idx === -1) return;
    const next = list[(idx + direction + list.length) % list.length];
    openCardModal(next);
  }

  function openSharedCardFromUrl() {
    const cardId = new URLSearchParams(window.location.search).get("card");
    if (!cardId) return;
    const item = getPostcardById(cardId);
    if (item) openCardModal(item);
  }

  function selectMapItem(item) {
    mapFrame.src = createGoogleMapEmbedUrl(item.lat, item.lng);
    mapEmpty.classList.add("hidden");
    setActiveMapItem(mapList, item.id);
  }

  async function handleLikeClick(id) {
    try {
      await togglePostcardLike(id);
    } catch (error) {
      console.warn("Firebase 愛心寫入失敗，但暫時保留畫面狀態：", error);
    }
  }

  function showToast(message) {
    const existing = document.querySelector(".copy-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "copy-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 1600);
  }

  async function handleCopyClick(locationText) {
    try {
      await navigator.clipboard.writeText(locationText);
      showToast("已複製座標");
    } catch {
      const tempInput = document.createElement("input");
      tempInput.value = locationText;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      tempInput.remove();
      showToast("已複製座標");
    }
  }

  async function handleShareClick(cardId) {
    const shareUrl = createCardShareUrl(cardId);

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("已複製單一卡片分享連結");
    } catch {
      prompt("請複製這個分享連結", shareUrl);
    }
  }

  async function handleDeleteClick(id) {
    if (isPreviewMode) {
      alert("預覽模式不能刪除卡片");
      return;
    }

    if (!confirm("確定要刪除這張明信片嗎？")) return;
    
    try {
      await deletePostcard(id);
      showToast("卡片已刪除");
    } catch (error) {
      console.error("刪除失敗：", error);
      alert(`刪除失敗：${error.message || "請檢查 Firestore 權限規則"}`);
    }
  }

  function ensureEditModal() {
    let modal = document.getElementById("editModal");
    const hasCompleteStructure = modal &&
      modal.querySelector("#editForm") &&
      modal.querySelector("#editImageFocusPreview") &&
      modal.querySelector("#editSaveBtn") &&
      modal.querySelector("#editRequirePlayerUnlock");
    if (hasCompleteStructure) return modal;

    if (modal) {
      modal.remove();
      modal = null;
    }

    modal = document.createElement("section");
    modal.id = "editModal";
    modal.className = "edit-modal hidden";
    modal.innerHTML = `
      <div class="edit-modal-backdrop" data-edit-close="true"></div>
      <form id="editForm" class="edit-modal-panel">
        <button type="button" id="closeEditModalBtn" class="edit-modal-close">×</button>
        <h2>編輯明信片</h2>

        <div class="sidebar-form-grid">
          <div class="field-full">
            <label for="editLocationInput">GPS座標</label>
            <input id="editLocationInput" type="text" required placeholder="25.0330, 121.5654" />
          </div>

          <div class="field-half">
            <label for="editCategoryInput">國家</label>
            <select id="editCategoryInput">
              <option value="全球">全球</option>
              <option value="台灣">台灣</option>
              <option value="日本">日本</option>
              <option value="韓國">韓國</option>
              <option value="香港">香港</option>
              <option value="澳門">澳門</option>
              <option value="泰國">泰國</option>
              <option value="新加坡">新加坡</option>
              <option value="馬來西亞">馬來西亞</option>
              <option value="越南">越南</option>
              <option value="菲律賓">菲律賓</option>
              <option value="印度">印度</option>
              <option value="印尼">印尼</option>
              <option value="美國">美國</option>
              <option value="加拿大">加拿大</option>
              <option value="澳洲">澳洲</option>
              <option value="紐西蘭">紐西蘭</option>
              <option value="英國">英國</option>
              <option value="法國">法國</option>
              <option value="德國">德國</option>
              <option value="義大利">義大利</option>
              <option value="西班牙">西班牙</option>
              <option value="葡萄牙">葡萄牙</option>
              <option value="瑞士">瑞士</option>
              <option value="荷蘭">荷蘭</option>
              <option value="奧地利">奧地利</option>
              <option value="希臘">希臘</option>
              <option value="挪威">挪威</option>
              <option value="芬蘭">芬蘭</option>
              <option value="冰島">冰島</option>
               <option value="土耳其">土耳其</option>
              <option value="埃及">埃及</option>
              <option value="墨西哥">墨西哥</option>
              <option value="洪都拉斯">洪都拉斯</option>
              <option value="危地馬拉">危地馬拉</option>
              <option value="薩爾瓦多">薩爾瓦多</option>
              <option value="尼加拉瓜">尼加拉瓜</option>
              <option value="哥斯大黎加">哥斯大黎加</option>
              <option value="巴拿馬">巴拿馬</option>
              <option value="巴西">巴西</option>
              <option value="哥倫比亞">哥倫比亞</option>
              <option value="阿根廷">阿根廷</option>
              <option value="智利">智利</option>
              <option value="馬紹爾群島">馬紹爾群島</option>
              <option value="南非">南非</option>
              <option value="杜拜">杜拜</option>
              <option value="布拉格">布拉格</option>
              <option value="斯洛維尼亞">斯洛維尼亞</option>
            </select>
          </div>

          <div class="field-half">
            <label for="editTagInput">標籤</label>
            <select id="editTagInput" required>
              <option value="" disabled selected hidden>菇/花/隱藏/活動/絕版</option>
              <option value="活動">活動</option>
              <option value="花">花</option>
              <option value="蘑菇">蘑菇</option>
              <option value="隱藏">隱藏</option>
              <option value="絕版">絕版</option>
            </select>
          </div>

          <div id="editRarityRow" class="field-full" style="display:none; margin-top: 10px;">
            <label for="editRarityInput" style="color: #4a6a43; font-weight: 700;">💎 稀有度標註 (管理員專屬)</label>
            <select id="editRarityInput" style="border: 1px dashed #78c96b; background: #fdfdfd;">
              <option value="0">未標註</option>
              <option value="1">⭐ (普通)</option>
              <option value="2">⭐⭐ (稀有)</option>
              <option value="3">⭐⭐⭐ (非常稀有)</option>
              <option value="4">⭐⭐⭐⭐ (極致稀有)</option>
              <option value="5">⭐⭐⭐⭐⭐ (傳說級)</option>
            </select>
          </div>

          <div class="field-half">
            <label for="editAuthorInput">上傳者</label>
            <input id="editAuthorInput" type="text" placeholder="名字/暱稱" />
          </div>

          <div class="field-half">
            <label for="editNoteInput">建立標籤</label>
            <input id="editNoteInput" type="text" placeholder="自定義標籤/備註" list="noteSuggestions" />
          </div>

          <div class="field-half">
            <label for="editWebsiteInput">網站連結</label>
            <input id="editWebsiteInput" type="text" placeholder="https://..." />
          </div>

          <div class="field-half">
            <label for="editSourceInput">來源</label>
            <input id="editSourceInput" type="text" placeholder="X/Twitter..." />
          </div>
        </div>

        <label>圖片展示位置（拖拉調整）</label>
        <div id="editImageFocusPreview" class="edit-image-focus-preview" aria-label="拖拉調整圖片位置">
          <img id="editImageFocusImage" alt="編輯中的卡片圖片" />
        </div>
        <div class="edit-image-focus-actions">
          <small>在預覽圖上拖曳可調整裁切位置</small>
          <div>
            <input type="file" id="editImageFileInput" accept="image/*" style="display:none;" />
            <button type="button" id="replaceImageBtn" class="edit-image-focus-reset" style="background:var(--green); color:white;">更換圖片</button>
            <button type="button" id="deletePostcardBtn" class="edit-image-focus-reset" style="background:#ef4444; color:white;">刪除卡片</button>
          </div>
        </div>

        <div class="field-full v37-edit-admin-unlock" id="v37EditAdminUnlockBlock" style="display:none; border: 2px solid var(--green); padding: 10px; border-radius: 8px; margin-top: 15px;">
          <label style="font-weight:800; color: var(--green-dark);">🛡️ 管理員審核與設定</label>
          <div style="margin: 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label class="sidebar-label">審核狀態</label>
              <select id="editReviewStatus" class="input">
                <option value="pending">⏳ 待審核</option>
                <option value="approved">✅ 已通過</option>
                <option value="rejected">❌ 未通過</option>
              </select>
            </div>
            <div>
              <label class="sidebar-label">可見性</label>
              <select id="editVisibility" class="input">
                <option value="public">🌍 公開</option>
                <option value="members">👥 會員</option>
                <option value="hidden">🚫 隱藏</option>
              </select>
            </div>
          </div>
          <label class="v37-edit-check"><input type="checkbox" id="editIsHidden" /> 徹底隱藏 (isHidden)</label>
          <label class="v37-edit-check"><input type="checkbox" id="editRequirePlayerUnlock" /> 此卡須登入才可查看圖片與 GPS</label>
        </div>

        <button type="button" id="editSaveBtn" class="edit-save-btn">儲存修改</button>
      </form>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target.dataset.editClose === "true" || event.target.id === "closeEditModalBtn") {
        closeEditModal();
      }
    });

    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    return modal;
  }

  function closeEditModal() {
    const modal = document.getElementById("editModal");
    if (modal) modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  async function updatePostcardSmart(id, changes) {
    if (typeof window.updatePostcard === "function") {
      return await window.updatePostcard(id, changes);
    }
    alert("目前缺少 updatePostcard()，請確認 js/storage.js 已加入更新函式。");
    return false;
  }

  function handleEditClick(item) {
    if (isPreviewMode) {
      alert("預覽模式不能編輯卡片");
      return;
    }

    const modal = ensureEditModal();
    const form = document.getElementById("editForm");
    const locationField = document.getElementById("editLocationInput");
    const categoryField = document.getElementById("editCategoryInput");
    const tagField = document.getElementById("editTagInput");
    const authorField = document.getElementById("editAuthorInput");
    const sourceField = document.getElementById("editSourceInput");
    const websiteField = document.getElementById("editWebsiteInput");
    const noteField = document.getElementById("editNoteInput");
    const focusPreview = document.getElementById("editImageFocusPreview");
    const focusImage = document.getElementById("editImageFocusImage");
    const deleteBtn = document.getElementById("deletePostcardBtn");
    const replaceImageBtn = document.getElementById("replaceImageBtn");
    const editImageFileInput = document.getElementById("editImageFileInput");
    const saveBtn = document.getElementById("editSaveBtn");
    
    let newImageBase64 = null;
    let isSavingEdit = false;

    function clampFocus(value) {
      const num = Number(value);
      if (!Number.isFinite(num)) return 50;
      return Math.min(100, Math.max(0, num));
    }

    let focusX = clampFocus(item.imageFocusX);
    let focusY = clampFocus(item.imageFocusY);
    focusImage.src = item.image || "";
    focusImage.style.objectPosition = `${focusX}% ${focusY}%`;

    let isDraggingFocus = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartFocusX = focusX;
    let dragStartFocusY = focusY;
    let pendingX = 0;
    let pendingY = 0;
    let rafId = null;

    focusImage.style.willChange = "object-position";
    focusPreview.style.touchAction = "none";
    focusPreview.style.userSelect = "none";

    function applyFocusUpdate(x, y) {
      rafId = null;
      const width  = Math.max(focusPreview.clientWidth,  1);
      const height = Math.max(focusPreview.clientHeight, 1);
      
      // 如果提供了最新的座標，先更新 pending
      if (x !== undefined) pendingX = x;
      if (y !== undefined) pendingY = y;

      const dx = pendingX - dragStartX;
      const dy = pendingY - dragStartY;
      
      // 更新閉包變數，確保 submitEditChanges 讀取到最新值
      focusX = clampFocus(dragStartFocusX - (dx / width)  * 100);
      focusY = clampFocus(dragStartFocusY - (dy / height) * 100);
      
      // 更新 UI 預覽
      focusImage.style.objectPosition = `${focusX}% ${focusY}%`;
    }

    function scheduleDragUpdate(x, y) {
      pendingX = x;
      pendingY = y;
      // 立即更新數值，讓變數同步，視覺更新則交給 RAF
      const width  = Math.max(focusPreview.clientWidth,  1);
      const height = Math.max(focusPreview.clientHeight, 1);
      focusX = clampFocus(dragStartFocusX - ((pendingX - dragStartX) / width)  * 100);
      focusY = clampFocus(dragStartFocusY - ((pendingY - dragStartY) / height) * 100);
      
      if (!rafId) {
        rafId = requestAnimationFrame(() => applyFocusUpdate());
      }
    }

    function stopDrag() {
      if (!isDraggingFocus) return;
      isDraggingFocus = false;
      
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // 最終確保位置有更新
      applyFocusUpdate(pendingX, pendingY);

      focusPreview.classList.remove("is-dragging");
      
      try {
        if (focusPreview.releasePointerCapture && focusPreview._pointerId != null) {
          focusPreview.releasePointerCapture(focusPreview._pointerId);
        }
      } catch (err) {}
      focusPreview._pointerId = null;

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup",   onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(event) {
      if (!isDraggingFocus) return;
      scheduleDragUpdate(event.clientX, event.clientY);
    }

    function onPointerUp() {
      stopDrag();
    }

    focusPreview.onpointerdown = event => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      focusPreview._pointerId = event.pointerId;
      try { focusPreview.setPointerCapture(event.pointerId); } catch (_) {}
      isDraggingFocus = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragStartFocusX = focusX;
      dragStartFocusY = focusY;
      focusPreview.classList.add("is-dragging");
      window.addEventListener("pointermove",   onPointerMove);
      window.addEventListener("pointerup",     onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };

    if (replaceImageBtn) {
      replaceImageBtn.onclick = () => editImageFileInput.click();
    }

    if (editImageFileInput) {
      editImageFileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            showToast("圖片壓縮中...");
            const rawBase64 = await readFileAsDataUrl(file);
            const compressed = await compressImageDataUrl(rawBase64);
            newImageBase64 = compressed;
            focusImage.src = newImageBase64;
            showToast("圖片已預覽並優化");
          } catch (err) {
            console.error("圖片處理失敗:", err);
            alert("圖片處理失敗，請嘗試其他張圖片");
          }
        }
      };
    }

    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        await handleDeleteClick(item.id);
        closeEditModal();
        safeRefreshViews();
      };
    }

    locationField.value = item.locationText || "";
    categoryField.value = item.category || "全球";
    tagField.value = item.tag || "";
    if (authorField) authorField.value = item.author || "";
    if (sourceField) sourceField.value = item.source || "";
    if (websiteField) websiteField.value = item.websiteUrl || "";
    if (noteField) noteField.value = item.note || "";

    const rarityRow = document.getElementById("editRarityRow");
    const rarityInput = document.getElementById("editRarityInput");
    if (rarityRow) rarityRow.style.display = isAdmin ? "block" : "none";
    if (rarityInput) rarityInput.value = item.rarity || "0";

    const adminUnlockBlock = document.getElementById("v37EditAdminUnlockBlock");
    if (adminUnlockBlock) adminUnlockBlock.style.display = isAdmin ? "block" : "none";
    if (isAdmin) {
      const editReviewStatus = document.getElementById("editReviewStatus");
      const editVisibility = document.getElementById("editVisibility");
      const editIsHidden = document.getElementById("editIsHidden");
      const editRequirePlayerUnlock = document.getElementById("editRequirePlayerUnlock");
      if (editReviewStatus) editReviewStatus.value = item.reviewStatus || "approved";
      if (editVisibility) editVisibility.value = item.visibility || "public";
      if (editIsHidden) editIsHidden.checked = !!item.isHidden;
      if (editRequirePlayerUnlock) editRequirePlayerUnlock.checked = !!item.requirePlayerUnlock;
    }

    async function submitEditChanges() {
      if (isSavingEdit) return;
      const location = parseLocation(locationField.value);
      if (!location) {
        alert("請輸入正確座標，例如：43.587789, 142.465553");
        return;
      }

      isSavingEdit = true;
      if (saveBtn) saveBtn.disabled = true;
      try {
        const changes = {
          locationText: location.locationText,
          lat: location.lat,
          lng: location.lng,
          category: categoryField.value || location.country || "全球",
          tag: tagField.value || "",
          author: authorField ? authorField.value : "",
          source: sourceField ? sourceField.value : "",
          websiteUrl: websiteField ? websiteField.value : "",
          note: noteField ? noteField.value : "",
          imageFocusX: Number(focusX.toFixed(2)),
          imageFocusY: Number(focusY.toFixed(2))
        };

        if (newImageBase64) {
          changes.image = newImageBase64;
        }

        if (isAdmin) {
          const revStatusEl = document.getElementById("editReviewStatus");
          const visEl = document.getElementById("editVisibility");
          const hiddenEl = document.getElementById("editIsHidden");
          const reqEl = document.getElementById("editRequirePlayerUnlock");
          
          if (revStatusEl) changes.reviewStatus = revStatusEl.value;
          if (visEl) changes.visibility = visEl.value;
          if (hiddenEl) changes.isHidden = Boolean(hiddenEl.checked);
          if (reqEl) changes.requirePlayerUnlock = Boolean(reqEl.checked);
          
          // 同步舊有的 publicUnlock 欄位以維持相容性
          changes.publicUnlock = (changes.reviewStatus === "approved" && changes.visibility === "public" && !changes.isHidden);
        }

        const updated = await updatePostcardSmart(item.id, changes);
        if (updated) {
          closeEditModal();
          safeRefreshViews();
          updateNoteSuggestions();
          showToast("已更新明信片");
        } else {
          alert("儲存失敗：資料庫拒絕更新。請確認您的權限或網路連線。");
        }
      } catch (err) {
        console.error("儲存失敗：", err);
        alert("儲存失敗：" + (err.message || "請稍後再試"));
      } finally {
        isSavingEdit = false;
        // 修正：重新獲取最新的按鈕，避免操作到被 cloneNode 替換掉的舊按鈕
        const currentSaveBtn = document.getElementById("editSaveBtn");
        if (currentSaveBtn) {
          currentSaveBtn.disabled = false;
          currentSaveBtn.textContent = "儲存變更";
        }
      }
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "儲存變更";

      const handleSaveTrigger = async (e) => {
        if (e && typeof e.preventDefault === "function") {
          e.preventDefault();
          e.stopPropagation();
        }
        
        if (isSavingEdit || saveBtn.disabled) return;
        
        // 安全機制：10秒後強行解除鎖定
        const safetyTimer = setTimeout(() => {
           if (isSavingEdit || saveBtn.disabled) {
             isSavingEdit = false;
             saveBtn.disabled = false;
             saveBtn.textContent = "儲存變更 (超時重置)";
           }
        }, 10000);

        console.log("Save trigger fired (Edit Mode)", { focusX, focusY });
        
        // 確保先結束拖曳，避免 state 衝突
        if (typeof stopDrag === "function") {
          stopDrag();
        }
        
        saveBtn.disabled = true;
        saveBtn.textContent = "儲存中...";
        
        try {
          await submitEditChanges();
        } catch (err) {
          console.error("編輯提交出錯：", err);
          alert("編輯失敗：" + (err.message || "未知錯誤"));
          const currentBtn = document.getElementById("editSaveBtn");
          if (currentBtn) {
            currentBtn.disabled = false;
            currentBtn.textContent = "儲存修改";
          }
        } finally {
          clearTimeout(safetyTimer);
        }
      };

      // 統一使用 onclick，避免手機版 ontouchend 與 onclick 重複觸發或衝突
      saveBtn.onclick = handleSaveTrigger;
    }

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await submitEditChanges();
      };
    }

    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function bindTagFilterButtons() {
    // 取得行動版選單項目 與 桌機版 Pill 按鈕
    const tagItems = document.querySelectorAll(".mobile-tag-menu .mobile-tag-item, .tag-filter");

    function updateActiveState(tag) {
      currentTagFilter = tag;
      tagItems.forEach(el => {
        const isActive = (el.dataset.tag || "") === tag;
        el.classList.toggle("active", isActive);
        el.classList.toggle("is-active", isActive);
      });
      if (mobileTagMenu) mobileTagMenu.classList.add("hidden");
      currentPage = 1;
      safeRefreshViews();
    }

    tagItems.forEach(el => {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        updateActiveState(this.dataset.tag || "");
      });
    });

    // 把 mobileTagMenu 移進 body 確保不被裁切且高於一切
    if (mobileTagMenu && mobileTagMenu.parentNode !== document.body) {
      document.body.appendChild(mobileTagMenu);
    }

    const placeMobileTagMenuNearButton = () => {
      if (!mobileTagMenu || !mobileTagFilterBtn || mobileTagMenu.classList.contains("hidden")) return;
      
      const rect = mobileTagFilterBtn.getBoundingClientRect();
      const top = Math.round(rect.bottom + window.scrollY) + 10;
      const right = Math.max(8, window.innerWidth - rect.right);
      
      mobileTagMenu.style.position = "absolute";
      mobileTagMenu.style.top = `${top}px`;
      mobileTagMenu.style.right = `${right}px`;
      mobileTagMenu.style.left = "auto";
      mobileTagMenu.style.width = "140px";
      mobileTagMenu.style.zIndex = "100000";
      mobileTagMenu.style.transform = "none";
    };

    // 視窗縮放時重新對齊
    window.addEventListener("resize", placeMobileTagMenuNearButton);

    if (mobileTagFilterBtn) {
      mobileTagFilterBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (mobileTagMenu) {
          const isHidden = mobileTagMenu.classList.contains("hidden");
          if (isHidden) {
            mobileTagMenu.classList.remove("hidden");
            placeMobileTagMenuNearButton();
          } else {
            mobileTagMenu.classList.add("hidden");
          }
        }
      };
    }

    if (mobileTagMenu) {
      mobileTagMenu.onclick = (e) => e.stopPropagation();
    }

    // 點擊外面關閉選單
    document.addEventListener("click", () => {
      if (mobileTagMenu) mobileTagMenu.classList.add("hidden");
    });
  }

  function initScrollTopFab() {
    const scrollBtn = document.getElementById("v28CreateFab");
    const mobileScrollBtn = document.getElementById("mobileScrollTopFab");
    const createMenu = document.getElementById("v28CreateMenu");

    if (createMenu) {
      createMenu.style.display = "none";
      createMenu.setAttribute("aria-hidden", "true");
    }

    const arrowSvg = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 15.5L12 8.5L19 15.5"
          fill="none"
          stroke="currentColor"
          stroke-width="3.8"
          stroke-linecap="round"
          stroke-linejoin="round"/>
      </svg>`;

    function bindScrollTopButton(btn) {
      if (!btn) return;
      // 守衛：已綁定過就不重複添加 listener，避免多次呼叫疊加
      if (btn.dataset.scrollTopBound === "true") return;
      btn.dataset.scrollTopBound = "true";
      btn.setAttribute("aria-label", "回到頂部");
      btn.innerHTML = arrowSvg;
      btn.classList.add("scroll-top-fab");
      btn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, true);
    }

    bindScrollTopButton(scrollBtn);
    bindScrollTopButton(mobileScrollBtn);
  }


  function refreshViews() {
    const selectedCategory = categoryFilter.value;
    renderCategoryFilter(categoryFilter, selectedCategory);

    renderPostcards({
      grid,
      emptyState,
      onCardClick: openCardModal,
      onLikeClick: async (id) => {
        await togglePostcardLike(id);
        safeRefreshViews();
      },
      onCopyClick: handleCopyClick,
      onDeleteClick: handleDeleteClick,
      onShareClick: handleShareClick,
      onEditClick: handleEditClick,
      filters: getFilters(),
      page: currentPage,
      onPageChange: (newPage) => {
        currentPage = newPage;
        safeRefreshViews();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    renderMapList({ mapList, onSelect: selectMapItem, filters: getFilters() });

    if (currentModalCardId) {
      const item = getPostcardById(currentModalCardId);
      if (item) openCardModal(item);
    }

    updateSidebarCardCount();
  }

  function updateSidebarCardCount() {
    const el = document.getElementById("sidebarCardCount");
    const todayEl = document.getElementById("sidebarTodayCount");
    if (!el) return;
    try {
      if (typeof getPostcards !== "function") {
        el.textContent = "—";
        if (todayEl) todayEl.textContent = "—";
        return;
      }
      const cards = getPostcards();
      el.textContent = String(cards.length);

      if (todayEl) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localTodayStr = new Date(now.getTime() - offset).toISOString().split('T')[0];

        const todayCount = cards.filter(c => {
          if (!c.createdAt) return false;
          // 將 UTC ISO 字串轉為本地日期 YYYY-MM-DD 進行比對
          const cardDate = new Date(c.createdAt);
          const localCardStr = new Date(cardDate.getTime() - offset).toISOString().split('T')[0];
          return localCardStr === localTodayStr;
        }).length;
        todayEl.textContent = String(todayCount);
      }
    } catch (e) {
      el.textContent = "—";
      if (todayEl) todayEl.textContent = "—";
    }
  }

  setupImageUpload({
    fileInput,
    selectFileBtn,
    dropZone,
    pasteZone,
    onImageLoaded: showPreview,
    onError: message => { setUploadLoading(false); setMessage(message, true); },
    onStart: message => setUploadLoading(true, message),
    onDone: () => setUploadLoading(false)
  });

  // V32：已取消 URL 連結搜尋，只保留上傳、拖曳、Ctrl+V 貼圖。

  if (modeFileBtn) modeFileBtn.addEventListener("click", () => setUploadMode("file"));
  if (modeDragBtn) modeDragBtn.addEventListener("click", () => setUploadMode("drag"));
  if (modePasteBtn) modePasteBtn.addEventListener("click", () => setUploadMode("paste"));

  collectionViewBtn.addEventListener("click", () => setView("collection"));
  mapViewBtn.addEventListener("click", () => setView("map"));
  if (previewModeBtn) previewModeBtn.addEventListener("click", togglePreviewMode);

  searchInput.addEventListener("input", () => {
    currentPage = 1;
    safeRefreshViews();
  });
  categoryFilter.addEventListener("change", () => {
    currentPage = 1;
    safeRefreshViews();
  });
  locationInput.addEventListener("change", autoFillCountryFromLocation);
  locationInput.addEventListener("blur", autoFillCountryFromLocation);

  clearImageBtn.addEventListener("click", clearPreview);
  closeCardModalBtn.addEventListener("click", closeCardModal);
  cardModalBackdrop.addEventListener("click", closeCardModal);
  modalShareCardBtn.addEventListener("click", () => {
    if (currentModalCardId) handleShareClick(currentModalCardId);
  });

  document.addEventListener("keydown", event => {
    if (cardModal.classList.contains("hidden")) return;
    if (event.key === "Escape") { closeCardModal(); return; }
    if (event.key === "ArrowLeft")  { event.preventDefault(); navigateModal(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); navigateModal(1); }
  });

  // 觸控左右滑動切換
  let _swipeStartX = 0;
  cardModal.addEventListener("touchstart", e => {
    _swipeStartX = e.touches[0].clientX;
  }, { passive: true });
  cardModal.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - _swipeStartX;
    if (Math.abs(dx) > 50) navigateModal(dx < 0 ? 1 : -1);
  }, { passive: true });

  if (modalPrevBtn) modalPrevBtn.addEventListener("click", e => { e.stopPropagation(); navigateModal(-1); });
  if (modalNextBtn) modalNextBtn.addEventListener("click", e => { e.stopPropagation(); navigateModal(1); });

  const uploadModal = document.getElementById("uploadModal");
  const uploadModalBackdrop = document.getElementById("uploadModalBackdrop");
  const closeUploadModalBtn = document.getElementById("closeUploadModalBtn");
  const openUploadBtn = document.getElementById("openUploadBtn");

  function openUploadModal() {
    if (uploadModal) {
      // 根據權限設定介面顯示
      const publicUnlockWrapper = document.getElementById("publicUnlockWrapper");
      const userUploadNotice = document.getElementById("userUploadNotice");
      
      if (isAdmin) {
        if (publicUnlockWrapper) publicUnlockWrapper.style.display = "block";
        if (userUploadNotice) userUploadNotice.style.display = "none";
        if (publicUnlockInput) publicUnlockInput.checked = false; // 管理員預設隱私
      } else {
        if (publicUnlockWrapper) publicUnlockWrapper.style.display = "none";
        if (userUploadNotice) userUploadNotice.style.display = "block";
        if (publicUnlockInput) publicUnlockInput.checked = true; // 一般會員預設公開 (但實際上由 storage.js 覆蓋為 pending/hidden)
      }

      // 隱藏/顯示管理員專屬標籤選項
      document.querySelectorAll(".admin-only-option").forEach(opt => {
        opt.style.display = isAdmin ? "block" : "none";
      });

      uploadModal.classList.remove("hidden");
      document.body.classList.add("modal-open");
    }
  }

  function closeUploadModal() {
    if (uploadModal) {
      uploadModal.classList.add("hidden");
      document.body.classList.remove("modal-open");
    }
  }

  if (openUploadBtn) {
    openUploadBtn.addEventListener("click", openUploadModal);
  }

  if (closeUploadModalBtn) {
    closeUploadModalBtn.addEventListener("click", closeUploadModal);
  }

  if (uploadModalBackdrop) {
    uploadModalBackdrop.addEventListener("click", closeUploadModal);
  }

  addCardBtn.addEventListener("click", async function () {
    const imageData = getCurrentImageData();

    if (!imageData) {
      alert("請先上傳圖片");
      return;
    }

    const location = parseLocation(locationInput.value);

    if (!location) {
      alert("請輸入正確座標，例如：43.587789, 142.465553");
      return;
    }

    const detectedCountry = location.country || "全球";
    const category = String(categoryInput.value || "").trim() || detectedCountry || "全球";

    addCardBtn.disabled = true;
    setMessage("明信片新增中…");

    try {
      await addPostcard({
        image: imageData,
        category,
        likedBy: [],
        likeCount: 0,
        locationText: location.locationText,
        lat: location.lat,
        lng: location.lng,
        tag: tagInput ? tagInput.value : "",
        author: authorInput ? authorInput.value : "",
        source: sourceInput ? sourceInput.value : "",
        websiteUrl: websiteInput ? websiteInput.value : "",
        note: noteInput ? noteInput.value : "",
        publicUnlock: publicUnlockInput ? publicUnlockInput.checked : true,
        createdAt: new Date().toISOString()
      });

      safeRefreshViews();
      clearPreview();
      // 立刻關閉上傳視窗
      if (typeof closeUploadModal === "function") closeUploadModal();
      
      setMessage("✨ 感謝你的分享！我們會協助整理地點與標籤，讓這張明信片更容易被大家找到。✨");
      
      // 顯示精美感謝彈窗
      const successModal = document.getElementById("successModal");
      const closeSuccessBtn = document.getElementById("closeSuccessBtn");
      if (successModal) {
        successModal.classList.remove("hidden");
        if (closeSuccessBtn) {
          closeSuccessBtn.onclick = () => {
            successModal.classList.add("hidden");
          };
        }
      }

      locationInput.value = "";
      categoryInput.value = "";
      if (tagInput) tagInput.value = "";
      if (authorInput) authorInput.value = "";
      if (sourceInput) sourceInput.value = "";
      if (websiteInput) websiteInput.value = "";
      if (noteInput) noteInput.value = "";
      updateNoteSuggestions();
    } catch (error) {
      console.error(error);
      setMessage("新增失敗，請再試一次", true);
      alert("上傳失敗：" + (error.message || "未知錯誤"));
    } finally {
      addCardBtn.disabled = false;
    }
  });

  bindTagFilterButtons();
  initScrollTopFab();
  applyPreviewMode();
  setUploadMode("file");
  setView("collection");

  initializeFirebaseStorage(function () {
    // 關鍵：在初始化回呼中抓取最新參照
    window.db = window.db || null;
    window.auth = window.auth || null;
    // 使用全域參照確保 initAppFeatures 能讀到
    if (typeof db === "undefined") window.db = window.db;
    if (typeof auth === "undefined") window.auth = window.auth;

    initAppFeatures();
    safeRefreshViews();
    updateNoteSuggestions();
    openSharedCardFromUrl();
    updateFeaturedCard();
  });

  function updateFeaturedCard() {
    const cards = getPostcards();
    if (!cards || cards.length === 0) return;

    // 使用日期作為種子，確保每個人在同一天看到的精選都一樣
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    
    const index = seed % cards.length;
    const item = cards[index];

    const container = document.getElementById("featuredCardContainer");
    const img = document.getElementById("featuredCardImg");
    const title = document.getElementById("featuredCardTitle");
    const author = document.getElementById("featuredCardAuthor");

    if (container && img && item) {
      img.src = item.image;
      title.textContent = item.locationText || "未命名地點";
      author.textContent = item.author ? `by ${item.author}` : "";
      container.classList.remove("hidden");

      container.onclick = () => {
        openCardModal(item);
      };
    }
  }

  // ===== Dedicated Mobile Upload Button（唯一控制）=====
  const mobileUploadFab = document.getElementById("mobileUploadFab");
  
  // V38: 強制隱藏桌機版重複加號的 JS 防護
  function syncFabVisibility() {
    if (!mobileUploadFab) return;
    if (window.innerWidth >= 1024) {
      mobileUploadFab.style.setProperty("display", "none", "important");
    } else {
      // 只有在非瀏覽模式且非彈窗開啟時才顯示
      const isBrowse = document.body.classList.contains("is-browse-mode");
      const isModal = document.body.classList.contains("modal-open");
      if (!isBrowse && !isModal) {
        mobileUploadFab.style.setProperty("display", "flex", "important");
      }
    }
  }
  window.addEventListener("resize", syncFabVisibility);
  syncFabVisibility();

  const sidebar = document.querySelector(".sidebar");

  if (mobileUploadFab && sidebar) {
    // V33：手機版直接開啟上傳視窗，不拉側邊欄
    mobileUploadFab.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof openUploadModal === "function") {
        openUploadModal();
      } else {
        // Fallback if defined in another scope
        const uploadModal = document.getElementById("uploadModal");
        if (uploadModal) {
          uploadModal.classList.remove("hidden");
          document.body.classList.add("modal-open");
        }
      }
    });

    document.addEventListener("click", (e) => {
      if (window.innerWidth > 768) return;
      if (!sidebar.classList.contains("open")) return;
      if (sidebar.contains(e.target)) return;
      if (mobileUploadFab.contains(e.target)) return;
      sidebar.classList.remove("open");
      mobileUploadFab.textContent = "＋";
    });
  }

  // V28 Create Menu Actions
  document.querySelectorAll("[data-v28-action='upload']").forEach(btn => {
    btn.addEventListener("click", () => {
      const createMenu = document.getElementById("v28CreateMenu");
      if (createMenu) {
        createMenu.classList.add("hidden");
        createMenu.style.display = "none";
      }
      if (typeof openUploadModal === "function") {
        openUploadModal();
      }
    });
  });

  // 常用國家快速填寫
  document.querySelectorAll(".quick-country-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const countryInput = document.getElementById("categoryInput");
      if (countryInput) {
        countryInput.value = btn.getAttribute("data-country");
        // 觸發事件以便其他邏輯（如自動儲存）能偵測到變化
        countryInput.dispatchEvent(new Event("change"));
        countryInput.dispatchEvent(new Event("input"));
      }
    });
  });

  // V38：標籤篩選已在主初始化內綁定；這裡避免跨作用域重複呼叫造成錯誤
  if (typeof bindTagFilterButtons === "function") bindTagFilterButtons();
  
  // V38: 導出 openCardModal 讓外部的隨機 Discovery 按鈕可使用
  window.openCardModal = openCardModal;
});

// ⭐ Hero 收合控制
function toggleHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  hero.classList.toggle('collapsed');
}
// 座標複製已由 render.js 的 coords addEventListener 統一處理
// 此處全局 handler 已移除，避免觸發雙 toast


/* =========================================================
   V34.1 地圖模式：滾動時顯示滑桿，停止後自動隱藏
========================================================= */
(function setupMapAutoScrollbar() {
  const selectors = [
    ".map-mode .map-list",
    ".map-mode .map-results",
    ".map-mode .postcard-list",
    ".map-mode .card-list",
    ".map-mode .map-sidebar",
    ".map-mode .left-panel"
  ];

  function bindAutoScrollbar(el) {
    if (!el || el.dataset.autoScrollbarBound === "true") return;

    el.dataset.autoScrollbarBound = "true";
    let timer = null;

    let isScrollingUpdatePending = false;
    el.addEventListener("scroll", () => {
      if (!isScrollingUpdatePending) {
        isScrollingUpdatePending = true;
        requestAnimationFrame(() => {
          el.classList.add("is-scrolling");
          isScrollingUpdatePending = false;
        });
      }

      clearTimeout(timer);
      timer = setTimeout(() => {
        el.classList.remove("is-scrolling");
      }, 250); // 縮短時間讓反應更輕快
    }, { passive: true });
  }

  function init() {
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(bindAutoScrollbar);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // 若地圖模式內容是後來動態產生，也會自動補綁定
  const observer = new MutationObserver(init);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();


/* =========================================================
   V34.2 地圖模式：自動綁定左側清單滑桿顯示狀態
========================================================= */
(function setupMapScrollbarFixed() {
  const selectors = [
    ".map-mode .map-list",
    ".map-mode .map-results",
    ".map-mode .map-card-list",
    ".map-mode .postcard-list",
    ".map-mode .card-list",
    ".map-mode .map-sidebar",
    ".map-mode .left-panel",
    ".map-mode .map-left",
    ".map-mode .map-list-panel",
    ".map-mode #mapList",
    ".map-mode #mapResults",
    ".map-mode #postcardList"
  ];

  function bind(el) {
    if (!el || el.dataset.mapScrollbarFixed === "true") return;
    el.dataset.mapScrollbarFixed = "true";

    let timer = null;
    let isScrollingUpdatePending = false;
    el.addEventListener("scroll", () => {
      if (!isScrollingUpdatePending) {
        isScrollingUpdatePending = true;
        requestAnimationFrame(() => {
          el.classList.add("is-scrolling");
          isScrollingUpdatePending = false;
        });
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.classList.remove("is-scrolling");
      }, 250);
    }, { passive: true });
  }

  function init() {
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(bind);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  new MutationObserver(init).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();

// V38：隨機傳送功能
window.handleRandomDiscovery = function() {
  const cards = getPostcards();
  if (!cards || cards.length === 0) return;
  
  const randomIndex = Math.floor(Math.random() * cards.length);
  const item = cards[randomIndex];
  
  if (document.body.classList.contains("map-mode")) {
    const browseTab = document.querySelector(".view-button[data-view='collection']");
    if (browseTab) browseTab.click();
  }
  
  openCardModal(item);
  
  const btn = document.getElementById("randomCardBtn");
  if (btn) {
    btn.style.transition = "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    btn.style.transform = "scale(1.5) rotate(360deg)";
    setTimeout(() => {
      btn.style.transform = "";
    }, 500);
  }
};

// === 自動化地點資訊擴充 (逆地理編碼) ===

function createInfoSection() {
  const container = document.createElement("div");
  container.id = "modalCardInfoContainer";
  container.style.marginTop = "0px";
  container.style.marginBottom = "0px"; 
  
  // 插入到整個資訊清單 (modal-info-list) 之前
  const infoList = document.querySelector(".modal-info-list");
  if (infoList && infoList.parentNode) {
    // 1. 新增：上方分隔線
    const hrTop = document.createElement("hr");
    hrTop.id = "modalInfoDividerTop";
    hrTop.style.cssText = "border: 0; border-top: 1px solid rgba(0,0,0,0.08); margin: 5px 0 12px 0;";
    infoList.parentNode.insertBefore(hrTop, infoList);

    // 2. 插入地點資訊容器
    infoList.parentNode.insertBefore(container, infoList);
    
    // 3. 在地點資訊下方插入分隔線
    const hrBottom = document.createElement("hr");
    hrBottom.id = "modalInfoDividerNew";
    hrBottom.style.cssText = "border: 0; border-top: 1px solid rgba(0,0,0,0.08); margin: 12px 0;";
    infoList.parentNode.insertBefore(hrBottom, infoList);
  }
  return container;
}

async function renderLocationDetails(item, container) {
  const isLocked = Boolean(window.PikminAuthGate && window.PikminAuthGate.shouldLockItem && window.PikminAuthGate.shouldLockItem(item));
  
  // 如果鎖定中，顯示簡單提示
  if (isLocked) {
    container.innerHTML = `
      <details style="cursor:pointer; color:#9ca3af;">
        <summary style="font-weight:bold; list-style:none; display:flex; align-items:center; gap:5px; font-size:14px;">
          📍 地點資訊 <span style="font-size:10px;">▾</span>
        </summary>
        <div style="padding:10px 0; font-size:13px;">登入後即可查看詳細地點與地址</div>
      </details>
    `;
    return;
  }

  // 初始結構
  container.innerHTML = `
    <details id="locationDetailsFold" style="cursor:pointer;">
      <summary style="font-weight:bold; list-style:none; display:flex; align-items:center; gap:5px; font-size:14px; color:#374151;">
        📍 地點資訊 <span style="font-size:10px;">▾</span>
      </summary>
      <div id="locationDetailsContent" style="padding:12px 0 0 5px; font-size:13px; line-height:1.6; color:#4b5563;">
        <div style="margin-bottom:10px;">
          <b style="color:#1f2937; display:block;">地點名稱：</b>
          <span id="locPlaceName">${item.placeName || "讀取中..."}</span>
        </div>
        <div>
          <b style="color:#1f2937; display:block;">地址/區域：</b>
          <span id="locAddress">${item.address || "讀取中..."}</span>
        </div>
      </div>
    </details>
  `;

  // 如果已經有詳細資料且分類不是全球，就不再重複抓取
  if (item.placeName && item.address && item.category && item.category !== "全球") return;

  // 否則開始抓取
  try {
    const info = await fetchReverseGeocode(item.lat, item.lng);
    if (info) {
      const pName = document.getElementById("locPlaceName");
      const pAddr = document.getElementById("locAddress");
      if (pName) pName.textContent = info.placeName;
      if (pAddr) pAddr.textContent = info.address;
      
      // 自動回寫到資料庫，包含國家分類修正
      autoUpdatePostcardDetails(item, info);
    } else {
      const pName = document.getElementById("locPlaceName");
      if (pName) pName.textContent = "暫無資料";
    }
  } catch (e) {
    console.error("抓取地點資訊失敗", e);
  }
}

async function fetchReverseGeocode(lat, lng) {
  try {
    // 使用 OpenStreetMap Nominatim API
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh-TW`;
    const res = await fetch(url, { headers: { 'User-Agent': 'PikminCollectionApp/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    
    return {
      placeName: data.name || data.display_name.split(',')[0],
      address: data.display_name,
      country: data.address ? data.address.country : null
    };
  } catch (e) {
    return null;
  }
}

async function autoUpdatePostcardDetails(item, info) {
  if (typeof updatePostcardSmart === "function") {
    const updates = {
      placeName: info.placeName,
      address: info.address
    };

    // 更加智慧的分類修正：
    // 如果目前分類是「全球」、空白，或是與最新判定結果不符，就自動更新分類
    let newlyDetected = typeof window.detectCountry === "function" 
      ? window.detectCountry(item.lat, item.lng, info.address) 
      : (info.country || "全球");

    // 額外機制：如果內部規則判定為「全球」，但 OSM 地址有明確國家資訊，則信任地址資訊
    if (newlyDetected === "全球" && info.country) {
      newlyDetected = info.country;
    }

    if (item.category !== newlyDetected && newlyDetected !== "全球") {
      updates.category = newlyDetected;
      console.log(`[AutoFix] 將明信片 ${item.id} 的分類從 ${item.category || "空白"} 更新為 ${newlyDetected}`);
    }

    // 靜默更新
    await updatePostcardSmart(item.id, updates);
  }
}



