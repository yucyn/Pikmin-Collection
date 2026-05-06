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
  const randomCardBtn = document.getElementById("randomCardBtn");
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

  let refreshTimer = null;
  function safeRefreshViews(delay = 120) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { refreshViews(); }, delay);
  }

  let isFeaturesInitialized = false;
  let isAdmin = false; 
  let hasStartedPresenceListener = false;

  function initAppFeatures() {
    if (isFeaturesInitialized || !db) return;
    isFeaturesInitialized = true;
    const settingsDoc = db.collection("settings").doc("bulletin");
    const configDoc = db.collection("settings").doc("config");
    const statsDoc = db.collection("stats").doc("visitors");
    const guestbookColl = db.collection("guestbook");
    const bulletinContent = document.getElementById("bulletinContent");
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

    window.copyToClipboard = function(text, el) {
      if (!text || text.includes("解鎖")) return;
      navigator.clipboard.writeText(text).then(() => {
        if (el) { el.classList.add('copied-feedback'); setTimeout(() => el.classList.remove('copied-feedback'), 1500); }
      });
    };

    auth.onAuthStateChanged((user) => {
      const uids = window.PIKMIN_ADMIN_UIDS || ["am42ZiJikLNEt8RSsWipgBDj4h32"];
      isAdmin = Boolean(user && uids.includes(user.uid));
      if (isAdmin) {
        if (editBulletinBtn) editBulletinBtn.style.display = "inline-block";
        if (visitorStats) visitorStats.style.display = "flex";
        document.body.classList.add("admin-mode-active");
        if (typeof startPresenceListener === "function") startPresenceListener();
      } else {
        if (editBulletinBtn) editBulletinBtn.style.display = "none";
        if (visitorStats) visitorStats.style.display = "none";
        document.body.classList.remove("admin-mode-active");
      }
      refreshGuestbookUI();
    });

    statsDoc.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    statsDoc.onSnapshot(d => { if (d.exists && viewCountEl) viewCountEl.innerText = d.data().count || 0; });

    let guestbookMessages = [];
    const refreshGuestbookUI = () => {
      if (!guestbookList) return;
      guestbookList.innerHTML = guestbookMessages.map(m => `
        <div class="guest-msg" style="margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid #f0f0f0; position:relative;">
          <b style="color:var(--green-dark);">${m.name || "匿名"}</b>: <span>${m.text}</span>
          ${isAdmin ? `<button onclick="deleteGuestMsg('${m.id}')" style="position:absolute; right:0; top:0; border:0; background:transparent; cursor:pointer;">🗑️</button>` : ""}
        </div>
      `).join("");
    };

    async function loadGuestbookOnce() {
      try { const s = await guestbookColl.orderBy("time", "desc").limit(20).get(); guestbookMessages = []; s.forEach(d => guestbookMessages.push({id:d.id, ...d.data()})); refreshGuestbookUI(); } catch(e){}
    }
    loadGuestbookOnce();

    if (sendMsgBtn) {
      sendMsgBtn.onclick = () => {
        const text = guestMsgInput.value.trim(); if (!text) return;
        guestbookColl.add({ name: guestNameInput.value || "匿名", text, time: Date.now() }).then(() => { guestMsgInput.value = ""; loadGuestbookOnce(); });
      };
    }
  }

  function getFilters() { return { query: searchInput.value, category: categoryFilter.value, tag: currentTagFilter }; }
  function setMessage(t, err) { uploadMessage.textContent = t; uploadMessage.classList.toggle("error", !!err); }
  function setUploadLoading(l, t) { if (addCardBtn) addCardBtn.disabled = !!l; if (l) setMessage(t || "處理中..."); }

  function togglePreviewMode() {
    const user = firebase.auth().currentUser;
    if (!user || user.isAnonymous) { alert("請先登入後才能開啟瀏覽功能唷！🌱"); if (window.PikminAuthGate) window.PikminAuthGate.openPanel(); return; }
    isPreviewMode = !isPreviewMode;
    document.body.classList.toggle("is-browse-mode", isPreviewMode);
    if (previewModeBanner) previewModeBanner.classList.toggle("hidden", !isPreviewMode);
    safeRefreshViews();
  }

  function setView(v) {
    collectionView.classList.toggle("hidden", v !== "collection");
    mapView.classList.toggle("hidden", v !== "map");
    collectionViewBtn.classList.toggle("active", v === "collection");
    mapViewBtn.classList.toggle("active", v === "map");
    if (v === "map") safeRefreshViews();
  }

  function showPreview(data) { setCurrentImageData(data); previewImage.src = data; previewBox.classList.remove("hidden"); setUploadLoading(false); autoDetectTagFromImage(data); }

  async function autoDetectTagFromImage(data) {
    try {
      const img = new Image(); img.src = data; await new Promise(r => img.onload = r);
      const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d"); canvas.width = 300; canvas.height = 200; ctx.drawImage(img, 0, 0, 300, 200);
      const pixels = ctx.getImageData(210, 70, 90, 130).data; let yellow = 0;
      for (let i = 0; i < pixels.length; i += 16) { if (pixels[i] > 200 && pixels[i+1] > 180 && pixels[i+2] < 150) yellow++; }
      const tag = yellow > 15 ? "蘑菇" : "花"; if (tagInput) tagInput.value = tag; setMessage(`✅ 已自動判定標籤：${tag}`);
    } catch(e) { setMessage("✅ 圖片已載入"); }
  }

  function openCardModal(item) {
    currentModalCardId = item.id;
    const index = getPostcards().findIndex(c => c.id === item.id);
    modalCardImage.src = item.image;
    modalCardTitle.innerHTML = `No.${String(index + 1).padStart(3, "0")}`;
    const displayLocation = `<span class="copyable-coords" onclick="copyToClipboard('${item.lat}, ${item.lng}', this)">${item.locationText}</span>`;
    modalCardLocation.innerHTML = `${item.category || "全球"}｜${displayLocation}`;
    if (modalEditBtn) {
      let u = firebase.auth().currentUser;
      const canEdit = isAdmin || (u && !u.isAnonymous && typeof isOwnedByCurrentUser === "function" && isOwnedByCurrentUser(item));
      modalEditBtn.style.display = (canEdit && !isPreviewMode) ? "block" : "none";
      modalEditBtn.onclick = () => { closeCardModal(); handleEditClick(item); };
    }
    cardModal.classList.remove("hidden"); document.body.classList.add("modal-open");
  }

  function closeCardModal() { currentModalCardId = null; cardModal.classList.add("hidden"); document.body.classList.remove("modal-open"); }

  function handleEditClick(item) {
    const modal = ensureEditModal();
    const locIn = document.getElementById("editLocationInput");
    const saveBtn = document.getElementById("editSaveBtn");
    locIn.value = item.locationText;
    document.getElementById("editCategoryInput").value = item.category || "全球";
    document.getElementById("editTagInput").value = item.tag || "";
    document.getElementById("editImageFocusImage").src = item.image;
    
    saveBtn.style.zIndex = "2147483647"; saveBtn.style.position = "relative";
    saveBtn.onclick = async () => {
      alert("✔️ 點擊成功！開始儲存程序...");
      const loc = parseLocation(locIn.value); if (!loc) return alert("座標錯誤");
      saveBtn.disabled = true; saveBtn.textContent = "儲存中...";
      try {
        const ok = await window.updatePostcard(item.id, { locationText: loc.locationText, lat: loc.lat, lng: loc.lng, category: document.getElementById("editCategoryInput").value, tag: document.getElementById("editTagInput").value });
        if (ok) { closeEditModal(); safeRefreshViews(); } else alert("儲存失敗");
      } finally { saveBtn.disabled = false; saveBtn.textContent = "儲存變更"; }
    };
    modal.classList.remove("hidden"); document.body.classList.add("modal-open");
  }

  function ensureEditModal() {
    let m = document.getElementById("editModal"); if (m) return m;
    m = document.createElement("section"); m.id = "editModal"; m.className = "edit-modal hidden";
    m.innerHTML = `<div class="edit-modal-backdrop" onclick="this.parentNode.classList.add('hidden'); document.body.classList.remove('modal-open')"></div>
      <form id="editForm" class="edit-modal-panel">
        <button type="button" class="edit-modal-close" onclick="this.closest('.edit-modal').classList.add('hidden'); document.body.classList.remove('modal-open')">×</button>
        <h2>編輯明信片</h2>
        <input id="editLocationInput" type="text" placeholder="座標" />
        <select id="editCategoryInput"><option value="全球">全球</option><option value="台灣">台灣</option><option value="日本">日本</option></select>
        <select id="editTagInput"><option value="花">花</option><option value="蘑菇">蘑菇</option><option value="隱藏">隱藏</option></select>
        <div class="edit-image-focus-preview"><img id="editImageFocusImage" /></div>
        <button type="button" id="editSaveBtn" class="edit-save-btn">儲存變更</button>
      </form>`;
    document.body.appendChild(m); return m;
  }

  function refreshViews() {
    renderPostcards({ grid, emptyState, onCardClick: openCardModal, onEditClick: handleEditClick, filters: getFilters(), page: currentPage, onPageChange: p => { currentPage = p; safeRefreshViews(); window.scrollTo(0,0); } });
  }

  setupImageUpload({ fileInput, selectFileBtn, dropZone, pasteZone, onImageLoaded: showPreview, onStart: m => setUploadLoading(true, m), onDone: () => setUploadLoading(false) });
  
  if (collectionViewBtn) collectionViewBtn.onclick = () => setView("collection");
  if (mapViewBtn) mapViewBtn.onclick = () => setView("map");
  if (searchInput) searchInput.oninput = () => { currentPage = 1; safeRefreshViews(); };
  if (categoryFilter) categoryFilter.onchange = () => { currentPage = 1; safeRefreshViews(); };
  if (clearImageBtn) clearImageBtn.onclick = () => { clearPreview(); };
  if (closeCardModalBtn) closeCardModalBtn.onclick = closeCardModal;

  if (addCardBtn) {
    addCardBtn.onclick = async () => {
      const img = getCurrentImageData(); if (!img) return alert("請先上傳圖片");
      const loc = parseLocation(locationInput.value); if (!loc) return alert("座標格式錯誤");
      addCardBtn.disabled = true; setMessage("新增中...");
      try {
        await addPostcard({ image: img, locationText: loc.locationText, lat: loc.lat, lng: loc.lng, category: categoryInput.value || "全球", tag: tagInput.value || "", createdAt: new Date().toISOString() });
        location.reload();
      } catch(e) { alert("新增失敗"); addCardBtn.disabled = false; }
    };
  }

  if (document.getElementById("openUploadBtn")) {
    document.getElementById("openUploadBtn").onclick = () => { document.getElementById("uploadModal")?.classList.remove("hidden"); document.body.classList.add("modal-open"); };
  }
  if (document.getElementById("closeUploadModalBtn")) {
    document.getElementById("closeUploadModalBtn").onclick = () => { document.getElementById("uploadModal")?.classList.add("hidden"); document.body.classList.remove("modal-open"); };
  }

  // --- 新增：恢復每日精選功能 ---
  function updateFeaturedCard() {
    const cards = typeof getPostcards === "function" ? getPostcards() : [];
    if (!cards || cards.length === 0) return;
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
      container.onclick = () => { openCardModal(item); };
    }
  }

  window.handleRandomDiscovery = function() {
    const cards = typeof getPostcards === "function" ? getPostcards() : [];
    if (!cards.length) return;
    const item = cards[Math.floor(Math.random() * cards.length)];
    if (document.body.classList.contains("map-mode")) setView("collection");
    openCardModal(item);
  };

  initializeFirebaseStorage(() => { 
    initAppFeatures(); 
    safeRefreshViews(); 
    updateFeaturedCard(); // 啟動精選
  });
  
  window.openCardModal = openCardModal;
});

function renderLocationDetails(item, container) { container.innerHTML = `<div style="font-size:13px; color:#666;">📍 ${item.locationText}</div>`; }
function createInfoSection() { const c = document.createElement("div"); document.querySelector(".modal-info-list")?.parentNode.insertBefore(c, document.querySelector(".modal-info-list")); return c; }
