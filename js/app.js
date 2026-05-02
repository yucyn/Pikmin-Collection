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
  const addCardBtn = document.getElementById("addCardBtn");
  const grid = document.getElementById("grid");
  const emptyState = document.getElementById("emptyState");

  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");

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

  let isPreviewMode = false; // V31.6：取消預覽模式

  // V35.9：清掉舊版分享留下的 ?mode=preview，避免上線環境錯誤請求。
  if (window.location.search.includes("mode=preview")) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("mode");
    window.history.replaceState({}, "", cleanUrl);
  }

  let currentModalCardId = null;
  let currentTagFilter = "";

  function getFilters() {
    return {
      query: searchInput ? searchInput.value : "",
      category: categoryFilter ? categoryFilter.value : "",
      tag: currentTagFilter
    };
  }

  function setMessage(text, isError = false) {
    if (!uploadMessage) return;
    uploadMessage.textContent = text || "";
    uploadMessage.classList.toggle("error", isError);
  }

  function setUploadLoading(isLoading, text = "圖片處理中…") {
    if (dropZone) dropZone.classList.toggle("upload-loading", Boolean(isLoading));
    if (addCardBtn) addCardBtn.disabled = Boolean(isLoading);
    if (isLoading) setMessage(text);
  }

  function applyPreviewMode() {
    isPreviewMode = false;
    document.body.classList.remove("preview-mode");
    if (previewModeBanner) previewModeBanner.classList.add("hidden");
    if (previewModeBtn) {
      previewModeBtn.classList.remove("active");
      previewModeBtn.style.display = "none";
    }
  }

  function togglePreviewMode() {
    // V35.9：上線版停用 ?mode=preview，避免 Vercel / GitHub Pages 因預覽查詢字串導致 404。
    isPreviewMode = false;
    applyPreviewMode();

    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    window.history.replaceState({}, "", url);

    refreshViews();
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
      if (pasteZone) pasteZone.focus();
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
    if (collectionView) collectionView.classList.toggle("hidden", !isCollection);
    if (mapView) mapView.classList.toggle("hidden", !isMap);
    document.body.classList.toggle("map-mode", isMap);
    if (collectionViewBtn) collectionViewBtn.classList.toggle("active", isCollection);
    if (mapViewBtn) mapViewBtn.classList.toggle("active", isMap);
    if (isMap) {
      refreshViews();
      const list = typeof getFilteredPostcards === "function" ? getFilteredPostcards(getFilters()) : [];
      if (list.length > 0) {
        selectMapItem(list[0]);
      } else {
        if (mapFrame) mapFrame.src = "";
        if (mapEmpty) mapEmpty.classList.remove("hidden");
      }
    }
  }

  function showPreview(imageData) {
    setCurrentImageData(imageData);
    if (previewImage) previewImage.src = imageData;
    if (previewBox) previewBox.classList.remove("hidden");
    dropZone?.classList.add("has-image");
    setUploadLoading(false);
    setMessage("✅ 圖片已載入，可以輸入座標並新增明信片");
  }

  function clearPreview() {
    clearCurrentImageData();
    if (previewImage) previewImage.removeAttribute("src");
    if (previewBox) previewBox.classList.add("hidden");
    dropZone?.classList.remove("has-image");
    setMessage("");
  }

  function autoFillCountryFromLocation() {
    const location = parseLocation(locationInput ? locationInput.value : "");
    if (!location) return;

    const detectedCountry = location.country || "全球";

    if (categoryInput && (!categoryInput.value || categoryInput.value === "全球")) {
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

  function openCardModal(item) {
    currentModalCardId = item.id;
    const index = getPostcards().findIndex(card => card.id === item.id);

    if (!cardModal) return;
    if (modalCardImage) modalCardImage.src = item.image;
    if (modalCardTitle) modalCardTitle.textContent = `No.${String(index + 1).padStart(3, "0")}`;
    if (modalCardLocation) modalCardLocation.textContent = `${item.category || "全球"}｜${item.locationText}｜${isOwnedByCurrentUser(item) ? "我的明信片" : "公開明信片"}｜${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`;
    if (modalMapLink) modalMapLink.href = createGoogleMapUrl(item.lat, item.lng);

    const url = new URL(window.location.href);
    url.searchParams.set("card", item.id);
    window.history.replaceState({}, "", url);

    cardModal.classList.remove("hidden");
  }

  function closeCardModal() {
    currentModalCardId = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("card");
    window.history.replaceState({}, "", url);
    if (cardModal) cardModal.classList.add("hidden");
  }

  function openSharedCardFromUrl() {
    const cardId = new URLSearchParams(window.location.search).get("card");
    if (!cardId) return;
    const item = getPostcardById(cardId);
    if (item) openCardModal(item);
  }

  function selectMapItem(item) {
    if (mapFrame) mapFrame.src = createGoogleMapEmbedUrl(item.lat, item.lng);
    if (mapEmpty) mapEmpty.classList.add("hidden");
    if (mapList) setActiveMapItem(mapList, item.id);
  }

  async function handleLikeClick(id) {
    await togglePostcardLike(id);
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
    await deletePostcard(id);
  }

  function ensureEditModal() {
    let modal = document.getElementById("editModal");
    if (modal) return modal;

    modal = document.createElement("section");
    modal.id = "editModal";
    modal.className = "edit-modal hidden";
    modal.innerHTML = `
      <div class="edit-modal-backdrop" data-edit-close="true"></div>
      <form id="editForm" class="edit-modal-panel">
        <button type="button" id="closeEditModalBtn" class="edit-modal-close">×</button>
        <h2>編輯明信片</h2>

        <label for="editLocationInput">座標</label>
        <input id="editLocationInput" type="text" required placeholder="例如：43.587789, 142.465553" />

        <label for="editCategoryInput">國家分類</label>
        <select id="editCategoryInput">
          <option value="全球">全球</option>
          <option value="台灣">台灣</option>
          <option value="日本">日本</option>
          <option value="香港">香港</option>
          <option value="美國">美國</option>
          <option value="德國">德國</option>
          <option value="義大利">義大利</option>
          <option value="杜拜">杜拜</option>
          <option value="韓國">韓國</option>
        </select>

        <label for="editTagInput">標籤</label>
        <select id="editTagInput">
          <option value="">無</option>
          <option value="花">花</option>
          <option value="蘑菇">蘑菇</option>
          <option value="隱藏">隱藏</option>
        </select>

        <button type="submit" class="edit-save-btn">儲存修改</button>
      </form>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target.dataset.editClose === "true" || event.target.id === "closeEditModalBtn") {
        closeEditModal();
      }
    });

    return modal;
  }

  function closeEditModal() {
    const modal = document.getElementById("editModal");
    if (modal) modal.classList.add("hidden");
  }

  async function updatePostcardSmart(id, changes) {
    if (typeof updatePostcard === "function") {
      await updatePostcard(id, changes);
      return;
    }

    alert("目前缺少 updatePostcard()，請確認 js/storage.js 已加入更新函式。");
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

    if (!modal || !form || !locationField || !categoryField || !tagField) {
      console.warn("Edit modal DOM is incomplete; edit action skipped.");
      return;
    }

    locationField.value = item.locationText || "";
    categoryField.value = item.category || "全球";
    tagField.value = item.tag || "";

    form.onsubmit = async event => {
      event.preventDefault();

      const location = parseLocation(locationField.value);
      if (!location) {
        alert("請輸入正確座標，例如：43.587789, 142.465553");
        return;
      }

      await updatePostcardSmart(item.id, {
        locationText: location.locationText,
        lat: location.lat,
        lng: location.lng,
        category: categoryField.value || location.country || "全球",
        tag: tagField.value || ""
      });

      closeEditModal();
      refreshViews();
      showToast("已更新明信片");
    };

    modal.classList.remove("hidden");
  }

  function bindTagFilterButtons() {
    const buttons = document.querySelectorAll(".tag-filter");
    buttons.forEach(button => {
      if (button.dataset.tagFilterBound === "true") return;
      button.dataset.tagFilterBound = "true";

      button.addEventListener("click", () => {
        const latestButtons = document.querySelectorAll(".tag-filter");
        latestButtons.forEach(btn => btn.classList.remove("active", "is-active"));
        button.classList.add("active", "is-active");
        currentTagFilter = button.dataset.tag || "";
        refreshViews();
      });
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
    const selectedCategory = categoryFilter ? categoryFilter.value : "";
    if (categoryFilter) renderCategoryFilter(categoryFilter, selectedCategory);

    if (grid) renderPostcards({
      grid,
      emptyState,
      onCardClick: openCardModal,
      onLikeClick: handleLikeClick,
      onCopyClick: handleCopyClick,
      onDeleteClick: handleDeleteClick,
      onShareClick: handleShareClick,
      onEditClick: handleEditClick,
      filters: getFilters()
    });

    if (mapList) renderMapList({ mapList, onSelect: selectMapItem, filters: getFilters() });

    if (currentModalCardId) {
      const item = getPostcardById(currentModalCardId);
      if (item) openCardModal(item);
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

  if (collectionViewBtn) collectionViewBtn.addEventListener("click", () => setView("collection"));
  if (mapViewBtn) mapViewBtn.addEventListener("click", () => setView("map"));
  if (previewModeBtn) previewModeBtn.addEventListener("click", togglePreviewMode);

  if (searchInput) searchInput.addEventListener("input", refreshViews);
  if (categoryFilter) categoryFilter.addEventListener("change", refreshViews);
  if (locationInput) locationInput.addEventListener("change", autoFillCountryFromLocation);
  if (locationInput) locationInput.addEventListener("blur", autoFillCountryFromLocation);

  if (clearImageBtn) clearImageBtn.addEventListener("click", clearPreview);
  if (closeCardModalBtn) closeCardModalBtn.addEventListener("click", closeCardModal);
  if (cardModalBackdrop) cardModalBackdrop.addEventListener("click", closeCardModal);
  if (modalShareCardBtn) modalShareCardBtn.addEventListener("click", () => {
    if (currentModalCardId) handleShareClick(currentModalCardId);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeCardModal();
  });

  if (addCardBtn) addCardBtn.addEventListener("click", async function () {
    const imageData = getCurrentImageData();

    if (!imageData) {
      alert("請先上傳圖片");
      return;
    }

    const location = parseLocation(locationInput ? locationInput.value : "");

    if (!location) {
      alert("請輸入正確座標，例如：43.587789, 142.465553");
      return;
    }

    const detectedCountry = location.country || "全球";
    const category = String(categoryInput ? categoryInput.value || "" : "").trim() || detectedCountry || "全球";

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
        createdAt: new Date().toISOString()
      });

      refreshViews();
      clearPreview();
      setMessage("✅ 明信片已新增");
      if (locationInput) locationInput.value = "";
      if (categoryInput) categoryInput.value = "";
      if (tagInput) tagInput.value = "";
    } catch (error) {
      console.error(error);
      setMessage("新增失敗，請再試一次", true);
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
    refreshViews();
    openSharedCardFromUrl();
  });
});

// ===== Dedicated Mobile Upload Button（唯一控制）=====
document.addEventListener("DOMContentLoaded", () => {
  const mobileUploadFab = document.getElementById("mobileUploadFab");
  const sidebar = document.querySelector(".sidebar");

  if (!mobileUploadFab || !sidebar) return;

  mobileUploadFab.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (window.innerWidth > 768) return;
    if (!sidebar.classList.contains("open")) return;
    if (sidebar.contains(e.target)) return;
    if (mobileUploadFab.contains(e.target)) return;
    sidebar.classList.remove("open");
  });
});
// ⭐ Hero 收合控制
function toggleHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  hero.classList.toggle('collapsed');
}
// 🔥 點擊座標 → 複製
document.addEventListener("click", async (e) => {
  const el = e.target.closest(".postcard-coords");
  if (!el) return;

  const text = el.innerText.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);

    // Toast 提示
    const toast = document.createElement("div");
    toast.innerText = "已複製座標";
    toast.style.position = "fixed";
    toast.style.bottom = "110px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "rgba(0,0,0,0.75)";
    toast.style.color = "#fff";
    toast.style.padding = "10px 16px";
    toast.style.borderRadius = "999px";
    toast.style.fontSize = "13px";
    toast.style.zIndex = "9999";

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1200);

  } catch (err) {
    console.error("copy failed", err);
  }
});


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

    el.addEventListener("scroll", () => {
      el.classList.add("is-scrolling");

      clearTimeout(timer);
      timer = setTimeout(() => {
        el.classList.remove("is-scrolling");
      }, 800);
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
    el.addEventListener("scroll", () => {
      el.classList.add("is-scrolling");
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.classList.remove("is-scrolling");
      }, 900);
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


/* =========================================================
   V35：自動將「花 / 蘑菇 / 隱藏」套用扁平綠色膠囊
   適用收藏冊模式與地圖模式
========================================================= */
(function forceFlatGreenButtonsBothModes() {
  const targetTexts = new Set(["花", "蘑菇", "隱藏"]);

  function normalizeText(el) {
    return (el.textContent || "")
      .replace(/\s+/g, "")
      .replace(/[🌸🍄👁️👁]/g, "")
      .trim();
  }

  function applyFlatGreenButtons() {
    document
      .querySelectorAll("button, .btn-pikmin, .filter-btn, .category-btn, .tag-filter-btn")
      .forEach(el => {
        const text = normalizeText(el);
        if (targetTexts.has(text)) {
          el.classList.add("flat-green-filter");
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFlatGreenButtons);
  } else {
    applyFlatGreenButtons();
  }

  new MutationObserver(applyFlatGreenButtons).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();


/* =========================================================
   V35.1 FINAL：自動尋找文字為 花 / 蘑菇 / 隱藏 的按鈕
   加上 .flat-green-filter，確保兩種模式都扁平化
========================================================= */
(function forceFlatGreenFinal() {
  const targetTexts = new Set(["花", "蘑菇", "隱藏"]);

  function normalizeText(el) {
    return (el.textContent || "")
      .replace(/\s+/g, "")
      .replace(/[🌸🍄👁️👁]/g, "")
      .trim();
  }

  function apply() {
    document.querySelectorAll("button, .btn-pikmin, .filter-btn, .category-btn, .tag-filter-btn").forEach(el => {
      const text = normalizeText(el);
      if (targetTexts.has(text)) {
        el.classList.add("flat-green-filter");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  new MutationObserver(apply).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();


/* =========================================================
   V35.3 LOAD FIX：自動加 class，不強制 inline style
========================================================= */
(function () {
  try {
    const targetTexts = new Set(["花", "蘑菇", "隱藏"]);

    function normalizeText(el) {
      return (el.textContent || "")
        .replace(/\s+/g, "")
        .replace(/[🌸🍄👁️👁]/g, "")
        .trim();
    }

    function applyFlatGreenButtons() {
      document
        .querySelectorAll("button, a, [role='button'], .btn-pikmin, .filter-btn, .category-btn, .tag-filter-btn, .top-actions > *, .map-filter > *")
        .forEach((el) => {
          const text = normalizeText(el);
          if (targetTexts.has(text)) {
            el.classList.add("flat-green-filter");
          }
        });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", applyFlatGreenButtons);
    } else {
      applyFlatGreenButtons();
    }

    const observer = new MutationObserver(applyFlatGreenButtons);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  } catch (err) {
    console.warn("V35.3 flat green button patch skipped:", err);
  }
})();


/* =========================================================
   V35.4 收藏冊模式：花 / 蘑菇 / 隱藏
   未點選灰色，點選後綠色
========================================================= */
(function setupCollectionSubFiltersGrayGreen() {
  try {
    const targetTexts = new Set(["花", "蘑菇", "隱藏"]);

    function normalizeText(el) {
      return (el.textContent || "")
        .replace(/\s+/g, "")
        .replace(/[🌸🍄👁️👁]/g, "")
        .trim();
    }

    function isCollectionMode() {
      return !document.body.classList.contains("map-mode");
    }

    function findSubFilterButtons() {
      const selectors = [
        "button",
        "a",
        "[role='button']",
        ".btn-pikmin",
        ".filter-btn",
        ".category-btn",
        ".tag-filter-btn",
        ".top-actions > *",
        ".map-filter > *"
      ].join(",");

      return Array.from(document.querySelectorAll(selectors)).filter(el => {
        return targetTexts.has(normalizeText(el));
      });
    }

    function applyClass() {
      findSubFilterButtons().forEach(el => {
        el.classList.add("collection-sub-filter");

        // 若原本沒有任何選中狀態，不要讓舊的 flat-green-filter 影響灰色狀態
        if (
          !el.classList.contains("active") &&
          !el.classList.contains("is-active") &&
          !el.classList.contains("selected") &&
          el.getAttribute("aria-pressed") !== "true"
        ) {
          el.classList.remove("flat-green-filter");
          el.classList.remove("force-flat-green-filter");
        }
      });
    }

    function bindClickBehavior() {
      findSubFilterButtons().forEach(el => {
        if (el.dataset.collectionSubFilterBound === "true") return;
        el.dataset.collectionSubFilterBound = "true";

        el.addEventListener("click", () => {
          setTimeout(() => {
            applyClass();
          }, 0);
          setTimeout(() => {
            applyClass();
          }, 80);
        }, true);
      });
    }

    function init() {
      applyClass();
      bindClickBehavior();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }

    new MutationObserver(init).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  } catch (err) {
    console.warn("V35.4 collection sub filter patch skipped:", err);
  }
})();


/* =========================================================
   V35.5 FINAL：收藏冊模式 花 / 蘑菇 / 隱藏 狀態修正
   - 不使用原本 active 判斷，避免一進頁面全部變綠
   - 預設三顆都是灰色
   - 點擊後切換 sub-filter-selected 才變綠
========================================================= */
(function setupCollectionSubFilterStateFixV355() {
  try {
    const targetTexts = new Set(["花", "蘑菇", "隱藏"]);

    function normalizeText(el) {
      return (el.textContent || "")
        .replace(/\s+/g, "")
        .replace(/[🌸🍄👁️👁]/g, "")
        .trim();
    }

    function findButtons() {
      const selectors = [
        "button",
        "a",
        "[role='button']",
        ".btn-pikmin",
        ".filter-btn",
        ".category-btn",
        ".tag-filter-btn",
        ".top-actions > *",
        ".map-filter > *"
      ].join(",");

      return Array.from(document.querySelectorAll(selectors)).filter(el =>
        targetTexts.has(normalizeText(el))
      );
    }

    function forceInactiveStyle(el) {
      el.style.setProperty("background", "#F4F6F1", "important");
      el.style.setProperty("background-image", "none", "important");
      el.style.setProperty("color", "#24352C", "important");
      el.style.setProperty("border", "1px solid rgba(36, 53, 44, 0.14)", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("text-shadow", "none", "important");
      el.style.setProperty("transform", "none", "important");
      el.style.setProperty("filter", "none", "important");
      el.style.setProperty("border-radius", "999px", "important");
    }

    function forceActiveStyle(el) {
      el.style.setProperty("background", "#8BC86A", "important");
      el.style.setProperty("background-image", "none", "important");
      el.style.setProperty("color", "#ffffff", "important");
      el.style.setProperty("border", "1px solid #8BC86A", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("text-shadow", "none", "important");
      el.style.setProperty("transform", "none", "important");
      el.style.setProperty("filter", "none", "important");
      el.style.setProperty("border-radius", "999px", "important");
    }

    function syncVisual() {
      // 只在收藏冊模式套用，地圖模式不干擾
      if (document.body.classList.contains("map-mode")) return;

      findButtons().forEach(el => {
        el.classList.add("collection-sub-filter-v355");

        // 清除前幾版可能加上的強制綠色 class
        el.classList.remove("flat-green-filter");
        el.classList.remove("force-flat-green-filter");

        if (el.classList.contains("sub-filter-selected")) {
          forceActiveStyle(el);
        } else {
          forceInactiveStyle(el);
        }
      });
    }

    function bind() {
      findButtons().forEach(el => {
        if (el.dataset.v355SubFilterBound === "true") return;
        el.dataset.v355SubFilterBound = "true";

        // 預設不要選中
        el.classList.remove("sub-filter-selected");

        el.addEventListener("click", () => {
          if (document.body.classList.contains("map-mode")) return;

          // 點擊切換：未點選灰色，點選後綠色
          setTimeout(() => {
            el.classList.toggle("sub-filter-selected");
            syncVisual();
          }, 0);
        }, true);
      });
    }

    function init() {
      bind();
      syncVisual();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }

    new MutationObserver(() => {
      init();
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

  } catch (err) {
    console.warn("V35.5 sub filter state fix skipped:", err);
  }
})();


/* =========================================================
   V35.6 FINAL FIX：用實際 data-tag + active 狀態同步視覺
   這段放在最後，會覆蓋前面舊版 JS / inline style。
========================================================= */
(function finalTagButtonVisualFixV356() {
  const targetTags = new Set(["花", "蘑菇", "隱藏"]);

  function setGray(el) {
    el.style.setProperty("background", "#F4F6F1", "important");
    el.style.setProperty("background-image", "none", "important");
    el.style.setProperty("color", "#24352C", "important");
    el.style.setProperty("border", "1px solid rgba(36, 53, 44, 0.14)", "important");
    el.style.setProperty("border-radius", "999px", "important");
    el.style.setProperty("box-shadow", "none", "important");
    el.style.setProperty("text-shadow", "none", "important");
    el.style.setProperty("transform", "none", "important");
    el.style.setProperty("filter", "none", "important");
  }

  function setGreen(el) {
    el.style.setProperty("background", "#8BC86A", "important");
    el.style.setProperty("background-image", "none", "important");
    el.style.setProperty("color", "#ffffff", "important");
    el.style.setProperty("border", "1px solid #8BC86A", "important");
    el.style.setProperty("border-radius", "999px", "important");
    el.style.setProperty("box-shadow", "none", "important");
    el.style.setProperty("text-shadow", "none", "important");
    el.style.setProperty("transform", "none", "important");
    el.style.setProperty("filter", "none", "important");
  }

  function syncTagButtons() {
    if (document.body.classList.contains("map-mode")) return;

    document.querySelectorAll(".tag-filter[data-tag]").forEach((btn) => {
      const tag = btn.dataset.tag || "";
      if (!targetTags.has(tag)) return;

      // 清掉前面版本可能造成全綠的 class
      btn.classList.remove("flat-green-filter");
      btn.classList.remove("force-flat-green-filter");
      btn.classList.remove("collection-sub-filter-v355");

      if (btn.classList.contains("active")) {
        setGreen(btn);
      } else {
        setGray(btn);
      }
    });
  }

  function init() {
    syncTagButtons();

    document.querySelectorAll(".tag-filter[data-tag]").forEach((btn) => {
      if (btn.dataset.v356Bound === "true") return;
      btn.dataset.v356Bound = "true";

      btn.addEventListener("click", () => {
        setTimeout(syncTagButtons, 0);
        setTimeout(syncTagButtons, 60);
        setTimeout(syncTagButtons, 180);
      }, true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  new MutationObserver(() => {
    init();
    syncTagButtons();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"]
  });

  // 保底：前面舊程式若持續改 style，這裡定期拉回正確狀態
  setInterval(syncTagButtons, 300);
})();
