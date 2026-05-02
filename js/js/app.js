function debouncePikmin(fn, wait) {
  let timer = null;
  return function debounced() {
    const args = arguments;
    const self = this;
    clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      fn.apply(self, args);
    }, wait);
  };
}

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
  const modalPrevBtn = document.getElementById("modalPrevBtn");
  const modalNextBtn = document.getElementById("modalNextBtn");

  let isPreviewMode = false; // V31.6：取消預覽模式
  let currentModalCardId = null;
  let currentTagFilter = "";

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
    // 依照 isPreviewMode 當前狀態套用樣式，不強制覆蓋值
    document.body.classList.toggle("preview-mode", isPreviewMode);
    if (previewModeBanner) previewModeBanner.classList.toggle("hidden", !isPreviewMode);
    if (previewModeBtn) {
      previewModeBtn.classList.toggle("active", isPreviewMode);
      previewModeBtn.style.display = "none"; // 保留原本隱藏設定
    }
  }

  function togglePreviewMode() {
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
      refreshViews();
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
    setMessage("✅ 圖片已載入，可以輸入座標並新增明信片");
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
      modalCardImage.src = item.image;
      modalCardTitle.textContent = `No.${String(index + 1).padStart(3, "0")}`;
      modalCardLocation.textContent = `${item.category || "全球"}｜${item.locationText}｜${isOwnedByCurrentUser(item) ? "我的明信片" : "公開明信片"}｜${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`;
      modalMapLink.href = createGoogleMapUrl(item.lat, item.lng);
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
    updateModalNavState();
  }

  function closeCardModal() {
    currentModalCardId = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("card");
    window.history.replaceState({}, "", url);
    cardModal.classList.add("hidden");
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
      console.error("like toggle failed:", error);
      alert("愛心操作失敗，請稍後再試");
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
    await deletePostcard(id);
  }

  function ensureEditModal() {
    let modal = document.getElementById("editModal");
    const hasCompleteStructure = modal &&
      modal.querySelector("#editForm") &&
      modal.querySelector("#editImageFocusPreview") &&
      modal.querySelector("#editSaveBtn");
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

        <label>圖片展示位置（拖拉調整）</label>
        <div id="editImageFocusPreview" class="edit-image-focus-preview" aria-label="拖拉調整圖片位置">
          <img id="editImageFocusImage" alt="編輯中的卡片圖片" />
        </div>
        <div class="edit-image-focus-actions">
          <small>在預覽圖上拖曳可調整裁切位置</small>
          <button type="button" id="resetImageFocusBtn" class="edit-image-focus-reset">回到置中</button>
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

    return modal;
  }

  function closeEditModal() {
    const modal = document.getElementById("editModal");
    if (modal) modal.classList.add("hidden");
  }

  async function updatePostcardSmart(id, changes) {
    if (typeof updatePostcard === "function") {
      const ok = await updatePostcard(id, changes);
      return ok !== false;
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
    const focusPreview = document.getElementById("editImageFocusPreview");
    const focusImage = document.getElementById("editImageFocusImage");
    const resetFocusBtn = document.getElementById("resetImageFocusBtn");
    const saveBtn = document.getElementById("editSaveBtn") || form.querySelector(".edit-save-btn");

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

    // 給預覽圖加上 GPU 合成提示，減少重排
    focusImage.style.willChange = "object-position";
    focusPreview.style.touchAction = "none"; // 阻止系統滾動，避免拖曳被搶
    focusPreview.style.userSelect = "none";

    function applyFocusUpdate() {
      rafId = null;
      const width  = Math.max(focusPreview.clientWidth,  1);
      const height = Math.max(focusPreview.clientHeight, 1);
      const dx = pendingX - dragStartX;
      const dy = pendingY - dragStartY;
      focusX = clampFocus(dragStartFocusX - (dx / width)  * 100);
      focusY = clampFocus(dragStartFocusY - (dy / height) * 100);
      focusImage.style.objectPosition = `${focusX}% ${focusY}%`;
    }

    function scheduleDragUpdate(x, y) {
      pendingX = x;
      pendingY = y;
      if (!rafId) {
        rafId = requestAnimationFrame(applyFocusUpdate);
      }
    }

    function stopDrag() {
      isDraggingFocus = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      focusPreview.classList.remove("is-dragging");
      focusPreview.releasePointerCapture && focusPreview._pointerId != null &&
        focusPreview.releasePointerCapture(focusPreview._pointerId);
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

    // 清除舊的 touch / mouse handler，避免重複觸發
    focusPreview.onmousedown  = null;
    focusPreview.ontouchstart = null;

    resetFocusBtn.onclick = () => {
      focusX = 50;
      focusY = 50;
      focusImage.style.objectPosition = "50% 50%";
    };

    locationField.value = item.locationText || "";
    categoryField.value = item.category || "全球";
    tagField.value = item.tag || "";
    // 每次開啟編輯 modal 時，確保按鈕可用、鎖狀態清除
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.removeAttribute("disabled");
    }

    let isSavingEdit = false;

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
        const updated = await updatePostcardSmart(item.id, {
          locationText: location.locationText,
          lat: location.lat,
          lng: location.lng,
          category: categoryField.value || location.country || "全球",
          tag: tagField.value || "",
          imageFocusX: Number(focusX.toFixed(2)),
          imageFocusY: Number(focusY.toFixed(2))
        });
        if (updated) {
          closeEditModal();
          refreshViews();
          showToast("已更新明信片");
        }
      } catch (err) {
        console.error("儲存失敗：", err);
        alert("儲存失敗，請稍後再試");
      } finally {
        isSavingEdit = false;
        if (saveBtn) saveBtn.disabled = false;
      }
    }

    form.onsubmit = async event => {
      event.preventDefault();
      await submitEditChanges();
    };

    if (saveBtn) {
      // 只用 onclick，避免 ontouchend + click 雙重觸發鎖住 isSavingEdit
      saveBtn.onclick = async event => {
        event.preventDefault();
        event.stopPropagation();
        stopDrag();
        await submitEditChanges();
      };
      saveBtn.onpointerdown = null;
      saveBtn.ontouchstart = null;
      saveBtn.onpointerup = null;
      saveBtn.ontouchend = null;
    }

    modal.classList.remove("hidden");
  }

  function bindTagFilterButtons() {
    const buttons = document.querySelectorAll(".tag-filter");
    buttons.forEach(button => {
      // 守衛：已綁定過就跳過，避免重複呼叫疊加 listener
      if (button.dataset.tagFilterBound === "true") return;
      button.dataset.tagFilterBound = "true";
      button.addEventListener("click", () => {
        buttons.forEach(btn => {
          btn.classList.remove("active", "is-active");
        });
        button.classList.add("active");
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
    const renderPassGen = typeof beginPikminUiRenderPass === "function" ? beginPikminUiRenderPass() : 0;
    const selectedCategory = categoryFilter.value;
    renderCategoryFilter(categoryFilter, selectedCategory);

    if (currentModalCardId) {
      const item = getPostcardById(currentModalCardId);
      if (item) openCardModal(item);
    }

    const filters = getFilters();
    renderPostcards({
      grid,
      emptyState,
      onCardClick: openCardModal,
      onLikeClick: handleLikeClick,
      onCopyClick: handleCopyClick,
      onDeleteClick: handleDeleteClick,
      onShareClick: handleShareClick,
      onEditClick: handleEditClick,
      filters,
      renderPassGen
    });

    renderMapList({ mapList, onSelect: selectMapItem, filters, renderPassGen });
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

  const debouncedRefreshViews = debouncePikmin(refreshViews, 220);
  searchInput.addEventListener("input", debouncedRefreshViews);
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
        createdAt: new Date().toISOString()
      });

      refreshViews();
      clearPreview();
      setMessage("✅ 明信片已新增");
      locationInput.value = "";
      categoryInput.value = "";
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
    mobileUploadFab.textContent = sidebar.classList.contains("open") ? "－" : "＋";
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

  document.addEventListener("click", (e) => {
    if (window.innerWidth > 768) return;
    if (!sidebar.classList.contains("open")) return;
    if (sidebar.contains(e.target)) return;
    if (mobileUploadFab.contains(e.target)) return;
    sidebar.classList.remove("open");
    mobileUploadFab.textContent = "＋";
  });
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


