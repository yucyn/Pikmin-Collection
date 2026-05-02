(function () {
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

  let isPreviewMode = false; 
  let currentModalCardId = null;
  let currentTagFilter = "";

  function updateNoteSuggestions() {
    const noteSuggestions = document.getElementById("noteSuggestions");
    if (!noteSuggestions) return;

    const postcards = getPostcards();
    const uniqueNotes = new Set();
    postcards.forEach(item => {
      if (item.note) {
        const tags = item.note.match(/#[\w\u4e00-\u9fa5]+/g);
        if (tags) {
          tags.forEach(t => uniqueNotes.add(t));
        } else {
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
    if (uploadMessage) {
      uploadMessage.textContent = text || "";
      uploadMessage.classList.toggle("error", isError);
    }
  }

  function setUploadLoading(isLoading, text = "圖片處理中…") {
    if (dropZone) dropZone.classList.toggle("upload-loading", Boolean(isLoading));
    if (addCardBtn) addCardBtn.disabled = Boolean(isLoading);
    if (isLoading) setMessage(text);
  }

  function applyPreviewMode() {
    document.body.classList.toggle("is-browse-mode", isPreviewMode);
    if (browseModeBtn) browseModeBtn.classList.toggle("active", isPreviewMode);
    if (mobileTagMenu) mobileTagMenu.classList.add("hidden");
    refreshViews();
  }

  function togglePreviewMode() {
    isPreviewMode = !isPreviewMode;
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

    if (mode === "paste" && pasteZone) {
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
    if (collectionView) collectionView.classList.toggle("hidden", !isCollection);
    if (mapView) mapView.classList.toggle("hidden", !isMap);
    document.body.classList.toggle("map-mode", isMap);
    if (collectionViewBtn) collectionViewBtn.classList.toggle("active", isCollection);
    if (mapViewBtn) mapViewBtn.classList.toggle("active", isMap);
    if (isMap) {
      refreshViews();
      const list = getFilteredPostcards(getFilters());
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
    setMessage("✅ 圖片已載入，正在自動分析樣式...");
    autoDetectTagFromImage(imageData);
  }

  function autoDetectTagFromImage(imageData) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, img.width * 0.7, 0, img.width * 0.3, img.height, 0, 0, 100, 100);
      const data = ctx.getImageData(0, 0, 100, 100).data;
      let r=0, g=0, b=0;
      for(let i=0; i<data.length; i+=4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
      const count = data.length / 4;
      r/=count; g/=count; b/=count;
      
      let detected = "";
      if (g > r * 1.2 && g > b * 1.1) detected = "花";
      else if (r > 130 && g > 110 && b < 100) detected = "蘑菇";
      else if (r < 80 && g < 80 && b < 80) detected = "隱藏";

      if (detected && tagInput) {
        tagInput.value = detected;
        setMessage(`✅ 偵測為「${detected}」樣式`);
      }
    };
    img.src = imageData;
  }

  function clearPreview() {
    clearCurrentImageData();
    if (previewImage) previewImage.src = "";
    if (previewBox) previewBox.classList.add("hidden");
    dropZone?.classList.remove("has-image");
    if (fileInput) fileInput.value = "";
    setMessage("");
  }

  function refreshViews() {
    if (!grid || !categoryFilter) return;
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

    if (mapList) renderMapList({ mapList, onSelect: selectMapItem, filters: getFilters() });

    if (currentModalCardId) {
      const item = getPostcardById(currentModalCardId);
      if (item) openCardModal(item);
    }
  }

  async function handleLikeClick(id) {
    const item = getPostcardById(id);
    if (!item) return;
    const userId = getCurrentUserId();
    const liked = isLikedByCurrentUser(item);
    let newLikedBy = Array.isArray(item.likedBy) ? [...item.likedBy] : [];
    if (liked) newLikedBy = newLikedBy.filter(uid => uid !== userId);
    else newLikedBy.push(userId);
    await updatePostcard(id, { likedBy: newLikedBy, likeCount: newLikedBy.length });
    refreshViews();
  }

  function handleCopyClick(text) {
    const coords = formatCoords(text);
    navigator.clipboard.writeText(coords).then(() => showToast(`已複製座標：${coords}`)).catch(err => { console.error(err); alert("複製失敗"); });
  }

  async function handleDeleteClick(id) {
    if (!confirm("確定要刪除這張明信片嗎？")) return;
    await deletePostcard(id);
    refreshViews();
    updateNoteSuggestions();
  }

  function handleShareClick(id) {
    const url = new URL(window.location.href);
    url.searchParams.set("card", id);
    url.searchParams.set("mode", "preview");
    const shareUrl = url.toString();
    if (navigator.share) {
      navigator.share({ title: "Pikmin 明信片分享", url: shareUrl }).catch(err => { console.warn(err); copyToClipboard(shareUrl); });
    } else {
      copyToClipboard(shareUrl);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => alert("連結已複製到剪貼簿，快分享給好友吧！")).catch(err => { console.error(err); alert("分享失敗，請手動複製網址。"); });
  }

  function openCardModal(item) {
    currentModalCardId = item.id;
    if (modalCardImage) {
      modalCardImage.src = item.image;
      modalCardImage.style.objectPosition = `${clampPercent(item.imageFocusX)}% ${clampPercent(item.imageFocusY)}%`;
    }
    if (modalCardTitle) modalCardTitle.textContent = `No.${String(item.originalIndex + 1).padStart(3, "0")}`;
    if (modalCardLocation) modalCardLocation.textContent = item.locationText || "";
    if (modalMapLink) modalMapLink.href = getGoogleMapUrlFromItem(item);
    
    if (modalCardAuthor) {
      modalCardAuthor.textContent = item.author || "匿名";
      if (modalCardAuthorRow) modalCardAuthorRow.style.display = item.author ? "flex" : "none";
    }
    if (modalCardSource) {
      modalCardSource.textContent = item.source || "";
      if (modalCardSourceRow) modalCardSourceRow.style.display = item.source ? "flex" : "none";
    }
    if (modalCardWebsite) {
      const url = item.websiteUrl || "";
      modalCardWebsite.textContent = url;
      modalCardWebsite.href = url.startsWith("http") ? url : `https://${url}`;
      if (modalCardWebsiteRow) modalCardWebsiteRow.style.display = url ? "flex" : "none";
    }

    if (cardModal) cardModal.classList.remove("hidden");
    const url = new URL(window.location.href);
    url.searchParams.set("card", item.id);
    window.history.replaceState({}, "", url);
  }

  function closeCardModal() {
    currentModalCardId = null;
    if (cardModal) cardModal.classList.add("hidden");
    const url = new URL(window.location.href);
    url.searchParams.delete("card");
    window.history.replaceState({}, "", url);
  }

  function navigateModal(dir) {
    const list = getFilteredPostcards(getFilters());
    const idx = list.findIndex(i => String(i.id) === String(currentModalCardId));
    if (idx === -1) return;
    let nextIdx = idx + dir;
    if (nextIdx < 0) nextIdx = list.length - 1;
    if (nextIdx >= list.length) nextIdx = 0;
    openCardModal(list[nextIdx]);
  }

  function selectMapItem(item) {
    if (mapFrame) mapFrame.src = getGoogleMapUrlFromItem(item);
    if (mapEmpty) mapEmpty.classList.add("hidden");
    if (mapList) setActiveMapItem(mapList, item.id);
  }

  function openSharedCardFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get("card");
    const mode = params.get("mode");
    if (mode === "preview") { isPreviewMode = true; applyPreviewMode(); }
    if (cardId) {
      const item = getPostcardById(cardId);
      if (item) openCardModal(item);
    }
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 2500);
  }

  function handleEditClick(item) {
    const modal = document.getElementById("editCardModal");
    if (!modal) return;
    const form = modal.querySelector("form");
    const locationField = document.getElementById("editLocationInput");
    const categoryField = document.getElementById("editCategoryInput");
    const tagField = document.getElementById("editTagInput");
    const authorField = document.getElementById("editAuthorInput");
    const sourceField = document.getElementById("editSourceInput");
    const websiteField = document.getElementById("editWebsiteInput");
    const noteField = document.getElementById("editNoteInput");
    const saveBtn = document.getElementById("saveEditBtn");
    const closeBtn = document.getElementById("closeEditModalBtn");
    const focusImage = document.getElementById("editFocusImage");
    const focusPoint = document.getElementById("editFocusPoint");
    const cancelBtn = document.getElementById("cancelEditBtn");

    if (focusImage) focusImage.src = item.image;
    let focusX = item.imageFocusX || 50;
    let focusY = item.imageFocusY || 50;
    const updateFocusUI = () => {
      if (focusPoint) { focusPoint.style.left = `${focusX}%`; focusPoint.style.top = `${focusY}%`; }
      if (focusImage) focusImage.style.objectPosition = `${focusX}% ${focusY}%`;
    };
    updateFocusUI();

    const handleFocusClick = e => {
      const rect = focusImage.getBoundingClientRect();
      focusX = ((e.clientX - rect.left) / rect.width) * 100;
      focusY = ((e.clientY - rect.top) / rect.height) * 100;
      focusX = Math.min(100, Math.max(0, focusX));
      focusY = Math.min(100, Math.max(0, focusY));
      updateFocusUI();
    };
    if (focusImage) focusImage.onclick = handleFocusClick;

    const closeEditModal = () => { modal.classList.add("hidden"); };
    if (closeBtn) closeBtn.onclick = closeEditModal;
    if (cancelBtn) cancelBtn.onclick = closeEditModal;

    const resetFocusBtn = document.getElementById("resetFocusBtn");
    if (resetFocusBtn) resetFocusBtn.onclick = () => {
      focusX = 50; focusY = 50; updateFocusUI();
      focusImage.style.objectPosition = "50% 50%";
    };

    locationField.value = item.locationText || "";
    categoryField.value = item.category || "全球";
    tagField.value = item.tag || "";
    if (authorField) authorField.value = item.author || "";
    if (sourceField) sourceField.value = item.source || "";
    if (websiteField) websiteField.value = item.websiteUrl || "";
    if (noteField) noteField.value = item.note || "";
    if (saveBtn) { saveBtn.disabled = false; saveBtn.removeAttribute("disabled"); }

    let isSavingEdit = false;
    async function submitEditChanges() {
      if (isSavingEdit) return;
      const location = parseLocation(locationField.value);
      if (!location) { alert("請輸入正確座標，例如：43.587789, 142.465553"); return; }
      isSavingEdit = true;
      if (saveBtn) saveBtn.disabled = true;
      try {
        const updated = await updatePostcardSmart(item.id, {
          locationText: location.locationText, lat: location.lat, lng: location.lng,
          category: categoryField.value || location.country || "全球",
          tag: tagField.value || "",
          author: authorField ? authorField.value : "",
          source: sourceField ? sourceField.value : "",
          websiteUrl: websiteField ? websiteField.value : "",
          note: noteField ? noteField.value : "",
          imageFocusX: Number(focusX.toFixed(2)), imageFocusY: Number(focusY.toFixed(2))
        });
        if (updated) { closeEditModal(); refreshViews(); updateNoteSuggestions(); showToast("已更新明信片"); }
      } catch (err) { console.error("儲存失敗：", err); alert("儲存失敗，請稍後再試"); } finally { isSavingEdit = false; if (saveBtn) saveBtn.disabled = false; }
    }
    form.onsubmit = async event => { event.preventDefault(); await submitEditChanges(); };
    if (saveBtn) { saveBtn.onclick = async event => { event.preventDefault(); event.stopPropagation(); await submitEditChanges(); }; }
    modal.classList.remove("hidden");
  }

  function bindTagFilterButtons() {
    const tagItems = document.querySelectorAll(".mobile-tag-menu .mobile-tag-item");
    function updateActiveState(tag) {
      currentTagFilter = tag;
      tagItems.forEach(el => {
        const isActive = (el.dataset.tag || "") === tag;
        el.classList.toggle("active", isActive);
      });
      if (mobileTagMenu) mobileTagMenu.classList.add("hidden");
      refreshViews();
    }
    tagItems.forEach(el => { el.addEventListener("click", function (e) { e.stopPropagation(); updateActiveState(this.dataset.tag || ""); }); });
  }

  function initScrollTopFab() {
    const scrollBtn = document.getElementById("scrollTopBtn");
    const mobileScrollBtn = document.getElementById("mobileScrollTopBtn");
    const arrowSvg = `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 15.5L12 8.5L19 15.5" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    function bind(btn) {
      if (!btn || btn.dataset.bound === "true") return;
      btn.dataset.bound = "true";
      btn.innerHTML = arrowSvg;
      btn.addEventListener("click", e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    }
    bind(scrollBtn); bind(mobileScrollBtn);
  }

  window.toggleHero = function() {
    const hero = document.querySelector('.hero');
    if (hero) hero.classList.toggle('collapsed');
  };

  // 初始化執行
  setupImageUpload({
    fileInput, selectFileBtn, dropZone, pasteZone,
    onImageLoaded: showPreview,
    onError: message => { setUploadLoading(false); setMessage(message, true); },
    onStart: message => setUploadLoading(true, message),
    onDone: () => setUploadLoading(false)
  });

  if (modeFileBtn) modeFileBtn.addEventListener("click", () => setUploadMode("file"));
  if (modeDragBtn) modeDragBtn.addEventListener("click", () => setUploadMode("drag"));
  if (modePasteBtn) modePasteBtn.addEventListener("click", () => setUploadMode("paste"));
  if (collectionViewBtn) collectionViewBtn.addEventListener("click", () => setView("collection"));
  if (mapViewBtn) mapViewBtn.addEventListener("click", () => setView("map"));
  if (previewModeBtn) previewModeBtn.addEventListener("click", togglePreviewMode);
  if (searchInput) {
    let timer = null;
    searchInput.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(refreshViews, 300); });
  }
  if (categoryFilter) categoryFilter.addEventListener("change", refreshViews);
  if (clearImageBtn) clearImageBtn.addEventListener("click", clearPreview);
  if (closeCardModalBtn) closeCardModalBtn.addEventListener("click", closeCardModal);
  if (cardModalBackdrop) cardModalBackdrop.addEventListener("click", closeCardModal);
  if (modalShareCardBtn) modalShareCardBtn.addEventListener("click", () => { if (currentModalCardId) handleShareClick(currentModalCardId); });
  
  document.addEventListener("keydown", event => {
    if (cardModal && !cardModal.classList.contains("hidden")) {
      if (event.key === "Escape") closeCardModal();
      if (event.key === "ArrowLeft") { event.preventDefault(); navigateModal(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); navigateModal(1); }
    }
  });

  bindTagFilterButtons();
  initScrollTopFab();
  applyPreviewMode();
  setUploadMode("file");
  setView("collection");

  const initialPostcards = getPostcards();
  refreshViews();
  updateNoteSuggestions();

  if (initialPostcards.length > 0) {
    initialPostcards.slice(0, 6).forEach(item => { const img = new Image(); img.src = item.image; });
  }

  initializeFirebaseStorage(() => { refreshViews(); updateNoteSuggestions(); openSharedCardFromUrl(); });

  // 手機版按鈕綁定
  const mobileUploadFab = document.getElementById("mobileUploadFab");
  const sidebar = document.querySelector(".sidebar");
  if (mobileUploadFab && sidebar) {
    mobileUploadFab.addEventListener("click", e => { e.preventDefault(); sidebar.classList.toggle("open"); mobileUploadFab.textContent = sidebar.classList.contains("open") ? "－" : "＋"; });
    document.querySelectorAll(".quick-country-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.getElementById("categoryInput");
        if (input) { input.value = btn.getAttribute("data-country"); input.dispatchEvent(new Event("change")); }
      });
    });
    document.addEventListener("click", e => {
      if (window.innerWidth <= 768 && sidebar.classList.contains("open") && !sidebar.contains(e.target) && !mobileUploadFab.contains(e.target)) { sidebar.classList.remove("open"); mobileUploadFab.textContent = "＋"; }
    });
  }
})();
