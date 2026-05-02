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
    document.body.classList.toggle("is-browse-mode", isPreviewMode);
    if (browseModeBtn) browseModeBtn.classList.toggle("active", isPreviewMode);
    
    // 瀏覽模式下，預設關閉標籤選單
    if (mobileTagMenu) mobileTagMenu.classList.add("hidden");
    
    refreshViews();
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

      // 1. 如果有綠色蓋章，100% 是蘑菇
      if (greenStampCount > 10) {
        finalTag = "蘑菇";
      } 
      // 2. 如果黃色像素過多 (大黃花)，判定為花
      else if (totalYellow > 120) {
        finalTag = "花";
      }
      // 3. 如果右下角有大面積純白 (大白花)
      else if (pureWhiteInBottom > (sampleCount / 2) * 0.20) {
        finalTag = "花";
      }
      // 4. 如果有適量的中段黃色 (星星)，判定為蘑菇
      else if (middleYellow > 6) {
        finalTag = "蘑菇";
      }
      // 5. 其他特徵 (高彩度底紋)
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
      modalCardImage.src = item.image;
      modalCardTitle.textContent = `No.${String(index + 1).padStart(3, "0")}`;
      const noteSuffix = item.note ? `｜${item.note}` : "";
      modalCardLocation.textContent = `${item.category || "全球"}｜${item.locationText}｜${isOwnedByCurrentUser(item) ? "我的明信片" : "公開明信片"}｜${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}${noteSuffix}`;
      modalMapLink.href = createGoogleMapUrl(item.lat, item.lng);

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
              <option value="巴西">巴西</option>
              <option value="哥倫比亞">哥倫比亞</option>
              <option value="阿根廷">阿根廷</option>
              <option value="智利">智利</option>
              <option value="馬紹爾群島">馬紹爾群島</option>
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

          <div class="field-half">
            <label for="editAuthorInput">上傳者</label>
            <input id="editAuthorInput" type="text" placeholder="名字/暱稱" />
          </div>

          <div class="field-half">
            <label for="editNoteInput">建立標籤</label>
            <input id="editNoteInput" type="text" placeholder="自定義標籤/備註" />
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
    const authorField = document.getElementById("editAuthorInput");
    const sourceField = document.getElementById("editSourceInput");
    const websiteField = document.getElementById("editWebsiteInput");
    const noteField = document.getElementById("editNoteInput");
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
    if (authorField) authorField.value = item.author || "";
    if (sourceField) sourceField.value = item.source || "";
    if (websiteField) websiteField.value = item.websiteUrl || "";
    if (noteField) noteField.value = item.note || "";
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
          author: authorField ? authorField.value : "",
          source: sourceField ? sourceField.value : "",
          websiteUrl: websiteField ? websiteField.value : "",
          note: noteField ? noteField.value : "",
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
    const tagItems = document.querySelectorAll(".mobile-tag-menu .mobile-tag-item");

    function updateActiveState(tag) {
      currentTagFilter = tag;
      tagItems.forEach(el => {
        const isActive = (el.dataset.tag || "") === tag;
        el.classList.toggle("active", isActive);
        el.classList.toggle("is-active", isActive);
      });
      if (mobileTagMenu) mobileTagMenu.classList.add("hidden");
      refreshViews();
    }

    tagItems.forEach(el => {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        updateActiveState(this.dataset.tag || "");
      });
    });

    if (mobileTagFilterBtn) {
      // 移除舊的監聽器（如果有）並重新綁定
      mobileTagFilterBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log("Mobile filter clicked"); // 除錯用
        if (mobileTagMenu) {
          mobileTagMenu.classList.toggle("hidden");
        }
      };
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
      onLikeClick: handleLikeClick,
      onCopyClick: handleCopyClick,
      onDeleteClick: handleDeleteClick,
      onShareClick: handleShareClick,
      onEditClick: handleEditClick,
      filters: getFilters()
    });

    renderMapList({ mapList, onSelect: selectMapItem, filters: getFilters() });

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

  collectionViewBtn.addEventListener("click", () => setView("collection"));
  mapViewBtn.addEventListener("click", () => setView("map"));
  if (previewModeBtn) previewModeBtn.addEventListener("click", togglePreviewMode);

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
        author: authorInput ? authorInput.value : "",
        source: sourceInput ? sourceInput.value : "",
        websiteUrl: websiteInput ? websiteInput.value : "",
        note: noteInput ? noteInput.value : "",
        createdAt: new Date().toISOString()
      });

      refreshViews();
      clearPreview();
      setMessage("✅ 明信片已新增");
      locationInput.value = "";
      categoryInput.value = "";
      if (tagInput) tagInput.value = "";
      if (authorInput) authorInput.value = "";
      if (sourceInput) sourceInput.value = "";
      if (websiteInput) websiteInput.value = "";
      if (noteInput) noteInput.value = "";
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

  // 初始化標籤篩選器（包含手機版圖示選單）
  bindTagFilterButtons();
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


