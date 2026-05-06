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

function isLikedByCurrentUser(item) {
  const userId = getCurrentUserId();
  return Array.isArray(item.likedBy) && item.likedBy.includes(userId);
}

function getFilteredPostcards(filters = {}) {
  const list = getPostcards();
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
    option.textContent = category === "全球" ? `🗺️ 全球進度 (${countryCount} 國)` : category;
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

  let currentUser = null;
  try {
    if (window.firebase && typeof firebase.auth === "function") {
      currentUser = firebase.auth().currentUser;
    }
  } catch (e) {}
  
  const isRealUser = !!(currentUser && !currentUser.isAnonymous);
  let isAdmin = false;
  try {
    if (window.PikminAuthGate && typeof window.PikminAuthGate.isFirebaseAdmin === "function") {
      isAdmin = !!window.PikminAuthGate.isFirebaseAdmin();
    }
  } catch (e) {}

  list.forEach(item => {
    const category = item.category || "全球";
    const liked = typeof isLikedByCurrentUser === "function" ? isLikedByCurrentUser(item) : false;
    const isOwner = typeof isOwnedByCurrentUser === "function" && isOwnedByCurrentUser(item);
    const isBrowseModeActive = document.body.classList.contains("is-browse-mode");
    const canManage = (isAdmin || (isRealUser && isOwner)) && !isBrowseModeActive;
    
    const tag = item.tag || "";
    const isV37Locked = Boolean(window.PikminAuthGate && window.PikminAuthGate.shouldLockItem && window.PikminAuthGate.shouldLockItem(item));

    const card = createEl("article", `postcard-card ${isV37Locked ? "v37-mushroom-locked" : ""}`);
    card.dataset.id = item.id;
    card.dataset.tag = tag;

    const photo = createEl("div", "postcard-photo");
    const image = createEl("img");
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

    // 愛心按鈕
    const likeBtn = createEl("button", `float-btn like-btn ${liked ? "active" : ""}`, liked ? "❤️" : "🤍");
    likeBtn.title = "收藏";
    likeBtn.onclick = (e) => { e.stopPropagation(); onLikeClick(item.id); };
    actionsGroup.appendChild(likeBtn);

    hoverActions.appendChild(actionsGroup);

    if (!isBrowseMode && canManage) {
      const editBtn = createEl("button", "float-btn edit-btn", "編輯");
      editBtn.onclick = (e) => { e.stopPropagation(); onEditClick(item); };
      hoverActions.appendChild(editBtn);
    }

    const moreBtn = createEl("button", "float-btn more-btn", "⋯");
    if (!isBrowseMode) hoverActions.appendChild(moreBtn);

    const moreMenu = createEl("div", "postcard-more-menu");
    const shareBtn = createEl("button", "postcard-menu-action", "分享");
    shareBtn.onclick = (e) => { e.stopPropagation(); onShareClick(item.id); moreMenu.classList.remove("show"); };
    moreMenu.appendChild(shareBtn);

    if (canManage && !isBrowseMode) {
      const delBtn = createEl("button", "postcard-menu-action danger", "刪除");
      delBtn.onclick = (e) => { e.stopPropagation(); onDeleteClick(item.id); moreMenu.classList.remove("show"); };
      moreMenu.appendChild(delBtn);
    }
    
    moreBtn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll(".postcard-more-menu.show").forEach(m => { if(m !== moreMenu) m.classList.remove("show"); });
      moreMenu.classList.toggle("show");
    };

    hoverActions.appendChild(moreMenu);
    photo.appendChild(hoverActions);
    
    if (isBrowseMode) {
      card.onclick = () => onCardClick(item);
      card.style.cursor = "pointer";
    } else {
      photo.onclick = () => onCardClick(item);
    }
    card.appendChild(photo);

    const info = createEl("div", "postcard-info");
    const coords = createEl("div", "postcard-coords", isV37Locked ? "🍄解鎖開啟地圖" : (item.locationText || ""));
    if (!isV37Locked) {
      coords.onclick = (e) => { e.stopPropagation(); onCopyClick(item.locationText); };
    } else {
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
    info.appendChild(taxonomy);
    card.appendChild(info);
    
    card.onmouseleave = () => moreMenu.classList.remove("show");
    grid.appendChild(card);
  });

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
