function formatCoords(coords){
  if(!coords) return "";
  const [lat, lng] = String(coords).split(",").map(n => parseFloat(n));

  if(Number.isNaN(lat) || Number.isNaN(lng)) {
    return coords;
  }

  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function isMobileView(){
  return window.matchMedia("(max-width:600px)").matches;
}
function formatLikeCount(count) {
  const number = Number(count || 0);
  if (number >= 10000) return `${(number / 10000).toFixed(1).replace(".0", "")} 萬`;
  return String(number);
}


function isLikedByCurrentUser(item, cachedUserId) {
  const userId = cachedUserId || getCurrentUserId();
  return Array.isArray(item.likedBy) && item.likedBy.includes(userId);
}

function getFilteredPostcards(filters = {}) {
  // 先根據登入身份過濾可見明信片
  const list = (typeof getVisiblePostcards === "function")
    ? getVisiblePostcards()
    : getPostcards();

  const query = String(filters.query || "").trim().toLowerCase();
  const category = String(filters.category || "").trim();
  const tag = String(filters.tag || "").trim();

  return list
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .filter(item => {
      const itemCategory = item.category || "全球";
      const itemTag = item.tag || "";

      const text = [
        item.locationText || "",
        itemCategory,
        item.note || "",
        itemTag
      ].join(" ").toLowerCase();

      const matchQuery = !query || text.includes(query);
      const matchCategory = !category || itemCategory === category;
      const matchTag = !tag || itemTag === tag;

      return matchQuery && matchCategory && matchTag;
    });
}

function getCategories() {
  const popular = ["全球","台灣","日本","韓國","香港","澳門","泰國","新加坡","馬來西亞","越南","菲律賓","印度","印尼","蒙古","美國","加拿大","澳洲","紐西蘭","英國","法國","德國","義大利","西班牙","葡萄牙","瑞士","荷蘭","奧地利","希臘","挪威","芬蘭","冰島","土耳其","埃及","墨西哥","巴西","哥倫比亞","阿根廷","智利","馬紹爾群島","杜拜","布拉格","斯洛維尼亞"];
  const existing = getPostcards().map(item => item.category || "全球").filter(Boolean);
  return Array.from(new Set([...popular, ...existing]));
}

function renderCategoryFilter(categoryFilter, selectedValue = "") {
  const categories = getCategories();
  const countryCount = categories.filter(c => c !== "全球").length;
  categoryFilter.innerHTML = "";

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category === "全球" ? "" : category;
    option.textContent = category === "全球" ? `全球進度 (${countryCount} 國)` : category;
    option.selected = category === "全球" ? selectedValue === "" : category === selectedValue;
    categoryFilter.appendChild(option);
  });
}

function createEl(tagName, className, textContent) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

function getGoogleMapUrlFromItem(item) {
  if (typeof createGoogleMapUrl === "function" && item.lat !== undefined && item.lng !== undefined) {
    return createGoogleMapUrl(item.lat, item.lng);
  }
  const coords = String(item.locationText || "").trim();
  return `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

function renderPostcards({
  grid,
  emptyState,
  onCardClick,
  onLikeClick,
  onCopyClick,
  onDeleteClick,
  onShareClick,
  onEditClick,
  filters,
  page = 1,
  pageSize = 14,
  onPageChange
}) {
  const allFilteredList = getFilteredPostcards(filters);
  const totalItems = allFilteredList.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const list = allFilteredList.slice(start, end);

  grid.innerHTML = "";
  emptyState.classList.toggle("hidden", totalItems > 0);

  // V38: 使用 DocumentFragment 減少 DOM 重繪次數，大幅提升手機版渲染效能
  const fragment = document.createDocumentFragment();

  let currentUser = null;
  try {
    if (window.firebase && typeof firebase.auth === "function") {
      currentUser = firebase.auth().currentUser;
    }
  } catch (e) {}
  
  const isRealUser = !!(currentUser && !currentUser.isAnonymous);
  const currentUserId = typeof getCurrentUserId === "function" ? getCurrentUserId() : null; // V38: 快取 ID，避免在迴圈內反覆讀取 localStorage
  let isAdmin = false;
  try {
    if (window.PikminAuthGate && typeof window.PikminAuthGate.isFirebaseAdmin === "function") {
      isAdmin = !!window.PikminAuthGate.isFirebaseAdmin();
    }
  } catch (e) {}

  list.forEach((item, idx) => {
    const category = item.category || "全球";
    const liked = typeof isLikedByCurrentUser === "function" ? isLikedByCurrentUser(item, currentUserId) : false;
    const isOwner = typeof isOwnedByCurrentUser === "function" && isOwnedByCurrentUser(item);
    const isBrowseModeActive = document.body.classList.contains("is-browse-mode");
    const canManage = (isAdmin || isOwner) && !isBrowseModeActive; // 修正：允許匿名擁有者管理其卡片
    
    const tag = item.tag || "";
    const isV37Locked = Boolean(window.PikminAuthGate && window.PikminAuthGate.shouldLockItem && window.PikminAuthGate.shouldLockItem(item));

    const card = createEl("article", `postcard-card ${isV37Locked ? "v37-mushroom-locked" : ""}`);
    card.dataset.id = item.id;
    card.dataset.tag = tag;

    const photo = createEl("div", "postcard-photo");
    const image = createEl("img");
    
    // V38 優化：針對首頁前 4 張圖片取消延遲載入並提高權重 (優化 LCP)
    const isPriorityImage = (currentPage === 1 && idx < 4);
    if (isPriorityImage) {
      image.loading = "eager";
      image.fetchPriority = "high";
    } else {
      image.loading = "lazy"; // 延遲載入
    }
    
    image.decoding = "async"; // 非同步解碼
    image.onload = () => {
      const ratio = image.naturalWidth / image.naturalHeight;
      if (ratio > 1.2) image.classList.add("landscape");
    };
    image.src = item.image;
    image.alt = "Pikmin postcard image";
    image.style.setProperty("object-position", `${clampPercent(item.imageFocusX)}% ${clampPercent(item.imageFocusY)}%`, "important");
    photo.appendChild(image);

    const isBrowseMode = document.body.classList.contains("is-browse-mode");
    const hoverActions = createEl("div", "postcard-hover-actions");

    // V38: 改用人頭數與愛心圖示，移除多餘文字
    const actionsGroup = createEl("div", "postcard-actions-group");

    // (愛心按鈕已移至下方 info 區塊，不再懸浮)

    hoverActions.appendChild(actionsGroup);

    if (!isBrowseMode && canManage && !isMobileView()) {
      const editBtn = createEl("button", "float-btn edit-btn", "編輯");
      editBtn.onclick = (e) => { e.stopPropagation(); onEditClick(item); };
      hoverActions.appendChild(editBtn);
    }

    if (!isBrowseMode && !isMobileView()) {
      const moreMenu = createEl("div", "postcard-more-menu");
      const shareBtn = createEl("button", "postcard-menu-action", "分享");
      shareBtn.onclick = (e) => { e.stopPropagation(); onShareClick(item.id); moreMenu.classList.remove("show"); };
      moreMenu.appendChild(shareBtn);

      if (canManage && !isBrowseMode) {
        const delBtn = createEl("button", "postcard-menu-action danger", "刪除");
        delBtn.onclick = (e) => { e.stopPropagation(); onDeleteClick(item.id); moreMenu.classList.remove("show"); };
        moreMenu.appendChild(delBtn);
      }

      const moreBtn = createEl("button", "float-btn more-btn", "⋯");
      moreBtn.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll(".postcard-more-menu.show").forEach(m => { if(m !== moreMenu) m.classList.remove("show"); });
        moreMenu.classList.toggle("show");
      };
      hoverActions.appendChild(moreBtn);
      hoverActions.appendChild(moreMenu);
    }
    photo.appendChild(hoverActions);
    
    if (isBrowseMode) {
      card.onclick = () => onCardClick(item);
      card.style.cursor = "pointer";
    } else {
      photo.onclick = () => onCardClick(item);
    }
    card.appendChild(photo);

    const info = createEl("div", "postcard-info");
    const coords = createEl("div", "postcard-coords");
    if (!isV37Locked) {
      coords.innerHTML = item.locationText || "";
      coords.onclick = (e) => { e.stopPropagation(); onCopyClick(item.locationText); };
    } else {
      coords.textContent = "待解鎖";
      coords.onclick = (e) => { e.stopPropagation(); if(window.PikminAuthGate) window.PikminAuthGate.openPanel(); };
    }
    info.appendChild(coords);

    const taxonomy = createEl("div", "postcard-taxonomy");
    taxonomy.appendChild(createEl("span", "postcard-country", category));
    if (tag) {
      const tagEl = createEl("button", `postcard-tag tag-${tag}`, tag);
      tagEl.onclick = (e) => { e.stopPropagation(); const btn = document.querySelector(`.tag-filter[data-tag="${tag}"], .mobile-tag-item[data-tag="${tag}"]`); if(btn) btn.click(); };
      taxonomy.appendChild(tagEl);
    }

    // 愛心按鈕：移到此處，不再懸浮
    const likeBtn = createEl("button", `postcard-like-inline ${liked ? "active" : ""}`);
    const updateLikeUI = (isLiked, count) => {
      likeBtn.innerHTML = `${isLiked ? "❤️" : "🤍"} <span class="like-count">${formatLikeCount(count)}</span>`;
      likeBtn.classList.toggle("active", isLiked);
    };
    updateLikeUI(liked, item.likeCount);
    
    likeBtn.title = "收藏";
    likeBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (likeBtn.dataset.busy === "true") return;
      likeBtn.dataset.busy = "true";

      const oldLiked = likeBtn.classList.contains("active");
      const oldCount = Number(item.likeCount || 0);

      // 樂觀更新：立即反應 UI
      const nextLiked = !oldLiked;
      const nextCount = Math.max(0, oldCount + (nextLiked ? 1 : -1));
      updateLikeUI(nextLiked, nextCount);

      try {
        // 呼叫統一的愛心更新函式
        await onLikeClick(item.id);
        
        // 成功後，從真正資料來源重新確認一遍 (確保與快取一致)
        const updatedItem = typeof getPostcardById === "function" ? getPostcardById(item.id) : null;
        if (updatedItem) {
          updateLikeUI(isLikedByCurrentUser(updatedItem), Number(updatedItem.likeCount || 0));
        }
      } catch (error) {
        console.error("外層愛心更新失敗：", error);
        // 失敗就還原原本狀態
        updateLikeUI(oldLiked, oldCount);
        alert("愛心操作失敗：" + (error.message || "請稍後再試"));
      } finally {
        likeBtn.dataset.busy = "false";
      }
    };
    taxonomy.appendChild(likeBtn);

    // === 審核狀態標籤 ===
    let currentUserUid = null;
    try { if (window.auth) currentUserUid = window.auth.currentUser ? window.auth.currentUser.uid : null; } catch(e){}
    const isMyCard = currentUserUid && item.ownerId === currentUserUid;

    const reviewStatus = item.reviewStatus || "approved";
    const isHidden     = item.isHidden     || false;

    // 管理員看到所有狀態標籤
    if (isAdmin) {
      const { reviewStatus, visibility } = item;
      
      // 狀態標籤對應表
      const badgeMap = {
        pending:  { cls: "review-badge review-badge--pending", text: "⏳ 待審核" },
        approved: { 
          public:  { cls: "review-badge review-badge--approved", text: "✅ 公開" },
          members: { cls: "review-badge review-badge--members",  text: "🔑 會員" },
          hidden:  { cls: "review-badge review-badge--hidden",   text: "🚫 隱藏" }
        },
        rejected: { cls: "review-badge review-badge--rejected", text: "❌ 未通過" }
      };

      let badgeInfo;
      if (reviewStatus === "approved") {
        badgeInfo = badgeMap.approved[visibility] || badgeMap.approved.public;
      } else {
        badgeInfo = badgeMap[reviewStatus] || badgeMap.pending;
      }
      
      const badge = createEl("div", badgeInfo.cls, badgeInfo.text);
      photo.appendChild(badge);

      // 7. 管理員審核操作串列按鈕
      const reviewBar = createEl("div", "review-action-bar");
      
      // 按鈕 1: 通過・公開瀏覽 (8)
      const btnPublic = createEl("button", "review-btn review-btn--approve", "🌍 公開");
      btnPublic.title = "通過・所有人可見";
      btnPublic.onclick = async (e) => {
        e.stopPropagation();
        btnPublic.disabled = true;
        try { await reviewPostcard(item.id, "approve_public"); card.remove(); }
        catch (err) { alert("操作失敗: " + err.message); btnPublic.disabled = false; }
      };

      // 按鈕 2: 通過・登入可看 (9)
      const btnMembers = createEl("button", "review-btn review-btn--members", "👥 會員");
      btnMembers.title = "通過・僅登入者可見";
      btnMembers.onclick = async (e) => {
        e.stopPropagation();
        btnMembers.disabled = true;
        try { await reviewPostcard(item.id, "approve_members"); card.remove(); }
        catch (err) { alert("操作失敗: " + err.message); btnMembers.disabled = false; }
      };

      // 按鈕 3: 退回修改 (10)
      const btnReject = createEl("button", "review-btn review-btn--reject", "↩️ 退回");
      btnReject.title = "退回修改 (僅上傳者可見)";
      btnReject.onclick = async (e) => {
        e.stopPropagation();
        btnReject.disabled = true;
        try { await reviewPostcard(item.id, "reject"); card.remove(); }
        catch (err) { alert("操作失敗: " + err.message); btnReject.disabled = false; }
      };

      // 按鈕 4: 直接刪除 (11)
      const btnDelete = createEl("button", "review-btn review-btn--delete", "🗑 刪除");
      btnDelete.title = "直接刪除此文件";
      btnDelete.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm("確定要直接刪除此明信片？")) return;
        btnDelete.disabled = true;
        try { await deletePostcard(item.id); card.remove(); }
        catch (err) { alert("刪除失敗: " + err.message); btnDelete.disabled = false; }
      };

      reviewBar.appendChild(btnPublic);
      reviewBar.appendChild(btnMembers);
      reviewBar.appendChild(btnReject);
      reviewBar.appendChild(btnDelete);
      photo.appendChild(reviewBar);

    } else if (isMyCard) {
      const { reviewStatus } = item;
      // 登入會員看到自己的待審 / 未通過標籤
      if (reviewStatus === "pending") {
        photo.appendChild(createEl("div", "review-badge review-badge--pending", "⏳ 待審核"));
      } else if (reviewStatus === "rejected") {
        photo.appendChild(createEl("div", "review-badge review-badge--rejected", "❌ 未通過"));
      } else if (item.visibility === "members") {
        photo.appendChild(createEl("div", "review-badge review-badge--members", "🔑 會員限定"));
      }
    }

    const moreMenu = createEl("div", "postcard-more-menu");
    info.appendChild(taxonomy);
    card.appendChild(info);

    card.onmouseleave = () => moreMenu.classList.remove("show");
    fragment.appendChild(card);
  });

  grid.appendChild(fragment);

  renderPagination({ containerId: "pagination", currentPage, totalPages, onPageChange });
}

function renderPagination({ containerId, currentPage, totalPages, onPageChange }) {
  const container = document.getElementById(containerId);
  if (!container || totalPages <= 1) return;
  container.innerHTML = "";

  const prevBtn = createEl("button", "pagination-btn", "上一頁");
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => onPageChange(currentPage - 1);
  container.appendChild(prevBtn);

  const info = createEl("div", "pagination-info", "第 ");
  const input = document.createElement("input");
  input.type = "number";
  input.className = "pagination-input";
  input.value = currentPage;
  input.onkeydown = (e) => { if(e.key === "Enter") onPageChange(Math.max(1, Math.min(totalPages, parseInt(input.value) || 1))); };
  info.appendChild(input);
  info.appendChild(document.createTextNode(` / ${totalPages} 頁`));
  container.appendChild(info);

  const nextBtn = createEl("button", "pagination-btn", "下一頁");
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => onPageChange(currentPage + 1);
  container.appendChild(nextBtn);
}

document.addEventListener("click", e => {
  if (!e.target.closest(".more-btn") && !e.target.closest(".postcard-more-menu")) {
    document.querySelectorAll(".postcard-more-menu.show").forEach(m => m.classList.remove("show"));
  }
});

function renderMapList({ mapList, onSelect, filters }) {
  const list = getFilteredPostcards(filters);
  mapList.innerHTML = "";
  list.forEach(item => {
    const button = createEl("button", "map-list-item");
    button.onclick = () => onSelect(item);
    const thumbnail = createEl("img");
    thumbnail.src = item.image;
    button.appendChild(thumbnail);
    const content = createEl("span");
    content.appendChild(createEl("strong", "", `No.${String(item.originalIndex + 1).padStart(3, "0")} `));
    content.appendChild(document.createTextNode(item.locationText || ""));
    const meta = createEl("span", "map-list-meta");
    meta.appendChild(createEl("span", "category-badge", item.category || "全球"));
    const liked = typeof isLikedByCurrentUser === "function" ? isLikedByCurrentUser(item) : false;
    meta.appendChild(createEl("span", "", `${liked ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`));
    content.appendChild(meta);
    button.appendChild(content);
    mapList.appendChild(button);
  });
}

function setActiveMapItem(mapList, id) {
  Array.from(mapList.children).forEach(item => {
    item.classList.toggle("active", String(item.dataset.id) === String(id));
  });
}
