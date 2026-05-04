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
  categoryFilter.innerHTML = "";

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category === "全球" ? "" : category;
    option.textContent = category;
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
  pageSize = 24,
  onPageChange
}) {
  const allFilteredList = getFilteredPostcards(filters);
  const totalItems = allFilteredList.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  
  // Ensure page is within bounds
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));
  
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const list = allFilteredList.slice(start, end);

  grid.innerHTML = "";
  emptyState.classList.toggle("hidden", totalItems > 0);

  list.forEach(item => {
    const category = item.category || "全球";
    const liked = isLikedByCurrentUser(item);
    const canDelete = isOwnedByCurrentUser(item);
    const tag = item.tag || "";
    const isV37Locked = Boolean(window.PikminAuthGate && window.PikminAuthGate.shouldLockItem(item));

    const card = createEl("article", `postcard-card ${isV37Locked ? "v37-mushroom-locked" : ""}`);
    card.dataset.id = item.id;
    card.dataset.tag = tag;

    const photo = createEl("div", "postcard-photo");

    const image = createEl("img");
    image.onload = () => {
      const ratio = image.naturalWidth / image.naturalHeight;
      if (ratio > 1.2) {
        image.classList.add("landscape");
      }
    };
    image.src = item.image;
    image.alt = "Pikmin postcard image";
    let focusX = clampPercent(item.imageFocusX);
    let focusY = clampPercent(item.imageFocusY);
    image.style.setProperty("object-position", `${focusX}% ${focusY}%`, "important");
    photo.appendChild(image);

    const isBrowseMode = document.body.classList.contains("is-browse-mode");

    const hoverActions = createEl("div", "postcard-hover-actions");

    const likeButton = createEl(
      "button",
      `float-btn like-btn postcard-want ${liked ? "active" : ""}`,
      `${liked ? "❤️" : "♡"} ${formatLikeCount(item.likeCount)}`
    );
    likeButton.type = "button";
    likeButton.title = "收藏 / 取消收藏";
    likeButton.addEventListener("click", event => {
      event.stopPropagation();
      onLikeClick(item.id);
    });
    hoverActions.appendChild(likeButton);

    if (typeof onEditClick === "function" && !isBrowseMode) {
      const editButton = createEl("button", "float-btn edit-btn", "編輯");
      editButton.type = "button";
      editButton.title = "編輯明信片";
      editButton.addEventListener("click", event => {
        event.stopPropagation();
        onEditClick(item);
      });
      hoverActions.appendChild(editButton);
    }

    const moreButton = createEl("button", "float-btn more-btn", "⋯");
    moreButton.type = "button";
    moreButton.title = "更多操作";
    if (!isBrowseMode) {
      hoverActions.appendChild(moreButton);
    }

    const moreMenu = createEl("div", "postcard-more-menu");

    const shareMenuButton = createEl("button", "postcard-menu-action", "分享");
    shareMenuButton.type = "button";
    shareMenuButton.addEventListener("click", event => {
      event.stopPropagation();
      onShareClick(item.id);
      moreMenu.classList.remove("show");
    });
    moreMenu.appendChild(shareMenuButton);

    if (canDelete && !isBrowseMode) {
      const deleteMenuButton = createEl("button", "postcard-menu-action danger", "刪除");
      deleteMenuButton.type = "button";
      deleteMenuButton.addEventListener("click", event => {
        event.stopPropagation();
        onDeleteClick(item.id);
        moreMenu.classList.remove("show");
      });
      moreMenu.appendChild(deleteMenuButton);
    }
    
    moreButton.addEventListener("click", event => {
      event.stopPropagation();
      document.querySelectorAll(".postcard-more-menu.show").forEach(menu => {
        if (menu !== moreMenu) menu.classList.remove("show");
      });
      moreMenu.classList.toggle("show");
    });

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

    const coords = createEl("div", "postcard-coords", isV37Locked ? "🔒 登入後查看 GPS" : (item.locationText || ""));
    const coordText = String(item.locationText || "").trim();
    if (!isV37Locked) {
      if (coordText.length >= 24) {
        coords.classList.add("coords-very-long");
      } else if (coordText.length >= 20) {
        coords.classList.add("coords-long");
      }
      coords.title = "點擊複製座標";
      coords.addEventListener("click", event => {
        event.stopPropagation();
        onCopyClick(item.locationText);
      });
    } else {
      coords.title = "蘑菇 GPS 已鎖定，請登入解鎖";
      coords.addEventListener("click", event => {
        event.stopPropagation();
        if (window.PikminAuthGate) window.PikminAuthGate.openPanel();
      });
    }
    info.appendChild(coords);

    const taxonomy = createEl("div", "postcard-taxonomy");
    taxonomy.appendChild(createEl("span", "postcard-country", category));

    if (tag) {
      const tagEl = createEl("button", `postcard-tag tag-${tag}`, tag);
      tagEl.type = "button";
      tagEl.title = `篩選：${tag}`;
      tagEl.addEventListener("click", event => {
        event.stopPropagation();
        const tagButton = document.querySelector(`.mobile-tag-item[data-tag="${tag}"]`);
        if (tagButton) tagButton.click();
      });
      taxonomy.appendChild(tagEl);
    }

    info.appendChild(taxonomy);
    card.appendChild(info);
    
    card.addEventListener("mouseleave", () => {
      moreMenu.classList.remove("show");
    });

    grid.appendChild(card);
  });

  // Render Pagination Controls
  renderPagination({
    containerId: "pagination",
    currentPage,
    totalPages,
    onPageChange
  });
}

function renderPagination({ containerId, currentPage, totalPages, onPageChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  if (totalPages <= 1) return;

  const prevBtn = createEl("button", "pagination-btn", "上一頁");
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => onPageChange(currentPage - 1));
  container.appendChild(prevBtn);

  const info = createEl("div", "pagination-info");
  info.textContent = "第 ";
  
  const pageInput = document.createElement("input");
  pageInput.type = "number";
  pageInput.className = "pagination-input";
  pageInput.value = currentPage;
  pageInput.min = 1;
  pageInput.max = totalPages;
  
  const handlePageJump = () => {
    let val = parseInt(pageInput.value);
    if (isNaN(val)) val = currentPage;
    if (val < 1) val = 1;
    if (val > totalPages) val = totalPages;
    if (val !== currentPage) onPageChange(val);
  };

  pageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handlePageJump();
  });
  pageInput.addEventListener("blur", handlePageJump);

  info.appendChild(pageInput);
  info.appendChild(document.createTextNode(` / ${totalPages} 頁`));
  container.appendChild(info);

  const nextBtn = createEl("button", "pagination-btn", "下一頁");
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener("click", () => onPageChange(currentPage + 1));
  container.appendChild(nextBtn);
}

document.addEventListener("click", event => {
  if (!event.target.closest(".more-btn") && !event.target.closest(".postcard-more-menu")) {
    document.querySelectorAll(".postcard-more-menu.show").forEach(menu => {
      menu.classList.remove("show");
    });
  }
});

function renderMapList({ mapList, onSelect, filters }) {
  const list = getFilteredPostcards(filters);
  mapList.innerHTML = "";

  list.forEach(item => {
    const button = createEl("button", "map-list-item");
    button.type = "button";
    button.dataset.id = item.id;

    const thumbnail = createEl("img");
    thumbnail.src = item.image;
    thumbnail.alt = "postcard thumbnail";
    button.appendChild(thumbnail);

    const content = createEl("span");
    content.appendChild(createEl("strong", "", `No.${String(item.originalIndex + 1).padStart(3, "0")}`));
    content.appendChild(createEl("span", "", item.locationText || ""));

    const meta = createEl("span", "map-list-meta");
    meta.appendChild(createEl("span", "category-badge", item.category || "全球"));
    meta.appendChild(createEl("span", "", `${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`));
    content.appendChild(meta);

    button.appendChild(content);
    button.addEventListener("click", () => onSelect(item));
    mapList.appendChild(button);
  });
}

function setActiveMapItem(mapList, id) {
  Array.from(mapList.children).forEach(item => {
    item.classList.toggle("active", String(item.dataset.id) === String(id));
  });
}
