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
      if (admin) {
        isAdmin = true;
        enableAdminUI();
        console.log("Admin authenticated 👑");
      } else {
        isAdmin = false;
        disableAdminUI();
      }
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

    presenceColl.onSnapshot((snapshot) => {
      if (!onlineCountEl) return;
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
    });

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
      if (!cards || cards.length === 0) { alert("目前沒有資料。"); return; }
      const updates = [];
      cards.forEach(card => {
        const detected = detectCountryFromCoordinates(card.lat, card.lng);
        if (detected !== "全球" && card.category !== detected) updates.push({ id: card.id, newCategory: detected });
      });
      if (updates.length === 0) { alert("無須修正。"); return; }
      if (!confirm(`確定要修正 ${updates.length} 張卡片嗎？`)) return;
      const btn = document.getElementById("fixGpsBtn");
      btn.disabled = true;
      try {
        for (const up of updates) await updatePostcard(up.id, { category: up.newCategory });
        alert("修正完成！");
      } catch (err) { alert("出錯了。"); } finally { btn.disabled = false; }
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
        else if (item.note.trim().length < 20) uniqueNotes.add(item.note.trim());
      }
    });
    noteSuggestions.innerHTML = Array.from(uniqueNotes).map(n => `<option value="${n}"></option>`).join("");
  }

  function getFilters() { return { query: searchInput.value, category: categoryFilter.value, tag: currentTagFilter }; }
  function setMessage(text, isError = false) { uploadMessage.textContent = text || ""; uploadMessage.classList.toggle("error", isError); }
  function setUploadLoading(isLoading, text = "處理中…") { if (addCardBtn) addCardBtn.disabled = Boolean(isLoading); if (isLoading) setMessage(text); }

  function applyPreviewMode() {
    let user = null;
    try { if (window.firebase && firebase.auth) user = firebase.auth().currentUser; } catch (e) {}
    if (isPreviewMode && (!user || user.isAnonymous)) {
      isPreviewMode = false;
      const url = new URL(window.location.href);
      url.searchParams.delete("mode"); url.searchParams.delete("card");
      window.history.replaceState({}, "", url);
    }
    document.body.classList.toggle("is-browse-mode", isPreviewMode);
    if (previewModeBanner) previewModeBanner.classList.toggle("hidden", !isPreviewMode);
    if (browseModeBtn) browseModeBtn.classList.toggle("active", isPreviewMode);
    safeRefreshViews();
  }

  function togglePreviewMode() {
    const user = firebase.auth().currentUser;
    if (!user || user.isAnonymous) { alert("請先登入後才能開啟瀏覽功能唷！🌱"); if (window.PikminAuthGate) window.PikminAuthGate.openPanel(); return; }
    isPreviewMode = !isPreviewMode; applyPreviewMode();
  }

  if (browseModeBtn) browseModeBtn.addEventListener("click", togglePreviewMode);

  function setUploadMode(mode) {
    const modes = [{ name: "file", btn: modeFileBtn, panel: filePanel }, { name: "drag", btn: modeDragBtn, panel: dragPanel }, { name: "paste", btn: modePasteBtn, panel: pastePanel }];
    modes.forEach(item => { if (item.btn) item.btn.classList.toggle("active", item.name === mode); if (item.panel) item.panel.classList.toggle("hidden", item.name !== mode); });
  }

  function setView(view) {
    collectionView.classList.toggle("hidden", view !== "collection");
    mapView.classList.toggle("hidden", view !== "map");
    collectionViewBtn.classList.toggle("active", view === "collection");
    mapViewBtn.classList.toggle("active", view === "map");
    if (view === "map") safeRefreshViews();
  }

  function showPreview(imageData) { setCurrentImageData(imageData); previewImage.src = imageData; previewBox.classList.remove("hidden"); setUploadLoading(false); autoDetectTagFromImage(imageData); }

  async function autoDetectTagFromImage(imageData) {
    try {
      const img = new Image(); img.src = imageData; await new Promise(r => img.onload = r);
      const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d"); canvas.width = 300; canvas.height = 200; ctx.drawImage(img, 0, 0, 300, 200);
      const pixels = ctx.getImageData(210, 70, 90, 130).data; let yellow = 0;
      for (let i = 0; i < pixels.length; i += 16) { if (pixels[i] > 200 && pixels[i+1] > 180 && pixels[i+2] < 150) yellow++; }
      const tag = yellow > 15 ? "蘑菇" : "花"; if (tagInput) tagInput.value = tag;
    } catch (err) {}
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
    const doUpdate = () => {
      const isV37Locked = Boolean(window.PikminAuthGate && window.PikminAuthGate.shouldLockItem(item));
      modalCardImage.src = item.image;
      let currentUser = null; try { if (window.firebase && firebase.auth) currentUser = firebase.auth().currentUser; } catch(e){}
      const isRealUser = !!(currentUser && !currentUser.isAnonymous);
      const isFirebaseAdmin = window.PikminAuthGate && typeof window.PikminAuthGate.isFirebaseAdmin === "function" && window.PikminAuthGate.isFirebaseAdmin();
      const isOwner = typeof isOwnedByCurrentUser === "function" && isOwnedByCurrentUser(item);
      const canManage = isFirebaseAdmin || (isRealUser && isOwner);
      const adminRarity = (isFirebaseAdmin && item.rarity && item.rarity !== "0") ? `<span class="admin-rarity-badge" title="管理員專屬標註">💎 ${"⭐".repeat(parseInt(item.rarity))}</span>` : "";
      modalCardTitle.innerHTML = `No.${String(index + 1).padStart(3, "0")} ${adminRarity}`;
      const noteSuffix = item.note ? `｜${item.note}` : "";
      const locationText = isV37Locked ? "解鎖蘑菇位置" : item.locationText;
      const displayLocation = isV37Locked ? locationText : `<span class="copyable-coords" title="點擊複製座標" onclick="copyToClipboard('${item.lat}, ${item.lng}', this)">${locationText}</span>`;
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
    try { await navigator.clipboard.writeText(shareUrl); showToast("已複製連結"); }
    catch { prompt("請複製", shareUrl); }
  }

  async function handleDeleteClick(id) {
    if (isPreviewMode) { alert("預覽模式不可刪除"); return; }
    if (!confirm("確定要刪除嗎？")) return;
    try { await deletePostcard(id); showToast("已刪除"); } catch (error) { alert(`失敗：${error.message}`); }
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
          <div class="field-half"><label>建立標籤</label><input id="editNoteInput" type="text" list="noteSuggestions" /></div>
          <div class="field-half"><label>網站連結</label><input id="editWebsiteInput" type="text" /></div>
          <div class="field-half"><label>來源</label><input id="editSourceInput" type="text" /></div>
        </div>
        <div id="editImageFocusPreview" class="edit-image-focus-preview"><img id="editImageFocusImage" /></div>
        <div class="edit-image-focus-actions">
          <input type="file" id="editImageFileInput" accept="image/*" style="display:none;" />
          <button type="button" id="replaceImageBtn" class="edit-image-focus-reset" style="background:var(--green); color:white;">更換圖片</button>
          <button type="button" id="deletePostcardBtn" class="edit-image-focus-reset" style="background:#ef4444; color:white;">刪除卡片</button>
        </div>
        <div class="field-full v37-edit-admin-unlock" id="v37EditAdminUnlockBlock" style="display:none;">
          <label style="font-weight:800;">管理員：解鎖規則</label>
          <label><input type="checkbox" id="editRequirePlayerUnlock" /> 此卡須完成玩家登入</label>
          <label><input type="checkbox" id="editPublicUnlock" /> 公開顯示</label>
        </div>
        <button type="button" id="editSaveBtn" class="edit-save-btn">儲存修改</button>
      </form>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", event => { if (event.target.dataset.editClose === "true" || event.target.id === "closeEditModalBtn") closeEditModal(); });
    return modal;
  }

  function closeEditModal() { const m = document.getElementById("editModal"); if (m) m.classList.add("hidden"); document.body.classList.remove("modal-open"); }

  async function updatePostcardSmart(id, changes) {
    if (typeof updatePostcard === "function") return await updatePostcard(id, changes);
    alert("缺少 updatePostcard()"); return false;
  }

  function handleEditClick(item) {
    if (isPreviewMode) { alert("預覽模式不可編輯"); return; }
    const modal = ensureEditModal();
    const locIn = document.getElementById("editLocationInput");
    const categoryIn = document.getElementById("editCategoryInput");
    const tagIn = document.getElementById("editTagInput");
    const authorIn = document.getElementById("editAuthorInput");
    const noteIn = document.getElementById("editNoteInput");
    const websiteIn = document.getElementById("editWebsiteInput");
    const sourceIn = document.getElementById("editSourceInput");
    const rarityIn = document.getElementById("editRarityInput");
    const focusImg = document.getElementById("editImageFocusImage");
    const saveBtn = document.getElementById("editSaveBtn");
    
    locIn.value = item.locationText || "";
    categoryIn.value = item.category || "全球";
    tagIn.value = item.tag || "";
    if (authorIn) authorIn.value = item.author || "";
    if (noteIn) noteIn.value = item.note || "";
    if (websiteIn) websiteIn.value = item.websiteUrl || "";
    if (sourceIn) sourceIn.value = item.source || "";
    if (rarityIn) rarityIn.value = item.rarity || "0";
    if (focusImg) { focusImg.src = item.image; focusImg.style.objectPosition = `${item.imageFocusX || 50}% ${item.imageFocusY || 50}%`; }
    
    const adminBlock = document.getElementById("v37EditAdminUnlockBlock");
    if (adminBlock) adminBlock.style.display = isAdmin ? "block" : "none";
    const rarityRow = document.getElementById("editRarityRow");
    if (rarityRow) rarityRow.style.display = isAdmin ? "block" : "none";

    let isSaving = false;
    async function submit() {
      if (isSaving) return;
      const loc = parseLocation(locIn.value); if (!loc) { alert("座標格式錯誤"); return; }
      isSaving = true; saveBtn.disabled = true; saveBtn.textContent = "儲存中...";
      try {
        const changes = {
          locationText: loc.locationText, lat: loc.lat, lng: loc.lng,
          category: categoryIn.value, tag: tagIn.value,
          author: authorIn ? authorIn.value : "", note: noteIn ? noteIn.value : "",
          websiteUrl: websiteIn ? websiteIn.value : "", source: sourceIn ? sourceIn.value : ""
        };
        if (isAdmin) {
           changes.rarity = rarityIn.value;
           changes.requirePlayerUnlock = document.getElementById("editRequirePlayerUnlock").checked;
           changes.publicUnlock = document.getElementById("editPublicUnlock").checked;
        }
        await updatePostcardSmart(item.id, changes);
        closeEditModal(); safeRefreshViews(); showToast("已更新");
      } catch (e) { alert("儲存失敗"); }
      finally { isSaving = false; saveBtn.disabled = false; saveBtn.textContent = "儲存修改"; }
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
  }

  function refreshViews() {
    renderPostcards({ grid, emptyState, onCardClick: openCardModal, onEditClick: handleEditClick, onCopyClick: handleCopyClick, filters: getFilters(), page: currentPage, onPageChange: p => { currentPage = p; safeRefreshViews(); window.scrollTo(0,0); } });
    updateSidebarCardCount();
    updateFeaturedCard();
  }

  function updateSidebarCardCount() {
    const el = document.getElementById("sidebarCardCount"), tEl = document.getElementById("sidebarTodayCount");
    if (!el) return; const cards = getPostcards(); el.textContent = cards.length;
    if (tEl) { const d = new Date().toISOString().split('T')[0]; tEl.textContent = cards.filter(c => c.createdAt?.startsWith(d)).length; }
  }

  function updateFeaturedCard() {
    const cards = getPostcards(); if (!cards.length) return;
    const d = new Date(); const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const item = cards[seed % cards.length];
    const container = document.getElementById("featuredCardContainer");
    if (container && item) {
      const img = document.getElementById("featuredCardImg"); const title = document.getElementById("featuredCardTitle");
      if (img) img.src = item.image; if (title) title.textContent = item.locationText;
      container.classList.remove("hidden"); container.onclick = () => { openCardModal(item); };
    }
  }

  setupImageUpload({ fileInput, selectFileBtn, dropZone, pasteZone, onImageLoaded: showPreview, onStart: m => setUploadLoading(true, m), onDone: () => setUploadLoading(false) });
  
  collectionViewBtn.onclick = () => setView("collection"); mapViewBtn.onclick = () => setView("map");
  searchInput.oninput = () => { currentPage = 1; safeRefreshViews(); }; categoryFilter.onchange = () => { currentPage = 1; safeRefreshViews(); };
  closeCardModalBtn.onclick = closeCardModal;

  initializeFirebaseStorage(() => { initAppFeatures(); safeRefreshViews(); updateNoteSuggestions(); openSharedCardFromUrl(); });
});
