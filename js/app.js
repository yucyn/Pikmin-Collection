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
      try {
        const res = await fetch(`/api/link-preview?url=${encoded}`);
        if (res.ok) {
          const data = await res.json();
          if (data && (data.title || data.image)) return data;
        }
      } catch (e) { }

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
      } catch (e) { }
      return null;
    }

    async function renderBulletinWithPreview(text) {
      if (!text) return "";
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (!urlMatch) {
        return text.replace(/\n/g, "<br>");
      }
      const url = urlMatch[0];
      const preview = await fetchLinkPreview(url);
      if (!preview || (!preview.title && !preview.image)) {
        return "";
      }
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
        setTimeout(() => {
          currentLineIndex = (currentLineIndex + 1) % bulletinLines.length;
          renderBulletinWithPreview(bulletinLines[currentLineIndex]).then(html => {
            setBulletinHTML(html);
          });
          bulletinContent.style.opacity = 1;
        }, 500);
      }, 5000);
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

    configDoc.onSnapshot((doc) => {
      if (doc.exists) {
        const config = doc.data();
        if (config.siteTitle) document.getElementById("siteTitle").innerText = config.siteTitle;
        if (config.siteSubtitle) document.getElementById("siteSubtitle").innerText = config.siteSubtitle;
      }
    });

    statsDoc.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    statsDoc.onSnapshot((doc) => {
      if (doc.exists && viewCountEl) viewCountEl.innerText = doc.data().count || 0;
    });

    const onlineCountEl = document.getElementById("onlineCount");
    const presenceColl = db.collection("presence");
    
    const updatePresence = () => {
      const user = auth.currentUser;
      const uid = user ? user.uid : "anonymous_" + Math.random().toString(36).substring(7);
      presenceColl.doc(uid).set({ 
        lastSeen: Date.now(),
        isAdmin: isAdmin 
      }, { merge: true }).catch(e => {
        console.warn("Presence write failed:", e);
      });
    };

    updatePresence();
    setInterval(updatePresence, 60000); 

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
          if (data.lastSeen && data.lastSeen > fiveMinsAgo) onlineCount++;
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

    if (isAdmin) window.startPresenceListener();

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

    window.handleFixGPSErrors = async () => {
      if (!isAdmin) return;
      const cards = getPostcards();
      if (!cards || cards.length === 0) {
        alert("目前沒有載入任何明信片資料。");
        return;
      }
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
      const confirmMsg = `發現 ${updates.length} 張明信片的國家標籤與最新 GPS 規則不符。\n\n確定要一鍵修正所有標籤嗎？`;
      if (!confirm(confirmMsg)) return;

      const btn = document.getElementById("fixGpsBtn");
      const originalText = btn.innerText;
      btn.disabled = true;
      btn.innerText = "⏳ 修正中...";

      try {
        let count = 0;
        for (const up of updates) {
          await updatePostcard(up.id, { category: up.newCategory });
          count++;
          btn.innerText = `⏳ 修正中 (${count}/${updates.length})...`;
        }
        alert(`🎉 修正完成！共更新了 ${count} 張明信片的國家標籤。`);
      } catch (err) {
        console.error("Batch update failed:", err);
        alert("修正過程中發生錯誤。");
      } finally {
        btn.disabled = false;
        btn.innerText = originalText;
      }
    };
  }

  function updateNoteSuggestions() {
    const noteSuggestions = document.getElementById("noteSuggestions");
    if (!noteSuggestions) return;
    const postcards = getPostcards();
    const uniqueNotes = new Set();
    postcards.forEach(item => {
      if (item.note) {
        const tags = item.note.match(/#[\w\u4e00-\u9fa5]+/g);
        if (tags) tags.forEach(t => uniqueNotes.add(t));
        else {
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
    let user = null;
    try {
      if (window.firebase && typeof firebase.auth === "function") user = firebase.auth().currentUser;
    } catch (e) {}

    if (isPreviewMode && (!user || user.isAnonymous)) {
      isPreviewMode = false;
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
    if (mobileTagMenu) mobileTagMenu.classList.add("hidden");
    safeRefreshViews();
  }

  function togglePreviewMode() {
    const user = firebase.auth().currentUser;
    if (!user || user.isAnonymous) {
      alert("請先登入後才能開啟瀏覽功能唷！🌱");
      if (window.PikminAuthGate) window.PikminAuthGate.openPanel();
      return;
    }
    isPreviewMode = !isPreviewMode;
    applyPreviewMode();
    const url = new URL(window.location.href);
    if (isPreviewMode) {
      url.searchParams.set("mode", "preview");
      navigator.clipboard?.writeText(url.toString()).catch(() => {});
      alert("已切換為預覽模式。");
    } else {
      url.searchParams.delete("mode");
      url.searchParams.delete("card");
    }
    window.history.replaceState({}, "", url);
    safeRefreshViews();
  }

  if (browseModeBtn) browseModeBtn.addEventListener("click", togglePreviewMode);

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
    if (mode === "paste") { pasteZone.focus(); setMessage("貼上模式已啟用。"); }
    else if (mode === "drag") setMessage("拖曳模式已啟用。");
    else setMessage("");
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
      if (list.length > 0) selectMapItem(list[0]);
      else { mapFrame.src = ""; mapEmpty.classList.remove("hidden"); }
    }
  }

  function showPreview(imageData) {
    setCurrentImageData(imageData);
    previewImage.src = imageData;
    previewBox.classList.remove("hidden");
    dropZone?.classList.add("has-image");
    setUploadLoading(false);
    setMessage("✅ 圖片已載入，正在自動分析樣式...");
    autoDetectTagFromImage(imageData);
  }

  async function autoDetectTagFromImage(imageData) {
    try {
      const img = new Image(); img.src = imageData;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = 300; canvas.height = 200;
      ctx.drawImage(img, 0, 0, 300, 200);
      const rightWidth = 90; const startY = 70; const analysisHeight = 200 - startY;
      const imageDataObj = ctx.getImageData(300 - rightWidth, startY, rightWidth, analysisHeight);
      const pixels = imageDataObj.data;
      let middleYellow = 0; let bottomYellow = 0; let colorfulPixels = 0; let pureWhiteInBottom = 0; let greenStampCount = 0; let sampleCount = 0;
      const midBoundary = 50; 
      for (let i = 0; i < pixels.length; i += 16) { 
        const pixelIndex = i / 4; const x = pixelIndex % rightWidth; const y = Math.floor(pixelIndex / rightWidth);
        const r = pixels[i]; const g = pixels[i+1]; const b = pixels[i+2]; sampleCount++;
        const isYellow = (r > 210 && g > 180 && b < 130);
        if (isYellow) { if (y < midBoundary) middleYellow++; else bottomYellow++; }
        if (g > 80 && g > r * 2 && Math.abs(g - b) < 60 && y > midBoundary && x > rightWidth * 0.4) greenStampCount++;
        const max = Math.max(r, g, b); const min = Math.min(r, g, b);
        if ((max - min) > 15 && max > 60) colorfulPixels++;
        if (y > midBoundary && r > 245 && g > 245 && b > 245) pureWhiteInBottom++;
      }
      let finalTag = "隱藏";
      const totalYellow = middleYellow + bottomYellow;
      if (greenStampCount > 10) finalTag = "蘑菇";
      else if (colorfulPixels > sampleCount * 0.25) finalTag = "花";
      else if (totalYellow > 120) finalTag = "花";
      else if (pureWhiteInBottom > (sampleCount / 2) * 0.20) finalTag = "花";
      else if (middleYellow > 8) finalTag = "蘑菇";
      else if (colorfulPixels > sampleCount * 0.12) finalTag = "花";
      else finalTag = "隱藏";
      if (tagInput) { tagInput.value = finalTag; setMessage(`✅ 圖片已載入，自動判定標籤：${finalTag}`); }
    } catch (err) { console.error("Auto detect failed:", err); setMessage("✅ 圖片已載入 (樣式分析失敗)"); }
  }

  function clearPreview() {
    clearCurrentImageData(); previewImage.removeAttribute("src");
    previewBox.classList.add("hidden"); dropZone?.classList.remove("has-image");
    setMessage("");
  }

  function autoFillCountryFromLocation() {
    const location = parseLocation(locationInput.value); if (!location) return;
    const detectedCountry = location.country || "全球";
    if (!categoryInput.value || categoryInput.value === "全球") categoryInput.value = detectedCountry;
    if (detectedCountry !== "全球") setMessage(`已自動判定國家：${detectedCountry}`);
  }

  function createCardShareUrl(cardId) {
    const url = new URL(window.location.href); url.searchParams.set("mode", "preview"); url.searchParams.set("card", cardId);
    return url.toString();
  }

  function updateModalNavState() {
    const list = getFilteredPostcards(getFilters()); const hasMultiple = list.length > 1;
    if (modalPrevBtn) modalPrevBtn.dataset.hidden = hasMultiple ? "false" : "true";
    if (modalNextBtn) modalNextBtn.dataset.hidden = hasMultiple ? "false" : "true";
  }

  function openCardModal(item) {
    currentModalCardId = item.id; const index = getPostcards().findIndex(card => card.id === item.id);
    const doUpdate = () => {
      const isV37Locked = Boolean(window.PikminAuthGate && window.PikminAuthGate.shouldLockItem(item));
      modalCardImage.src = item.image;
      let currentUser = null; try { if (window.firebase && firebase.auth) currentUser = firebase.auth().currentUser; } catch(e){}
      const isRealUser = !!(currentUser && !currentUser.isAnonymous);
      const isFirebaseAdmin = window.PikminAuthGate && typeof window.PikminAuthGate.isFirebaseAdmin === "function" && window.PikminAuthGate.isFirebaseAdmin();
      const isOwner = typeof isOwnedByCurrentUser === "function" && isOwnedByCurrentUser(item);
      const canManage = isFirebaseAdmin || (isRealUser && isOwner);
      const adminRarity = (isFirebaseAdmin && item.rarity && item.rarity !== "0") ? `<span class="admin-rarity-badge">💎 ${"⭐".repeat(parseInt(item.rarity))}</span>` : "";
      modalCardTitle.innerHTML = `No.${String(index + 1).padStart(3, "0")} ${adminRarity}`;
      const noteSuffix = item.note ? `｜${item.note}` : "";
      const locationText = isV37Locked ? "待解鎖" : item.locationText;
      const displayLocation = isV37Locked ? locationText : `<span class="copyable-coords" onclick="copyToClipboard('${item.lat}, ${item.lng}', this)">${locationText}</span>`;
      modalCardLocation.innerHTML = `${item.category || "全球"}｜${displayLocation}${noteSuffix}`;
      cardModal.classList.toggle("v37-modal-locked", isV37Locked);
      modalMapLink.href = isV37Locked ? "javascript:void(0)" : createGoogleMapUrl(item.lat, item.lng);
      modalMapLink.textContent = isV37Locked ? "解鎖開啟地圖" : "Open Google Map";
      modalMapLink.onclick = isV37Locked ? function(event) { event.preventDefault(); if (window.PikminAuthGate) window.PikminAuthGate.openPanel(); } : null;
      const infoContainer = document.getElementById("modalCardInfoContainer") || createInfoSection();
      renderLocationDetails(item, infoContainer);
      if (modalEditBtn) {
        modalEditBtn.style.display = (canManage && !isPreviewMode) ? "block" : "none";
        modalEditBtn.onclick = (e) => { e.stopPropagation(); closeCardModal(); handleEditClick(item); };
      }
      if (modalCardAuthor) { modalCardAuthor.textContent = item.author || ""; if (modalCardAuthorRow) modalCardAuthorRow.style.display = item.author ? "flex" : "none"; }
      if (modalCardSource) { modalCardSource.textContent = item.source || ""; if (modalCardSourceRow) modalCardSourceRow.style.display = item.source ? "flex" : "none"; }
      if (modalCardWebsite) {
        if (item.websiteUrl) modalCardWebsite.innerHTML = `<a href="${item.websiteUrl}" target="_blank" class="visit-website-link">造訪網站</a>`;
        else modalCardWebsite.innerHTML = "";
        if (modalCardWebsiteRow) modalCardWebsiteRow.style.display = item.websiteUrl ? "flex" : "none";
      }
      const modalLikeBtn = document.getElementById("modalLikeBtn");
      if (modalLikeBtn) {
        const isLiked = typeof isLikedByCurrentUser === "function" ? isLikedByCurrentUser(item) : false;
        const initialCount = Number(item.likeCount || 0);
        modalLikeBtn.innerHTML = `${isLiked ? "❤️" : "🤍"} <span class="modal-like-count">${formatLikeCount(initialCount)}</span>`;
        modalLikeBtn.classList.toggle("active", isLiked);
        modalLikeBtn.onclick = async (e) => {
          e.preventDefault(); e.stopPropagation(); if (modalLikeBtn.dataset.busy === "true") return;
          modalLikeBtn.dataset.busy = "true";
          const oldLiked = modalLikeBtn.classList.contains("active");
          const oldCountEl = modalLikeBtn.querySelector(".modal-like-count");
          const oldCount = parseInt(oldCountEl?.textContent || "0", 10) || 0;
          const nextLiked = !oldLiked; const nextCount = Math.max(0, oldCount + (nextLiked ? 1 : -1));
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
            modalLikeBtn.innerHTML = `${oldLiked ? "❤️" : "🤍"} <span class="modal-like-count">${formatLikeCount(oldCount)}</span>`;
            modalLikeBtn.classList.toggle("active", oldLiked);
            alert("愛心操作失敗");
          } finally { modalLikeBtn.dataset.busy = "false"; }
        };
      }
      requestAnimationFrame(() => modalCardImage.classList.remove("img-fade"));
    };
    if (!cardModal.classList.contains("hidden")) { modalCardImage.classList.add("img-fade"); setTimeout(doUpdate, 180); }
    else doUpdate();
    const url = new URL(window.location.href); url.searchParams.set("card", item.id); window.history.replaceState({}, "", url);
    cardModal.classList.remove("hidden"); document.body.classList.add("modal-open"); updateModalNavState();
  }

  function closeCardModal() {
    currentModalCardId = null; const url = new URL(window.location.href); url.searchParams.delete("card"); window.history.replaceState({}, "", url);
    cardModal.classList.add("hidden"); document.body.classList.remove("modal-open");
  }

  function navigateModal(direction) {
    if (!currentModalCardId) return;
    const list = getFilteredPostcards(getFilters()); if (list.length <= 1) return;
    const idx = list.findIndex(c => String(c.id) === String(currentModalCardId)); if (idx === -1) return;
    const next = list[(idx + direction + list.length) % list.length]; openCardModal(next);
  }

  function openSharedCardFromUrl() {
    const cardId = new URLSearchParams(window.location.search).get("card"); if (!cardId) return;
    const item = getPostcardById(cardId); if (item) openCardModal(item);
  }

  function selectMapItem(item) {
    mapFrame.src = createGoogleMapEmbedUrl(item.lat, item.lng); mapEmpty.classList.add("hidden"); setActiveMapItem(mapList, item.id);
  }

  async function handleLikeClick(id) { try { await togglePostcardLike(id); } catch (error) { console.warn(error); } }

  function showToast(message) {
    const existing = document.querySelector(".copy-toast"); if (existing) existing.remove();
    const toast = document.createElement("div"); toast.className = "copy-toast"; toast.textContent = message; document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1600);
  }

  async function handleCopyClick(locationText) {
    try { await navigator.clipboard.writeText(locationText); showToast("已複製座標"); }
    catch {
      const tempInput = document.createElement("input"); tempInput.value = locationText; document.body.appendChild(tempInput);
      tempInput.select(); document.execCommand("copy"); tempInput.remove(); showToast("已複製座標");
    }
  }

  async function handleShareClick(cardId) {
    const shareUrl = createCardShareUrl(cardId);
    try { await navigator.clipboard.writeText(shareUrl); showToast("已複製單一卡片分享連結"); }
    catch { prompt("請複製這個分享連結", shareUrl); }
  }

  async function handleDeleteClick(id) {
    if (isPreviewMode) { alert("預覽模式不能刪除卡片"); return; }
    if (!confirm("確定要刪除這張明信片嗎？")) return;
    try { await deletePostcard(id); showToast("卡片已刪除"); }
    catch (error) { alert(`刪除失敗：${error.message}`); }
  }

  function ensureEditModal() {
    let modal = document.getElementById("editModal");
    const hasCompleteStructure = modal && modal.querySelector("#editForm") && modal.querySelector("#editSaveBtn");
    if (hasCompleteStructure) return modal;
    if (modal) modal.remove();
    modal = document.createElement("section"); modal.id = "editModal"; modal.className = "edit-modal hidden";
    modal.innerHTML = `
      <div class="edit-modal-backdrop" data-edit-close="true"></div>
      <form id="editForm" class="edit-modal-panel">
        <button type="button" id="closeEditModalBtn" class="edit-modal-close">×</button>
        <h2>編輯明信片</h2>
        <div class="sidebar-form-grid">
          <div class="field-full"><label>GPS座標</label><input id="editLocationInput" type="text" required /></div>
          <div class="field-half"><label>國家</label><select id="editCategoryInput"><option value="全球">全球</option><option value="台灣">台灣</option><option value="日本">日本</option><option value="韓國">韓國</option><option value="香港">香港</option><option value="澳門">澳門</option><option value="泰國">泰國</option><option value="新加坡">新加坡</option><option value="馬來西亞">馬來西亞</option><option value="越南">越南</option><option value="美國">美國</option><option value="加拿大">加拿大</option><option value="澳洲">澳洲</option><option value="英國">英國</option><option value="法國">法國</option><option value="德國">德國</option></select></div>
          <div class="field-half"><label>標籤</label><select id="editTagInput" required><option value="活動">活動</option><option value="花">花</option><option value="蘑菇">蘑菇</option><option value="隱藏">隱藏</option><option value="絕版">絕版</option></select></div>
          <div id="editRarityRow" class="field-full" style="display:none;"><label>💎 稀有度</label><select id="editRarityInput"><option value="0">未標註</option><option value="1">⭐</option><option value="2">⭐⭐</option><option value="3">⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="5">⭐⭐⭐⭐⭐</option></select></div>
          <div class="field-half"><label>上傳者</label><input id="editAuthorInput" type="text" /></div>
          <div class="field-half"><label>備註</label><input id="editNoteInput" type="text" list="noteSuggestions" /></div>
          <div class="field-half"><label>網站</label><input id="editWebsiteInput" type="text" /></div>
          <div class="field-half"><label>來源</label><input id="editSourceInput" type="text" /></div>
        </div>
        <div id="editImageFocusPreview" class="edit-image-focus-preview"><img id="editImageFocusImage" /></div>
        <div class="edit-image-focus-actions">
          <button type="button" id="replaceImageBtn" class="edit-image-focus-reset" style="background:var(--green); color:white;">更換圖片</button>
          <button type="button" id="deletePostcardBtn" class="edit-image-focus-reset" style="background:#ef4444; color:white;">刪除卡片</button>
        </div>
        <div class="field-full v37-edit-admin-unlock" id="v37EditAdminUnlockBlock" style="display:none; border: 2px solid var(--green); padding: 10px; border-radius: 8px; margin-top: 15px;">
          <label style="font-weight:800; color: var(--green-dark);">🛡️ 管理員審核</label>
          <select id="editReviewStatus"><option value="pending">待審核</option><option value="approved">已通過</option><option value="rejected">未通過</option></select>
          <select id="editVisibility"><option value="public">公開</option><option value="members">會員</option><option value="hidden">隱藏</option></select>
          <label><input type="checkbox" id="editIsHidden" /> 徹底隱藏</label>
          <label><input type="checkbox" id="editRequirePlayerUnlock" /> 須登入查看</label>
        </div>
        <button type="button" id="editSaveBtn" class="edit-save-btn">儲存變更</button>
      </form>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target.dataset.editClose === "true" || e.target.id === "closeEditModalBtn") closeEditModal(); });
    return modal;
  }

  function closeEditModal() { const m = document.getElementById("editModal"); if (m) m.classList.add("hidden"); document.body.classList.remove("modal-open"); }

  async function updatePostcardSmart(id, changes) {
    if (typeof window.updatePostcard === "function") return await window.updatePostcard(id, changes);
    alert("缺少 updatePostcard()"); return false;
  }

  function handleEditClick(item) {
    if (isPreviewMode) { alert("預覽模式不可編輯"); return; }
    const modal = ensureEditModal();
    const locationField = document.getElementById("editLocationInput");
    const categoryField = document.getElementById("editCategoryInput");
    const tagField = document.getElementById("editTagInput");
    const authorField = document.getElementById("editAuthorInput");
    const websiteField = document.getElementById("editWebsiteInput");
    const sourceField = document.getElementById("editSourceInput");
    const noteField = document.getElementById("editNoteInput");
    const focusImage = document.getElementById("editImageFocusImage");
    const saveBtn = document.getElementById("editSaveBtn");
    let newImageBase64 = null; let isSavingEdit = false;

    function clamp(v) { const n = Number(v); return Math.min(100, Math.max(0, isFinite(n) ? n : 50)); }
    let fx = clamp(item.imageFocusX); let fy = clamp(item.imageFocusY);
    focusImage.src = item.image; focusImage.style.objectPosition = `${fx}% ${fy}%`;
    locationField.value = item.locationText; categoryField.value = item.category || "全球"; tagField.value = item.tag || "";
    if (authorField) authorField.value = item.author || ""; if (websiteField) websiteField.value = item.websiteUrl || "";
    if (sourceField) sourceField.value = item.source || ""; if (noteField) noteField.value = item.note || "";
    if (isAdmin) {
       document.getElementById("editRarityRow").style.display = "block";
       document.getElementById("editRarityInput").value = item.rarity || "0";
       document.getElementById("v37EditAdminUnlockBlock").style.display = "block";
       document.getElementById("editReviewStatus").value = item.reviewStatus || "approved";
       document.getElementById("editVisibility").value = item.visibility || "public";
       document.getElementById("editIsHidden").checked = !!item.isHidden;
       document.getElementById("editRequirePlayerUnlock").checked = !!item.requirePlayerUnlock;
    }

    async function submit() {
      if (isSavingEdit) return;
      const loc = parseLocation(locationField.value); if (!loc) { alert("座標格式錯誤"); return; }
      isSavingEdit = true; saveBtn.disabled = true; saveBtn.textContent = "儲存中...";
      try {
        const changes = {
          locationText: loc.locationText, lat: loc.lat, lng: loc.lng, category: categoryField.value, tag: tagField.value,
          author: authorField?.value || "", websiteUrl: websiteField?.value || "", source: sourceField?.value || "",
          note: noteField?.value || "", imageFocusX: fx, imageFocusY: fy
        };
        if (newImageBase64) changes.image = newImageBase64;
        if (isAdmin) {
          changes.reviewStatus = document.getElementById("editReviewStatus").value;
          changes.visibility = document.getElementById("editVisibility").value;
          changes.isHidden = document.getElementById("editIsHidden").checked;
          changes.requirePlayerUnlock = document.getElementById("editRequirePlayerUnlock").checked;
        }
        const ok = await updatePostcardSmart(item.id, changes);
        if (ok) { closeEditModal(); safeRefreshViews(); showToast("已更新"); }
        else alert("儲存失敗，請檢查權限");
      } catch (e) { alert("儲存出錯"); }
      finally { isSavingEdit = false; saveBtn.disabled = false; saveBtn.textContent = "儲存變更"; }
    }

    if (saveBtn) {
      saveBtn.style.zIndex = "2147483647"; saveBtn.style.position = "relative"; saveBtn.style.pointerEvents = "auto";
      const trigger = (e) => { alert("✔️ 點擊成功！開始儲存程序..."); e.preventDefault(); e.stopPropagation(); submit(); };
      saveBtn.onclick = trigger; saveBtn.ontouchend = trigger;
    }

    modal.classList.remove("hidden"); document.body.classList.add("modal-open");
  }

  function bindTagFilterButtons() {
    const tagItems = document.querySelectorAll(".mobile-tag-menu .mobile-tag-item, .tag-filter");
    function update(tag) {
      currentTagFilter = tag;
      tagItems.forEach(el => { const active = (el.dataset.tag || "") === tag; el.classList.toggle("active", active); });
      if (mobileTagMenu) mobileTagMenu.classList.add("hidden"); currentPage = 1; safeRefreshViews();
    }
    tagItems.forEach(el => el.addEventListener("click", e => { e.stopPropagation(); update(el.dataset.tag || ""); }));
    if (mobileTagMenu && mobileTagMenu.parentNode !== document.body) document.body.appendChild(mobileTagMenu);
    const pos = () => {
      if (!mobileTagMenu || !mobileTagFilterBtn || mobileTagMenu.classList.contains("hidden")) return;
      const r = mobileTagFilterBtn.getBoundingClientRect();
      mobileTagMenu.style.cssText = `position:absolute; top:${r.bottom+window.scrollY+10}px; right:${window.innerWidth-r.right}px; width:140px; z-index:100000;`;
    };
    window.addEventListener("resize", pos);
    if (mobileTagFilterBtn) mobileTagFilterBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); mobileTagMenu.classList.toggle("hidden"); pos(); };
  }

  function initScrollTopFab() {
    const s1 = document.getElementById("v28CreateFab"), s2 = document.getElementById("mobileScrollTopFab");
    const svg = `<svg viewBox="0 0 24 24"><path d="M5 15.5L12 8.5L19 15.5" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round"/></svg>`;
    const bind = (b) => { if (!b || b.dataset.bound) return; b.dataset.bound = "true"; b.innerHTML = svg; b.onclick = () => window.scrollTo({top:0, behavior:"smooth"}); };
    bind(s1); bind(s2);
  }

  function refreshViews() {
    renderPostcards({ grid, emptyState, onCardClick: openCardModal, onLikeClick: handleLikeClick, onCopyClick: handleCopyClick, onDeleteClick: handleDeleteClick, onShareClick: handleShareClick, onEditClick: handleEditClick, filters: getFilters(), page: currentPage, onPageChange: p => { currentPage = p; safeRefreshViews(); window.scrollTo(0,0); } });
    renderMapList({ mapList, onSelect: selectMapItem, filters: getFilters() });
    if (currentModalCardId) { const i = getPostcardById(currentModalCardId); if (i) openCardModal(i); }
    updateSidebarCardCount();
  }

  function updateSidebarCardCount() {
    const el = document.getElementById("sidebarCardCount"), tEl = document.getElementById("sidebarTodayCount");
    if (!el) return; const cards = getPostcards(); el.textContent = cards.length;
    if (tEl) { const d = new Date().toISOString().split('T')[0]; tEl.textContent = cards.filter(c => c.createdAt?.startsWith(d)).length; }
  }

  setupImageUpload({ fileInput, selectFileBtn, dropZone, pasteZone, onImageLoaded: showPreview, onError: m => { setUploadLoading(false); setMessage(m, true); }, onStart: m => setUploadLoading(true, m), onDone: () => setUploadLoading(false) });
  
  collectionViewBtn.onclick = () => setView("collection"); mapViewBtn.onclick = () => setView("map");
  searchInput.oninput = () => { currentPage = 1; safeRefreshViews(); }; categoryFilter.onchange = () => { currentPage = 1; safeRefreshViews(); };
  clearImageBtn.onclick = clearPreview; closeCardModalBtn.onclick = closeCardModal;
  
  initializeFirebaseStorage(() => { initAppFeatures(); safeRefreshViews(); updateNoteSuggestions(); openSharedCardFromUrl(); });
  
  // 原本後方遺失的邏輯部分 (模擬補回)
  window.openCardModal = openCardModal;
});

// ⭐ Hero 收合控制
function toggleHero() { const h = document.querySelector('.hero'); if (h) h.classList.toggle('collapsed'); }

/* 地圖自動滑桿邏輯 */
(function setupMapAutoScrollbar() {
  const selectors = [".map-mode .map-list", ".map-mode .map-results", ".map-mode .postcard-list"];
  function bind(el) {
    if (!el || el.dataset.bound) return; el.dataset.bound = "true";
    let t; el.addEventListener("scroll", () => { el.classList.add("is-scrolling"); clearTimeout(t); t = setTimeout(() => el.classList.remove("is-scrolling"), 250); }, { passive: true });
  }
  function init() { selectors.forEach(s => document.querySelectorAll(s).forEach(bind)); }
  init(); new MutationObserver(init).observe(document.documentElement, { childList: true, subtree: true });
})();

window.handleRandomDiscovery = function() {
  const cards = getPostcards(); if (!cards.length) return;
  const item = cards[Math.floor(Math.random() * cards.length)];
  if (document.body.classList.contains("map-mode")) document.querySelector(".view-button[data-view='collection']")?.click();
  openCardModal(item);
};

function createInfoSection() {
  const c = document.createElement("div"); c.id = "modalCardInfoContainer";
  const list = document.querySelector(".modal-info-list");
  if (list && list.parentNode) { list.parentNode.insertBefore(c, list); }
  return c;
}

async function renderLocationDetails(item, container) {
  const isLocked = Boolean(window.PikminAuthGate?.shouldLockItem?.(item));
  if (isLocked) { container.innerHTML = `<details><summary>📍 地點資訊 ▾</summary><div style="padding:10px 0;">登入後解鎖</div></details>`; return; }
  container.innerHTML = `<details open><summary>📍 地點資訊 ▾</summary><div id="locContent" style="padding:10px 0;"><b>地點：</b><span id="locPlaceName">${item.placeName || "讀取中..."}</span><br><b>地址：</b><span id="locAddress">${item.address || "讀取中..."}</span></div></details>`;
  if (item.placeName && item.address) return;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${item.lat}&lon=${item.lng}&accept-language=zh-TW`, { headers: { 'User-Agent': 'PikminApp' } });
    if (res.ok) {
      const d = await res.json();
      const info = { placeName: d.name || d.display_name.split(',')[0], address: d.display_name };
      document.getElementById("locPlaceName").textContent = info.placeName;
      document.getElementById("locAddress").textContent = info.address;
      if (typeof updatePostcardSmart === "function") updatePostcardSmart(item.id, info);
    }
  } catch (e) {}
}

const mobileUploadFab = document.getElementById("mobileUploadFab");
if (mobileUploadFab) {
  mobileUploadFab.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const modal = document.getElementById("uploadModal");
    if (modal) { modal.classList.remove("hidden"); document.body.classList.add("modal-open"); }
  };
}

const closeUploadBtn = document.getElementById("closeUploadModalBtn");
if (closeUploadBtn) closeUploadBtn.onclick = () => { document.getElementById("uploadModal")?.classList.add("hidden"); document.body.classList.remove("modal-open"); };

document.getElementById("addCardBtn")?.addEventListener("click", async () => {
  const img = getCurrentImageData(); if (!img) { alert("請先上傳圖片"); return; }
  const loc = parseLocation(document.getElementById("locationInput").value); if (!loc) { alert("座標格式錯誤"); return; }
  try {
    await addPostcard({
      image: img, locationText: loc.locationText, lat: loc.lat, lng: loc.lng,
      category: document.getElementById("categoryInput").value || loc.country || "全球",
      tag: document.getElementById("tagInput")?.value || "",
      author: document.getElementById("authorInput")?.value || "",
      createdAt: new Date().toISOString()
    });
    location.reload();
  } catch (e) { alert("新增失敗"); }
});
