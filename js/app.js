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
  const collageViewBtn = document.getElementById("collageViewBtn");
  const previewModeBtn = document.getElementById("previewModeBtn");
  const previewModeBanner = document.getElementById("previewModeBanner");
  const collectionView = document.getElementById("collectionView");
  const mapView = document.getElementById("mapView");
  const collageView = document.getElementById("collageView");
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

  let isPreviewMode = new URLSearchParams(window.location.search).get("mode") === "preview";
  let currentModalCardId = null;
  let currentTagFilter = "";

  function getFilters() {
    return { query: searchInput.value, category: categoryFilter.value, tag: currentTagFilter };
  }

  function setMessage(text, isError = false) {
    uploadMessage.textContent = text || "";
    uploadMessage.classList.toggle("error", isError);
  }

  function applyPreviewMode() {
    document.body.classList.toggle("preview-mode", isPreviewMode);
    previewModeBanner.classList.toggle("hidden", !isPreviewMode);
    previewModeBtn.classList.toggle("active", isPreviewMode);
    previewModeBtn.textContent = isPreviewMode ? "退出預覽" : "預覽模式";
  }

  function togglePreviewMode() {
    isPreviewMode = !isPreviewMode;
    bindTagFilterButtons();
  initScrollTopFab();
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
    refreshViews();
  }

  function setUploadMode(mode) {
    const modes = [
      { name: "file", btn: modeFileBtn, panel: filePanel },
      { name: "drag", btn: modeDragBtn, panel: dragPanel },
      { name: "paste", btn: modePasteBtn, panel: pastePanel }
    ];

    modes.forEach(item => {
      item.btn.classList.toggle("active", item.name === mode);
      item.panel.classList.toggle("hidden", item.name !== mode);
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
    const isCollection = view === "collection";
    const isMap = view === "map";
    const isCollage = view === "collage";

    collectionView.classList.toggle("hidden", !isCollection);
    mapView.classList.toggle("hidden", !isMap);
    collageView.classList.toggle("hidden", !isCollage);

    collectionViewBtn.classList.toggle("active", isCollection);
    mapViewBtn.classList.toggle("active", isMap);
    collageViewBtn.classList.toggle("active", isCollage);

    if (isMap) {
      refreshViews();
      const list = getFilteredPostcards(getFilters());
      if (list.length > 0) {
        selectMapItem(list[0]);
      } else {
        mapFrame.src = "";
        mapEmpty.classList.remove("hidden");
      }
    }

    if (isCollage && window.CollageEngine) {
      window.CollageEngine.refreshLibrary(getFilteredPostcards(getFilters()));
    }
  }

  function showPreview(imageData) {
    setCurrentImageData(imageData);
    previewImage.src = imageData;
    previewBox.classList.remove("hidden");
    setMessage("✅ 圖片已載入");
  }

  function clearPreview() {
    clearCurrentImageData();
    previewImage.removeAttribute("src");
    previewBox.classList.add("hidden");
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

  function openCardModal(item) {
    currentModalCardId = item.id;
    const index = getPostcards().findIndex(card => card.id === item.id);

    modalCardImage.src = item.image;
    modalCardTitle.textContent = `No.${String(index + 1).padStart(3, "0")}`;
    modalCardLocation.textContent = `${item.category || "全球"}｜${item.locationText}｜${isOwnedByCurrentUser(item) ? "我的明信片" : "公開明信片"}｜${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`;
    modalMapLink.href = createGoogleMapUrl(item.lat, item.lng);

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
    cardModal.classList.add("hidden");
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
      button.addEventListener("click", () => {
        buttons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        currentTagFilter = button.dataset.tag || "";
        refreshViews();
      });
    });
  }

  function initScrollTopFab() {
    const scrollBtn = document.getElementById("v28CreateFab");
    const createMenu = document.getElementById("v28CreateMenu");

    if (createMenu) {
      createMenu.style.display = "none";
      createMenu.setAttribute("aria-hidden", "true");
    }

    if (!scrollBtn) return;

   scrollBtn.setAttribute("aria-label", "回到頂部");

/* 👇 加這段 */
scrollBtn.innerHTML = `
  <svg viewBox="0 0 24 24">
    <path d="M5 15.5L12 8.5L19 15.5"
      fill="none"
      stroke="currentColor"
      stroke-width="3.8"
      stroke-linecap="round"
      stroke-linejoin="round"/>
  </svg>
`;
    scrollBtn.classList.add("scroll-top-fab");

    scrollBtn.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }, true);
  }


  function refreshViews() {
    const selectedCategory = categoryFilter.value;
    renderCategoryFilter(categoryFilter, selectedCategory);

    renderPostcards({
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

    renderMapList({ mapList, onSelect: selectMapItem, filters: getFilters() });

    if (window.CollageEngine) {
      window.CollageEngine.refreshLibrary(getFilteredPostcards(getFilters()));
    }

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
    onError: message => setMessage(message, true)
  });

  modeFileBtn.addEventListener("click", () => setUploadMode("file"));
  modeDragBtn.addEventListener("click", () => setUploadMode("drag"));
  modePasteBtn.addEventListener("click", () => setUploadMode("paste"));

  collectionViewBtn.addEventListener("click", () => setView("collection"));
  mapViewBtn.addEventListener("click", () => setView("map"));
  collageViewBtn.addEventListener("click", () => setView("collage"));
  previewModeBtn.addEventListener("click", togglePreviewMode);

  searchInput.addEventListener("input", refreshViews);
  categoryFilter.addEventListener("change", refreshViews);
  locationInput.addEventListener("change", autoFillCountryFromLocation);
  locationInput.addEventListener("blur", autoFillCountryFromLocation);

  clearImageBtn.addEventListener("click", clearPreview);
  closeCardModalBtn.addEventListener("click", closeCardModal);
  cardModalBackdrop.addEventListener("click", closeCardModal);
  modalShareCardBtn.addEventListener("click", () => {
    if (currentModalCardId) handleShareClick(currentModalCardId);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeCardModal();
  });

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

    clearPreview();
    locationInput.value = "";
    categoryInput.value = "";
    if (tagInput) tagInput.value = "";
  });

  bindTagFilterButtons();
  initScrollTopFab();
  applyPreviewMode();
  setUploadMode("file");
  setView("collection");

  if (window.CollageEngine) {
    window.CollageEngine.init({
      onBackToCollection: function () {
        setView("collection");
      },
      getPostcards: function () {
        return getFilteredPostcards(getFilters());
      }
    });
  }

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
// 🔥 縮放視窗後，自動刷新卡片顯示狀態（不重整頁面）
(function () {
  let resizeTimer = null;
  let lastWidth = window.innerWidth;

  function softRefreshCards() {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");

    // 觸發原本 app.js 綁好的更新事件
    if (searchInput) {
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (categoryFilter) {
      categoryFilter.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // 保險：讓 grid 重新計算排版
    const grid = document.getElementById("grid");
    if (grid) {
      grid.style.display = "none";
      grid.offsetHeight;
      grid.style.display = "";
    }
  }

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      const newWidth = window.innerWidth;

      if (Math.abs(newWidth - lastWidth) < 20) return;

      lastWidth = newWidth;
      softRefreshCards();
    }, 120);
  });
})();
// 🔥 手機版：點主標複製
document.addEventListener("click", async (e) => {
  const el = e.target.closest(".postcard-title");
  if (!el) return;

  if (window.innerWidth > 768) return;

  const text = el.innerText.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);

    // toast
    const toast = document.createElement("div");
    toast.innerText = "已複製主標";
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
