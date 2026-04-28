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

  let isPreviewMode = new URLSearchParams(window.location.search).get("mode") === "preview";
  let currentModalCardId = null;

  function getFilters() {
    return {
      query: searchInput.value,
      category: categoryFilter.value
    };
  }

  function createCardShareUrl(cardId) {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "preview");
    url.searchParams.set("card", cardId);
    return url.toString();
  }

  function applyPreviewMode() {
    document.body.classList.toggle("preview-mode", isPreviewMode);
    previewModeBanner.classList.toggle("hidden", !isPreviewMode);
    previewModeBtn.classList.toggle("active", isPreviewMode);
    previewModeBtn.textContent = isPreviewMode ? "退出預覽" : "預覽模式";
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
    const isMap = view === "map";

    collectionView.classList.toggle("hidden", isMap);
    mapView.classList.toggle("hidden", !isMap);
    collectionViewBtn.classList.toggle("active", !isMap);
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

  function setMessage(text, isError = false) {
    uploadMessage.textContent = text || "";
    uploadMessage.classList.toggle("error", isError);
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

  function openCardModal(item) {
    currentModalCardId = item.id;
    const index = getPostcards().findIndex(card => card.id === item.id);

    modalCardImage.src = item.image;
    modalCardTitle.textContent = `No.${String(index + 1).padStart(3, "0")}`;
    modalCardLocation.textContent = `${item.category || "全球"}｜${item.locationText}｜${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`;
    modalMapLink.href = createGoogleMapUrl(item.lat, item.lng);

    const url = new URL(window.location.href);
    url.searchParams.set("card", item.id);
    window.history.replaceState({}, "", url);

    cardModal.classList.remove("hidden");
    cardModal.setAttribute("aria-hidden", "false");
  }

  function closeCardModal() {
    currentModalCardId = null;

    const url = new URL(window.location.href);
    url.searchParams.delete("card");
    window.history.replaceState({}, "", url);

    cardModal.classList.add("hidden");
    cardModal.setAttribute("aria-hidden", "true");
  }

  function openSharedCardFromUrl() {
    const cardId = new URLSearchParams(window.location.search).get("card");
    if (!cardId) return;

    const item = getPostcardById(cardId);
    if (item) {
      openCardModal(item);
    }
  }

  function selectMapItem(item) {
    mapFrame.src = createGoogleMapEmbedUrl(item.lat, item.lng);
    mapEmpty.classList.add("hidden");
    setActiveMapItem(mapList, item.id);
  }

  async function handleLikeClick(id) {
    await togglePostcardLike(id);
    refreshViews();
  }

  function showToast(message) {
    const existing = document.querySelector(".copy-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "copy-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.remove();
    }, 1600);
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

    const confirmed = confirm("確定要刪除這張明信片嗎？");
    if (!confirmed) return;

    await deletePostcard(id);
    refreshViews();

    const list = getFilteredPostcards(getFilters());
    if (list.length === 0) {
      mapFrame.src = "";
      mapEmpty.classList.remove("hidden");
    }
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
      filters: getFilters()
    });

    renderMapList({
      mapList,
      onSelect: selectMapItem,
      filters: getFilters()
    });

    if (currentModalCardId) {
      const item = getPostcardById(currentModalCardId);
      if (item) {
        const shouldKeepCardParam = new URLSearchParams(window.location.search).get("card") === currentModalCardId;
        openCardModal(item);
        if (!shouldKeepCardParam) {
          const url = new URL(window.location.href);
          url.searchParams.delete("card");
          window.history.replaceState({}, "", url);
        }
      }
    }
  }

  setupImageUpload({
    fileInput,
    selectFileBtn,
    dropZone,
    pasteZone,
    onImageLoaded: showPreview,
    onError: function (message) {
      setMessage(message, true);
    }
  });

  modeFileBtn.addEventListener("click", () => setUploadMode("file"));
  modeDragBtn.addEventListener("click", () => setUploadMode("drag"));
  modePasteBtn.addEventListener("click", () => setUploadMode("paste"));

  collectionViewBtn.addEventListener("click", () => setView("collection"));
  mapViewBtn.addEventListener("click", () => setView("map"));
  previewModeBtn.addEventListener("click", togglePreviewMode);

  searchInput.addEventListener("input", refreshViews);
  categoryFilter.addEventListener("change", refreshViews);

  clearImageBtn.addEventListener("click", clearPreview);

  closeCardModalBtn.addEventListener("click", closeCardModal);
  cardModalBackdrop.addEventListener("click", closeCardModal);
  modalShareCardBtn.addEventListener("click", function () {
    if (currentModalCardId) handleShareClick(currentModalCardId);
  });

  document.addEventListener("keydown", function (event) {
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

    const category = String(categoryInput.value || "").trim() || "全球";

    await addPostcard({
      image: imageData,
      category,
      likedBy: [],
      likeCount: 0,
      locationText: location.locationText,
      lat: location.lat,
      lng: location.lng,
      createdAt: new Date().toISOString()
    });

    refreshViews();
    locationInput.value = "";
    categoryInput.value = "";
  });

  applyPreviewMode();
  setUploadMode("file");
  setView("collection");

  initializeFirebaseStorage(function () {
    refreshViews();
    openSharedCardFromUrl();
  });
});
