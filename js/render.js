function formatCoords(coords){
  if(!coords) return "";
  const [lat, lng] = String(coords).split(",").map(n => parseFloat(n));
  if(Number.isNaN(lat) || Number.isNaN(lng)) return coords;
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
      const text = [item.locationText || "", itemCategory, item.note || "", itemTag].join(" ").toLowerCase();
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

function renderPostcards({ grid, emptyState, onCardClick, onLikeClick, onCopyClick, onDeleteClick, onShareClick, onEditClick, filters }) {
  if (!grid) return;
  const list = getFilteredPostcards(filters);

  grid.innerHTML = "";
  if (emptyState) emptyState.classList.toggle("hidden", list.length > 0);

  const fragment = document.createDocumentFragment();

  list.forEach((item, index) => {
    const category = item.category || "全球";
    const liked = isLikedByCurrentUser(item);
    const canDelete = isOwnedByCurrentUser(item);
    const tag = item.tag || "";

    const card = createEl("article", "postcard-card");
    card.dataset.id = item.id;

    const photo = createEl("div", "postcard-photo");
    const image = createEl("img");
    
    // 相容性較高的加載方式
    if (index < 6) {
      image.loading = "eager";
    } else {
      image.loading = "lazy";
    }
    
    image.src = item.image;
    image.alt = "Pikmin postcard image";
    image.style.objectPosition = `${clampPercent(item.imageFocusX)}% ${clampPercent(item.imageFocusY)}%`;
    photo.appendChild(image);

    const isBrowseMode = document.body.classList.contains("is-browse-mode");
    const hoverActions = createEl("div", "postcard-hover-actions");

    const likeButton = createEl("button", `float-btn like-btn postcard-want ${liked ? "active" : ""}`, `${liked ? "❤️" : "♡"} ${formatLikeCount(item.likeCount)}`);
    likeButton.type = "button";
    likeButton.addEventListener("click", e => { e.stopPropagation(); onLikeClick(item.id); });
    hoverActions.appendChild(likeButton);

    if (onEditClick && !isBrowseMode) {
      const editButton = createEl("button", "float-btn edit-btn", "編輯");
      editButton.addEventListener("click", e => { e.stopPropagation(); onEditClick(item); });
      hoverActions.appendChild(editButton);
    }

    const moreButton = createEl("button", "float-btn more-btn", "⋯");
    if (!isBrowseMode) hoverActions.appendChild(moreButton);

    const moreMenu = createEl("div", "postcard-more-menu");
    const shareBtn = createEl("button", "postcard-menu-action", "分享");
    shareBtn.addEventListener("click", e => { e.stopPropagation(); onShareClick(item.id); moreMenu.classList.remove("show"); });
    moreMenu.appendChild(shareBtn);

    if (canDelete && !isBrowseMode) {
      const delBtn = createEl("button", "postcard-menu-action danger", "刪除");
      delBtn.addEventListener("click", e => { e.stopPropagation(); onDeleteClick(item.id); moreMenu.classList.remove("show"); });
      moreMenu.appendChild(delBtn);
    }

    moreButton.addEventListener("click", e => {
      e.stopPropagation();
      document.querySelectorAll(".postcard-more-menu.show").forEach(m => { if(m !== moreMenu) m.classList.remove("show"); });
      moreMenu.classList.toggle("show");
    });

    photo.appendChild(hoverActions);
    if (isBrowseMode) { card.onclick = () => onCardClick(item); card.style.cursor = "pointer"; }
    else { photo.onclick = () => onCardClick(item); }
    card.appendChild(photo);

    const info = createEl("div", "postcard-info");
    const coords = createEl("div", "postcard-coords", item.locationText || "");
    coords.addEventListener("click", e => { e.stopPropagation(); onCopyClick(item.locationText); });
    info.appendChild(coords);

    const taxonomy = createEl("div", "postcard-taxonomy");
    taxonomy.appendChild(createEl("span", "postcard-country", category));
    if (tag) {
      const tagEl = createEl("button", `postcard-tag tag-${tag}`, tag);
      tagEl.addEventListener("click", e => { e.stopPropagation(); const btn = document.querySelector(`.tag-filter[data-tag="${tag}"]`); if(btn) btn.click(); });
      taxonomy.appendChild(tagEl);
    }
    info.appendChild(taxonomy);
    card.appendChild(info);
    card.addEventListener("mouseleave", () => moreMenu.classList.remove("show"));

    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
  grid.classList.add("ready");
}

document.addEventListener("click", e => {
  if (!e.target.closest(".more-btn") && !e.target.closest(".postcard-more-menu")) {
    document.querySelectorAll(".postcard-more-menu.show").forEach(m => m.classList.remove("show"));
  }
});

function renderMapList({ mapList, onSelect, filters }) {
  if (!mapList) return;
  const list = getFilteredPostcards(filters);
  mapList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  list.forEach(item => {
    const btn = createEl("button", "map-list-item");
    btn.dataset.id = item.id;
    const thumb = createEl("img");
    thumb.src = item.image;
    btn.appendChild(thumb);
    const content = createEl("span");
    content.appendChild(createEl("strong", "", `No.${String(item.originalIndex + 1).padStart(3, "0")}`));
    content.appendChild(createEl("span", "", item.locationText || ""));
    const meta = createEl("span", "map-list-meta");
    meta.appendChild(createEl("span", "category-badge", item.category || "全球"));
    meta.appendChild(createEl("span", "", `${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`));
    content.appendChild(meta);
    btn.appendChild(content);
    btn.addEventListener("click", () => onSelect(item));
    fragment.appendChild(btn);
  });
  mapList.appendChild(fragment);
}

function setActiveMapItem(mapList, id) {
  if(!mapList) return;
  Array.from(mapList.children).forEach(item => {
    item.classList.toggle("active", String(item.dataset.id) === String(id));
  });
}
